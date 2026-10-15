import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Occasion } from "@/lib/types";

const emptyForm = {
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

// "Поводы" power the homepage section right after the personality quiz
// ("Свадебная флористика", "Корпоративные заказы", …) — tag a product with
// one or more of these in its own card, same mechanism as Характеры.
export default function Occasions() {
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<Occasion[]>("/occasions/admin/all")
      .then(setOccasions)
      .catch(() => setOccasions([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (occasion: Occasion) => {
    setEditingId(occasion._id);
    setForm({
      name: occasion.name,
      description: occasion.description,
      sortOrder: String(occasion.sortOrder),
      isActive: occasion.isActive,
    });
    setShowForm(true);
    setError(null);
  };

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(`/occasions/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/occasions", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить повод");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить повод?")) return;
    setDeleteError(null);
    try {
      await api(`/occasions/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить повод");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Поводы</h1>
          <p className="mt-1 text-sm text-graphite">
            Раздел на главной странице сразу после мини-квиза («Свадебная флористика»,
            «Корпоративные заказы»…). Отметьте в карточке товара, для каких поводов он подходит.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Добавить повод
        </button>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать повод" : "Новый повод"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder="Свадебная флористика" />
          </Field>

          <Field label="Описание">
            <textarea value={form.description} onChange={update("description")} className="input min-h-20" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Порядок сортировки">
              <input type="number" value={form.sortOrder} onChange={update("sortOrder")} className="input" />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
              <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
              Активен (виден на сайте)
            </label>
          </div>

          {error && <p className="text-sm text-hermes-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Повод</th>
              <th>Slug</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {occasions.map((occasion) => (
              <tr key={occasion._id}>
                <td>{occasion.name}</td>
                <td className="text-graphite">/{occasion.slug}</td>
                <td>{occasion.isActive ? "Активен" : "Скрыт"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => startEdit(occasion)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(occasion._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && occasions.length === 0 && <p className="p-6 text-sm text-graphite">Поводов пока нет.</p>}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
        {label}
        {required && <span className="text-hermes-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
