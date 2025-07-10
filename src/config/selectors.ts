export const SELECTORS = {
  search: {
    resultItem: "div.card-item",
    title: "h3.novel-title",
    url: "a.text-body",
    cover: ".novel-thumbnail img",
  },
  book: {
    // Each chapter download is an <a> with class 'download-line s-blue' inside '.download-links'
    chapterRow: ".download-links a.download-line.s-blue",
    chapterTitle: ".download-line-title",
    chapterDownload: "self", // special: use the <a> itself for href
  },
} as const;
