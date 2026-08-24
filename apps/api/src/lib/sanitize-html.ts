import sanitizeHtml from "sanitize-html";

const IFRAME_HOST_ALLOWLIST = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.loom.com",
  "loom.com",
];

function hostAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return IFRAME_HOST_ALLOWLIST.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Sanitize TipTap HTML before persist / re-emit. */
export function sanitizeNoteHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "code",
      "pre",
      "img",
      "video",
      "source",
      "iframe",
      "div",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "data-media-id", "width", "height"],
      video: [
        "src",
        "controls",
        "data-media-id",
        "width",
        "height",
        "preload",
      ],
      source: ["src", "type"],
      iframe: [
        "src",
        "width",
        "height",
        "allow",
        "allowfullscreen",
        "frameborder",
        "title",
      ],
      div: ["data-youtube-video", "data-vimeo-video", "class"],
      "*": ["class"],
    },
    allowedSchemes: ["https", "http", "data", "blob"],
    exclusiveFilter: (frame) => {
      if (frame.tag !== "iframe") return false;
      const src = frame.attribs?.src || "";
      return !hostAllowed(src);
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}

/** Extract MediaAsset ids referenced in note HTML. */
export function extractMediaIds(html: string): string[] {
  const ids = new Set<string>();
  const re = /data-media-id=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) ids.add(m[1]);
  }
  return [...ids];
}
