import { describe, expect, it, vi, afterEach } from "vitest";
import { unfurlLink } from "./link-unfurl.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("unfurlLink", () => {
  it("parses Open Graph tags", async () => {
    const html = `<!doctype html><html><head>
      <meta property="og:title" content="Awesome Kettle" />
      <meta property="og:description" content="Boils water fast" />
      <meta property="og:image" content="https://cdn.example.com/kettle.jpg" />
      <meta property="og:site_name" content="ShopCo" />
      <title>Fallback</title>
    </head><body></body></html>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/html; charset=utf-8" },
        arrayBuffer: async () => Buffer.from(html),
      })
    );

    const preview = await unfurlLink("https://www.amazon.com/dp/B00TEST");
    expect(preview.title).toBe("Awesome Kettle");
    expect(preview.description).toBe("Boils water fast");
    expect(preview.image).toBe("https://cdn.example.com/kettle.jpg");
    expect(preview.siteName).toBe("ShopCo");
  });

  it("rejects localhost", async () => {
    await expect(unfurlLink("http://localhost:3000/x")).rejects.toMatchObject({
      status: 400,
    });
  });
});
