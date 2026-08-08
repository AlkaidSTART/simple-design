<p align="center">
  <img src="./public/logo.png" alt="GlassStudio 产品 Logo" width="96" />
</p>

<h1 align="center">GlassStudio</h1>

<p align="center">设计即成品 · DESIGN TO DELIVER</p>

<p align="center">
  面向 Web 用户的轻量设计工作台，用模板和可编辑图层快速完成一张画布，并直接导出可交付文件。
</p>

## 产品定位

GlassStudio 是一个以「从想法到交付」为目标的 React 设计工作台 MVP。它适合需要快速制作落地页视觉稿、作品集封面、海报或简单界面原型的设计师、开发者和内容创作者。

当前版本聚焦桌面 Web 端的完整闭环：选择起点、编辑画布、自动保存本地草稿、导出成果。移动端提供适合轻量调整的响应式编辑界面。

## 当前功能

- **模板起步**：内置落地页、作品集和海报模板，可直接替换为当前画布内容。
- **图层编辑**：支持矩形、圆形、文本、按钮、图片和画笔图层。
- **画布操作**：选择、拖动、框选、多选、复制、粘贴、快速复制、删除和画布平移。
- **属性调整**：编辑图层的位置、尺寸、旋转、不透明度、填充色、圆角、文字内容、字号、字重和图片资源。
- **本地工作区**：支持项目与多张画布管理，项目、画布、图层、设置和剪贴板内容自动保存到浏览器 IndexedDB。
- **画布缩放**：画布右上角提供缩小、放大和适配画布；使用 `Ctrl/Cmd + 滚轮` 时只缩放画布内容，不改变 Web 页面缩放比例。
- **响应式界面**：桌面端使用侧边工具栏和右侧属性检查器，窄屏设备自动切换为底部悬浮工具栏。
- **导出提醒**：画布内提供无限循环滚动提示，提醒完成设计后及时导出。
- **客户端导出**：支持 2x PNG 图片、独立 HTML 页面和包含 HTML 与清单文件的 ZIP 资源包。

## 使用流程

1. 打开应用后，使用模板库选择一个设计起点，或在空画布中从工具栏添加图层。
2. 使用选择工具点击图层，在右侧属性检查器中编辑内容、尺寸和样式。
3. 拖动画布空白处可框选多个对象；使用平移工具或按住 `Space` 拖动画布。
4. 通过顶部的项目入口创建、切换或重命名项目和画布。
5. 完成设计后点击右上角「导出」，选择 PNG、HTML 或 ZIP 格式。

## 画布操作

| 操作 | 说明 |
| --- | --- |
| 点击图层 | 选择图层并打开属性检查器 |
| `Shift` + 点击 | 追加或切换多选图层 |
| 拖动图层 | 移动选中的图层 |
| 拖动空白处 | 框选多个图层 |
| 平移工具 / `Space` + 拖动 | 平移画布视图 |
| `Ctrl/Cmd` + 滚轮 | 以指针为中心缩放画布 |
| 普通滚轮 | 平移画布视图 |
| `V` | 切换选择工具 |
| `T` | 切换文本工具 |
| `Ctrl/Cmd + C` | 复制选中图层到本地剪贴板 |
| `Ctrl/Cmd + V` | 粘贴图层 |
| `Ctrl/Cmd + D` | 快速复制选中图层 |
| `Ctrl/Cmd + A` | 选择当前画布中的图层 |
| `Delete` / `Backspace` | 删除选中图层 |
| `Esc` | 取消选择并回到选择工具 |

## 导出格式

- **PNG 图片**：以 2x 像素比例导出当前画布，适合分享、交付视觉稿或继续进行图片处理。
- **HTML 页面**：生成可直接打开的独立 HTML 文件，画布中的图层样式会被序列化到页面中。
- **ZIP 资源包**：生成 `index.html` 和 `manifest.json`，方便归档或继续处理导出结果。图片图层在当前 MVP 中以 Data URL 形式写入 HTML。

导出由浏览器在本地完成，不需要上传设计文件到服务端。导出前建议确认画布名称，因为它会作为下载文件名使用。

## 数据与隐私

