import { JSDOM } from "jsdom";
import { SELECTORS } from "../config/selectors.js";
import type { BookSearchResult, ChapterDownload } from "../types/domain.js";

function sanitizeFileName(name: string): string {
  // Remove illegal filename characters and trim
  return name
    .replace(/[^a-zA-Z0-9\-_. ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchResults(html: string): readonly BookSearchResult[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const results: BookSearchResult[] = [];
  const items = doc.querySelectorAll(SELECTORS.search.resultItem);
  items.forEach((item: Element) => {
    const titleEl = item.querySelector(SELECTORS.search.title);
    const urlEl = item.querySelector(SELECTORS.search.url);
    const coverEl = item.querySelector(SELECTORS.search.cover);
    if (titleEl && urlEl && coverEl) {
      results.push({
        title: titleEl.textContent?.trim() ?? "",
        url: (urlEl as HTMLAnchorElement).href,
        coverUrl: (coverEl as HTMLImageElement).src,
      });
    }
  });
  return results;
}

export function parseBookDownloadOptions(
  html: string,
): readonly ChapterDownload[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const downloads: ChapterDownload[] = [];
  const rows = doc.querySelectorAll(SELECTORS.book.chapterRow);
  rows.forEach((row: Element) => {
    // row is the <a> itself
    const titleEl = row.querySelector(SELECTORS.book.chapterTitle);
    const downloadEl = row; // <a> itself
    if (titleEl && downloadEl) {
      const href = (downloadEl as HTMLAnchorElement).href;
      let chapterTitle = titleEl.textContent?.trim() ?? "";
      let fileName = sanitizeFileName(chapterTitle);
      if (!fileName.toLowerCase().endsWith(".epub")) fileName += ".epub";
      downloads.push({
        chapterTitle,
        downloadUrl: href,
        fileName,
      });
    }
  });
  return downloads;
}
