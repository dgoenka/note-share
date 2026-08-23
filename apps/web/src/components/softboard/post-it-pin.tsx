"use client";

import { useRef } from "react";
import type { BoardPin } from "@note-share/shared";
import { cn } from "@/lib/utils";
import type { PinPosition } from "@/lib/softboard-positions";

const COLORS = [
  "bg-[#fff3a3] border-[#e8d56a]",
  "bg-[#ffcce0] border-[#f0a0bd]",
  "bg-[#c8f7c5] border-[#8fd989]",
  "bg-[#e0d4ff] border-[#b9a4ef]",
  "bg-[#cdefff] border-[#8ec8e8]",
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * (i + 1)) % COLORS.length;
  return COLORS[h]!;
}

export function PostItPin({
  pin,
  position,
  onMove,
  onOpen,
}: {
  pin: BoardPin;
  position: PinPosition;
  onMove: (id: string, next: PinPosition) => void;
  onOpen: (pin: BoardPin) => void;
}) {
  const drag = useRef<{
    ox: number;
    oy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const dead = pin.isRevoked || pin.isExpired || pin.isUsed;

  return (
    <button
      type="button"
      className={cn(
        "absolute w-[160px] cursor-grab touch-none rounded-sm border px-3 pb-4 pt-5 text-left shadow-md transition-shadow active:cursor-grabbing",
        colorFor(pin.id),
        dead && "opacity-55 grayscale-[0.35]"
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: `rotate(${position.rot}deg)`,
        zIndex: drag.current ? 40 : 10,
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        drag.current = {
          ox: e.clientX,
          oy: e.clientY,
          startX: position.x,
          startY: position.y,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.ox;
        const dy = e.clientY - drag.current.oy;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
        onMove(pin.id, {
          x: Math.max(8, drag.current.startX + dx),
          y: Math.max(8, drag.current.startY + dy),
          rot: position.rot,
        });
      }}
      onPointerUp={(e) => {
        const wasDrag = drag.current?.moved;
        drag.current = null;
        try {
          (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (!wasDrag) onOpen(pin);
      }}
    >
      <span className="absolute left-1/2 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-rose-500/90 shadow ring-2 ring-white/70" />
      <span className="line-clamp-4 font-display text-sm font-semibold leading-snug text-stone-800">
        {pin.title}
      </span>
      <span className="mt-2 block truncate text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {pin.accessType === "PUBLIC"
          ? "Public"
          : pin.accessType === "PASSWORD"
            ? "Password"
            : "Allowlist"}
        {dead ? " · inactive" : ""}
      </span>
    </button>
  );
}
