# DEV 说明（关键函数备忘）

本项目集成 OpenCC（参考 [OpenCC 仓库](https://github.com/BYVoid/OpenCC)），提供 Chrome MV3 插件对网页文本进行简繁/地区用词转换。

## 目录
- `data/config/*.json`：OpenCC 预设配置（如 `s2t.json`、`s2twp.json`）
- `data/dictionary/*`：OpenCC 词典资源（如 `STPhrases.ocd2` 等）
- `extension/`：Chrome 扩展源代码
  - `vendor/opencc.full.umd.js`：浏览器端 OpenCC 实现（从 `opencc-js` 拷贝）
  - `content.js`：内容脚本，负责 DOM 遍历与文本替换
  - `popup.html/.css/.js`：设置面板 UI 与存储
  - `background.js`：安装初始化默认设置

## 关键函数

### `extension/content.js`
- `getSettings()`：读取 `chrome.storage.sync` 的启用与模式设置。
- `onSettingsChange(callback)`：监听设置变更，触发重新应用。
- `shouldSkip(node)`：过滤 `script/style/pre/code/textarea/input/iframe/可编辑` 等节点，避免误改。
- `walkTextNodes(root, visitor)`：遍历文本节点（TreeWalker），仅处理非空文本。
- `createConverterByMode(mode)`：基于 `opencc-js` 的 UMD 全量构建创建转换器。当前映射：
  - `s2t`/`cn2t` → `{ from: 'cn', to: 'tw' }`
  - `s2tw` → `{ from: 'cn', to: 'tw' }`
  - `s2hk` → `{ from: 'cn', to: 'hk' }`
  - `s2twp` → `{ from: 'cn', to: 'twp' }`
  - `t2s`/`t2cn` → `{ from: 'tw', to: 'cn' }`
- `replaceInNode(node)`：对文本节点执行转换并写回。
- `restoreInNode(node)` / `restoreAll()`：从 `WeakMap` 读取并恢复原文；禁用或切换模式时先恢复，避免二次转换。
- `hasTargetCharacterSet(text, mode)` / `scanForTargetChars(mode)`：智能检测页面是否包含目标字符集（简体/繁体），无目标字符时跳过转换以节省性能。
- `applyAll()`：按当前设置创建转换器并遍历整页替换。
- `MutationObserver` 回调：监听新增节点并增量替换。
- URL 变化与可见性：拦截 `history.pushState/replaceState` 并监听 `popstate/hashchange/pageshow/visibilitychange`，在 SPA/站内跳转时先 `restoreAll()` 再 `applyAll()`，避免二次转换并确保新页面内容被应用。

## 注意事项
- 为避免影响用户输入与代码示例，`shouldSkip` 会跳过敏感区域。
- UMD 版本通过 `window.OpenCC` 暴露 API，`manifest.json` 已保证注入次序。
- 若需要精确遵从 OpenCC 原生配置链（如 `s2t.json` 完整链路），可在后续迭代中按 `data/config` 解析并构建自定义 Trie；目前使用 `opencc-js` 预设以满足浏览器端性能与可用性。

## 变更同步
- 若调整了上述关键函数或模式映射，请同步更新本文件对应小节，保持与实现一致。
