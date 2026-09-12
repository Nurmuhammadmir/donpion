import { useEffect, useRef, useState } from "react";
import { api, ApiError, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { AddonCategory } from "@/lib/types";

const emptyForm = {
  name: "",
  image: "",
  sortOrder: "0",
  isActive: true,
};

// Categories of upsell add-ons shown on the product page ("Вазы",
// "Шоколад", …) — a product can be tagged into one or more of these in its
// own card, and then shows up as a suggestion under OTHER products.
export default function AddonCategories() {
  const [categories, setCategories] = useState<AddonCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api<AddonCategory[]>("/addon-categories/admin/all")
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (category: AddonCategory) => {
    setEditingId(category._id);
    setForm({
      name: category.name,
      image: category.image || "",
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    });
    setShowForm(true);
    setError(null);
  };

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const [url] = await uploadProductImages([file], form.name);
      setForm((prev) => ({ ...prev, image: url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      image: form.image,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(`/addon-categories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/addon-categories", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить категорию допов");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить категорию допов?")) return;
    setDeleteError(null);
    try {
      await api(`/addon-categories/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить категорию допов");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Допы (доп. товары)</h1>
          <p className="mt-1 text-sm text-graphite">
            Категории допродаж на карточке товара («Вазы», «Шоколад», «Игрушки»…). Отметьте в
            карточке товара, в какую категорию он входит — он будет предлагаться под ДРУГИМИ
            товарами как доп. покупка.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Добавить категорию
        </button>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать категорию" : "Новая категория"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder="Вазы" />
          </Field>

          <Field label="Мини-фото (показывается на карточке товара)">
            <div className="flex items-center gap-3">
              {form.image && (
                <img src={resolveImageUrl(form.image)} alt="" className="h-16 w-16 rounded-full border border-hairline object-cover" />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary"
              >
                {uploading ? "Загружаем…" : form.image ? "Заменить фото" : "Загрузить фото"}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileSelected}
              className="hidden"
            />
            <p className="mt-2 text-xs text-graphite">
              Необязательно — без фото на сайте покажется обычная иконка.
            </p>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Порядок сортировки">
              <input type="number" value={form.sortOrder} onChange={update("sortOrder")} className="input" />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
              <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
              Активна (видна на сайте)
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
              <th>Категория</th>
              <th>Slug</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category._id}>
                <td>{category.name}</td>
                <td className="text-graphite">/{category.slug}</td>
                <td>{category.isActive ? "Активна" : "Скрыта"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => startEdit(category)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(category._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && categories.length === 0 && <p className="p-6 text-sm text-graphite">Категорий допов пока нет.</p>}
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
