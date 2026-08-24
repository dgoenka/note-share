import { Node, mergeAttributes } from "@tiptap/core";

export const UploadedVideo = Node.create({
  name: "uploadedVideo",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      "data-media-id": { default: null },
      controls: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: "video[data-media-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, { controls: "true" }),
    ];
  },
});
