import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, resolveImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(amount)} сум`;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : "?limit=100";
    api<{ items: Product[] }>(`/products/admin/all${qs}`)
      .then((res) => setProducts(res.items))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить товар без возможности восстановления?")) return;
    setDeleteError(null);
    try {
      await api(`/products/${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      // Without this, a rejected DELETE (permission error, network blip)
      // was an unhandled promise rejection — the admin confirms the
      // browser dialog and nothing visibly happens, no explanation.
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить товар");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Товары</h1>
        <Link to="/products/new" className="btn-primary">
          + Добавить товар
        </Link>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию…"
          className="input max-w-xs"
        />
        <button type="submit" className="btn-secondary">
          Найти
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Остаток</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id}>
                <td className="flex items-center gap-3">
                  <img src={resolveImageUrl(p.images[0])} alt="" className="h-10 w-10 rounded-md object-cover" />
                  <span>{p.name}</span>
                </td>
                <td>{p.category?.name ?? "—"}</td>
                <td>{formatUZS(p.price)}</td>
                <td>{p.stock}</td>
                <td>{p.isActive ? "Активен" : "Скрыт"}</td>
                <td className="text-right">
                  <Link to={`/products/${p._id}`} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </Link>
                  <button type="button" onClick={() => handleDelete(p._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && products.length === 0 && (
          <p className="p-6 text-sm text-graphite">Товары не найдены.</p>
        )}
      </div>
    </div>
  );
}
