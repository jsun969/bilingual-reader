import type { Lang } from './types'

/** Interface copy, in the reader's language. One place, so it stays consistent. */
export const COPY = {
  appName: '双语阅读器',
  appSubtitle: 'Bilingual Reader',
  shelfTitle: '章节目录',
  shelfScanning: (assetDir: string) => `正在扫描 ${assetDir}/ …`,
  shelfCount: (assetDir: string, count: number) => `${count} 章 · 目录 ${assetDir}/`,
  langLabel: (lang: Lang) => LANG_LABEL[lang],
  langSwitchLabel: '本栏显示内容',
  missingSource: (lang: Lang) => MISSING_SOURCE[lang],
  missingSuggestion: (labels: string[]) =>
    labels.length ? `切到 ${labels.join(' / ')}。` : '这一章的目录里没有可用文件。',
  noChapterTitle: '还没有选择章节。',
  noChapterSub: '从左侧目录里选一章开始阅读。',
  loading: '载入中 …',
  loadFailedTitle: '这一章读不出来。',
  loadFailedSub: (path: string, detail: string) => `${path} → ${detail}`,
  outlineTitle: '大纲',
  outlineToggleTitle: '显示本栏的大纲',
  adhdTitle: 'ADHD',
  adhdToggleTitle: 'ADHD 速览：本章的压缩版',
  adhdMissing: '本章没有 ADHD 速览。',
  openPdf: '原件',
  openPdfTitle: '在新标签页打开原件',
  navToggle: '目录',
  splitRightTitle: '向右分栏',
  splitDownTitle: '向下分栏',
  closePaneTitle: '关闭这一栏',
  paneLimitTitle: (max: number) => `最多 ${max} 栏`,
  missingMark: (labels: string[]) => `缺${labels.join('·')}`,
  missingMarkTitle: (labels: string[]) => `本章目录里没有 ${labels.join('、')}`,
  minutes: (value: number) => `${value} min`,
  minutesTitle: (value: number) => `约 ${value} 分钟`,
  catalogFailedTitle: '读不到章节列表。',
  catalogFailedSub: (assetDir: string) =>
    `确认项目根目录下有 ${assetDir}/ 目录（每章一个子目录），并且从项目根目录启动 pnpm dev。`,
  catalogFailedDetail: (detail: string) => `GET /api/chapters.json → ${detail}`,
  catalogEmptyTitle: (assetDir: string) => `目录 ${assetDir}/ 里没有章节。`,
  catalogEmptySub: '每个章节是一个子目录，里面放 zh.md / en.md / 原件 PDF。',
  catalogEmptyDetail: (assetDir: string) => `扫描 ${assetDir}/ → 0 章`,
} as const

const LANG_LABEL: Record<Lang, string> = { zh: '中文', en: 'English', pdf: '原件' }

const MISSING_SOURCE: Record<Lang, string> = {
  zh: '本章还没有中文版。',
  en: 'This chapter has no English version.',
  pdf: '本章没有附原件 PDF。',
}
