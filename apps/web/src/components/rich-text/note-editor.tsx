"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import {
  ALargeSmall,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Globe,
  Heading,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Palette,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Video,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { api, ApiError } from "@/lib/api";
import { prepareMediaFile } from "@/lib/compress-media";
import { cn } from "@/lib/utils";
import { UploadedVideo } from "@/components/rich-text/uploaded-video";
import { Vimeo, toVimeoEmbed } from "@/components/rich-text/vimeo-embed";
import { LinkPreview } from "@/components/rich-text/link-preview";
import {
  NOTE_FONTS,
  NOTE_FONT_SIZES,
  NOTE_FONTS_STYLESHEET,
} from "@/components/rich-text/fonts";

/** Keep editor selection when interacting with toolbar controls. */
function keepSelection(e: React.SyntheticEvent) {
  e.preventDefault();
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-700 transition hover:bg-stone-200/80 disabled:opacity-40 sm:h-8 sm:w-8",
        active && "bg-stone-200 text-stone-900"
      )}
    >
      {children}
    </button>
  );
}

const TEXT_COLORS = [
  "#1c1917",
  "#b45309",
  "#be123c",
  "#1d4ed8",
  "#15803d",
  "#7c3aed",
];

function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function withPreservedSelection(editor: Editor, run: () => void) {
  const { from, to } = editor.state.selection;
  editor.view.focus();
  if (from !== to) {
    editor.commands.setTextSelection({ from, to });
  }
  run();
}

