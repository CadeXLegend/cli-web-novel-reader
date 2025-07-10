import { chromium } from "playwright";
import {
  LightNovelSearchResult,
  LightNovelChapter,
  LightNovelChapterContent,
  AbsoluteHttpUrl,
  DataOrHttpUrl,
} from "../types/lightnovel.js";

function toAbsoluteHttpUrl(url: string, base: string): AbsoluteHttpUrl {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url as AbsoluteHttpUrl;
  }
  // Prepend base if relative
  return (base + url.replace(/^\//, "")) as AbsoluteHttpUrl;
}

function toDataOrHttpUrl(url: string | undefined, base: string): DataOrHttpUrl | undefined {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url as DataOrHttpUrl;
  }
  // Prepend base if relative
  return (base + url.replace(/^\//, "")) as DataOrHttpUrl;
}

/**
 * Searches for light novels on Novelight and returns all results for the given term.
 * @param searchTerm The search query string.
 * @returns Promise<LightNovelSearchResult[]>
 */
export const searchLightNovels = async (
  searchTerm: string,
): Promise<LightNovelSearchResult[]> => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const url = `https://9kafe.com/?s=${encodeURIComponent(searchTerm)}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait for results to load
  await page.waitForSelector("div.card-item");

  // Extract results
  const results = await page.$$eval("div.card-item", (cards) =>
    cards.map((card) => {
      const linkEl = card.querySelector("a.text-body");
      const link = linkEl?.getAttribute("href") || "";
      const title =
        card.querySelector("h3.novel-title")?.textContent?.trim() || "";
      const img = card.querySelector(".novel-thumbnail img");
      const imageUrl = img?.getAttribute("src") || undefined;
      const imageAlt = img?.getAttribute("alt") || undefined;

      // Author and chapters
      let author: string | undefined = undefined;
      let chapters: string | undefined = undefined;
      card.querySelectorAll(".small.text-muted span").forEach((span) => {
        if (span.innerHTML.includes("i-profile")) {
          author = span.textContent?.replace(/^by\s*/i, "").trim();
        }
        if (span.innerHTML.includes("i-document")) {
          chapters = span.textContent?.trim();
        }
      });

      return {
        title,
        link,
        imageUrl,
        imageAlt,
        author,
        chapters,
      };
    }),
  );

  // Fix links and imageUrls to be absolute
  const fixedResults: LightNovelSearchResult[] = results
    .map((r) => {
      // 9kafe.com always returns relative links, prepend domain if needed
      const base = "https://9kafe.com";
      const fixedLink = toAbsoluteHttpUrl(r.link, base);
      const fixedImageUrl = toDataOrHttpUrl(r.imageUrl, base);
      return {
        title: r.title,
        link: fixedLink,
        imageUrl: fixedImageUrl,
        imageAlt: r.imageAlt,
      };
    });

  await browser.close();
  return fixedResults;
};

/**
 * Fetches all chapters for a given novel URL from Novelight.
 * @param novelUrl The absolute URL to the novel's page.
 * @returns Promise<LightNovelChapter[]>
 */
export const getAllChapters = async (
  novelUrl: string,
): Promise<LightNovelChapter[]> => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(novelUrl, { waitUntil: "domcontentloaded" });

  // Ensure the 'Chapters' tab is selected
  const chaptersTabSelector = 'a[section-target="chapters"]';
  const isChaptersActive = await page
    .$eval(chaptersTabSelector, (el) => el.classList.contains("active"))
    .catch(() => false);
  if (!isChaptersActive) {
    await page.click(chaptersTabSelector);
    // Wait for the chapters section to become visible
    await page
      .waitForSelector("#select-pagination-chapter, #all-chapters-list", {
        state: "visible",
        timeout: 5000,
      })
      .catch(() => {});
  }

  // Wait for the select to appear (in case it's already visible)
  await page.waitForSelector("#select-pagination-chapter", {
    state: "visible",
  });

  // Get all option values (pages) in order from highest (latest) to lowest (earliest)
  const optionValues = await page.$$eval(
    "#select-pagination-chapter option",
    (opts) =>
      Array.from(opts)
        .filter((o): o is HTMLOptionElement => o instanceof HTMLOptionElement)
        .map((o) => o.value),
  );

  const chapters: LightNovelChapter[] = [];
  const seenLinks = new Set<string>();

  // Iterate from first to last (latest to earliest)
  for (const value of optionValues) {
    // Get the first chapter link before selection (if any)
    const prevFirstLink = await page
      .$eval("#all-chapters-list .chapter", (el) => el.getAttribute("href"))
      .catch(() => null);

    await page.selectOption("#select-pagination-chapter", value);

    // Wait for the first chapter link to change (or appear)
    await page
      .waitForFunction(
        (prev) => {
          const el = document.querySelector("#all-chapters-list .chapter");
          return el && el.getAttribute("href") !== prev;
        },
        prevFirstLink,
        { timeout: 10000 },
      )
      .catch(() => {}); // Don't throw if it doesn't change (e.g., first page)

    // Extract chapters on this page
    const pageChapters = await page.$$eval(
      "#all-chapters-list .chapter",
      (els) =>
        els.map((el) => {
          const title = el.querySelector(".title")?.textContent?.trim() || "";
          const link = el.getAttribute("href") || "";
          const author =
            el
              .querySelector(".chapter-info .author")
              ?.textContent?.replace(/^\s*by\s*/i, "")
              .trim() || undefined;
          const date =
            el.querySelector(".chapter-info .date")?.textContent?.trim() ||
            undefined;
          return {
            title,
            link,
            author,
            date,
          };
        }),
    );
    // Deduplicate by link
    for (const chapter of pageChapters) {
      if (!seenLinks.has(chapter.link)) {
        // 9kafe.com always returns relative links, prepend domain if needed
        const base = "https://novelight.net";
        const fixedLink = toAbsoluteHttpUrl(chapter.link, base);
        chapters.push({
          title: chapter.title,
          link: fixedLink,
          author: chapter.author,
          date: chapter.date,
        });
        seenLinks.add(fixedLink);
      }
    }
  }

  await browser.close();
  return chapters;
};

/**
 * Fetches the text content of a chapter given its URL.
 * @param chapterUrl The absolute URL to the chapter page.
 * @param keepOpen If true, leaves the browser open after extraction (for debugging). Default: false.
 * @returns Promise<LightNovelChapterContent>
 */
export const getChapterContent = async (
  chapterUrl: string,
  keepOpen: boolean = false,
): Promise<LightNovelChapterContent> => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Suspend disable-devtool anti-debug logic before any site JS runs (with polling for late init)
  await page.addInitScript(() => {
    function trySuspend() {
      if ((window as any).DisableDevtool) {
        (window as any).DisableDevtool.isSuspend = true;
      } else {
        setTimeout(trySuspend, 50);
      }
    }
    trySuspend();
    // Also, poll for up to 3 seconds in case DisableDevtool is initialized late
    let count = 0;
    const interval = setInterval(() => {
      if ((window as any).DisableDevtool) {
        (window as any).DisableDevtool.isSuspend = true;
        clearInterval(interval);
      }
      if (++count > 60) clearInterval(interval);
    }, 50);
  });

  await page.goto(chapterUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000); // Wait 2 seconds for JS to start
  const html = await page.content();
  console.log(html); // Debug: dump HTML after delay
  await page.waitForSelector("div.chapter-text", {
    timeout: 30000,
    state: "attached",
  });

  // As a backup, set isSuspend again after navigation
  await page.evaluate(() => {
    if ((window as any).DisableDevtool)
      (window as any).DisableDevtool.isSuspend = true;
  });

  // Wait for at least one div.chapter-text to appear anywhere in the DOM
  // await page.waitForSelector('div.chapter-text', { timeout: 30000 }); // This line is now redundant due to the new waitForSelector

  // As soon as loading is gone and content is present, stop the page to prevent redirect
  await page.evaluate(() => window.stop());

  // Extract the title (if available)
  const title = await page
    .$eval("title", (el) => el.textContent?.trim() || undefined)
    .catch(() => undefined);

  // Extract and sanitize the chapter text
  const text = await page.$eval(".chapter-text__place", (container) => {
    // Find all divs with class 'chapter-text'
    const chapterDivs = Array.from(
      container.querySelectorAll("div.chapter-text"),
    ) as HTMLDivElement[];
    // Helper to check if a div is a fake/advert one
    function isLegitChapterDiv(div: HTMLDivElement) {
      // If it contains only buttons or only 'Novelight' text, skip
      const hasNovelightButton = Array.from(
        div.querySelectorAll("button"),
      ).some(
        (btn: HTMLButtonElement) => btn.textContent?.trim() === "Novelight",
      );
      const hasNovelightText =
        div.textContent?.includes("# Nоvеlight #") ||
        div.textContent?.includes("Novelight");
      // If all children are buttons or 'Novelight', skip
      const onlyNovelight = Array.from(div.children).every((child: Element) => {
        if (
          child.tagName === "BUTTON" &&
          (child as HTMLButtonElement).textContent?.trim() === "Novelight"
        )
          return true;
        if ((child as HTMLElement).textContent?.includes("# Nоvеlight #"))
          return true;
        return false;
      });
      // Must have at least some real text
      return !onlyNovelight && (!hasNovelightButton || !hasNovelightText);
    }
    // Find the first legit chapter div
    const legitDiv = chapterDivs.find(isLegitChapterDiv) || chapterDivs[0];
    if (!legitDiv) return "";
    // Extract all direct child divs' text, skipping buttons and Novelight text
    const paras = Array.from(legitDiv.children)
      .filter((child: Element) => child.tagName === "DIV")
      .map((child: Element) => (child as HTMLElement).textContent || "")
      .map((txt) =>
        txt
          .replace(/#\s*Nоvеlight\s*#/gi, "")
          .replace(/Novelight/gi, "")
          .trim(),
      )
      .filter((txt) => txt.length > 0);
    return paras.join("\n\n");
  });

  if (!keepOpen) {
    await browser.close();
  }
  return { url: toAbsoluteHttpUrl(chapterUrl, ""), title, text };
};