- 项目、画布、图层、画布视口、主题设置和本地剪贴板会保存到当前浏览器的 IndexedDB。
- 用户导入的图片会先读取为本地 Data URL，以便在刷新页面和导出 HTML 时保持可用。
- 清理浏览器站点数据会删除本设备上的本地工作区，请在重要工作完成后及时导出文件。
- 当前版本没有账号、云同步、多人协作或服务端项目存储能力。

## 技术栈

- React 19 + React DOM
- TypeScript
- Vite
- Zustand
- Lucide React
- `html-to-image`：PNG 导出
- JSZip：ZIP 资源包生成
- Vitest + jsdom：核心逻辑测试
- IndexedDB：本地工作区持久化

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本
- 支持现代 ES2022、IndexedDB 和 CSS `backdrop-filter` 的浏览器

### 安装与启动

```bash
git clone <your-repository-url>
cd simple-design
npm ci
npm run dev
```

启动后访问终端输出的本地地址，默认通常为：

```text
http://localhost:5173/
```

如需让局域网内其他设备访问，可使用：

```bash
npm run dev -- --host 0.0.0.0
```

## 常用命令

```bash
npm run dev       # 启动 Vite 开发服务器
npm run lint      # ESLint 检查
npm run typecheck # TypeScript 类型检查
npm test          # 运行 Vitest 单元测试
npm run build     # 构建生产版本
```

## 项目结构

```text
.
├── public/
│   └── logo.png                 # 产品 Logo，同时用于应用品牌区和 favicon
├── src/
│   ├── App.tsx                  # Web 编辑器页面、画布交互和导出入口
│   ├── styles.css               # 透明白色 UI、响应式布局和画布样式
│   ├── data/templates.ts        # 初始图层和内置模板
│   ├── lib/
│   │   ├── brush.ts             # 画笔路径与边界计算
│   │   ├── export.ts            # HTML / ZIP 导出与下载
│   │   ├── storage.ts           # IndexedDB 工作区读写
│   │   └── viewport.ts          # 画布平移、缩放和适配计算
│   ├── store/
│   │   └── useDesignStore.ts    # 项目、画布、图层和本地状态
│   └── types/design.ts          # 设计文档和图层类型定义
├── docs/                        # PRD、技术选型、UI 和整体架构文档
├── index.html                   # Vite 页面入口与 favicon 配置
└── package.json                 # 依赖和 npm scripts
```

## 文档索引

- [产品需求文档](./docs/01-PRD-产品需求文档.md)：产品定位、用户场景和 MVP 范围
- [技术栈选型文档](./docs/02-技术栈选型文档.md)：技术选型、导出策略和性能约束
- [UI 设计文档](./docs/03-UI设计文档.md)：布局、视觉语言和交互规范
- [整体架构文档](./docs/04-整体架构文档.md)：数据流、模块边界、测试与演进规划

## 浏览器兼容性

推荐使用最新版 Chrome、Edge、Safari 或 Firefox。应用的本地自动保存依赖 IndexedDB；PNG 导出和透明毛玻璃效果依赖现代浏览器能力，在较旧浏览器中可能降级或不可用。

## CI 与分支交付

`dev` 是工作集成分支。`.github/workflows/ci.yml` 会在提交到 `dev` 或向 `main` 提交 Pull Request 时执行质量门禁：

1. 使用 Node.js 22 和 `npm ci` 安装依赖。
2. 依次执行 lint、typecheck、单元测试和生产构建。
3. `dev` 分支通过质量门禁后，GitHub Actions 会创建或复用 `dev` 到 `main` 的 Pull Request，并自动 squash merge。

自动合并需要仓库在 GitHub Actions 设置中允许 `GITHUB_TOKEN` 写入内容和 Pull Request。

## 当前限制与后续规划

当前 MVP 有意保持为本地优先的单机 Web 工作台，以下能力尚未实现：

- 账号体系、云端保存和跨设备同步
- 多人实时协作与版本历史
- AI 生成可编辑设计系统
- 组件复用、团队资产库和模板市场
- 更完整的图片资源管理与更多导出格式

这些能力已在 `docs/` 的产品和架构文档中作为后续演进方向记录，README 的“当前功能”只对应现有代码。
