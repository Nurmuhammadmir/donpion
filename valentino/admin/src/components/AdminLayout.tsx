import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/", label: "Обзор", end: true },
  { to: "/products", label: "Товары" },
  { to: "/warehouse", label: "Склад" },
  { to: "/categories", label: "Категории" },
  { to: "/characters", label: "Характеры" },
  { to: "/addon-categories", label: "Допы" },
  { to: "/occasions", label: "Поводы" },
  { to: "/orders", label: "Заказы" },
  { to: "/branches", label: "Филиалы" },
  { to: "/settings", label: "Главная страница" },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm("Вы уверены, что хотите выйти?")) {
      logout();
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-hermes-500 px-4 py-6">
        <div className="mb-8 px-2 font-serif text-lg font-semibold text-white">
          Valentino
          <span className="ml-1 text-xs font-normal text-white/70">админ</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-hermes-700" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/20 pt-4">
          <p className="px-2 text-xs text-white/70">{admin?.email}</p>
          <button type="button" onClick={handleLogout} className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white">
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-canvas p-8">
        <Outlet />
      </main>
    </div>
  );
}
