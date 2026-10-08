import { describe, expect, it } from "vitest";
import { read, visits } from "./dist.ts";
import { LANDING_MARKS, LEGAL_PAGE } from "./routes.ts";

const LEGAL_MARKS = LEGAL_PAGE.effectiveDate ? ["title", "effective_date"] : ["title"];

describe("live-page editing", () => {
  it("gives every visitor the same page with the Edit pill bootstrap", () => {
    const home = read("index.html");
    expect(home).toContain("<!-- EmDash Toolbar Bootstrap -->");
    expect(home).not.toContain('id="emdash-toolbar"');
  });

  it("sends a stranger's edit link to the page itself", () => {
    expect(visits()["a stranger's edit link"]).toMatchObject({ status: 302, location: "/" });
  });

  it("shows a stranger with an edit cookie no toolbar and no annotations", () => {
    expect(visits()["a stranger's edit cookie"]).toMatchObject({
      status: 200,
      toolbar: false,
      marks: [],
    });
  });

  it("gives an Admin's edit link the toolbar, privately", () => {
    expect(visits()["an Admin's edit link"]).toMatchObject({
      status: 200,
      toolbar: true,
      cache: "private, no-store",
    });
  });

  it.each([
    ["an Admin on the landing page", LANDING_MARKS],
    ["an Admin on a legal page", LEGAL_MARKS],
  ])("annotates the fields for %s, privately", (visit, marks) => {
    expect(visits()[visit]).toMatchObject({
      status: 200,
      toolbar: true,
      cache: "private, no-store",
      marks,
    });
  });

  it.each(["an Editor on the landing page", "an Editor on a legal page"])(
    "annotates nothing for %s, who cannot save it",
    (visit) => {
      expect(visits()[visit]).toMatchObject({ status: 200, toolbar: true, marks: [] });
    },
  );
});
