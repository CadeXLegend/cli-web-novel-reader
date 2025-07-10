import { fetchHtml } from "../utils/fetch.js";
import { parseBookDownloadOptions } from "../utils/parse.js";
import { downloadFile } from "../utils/io.js";
import { PATHS } from "../config/paths.js";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import {
  getBookManifest,
  saveBookManifest,
  BookManifest,
} from "../utils/cache.js";
import type { BookSearchResult, ChapterDownload } from "../types/domain.js";

function slugify(title: string): string {
  return title.replace(/\W+/g, "-").toLowerCase();
}

export async function downloadChapters(
  book: BookSearchResult,
): Promise<readonly ChapterDownload[]> {
  // Assume the download page is book.url + '/download/'
  const downloadPageUrl = book.url.endsWith("/")
    ? `${book.url}download/`
    : `${book.url}/download/`;
  const html = await fetchHtml(downloadPageUrl);
  const downloads = parseBookDownloadOptions(html);
  return downloads;
}

export async function downloadMissingChapters(
  book: BookSearchResult,
  chapters: readonly ChapterDownload[],
  baseDir: string = PATHS.downloads,
): Promise<void> {
  const bookSlug = slugify(book.title);
  const bookDir = join(baseDir, bookSlug);
  let manifest: BookManifest = (await getBookManifest(bookSlug, baseDir)) ?? {
    downloaded: {},
  };
  let updated = false;
  // Find the next available number (max value + 1)
  let nextNumber = 1;
  const usedNumbers = Object.values(manifest.downloaded);
  if (usedNumbers.length > 0) {
    nextNumber = Math.max(...usedNumbers) + 1;
  }
  for (const chapter of chapters) {
    if (manifest.downloaded[chapter.fileName]) {
      console.log(`Already downloaded (manifest): ${chapter.chapterTitle}`);
      continue;
    }
    const filePath = join(bookDir, chapter.fileName);
    let exists = false;
    try {
      await stat(filePath);
      exists = true;
    } catch {}
    if (exists) {
      console.log(`Already downloaded (file): ${chapter.chapterTitle}`);
      // If not in manifest, add it with a number
      if (!manifest.downloaded[chapter.fileName]) {
        manifest.downloaded[chapter.fileName] = nextNumber++;
        updated = true;
      }
      continue;
    }
    console.log(`Downloading: ${chapter.chapterTitle} ...`);
    await downloadFile(chapter.downloadUrl, filePath);
    console.log(`Saved: ${filePath}`);
    manifest.downloaded[chapter.fileName] = nextNumber++;
    updated = true;
  }
  if (updated) {
    await saveBookManifest(bookSlug, baseDir, manifest);
  }
}
