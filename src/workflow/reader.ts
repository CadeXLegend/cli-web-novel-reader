import Epub from "epub";
import prompts from "prompts";
import { readFile, writeFile } from "node:fs/promises";

function wordWrap(text: string, width: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
        if ((line + " " + word).trim().length > width) {
            lines.push(line.trim());
            line = word;
        } else {
            line += " " + word;
        }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
}

function boxPage(lines: string[], width: number): string[] {
    const border = "┌" + "─".repeat(width + 2) + "┐";
    const footer = "└" + "─".repeat(width + 2) + "┘";
    const boxed = [border];
    for (const line of lines) {
        boxed.push("│ " + line.padEnd(width, " ") + " │");
    }
    boxed.push(footer);
    return boxed;
}

async function getSavedPosition(epubPath: string): Promise<{ scroll?: number; chapter?: number }> {
    const posFile = epubPath + ".readpos.json";
    try {
        const data = await readFile(posFile, "utf8");
        const obj = JSON.parse(data);
        return { scroll: obj.scroll, chapter: obj.chapter };
    } catch { }
    return {};
}

async function savePosition(epubPath: string, scroll: number, chapter: number) {
    const posFile = epubPath + ".readpos.json";
    await writeFile(posFile, JSON.stringify({ scroll, chapter }), "utf8");
}

function findChapterLines(lines: string[]): { line: number; chapter: number }[] {
    const chapterRegex = /^chapter\s+(\d+)/i;
    const found: { line: number; chapter: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(chapterRegex);
        if (match) {
            // Heuristic: Only treat as a real chapter if the next 5 lines contain >100 chars total
            let textLen = 0;
            for (let j = 1; j <= 5 && i + j < lines.length; j++) {
                textLen += lines[i + j].trim().length;
            }
            if (textLen > 100) {
                found.push({ line: i, chapter: parseInt(match[1], 10) });
            }
        }
    }
    return found;
}

function getCurrentChapterIdx(chapterLines: { line: number; chapter: number }[], scroll: number): number {
    // Find the last chapter whose line is <= scroll
    let idx = 0;
    for (let i = 0; i < chapterLines.length; i++) {
        if (chapterLines[i].line <= scroll) {
            idx = i;
        } else {
            break;
        }
    }
    return idx;
}

