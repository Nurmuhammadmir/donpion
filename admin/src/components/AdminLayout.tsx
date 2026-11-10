import { NavLink, Outlet } from "react-router-dom";
import { ClipboardList, Flower2, LayoutDashboard, Settings, Wallet, Warehouse } from "lucide-react";
import BranchSwitcher from "@/components/BranchSwitcher";
import { BranchProvider } from "@/context/BranchContext";

// The five sections the whole admin is organized around — same set, same
// order, on the desktop sidebar and the mobile bottom tab bar, so the app
// reads as one product instead of two separate layouts.
const NAV = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard, end: true },
  { to: "/showcase", label: "Витрина", icon: Flower2, end: false },
  { to: "/orders", label: "Заказы", icon: ClipboardList, end: false },
  { to: "/finance", label: "Финансы", icon: Wallet, end: false },
  { to: "/warehouse", label: "Склад", icon: Warehouse, end: false },
] as const;

export default function AdminLayout() {
  return (
    <BranchProvider>
      {/* h-screen + overflow-hidden on the whole shell, instead of the old
          min-h-screen (which just grows with content): a page taller than
          the viewport used to scroll the *document*, taking the sidebar
          and header — which are just ordinary flex children, not actually
          pinned to anything — along with it. Now <main> below is the only
          scrolling element; the chrome around it never moves, like a real
          app shell instead of a long webpage. */}
      <div className="flex h-screen overflow-hidden bg-canvas">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-none flex-col overflow-y-auto border-r border-hairline bg-paper px-4 py-6 md:flex">
          <div className="mb-6 px-1">
            <span className="font-display text-xl font-semibold text-ink">DonPion</span>
            <span className="ml-1.5 text-xs text-graphite">CRM</span>
          </div>

          <div className="mb-6">
            <BranchSwitcher variant="sidebar" />
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-navy text-white" : "text-graphite hover:bg-hermes-50 hover:text-ink"
                  }`
                }
              >
                <item.icon className="h-[18px] w-[18px] flex-none" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-hairline pt-3">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-canvas text-ink" : "text-graphite hover:bg-hermes-50 hover:text-ink"
                }`
              }
            >
              <Settings className="h-[18px] w-[18px] flex-none" />
              Настройки сайта
            </NavLink>
          </div>
        </aside>

        {/* min-w-0 (horizontal) for the same reason as before — a wide
            table anywhere shouldn't force this column past the viewport.
            min-h-0 (vertical) is its scroll-axis equivalent: a flex column
            child defaults to min-height:auto, which refuses to shrink
            below its content's height — without min-h-0 here, <main>'s
            own overflow-y-auto below would never actually kick in, since
            this wrapper would just grow to fit it instead of clipping it. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Mobile top bar — no longer just an ordinary flow element: it
              needs to stay put while <main> scrolls past underneath it. */}
          <header className="z-20 flex flex-none items-center justify-between border-b border-hairline bg-paper px-4 py-3 md:hidden">
            <span className="font-display text-lg font-semibold text-ink">
              DonPion<span className="ml-1 text-xs font-normal text-graphite">CRM</span>
            </span>
            <BranchSwitcher variant="topbar" />
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 mobile-nav-spacer md:p-8 md:pb-8">
            <Outlet />
          </main>

          {/* Mobile bottom tab bar */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-hairline bg-paper mobile-nav-height md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium ${
                    isActive ? "text-hermes-600" : "text-graphite"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </BranchProvider>
  );
}
