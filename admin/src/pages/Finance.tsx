import { useEffect, useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { api, ApiError, getFinanceSummary } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import type { Expense, ExpenseCategory, FinanceSummary } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

// Short, rounded figure for the chart's bar-tip labels only — full
// precision always stays in the P&L list above and the hover tooltip, so
// nothing is ever gated behind the rounding.
function formatCompact(amount: number) {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}М`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000)}К`;
  return `${Math.round(amount)}`;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatRu(isoDateStr: string) {
  return new Date(isoDateStr).toLocaleDateString("ru-RU");
}

type Preset = "7d" | "30d" | "month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "month", label: "Этот месяц" },
  { key: "custom", label: "Другой период" },
];

function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const now = new Date();
  const to = isoDate(now);
  if (preset === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: isoDate(from), to };
  }
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDate(from), to };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to };
}

// Fixed, canonical order (packaging → salary → rent → ... → other) so the
// breakdown reads the same every time instead of reshuffling with amounts.
const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const CATEGORY_ENTRIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];
const EXPENSE_PAGE_SIZE = 20;
const HERMES_500 = "#F9511D";

interface ExpenseForm {
  category: ExpenseCategory;
  amount: string;
  date: string;
  branch: string;
  description: string;
  isRecurring: boolean;
}

function emptyExpenseForm(branch: string): ExpenseForm {
  return { category: "packaging", amount: "", date: isoDate(new Date()), branch, description: "", isRecurring: false };
}

function branchName(b: Expense["branch"]): string {
  return typeof b === "string" ? "—" : b.name;
}

interface ExpensesPage {
  items: Expense[];
  total: number;
  page: number;
  pages: number;
}

