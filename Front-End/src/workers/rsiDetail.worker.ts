import { runRsiDetailTask } from '@/utils/rsiDetailCompute';
import type {
  RsiDetailWorkerRequest,
  RsiDetailWorkerResponse,
} from '@/utils/rsiDetailCompute';

/**
 * RsiFilterMark 专用 Worker 入口
 * 每个详情页只有 1 个该 Worker；具体计算逻辑统一在 @/utils/rsiDetailCompute 中实现
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<RsiDetailWorkerRequest>) => void) | null;
  postMessage: (message: RsiDetailWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, task } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: runRsiDetailTask(task) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
