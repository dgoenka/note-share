import imageCompression from "browser-image-compression";
import { MEDIA_MAX_BYTES_PER_FILE } from "@note-share/shared";

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export type PreparedMedia = {
  file: File;
  kind: "IMAGE" | "VIDEO";
};

export async function prepareMediaFile(file: File): Promise<PreparedMedia> {
  if (IMAGE_TYPES.has(file.type)) {
    if (file.type === "image/gif") {
      if (file.size > MEDIA_MAX_BYTES_PER_FILE) {
        throw new Error("GIF must be under 3 MB (animation is not re-compressed)");
      }
      return { file, kind: "IMAGE" };
    }
    const compressed = await imageCompression(file, {
      maxSizeMB: 2.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type === "image/png" ? "image/png" : "image/webp",
    });
    const out =
      compressed.size > MEDIA_MAX_BYTES_PER_FILE
        ? await imageCompression(file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
            fileType: "image/jpeg",
          })
        : compressed;
    if (out.size > MEDIA_MAX_BYTES_PER_FILE) {
      throw new Error("Could not compress image under 3 MB");
    }
    return {
      file: new File([out], file.name.replace(/\.\w+$/, "") + ".jpg", {
        type: out.type || "image/jpeg",
      }),
      kind: "IMAGE",
    };
  }

  if (VIDEO_TYPES.has(file.type)) {
    if (file.size > MEDIA_MAX_BYTES_PER_FILE) {
      throw new Error(
        "Video must be under 3 MB (trim/compress locally before upload)"
      );
    }
    return { file, kind: "VIDEO" };
  }

  throw new Error("Unsupported file type. Use JPEG/PNG/WebP/GIF or MP4/WebM.");
}
