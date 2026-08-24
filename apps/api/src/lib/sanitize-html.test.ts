import { describe, expect, it } from "vitest";
import { extractMediaIds, sanitizeNoteHtml } from "./sanitize-html.js";

describe("sanitizeNoteHtml", () => {
  it("keeps basic formatting and strips scripts", () => {
    const out = sanitizeNoteHtml(
      `<p>Hi <strong>there</strong></p><script>alert(1)</script>`
    );
    expect(out).toContain("<strong>there</strong>");
    expect(out).not.toContain("script");
  });

  it("allows YouTube iframe and blocks unknown hosts", () => {
    const yt = sanitizeNoteHtml(
      `<iframe src="https://www.youtube.com/embed/abc"></iframe>`
    );
    expect(yt).toContain("youtube.com");

    const bad = sanitizeNoteHtml(
      `<iframe src="https://evil.example/embed"></iframe>`
    );
    expect(bad).not.toContain("evil.example");
  });

  it("extracts media ids", () => {
    expect(
      extractMediaIds(
        `<img data-media-id="m1" src="x"><video data-media-id="m2"></video>`
      )
    ).toEqual(["m1", "m2"]);
  });
});
