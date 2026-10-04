# bilingual-reader

多窗格双语文档阅读器：每一栏都可以单独在 **中文 / 原文 Markdown / 原件 PDF** 之间切换，
左侧是章节目录。栏头上有三个窗口按钮：**◫ 向右分栏**、**▤ 向下分栏**、**✕ 关闭这一栏**，
所以可以平铺成左右 / 上下任意组合，最多 4 栏。只剩一栏时正文列加宽并居中，栏内可以再展开
本章大纲；多栏时每栏更窄，不显示大纲入口。

素材按「一章一个目录」组织即可，放哪套文档都行（比如 OSTEP 各章）。

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:5273
```

其他命令：`pnpm build`（类型检查 + 打包到 `dist/`）、`pnpm preview`（预览打包结果）。

## 素材从哪来

目录结构就是唯一的事实来源，没有任何章节名写死在代码里：

```
asset/                          # 也可以是 assets/，不入库（见 .gitignore）
  chapter08-Multi-level-Feedback/
    zh.md                       # 中文
    en.md                       # English
    origin.pdf                  # 原件
    images/fig-8-2.png          # 可选，markdown 里的相对路径
```

- 扫描 `asset/` 下的一级子目录；目录名 `chapterNN-Title-With-Dashes` 决定章节号、排序和标题
  （小写段视为连字符复合词：`Multi-level-Feedback` → “Multi-level Feedback”）。
- `zh.md` / `en.md` 分别对应「中文」「English」，任何 `*.pdf` 对应「原件」。
  缺少哪种语言，对应的按钮会禁用并说明原因。要加第三种语言，需要动三处：
  `plugin/asset-catalog.ts` 的文件名识别、`src/types.ts` 的 `Lang`、`src/copy.ts` 的标签。
- 新增一章或新增一段翻译：再运行 `pnpm dev` 即可，章节列表会按章节号重新排序。

素材目录被 `.gitignore` 排除，只留在本地。

## 工作原理

- **服务器侧**（`plugin/asset-catalog.ts`）：一个 Vite 插件在每次请求时读取素材目录，提供
  `/api/chapters.json`（章节、阅读时长、文件路径）并直接以正确的 MIME 类型发送 `/asset/**`
  （PDF、图片、markdown）。`vite build` 会把素材复制进 `dist/` 并冻结一份 catalog。
- **渲染**（`src/lib/markdown.ts`）：marked + marked-footnote 解析 markdown，随后在 DOM 上做几件事：
  给每栏的 id 加前缀（栏的 id，如 `p1-`），这样多栏显示同一章时锚点、脚注、图号引用都不会串；
  把图片相对路径解析到 `/asset/...`；把 `#fig-4-1` 这类文内引用指向正确的元素。
- **代码高亮**（`src/lib/highlighter.ts`）：shiki，按需加载语法，主题用页面自己的油墨色
  （`src/lib/shikiTheme.ts`）。没有标注语言的代码块保持原样 —— 那些是书里的 ASCII 图。
- **窗口**：窗口树（`src/types.ts` 的 `LayoutNode`，每个叶子是一栏、每个分支是一根可拖拽的分隔条）
  由 `src/lib/layout.ts` 增删改，`src/components/LayoutView.tsx` 递归渲染成嵌套的
  `react-resizable-panels` 组，拖拽、键盘和分隔条语义都由它负责。
- **版式**：`src/styles/`，按职责拆成 tokens / base / 各组件 / prose / responsive。
  单栏的中文正文列宽占栏宽 75%、英文 70% 并居中（≤900px 的手机上铺满整栏）；多栏时正文铺满栏宽。

阅读位置、窗口树（每栏语言 + 每根分隔条的比例）都记在 `localStorage`（`bilingual-reader:viewer`）。
