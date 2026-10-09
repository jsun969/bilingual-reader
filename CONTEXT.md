# CONTEXT.md

这份文档写给 AI 和二次开发者。面向普通读者的展示页在 [README.md](./README.md)，协作与验证方式的约定在
[AGENTS.md](./AGENTS.md)。**改代码前先读这一份。**

---

## 1. 形态与技术栈

纯前端 SPA：**没有服务器、没有后端 API，也没有固定的素材目录**。章节素材由读者在浏览器里导入文件夹
后得到，走 File System Access API，**只有 Chromium 支持**。门禁只有 `pickerSupported()` 一处；
`lib.dom` 里没有声明的 `showDirectoryPicker`、`getAsFileSystemHandle` 和权限 API，由
`src/fs-types.d.ts` 补上。

Vite 8 · React 19 · TypeScript（`strict` + `noUnusedLocals`）· zustand 5 · react-resizable-panels 4 ·
marked 18（+ marked-footnote）· shiki 4 · react-icons/lu。

```
src/
  components/   界面：栏、窗口树、目录、大纲、ADHD、导入弹窗
  hooks/        读文档（useChapterDocument）、滚动监听（useScrollSpy）
  lib/          数据与算法：fs / idb / library / docs / markdown / layout / store / config / naming
  styles/       tokens → base → 组件 → prose → motion → responsive（index.css 里的顺序不能乱）
```

## 2. 素材契约（导入格式）

**一个文件夹 = 一章**。文件名固定，代码里不写死任何章节名：

```
chapter08-Multi-level-Feedback/     # 名字随便，章节号/名由读者填
  zh.md                             # 中文（可选）
  en.md                             # English（可选）
  adhd.md                           # 可选，英文压缩速览（自己跑 i-have-adhd 生成），不算一种语言
  origin.pdf                        # 可选，任意 *.pdf；多个时取文件名字典序第一个
  images/fig-8-2.png                # 可选，markdown 里的相对路径
```

- 识别逻辑全在 `src/lib/fs.ts` 的 `scanChapter()`：只扫描**当前层**的普通文件，跳过点文件；`.md` 按
  stem（转小写）识别 `zh` / `en` / `adhd`，其余 `.md` 一律忽略；`.pdf` 取文件名字典序的第一个，并记录
  字节数。
- `zh.md` / `en.md` / `*.pdf` **至少要有一个**，一个都没有就抛 `ImportError`，弹窗报错并且不导入。
  **只有 `adhd.md` 不算可用**（沿用旧版服务端的行为）。缺哪种文件，对应栏的按钮就禁用，并说明原因。
