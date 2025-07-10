import { chromium } from "playwright";

export async function fetchHtml(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  await browser.close();
  return html;
}
