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
      <div className="flex min-h-screen bg-canvas">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-none flex-col border-r border-hairline bg-paper px-4 py-6 md:flex">
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

        <div className="flex min-h-screen flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between border-b border-hairline bg-paper px-4 py-3 md:hidden">
            <span className="font-display text-lg font-semibold text-ink">
              DonPion<span className="ml-1 text-xs font-normal text-graphite">CRM</span>
            </span>
            <BranchSwitcher variant="topbar" />
          </header>

          <main className="flex-1 p-4 mobile-nav-spacer md:p-8 md:pb-8">
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
