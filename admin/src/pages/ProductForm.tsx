import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError, createFlower, getFlowers, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { AddonCategory, Category, Flower, Occasion, Product } from "@/lib/types";
import ShowcaseTabs from "@/components/ShowcaseTabs";
import PriceInput from "@/components/PriceInput";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

type Kind = "bouquet" | "addon";

const KIND_LABELS: Record<Kind, string> = {
  bouquet: "Цветы",
  addon: "Доп. товар",
};

const emptyForm = {
  name: "",
  category: "",
  addonCategories: [] as string[],
  occasions: [] as string[],
  price: "",
  oldPrice: "",
  stock: "",
  images: [] as string[],
  shortDescription: "",
  composition: "",
  careInstructions: "",
  isFeatured: false,
  isActive: true,
};

// A recipe row carries the flower's own current name/unit/cost/stock
// alongside its id — purely so the preview below can be computed instantly
// as the admin edits, without a round trip. Only flowerId + quantity are
// ever sent to the server (see handleSubmit).
interface RecipeRow {
  key: string;
  flowerId: string;
  name: string;
  unit: string;
  costPrice: number;
  stock: number;
  quantity: string;
}

export default function ProductForm() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextRowKey = useRef(0);

  // New product: ask which kind before showing any fields (set below by
  // the chooser screen). Editing: kind comes from the loaded product and
  // never changes — migrating an existing product's cost/stock tracking
  // between kinds is out of scope.
  const [kind, setKind] = useState<Kind | null>(isNew ? null : "bouquet");

  const [categories, setCategories] = useState<Category[]>([]);
  const [addonCategories, setAddonCategories] = useState<AddonCategory[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  // Addon only — weighted-average import cost from warehouse receipts,
  // display-only, never part of the save payload.
  const [savedCostPrice, setSavedCostPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    api<AddonCategory[]>("/addon-categories").then(setAddonCategories).catch(() => setAddonCategories([]));
    api<Occasion[]>("/occasions").then(setOccasions).catch(() => setOccasions([]));
  }, []);

  function newRecipeRow(): RecipeRow {
    nextRowKey.current += 1;
    return { key: `row-${nextRowKey.current}`, flowerId: "", name: "", unit: "шт", costPrice: 0, stock: 0, quantity: "" };
  }

  useEffect(() => {
    if (isNew) return;
    // recipe.flower only ever comes back as a bare id (getProductByIdAdmin
    // doesn't populate it) — a flower list resolves each id to the name/
    // unit/cost/stock the preview needs. Its own failure shouldn't block
    // loading the product itself, just degrade the hydration.
    Promise.all([api<Product>(`/products/admin/id/${id}`), api<Flower[]>("/flowers?limit=500").catch(() => [] as Flower[])])
      .then(([p, flowers]) => {
        setKind(p.kind);
        const flowerById = new Map(flowers.map((f) => [f._id, f]));
        setForm({
          name: p.name,
          category: p.category?._id ?? "",
          addonCategories: p.addonCategories?.map((c) => c._id) ?? [],
          occasions: p.occasions?.map((o) => o._id) ?? [],
          price: String(p.price),
          oldPrice: p.oldPrice ? String(p.oldPrice) : "",
          stock: String(p.stock),
          images: p.images,
          shortDescription: p.shortDescription,
          composition: p.composition.join("\n"),
          careInstructions: p.careInstructions,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
        });
        setRecipe(
          (p.recipe ?? []).map((line) => {
            const flowerId = typeof line.flower === "string" ? line.flower : line.flower._id;
            const known = flowerById.get(flowerId);
            nextRowKey.current += 1;
            return {
              key: `row-${nextRowKey.current}`,
              flowerId,
              name: known?.name ?? "Цветок удалён",
              unit: known?.unit ?? "шт",
              costPrice: known?.costPrice ?? 0,
              stock: known?.stock ?? 0,
              quantity: String(line.quantity),
            };
          })
        );
        setSavedCostPrice(p.costPrice);
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

  const validRecipeRows = recipe.filter((r) => r.flowerId && Number(r.quantity) > 0);
  const recipeIsValid = recipe.length > 0 && validRecipeRows.length === recipe.length;
  const previewCost = validRecipeRows.reduce((sum, r) => sum + r.costPrice * Number(r.quantity), 0);
  const previewAvailability =
    validRecipeRows.length === 0
      ? 0
      : Math.max(0, Math.floor(Math.min(...validRecipeRows.map((r) => r.stock / Number(r.quantity)))));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) return;
    setSaving(true);
    setError(null);

    // Slug is intentionally not sent — the server always derives it from
    // the name. For a bouquet, category/characters/SEO/isFeatured/stock/
    // costPrice/story/composition are all server-computed (story from
    // shortDescription, composition from `recipe`) and overwritten if sent
    // anyway, so they're simply left out below.
    const shared = {
      name: form.name,
      kind,
      price: Number(form.price),
      oldPrice: form.oldPrice ? Number(form.oldPrice) : null,
      images: form.images,
      shortDescription: form.shortDescription,
      careInstructions: form.careInstructions,
      isActive: form.isActive,
    };

    const payload =
      kind === "bouquet"
        ? {
            ...shared,
            occasions: form.occasions,
            recipe: validRecipeRows.map((r) => ({ flower: r.flowerId, quantity: Number(r.quantity) })),
          }
        : {
            ...shared,
            category: form.category,
            addonCategories: form.addonCategories,
            stock: Number(form.stock),
            isFeatured: form.isFeatured,
            composition: form.composition
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          };

    try {
      if (isNew) {
        await api("/products", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      navigate("/showcase");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить товар");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div>
        <ShowcaseTabs />
        <p className="text-graphite">Загрузка…</p>
      </div>
    );

  if (loadError) {
    return (
      <div>
        <ShowcaseTabs />
        <div className="space-y-4">
          <p className="text-sm text-hermes-600">{loadError}</p>
          <button type="button" onClick={() => navigate("/showcase")} className="btn-secondary">
            Назад к товарам
          </button>
        </div>
      </div>
    );
  }

  if (kind === null) {
    return (
      <div>
        <ShowcaseTabs />
        <h1 className="font-display text-2xl text-ink">Новый товар</h1>
        <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setKind("bouquet")}
            className="card flex flex-col items-start gap-1 text-left transition-all hover:shadow active:scale-[0.98]"
          >
            <span className="text-base font-medium text-ink">Цветы</span>
            <span className="text-xs text-graphite">Букет из состава со склада</span>
          </button>
          <button
            type="button"
            onClick={() => setKind("addon")}
            className="card flex flex-col items-start gap-1 text-left transition-all hover:shadow active:scale-[0.98]"
          >
            <span className="text-base font-medium text-ink">Доп. товар</span>
            <span className="text-xs text-graphite">Ваза, шоколад, сертификат и т.п.</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ShowcaseTabs />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-ink">{isNew ? "Новый товар" : "Редактировать товар"}</h1>
        {isNew ? (
          <button type="button" onClick={() => setKind(null)} className="text-xs font-medium text-graphite hover:text-ink">
            Изменить тип
          </button>
        ) : (
          <div className="flex flex-none gap-1.5">
            <button type="button" onClick={() => setKind("bouquet")} className="pill" data-active={kind === "bouquet" ? "true" : "false"}>
              {KIND_LABELS.bouquet}
            </button>
            <button type="button" onClick={() => setKind("addon")} className="pill" data-active={kind === "addon" ? "true" : "false"}>
              {KIND_LABELS.addon}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card mt-6 max-w-3xl space-y-5">
        <Field label="Фото товара" required>
          <div className="flex flex-wrap gap-3">
            {form.images.map((url) => (
              <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-hairline">
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
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-graphite hover:border-hermes-500 hover:text-hermes-600 disabled:opacity-50"
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
          {uploadError && <p className="mt-1 text-xs text-hermes-600">{uploadError}</p>}
          {form.images.length === 0 && <p className="mt-1 text-xs text-hermes-600">Добавьте хотя бы одно фото.</p>}
        </Field>

        <Field label="Название" required>
          <input required value={form.name} onChange={update("name")} className="input" />
        </Field>

        <div className={`grid gap-5 ${kind === "addon" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Field label="Цена, сум" required>
            <PriceInput required value={form.price} onChange={(v) => setForm((prev) => ({ ...prev, price: v }))} />
          </Field>
          <Field label="Старая цена (для скидки)">
            <PriceInput value={form.oldPrice} onChange={(v) => setForm((prev) => ({ ...prev, oldPrice: v }))} />
          </Field>
          {kind === "addon" && (
            <Field label="Остаток на складе" required>
              <input required type="number" min={0} value={form.stock} onChange={update("stock")} className="input" />
            </Field>
          )}
        </div>

        <Field label="Короткое описание (для карточки и SEO)" required>
          <input required value={form.shortDescription} onChange={update("shortDescription")} className="input" />
        </Field>

        {kind === "bouquet" ? (
          <>
            <Field label="Повод">
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
                            : prev.occasions.filter((oid) => oid !== occasion._id),
                        }))
                      }
                    />
                    {occasion.name}
                  </label>
                ))}
              </div>
            </Field>

            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                Состав букета
                <span className="text-hermes-500"> *</span>
              </span>
              <div className="space-y-3">
                {recipe.map((row) => (
                  <FlowerRow
                    key={row.key}
                    row={row}
                    onChange={(next) => setRecipe((prev) => prev.map((r) => (r.key === row.key ? next : r)))}
                    onRemove={() => setRecipe((prev) => prev.filter((r) => r.key !== row.key))}
                  />
                ))}
              </div>
              <button type="button" onClick={() => setRecipe((prev) => [...prev, newRecipeRow()])} className="btn-secondary mt-3">
                <Plus className="h-4 w-4" /> Добавить цветок
              </button>
              {!recipeIsValid && <p className="mt-2 text-xs text-hermes-600">Добавьте цветок и укажите количество для каждой позиции.</p>}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-graphite">Себестоимость (авто)</span>
                  <span className="font-display text-base text-ink">{formatUZS(previewCost)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-graphite">Можно собрать (авто)</span>
                  <span className="font-display text-base text-ink">{previewAvailability} шт.</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
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
                            : prev.addonCategories.filter((cid) => cid !== category._id),
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
            </Field>

            <Field label="Категория">
              <select value={form.category} onChange={update("category")} className="input">
                <option value="">Выберите категорию</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            {!isNew && savedCostPrice !== null && (
              <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wide text-graphite">Себестоимость (авто)</span>
                <span className="font-display text-base text-ink">{formatUZS(savedCostPrice)}</span>
              </div>
            )}
          </>
        )}

        {kind === "addon" && (
          <Field label="Состав (по одной позиции на строку)">
            <textarea value={form.composition} onChange={update("composition")} className="input min-h-20" />
          </Field>
        )}

        <Field label="Инструкция по уходу">
          <textarea value={form.careInstructions} onChange={update("careInstructions")} className="input min-h-20" />
        </Field>

        <div className="flex gap-6">
          {kind === "addon" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.isFeatured} onChange={update("isFeatured")} />
              Показывать в Люксовом
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isActive} onChange={update("isActive")} />
            Активен (виден на сайте)
          </label>
        </div>

        {error && <p className="text-sm text-hermes-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || uploading || form.images.length === 0 || (kind === "bouquet" && !recipeIsValid)}
            className="btn-primary"
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button type="button" onClick={() => navigate("/showcase")} className="btn-secondary">
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

// One "Состав букета" row: a debounced flower search that can also create
// a brand new flower inline (same raw material Приход draws from), plus
// how many of it the recipe needs. The parent only ever reads
// flowerId/quantity on submit — name/unit/costPrice/stock here exist
// purely to drive the live preview above.
function FlowerRow({
  row,
  onChange,
  onRemove,
}: {
  row: RecipeRow;
  onChange: (next: RecipeRow) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Flower[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetches as soon as the field is focused, even with an empty query —
  // getFlowers() with no term returns the whole list, so clicking in
  // immediately offers something to scroll through instead of a blank box
  // that only reacts once you start typing a name.
  useEffect(() => {
    if (row.flowerId || !open) return;
    setSearching(true);
    const handle = setTimeout(() => {
      getFlowers(query.trim())
        .then((flowers) => setResults(flowers as Flower[]))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, row.flowerId, open]);

  const selectFlower = (f: Flower) => {
    onChange({ ...row, flowerId: f._id, name: f.name, unit: f.unit, costPrice: f.costPrice, stock: f.stock });
    setQuery("");
    setResults([]);
    setShowCreate(false);
    setOpen(false);
  };

  const clearSelection = () => {
    onChange({ ...row, flowerId: "", name: "", unit: "шт", costPrice: 0, stock: 0 });
  };

  const openCreate = () => {
    setCreateName(query.trim());
    setCreateError(null);
    setShowCreate(true);
    setOpen(false);
  };

  const handleCreateFlower = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const flower = (await createFlower({ name: createName.trim() })) as Flower;
      selectFlower(flower);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Не удалось создать цветок");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl border border-hairline p-3">
      {row.flowerId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-ink">{row.name}</span>
          <button
            type="button"
            onClick={clearSelection}
            className="flex-none text-xs text-graphite underline-offset-2 hover:underline"
          >
            Заменить
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowCreate(false);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder="Название цветка…"
            className="input"
          />
          {open && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-32 overflow-y-auto rounded-xl border border-hairline bg-paper shadow-sm">
              {searching ? (
                <p className="p-3 text-sm text-graphite">Ищем…</p>
              ) : results.length > 0 ? (
                results.map((f) => (
                  <button
                    key={f._id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectFlower(f)}
                    className="block w-full px-3.5 py-2.5 text-left text-sm text-ink hover:bg-canvas"
                  >
                    {f.name} <span className="text-xs text-graphite">· остаток {f.stock} {f.unit}</span>
                  </button>
                ))
              ) : query.trim() ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openCreate}
                  className="block w-full px-3.5 py-2.5 text-left text-sm font-medium text-hermes-600 hover:bg-canvas"
                >
                  + Создать «{query.trim()}»
                </button>
              ) : (
                <p className="p-3 text-sm text-graphite">Нет цветов на складе</p>
              )}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <div className="mt-3 space-y-2 rounded-xl bg-canvas p-3">
          <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Название цветка" className="input" />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!createName.trim() || creating}
              onClick={handleCreateFlower}
              className="btn-primary flex-1"
            >
              {creating ? "Создаём…" : "Создать"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
              Отмена
            </button>
          </div>
          {createError && <p className="text-xs text-hermes-600">{createError}</p>}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={1}
          step="any"
          value={row.quantity}
          onChange={(e) => onChange({ ...row, quantity: e.target.value })}
          placeholder="Кол-во"
          className="input w-24"
        />
        <span className="text-xs text-graphite">{row.unit}</span>
        <button type="button" onClick={onRemove} aria-label="Удалить позицию" className="btn-danger ml-auto flex-none">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
