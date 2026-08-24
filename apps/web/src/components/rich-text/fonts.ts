/** Curated fonts available in the TipTap editor (loaded via Google Fonts). */
export const NOTE_FONTS = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "DM Sans", value: '"DM Sans", sans-serif' },
  { label: "Space Grotesk", value: '"Space Grotesk", sans-serif' },
  { label: "Fraunces", value: "Fraunces, serif" },
  { label: "Playfair", value: '"Playfair Display", serif' },
  { label: "Lora", value: "Lora, serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Bebas Neue", value: '"Bebas Neue", sans-serif' },
  { label: "Pacifico", value: "Pacifico, cursive" },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
  { label: "Roboto Mono", value: '"Roboto Mono", monospace' },
] as const;

export const NOTE_FONT_SIZES = [
  { label: "S", value: "12px" },
  { label: "M", value: "14px" },
  { label: "Body", value: "16px" },
  { label: "L", value: "18px" },
  { label: "XL", value: "24px" },
  { label: "XXL", value: "32px" },
] as const;

/** Google Fonts CSS2 URL for the palette (excludes ones already in layout). */
export const NOTE_FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@400;600;700",
    "family=DM+Sans:wght@400;600;700",
    "family=Space+Grotesk:wght@400;600;700",
    "family=Playfair+Display:wght@400;600;700",
    "family=Lora:wght@400;600;700",
    "family=Merriweather:wght@400;700",
    "family=Bebas+Neue",
    "family=Pacifico",
    "family=Roboto+Mono:wght@400;600",
  ].join("&") +
  "&display=swap";
