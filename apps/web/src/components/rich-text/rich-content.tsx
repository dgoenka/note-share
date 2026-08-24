"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import { cn } from "@/lib/utils";

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
        // If no src yet, inject one
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
        "allow",
        "allowfullscreen",
        "frameborder",
        "target",
        "data-media-id",
        "controls",
      ],
    });
  }, [html, mediaUrls]);

  return (
    <div
      className={cn(
        "rich-content prose prose-stone max-w-none text-sm leading-relaxed text-stone-800",
        "[&_img]:my-3 [&_img]:max-h-96 [&_img]:rounded-lg [&_img]:border [&_img]:border-stone-200",
        "[&_video]:my-3 [&_video]:max-h-96 [&_video]:w-full [&_video]:rounded-lg",
        "[&_iframe]:my-3 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:rounded-lg",
        "[&_a]:text-[var(--accent)] [&_a]:underline",
        "[&_.link-preview]:my-3",
        className
      )}
      dangerouslySetInnerHTML={{ __html: hydrated }}
    />
  );
}
