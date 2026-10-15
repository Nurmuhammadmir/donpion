import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Character } from "@/lib/types";

const emptyForm = {
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

// "Characters" power the homepage mini-quiz — tag products with the kind of
// person they suit ("Романтичная и нежная", …). If a product is saved with
// no character checked, the server assigns one at random (see
// server/src/controllers/products.controller.js) so it still surfaces in
// quiz results; that assignment shows up here and can be changed like any
// other tag.
export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<Character[]>("/characters/admin/all")
      .then(setCharacters)
      .catch(() => setCharacters([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (character: Character) => {
    setEditingId(character._id);
    setForm({
      name: character.name,
      description: character.description,
      sortOrder: String(character.sortOrder),
      isActive: character.isActive,
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
        await api(`/characters/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/characters", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить характер");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить характер?")) return;
    setDeleteError(null);
    try {
      await api(`/characters/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      // The server now rejects deleting a character still referenced by
      // products (400) — without this, that rejection (and any other
      // delete failure) was silent.
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить характер");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Характеры</h1>
          <p className="mt-1 text-sm text-graphite">
            Варианты ответа в мини-квизе на главной странице («Какой она человек?»). Каждый товар
            можно привязать к одному или нескольким характерам в его карточке.
          </p>
        </div>
        <button type="button" onClick={startCreate} className="btn-primary">
          + Добавить характер
        </button>
      </div>
      {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать характер" : "Новый характер"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder="Романтичная и нежная" />
          </Field>

          <Field label="Описание" required>
            <textarea required value={form.description} onChange={update("description")} className="input min-h-20" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Порядок сортировки">
              <input type="number" value={form.sortOrder} onChange={update("sortOrder")} className="input" />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink">
              <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
              Активен (виден в квизе)
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
              <th>Характер</th>
              <th>Slug</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {characters.map((character) => (
              <tr key={character._id}>
                <td>{character.name}</td>
                <td className="text-graphite">/{character.slug}</td>
                <td>{character.isActive ? "Активен" : "Скрыт"}</td>
                <td className="text-right">
                  <button type="button" onClick={() => startEdit(character)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(character._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && characters.length === 0 && <p className="p-6 text-sm text-graphite">Характеров пока нет.</p>}
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
