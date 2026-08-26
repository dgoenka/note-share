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
  Check,
  ChevronDown,
  Globe,
  Heading,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Strikethrough,
  Type,
  Underline as UnderlineIcon,
  Video,
  X,
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

function keepSelection(e: React.SyntheticEvent) {
  e.preventDefault();
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  title,
  className,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-700 transition hover:bg-stone-200/80 active:bg-stone-200 disabled:opacity-40",
        active && "bg-stone-200/90 text-stone-900 font-semibold",
        className
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

  // Popover menus
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [linkBarOpen, setLinkBarOpen] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
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
        placeholder: "Write your note… Paste links for preview cards.",
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "note-editor-prose min-h-[12rem] max-h-[28rem] overflow-y-auto px-4 py-3 text-sm leading-relaxed focus:outline-none",
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

  // Click outside listener for dropdowns
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (
        blockMenuOpen &&
        !blockMenuRef.current?.contains(e.target as Node)
      ) {
        setBlockMenuOpen(false);
      }
      if (
        styleMenuOpen &&
        !styleMenuRef.current?.contains(e.target as Node)
      ) {
        setStyleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [blockMenuOpen, styleMenuOpen]);

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

  const openLinkBar = useCallback(() => {
    if (!editor) return;
    rememberSelection();
    const existingHref = (editor.getAttributes("link").href as string) || "";
    setLinkInputUrl(existingHref);
    setLinkBarOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 50);
  }, [editor, rememberSelection]);

  const applyInlineLink = useCallback(() => {
    if (!editor) return;
    const raw = linkInputUrl.trim();
    if (!raw) {
      editor.chain().focus().unsetLink().run();
      setLinkBarOpen(false);
      onChange(editor.getHTML());
      return;
    }
    const targetUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: targetUrl }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(
          `<p><a href="${targetUrl}" target="_blank" rel="noopener noreferrer">${targetUrl}</a></p>`
        )
        .run();
    }
    setLinkBarOpen(false);
    setLinkInputUrl("");
    onChange(editor.getHTML());
  }, [editor, linkInputUrl, onChange]);

  const applyCardPreview = useCallback(() => {
    const raw = linkInputUrl.trim();
    if (!raw) return;
    setLinkBarOpen(false);
    setLinkInputUrl("");
    void insertLinkPreview(raw);
  }, [linkInputUrl, insertLinkPreview]);

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

  const blockStyleLabel =
    blockStyle === "h1"
      ? "Heading 1"
      : blockStyle === "h2"
        ? "Heading 2"
        : blockStyle === "h3"
          ? "Heading 3"
          : "Text";

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {/* Primary Toolbar Bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 bg-stone-50/90 px-2 py-1.5 sm:gap-1.5">
        {/* 1. Block Style Selector */}
        <div className="relative" ref={blockMenuRef}>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={keepSelection}
            onClick={() => {
              rememberSelection();
              setBlockMenuOpen((v) => !v);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:bg-stone-100 active:scale-95 disabled:opacity-40",
              blockMenuOpen && "border-stone-400 bg-stone-100"
            )}
            title="Text formatting style"
          >
            <Heading className="h-3.5 w-3.5 text-stone-500" />
            <span>{blockStyleLabel}</span>
            <ChevronDown className="h-3 w-3 text-stone-400" />
          </button>
          {blockMenuOpen && (
            <div className="absolute left-0 top-full z-40 mt-1 w-36 rounded-xl border border-stone-200 bg-white p-1 shadow-xl animate-in fade-in zoom-in-95">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-100",
                  blockStyle === "p" && "bg-stone-100 font-bold text-stone-900"
                )}
                onClick={() => {
                  restoreSelection();
                  withPreservedSelection(editor, () => {
                    editor.chain().focus().setParagraph().run();
                  });
                  setBlockMenuOpen(false);
                  onChange(editor.getHTML());
                }}
              >
                <span>Normal text</span>
                {blockStyle === "p" && <Check className="h-3.5 w-3.5 text-stone-800" />}
              </button>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-100",
                  blockStyle === "h1" && "bg-stone-100 font-bold text-stone-900"
                )}
                onClick={() => {
                  restoreSelection();
                  withPreservedSelection(editor, () => {
                    editor.chain().focus().setHeading({ level: 1 }).run();
                  });
                  setBlockMenuOpen(false);
                  onChange(editor.getHTML());
                }}
              >
                <span className="text-sm">Heading 1</span>
                {blockStyle === "h1" && <Check className="h-3.5 w-3.5 text-stone-800" />}
              </button>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100",
                  blockStyle === "h2" && "bg-stone-100 font-bold text-stone-900"
                )}
                onClick={() => {
                  restoreSelection();
                  withPreservedSelection(editor, () => {
                    editor.chain().focus().setHeading({ level: 2 }).run();
                  });
                  setBlockMenuOpen(false);
                  onChange(editor.getHTML());
                }}
              >
                <span>Heading 2</span>
                {blockStyle === "h2" && <Check className="h-3.5 w-3.5 text-stone-800" />}
              </button>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100",
                  blockStyle === "h3" && "bg-stone-100 font-bold text-stone-900"
                )}
                onClick={() => {
                  restoreSelection();
                  withPreservedSelection(editor, () => {
                    editor.chain().focus().setHeading({ level: 3 }).run();
                  });
                  setBlockMenuOpen(false);
                  onChange(editor.getHTML());
                }}
              >
                <span>Heading 3</span>
                {blockStyle === "h3" && <Check className="h-3.5 w-3.5 text-stone-800" />}
              </button>
            </div>
          )}
        </div>

        <span className="mx-0.5 h-4 w-px bg-stone-200" />

        {/* 2. Inline Formatting Marks */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            title="Bold (⌘B)"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic (⌘I)"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline (⌘U)"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Strikethrough"
            active={editor.isActive("strike")}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Highlight"
            active={editor.isActive("highlight")}
            onClick={() =>
              editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()
            }
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <span className="mx-0.5 h-4 w-px bg-stone-200" />

        {/* 3. Lists & Alignments */}
        <div className="flex items-center gap-0.5">
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
            title="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-4 w-4" />
          </ToolbarButton>
        </div>

        <span className="mx-0.5 h-4 w-px bg-stone-200" />

        {/* 4. Inserts (Link / Image / Video) */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            title="Add link or preview card"
            active={linkBarOpen || editor.isActive("link")}
            onClick={openLinkBar}
          >
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Upload image"
            disabled={uploading || disabled}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            title="Upload video (≤3 MB)"
            disabled={uploading || disabled}
            onClick={() => videoRef.current?.click()}
          >
            <Video className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* 5. Typography & Color Palettes Popover */}
        <div className="relative ml-auto" ref={styleMenuRef}>
          <ToolbarButton
            title="Typography and text color"
            active={styleMenuOpen}
            disabled={disabled}
            onClick={() => {
              rememberSelection();
              setStyleMenuOpen((v) => !v);
            }}
          >
            <Palette className="h-4 w-4 text-amber-900" />
          </ToolbarButton>
          {styleMenuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-stone-200 bg-white p-3 shadow-xl animate-in fade-in zoom-in-95">
              <div className="mb-3 space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    <Type className="h-3 w-3" /> Font Family
                  </span>
                  <select
                    aria-label="Font family"
                    className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-xs font-medium text-stone-800"
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

                <label className="flex flex-col gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    <ALargeSmall className="h-3 w-3" /> Font Size
                  </span>
                  <select
                    aria-label="Font size"
                    className="h-8 rounded-lg border border-stone-200 bg-stone-50 px-2 text-xs font-medium text-stone-800"
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

              <div>
                <span className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  <Palette className="h-3 w-3" /> Text Color
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      className={cn(
                        "h-6 w-6 rounded-full ring-1 ring-stone-300 transition hover:scale-110",
                        currentColor === c && "ring-2 ring-stone-800 ring-offset-2"
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
      </div>

      {/* Inline Link Toolbar Bar */}
      {linkBarOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs animate-in slide-in-from-top-1">
          <Link2 className="h-4 w-4 shrink-0 text-amber-800" />
          <input
            ref={linkInputRef}
            type="url"
            placeholder="Paste or enter link URL (e.g. https://...)"
            value={linkInputUrl}
            onChange={(e) => setLinkInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyInlineLink();
              } else if (e.key === "Escape") {
                setLinkBarOpen(false);
              }
            }}
            className="h-8 min-w-[14rem] flex-1 rounded-lg border border-amber-300 bg-white px-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={applyInlineLink}
              className="inline-flex h-8 items-center rounded-lg bg-[var(--primary)] px-3 font-semibold text-white shadow-sm transition hover:bg-[#4a3125] active:scale-95"
            >
              Link text
            </button>
            <button
              type="button"
              onClick={applyCardPreview}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-900/20 bg-white px-3 font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100/70 active:scale-95"
            >
              <Globe className="h-3.5 w-3.5 text-amber-800" />
              Preview card
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setLinkBarOpen(false);
                  onChange(editor.getHTML());
                }}
                className="h-8 rounded-lg px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Remove link
              </button>
            )}
            <button
              type="button"
              onClick={() => setLinkBarOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-amber-200/60 hover:text-stone-900"
              aria-label="Close link toolbar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="relative">
        <EditorContent editor={editor} />
        {uploading && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full bg-stone-900/80 px-3 py-1 text-xs font-medium text-white shadow backdrop-blur-sm">
            <div className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
            Working…
          </div>
        )}
      </div>

      {uploadError && (
        <div className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          {uploadError}
        </div>
      )}
    </div>
  );
}
