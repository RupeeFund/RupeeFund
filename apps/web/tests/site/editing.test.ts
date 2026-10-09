import { describe, expect, it } from "vitest";
import { read, visits } from "./dist.ts";

describe("live pages offer no editing", () => {
  it("gives a visitor no Edit pill", () => {
    expect(read("index.html")).not.toContain("<!-- EmDash Toolbar Bootstrap -->");
  });

  it.each(["an Admin on the landing page", "an Admin on a legal page", "an Admin's edit link"])(
    "gives %s no Edit pill, no toolbar and no field marks",
    (visit) => {
      expect(visits()[visit]).toMatchObject({ status: 200, pill: false, toolbar: false, marks: 0 });
    },
  );

  it("sends an Admin with an old edit cookie back to the page without it, so no draft shows", () => {
    expect(visits()["an Admin with an old edit cookie"]).toMatchObject({
      status: 302,
      location: "/",
      setCookie: "emdash-edit-mode=; Path=/; Max-Age=0",
    });
  });
});
