"use client";

import { useEffect, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";
import { NOTE_FONTS_STYLESHEET } from "@/components/rich-text/fonts";

/**
 * Render sanitized note HTML and hydrate private media via signed URLs.
 * Elements with data-media-id get src rewritten from mediaUrls.
 */
export function RichContent({
  html,
  mediaUrls,
  className,
}: {
  html: string;
  mediaUrls?: Record<string, string> | null;
  className?: string;
}) {
  useEffect(() => {
    const id = "note-share-editor-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = NOTE_FONTS_STYLESHEET;
    document.head.appendChild(link);
  }, []);

  const hydrated = useMemo(() => {
    let next = html || "";
    if (mediaUrls) {
      for (const [id, url] of Object.entries(mediaUrls)) {
        const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        next = next.replace(
          new RegExp(
            `(<(?:img|video)[^>]*data-media-id=["']${safeId}["'][^>]*?)\\ssrc=["'][^"']*["']`,
            "gi"
          ),
          `$1 src="${url}"`
        );
        next = next.replace(
          new RegExp(
            `(<(?:img|video)(?![^>]*\\ssrc=)[^>]*data-media-id=["']${safeId}["'][^>]*)(>)`,
            "gi"
          ),
          `$1 src="${url}"$2`
        );
      }
    }
    return DOMPurify.sanitize(next, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: [
        "style",
        "class",
        "allow",
        "allowfullscreen",
        "frameborder",
        "target",
        "rel",
        "data-media-id",
        "data-link-preview",
        "data-url",
        "data-title",
        "data-description",
        "data-image",
        "data-site",
        "controls",
        "loading",
        "referrerpolicy",
      ],
    });
  }, [html, mediaUrls]);

  return (
    <div
      className={cn(
        "rich-content max-w-none text-sm leading-relaxed text-stone-800",
        "[&_img:not(.link-preview-image)]:my-3 [&_img:not(.link-preview-image)]:max-h-96 [&_img:not(.link-preview-image)]:rounded-lg [&_img:not(.link-preview-image)]:border [&_img:not(.link-preview-image)]:border-stone-200",
        "[&_video]:my-3 [&_video]:max-h-96 [&_video]:w-full [&_video]:rounded-lg",
        "[&_iframe]:my-3 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-lg",
        "[&_a:not(.link-preview-card)]:text-[var(--accent)] [&_a:not(.link-preview-card)]:underline",
        "[&_.link-preview]:my-3",
        className
      )}
      dangerouslySetInnerHTML={{ __html: hydrated }}
    />
  );
}
