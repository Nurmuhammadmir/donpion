import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { AddonCategory, Category, Character, Occasion, Product } from "@/lib/types";

const emptyForm = {
  name: "",
  category: "",
  characters: [] as string[],
  addonCategories: [] as string[],
  occasions: [] as string[],
  price: "",
  oldPrice: "",
  stock: "",
  images: [] as string[],
  shortDescription: "",
  story: "",
  composition: "",
  careInstructions: "",
  isFeatured: false,
  isActive: true,
};

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [addonCategories, setAddonCategories] = useState<AddonCategory[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>("/categories/admin/all").then(setCategories).catch(() => setCategories([]));
    api<Character[]>("/characters/admin/all").then(setCharacters).catch(() => setCharacters([]));
    api<AddonCategory[]>("/addon-categories/admin/all").then(setAddonCategories).catch(() => setAddonCategories([]));
    api<Occasion[]>("/occasions/admin/all").then(setOccasions).catch(() => setOccasions([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    api<Product>(`/products/admin/id/${id}`)
      .then((p) => {
        setForm({
          name: p.name,
          category: p.category?._id ?? "",
          characters: p.characters?.map((c) => c._id) ?? [],
          addonCategories: p.addonCategories?.map((c) => c._id) ?? [],
          occasions: p.occasions?.map((o) => o._id) ?? [],
          price: String(p.price),
          oldPrice: p.oldPrice ? String(p.oldPrice) : "",
          stock: String(p.stock),
          images: p.images,
          shortDescription: p.shortDescription,
          story: p.story,
          composition: p.composition.join("\n"),
          careInstructions: p.careInstructions,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
        });
      })
      .catch((err) => {
        // Without this, a failed load (product deleted elsewhere, network
        // blip) left the page stuck on "Загрузка…" forever — `loading`
        // only ever turned false on success, with no error and no way out
        // except the sidebar nav.
        setLoadError(err instanceof ApiError ? err.message : "Не удалось загрузить товар");
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const update =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      // The photo is compressed to WebP and given an SEO-friendly filename
      // (based on the product name) server-side — see server/src/controllers/uploads.controller.js.
      const urls = await uploadProductImages(files, form.name);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (url: string) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((i) => i !== url) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Slug is intentionally not sent — the server always derives it from
    // the name (server/src/utils/slugify.js), so it stays consistent and
    // no admin ever has to think about URLs.
    const payload = {
      name: form.name,
      category: form.category,
      characters: form.characters,
      addonCategories: form.addonCategories,
      occasions: form.occasions,
      price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      stock: Number(form.stock),
      images: form.images,
      shortDescription: form.shortDescription,
      story: form.story,
      composition: form.composition
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      careInstructions: form.careInstructions,
      isFeatured: form.isFeatured,
      isActive: form.isActive,
    };

    try {
      if (isNew) {
        await api("/products", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      navigate("/products");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-graphite">Загрузка…</p>;

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-hermes-600">{loadError}</p>
        <button type="button" onClick={() => navigate("/products")} className="btn-secondary">
          Назад к товарам
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">
        {isNew ? "Новый товар" : "Редактировать товар"}
      </h1>

      <form onSubmit={handleSubmit} className="card mt-6 max-w-3xl space-y-5">
        <Field label="Название" required>
          <input required value={form.name} onChange={update("name")} className="input" />
        </Field>

        <Field label="Категория" required>
          <select required value={form.category} onChange={update("category")} className="input">
            <option value="">Выберите категорию</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Характер (для мини-квиза на главной)">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {characters.map((character) => (
              <label key={character._id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.characters.includes(character._id)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      characters: e.target.checked
                        ? [...prev.characters, character._id]
                        : prev.characters.filter((id) => id !== character._id),
                    }))
                  }
                />
                {character.name}
              </label>
            ))}
            {characters.length === 0 && (
              <p className="text-xs text-graphite">Сначала добавьте характеры в разделе «Характеры».</p>
            )}
          </div>
          <p className="mt-2 text-xs text-graphite">
            Если не выбрать ни одного, сервер сам случайно привяжет один характер при сохранении —
            это можно будет изменить здесь в любой момент.
          </p>
        </Field>

        <Field label="Допы (этот товар — сам доп. товар, предлагается под другими)">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {addonCategories.map((category) => (
              <label key={category._id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.addonCategories.includes(category._id)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      addonCategories: e.target.checked
                        ? [...prev.addonCategories, category._id]
                        : prev.addonCategories.filter((id) => id !== category._id),
                    }))
                  }
                />
                {category.name}
              </label>
            ))}
            {addonCategories.length === 0 && (
              <p className="text-xs text-graphite">Сначала добавьте категории в разделе «Допы».</p>
            )}
          </div>
          <p className="mt-2 text-xs text-graphite">
            Не обязательно — оставьте пустым, если это обычный букет, а не доп. товар (ваза,
            шоколад, игрушка и т.п.).
          </p>
        </Field>

        <Field label="Поводы (для раздела на главной странице)">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {occasions.map((occasion) => (
              <label key={occasion._id} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.occasions.includes(occasion._id)}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      occasions: e.target.checked
                        ? [...prev.occasions, occasion._id]
                        : prev.occasions.filter((id) => id !== occasion._id),
                    }))
                  }
                />
                {occasion.name}
              </label>
            ))}
            {occasions.length === 0 && (
              <p className="text-xs text-graphite">Сначала добавьте поводы в разделе «Поводы».</p>
            )}
          </div>
          <p className="mt-2 text-xs text-graphite">Не обязательно — можно оставить пустым.</p>
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Цена, сум" required>
            <input required type="number" min={0} value={form.price} onChange={update("price")} className="input" />
          </Field>
          <Field label="Старая цена (для скидки)">
            <input type="number" min={0} value={form.oldPrice} onChange={update("oldPrice")} className="input" />
          </Field>
          <Field label="Остаток на складе" required>
            <input required type="number" min={0} value={form.stock} onChange={update("stock")} className="input" />
          </Field>
        </div>

        <Field label="Фото товара" required>
          <div className="flex flex-wrap gap-3">
            {form.images.map((url) => (
              <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-hairline">
                <img src={resolveImageUrl(url)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  aria-label="Удалить фото"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline text-graphite hover:border-sapphire-500 hover:text-sapphire-600 disabled:opacity-50"
            >
              <span className="text-xl leading-none">{uploading ? "…" : "+"}</span>
              <span className="text-[10px] uppercase tracking-wide">{uploading ? "Грузим" : "Добавить"}</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <p className="mt-2 text-xs text-graphite">
            Загружается прямо с устройства — сервер сам сожмёт фото и переведёт в WebP.
          </p>
          {uploadError && <p className="mt-1 text-xs text-hermes-600">{uploadError}</p>}
          {form.images.length === 0 && <p className="mt-1 text-xs text-hermes-600">Добавьте хотя бы одно фото.</p>}
        </Field>

        <Field label="Короткое описание (для карточки товара)" required>
          <input required value={form.shortDescription} onChange={update("shortDescription")} className="input" />
        </Field>

        <Field label="Подробный рассказ о товаре (уникальный текст для SEO)" required>
          <textarea required value={form.story} onChange={update("story")} className="input min-h-32" />
        </Field>

        <Field label="Состав (по одной позиции на строку)">
          <textarea value={form.composition} onChange={update("composition")} className="input min-h-20" />
        </Field>

        <Field label="Инструкция по уходу">
          <textarea value={form.careInstructions} onChange={update("careInstructions")} className="input min-h-20" />
        </Field>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isFeatured} onChange={update("isFeatured")} />
            Показывать в Люксовом
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
            Активен (виден на сайте)
          </label>
        </div>

        {error && <p className="text-sm text-hermes-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || uploading || form.images.length === 0} className="btn-primary">
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button type="button" onClick={() => navigate("/products")} className="btn-secondary">
            Отмена
          </button>
        </div>
      </form>
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
