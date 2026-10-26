import { message, Modal } from 'antd';
import { appConfig } from '@/config/appConfig';

/** 单个标的取数/计算失败后的重试次数（不含首次尝试），配置见 appConfig.batch.fetchRetryCount */
export const FETCH_RETRY_COUNT = appConfig.batch.fetchRetryCount;

/** 重试间隔（毫秒），配置见 appConfig.batch.retryDelayMs */
const RETRY_DELAY_MS = appConfig.batch.retryDelayMs;

/** 单个标的的推荐买点结果 */
export interface RecommendationPoints {
  /** 定量买点日期，逗号分隔 */
  quantitative: string;
  /** 百分位买点日期，逗号分隔 */
  percentile: string;
}

/** 批量买点计算默认并发数（配置见 appConfig.batch.concurrency） */
const DEFAULT_BATCH_CONCURRENCY = appConfig.batch.concurrency;

export interface RecommendationBatchOptions<T, R = RecommendationPoints> {
  /** 待计算的目标列表（调用方已按勾选过滤） */
  targets: T[];
  /** 唯一标识（异常日志用，可选） */
  getKey?: (item: T) => string;
  /** 进度提示中展示的标的名称 */
  getName: (item: T) => string;
  /** 未选择任何标的时的提示文案 */
  emptyWarn: string;
  /** 单个标的的买点计算（由各页面提供，负责取数并调用 Worker 计算） */
  fetchBuyPoints: (item: T) => Promise<R>;
  /** 单只计算完成后的增量回调（更新该行表格数据并持久化） */
  onItemDone: (item: T, result: R) => void;
  /** 并发计算的标的数量，默认 4 */
  concurrency?: number;
}

/** 单个失败标的（用于最后汇总弹窗） */
export interface BatchFailure {
  key: string;
  name: string;
  reason: string;
}

/** 批量计算结果：供调用方判断是否需要补充「无信号」等提示 */
export interface RecommendationBatchResult {
  total: number;
  successCount: number;
  failures: BatchFailure[];
}

/** 把异常转为可展示文案 */
const toFailureReason = (error: unknown): string => {
  if (error instanceof Error) return error.message || '未知异常';
  return String(error ?? '未知异常');
};

/** 等待指定毫秒 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 推荐买点批量计算编排（基金 / 个股 / 指数 / 大宗商品 / 外盘期货共用）：
 * 校验选择 -> 受限并发计算（计算在 Worker 线程执行）-> 每完成一只即回调增量更新
 * -> keyed 进度提示 -> 完成提示。单个标的失败不中断后续计算。
 *
 * 取数/计算异常时自动重试 FETCH_RETRY_COUNT 次（不含首次）；仍失败则跳过该标的，
 * 全部结束后通过 Modal 汇总展示失败标的与原因，避免接口异常导致结果静默缺失。
 */
export const runRecommendationBatchCalculation = async <T, R = RecommendationPoints>(
  options: RecommendationBatchOptions<T, R>,
): Promise<RecommendationBatchResult> => {
  const { targets, getKey, getName, emptyWarn, fetchBuyPoints, onItemDone } = options;

  if (!targets || targets.length === 0) {
    message.warning(emptyWarn);
    return { total: 0, successCount: 0, failures: [] };
  }

  const total = targets.length;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_BATCH_CONCURRENCY, total));
  const failures: BatchFailure[] = [];

  let completed = 0;
  const progressKey = 'recommendation-batch-progress';
  message.loading({ content: `正在计算推荐买点…（已完成 0/${total}）`, key: progressKey, duration: 0 });

  // 取数失败重试：首次 + FETCH_RETRY_COUNT 次重试，全部失败才抛出
  const fetchWithRetry = async (item: T): Promise<R> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
      try {
        return await fetchBuyPoints(item);
      } catch (error) {
        lastError = error;
        if (attempt < FETCH_RETRY_COUNT) await delay(RETRY_DELAY_MS);
      }
    }
    throw lastError ?? new Error('取数失败');
  };

  // 任务队列 + 固定数量「执行槽」并发拉取队列，执行槽数量即并发上限
  const queue = targets.map((item, index) => ({ item, index }));

  const runSlot = async (): Promise<void> => {
    let current = queue.shift();
    while (current) {
      const { item, index } = current;
      try {
        const result = await fetchWithRetry(item);
        onItemDone(item, result);
      } catch (error) {
        const key = getKey ? getKey(item) : String(index);
        const reason = toFailureReason(error);
        failures.push({ key, name: getName(item), reason });
        console.error(`计算推荐买点失败 [${key}]（已重试 ${FETCH_RETRY_COUNT} 次）:`, error);
      } finally {
        completed += 1;
        message.loading({
          content: `正在计算【${getName(item)}】买点…（已完成 ${completed}/${total}）`,
          key: progressKey,
          duration: 0,
        });
      }
      current = queue.shift();
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runSlot()));

  const successCount = total - failures.length;

  if (failures.length > 0) {
    message.warning({
      content: `推荐买点处理完成（成功 ${successCount}/${total}，失败 ${failures.length}）`,
      key: progressKey,
      duration: 3,
    });
    Modal.error({
      title: `以下 ${failures.length} 个标的接口异常，已跳过`,
      content: failures.map(failure => `【${failure.key}】${failure.name}：${failure.reason}`).join('；'),
      okText: '知道了',
    });
    return { total, successCount, failures };
  }

  message.success({ content: `推荐买点计算完成（共 ${total} 只）`, key: progressKey, duration: 2 });
  return { total, successCount, failures };
};
