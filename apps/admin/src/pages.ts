import { overviewPage } from "./view-overview.ts";
import { questionsPage } from "./view-questions.ts";
import { recordsPage } from "./view-records.ts";

const VIEWS: Readonly<Record<string, () => string>> = {
  "/": overviewPage,
  "/records": recordsPage,
  "/questions": questionsPage,
};

export function render(path: string): string {
  const view = VIEWS[path];
  if (view === undefined) throw new Error(`no view for ${path}`);
  return view();
}
