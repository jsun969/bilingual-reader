# CONTEXT.md

给 AI / 二次开发者的技术说明。给人看的展示页在 [README.md](./README.md)，工作方式约束在
[AGENTS.md](./AGENTS.md)。**改代码前先读这一份。**

---

## 1. 形态与技术栈

纯前端 SPA：**没有服务器、没有后端 API、没有固定素材目录**。章节素材由读者在浏览器里导入文件夹得到
（File System Access API，**只有 Chromium** 能用；`pickerSupported()` 是唯一的门禁，
`src/fs-types.d.ts` 补了 `lib.dom` 没声明的 `showDirectoryPicker` / `getAsFileSystemHandle` / 权限 API）。

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

- 识别逻辑全在 `src/lib/fs.ts` 的 `scanChapter()`：只看**当前层**的普通文件、跳过点文件；
  `.md` 取 stem（小写）`zh` / `en` / `adhd`，其它 `.md` 忽略；`.pdf` 取文件名字典序第一个并记录字节数。
- `zh.md` / `en.md` / `*.pdf` **至少有一个**，一个都没有就抛 `ImportError`，弹窗报错、不导入。
  **只有 `adhd.md` 不算可用**（沿用旧版服务端行为）。缺哪个，对应栏的按钮就禁用并说明原因。
