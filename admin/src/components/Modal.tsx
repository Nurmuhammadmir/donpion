import type { ReactNode } from "react";

// The one modal shell for the whole admin — anything that used to appear
// inline (pushing the rest of the page down with a sudden jump) opens in
// this instead: an overlay on top of what's already there, not a layout
// shift. Full-screen-on-mobile/centered-on-desktop, same split
// QuickSaleModal already used, now shared instead of re-implemented per
// page. Esc and a backdrop click both close it.
export default function Modal({
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center anim-backdrop bg-ink/30 sm:items-center sm:p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className={`anim-modal max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-paper p-5 shadow-lg sm:rounded-2xl sm:p-6 ${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
