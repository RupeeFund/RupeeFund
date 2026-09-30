import { waitlistPage } from "./view-waitlist.ts";

const VIEWS: Readonly<Record<string, () => string>> = {
  "/": waitlistPage,
};

export function render(path: string): string {
  const view = VIEWS[path];
  if (view === undefined) throw new Error(`no view for ${path}`);
  return view();
}
