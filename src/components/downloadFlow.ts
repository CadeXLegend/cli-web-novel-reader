import { searchAndSelectBook } from "../workflow/search.js";
import { downloadChapters, downloadMissingChapters } from "../workflow/download.js";
import { PATHS } from "../config/paths.js";
import prompts from "prompts";
import { join, basename } from "node:path";
import { getBookManifest } from "../utils/cache.js";
import { listEpubFiles } from "./listEpubFiles.ts";
import { selectEpubPrompt } from "./selectEpubPrompt.ts";
import { readEpubTerminal } from "../workflow/reader.js";
import type { ChapterDownload } from "../types/domain.js";

export type DownloadFlowResult = "main" | "search";

export async function downloadFlow(): Promise<DownloadFlowResult> {
  const book = await searchAndSelectBook();
  if (!book) {
    // User chose to return to main menu after no results
    return "main";
  }
  console.log(`Selected: ${book.title}`);
  const chapters = await downloadChapters(book);
  if (chapters.length === 0) {
    console.log("No chapters found to download.");
    return "main";
  }

  // Prompt user for download mode
  const { downloadMode } = await prompts({
    type: "select",
    name: "downloadMode",
    message: "How many chapters do you want to download?",
    choices: [
      { title: "All chapters", value: "all" },
      { title: "Select multiple chapters", value: "multiple" },
      { title: "Select one chapter", value: "one" },
    ],
  });

  let chaptersToDownload: ChapterDownload[] = chapters.slice();
  if (downloadMode === "one") {
    const { chapter } = await prompts({
      type: "select",
      name: "chapter",
      message: "Select a chapter to download:",
      choices: chapters.map((c, i) => ({ title: c.chapterTitle, value: i })),
    });
    if (typeof chapter === "number") {
      chaptersToDownload = [chapters[chapter]];
    } else {
      chaptersToDownload = [];
    }
  } else if (downloadMode === "multiple") {
    const { selected } = await prompts({
      type: "multiselect",
      name: "selected",
      message: "Select chapters to download:",
      choices: chapters.map((c, i) => ({ title: c.chapterTitle, value: i })),
      min: 1,
    });
    if (Array.isArray(selected)) {
      chaptersToDownload = selected.map((idx: number) => chapters[idx]);
    } else {
      chaptersToDownload = [];
    }
  }

  if (chaptersToDownload.length === 0) {
    console.log("No chapters selected for download.");
    return "main";
  }

  await downloadMissingChapters(book, chaptersToDownload, PATHS.downloads);
  console.log("Selected chapters are downloaded and cached.");
  // Prompt user for next action
  const { postDownload } = await prompts({
    type: "select",
    name: "postDownload",
    message: "What would you like to do next?",
    choices: [
      { title: "Search for another book", value: "search" },
      { title: "Read what you just downloaded", value: "read" },
      { title: "Return to main menu", value: "main" },
    ],
  });
  if (postDownload === "search") {
    return "search";
  } else if (postDownload === "read") {
    // List EPUBs in the just-downloaded book's directory, ordered by manifest index
    const bookDir = join(
      PATHS.downloads,
      book.title.replace(/\W+/g, "-").toLowerCase(),
    );
    const epubFiles = await listEpubFiles(bookDir);
    // Load manifest and sort files by index
    const manifest = await getBookManifest(
      book.title.replace(/\W+/g, "-").toLowerCase(),
      PATHS.downloads,
    );
    let sortedFiles = epubFiles;
    let selectChoices;
    if (manifest) {
      // Sort manifest keys by their value (index)
      const manifestKeys = Object.entries(manifest.downloaded);
      selectChoices = manifestKeys.map(([key]) => ({
        title: key,
        value: join(bookDir, key),
      }));
      sortedFiles = manifestKeys.map(([key]) => join(bookDir, key));
    } else {
      selectChoices = epubFiles.map((f) => ({
        title: basename(f),
        value: f,
      }));
    }
    if (sortedFiles.length === 0) {
      console.log("No EPUB files found in this book.");
      return "main";
    }
    const epubPath = await selectEpubPrompt(selectChoices);
    if (epubPath && epubPath !== "main-menu") {
      await readEpubTerminal(epubPath);
    }
    return "main";
  } else {
    return "main";
  }
} 