// "Финансы" — the owner's own money command-center: revenue minus cost of
// goods minus expenses, laid out so the arithmetic reads top to bottom
// without having to trust a chart. The donut/bar below is supplementary,
// never the primary source of a number.
export default function Finance() {
  const { branches, activeBranchId } = useBranch();

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(() => presetRange("30d").from);
  const [customTo, setCustomTo] = useState(() => presetRange("30d").to);
  const { from, to } = preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesTotalCount, setExpensesTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "">("");
  const [logLoading, setLogLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(() => emptyExpenseForm(activeBranchId ?? ""));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadSummary = () => {
    setSummaryLoading(true);
    getFinanceSummary({ branch: activeBranchId, from, to })
      .then((data) => setSummary(data as FinanceSummary))
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  };

  const loadExpenses = () => {
    setLogLoading(true);
    const qs = new URLSearchParams();
    if (activeBranchId) qs.set("branch", activeBranchId);
    if (categoryFilter) qs.set("category", categoryFilter);
    qs.set("from", from);
    qs.set("to", to);
    qs.set("page", String(page));
    qs.set("limit", String(EXPENSE_PAGE_SIZE));
    api<ExpensesPage>(`/finance/expenses?${qs.toString()}`)
      .then((res) => {
        setExpenses(res.items);
        setExpensesTotalCount(res.total);
        setPages(Math.max(1, res.pages));
      })
      .catch(() => {
        setExpenses([]);
        setExpensesTotalCount(0);
        setPages(1);
      })
      .finally(() => setLogLoading(false));
  };

  const reloadAll = () => {
    loadSummary();
    loadExpenses();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSummary, [activeBranchId, from, to]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadExpenses, [activeBranchId, from, to, categoryFilter, page]);
  // Period/category changes reset the page from their own handlers below;
  // a branch switch comes from the switcher elsewhere in the shell, so it
  // needs its own effect to land back on page 1.
  useEffect(() => setPage(1), [activeBranchId]);

  const handlePresetClick = (key: Preset) => {
    if (key === "custom" && preset !== "custom") {
      setCustomFrom(from);
      setCustomTo(to);
    }
    setPreset(key);
    setPage(1);
  };

  const handleCategoryFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value as ExpenseCategory | "");
    setPage(1);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyExpenseForm(activeBranchId ?? ""));
    setShowForm(true);
    setFormError(null);
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense._id);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date.slice(0, 10),
      branch: typeof expense.branch === "string" ? expense.branch : expense.branch._id,
      description: expense.description,
      isRecurring: expense.isRecurring,
    });
    setShowForm(true);
    setFormError(null);
  };

  const closeForm = () => setShowForm(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError("Укажите сумму больше нуля");
      return;
    }
    if (!form.branch) {
      setFormError("Выберите филиал");
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      branch: form.branch,
      category: form.category,
      amount: amountNum,
      date: form.date,
      description: form.description,
      isRecurring: form.isRecurring,
    };

    try {
      if (editingId) {
        await api(`/finance/expenses/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/finance/expenses", { method: "POST", body: JSON.stringify(payload) });
      }
      setShowForm(false);
      reloadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Не удалось сохранить расход");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить расход?")) return;
    setDeleteError(null);
    try {
      await api(`/finance/expenses/${id}`, { method: "DELETE" });
      reloadAll();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить расход");
    }
  };

  // Full breakdown for the plain-text P&L list — canonical order, zero
  // categories skipped so the list stays short and legible.
  const categoryBreakdown = CATEGORY_KEYS.map((key) => ({
    key,
    label: EXPENSE_CATEGORY_LABELS[key],
    amount: summary?.expensesByCategory[key] ?? 0,
  })).filter((row) => row.amount > 0);

  // Same data, ranked by size for the supplementary chart — short labels
  // on the axis (full name lives in the tooltip and in the list above).
  const chartData = !summary
    ? []
    : CATEGORY_KEYS.map((key) => ({
        key,
        label: EXPENSE_CATEGORY_LABELS[key].split(" (")[0],
        fullLabel: EXPENSE_CATEGORY_LABELS[key],
        amount: summary.expensesByCategory[key] ?? 0,
      }))
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount);

  const showBranchColumn = activeBranchId === null;
  const rangeLabel = summary ? `${formatRu(summary.range.from)} – ${formatRu(summary.range.to)}` : `${formatRu(from)} – ${formatRu(to)}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Финансы</h1>
      <p className="mt-1 text-sm text-graphite">
        Выручка, себестоимость, расходы и прибыль за период — считаем аккуратно, по каждой статье.
      </p>

      {/* Period picker */}
      <div className="card mt-6">
        <p className="eyebrow mb-3">Период</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => handlePresetClick(p.key)} className="pill" data-active={preset === p.key}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">С</span>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">По</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={isoDate(new Date())}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input"
              />
            </label>
          </div>
        )}
        <p className="mt-3 text-xs text-graphite">{rangeLabel}</p>
      </div>

      {/* The P&L itself — plain stacked list, arithmetic reads top to bottom */}
      <div className="card mt-4">
        <p className="eyebrow mb-4">Прибыль и убытки за период</p>

        {!summary && summaryLoading ? (
          <p className="text-sm text-graphite">Загрузка…</p>
        ) : !summary ? (
          <p className="text-sm text-graphite">Не удалось загрузить данные за период.</p>
        ) : (
          <div className={summaryLoading ? "opacity-50 transition-opacity" : "transition-opacity"}>
            <div className="divide-y divide-hairline">
              <PnlRow label="Выручка" sub={`${summary.orderCount} заказов`} amount={summary.revenue} sign="+" />
              <PnlRow label="Себестоимость проданного" amount={summary.cogs} sign="−" />
              <PnlRow label="Валовая прибыль" amount={summary.grossProfit} bold />
            </div>

            <div className="mt-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-graphite">Расходы</p>
              {categoryBreakdown.length === 0 ? (
                <p className="py-2 text-sm text-graphite">Расходов за период не было.</p>
              ) : (
                <div className="divide-y divide-hairline">
                  {categoryBreakdown.map((row) => (
                    <div key={row.key} className="flex items-baseline justify-between gap-4 py-2 pl-3">
                      <span className="text-sm text-graphite">{row.label}</span>
                      <span className="tabular-nums text-sm font-medium text-ink">− {formatUZS(row.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 divide-y divide-hairline">
              <PnlRow label="Итого расходы" amount={summary.expensesTotal} sign="−" />
              <PnlRow label="Чистая прибыль" amount={summary.netProfit} bold big />
            </div>
          </div>
        )}
      </div>

      {/* Supplementary: where the expense money goes, ranked by size */}
      <div className="card mt-4">
        <p className="eyebrow mb-4">Расходы по категориям</p>
        {!summary && summaryLoading ? (
          <p className="text-sm text-graphite">Загрузка…</p>
        ) : !summary ? (
          <p className="text-sm text-graphite">Не удалось загрузить данные.</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-graphite">Нет расходов за выбранный период.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tick={{ fill: "#5A564F", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "#FAF9F6" }}
                separator=": "
                formatter={(value) => formatUZS(Number(value))}
                labelFormatter={(label) => chartData.find((d) => d.label === label)?.fullLabel ?? label}
                contentStyle={{ borderRadius: 2, border: "1px solid #E7E1D6", background: "#FFFFFF", boxShadow: "none", fontSize: 12 }}
                labelStyle={{ color: "#1A1A1A", fontWeight: 600, marginBottom: 2 }}
                itemStyle={{ color: "#5A564F" }}
              />
              <Bar dataKey="amount" name="Сумма" fill={HERMES_500} radius={[0, 4, 4, 0]} barSize={20}>
                <LabelList dataKey="amount" position="right" formatter={(value) => formatCompact(Number(value))} style={{ fill: "#1A1A1A", fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* A balance as of today, not a flow for the period above — kept
          visually separate so it never reads as the next line of the P&L. */}
      <div className="card mt-8">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center bg-canvas text-graphite">
            <WarehouseIcon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="eyebrow">Баланс · на сегодня</p>
            <p className="mt-1 text-sm font-medium text-ink">Текущая стоимость склада по себестоимости</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{summary ? formatUZS(summary.inventoryValue) : "—"}</p>
            <p className="mt-1 text-xs text-graphite">
              Остаток, «заморожен» в цветах и материалах прямо сейчас — не входит в прибыль за период выше.
            </p>
          </div>
        </div>
      </div>

      {/* Expense log + management */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-ink">Расходы</h2>
          <button type="button" onClick={startCreate} className="btn-primary">
            + Добавить расход
          </button>
        </div>

        <div className="mb-4">
          <label className="block max-w-xs">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Категория</span>
            <select value={categoryFilter} onChange={handleCategoryFilterChange} className="input">
              <option value="">Все категории</option>
              {CATEGORY_ENTRIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {deleteError && <p className="mb-4 text-sm text-hermes-600">{deleteError}</p>}

        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-6 max-w-2xl space-y-4">
            <h3 className="font-medium text-ink">{editingId ? "Редактировать расход" : "Новый расход"}</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Категория</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                  className="input"
                >
                  {CATEGORY_ENTRIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                  Сумма (сум) <span className="text-hermes-500">*</span>
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="input"
                  placeholder="150000"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Дата</span>
                <input type="date" required value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} className="input" />
              </label>

              {activeBranchId === null && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                    Филиал <span className="text-hermes-500">*</span>
                  </span>
                  <select value={form.branch} onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))} className="input">
                    <option value="">Выберите филиал</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Описание</span>
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="input"
                placeholder="Например: коробки для букетов на свадьбу"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.isRecurring}
                onChange={(e) => setForm((prev) => ({ ...prev, isRecurring: e.target.checked }))}
              />
              Повторяющийся расход (аренда, коммунальные и т.п.)
            </label>

            {formError && <p className="text-sm text-hermes-600">{formError}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button type="button" onClick={closeForm} className="btn-secondary">
                Отмена
              </button>
            </div>
          </form>
        )}

        <div className="card overflow-x-auto p-0">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Категория</th>
                <th>Сумма</th>
                {showBranchColumn && <th>Филиал</th>}
                <th>Описание</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense._id}>
                  <td className="whitespace-nowrap text-graphite">{formatRu(expense.date)}</td>
                  <td>
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                    {expense.isRecurring && <span className="ml-2 text-xs text-hermes-600">повторяющийся</span>}
                  </td>
                  <td className="tabular-nums">{formatUZS(expense.amount)}</td>
                  {showBranchColumn && <td className="text-graphite">{branchName(expense.branch)}</td>}
                  <td className="text-graphite">{expense.description || "—"}</td>
                  <td className="text-right">
                    <button type="button" onClick={() => startEdit(expense)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                      Изменить
                    </button>
                    <button type="button" onClick={() => handleDelete(expense._id)} className="btn-danger">
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logLoading && expenses.length === 0 && <p className="p-6 text-sm text-graphite">Расходов за период не найдено.</p>}
        </div>

        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-graphite">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary disabled:opacity-40">
              ← Назад
            </button>
            <span>
              Стр. {page} из {pages} · {expensesTotalCount} расходов
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-secondary disabled:opacity-40">
              Вперёд →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PnlRow({
  label,
  sub,
  amount,
  sign,
  bold,
  big,
}: {
  label: string;
  sub?: string;
  amount: number;
  sign?: "+" | "−";
  bold?: boolean;
  big?: boolean;
}) {
  // Only an unsigned row (a subtotal like "Валовая прибыль"/"Чистая
  // прибыль") can flag a loss — a signed flow line (revenue, cogs, an
  // expense line) is routine and never colored just for carrying a sign.
  const isLoss = sign === undefined && amount < 0;
  const displayValue = sign ? formatUZS(Math.abs(amount)) : formatUZS(amount);

  return (
    <div className={`flex items-baseline justify-between gap-4 ${big ? "py-3" : "py-2.5"}`}>
      <span>
        <span className={bold ? "font-medium text-ink" : "text-sm text-graphite"}>{label}</span>
        {sub && <span className="ml-2 text-xs text-graphite">({sub})</span>}
      </span>
      <span
        className={`tabular-nums ${big ? "text-xl font-semibold" : bold ? "text-base font-semibold" : "text-sm font-medium"} ${
          isLoss ? "text-hermes-600" : "text-ink"
        }`}
      >
        {sign ? `${sign} ` : ""}
        {displayValue}
      </span>
    </div>
  );
}
