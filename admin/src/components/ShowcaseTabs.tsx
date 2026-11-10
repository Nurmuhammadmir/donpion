import { Link, useLocation } from "react-router-dom";

const TABS = [
  { to: "/showcase/categories", label: "Категории" },
  { to: "/showcase/occasions", label: "Поводы" },
  { to: "/showcase/addons", label: "Допы" },
] as const;

// Mounted only on these three secondary Витрина pages so admins can hop
// between them directly — Showcase itself no longer needs this strip (it
// IS the main "Товары" page now; see the small "Ещё" links at its own
// bottom instead), and Характеры was retired here entirely: every product
// gets every character automatically now, so there's nothing left to tag.
export default function ShowcaseTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto no-scrollbar">
      {TABS.map((tab) => (
        <Link key={tab.to} to={tab.to} className="pill flex-none" data-active={pathname.startsWith(tab.to)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
