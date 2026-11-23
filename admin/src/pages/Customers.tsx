import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { getCustomers, getUpcomingDates } from "@/lib/api";
import type { Customer, UpcomingDate } from "@/lib/types";
import { Skeleton } from "@/components/Skeleton";

const PAGE_SIZE = 30;

function formatPhone(phone: string) {
  return phone;
}

// "Скоро даты" (ТЗ 2.3) — a quick glance at who to call/message in the
// next few days, right above the search box since that's the part meant
// to be checked routinely, not dug for.
function UpcomingDatesWidget() {
  const [upcoming, setUpcoming] = useState<UpcomingDate[] | null>(null);

  useEffect(() => {
    getUpcomingDates(3)
      .then((data) => setUpcoming(data as UpcomingDate[]))
      .catch(() => setUpcoming([]));
  }, []);

  if (upcoming === null) {
    return (
      <div className="card space-y-2 p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    );
  }
  if (upcoming.length === 0) return null;

  return (
    <div className="card">
      <p className="eyebrow">Скоро даты · 3 дня</p>
      <div className="mt-3 space-y-2.5">
        {upcoming.map((u, i) => (
          <Link
            key={`${u.customerId}-${i}`}
            to={`/customers/${u.customerId}`}
            className="flex items-center justify-between gap-3 text-sm hover:text-hermes-600"
          >
            <span className="min-w-0 truncate">
              {u.occasion}
              {u.recipient ? ` (${u.recipient})` : ""} — {u.name}
            </span>
            <span className="flex-none text-xs text-graphite">
              {u.inDays === 0 ? "сегодня" : u.inDays === 1 ? "завтра" : `через ${u.inDays} дн.`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      getCustomers({ search: search.trim() || undefined, page, limit: PAGE_SIZE })
        .then((res) => {
          const data = res as { items: Customer[]; total: number; pages: number };
          setItems(data.items);
          setTotal(data.total);
          setPages(Math.max(1, data.pages));
        })
        .catch(() => {
          setItems([]);
          setTotal(0);
          setPages(1);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search, page]);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Клиенты</h1>
      <p className="mt-1 text-sm text-graphite">{loading ? "Загрузка…" : `${total} клиентов`}</p>

      <div className="mt-5">
        <UpcomingDatesWidget />
      </div>

      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Поиск по имени или телефону…"
        className="input mt-5 max-w-sm"
      />

      <div className="mt-4 space-y-2 md:hidden">
        {items.map((customer) => (
          <Link key={customer._id} to={`/customers/${customer._id}`} className="card flex items-center gap-3 p-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-hermes-50 text-hermes-600">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{customer.name}</p>
              <p className="text-xs text-graphite">{formatPhone(customer.phone)}</p>
            </div>
          </Link>
        ))}
        {loading &&
          items.length === 0 &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        {!loading && items.length === 0 && <p className="card text-sm text-graphite">Клиентов не найдено.</p>}
      </div>

      <div className="mt-4 hidden overflow-x-auto card p-0 md:block">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Телефон</th>
              <th>Пионы</th>
              <th>Даты</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((customer) => (
              <tr key={customer._id}>
                <td>{customer.name}</td>
                <td>{formatPhone(customer.phone)}</td>
                <td>{customer.pointsBalance}</td>
                <td>{customer.importantDates.length || "—"}</td>
                <td className="text-right">
                  <Link to={`/customers/${customer._id}`} className="text-sm text-sapphire-600 hover:underline">
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {loading &&
              items.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="p-6 text-sm text-graphite">Клиентов не найдено.</p>}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-graphite">
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary disabled:opacity-40">
            Назад
          </button>
          <span>
            {page} из {pages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pages} className="btn-secondary disabled:opacity-40">
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
