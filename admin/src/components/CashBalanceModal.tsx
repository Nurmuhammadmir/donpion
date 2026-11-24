import { useState } from "react";
import { X } from "lucide-react";
import { ApiError, adjustBalance, transferCashToBank } from "@/lib/api";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

// Two small single-screen actions behind "Касса" (see Finance.tsx):
// correcting a balance to what was actually counted, or depositing till
// cash into the company account. Both are rare, deliberate admin actions —
// a single shared modal keeps them from needing their own page each.
export default function CashBalanceModal({
  mode,
  bucket,
  branchName,
  branchId,
  currentAmount,
  onClose,
  onSuccess,
}: {
  mode: "adjust" | "transfer";
  bucket: "cash" | "bank";
  branchName?: string;
  branchId?: string;
  currentAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(mode === "adjust" ? String(currentAmount) : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "adjust" ? "Поправить остаток" : "Сдать наличку в банк";
  const scopeLabel = bucket === "cash" ? branchName ?? "—" : "Счёт фирмы";

  const handleSubmit = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || (mode === "transfer" && amountNum <= 0)) {
      setError("Укажите корректную сумму");
      return;
    }
    if (mode === "transfer" && amountNum > currentAmount) {
      setError(`В кассе только ${formatUZS(currentAmount)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "adjust") {
        await adjustBalance({ bucket, branchId, targetAmount: amountNum, note });
      } else {
        await transferCashToBank({ branchId: branchId!, amount: amountNum, note });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper sm:items-center sm:justify-center sm:bg-ink/40 sm:p-4" onClick={onClose}>
      <div
        className="anim-sheet flex h-full w-full flex-col overflow-hidden bg-paper sm:h-auto sm:max-w-md sm:rounded-2xl sm:border sm:border-hairline"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-graphite transition-colors hover:bg-canvas hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <p className="mb-4 text-xs text-graphite">
            {mode === "adjust" ? "Укажите фактическую сумму — текущий остаток" : "Переводится из"}:{" "}
            <span className="font-medium text-ink">{scopeLabel}</span>
            {mode === "adjust" && <span className="ml-1">({formatUZS(currentAmount)})</span>}
            {mode === "transfer" && <span className="ml-1">— в кассе {formatUZS(currentAmount)}</span>}
          </p>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
              {mode === "adjust" ? "Фактический остаток" : "Сумма перевода"}
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input"
            />
          </label>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Комментарий (необязательно)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Например: инкассация 24.11" />
          </label>

          {error && <p className="text-sm text-hermes-600">{error}</p>}
        </div>

        <div className="border-t border-hairline bg-paper px-4 py-3 sm:px-6" style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}>
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
            {submitting ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
