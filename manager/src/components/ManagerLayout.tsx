import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Inbox, LogOut, ShoppingCart, Warehouse } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getBranches } from "@/lib/api";

// Only 3 sections — no BranchSwitcher/GlobalSearch/BranchProvider like
// admin/'s AdminLayout: a manager has exactly one branch (server-forced,
// never a UI choice) and nothing here to search across.
const NAV = [
  { to: "/", label: "Лиды", icon: Inbox, end: true },
  { to: "/stock", label: "Склад", icon: Warehouse, end: false },
  { to: "/sell", label: "Продажа", icon: ShoppingCart, end: false },
] as const;

export default function ManagerLayout() {
  const { manager, logout } = useAuth();
  const [branchName, setBranchName] = useState<string | null>(null);

  useEffect(() => {
    if (!manager) return;
    getBranches()
      .then((branches) => setBranchName(branches.find((b) => b._id === manager.branch)?.name ?? null))
      .catch(() => setBranchName(null));
  }, [manager]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-none flex-col overflow-y-auto border-r border-hairline bg-paper px-4 py-6 md:flex">
        <div className="mb-1 px-1">
          <span className="font-display text-xl font-semibold text-ink">DonPion</span>
          <span className="ml-1.5 text-xs text-graphite">Менеджер</span>
        </div>
        <p className="mb-6 px-1 text-xs text-graphite">{branchName ?? "—"}</p>

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
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-graphite transition-colors hover:bg-hermes-50 hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px] flex-none" />
            Выйти
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="z-20 flex flex-none items-center justify-between border-b border-hairline bg-paper px-4 py-3 md:hidden">
          <span className="font-display text-lg font-semibold text-ink">
            DonPion<span className="ml-1 text-xs font-normal text-graphite">Менеджер</span>
          </span>
          <span className="text-xs text-graphite">{branchName ?? "—"}</span>
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
          <button
            type="button"
            onClick={logout}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-graphite"
          >
            <LogOut className="h-5 w-5" />
            Выйти
          </button>
        </nav>
      </div>
    </div>
  );
}
