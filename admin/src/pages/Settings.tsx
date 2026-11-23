import { useEffect, useRef, useState } from "react";
import { api, ApiError, getPricingSettings, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";

type HeroFields = {
  heroImage: string;
  heroImageTablet: string;
  heroImageMobile: string;
};

export default function Settings() {
  const [hero, setHero] = useState<HeroFields>({ heroImage: "", heroImageTablet: "", heroImageMobile: "" });
  const [cashbackPercent, setCashbackPercent] = useState("10");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [assemblyPercent, setAssemblyPercent] = useState("10");
  const [markupMultiplier, setMarkupMultiplier] = useState("2");
  const [deliveryFee, setDeliveryFee] = useState("50000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<SiteSettings>("/settings"), getPricingSettings()])
      .then(([s, pricing]) => {
        setHero({
          heroImage: s.heroImage,
          heroImageTablet: s.heroImageTablet ?? "",
          heroImageMobile: s.heroImageMobile ?? "",
        });
        setCashbackPercent(String(s.cashbackPercent ?? 0));
        setLowStockThreshold(String(s.lowStockThreshold ?? 5));
        setAssemblyPercent(String(pricing.assemblyPercent ?? 10));
        setMarkupMultiplier(String(pricing.markupMultiplier ?? 2));
        setDeliveryFee(String(pricing.deliveryFee ?? 50000));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Не удалось загрузить настройки"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api("/settings", {
        method: "PUT",
        body: JSON.stringify({
          heroImage: hero.heroImage,
          heroImageTablet: hero.heroImageTablet || null,
          heroImageMobile: hero.heroImageMobile || null,
          cashbackPercent: Number(cashbackPercent) || 0,
          lowStockThreshold: Number(lowStockThreshold) || 0,
          assemblyPercent: Number(assemblyPercent) || 0,
          markupMultiplier: Number(markupMultiplier) || 0,
          deliveryFee: Number(deliveryFee) || 0,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-graphite">Загрузка…</p>;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Главная страница</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <HeroSlot
          label="Компьютер (широкое фото)"
          aspect="aspect-video"
          value={hero.heroImage}
          onChange={(url) => setHero((prev) => ({ ...prev, heroImage: url }))}
          required
        />
        <HeroSlot
          label="Планшет (квадратное фото)"
          aspect="aspect-square"
          value={hero.heroImageTablet}
          onChange={(url) => setHero((prev) => ({ ...prev, heroImageTablet: url }))}
        />
        <HeroSlot
          label="Телефон (квадратное фото)"
          aspect="aspect-square"
          value={hero.heroImageMobile}
          onChange={(url) => setHero((prev) => ({ ...prev, heroImageMobile: url }))}
        />
      </div>

      <p className="mt-3 text-xs text-graphite">
        Если не загрузить отдельное фото для планшета/телефона, там покажется широкое фото для
        компьютера, обрезанное по центру.
      </p>

      <div className="mt-10 max-w-sm border-t border-hairline pt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Кешбек «Пионы»</h2>
        <p className="mt-1 text-sm text-graphite">
          1 Пион = 1 сум при списании. 0 — отключает начисление новых, накопленный баланс не
          изменится.
        </p>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-graphite">Процент кешбека</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={cashbackPercent}
              onChange={(e) => setCashbackPercent(e.target.value)}
              className="input w-24"
            />
            <span className="text-sm text-graphite">%</span>
          </div>
        </label>
      </div>

      <div className="mt-8 max-w-sm border-t border-hairline pt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Формула цены букета</h2>
        <p className="mt-1 text-sm text-graphite">
          Применяется по умолчанию в каждом новом букете — в самом букете можно поменять.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-graphite">Сборка букета, %</span>
            <input
              type="number"
              min={0}
              step={1}
              value={assemblyPercent}
              onChange={(e) => setAssemblyPercent(e.target.value)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-graphite">Наценка, ×</span>
            <input
              type="number"
              min={0}
              step="any"
              value={markupMultiplier}
              onChange={(e) => setMarkupMultiplier(e.target.value)}
              className="input"
            />
          </label>
          <label className="col-span-2 block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-graphite">Доставка, сум</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              className="input"
            />
          </label>
        </div>
      </div>

      <div className="mt-8 max-w-sm border-t border-hairline pt-6">
        <h2 className="font-display text-lg font-semibold text-ink">Склад</h2>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-graphite">Порог «мало на складе»</span>
          <input
            type="number"
            min={0}
            step={1}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            className="input w-24"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-hermes-600">{error}</p>}
      {saved && <p className="mt-4 text-sm text-sapphire-600">Сохранено.</p>}

      <div className="mt-6">
        <button type="button" onClick={handleSave} disabled={saving || !hero.heroImage} className="btn-primary">
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}

function HeroSlot({
  label,
  aspect,
  value,
  onChange,
  required,
}: {
  label: string;
  aspect: string;
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const [url] = await uploadProductImages([file], "glavnaya-foto");
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="card space-y-3">
      <span className="block text-xs font-medium uppercase tracking-wide text-graphite">
        {label}
        {required && <span className="text-hermes-500"> *</span>}
      </span>

      {value ? (
        <div className={`relative w-full overflow-hidden rounded-lg border border-hairline ${aspect}`}>
          <img src={resolveImageUrl(value)} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className={`flex w-full items-center justify-center rounded-lg border border-dashed border-hairline text-xs text-graphite ${aspect}`}>
          Не загружено
        </div>
      )}

      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary w-full">
        {uploading ? "Загружаем…" : value ? "Заменить фото" : "Загрузить фото"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileSelected}
        className="hidden"
      />
      {error && <p className="text-xs text-hermes-600">{error}</p>}
    </div>
  );
}
