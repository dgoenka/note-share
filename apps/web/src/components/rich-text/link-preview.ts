import { Node, mergeAttributes } from "@tiptap/core";

export type LinkPreviewAttrs = {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

export const LinkPreview = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      siteName: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-link-preview]",
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            url: el.getAttribute("data-url") || "",
            title: el.getAttribute("data-title") || "",
            description: el.getAttribute("data-description") || "",
            image: el.getAttribute("data-image") || "",
            siteName: el.getAttribute("data-site") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const url = String(HTMLAttributes.url || "");
    const title = String(HTMLAttributes.title || url);
    const description = String(HTMLAttributes.description || "");
    const image = String(HTMLAttributes.image || "");
    const siteName = String(HTMLAttributes.siteName || "");

    const children: ReturnType<typeof mergeAttributes> extends never
      ? never
      : unknown[] = [];

    // TipTap renderHTML: nested array structure
    const inner: (string | Record<string, string> | unknown[])[] = [
      "a",
      {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        class: "link-preview-card",
      },
    ];

    if (image) {
      inner.push([
        "img",
        {
          src: image,
          alt: title,
          class: "link-preview-image",
        },
      ]);
    }

    const metaKids: unknown[] = [
      "div",
      { class: "link-preview-meta" },
      ["strong", { class: "link-preview-title" }, title],
    ];
    if (description) {
      metaKids.push(["p", { class: "link-preview-desc" }, description]);
    }
    if (siteName) {
      metaKids.push(["span", { class: "link-preview-site" }, siteName]);
    }
    inner.push(metaKids);

    return [
      "div",
      mergeAttributes({
        "data-link-preview": "true",
        "data-url": url,
        "data-title": title,
        "data-description": description,
        "data-image": image,
        "data-site": siteName,
        class: "link-preview",
      }),
      inner,
    ];
  },
});
