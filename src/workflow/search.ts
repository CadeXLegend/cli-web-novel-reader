import { fetchHtml } from "../utils/fetch.js";
import { parseSearchResults } from "../utils/parse.js";
import { promptSearchTerm, promptSelectResult } from "../utils/prompt.js";
import prompts from "prompts";
import type { BookSearchResult } from "../types/domain.js";

const SEARCH_URL = "https://9kafe.com/?s=";

export async function searchAndSelectBook(): Promise<BookSearchResult | null> {
  while (true) {
    const searchTerm = await promptSearchTerm();
    // Use the search term exactly as entered, only encodeURIComponent for URL
    const url = `${SEARCH_URL}${encodeURIComponent(searchTerm)}`;
    const html = await fetchHtml(url);
    const results = parseSearchResults(html);
    if (results.length === 0) {
      const { nextAction } = await prompts({
        type: "select",
        name: "nextAction",
        message: "No results found. What would you like to do?",
        choices: [
          { title: "Search again", value: "search" },
          { title: "Return to main menu", value: "main" },
        ],
      });
      if (nextAction === "main") return null;
      // else loop to search again
      continue;
    }
    const selected = await promptSelectResult(results, (r) => r.title);
    return selected;
  }
}
