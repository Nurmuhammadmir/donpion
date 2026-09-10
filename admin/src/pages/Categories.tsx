import { useRef, useEffect, useState } from "react";
import { api, ApiError, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { Category } from "@/lib/types";

const emptyForm = {
  name: "",
  shortDescription: "",
  introText: "",
  seoTitle: "",
  seoDescription: "",
  image: "",
  sortOrder: "0",
  isActive: true,
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api<Category[]>("/categories/admin/all")
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

  const startEdit = (cat: Category) => {
    setEditingId(cat._id);
    setForm({
      name: cat.name,
      shortDescription: cat.shortDescription,
      introText: cat.introText,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
      image: cat.image,
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
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

    // Slug is intentionally not sent — the server always derives it from
    // the name, so admins never have to manage URLs by hand.
    const payload = {
      name: form.name,
      shortDescription: form.shortDescription,
      introText: form.introText,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      image: form.image,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await api(`/categories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/categories", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить категорию");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить категорию?")) return;
    setDeleteError(null);
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      // The server now rejects deleting a category still referenced by
      // products (400) — without this, that rejection (and any other
      // delete failure) was silent: the admin confirms the dialog and
      // nothing visibly happens.
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить категорию");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Категории</h1>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Добавить категорию
        </button>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать категорию" : "Новая категория"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" />
          </Field>

          <Field label="Короткое описание" required>
            <input required value={form.shortDescription} onChange={update("shortDescription")} className="input" />
          </Field>

          <Field label="Вводный текст на странице категории (уникальный для SEO)" required>
            <textarea required value={form.introText} onChange={update("introText")} className="input min-h-28" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SEO Title" required>
              <input required value={form.seoTitle} onChange={update("seoTitle")} className="input" />
            </Field>
            <Field label="SEO Description" required>
              <input required value={form.seoDescription} onChange={update("seoDescription")} className="input" />
            </Field>
          </div>

          <Field label="Фото категории" required>
            <div className="flex items-center gap-3">
              {form.image && (
                <img src={resolveImageUrl(form.image)} alt="" className="h-16 w-16 rounded-lg border border-hairline object-cover" />
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
            <p className="mt-2 text-xs text-graphite">Загружается с устройства — сервер сам сожмёт фото.</p>
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
            <button type="submit" disabled={saving || uploading || !form.image} className="btn-primary">
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
            {categories.map((cat) => (
              <tr key={cat._id}>
                <td>{cat.name}</td>
                <td className="text-graphite">/{cat.slug}</td>
                <td>{cat.isActive ? "Активна" : "Скрыта"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => startEdit(cat)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(cat._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && categories.length === 0 && <p className="p-6 text-sm text-graphite">Категорий пока нет.</p>}
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
