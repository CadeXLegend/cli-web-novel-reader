export type BookSearchResult = {
  readonly title: string;
  readonly url: string;
  readonly coverUrl: string;
};

export type Book = {
  readonly title: string;
  readonly url: string;
  readonly slug: string;
  readonly coverUrl: string;
};

export type Chapter = {
  readonly title: string;
  readonly url: string;
};

export type ChapterDownload = {
  readonly chapterTitle: string;
  readonly downloadUrl: string;
  readonly fileName: string;
};
