import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

export async function listEpubFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (extname(entry.name).toLowerCase() === ".epub") {
        files.push(fullPath);
      }
    }
  }
  await walk(dir);
  return files;
} 