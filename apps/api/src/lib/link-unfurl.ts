import * as cheerio from "cheerio";
import { HTTPException } from "hono/http-exception";

export type LinkUnfurl = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_500_000;

function absUrl(base: string, maybe: string | undefined): string {
  if (!maybe) return "";
  try {
    return new URL(maybe, base).toString();
  } catch {
    return "";
  }
}

function meta(
  $: cheerio.CheerioAPI,
  ...keys: string[]
): string {
  for (const key of keys) {
    const v =
      $(`meta[property="${key}"]`).attr("content") ||
      $(`meta[name="${key}"]`).attr("content");
    if (v?.trim()) return v.trim();
  }
  return "";
}

export async function unfurlLink(rawUrl: string): Promise<LinkUnfurl> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HTTPException(400, { message: "Invalid URL" });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new HTTPException(400, { message: "Only http(s) URLs are supported" });
  }
  // Block obvious local/metadata targets
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("169.254.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.")
  ) {
    throw new HTTPException(400, { message: "That host cannot be previewed" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "NoteShareLinkPreview/1.0 (+https://note-share-ruby.vercel.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    throw new HTTPException(502, { message: "Could not fetch that link" });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new HTTPException(502, {
      message: `Preview fetch failed (${res.status})`,
    });
  }

  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!ctype.includes("text/html") && !ctype.includes("application/xhtml")) {
    // Fallback card for non-HTML (PDFs, etc.)
    return {
      url: url.toString(),
      title: url.hostname + url.pathname,
      description: "",
      image: "",
      siteName: url.hostname.replace(/^www\./, ""),
    };
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new HTTPException(413, { message: "Page too large to preview" });
  }

  const $ = cheerio.load(buf.toString("utf8"));
  const title =
    meta($, "og:title", "twitter:title") ||
    $("title").first().text().trim() ||
    url.hostname;
  const description =
    meta($, "og:description", "twitter:description", "description") || "";
  const image = absUrl(
    url.toString(),
    meta($, "og:image", "twitter:image", "twitter:image:src")
  );
  const siteName =
    meta($, "og:site_name") || url.hostname.replace(/^www\./, "");

  return {
    url: url.toString(),
    title: title.slice(0, 200),
    description: description.slice(0, 400),
    image: image.startsWith("https:") || image.startsWith("http:") ? image : "",
    siteName: siteName.slice(0, 100),
  };
}
