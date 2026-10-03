# OSTEP 阅读器

OSTEP（Operating Systems: Three Easy Pieces）的双语阅读器：左栏和右栏各自可以在
**中文 / English / 原件 PDF** 之间切换，左侧是章节目录。切到单栏时正文列会加宽并居中，
栏内可以再展开本章大纲；分屏时每栏更窄，不显示大纲入口。

## 运行

```bash
pnpm install
pnpm dev        # http://localhost:5273
```

其他命令：`pnpm build`（类型检查 + 打包到 `dist/`）、`pnpm preview`（预览打包结果）。

## 章节从哪来

目录结构就是唯一的事实来源，没有任何章节名写死在代码里：

```
asset/                          # 也可以是 assets/
  chapter08-Multi-level-Feedback/
    zh.md                       # 中文
    en.md                       # English
    origin.pdf                  # 原件
    images/fig-8-2.png          # 可选，markdown 里的相对路径
```

- 扫描 `asset/` 下的一级子目录；目录名 `chapterNN-Title-With-Dashes` 决定章节号、排序和标题。
- `zh.md` / `en.md` 分别对应「中文」「English」，任何 `*.pdf` 对应「原件」。缺少哪种语言，对应的按钮会禁用并说明原因。
- 新增一章或新增一段翻译：再运行 `pnpm dev` 即可，浏览章节列表会按章节号重新排序。

## 工作原理

- **服务器侧**（`plugin/asset-catalog.ts`）：一个 Vite 插件在每次请求时读取资产目录，提供
  `/api/chapters.json`（章节、阅读时长、文件路径）并直接以正确的 MIME 类型发送 `/asset/**`
  （PDF、图片、markdown）。`vite build` 会把资产复制进 `dist/` 并冻结一份 catalog。
- **渲染**（`src/lib/markdown.ts`）：marked + marked-footnote 解析 markdown，随后在 DOM 上做几件事：
  给每栏的 id 加前缀（`L-` / `R-`），这样两栏显示同一章时锚点、脚注、图号引用都不会串；
  把图片相对路径解析到 `/asset/...`；把 `#fig-4-1` 这类文内引用指向正确的元素。
- **代码高亮**（`src/lib/highlighter.ts`）：shiki，按需加载语法，主题用页面自己的油墨色
  （`src/lib/shikiTheme.ts`）。没有标注语言的代码块保持原样 —— 那些是书里的 ASCII 图。
- **分屏**：`react-resizable-panels` 负责拖拽、键盘和分隔条语义（横向 / 纵向随断点切换）。
- **版式**：`src/styles/`，按职责拆成 tokens / base / 各组件 / prose / responsive。

阅读位置、分栏比例、两栏语言都记在 `localStorage`（`ostep:viewer`）。