- `adhd.md` 由**读者自己**用 [i-have-adhd](https://github.com/ayghri/i-have-adhd) 生成后放进章节文件夹：
  阅读器只显示、从不生成它（`ADHD_SKILL_URL`，`src/copy.ts`；面板抬头那个链接和禁用按钮的提示都指向它）。
- 要加第三种语言要动三处：`src/lib/fs.ts` 的文件名识别、`src/types.ts` 的 `Lang`、`src/copy.ts` 的标签。
- 阅读时长 `readingMinutes()`（`src/lib/reading.ts`）：~420 汉字/分钟 + ~230 拉丁词/分钟，先剔除代码块和标签，最小 1。

## 3. 章节号与章节名

- 导入时**读者手填**；选定文件夹后用 `parseFolderName()`（`src/lib/naming.ts`）预填：
  - `num` = 名字里**第一个**数字串原样（`23-xxx`、`23-18-alkdjf29` → `23`）。
  - `title` = 去掉**所有**数字 → `-` `_` 空白 折成空格 → 每个单词**只**把首字母大写（`VM`、`TLS` 不会被改写）。
  - 只覆盖**没被改过**的字段（`touched` ref）；**只在导入模式**预填，重命名 / 重新选择文件夹不动这两个值。
- `orderOf()`（`src/lib/library.ts`）：`parseInt` 成功用数字，否则 `MAX_SAFE_INTEGER`（无号排最后）。
  排序键 `order → title.localeCompare → id`。
- 章节**身份是 `crypto.randomUUID()`**，不再依赖目录名。旧 `localStorage` 里的 slug 认不出来，
  会自动落到第一个可读章节；残留的滚动位置键随 200 条上限自然淘汰。

## 4. 数据模型（`src/types.ts`）

| 类型 | 说明 |
| --- | --- |
| `ChapterFiles` | 扫描结果：`sources{zh?,en?,pdf?}` + 可选 `adhd` |
| `ChapterMeta` | **持久化**的章节：`id / num / title / order` + `ChapterFiles` |
| `Chapter` | 运行时 = `ChapterMeta` + `status` + `handle?`（句柄不进 `localStorage`，见下） |
| `ChapterStatus` | `loading`（启动核对中，首屏同步渲染的就是它）· `ready` · `needs-permission` · `missing` |
| `LayoutNode` | 窗口树：叶子 `PaneLeaf{id,lang}`，分支 `SplitNode{id,dir,ratio,first,second}` |
| `ChapterDoc` | 单栏文档状态 `idle/loading/ready/missing/error` + `html` + `outline` |

## 5. 持久化（三处存储，各管一段）

| 位置 | 内容 | 实现 |
| --- | --- | --- |
| `localStorage` `bilingual-reader:viewer` | 当前章节 id、窗口树、每栏滚动位置 | zustand `persist`，`src/lib/store.ts` |
| `localStorage` `bilingual-reader:library` | 章节清单（id / num / title / order / 文件名 / 时长） | `src/lib/idb.ts` 的 `readMetas` / `writeMetas` |
| IndexedDB `bilingual-reader` → `folders` | 每章的 `FileSystemDirectoryHandle`，key = 章节 id | `src/lib/idb.ts`（句柄不能 JSON 化，只能放这里） |

- 章节清单是**同步**读出来的，所以书库 store 的初值就有列表（`booted`），首屏不给「0 章」闪一下；
  句柄核对走 `restore()`，用模块级 `started` 保证只跑一次（React StrictMode 双跑也安全）。
- 查看状态：`scroll` 键 = `paneId/章节 id/语言`，最多 200 条（`SCROLL_LIMIT`）；布局树深度上限 8、
  栏数上限 4（`MAX_DEPTH` / `MAX_PANES`，`src/lib/config.ts`）；旧版 `left/right/ratio/split` 会在
  `layoutFromLegacy()` 里迁移成窗口树。写盘 250ms 节流 + `pagehide` 补写，写不进去就退回纯内存。
- **纯内存、刷新即重来**：渲染后的 HTML（`docCache`）、PDF 的 blob URL（`pdfUrls`）、
  配图 blob URL（`assetUrls`）、目录 / 大纲的浮层开合状态。
- `IndexedDB` 不可用（隐私模式、被禁）时全部降级：`putHandle` 失败只是下次要重新选文件夹，
  `getHandle` 失败该章标 `missing`。

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

- `makeReady(id)` 是书架点击的唯一入口，返回 `ready | relink | denied`：`relink` 让 App 打开
  重新选择文件夹的弹窗，`denied` 就维持原状（行上写着「需要授权」）。
- `relinkChapter()` 保留 id（滚动位置、当前章节都不丢），只换句柄 + 重扫；`removeChapter()` 会
  `deleteHandle` + `releaseChapterUrls()` + `dropChapterDocs()`（撤销配图 / PDF 的 blob URL）。
- `restore()` 期间导入或删除的章节不会被启动列表覆盖（结尾按当前 id 集合合并）。
- 其它已在 UI 里兜住的异常：非 Chromium（按钮禁用 + 弹窗说明）、拖拽拿不到句柄、
  `getFile()` 读失败（该文件当没有）、无 IndexedDB、`localStorage` 配额 / 隐私模式。

## 7. 渲染管线

- `src/lib/markdown.ts` 的 `renderDoc(source, { idPrefix, resolveAsset })`：marked 解析 → 给文档里**所有**
  `id` 加栏前缀（`p1-`）并重写 `a[href^="#"]`，所以多栏显示同一章时锚点 / 脚注 / `#fig-4-1` 引用互不串 →
  标题生成 outline（`h1`–`h4`）→ 图片交给 `resolveAsset` 回调 → 链接加 `target=_blank` →
  `pre > code` 交给 shiki（没标语言的代码块是书里的 ASCII 图，原样保留）。
- `src/hooks/useChapterDocument.ts`：`useChapterDocument`（本栏语言）/ `useAdhdDocument`（按章）/
  `usePdfDocument`（**按章一次**把 PDF 变成 blob URL）。渲染结果按 `viewKey` 进 `docCache`，
  切语言 / 重开 ADHD 面板不重读文件；句柄或文件名变了会重新读。
- 配图相对路径由 `src/lib/fs.ts` 的 `assetUrl()` 解析：拒绝绝对路径与协议、解析 `./` `../`、解码
  `%XX`、丢掉 `?` `#`，按 `章节 id \u0000 相对路径` 缓存 blob URL。
- `PdfFrame` 收的是 blob URL（`src={url}#view=FitH`），栏头「原件」链接就是同一个 URL 开新标签页。

## 8. 交互与版式

- **窗口树**：`src/lib/layout.ts` 是纯函数（`splitPane` / `closePane` / `setPaneLang` / `setSplitRatio`），
  `LayoutView.tsx` 递归渲染成嵌套的 `Group`/`Panel`，拖拽与键盘语义交给 react-resizable-panels；
  每个动作直接调 store（`openChapter` / `addPane` / `removePane` / `changeLang` / `resizeSplit` / `rememberScroll`），
  组件之间不传状态回调。滚动位置是**命令式**读写的（`element.scrollTop`），滚动不触发 re-render。
- **目录 `.shelf`**：`.workspace` 里的绝对定位浮层，玻璃 = `--glass-opacity`（默认 65%）+ `blur(12px)`；
  `data-nav` 切 `transform`，关闭时 `visibility: hidden` 让动画走完又不留在 tab 顺序里。
  书架为空时**强制开着**（导入按钮在底部 `.shelf-foot`）。关闭方式：顶栏「目录」、选章节、点浮层以外——
  `.workspace` 上的 `pointerdown` 用 ref 判断，所以顶栏按钮自己的 toggle 不受影响。
  行是 `<div class="chapter">`（不是 button），主体 `.chapter-main` 是按钮，行尾 `.chapter-acts`
  两个按钮做重命名 / 移除（hover / focus-within 才显形，`@media (hover: none)` 常显）。
- **大纲 `.outline`**：绝对定位在 `.pane-main` 右缘（`width: min(226px, 75%)`），
  `useScrollSpy` 高亮当前标题；点正文关（监听 `.pane-main` 的 `pointerdown`），点条目连跳不关；每栏各存一份开合。
- **ADHD `.adhd`**：绝对定位在 `.pane-main` 底缘、高 55%、自带滚动条，常驻挂载只为滑动动画，
  内容按 `paneId/adhd` 缓存，标题 id 前缀 `<paneId>-adhd-`；**只有栏头按钮能关**（可以在它开着时继续点正文）。
- **正文列宽**：单栏时中文 75% / 英文 70% 居中，多栏或 ≤900px 铺满（`tokens.css` 的 `--measure*`）。
- **导入弹窗**：原生 `<dialog>`（`showModal()`，焦点陷阱与 Esc 关闭白送），一个组件三种用法
  （导入 / 重命名 / 重新选择文件夹）；拖拽与「选择文件夹」共用 `acceptFolder()`，扫描失败就不改字段。
- **图标**：一律 `react-icons/lu`，按钮共用 `.tool-btn`（26px 高）+ 纯图标 `.icon-btn`，尺寸在 CSS 里统一给。

## 9. 约定

- **目录结构 / 文件名是唯一事实来源**，代码里不写死任何章节名或素材名；素材目录 `asset/`、`assets/`
  不入库（见 `.gitignore`），现在只作为本地待导入的素材。
- 改一点 commit 一点、不 push、验证方式（只跑 `pnpm build`，不启动 dev / 不开浏览器）见 [AGENTS.md](./AGENTS.md)。
