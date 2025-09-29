# T2S-Chrome

基于 OpenCC 的 Chrome MV3 扩展：在网页上进行简繁体与地区用词转换（含短语，最长匹配）。无需安装 Node.js，直接加载已解压扩展即可使用。

## 功能
- 简 ↔ 繁转换：含台湾正体、香港繁体等
- 词句本地化：如“简 → 台湾常用词”“繁 → 简（大陆常用词）”
- 实时转换：监听 DOM 变化与站内路由（SPA）
- 一键启用/禁用，切换模式即时生效且可恢复原文

## 安装（本地调试）
1. Chrome 打开：扩展程序 → 开发者模式
2. 选择“加载已解压”，指向项目根目录
3. 点击工具栏图标打开设置：
   - 勾选“启用转换”
   - 选择“转换模式”

> 不需要 Node.js 或打包流程，`extension/vendor/opencc.full.umd.js` 已内置。

## 目录
- `extension/`：MV3 源码（`manifest.json`、`content.js`、`popup.*`、`background.js`）
- `extension/vendor/opencc.full.umd.js`：`opencc-js` 的 UMD 构建
- `data/config` 与 `data/dictionary`：OpenCC 配置与词典（来自上游）
- `docs/DEV.md`：关键函数与实现说明

## 使用说明
- 启用后，页面文本会自动按所选模式转换；新增内容会监听并转换。
- 取消启用或切换模式时，会先恢复原文再按新模式应用，避免二次转换。
- 目前设置为全局生效；如需站点级设置可提 Issue。

## 致谢
- OpenCC 项目与词典数据：[BYVoid/OpenCC](https://github.com/BYVoid/OpenCC)
- 浏览器端实现基于 `opencc-js` UMD 版本

## 许可证
- 参考上游 OpenCC 许可证（Apache-2.0）。本项目仅作集成与演示用途。
