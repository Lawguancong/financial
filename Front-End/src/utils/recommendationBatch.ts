import { message } from 'antd';

/** 单个标的的推荐买点结果 */
export interface RecommendationPoints {
  /** 定量买点日期，逗号分隔 */
  quantitative: string;
  /** 百分位买点日期，逗号分隔 */
  percentile: string;
}

export interface RecommendationBatchOptions<T, R = RecommendationPoints> {
  /** 待计算的目标列表（调用方已按勾选过滤） */
  targets: T[];
  /** 唯一标识（异常日志用，可选） */
  getKey?: (item: T) => string;
  /** 进度提示中展示的标的名称 */
  getName: (item: T) => string;
  /** 未选择任何标的时的提示文案 */
  emptyWarn: string;
  /** 单个标的的买点计算（由各页面提供，负责取数及各自口径） */
  fetchBuyPoints: (item: T) => Promise<R>;
  /** 单只计算完成后的增量回调（更新该行表格数据并持久化） */
  onItemDone: (item: T, result: R) => void;
}

/**
 * 推荐买点批量计算编排（基金 / 个股 / 指数自选表格共用）：
 * 校验选择 -> 逐个串行计算 -> 每完成一只即回调增量更新 -> 进度提示 -> 完成提示。
 * 单个标的失败不中断后续计算。
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
  for (let index = 0; index < total; index += 1) {
    const item = targets[index];
    message.info(`正在分析【${getName(item)}】中...（${index + 1}/${total}）`, 10);
    try {
      const result = await fetchBuyPoints(item);
      onItemDone(item, result);
    } catch (error) {
      const key = getKey ? getKey(item) : String(index);
      console.error(`计算推荐买点失败 [${key}]:`, error);
    }
  }

  message.success(`推荐买点计算完成（共 ${total} 只）`);
};
