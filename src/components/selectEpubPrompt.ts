import prompts from "prompts";

export type SelectChoice = { title: string; value: string };

export async function selectEpubPrompt(choices: SelectChoice[]): Promise<string> {
  const { epubPath } = await prompts({
    type: "select",
    name: "epubPath",
    message: "Select an EPUB to read:",
    choices: choices.concat([
      { title: "Return to main menu", value: "main-menu" },
    ]),
  });
  return epubPath;
} 