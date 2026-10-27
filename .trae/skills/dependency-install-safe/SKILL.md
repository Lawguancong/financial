---
name: dependency-install-safe
description: 安装第三方依赖时，严格锁定已有依赖的版本号，防止 npm 解析 peerDependencies / semver 范围时顺手升级或移除已有包。用于新增/升级依赖、重构 package.json、锁 package-lock.json 的所有 npm/pnpm/yarn 操作；不用于纯代码改动或纯问答。
---

# 安全安装依赖（不改已有版本）

项目里**每一个**已有依赖的版本号都是人工确认过的（React 19、Vite 7、Ant Design 6、@ant-design/charts 2.x、moment 2.x、ahooks 3.x、decimal.js 10.x …），**不能**因为一次 `npm install -D xxx` 就被 npm 顺手升级或移除。

## 触发时机

- 新增依赖（devDependencies 或 dependencies 任一）
- 升级已有依赖（改版本号后装）
- 执行任何会动 package.json / package-lock.json 的 npm 命令

## 核心规则

**一次只装一个包**，装完立即 diff 验证：

```bash
# ❌ 危险：npm 会重新解析整个依赖树，可能顺手改掉一堆
npm install xxx

# ✅ 安全：只新增一个，不动其他
npm install -D tsx@^4.23.15 --no-save=false
npm install moment@^2.30.1 --no-save=false
```

## 步骤

1. **先 diff 记当前 baseline**
   ```bash
   git diff package.json           # 应该为空
   ```

2. **只装一个包（带精确版本范围）**
   - 用 `npm install -D <pkg>@<version>` 或 `npm install <pkg>@<version>`
   - 带 semver 范围（`^` / `~`）也可以，但**只装一个**，不要 `npm install` 批量装多个新包
   - 禁用 `npm install`（不带参数），它会重新解析整个依赖树

3. **装完立即 diff 校验**
   ```bash
   git diff package.json
   ```
   允许的 diff：
   - ✅ 只新增了一个条目（本次安装的包）
   - ✅ 如果装的是已存在的包，可以是**同一条目版本号升级**（如 `^4.0` → `^4.1`，但只能是这一行）
   - ❌ 任何已有条目（**peerDependencies / dependencies / devDependencies 三个层级都算**）的版本号变化
   - ❌ 任何已有条目被移除
   - ❌ peerDependencies 里的条目被自动改写（常见触发：装的新包声明了 peer react@不同范围，npm 重算 peer tree）
   - ❌ dependencies 和 devDependencies 里出现本次安装包之外的变化

4. **如果发现非预期改动 → 立即回滚**
   ```bash
   git checkout -- package.json package-lock.json
   rm -rf node_modules package-lock.json
   npm install           # 用锁文件重新装回 baseline
   ```
   回滚后重新按步骤 1~3 走。

## 前置：确认 Node 版本

不同 Node 版本（尤其是 18 vs 20）对 peerDependencies 的解析策略不同：
- Node 18 的 npm 对 peer 冲突更宽容，可能直接跳过或静默修正
- Node 20 的 npm 更严格，会在某些情况下自动改写 package.json 里的 peer 版本范围

**本项目锁定 Node.js `v20.19.5`**（见仓库根 `.nvmrc`），装依赖前先确认：
```bash
node --version   # 应输出 v20.19.5
nvm use          # 切换到 .nvmrc 指定的版本
```
用错 Node 版本可能导致 baseline 就已经漂了，diff 校验会有噪声。

## 已知"容易被 npm 顺手改版本"的高风险操作

| 操作 | 风险 | 替代方案 |
|------|------|---------|
| `npm install`（不带参数） | 重新解析 peerDependencies，可能升级 React / @types/react / @vitejs/plugin-react 等互相耦合的包 | 永远不要这么调；如果想重装，必须有 lockfile |
| `npm install xxx@latest` | latest 可能打破版本兼容，且不带 semver 范围 | 明确写 semver，如 `^4.23.15` |
| `npm update` / `npm update -D` | 一次性全量升级 | 逐个包装，每个装完 diff 校验 |
| 删 package-lock.json 后 `npm install` | 重新解析可能拿到新的 semver 满足 | 保持 lockfile 存在，除非你明确知道要全量更新 |

## 本项目禁止版本漂移的核心依赖清单（装新包后重点 diff 检查）

**三层都不能动**（peerDependencies / dependencies / devDependencies）：

```
[peerDependencies]  react      ^19.2.0    ← npm 解析 peer tree 时最容易被顺手改
[peerDependencies]  react-dom  ^19.2.0

[dependencies]      react              ^19.2.0
[dependencies]      react-dom          ^19.2.0
[dependencies]      react-router-dom   ^7.13.0
[dependencies]      antd               ^6.x
[dependencies]      @ant-design/charts ^2.x
[dependencies]      vite               ^7.x
[dependencies]      moment             ^2.x
[dependencies]      ahooks             ^3.x
[dependencies]      decimal.js         ^10.x
[dependencies]      axios              ^1.x
[dependencies]      lodash-es          ^4.x

[devDependencies]   typescript          ~5.9.x
[devDependencies]   @types/react        ^19.x
[devDependencies]   @vitejs/plugin-react ^5.x
```

（清单来自 `Front-End/package.json`，任何改动都会破坏：React 19 JSX 运行时对齐 / 类型声明 @types/react 版本匹配 / G2 v5 API 兼容 / moment locale 配置 / ahooks / decimal.js 导出结构。特别注意 peerDependencies 的 react/react-dom 和 dependencies 里是**同一个包、同一个版本**，npm 解析 peer 时会联动修改，装任何声明了 react peer 的新包前必须先 diff baseline。）

## 禁止

- 不说就执行 `npm install` 不带任何参数
- 一次装多个新包然后指望 diff 容易核对
- 看到 package.json 被改了多个依赖还"算了就那样吧"
- 装完不 diff 就直接进入下一步写代码