- `adhd.md` 要**读者自己**用 [i-have-adhd](https://github.com/ayghri/i-have-adhd) 生成后放进章节文件夹：
  阅读器只负责显示，从不生成它（链接常量 `ADHD_SKILL_URL` 在 `src/copy.ts`，面板抬头那个链接和禁用按钮
  的提示都指向它）。
- 想加第三种语言，要动三处：`src/lib/fs.ts` 的文件名识别、`src/types.ts` 的 `Lang`、`src/copy.ts` 的标签。
- 阅读时长由 `readingMinutes()`（`src/lib/reading.ts`）估算：先剔除代码块和标签，再按约 420 汉字/分钟
  加约 230 拉丁词/分钟折算，结果最小为 1。

## 3. 章节号与章节名

- 导入时由**读者手填**；选定文件夹后，用 `parseFolderName()`（`src/lib/naming.ts`）给出预填值：
  - `num` = 名字里**第一个**数字串，原样保留（`23-xxx`、`23-18-alkdjf29` → `23`）。
  - `title` = 去掉**所有**数字，把 `-`、`_` 和空白折成空格，再**只**把每个单词的首字母大写（`VM`、`TLS`
    保持原样）。
  - 只覆盖**没被读者改过**的字段（靠 `touched` ref 判断）；**只在导入模式**下预填，重命名和重新选择
    文件夹都不会动这两个值。
- `orderOf()`（`src/lib/library.ts`）：`parseInt` 成功就用这个数字，否则用 `MAX_SAFE_INTEGER`（没有章节
  号的排到最后）。排序键依次是 `order → title.localeCompare → id`。
- 章节的**身份是 `crypto.randomUUID()`**，不再依赖目录名。旧 `localStorage` 里的 slug 认不出来，会自动
  落到第一个可读章节；残留的滚动位置键会随 200 条的上限自然淘汰。

## 4. 数据模型（`src/types.ts`）

| 类型 | 说明 |
| --- | --- |
| `ChapterFiles` | 扫描结果：`sources{zh?,en?,pdf?}` + 可选 `adhd` |
| `ChapterMeta` | **持久化**的章节：`id / num / title / order` + `ChapterFiles` |
| `Chapter` | 运行时 = `ChapterMeta` + `status` + `handle?`（句柄不进 `localStorage`，见下） |
| `ChapterStatus` | `loading`（启动核对中，首屏同步渲染出来的就是它）· `ready` · `needs-permission` · `missing` |
| `LayoutNode` | 窗口树：叶子 `PaneLeaf{id,lang}`，分支 `SplitNode{id,dir,ratio,first,second}` |
| `ChapterDoc` | 单栏文档状态 `idle/loading/ready/missing/error` + `html` + `outline` |

## 5. 持久化（三处存储，各管一段）

| 位置 | 内容 | 实现 |
| --- | --- | --- |
| `localStorage` `bilingual-reader:viewer` | 当前章节 id、窗口树、每栏滚动位置 | zustand `persist`，`src/lib/store.ts` |
| `localStorage` `bilingual-reader:library` | 章节清单（id / num / title / order / 文件名 / 时长） | `src/lib/idb.ts` 的 `readMetas` / `writeMetas` |
| IndexedDB `bilingual-reader` → `handles` | 每章的 `FileSystemDirectoryHandle`，key = 章节 id | `src/lib/idb.ts`（句柄不能 JSON 化，只能放这里） |

- 章节清单是**同步**读出来的，所以书库 store 的初值里就有列表（`booted`），首屏不会闪一下「0 章」；
  句柄核对走 `restore()`，用模块级的 `started` 保证只跑一次，React StrictMode 下双跑也没问题。
- 查看状态：`scroll` 键由 `paneId/章节 id/语言` 拼成，最多 200 条（`SCROLL_LIMIT`）；布局树深度上限 8、
  栏数上限 4（`MAX_DEPTH` / `MAX_PANES`，`src/lib/config.ts`）；旧版的 `left/right/ratio/split` 由
  `layoutFromLegacy()` 迁移成窗口树。写盘做了 250ms 节流，并在 `pagehide` 时补写；写不进去就退回纯内存。
- **纯内存、刷新即重来**：渲染后的 HTML（`docCache`）、PDF 的 blob URL（`pdfUrls`）、配图 blob URL
  （`assetUrls`）、目录和大纲浮层的开合状态。
- `IndexedDB` 不可用时（隐私模式、被用户禁用）全部降级：`putHandle` 失败只是下次要重新选文件夹，
  `getHandle` 失败则该章标为 `missing`。

## 6. 启动与异常流（`src/lib/library.ts`）

```
restore()
  └ 每个 meta：getHandle(id)
      ├ 拿不到句柄 / IndexedDB 挂了      → missing          （行内可「重新选择文件夹」或「移除」）
      ├ queryPermission ≠ granted        → needs-permission （点一次行 → requestPermission，用户手势）
      └ 已授权 → scanChapter(handle)
                  ├ 成功                 → ready（顺便刷新文件名与时长并写回）
                  ├ ImportError / NotFoundError / TypeMismatchError → missing
                  └ 其它（如权限中途失效）→ needs-permission
```

- `makeReady(id)` 是书架点击的唯一入口，返回 `ready | relink | denied`：`relink` 让 App 打开重新选择
  文件夹的弹窗，`denied` 就维持原状（行上写着「需要授权」）。
- `relinkChapter()` 保留 id（滚动位置、当前章节都不丢），只换句柄并重新扫描；`removeChapter()` 会
  `deleteHandle` + `releaseChapterUrls()` + `dropChapterDocs()`，用来撤销配图和 PDF 的 blob URL。
- `restore()` 期间导入或删除的章节不会被启动列表覆盖（结尾按当前 id 集合合并）。
- 其余异常都已在 UI 里兜住：非 Chromium（按钮禁用并弹窗说明）、拖拽拿不到句柄、`getFile()` 读失败
  （该文件视为不存在）、没有 IndexedDB、`localStorage` 配额不足或隐私模式。

## 7. 渲染管线

- `src/lib/markdown.ts` 的 `renderDoc(source, { idPrefix, resolveAsset })` 按顺序做这几件事：先用 marked
  解析，然后给文档里**所有** `id` 加上栏前缀（`p1-`）并重写 `a[href^="#"]`，这样多栏显示同一章时，锚点、
  脚注和 `#fig-4-1` 这类引用都不会串到一起；接着按 `h1`–`h4` 生成 outline；图片交给 `resolveAsset` 回调
  处理；链接加上 `target=_blank`；最后把 `pre > code` 交给 shiki（没标语言的代码块是书里的 ASCII 图，
  原样保留）。
- `src/lib/highlighter.ts` 用 `createHighlighter({ themes: [INK_THEME], langs: [] })` 初始化，语法 grammar
  在第一次遇到该语言时才通过 `loadLanguage()` 加载。因此构建产物里每种语言和主题各是一个懒加载 chunk，
  首屏只加载用到的那几个。
- `src/hooks/useChapterDocument.ts` 导出三个 hook：`useChapterDocument` 读本栏语言，`useAdhdDocument`
  按章读 ADHD 速览，`usePdfDocument` 按章读 PDF（**每章只把 PDF 转一次** blob URL）。渲染结果按
  `viewKey` 存进 `docCache`，所以切换语言或重开 ADHD 面板都不重读文件；句柄或文件名变了才会重新读。
- 配图的相对路径由 `src/lib/fs.ts` 的 `assetUrl()` 解析：拒绝绝对路径和带协议的写法，处理 `./` 和 `../`，
  解码 `%XX`，丢掉 `?` 和 `#`，再按 `章节 id \u0000 相对路径` 缓存 blob URL。
- `PdfFrame` 接收的是 blob URL（`src={url}#view=FitH`），栏头「原件」链接就是用同一个 URL 在新标签页
  打开。

## 8. 交互与版式

- **窗口树**：`src/lib/layout.ts` 提供纯函数（`splitPane` / `closePane` / `setPaneLang` /
  `setSplitRatio`），`LayoutView.tsx` 把它们递归渲染成嵌套的 `Group`/`Panel`，拖拽和键盘操作交给
  react-resizable-panels 处理。每个动作都直接调 store（`openChapter` / `addPane` / `removePane` /
  `changeLang` / `resizeSplit` / `rememberScroll`），组件之间不传状态回调。滚动位置用**命令式**读写
  （直接读 `element.scrollTop`），滚动不会触发 re-render。
- **目录 `.shelf`**：`.workspace` 里的绝对定位浮层，毛玻璃效果来自 `--glass-opacity`（默认 65%）加
  `blur(12px)`；`data-nav` 切换 `transform`，关闭时设 `visibility: hidden`，让动画能走完又不把浮层留在
  tab 顺序里。书架为空时**强制打开**（导入按钮就在底部的 `.shelf-foot`）。关闭方式有三种：顶栏「目录」、
  选中某个章节、点浮层以外的地方；浮层以外的判断靠 `.workspace` 上的 `pointerdown` 加 ref，所以顶栏
  那个按钮自己的 toggle 不受影响。每一行是 `<div class="chapter">`（不是 button），主体 `.chapter-main`
  才是按钮，行尾的 `.chapter-acts` 放重命名和移除两个按钮（hover 或 focus-within 时才显形，
  `@media (hover: none)` 下常显）。
- **大纲 `.outline`**：绝对定位在 `.pane-main` 右缘（`width: min(226px, 75%)`），由 `useScrollSpy` 高亮
  当前标题。点正文会关闭（监听 `.pane-main` 的 `pointerdown`），点条目连续跳转则不会关；开合状态每栏
  各存一份。
- **ADHD `.adhd`**：绝对定位在 `.pane-main` 底缘，高 55%，自带滚动条；为了滑动动画而常驻挂载，内容按
  `paneId/adhd` 缓存，标题 id 前缀是 `<paneId>-adhd-`。**只有栏头按钮能关它**（它开着的时候仍然可以
  点正文）。
- **正文列宽**：单栏时中文 75% / 英文 70% 居中，多栏或 ≤900px 铺满（`tokens.css` 的 `--measure*`）。
- **导入弹窗**：用原生 `<dialog>` 加 `showModal()`，焦点陷阱和 Esc 关闭都是白送的。同一个组件有三种
  用法：导入、重命名、重新选择文件夹。拖拽和「选择文件夹」共用 `acceptFolder()`；扫描失败时不动已填的
  字段。
- **图标**：一律 `react-icons/lu`，按钮共用 `.tool-btn`（26px 高）加纯图标 `.icon-btn`，尺寸在 CSS 里
  统一给。

## 9. 部署（Cloudflare Workers 静态资源）

- 形态：**只有 `assets` 的 Worker**，没有 `main`，也没有任何绑定。配置全在 `wrangler.jsonc`：`name`、
  `assets.directory = ./dist`、`not_found_handling = single-page-application`、`workers_dev`、
  `preview_urls`。仓库里没有这个文件时，CI 里的 `wrangler deploy` 每次都会自己跑一遍自动配置
  （改 `vite.config.ts`、临时安装 `@cloudflare/vite-plugin`、再构建一次），所以把它提交进来。
- CI（Workers Builds）：构建命令 `pnpm run build`，部署命令 `npx wrangler deploy`；wrangler 固定在
  devDependencies（`npx` 优先用仓库里这份），`pnpm install --frozen-lockfile` 走 `pnpm-lock.yaml`。
- 手动部署：`pnpm build && pnpm exec wrangler deploy`（首次要 `wrangler login`）。**不要**把它写成
  `deploy` 脚本：`pnpm deploy` 是 pnpm 内置命令（workspace 部署），会撞名。
- `dist/assets` 里那 300 多个 js 是 shiki 按需拆出的语言和主题 chunk（见 §7），不是打包出了问题：
  Worker 单个版本上限是 2 万个文件、单文件 25 MiB，这个量级完全放得下。

## 10. 约定

- **目录结构和文件名是唯一事实来源**，代码里不写死任何章节名或素材名。素材目录 `asset/`、`assets/`
  不入库（见 `.gitignore`），现在只是本地待导入的素材。
- 改一点 commit 一点、不 push，验证方式（只跑 `pnpm build`，不启动 dev、不开浏览器）见
  [AGENTS.md](./AGENTS.md)。
