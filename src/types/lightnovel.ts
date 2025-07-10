export const bookUrl = "https://novellive.app/book/";
export const searchURL = "https://novellive.app/search/";
export const catalogSearchUrl = "https://novelight.net/catalog/?search=";

// String type system rules for absolute URLs
export type AbsoluteHttpUrl = `http://${string}` | `https://${string}`;
export type DataOrHttpUrl = `http://${string}` | `https://${string}` | `data:${string}`;

export interface LightNovelSearchResult {
  title: string;
  link: AbsoluteHttpUrl; // Absolute URL
  imageUrl?: DataOrHttpUrl;
  imageAlt?: string;
}

export interface LightNovelChapter {
  title: string;
  link: AbsoluteHttpUrl; // Absolute URL
  author?: string;
  date?: string;
}

export interface LightNovelChapterContent {
  url: AbsoluteHttpUrl;
  title?: string;
  text: string;
}
