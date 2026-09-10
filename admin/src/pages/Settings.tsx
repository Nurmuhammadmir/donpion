import { useEffect, useRef, useState } from "react";
import { api, ApiError, resolveImageUrl, uploadProductImages } from "@/lib/api";
import type { SiteSettings } from "@/lib/types";

type HeroFields = {
  heroImage: string;
  heroImageTablet: string;
  heroImageMobile: string;
};

export default function Settings() {
  const [hero, setHero] = useState<HeroFields>({ heroImage: "", heroImageTablet: "", heroImageMobile: "" });
  const [cashbackPercent, setCashbackPercent] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SiteSettings>("/settings")
      .then((s) => {
        setHero({
          heroImage: s.heroImage,
          heroImageTablet: s.heroImageTablet ?? "",
          heroImageMobile: s.heroImageMobile ?? "",
        });
        setCashbackPercent(String(s.cashbackPercent ?? 0));
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
      <h1 className="font-serif text-2xl font-semibold text-ink">Главная страница</h1>
      <p className="mt-1 text-sm text-graphite">
        Фото в самом верху сайта — то, что видит каждый посетитель первым. У телефона и планшета
        своя квадратная обрезка фото, чтобы лицо букета не резалось криво, как на широком фото для
        компьютера.
      </p>

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
        <h2 className="font-serif text-lg font-semibold text-ink">Кешбек «Пионы»</h2>
        <p className="mt-1 text-sm text-graphite">
          Процент от суммы каждого оплаченного заказа, который клиент получает на баланс
          «Пионов» после того, как заказ отмечен завершённым. Пионы можно списать как скидку на
          следующий заказ (1 Пион = 1 сум). Поставьте 0, чтобы полностью отключить — начисление
          новых Пионов остановится, но уже накопленный баланс клиентов не изменится.
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
