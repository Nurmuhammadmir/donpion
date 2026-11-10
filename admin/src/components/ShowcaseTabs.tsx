import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const TABS = [
  { to: "/showcase/categories", label: "Категории" },
  { to: "/showcase/occasions", label: "Поводы" },
  { to: "/showcase/addons", label: "Допы" },
] as const;

// Mounted on these three secondary Витрина pages (so admins can hop
// between them directly) and on ProductForm — Showcase itself no longer
// needs this strip (it IS the main "Товары" page now). Характеры was
// retired here entirely: every product gets every character automatically
// now, so there's nothing left to tag. The leading "Витрина" link is the
// only way back to the product grid from any of these pages — none of
// them are reachable from the main nav, only from here or ProductForm.
export default function ShowcaseTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
      <Link
        to="/showcase"
        className="flex flex-none items-center gap-1 pr-2 text-sm text-graphite transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Витрина
      </Link>
      <span className="h-4 flex-none border-l border-hairline" />
      {TABS.map((tab) => (
        <Link key={tab.to} to={tab.to} className="pill flex-none" data-active={pathname.startsWith(tab.to)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
