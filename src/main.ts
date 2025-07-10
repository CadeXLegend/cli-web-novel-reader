import { promptMainMenu, MainMenuAction } from "./components/menuPrompt.js";
import { downloadFlow } from "./components/downloadFlow.js";
import { readFlow } from "./components/readFlow.js";

async function mainMenu() {
  while (true) {
    const action: MainMenuAction = await promptMainMenu();
    if (action === "download") {
      let next = await downloadFlow();
      while (next === "search") {
        next = await downloadFlow();
      }
    } else if (action === "read") {
      await readFlow();
    } else if (action === "quit") {
      console.log("Goodbye!");
      process.exit(0);
    }
  }
}

mainMenu();
