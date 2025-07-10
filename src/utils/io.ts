import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright";
import https from "https";
import http from "http";
import { URL } from "url";

async function fetchWithRedirects(
  url: string,
  maxRedirects = 5,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
          if (maxRedirects === 0) {
            reject(new Error("Too many redirects"));
            return;
          }
          const location = res.headers.location;
          if (!location) {
            reject(new Error("Redirect with no location header"));
            return;
          }
          const nextUrl = new URL(location, url).toString();
          resolve(fetchWithRedirects(nextUrl, maxRedirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${res.statusCode}`));
          return;
        }
        const data: Buffer[] = [];
        res.on("data", (chunk) => data.push(chunk));
        res.on("end", () => resolve(Buffer.concat(data)));
      })
      .on("error", reject);
  });
}

export async function downloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("a.btn.btn-primary.download", { timeout: 20000 });
  const realDownloadUrl = await page.$eval(
    "a.btn.btn-primary.download",
    (el) => (el as HTMLAnchorElement).href,
  );

  await browser.close();

  // Download with redirect support
  const fileBuffer = await fetchWithRedirects(realDownloadUrl);
  await writeFile(destPath, fileBuffer);
}
