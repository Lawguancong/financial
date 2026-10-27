import { runBuyPointTask } from '@/utils/buyPointCompute';
import type {
  BuyPointWorkerRequest,
  BuyPointWorkerResponse,
} from '@/utils/buyPointCompute';

/**
 * 买点计算 Worker 入口
 * 仅负责消息收发，具体计算逻辑统一在 @/utils/buyPointCompute 中实现
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<BuyPointWorkerRequest>) => void) | null;
  postMessage: (message: BuyPointWorkerResponse) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, task } = event.data;
  try {
    scope.postMessage({ id, ok: true, result: runBuyPointTask(task) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
