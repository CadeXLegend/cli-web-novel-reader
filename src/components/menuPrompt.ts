import prompts from "prompts";

export type MainMenuAction = "download" | "read" | "quit";

export async function promptMainMenu(): Promise<MainMenuAction> {
  const { action } = await prompts({
    type: "select",
    name: "action",
    message: "What do you want to do?",
    choices: [
      { title: "Download new book", value: "download" },
      { title: "Read downloaded EPUB", value: "read" },
      { title: "Quit", value: "quit" },
    ],
  });
  return action;
} 