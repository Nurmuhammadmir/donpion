import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import LocationPicker from "@/components/LocationPicker";

const emptyForm = {
  name: "",
  address: "",
  lat: null as number | null,
  lng: null as number | null,
  phone: "",
  workingHours: "",
  isActive: true,
};

// "Филиалы" (branches) — physical shop locations shown as pins on the
// storefront footer map, and used as directions destinations. Each is
// placed by clicking the map here rather than typing coordinates by hand.
export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<Branch[]>("/branches/admin/all")
      .then(setBranches)
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (branch: Branch) => {
    setEditingId(branch._id);
    setForm({
      name: branch.name,
      address: branch.address,
      lat: branch.lat,
      lng: branch.lng,
      phone: branch.phone,
      workingHours: branch.workingHours,
      isActive: branch.isActive,
    });
    setShowForm(true);
    setError(null);
  };

  const update =
    (field: "name" | "address" | "phone" | "workingHours") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.lat === null || form.lng === null) {
      setError("Укажите местоположение на карте");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      phone: form.phone,
      workingHours: form.workingHours,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(`/branches/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/branches", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить филиал");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить филиал?")) return;
    setDeleteError(null);
    try {
      await api(`/branches/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить филиал");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Филиалы</h1>
          <p className="mt-1 text-sm text-graphite">
            Точки на карте в подвале сайта — клиенты видят их местоположение и могут открыть
            маршрут в Google или Яндекс Картах.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Добавить филиал
        </button>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать филиал" : "Новый филиал"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder="DonPion на Мукими" />
          </Field>

          <Field label="Адрес" required>
            <input required value={form.address} onChange={update("address")} className="input" placeholder="ул. Мукими, 12" />
          </Field>

          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
              Местоположение на карте <span className="text-hermes-500">*</span>
            </span>
            <LocationPicker
              lat={form.lat}
              lng={form.lng}
              onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
            />
            {form.lat !== null && form.lng !== null && (
              <p className="mt-1.5 text-xs text-graphite">
                {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Телефон">
              <input value={form.phone} onChange={update("phone")} className="input" placeholder="+998 71 200-00-00" />
            </Field>
            <Field label="Часы работы">
              <input value={form.workingHours} onChange={update("workingHours")} className="input" placeholder="8:00–22:00" />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Активен (виден на сайте)
          </label>

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
              <th>Филиал</th>
              <th>Адрес</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch._id}>
                <td>{branch.name}</td>
                <td className="text-graphite">{branch.address}</td>
                <td>{branch.isActive ? "Активен" : "Скрыт"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => startEdit(branch)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(branch._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && branches.length === 0 && <p className="p-6 text-sm text-graphite">Филиалов пока нет.</p>}
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
