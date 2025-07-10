import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export type BookManifest = { downloaded: { [fileName: string]: number } };

export async function getBookManifest(
  bookSlug: string,
  baseDir: string,
): Promise<BookManifest | undefined> {
  const manifestPath = join(baseDir, bookSlug, "manifest.json");
  try {
    const data = await readFile(manifestPath, "utf8");
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export async function saveBookManifest(
  bookSlug: string,
  baseDir: string,
  manifest: BookManifest,
): Promise<void> {
  const dir = join(baseDir, bookSlug);
  await mkdir(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}
