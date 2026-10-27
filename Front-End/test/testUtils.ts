/**
 * 测试公共断言工具（非测试文件，不会被 `test/*.test.ts` 通配纳入执行）
 *
 * 每个测试文件独立进程运行，因此各文件各自维护计数、结束时调用 summary() 汇总并抛错。
 */

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function assert(cond: unknown, label: string, detail?: unknown): void {
  if (cond) {
    passed += 1;
    console.log(`  [OK] ${label}`);
    return;
  }
  failed += 1;
  failures.push(label);
  console.error(`  [FAIL] ${label}`);
  if (detail !== undefined) console.error('         detail:', detail);
}

export function eq<T>(actual: T, expected: T, label: string, tol?: number): void {
  let ok: boolean;
  if (tol !== undefined && typeof actual === 'number' && typeof expected === 'number') {
    ok = Math.abs(actual - expected) <= tol;
  } else {
    ok = actual === expected;
  }
  if (ok) {
    passed += 1;
    console.log(`  [OK] ${label}  (${JSON.stringify(actual)})`);
    return;
  }
  failed += 1;
  failures.push(label);
  console.error(`  [FAIL] ${label}\n         expected: ${JSON.stringify(expected)}\n         actual:   ${JSON.stringify(actual)}`);
}

export function approx(actual: number, expected: number, label: string, tol = 0.01): void {
  eq(actual, expected, label, tol);
}

/** 输出汇总；存在失败时抛错，让 `npm test` 以非 0 退出码结束 */
export function summary(): void {
  console.log(`\n── 汇总：通过 ${passed} / 失败 ${failed} ──`);
  if (failed > 0) {
    console.error('失败列表：', failures);
    throw new Error(`${failed} 个断言失败`);
  }
  console.log('全部通过');
}
