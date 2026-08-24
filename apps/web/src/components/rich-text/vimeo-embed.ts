import { Node, mergeAttributes } from "@tiptap/core";

export function toVimeoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)vimeo\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const id = parts.find((p) => /^\d+$/.test(p));
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
}

export const Vimeo = Node.create({
  name: "vimeo",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe[src*="player.vimeo.com"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "iframe",
      mergeAttributes(HTMLAttributes, {
        width: "640",
        height: "360",
        frameborder: "0",
        allowfullscreen: "true",
        allow: "autoplay; fullscreen; picture-in-picture",
        title: "Vimeo video",
      }),
    ];
  },
});