export async function readEpubTerminal(epubPath: string): Promise<void> {
    const epub = new Epub(epubPath);
    await new Promise<void>((resolve, reject) => {
        epub.on("end", resolve);
        epub.on("error", reject);
        epub.parse();
    });

    // Get book title if available
    const bookTitle = epub.metadata?.title || undefined;

    // Flatten all chapters' text
    const chapterIds = epub.flow.map((ch: unknown) => (ch as { id: string }).id);
    let allText: string[] = [];
    for (let i = 0; i < chapterIds.length; i++) {
        const id = chapterIds[i];
        const html = await new Promise<string>((resolve, reject) => {
            epub.getChapter(id, (err: unknown, text: string) => {
                if (err) reject(err);
                else resolve(text);
            });
        });
        // Strip HTML tags, split into paragraphs
        const paras = html
            .replace(/<[^>]+>/g, "\n")
            .replace(/\r/g, "")
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean);
        allText = allText.concat(paras);
    }

    // Word-wrap and paginate
    const pageWidth = 80;
    const pageHeight = 20;
    let lines: string[] = [];
    // Add title to first page if available
    if (bookTitle) {
        const titleLine =
            bookTitle.length > pageWidth
                ? bookTitle
                : bookTitle.padStart(
                    Math.floor((pageWidth + bookTitle.length) / 2),
                    " ",
                );
        lines.push(titleLine, "");
    }
    for (const para of allText) {
        const wrapped = wordWrap(para, pageWidth);
        lines.push(...wrapped, "");
    }
    // Remove trailing blank lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();

    // Find chapter headings in the lines (skip TOC entries)
    const chapterLines = findChapterLines(lines);

    // Load saved position if available
    let scroll = 0;
    let currentChapterIdx = 0;
    const saved = await getSavedPosition(epubPath);
    if (
        typeof saved.scroll === "number" &&
        saved.scroll > 0 &&
        saved.scroll < lines.length
    ) {
        const { resume }: { resume: boolean } = await prompts({
            type: "confirm",
            name: "resume",
            message: `Continue from where you left off? (Line ${saved.scroll + 1})`,
            initial: true,
        });
        if (resume) {
            scroll = saved.scroll;
            if (typeof saved.chapter === "number") {
                currentChapterIdx = saved.chapter;
            } else {
                currentChapterIdx = getCurrentChapterIdx(chapterLines, scroll);
            }
        }
    }

    const maxScroll = Math.max(0, lines.length - pageHeight);
    const totalPages = Math.ceil(lines.length / pageHeight);
    let page = 0;
    let lastNav: string | undefined = undefined;
    while (true) {
        // Clamp scroll and page
        if (scroll < 0) scroll = 0;
        if (scroll > maxScroll) scroll = maxScroll;
        page = Math.floor(scroll / pageHeight);
        // Update current chapter index
        currentChapterIdx = getCurrentChapterIdx(chapterLines, scroll);
        console.clear();
        const pageLines = lines.slice(scroll, scroll + pageHeight);
        const boxed = boxPage(pageLines, pageWidth);
        for (const line of boxed) {
            console.log(line);
        }
        // Show chapter info
        if (chapterLines.length > 0) {
            const chap = chapterLines[currentChapterIdx];
            console.log(
                `\nChapter ${chap.chapter} (Line ${chap.line + 1} of ${lines.length}, Chapter ${currentChapterIdx + 1} of ${chapterLines.length})`
            );
        }
        console.log(
            `\nPage ${page + 1} / ${totalPages} (Line ${scroll + 1} of ${lines.length})`,
        );
        // Navigation options
        const navChoices = [];
        if (scroll > 0) navChoices.push({ title: "Scroll up", value: "scroll-up" });
        if (scroll < maxScroll)
            navChoices.push({ title: "Scroll down", value: "scroll-down" });
        if (page > 0) navChoices.push({ title: "Prev page", value: "prev" });
        if (page < totalPages - 1)
            navChoices.push({ title: "Next page", value: "next" });
        // Only show 'Prev chapter' if not at the first chapter
        if (currentChapterIdx > 1) {
            navChoices.push({ title: `Prev chapter`, value: "prev-chapter" });
        }
        // Remove 'Prev chapter' if at chapter 1 (extra guard)
        if (currentChapterIdx < 1) {
            const index = navChoices.findIndex(
                (opt) => opt.title === "Prev chapter" && opt.value === "prev-chapter"
            );
            if (index !== -1) navChoices.splice(index, 1);
        }
        if (currentChapterIdx < chapterLines.length - 1)
            navChoices.push({ title: `Next chapter`, value: "next-chapter" });
        navChoices.push({ title: "Quit", value: "quit" });
        const { nav }: { nav: string } = await prompts({
            type: "select",
            name: "nav",
            message: "Navigation:",
            choices: navChoices,
            initial: lastNav ? navChoices.findIndex((c) => c.value === lastNav) : 0,
        });
        lastNav = nav;
        if (nav === "next") scroll = Math.min(scroll + pageHeight, maxScroll);
        else if (nav === "prev") scroll = Math.max(scroll - pageHeight, 0);
        else if (nav === "scroll-down") scroll = Math.min(scroll + 1, maxScroll);
        else if (nav === "scroll-up") scroll = Math.max(scroll - 1, 0);
        else if (nav === "next-chapter") {
            // Jump to the start of the next real chapter (skip TOC chapter listings)
            if (currentChapterIdx >= chapterLines.length - 1) {
                // Already at last chapter, do nothing
                // No-op
            } else {
                let nextIdx = currentChapterIdx + 1;
                while (nextIdx < chapterLines.length) {
                    // Check if the next 10 lines after this heading contain another heading
                    let isTOC = false;
                    for (let j = 1; j <= 10 && chapterLines[nextIdx].line + j < lines.length; j++) {
                        if (/^chapter\s+\d+/i.test(lines[chapterLines[nextIdx].line + j])) {
                            isTOC = true;
                            break;
                        }
                    }
                    if (!isTOC) break;
                    nextIdx++;
                }
                if (nextIdx < chapterLines.length && nextIdx >= 0 && chapterLines[nextIdx]) {
                    const nextLine = chapterLines[nextIdx].line;
                    scroll = Math.min(nextLine, maxScroll);
                }
            }
        } else if (nav === "prev-chapter") {
            // Jump to the start of the previous real chapter (skip TOC chapter listings)
            if (currentChapterIdx === 0 || currentChapterIdx === 1 || currentChapterIdx - 1 < 0 || chapterLines.length === 0) {
                // Already at first chapter, do nothing
                // No-op
            } else {
                let prevIdx = currentChapterIdx - 1;
                while (prevIdx > 0) {
                    // Check if the next 10 lines after this heading contain another heading
                    let isTOC = false;
                    for (let j = 1; j <= 10 && chapterLines[prevIdx].line + j < lines.length; j++) {
                        if (/^chapter\s+\d+/i.test(lines[chapterLines[prevIdx].line + j])) {
                            isTOC = true;
                            break;
                        }
                    }
                    if (!isTOC) break;
                    prevIdx--;
                }
                if (prevIdx >= 0 && prevIdx < chapterLines.length && chapterLines[prevIdx]) {
                    const prevLine = chapterLines[prevIdx].line;
                    scroll = Math.max(prevLine, 0);
                }
            }
        } else break;
    }
    // Save position on exit
    await savePosition(epubPath, scroll, currentChapterIdx);
}
