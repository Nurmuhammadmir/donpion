import { Link, useLocation } from "react-router-dom";

const TAXONOMY_TABS = [
  { to: "/showcase/categories", label: "Категории" },
  { to: "/showcase/characters", label: "Характеры" },
  { to: "/showcase/occasions", label: "Поводы" },
  { to: "/showcase/addons", label: "Допы" },
] as const;

// Mounted at the top of all five Витрина pages so they read as one section.
// "Товары" covers /showcase itself plus the product form (/showcase/new,
// /showcase/:id) — a plain prefix match can't tell those apart from the
// taxonomy routes (same /showcase/<segment> shape), so active state is
// resolved by hand instead of relying on NavLink's built-in matching.
export default function ShowcaseTabs() {
  const { pathname } = useLocation();
  const isTaxonomy = TAXONOMY_TABS.some((tab) => pathname.startsWith(tab.to));

  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto no-scrollbar">
      <Link to="/showcase" className="pill flex-none" data-active={!isTaxonomy}>
        Товары
      </Link>
      {TAXONOMY_TABS.map((tab) => (
        <Link key={tab.to} to={tab.to} className="pill flex-none" data-active={pathname.startsWith(tab.to)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
