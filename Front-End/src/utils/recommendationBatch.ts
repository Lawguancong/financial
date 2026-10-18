import { message } from 'antd';

/** 单个标的的推荐买点结果 */
export interface RecommendationPoints {
  /** 定量买点日期，逗号分隔 */
  quantitative: string;
  /** 百分位买点日期，逗号分隔 */
  percentile: string;
}

/** 批量买点计算默认并发数（与 Worker 池上限一致，避免任务排队空转） */
const DEFAULT_BATCH_CONCURRENCY = 4;

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

/**
 * 推荐买点批量计算编排（基金 / 个股 / 指数 / 大宗商品 / 外盘期货共用）：
 * 校验选择 -> 受限并发计算（计算在 Worker 线程执行）-> 每完成一只即回调增量更新
 * -> keyed 进度提示 -> 完成提示。单个标的失败不中断后续计算。
 */
export const runRecommendationBatchCalculation = async <T, R = RecommendationPoints>(
  options: RecommendationBatchOptions<T, R>,
): Promise<void> => {
  const { targets, getKey, getName, emptyWarn, fetchBuyPoints, onItemDone } = options;

  if (!targets || targets.length === 0) {
    message.warning(emptyWarn);
    return;
  }

  const total = targets.length;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? DEFAULT_BATCH_CONCURRENCY, total));

  let completed = 0;
  const progressKey = 'recommendation-batch-progress';
  message.loading({ content: `正在计算推荐买点…（已完成 0/${total}）`, key: progressKey, duration: 0 });

  // 任务队列 + 固定数量「执行槽」并发拉取队列，执行槽数量即并发上限
  const queue = targets.map((item, index) => ({ item, index }));

  const runSlot = async (): Promise<void> => {
    let current = queue.shift();
    while (current) {
      const { item, index } = current;
      try {
        const result = await fetchBuyPoints(item);
        onItemDone(item, result);
      } catch (error) {
        const key = getKey ? getKey(item) : String(index);
        console.error(`计算推荐买点失败 [${key}]:`, error);
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

  message.success({ content: `推荐买点计算完成（共 ${total} 只）`, key: progressKey, duration: 2 });
};
