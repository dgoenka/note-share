"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Heading2,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Video,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { prepareMediaFile } from "@/lib/compress-media";
import { cn } from "@/lib/utils";
import { UploadedVideo } from "@/components/rich-text/uploaded-video";
import { Vimeo, toVimeoEmbed } from "@/components/rich-text/vimeo-embed";

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
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-700 transition hover:bg-stone-200/80 disabled:opacity-40",
        active && "bg-stone-200 text-stone-900"
      )}
    >
      {children}
    </button>
  );
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
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
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
      Placeholder.configure({
        placeholder:
          "Write your note… Paste a YouTube/Vimeo link to embed. Attach images or short videos.",
      }),
    ],
    content: value || "",
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-[12rem] max-h-[28rem] overflow-y-auto px-3 py-2 text-sm leading-relaxed focus:outline-none",
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
          editor
            .chain()
            .focus()
            .setImage({
              src,
              alt: file.name,
            })
            .run();
          // Attach media id on the just-inserted image node
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

  if (!editor) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-8 text-center text-sm text-stone-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white/90 shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-stone-100 bg-stone-50/80 px-1.5 py-1">
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
          title="Strike"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
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
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev || "https://");
            if (url === null) return;
            if (!url) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-stone-200" />
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
          <span className="ml-2 text-xs font-semibold text-stone-500">
            Uploading…
          </span>
        )}
      </div>
      <EditorContent editor={editor} />
      {uploadError && (
        <p className="border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
          {uploadError}
        </p>
      )}
      <p className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
        Paste YouTube or Vimeo URLs to embed. Images are compressed; videos max 3
        MB. Storage quota shown on your profile.
      </p>
    </div>
  );
}
