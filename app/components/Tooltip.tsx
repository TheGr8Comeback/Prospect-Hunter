import type { ReactNode } from "react";

// Pure-CSS hover tooltip — works in server components (no client JS).
// Wrap anything; it shows `text` on hover/focus.
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center align-middle group/tip">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[260px]
                   -translate-x-1/2 whitespace-normal rounded-md border border-white/10 bg-neutral-900
                   px-2.5 py-1.5 text-[11px] leading-snug text-white/80 opacity-0 shadow-lg
                   transition-opacity duration-100 group-hover/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

// A little "ⓘ" trigger next to a label. `text` is the explanation.
export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip text={text}>
      <span
        tabIndex={0}
        className="ml-1 cursor-help text-[10px] text-white/25 hover:text-white/60 transition-colors"
        aria-label={text}
      >
        ⓘ
      </span>
    </Tooltip>
  );
}
