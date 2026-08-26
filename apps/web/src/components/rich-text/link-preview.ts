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

    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      domain = siteName || "";
    }

    const faviconUrl = domain
      ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
      : "";

    const headerKids: unknown[] = [];
    if (faviconUrl) {
      headerKids.push([
        "img",
        {
          src: faviconUrl,
          alt: "",
          class: "link-preview-favicon",
          loading: "lazy",
          referrerpolicy: "no-referrer",
        },
      ]);
    }
    headerKids.push([
      "span",
      { class: "link-preview-site" },
      siteName || domain,
    ]);
    if (domain && domain.toLowerCase() !== (siteName || "").toLowerCase()) {
      headerKids.push([
        "span",
        { class: "link-preview-domain" },
        domain,
      ]);
    }

    const metaKids: unknown[] = [
      ["div", { class: "link-preview-header" }, ...headerKids],
      ["strong", { class: "link-preview-title" }, title],
    ];

    if (description) {
      metaKids.push(["p", { class: "link-preview-desc" }, description]);
    }

    const cardInner: unknown[] = [
      ["div", { class: "link-preview-meta" }, ...metaKids],
    ];

    if (image && !image.includes("google.com/s2/favicons?domain=")) {
      cardInner.push([
        "div",
        { class: "link-preview-image-wrap" },
        [
          "img",
          {
            src: image,
            alt: title,
            class: "link-preview-image",
            loading: "lazy",
            referrerpolicy: "no-referrer",
          },
        ],
      ]);
    }

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
      [
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noopener noreferrer",
          class: "link-preview-card",
        },
        ...cardInner,
      ],
    ];
  },
});
