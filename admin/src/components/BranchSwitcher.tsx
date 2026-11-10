import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";

const LONG_PRESS_MS = 450;

// Tap opens it (robust, discoverable, works with mouse/touch/keyboard);
// a long-press does the exact same thing as a bonus accelerator, in the
// spirit of Telegram's long-press account switcher the admin asked for —
// a long-press alone would be unreliable on web (fights scroll/selection
// and isn't discoverable), so it's additive, not the only way in.
function useLongPress(onTrigger: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedByLongPress = useRef(false);

  const start = () => {
    firedByLongPress.current = false;
    timer.current = setTimeout(() => {
      firedByLongPress.current = true;
      onTrigger();
    }, LONG_PRESS_MS);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const onClick = () => {
    if (firedByLongPress.current) {
      firedByLongPress.current = false;
      return;
    }
    onTrigger();
  };

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onClick,
  };
}

export default function BranchSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "topbar" }) {
  const { admin, logout } = useAuth();
  const { branches, isCEO, activeBranchId, activeBranch, setActiveBranchId } = useBranch();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const longPress = useLongPress(() => setOpen((v) => !v));

  const currentLabel = isCEO ? activeBranch?.name ?? "Все филиалы" : activeBranch?.name ?? "—";
  const initial = (admin?.name || admin?.email || "?").trim().charAt(0).toUpperCase();

  const close = () => setOpen(false);

  const go = (path: string) => {
    close();
    navigate(path);
  };

  const handleLogout = () => {
    close();
    if (window.confirm("Вы уверены, что хотите выйти?")) logout();
  };

  return (
    <div className="relative">
      <button
        type="button"
        {...longPress}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-3 rounded-md border border-hairline bg-paper px-3 py-2.5 text-left transition-colors hover:border-ink"
            : "flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5 text-left transition-colors hover:border-ink"
        }
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate text-sm font-medium text-ink">{currentLabel}</span>
          {variant === "sidebar" && <span className="block truncate text-xs text-graphite">{admin?.name}</span>}
        </span>
        {isCEO && <ChevronsUpDown className="h-4 w-4 flex-none text-graphite" />}
      </button>

      {open && (
        <>
          <div className="anim-backdrop fixed inset-0 z-40 bg-ink/30" onClick={close} />
          <div
            className={
              variant === "sidebar"
                ? "anim-dropdown absolute left-0 top-full z-50 mt-2 w-full border border-hairline bg-paper"
                : "anim-sheet fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-paper md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-72 md:border"
            }
          >
            <div className="border-b border-hairline px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">{admin?.name}</p>
              <p className="truncate text-xs text-graphite">{admin?.email}</p>
            </div>

            {isCEO ? (
              <div className="max-h-64 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveBranchId(null);
                    close();
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-canvas"
                >
                  <Building2 className="h-4 w-4 flex-none text-graphite" />
                  <span className="flex-1">Все филиалы</span>
                  {activeBranchId === null && <Check className="h-4 w-4 flex-none text-hermes-600" />}
                </button>
                {branches.map((b) => (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => {
                      setActiveBranchId(b._id);
                      close();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-canvas"
                  >
                    <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-hermes-100 text-[10px] font-semibold text-hermes-700">
                      {b.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">
                      {b.name}
                      {b.isMain && <span className="ml-1.5 text-xs text-graphite">(основной)</span>}
                    </span>
                    {activeBranchId === b._id && <Check className="h-4 w-4 flex-none text-hermes-600" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-graphite">Ваш филиал: {activeBranch?.name ?? "—"}</div>
            )}

            <div className="border-t border-hairline py-1">
              {isCEO && (
                <button
                  type="button"
                  onClick={() => go("/branches")}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-graphite hover:bg-canvas hover:text-ink"
                >
                  <Settings className="h-4 w-4 flex-none" />
                  Филиалы и настройки
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-graphite hover:bg-hermes-50 hover:text-hermes-600"
              >
                <LogOut className="h-4 w-4 flex-none" />
                Выйти
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
