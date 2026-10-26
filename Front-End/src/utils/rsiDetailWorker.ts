import type {
  RsiDetailResult,
  RsiDetailTask,
  RsiDetailWorkerRequest,
  RsiDetailWorkerResponse,
} from '@/utils/rsiDetailCompute';

/** 单 Worker 客户端：一个 RsiFilterMark 实例独占一个 Worker */
export interface RsiDetailWorkerClient {
  /** 提交一次详情计算任务 */
  compute: (task: RsiDetailTask) => Promise<RsiDetailResult>;
  /** 终止 Worker（切换数据/卸载时调用，旧任务立即取消） */
  terminate: () => void;
}

interface PendingJob {
  resolve: (result: RsiDetailResult) => void;
  reject: (error: Error) => void;
}

/**
 * 创建 RsiFilterMark 专用单 Worker
 *
 * 与列表页共用的 Worker 池隔离：每个详情页标签页各自创建 1 个 Worker，
 * 多开不同 code 的详情页时天然互不干扰。
 */
export const createRsiDetailWorker = (): RsiDetailWorkerClient => {
  const worker = new Worker(new URL('../workers/rsiDetail.worker.ts', import.meta.url), {
    type: 'module',
  });

  let nextId = 1;
  const pending = new Map<number, PendingJob>();

  const rejectAll = (message: string): void => {
    pending.forEach(({ reject }) => reject(new Error(message)));
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<RsiDetailWorkerResponse>) => {
    const { id, ok, result, error } = event.data;
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (ok && result) job.resolve(result);
    else job.reject(new Error(error ?? 'RSI6 详情计算失败'));
  };

  worker.onerror = (event: ErrorEvent) => {
    rejectAll(event.message || 'RSI6 详情计算 Worker 异常');
  };

  return {
    compute: (task) =>
      new Promise<RsiDetailResult>((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, { resolve, reject });
        const request: RsiDetailWorkerRequest = { id, task };
        worker.postMessage(request);
      }),
    terminate: () => {
      rejectAll('RSI6 详情计算已取消');
      worker.terminate();
    },
  };
};