export function NoteEditor({
  token,
  value,
  onChange,
  disabled,
}: {
  token: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const savedSelection = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const id = "note-share-editor-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = NOTE_FONTS_STYLESHEET;
    document.head.appendChild(link);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      // TipTap v3: one kit merges font-family / font-size / color into a single style attr
      TextStyleKit.configure({
        backgroundColor: false,
        lineHeight: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            "data-media-id": {
              default: null,
              parseHTML: (el) => el.getAttribute("data-media-id"),
              renderHTML: (attrs) =>
                attrs["data-media-id"]
                  ? { "data-media-id": attrs["data-media-id"] }
                  : {},
            },
          };
        },
      }).configure({
        HTMLAttributes: { class: "rounded-lg max-h-96" },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        nocookie: true,
      }),
      Vimeo,
      UploadedVideo,
      LinkPreview,
      Placeholder.configure({
        placeholder:
          "Write your note… Select text, then pick a font/size. Paste links for preview cards.",
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "note-editor-prose min-h-[12rem] max-h-[28rem] overflow-y-auto px-3 py-2 text-sm leading-relaxed focus:outline-none",
      },
      handlePaste(_view, event) {
        const text = event.clipboardData?.getData("text/plain")?.trim();
        if (!text || !editor) return false;
        if (/youtu(\.be|be\.com)/i.test(text)) {
          event.preventDefault();
          editor.commands.setYoutubeVideo({ src: text });
          return true;
        }
        const vimeo = toVimeoEmbed(text);
        if (vimeo) {
          event.preventDefault();
          editor.commands.insertContent({
            type: "vimeo",
            attrs: { src: vimeo },
          });
          return true;
        }
        if (isHttpUrl(text) && !/\s/.test(text)) {
          const { from, to } = editor.state.selection;
          if (from !== to) {
            event.preventDefault();
            editor.chain().focus().setLink({ href: text }).run();
            onChange(editor.getHTML());
            return true;
          }
          event.preventDefault();
          void (async () => {
            try {
              setUploadError(null);
              setUploading(true);
              const preview = await api.unfurlLink(token, text);
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "linkPreview",
                  attrs: {
                    url: preview.url,
                    title: preview.title || preview.url,
                    description: preview.description || "",
                    image: preview.image || "",
                    siteName: preview.siteName || "",
                  },
                })
                .createParagraphNear()
                .run();
              onChange(editor.getHTML());
            } catch (err) {
              editor
                .chain()
                .focus()
                .insertContent(
                  `<p><a href="${text}" target="_blank" rel="noopener noreferrer">${text}</a></p>`
                )
                .run();
              onChange(editor.getHTML());
              setUploadError(
                err instanceof ApiError
                  ? `Preview unavailable — inserted as link (${err.message})`
                  : "Preview unavailable — inserted as link"
              );
            } finally {
              setUploading(false);
            }
          })();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreMenuRef.current?.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  const rememberSelection = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
  }, [editor]);

  const restoreSelection = useCallback(() => {
    if (!editor || !savedSelection.current) return;
    const { from, to } = savedSelection.current;
    editor.chain().focus().setTextSelection({ from, to }).run();
  }, [editor]);

  const uploadAndInsert = useCallback(
    async (file: File, asVideo: boolean) => {
      if (!editor || !token) return;
      setUploadError(null);
      setUploading(true);
      try {
        const prepared = await prepareMediaFile(file);
        if (asVideo && prepared.kind !== "VIDEO") {
          throw new Error("Please choose an MP4 or WebM video");
        }
        if (!asVideo && prepared.kind !== "IMAGE") {
          throw new Error("Please choose an image file");
        }
        const uploaded = await api.uploadMedia(token, prepared.file);
        const signed = await api.signMedia(token, [uploaded.id]);
        const src = signed.urls[uploaded.id] || "";
        if (uploaded.kind === "IMAGE") {
          editor.chain().focus().setImage({ src, alt: file.name }).run();
          editor.commands.command(({ tr, state, dispatch }) => {
            let pos: number | null = null;
            state.doc.descendants((node, p) => {
              if (node.type.name === "image" && node.attrs.src === src) {
                pos = p;
                return false;
              }
              return true;
            });
            if (pos == null || !dispatch) return false;
            tr.setNodeMarkup(pos, undefined, {
              ...state.doc.nodeAt(pos)?.attrs,
              "data-media-id": uploaded.id,
            });
            dispatch(tr);
            return true;
          });
          onChange(editor.getHTML());
        } else {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "uploadedVideo",
              attrs: {
                src,
                "data-media-id": uploaded.id,
                controls: true,
              },
            })
            .run();
          onChange(editor.getHTML());
        }
      } catch (err) {
        setUploadError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Upload failed"
        );
      } finally {
        setUploading(false);
      }
    },
    [editor, token, onChange]
  );

  const insertLinkPreview = useCallback(
    async (rawUrl: string) => {
      if (!editor || !token) return;
      const clean = rawUrl.trim();
      if (!clean) return;
      const targetUrl = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
      setUploadError(null);
      setUploading(true);
      try {
        const preview = await api.unfurlLink(token, targetUrl);
        editor
          .chain()
          .focus()
          .insertContent({
            type: "linkPreview",
            attrs: {
              url: preview.url,
              title: preview.title || preview.url,
              description: preview.description || "",
              image: preview.image || "",
              siteName: preview.siteName || "",
            },
          })
          .createParagraphNear()
          .run();
        onChange(editor.getHTML());
      } catch (err) {
        setUploadError(
          err instanceof ApiError
            ? `Preview unavailable (${err.message})`
            : "Preview unavailable"
        );
      } finally {
        setUploading(false);
      }
    },
    [editor, token, onChange]
  );

  if (!editor) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-8 text-center text-sm text-stone-500">
        Loading editor…
      </div>
    );
  }

  const styleAttrs = editor.getAttributes("textStyle") as {
    fontFamily?: string | null;
    fontSize?: string | null;
    color?: string | null;
  };
  const currentFont = styleAttrs.fontFamily || "";
  const currentSize = styleAttrs.fontSize || "";
  const currentColor = styleAttrs.color || "#1c1917";

  const blockStyle = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  return (
    <div className="rounded-xl border border-stone-200 bg-white/90 shadow-sm">
      {/* Primary bar — essentials always visible; rest in overflow */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 bg-stone-50/80 px-1 py-1">
        <div
          className="relative inline-flex h-9 items-center rounded-lg hover:bg-stone-200/70 sm:h-8"
          title="Paragraph style"
        >
          <Heading className="pointer-events-none absolute left-1.5 h-3.5 w-3.5 text-stone-600" />
          <select
            aria-label="Paragraph style"
            className="h-9 w-[4.5rem] cursor-pointer appearance-none truncate rounded-lg border-0 bg-transparent py-0 pl-7 pr-5 text-[11px] font-semibold text-stone-800 sm:h-8"
            value={blockStyle}
            disabled={disabled}
            onMouseDown={rememberSelection}
            onFocus={rememberSelection}
            onChange={(e) => {
              const v = e.target.value;
              restoreSelection();
              withPreservedSelection(editor, () => {
                if (v === "p") {
                  editor.chain().focus().setParagraph().run();
                } else {
                  const level = Number(v.replace("h", "")) as 1 | 2 | 3;
                  editor.chain().focus().setHeading({ level }).run();
                }
              });
              onChange(editor.getHTML());
            }}
          >
            <option value="p">Text</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-stone-400" />
        </div>

        <ToolbarButton
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as
              | string
              | undefined;
            const url = window.prompt("Link URL", prev || "https://");
            if (url === null) return;
            if (!url) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url })
              .run();
          }}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Insert link preview card"
          disabled={uploading || disabled}
          onClick={() => {
            const url = window.prompt("Enter URL for link preview card:", "https://");
            if (url?.trim() && url.trim() !== "https://") {
              void insertLinkPreview(url.trim());
            }
          }}
        >
          <Globe className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Upload image"
          disabled={uploading || disabled}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Overflow — font/size/color/align/etc */}
        <div className="relative ml-auto" ref={moreMenuRef}>
          <ToolbarButton
            title="More formatting"
            active={moreOpen}
            disabled={disabled}
            onClick={() => {
              rememberSelection();
              setMoreOpen((v) => !v);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </ToolbarButton>
          {moreOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    <Type className="h-3 w-3" /> Font
                  </span>
                  <select
                    aria-label="Font family"
                    className="h-9 rounded-lg border border-stone-200 bg-stone-50 px-2 text-xs font-semibold text-stone-800"
                    value={currentFont}
                    onMouseDown={rememberSelection}
                    onFocus={rememberSelection}
                    onChange={(e) => {
                      const v = e.target.value;
                      restoreSelection();
                      withPreservedSelection(editor, () => {
                        if (!v) editor.chain().focus().unsetFontFamily().run();
                        else editor.chain().focus().setFontFamily(v).run();
                      });
                      onChange(editor.getHTML());
                    }}
                  >
                    {NOTE_FONTS.map((f) => (
                      <option
                        key={f.label}
                        value={f.value}
                        style={{ fontFamily: f.value || undefined }}
                      >
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                    <ALargeSmall className="h-3 w-3" /> Size
                  </span>
                  <select
                    aria-label="Font size"
                    className="h-9 rounded-lg border border-stone-200 bg-stone-50 px-2 text-xs font-semibold text-stone-800"
                    value={currentSize || "16px"}
                    onMouseDown={rememberSelection}
                    onFocus={rememberSelection}
                    onChange={(e) => {
                      const v = e.target.value;
                      restoreSelection();
                      withPreservedSelection(editor, () => {
                        editor.chain().focus().setFontSize(v).run();
                      });
                      onChange(editor.getHTML());
                    }}
                  >
                    {NOTE_FONT_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mb-2">
                <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  <Palette className="h-3 w-3" /> Color
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      className={cn(
                        "h-6 w-6 rounded-full ring-1 ring-stone-300",
                        currentColor === c &&
                          "ring-2 ring-stone-700 ring-offset-1"
                      )}
                      style={{ backgroundColor: c }}
                      onMouseDown={(e) => {
                        keepSelection(e);
                        rememberSelection();
                      }}
                      onClick={() => {
                        restoreSelection();
                        withPreservedSelection(editor, () => {
                          editor.chain().focus().setColor(c).run();
                        });
                        onChange(editor.getHTML());
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-1 flex flex-wrap gap-0.5">
                <ToolbarButton
                  title="Underline"
                  active={editor.isActive("underline")}
                  onClick={() =>
                    editor.chain().focus().toggleUnderline().run()
                  }
                >
                  <UnderlineIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  title="Strike"
                  active={editor.isActive("strike")}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  title="Highlight"
                  active={editor.isActive("highlight")}
                  onClick={() =>
                    editor
                      .chain()
                      .focus()
                      .toggleHighlight({ color: "#fef08a" })
                      .run()
                  }
                >
                  <Highlighter className="h-4 w-4" />
                </ToolbarButton>
                <span className="mx-0.5 h-5 w-px self-center bg-stone-200" />
                <ToolbarButton
                  title="Align left"
                  active={editor.isActive({ textAlign: "left" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                >
                  <AlignLeft className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  title="Align center"
                  active={editor.isActive({ textAlign: "center" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                >
                  <AlignCenter className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  title="Align right"
                  active={editor.isActive({ textAlign: "right" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                >
                  <AlignRight className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  title="Justify"
                  active={editor.isActive({ textAlign: "justify" })}
                  onClick={() =>
                    editor.chain().focus().setTextAlign("justify").run()
                  }
                >
                  <AlignJustify className="h-4 w-4" />
                </ToolbarButton>
              </div>

              <ToolbarButton
                title="Upload video (≤3 MB)"
                disabled={uploading || disabled}
                onClick={() => videoRef.current?.click()}
              >
                <Video className="h-4 w-4" />
              </ToolbarButton>
              <span className="ml-1 align-middle text-[11px] text-stone-500">
                Video
              </span>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadAndInsert(f, false);
          }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadAndInsert(f, true);
          }}
        />
        {uploading && (
          <span className="ml-1 text-xs font-semibold text-stone-500">
            Working…
          </span>
        )}
      </div>

      <EditorContent editor={editor} />
      {uploadError && (
        <p className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {uploadError}
        </p>
      )}
      <p className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
        Essentials on the bar · font, size, color, align in ⋯ · paste links for
        snapshot cards.
      </p>
    </div>
  );
}
