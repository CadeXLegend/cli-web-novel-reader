import { PATHS } from "../config/paths.js";
import { basename, join } from "node:path";
import { listEpubFiles } from "./listEpubFiles.js";
import { selectEpubPrompt } from "./selectEpubPrompt.js";
import { readEpubTerminal } from "../workflow/reader.js";
import { readdir } from "node:fs/promises";

function formatFolderName(folder: string): string {
  return folder
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function readFlow(): Promise<void> {
  // List folders in downloads directory
  const downloadDirs = await readdir(PATHS.downloads, { withFileTypes: true });
  const folders = downloadDirs.filter((d) => d.isDirectory()).map((d) => d.name);
  if (folders.length === 0) {
    console.log("No downloaded books found.");
    return;
  }
  // Prompt user to select a folder/book
  const { folder } = await (await import("prompts")).default({
    type: "select",
    name: "folder",
    message: "Select a book to read:",
    choices: folders.map((f) => ({ title: formatFolderName(f), value: f })),
  });
  if (!folder) return;
  const bookDir = join(PATHS.downloads, folder);
  const epubFiles = await listEpubFiles(bookDir);
  if (epubFiles.length === 0) {
    console.log("No EPUB files found in this book.");
    return;
  }
  const selectChoices = epubFiles.map((f) => ({
    title: basename(f),
    value: f,
  }));
  const epubPath = await selectEpubPrompt(selectChoices);
  if (epubPath && epubPath !== "main-menu") {
    await readEpubTerminal(epubPath);
  }
} 