import type {
  BuyPointResult,
  BuyPointTask,
  BuyPointWorkerRequest,
  BuyPointWorkerResponse,
} from '@/utils/buyPointCompute';
import { appConfig } from '@/config/appConfig';

/**
 * 买点计算 Worker 池客户端
 *
 * 所有「计算买点」功能统一走这里：把重计算（日/周/月/季 RSI6、分位阈值、买卖配对）
 * 放到 Worker 线程执行，避免主线程同步计算导致的页面卡顿。
 * 池大小受限，任务超出并发上限时进入等待队列，空闲 Worker 自动派发。
 */

/** Worker 池上限（配置见 appConfig.worker.maxWorkers） */
const MAX_WORKERS = appConfig.worker.maxWorkers;

interface PoolWorker {
  worker: Worker;
  /** 当前正在处理的请求 id，空闲时为 null */
  currentId: number | null;
}

interface PendingJob {
  task: BuyPointTask;
  resolve: (result: BuyPointResult) => void;
  reject: (error: Error) => void;
}

let nextId = 1;
let pool: PoolWorker[] = [];
const pendingJobs = new Map<number, PendingJob>();
const waitingQueue: PendingJob[] = [];

/** 把等待队列中的任务派发给空闲 Worker */
const pump = (): void => {
  ensurePool();
  for (const slot of pool) {
    if (waitingQueue.length === 0) return;
    if (slot.currentId !== null) continue;
    const job = waitingQueue.shift();
    if (!job) return;
    const id = nextId;
    nextId += 1;
    pendingJobs.set(id, job);
    slot.currentId = id;
    const request: BuyPointWorkerRequest = { id, task: job.task };
    slot.worker.postMessage(request);
  }
};

/** 懒创建 Worker 池：首次调用时才创建，避免无谓开销 */
const ensurePool = (): void => {
  if (pool.length > 0) return;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || MAX_WORKERS : MAX_WORKERS;
  const size = Math.min(MAX_WORKERS, Math.max(1, cores - 1));
  pool = Array.from({ length: size }, () => {
    const worker = new Worker(new URL('../workers/buyPoint.worker.ts', import.meta.url), {
      type: 'module',
    });
    const slot: PoolWorker = { worker, currentId: null };

    worker.onmessage = (event: MessageEvent<BuyPointWorkerResponse>) => {
      const { id, ok, result, error } = event.data;
      const job = pendingJobs.get(id);
      if (job) {
        pendingJobs.delete(id);
        if (ok && result) job.resolve(result);
        else job.reject(new Error(error ?? '买点计算失败'));
      }
      slot.currentId = null;
      pump();
    };

    worker.onerror = (event: ErrorEvent) => {
      const id = slot.currentId;
      if (id !== null) {
        const job = pendingJobs.get(id);
        pendingJobs.delete(id);
        job?.reject(new Error(event.message || '买点计算 Worker 异常'));
      }
      slot.currentId = null;
      pump();
    };

    return slot;
  });
};

/**
 * 提交单个买点计算任务到 Worker 池
 * @param task 计算任务（标的口径 + 原始序列）
 * @returns 买点计算结果
 */
export const computeBuyPoints = (task: BuyPointTask): Promise<BuyPointResult> =>
  new Promise<BuyPointResult>((resolve, reject) => {
    waitingQueue.push({ task, resolve, reject });
    pump();
  });
