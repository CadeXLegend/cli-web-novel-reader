import prompts from "prompts";

export async function promptSearchTerm(): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "search",
    message: "Enter search term:",
  });
  return response.search;
}

export async function promptSelectResult<T>(
  choices: readonly T[],
  getLabel: (item: T) => string,
): Promise<T> {
  const response = await prompts({
    type: "select",
    name: "selected",
    message: "Select a result:",
    choices: choices.map((item, i) => ({ title: getLabel(item), value: i })),
  });
  return choices[response.selected];
}
// Requires: npm install prompts
