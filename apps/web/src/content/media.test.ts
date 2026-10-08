import { describe, expect, it } from "vitest";
import { contentDocument } from "./schema.ts";
import { mediaKeys } from "./media.ts";
import { validDocument } from "./fixture.ts";

describe("the media list", () => {
  it("names each media file that the content uses, once", () => {
    const doc = validDocument();
    doc.posts[0]!.body = [{ _type: "image", src: "/media/01ABC.png", alt: "Again" }];
    expect(mediaKeys(contentDocument.parse(doc))).toEqual(["01ABC.png"]);
  });
});
