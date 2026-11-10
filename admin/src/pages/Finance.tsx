import { useEffect, useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Globe, Plus, Store, TrendingDown, TrendingUp, Warehouse as WarehouseIcon, X } from "lucide-react";
import { api, ApiError, getFinanceSummary } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import type { Branch, Expense, ExpenseCategory, FinanceSummary, Order } from "@/lib/types";
import { EXPENSE_CATEGORY_LABELS, ORDER_SOURCE_LABELS } from "@/lib/types";
import QuickSaleModal from "@/components/QuickSaleModal";
import { Skeleton } from "@/components/Skeleton";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

// Short, rounded figure for the chart's bar-tip labels only — full
// precision always stays in the headline numbers and the hover tooltip, so
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
// category chart reads the same every time instead of reshuffling with
// amounts.
const CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const CATEGORY_ENTRIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][];
const LIST_PAGE_SIZE = 20;
const HERMES_500 = "#F9511D";

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

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

// "Финансы" — the owner's own money command-center. Three numbers up top
// (поступления / списания / чистая прибыль) are the non-negotiable part;
// everything else — the per-transaction lists, the category chart, the
// warehouse balance — is supplementary detail reachable below them.
export default function Finance() {
  const { branches, activeBranchId, activeBranch, isCEO } = useBranch();

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(() => presetRange("30d").from);
  const [customTo, setCustomTo] = useState(() => presetRange("30d").to);
  const { from, to } = preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset);

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // "Поступления" drill-down — orders for the period/branch.
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [incomeOrders, setIncomeOrders] = useState<Order[]>([]);
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [incomePage, setIncomePage] = useState(1);
  const [incomePages, setIncomePages] = useState(1);
  const [incomeLoading, setIncomeLoading] = useState(true);

  // "Списания" drill-down — the expense log (unchanged logic from before,
  // just gated behind the toggle instead of always visible).
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesTotalCount, setExpensesTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "">("");
  const [logLoading, setLogLoading] = useState(true);

  // Unified "+" entry point: pick "Расход" or "Продажа" first, then open
  // the matching form/modal.
  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
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

  const loadIncome = () => {
    setIncomeLoading(true);
    const qs = new URLSearchParams();
    if (activeBranchId) qs.set("branch", activeBranchId);
    qs.set("from", from);
    qs.set("to", to);
    // Matches the revenue headline number exactly — a cancelled order
    // contributes to neither, so it shouldn't appear as income here either.
    qs.set("excludeCancelled", "true");
    qs.set("page", String(incomePage));
    qs.set("limit", String(LIST_PAGE_SIZE));
    api<Page<Order>>(`/orders?${qs.toString()}`)
      .then((res) => {
        setIncomeOrders(res.items);
        setIncomeTotal(res.total);
        setIncomePages(Math.max(1, res.pages));
      })
      .catch(() => {
        setIncomeOrders([]);
        setIncomeTotal(0);
        setIncomePages(1);
      })
      .finally(() => setIncomeLoading(false));
  };

  const loadExpenses = () => {
    setLogLoading(true);
    const qs = new URLSearchParams();
    if (activeBranchId) qs.set("branch", activeBranchId);
    if (categoryFilter) qs.set("category", categoryFilter);
    qs.set("from", from);
    qs.set("to", to);
    qs.set("page", String(page));
    qs.set("limit", String(LIST_PAGE_SIZE));
    api<Page<Expense>>(`/finance/expenses?${qs.toString()}`)
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadSummary, [activeBranchId, from, to]);

  // Both drill-down lists load lazily — only once their toggle is actually
  // open — so picking a period doesn't fire three requests when the owner
  // only ever looks at the headline numbers.
  useEffect(() => {
    if (!incomeExpanded) return;
    loadIncome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomeExpanded, activeBranchId, from, to, incomePage]);

  useEffect(() => {
    if (!expensesExpanded) return;
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expensesExpanded, activeBranchId, from, to, categoryFilter, page]);

  // Period/category changes reset their own page from the handlers below;
  // a branch switch comes from the switcher elsewhere in the shell, so it
  // needs its own effect to land both lists back on page 1.
  useEffect(() => {
    setPage(1);
    setIncomePage(1);
  }, [activeBranchId]);

  const handlePresetClick = (key: Preset) => {
    if (key === "custom" && preset !== "custom") {
      setCustomFrom(from);
      setCustomTo(to);
    }
    setPreset(key);
    setPage(1);
    setIncomePage(1);
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

  // Expense create/edit/delete all funnel through here — the list only
  // actually needs a refetch if it's open; the headline numbers always do.
  const reloadAfterExpenseChange = () => {
    loadSummary();
    if (expensesExpanded) loadExpenses();
  };

  const reloadAfterSale = () => {
    loadSummary();
    if (incomeExpanded) loadIncome();
  };

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
      reloadAfterExpenseChange();
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
      reloadAfterExpenseChange();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить расход");
    }
  };

  // Same numbers as the expense table's category column, ranked by size
  // for the chart — short label on the axis, full name in the tooltip.
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

      {/* The three headline numbers */}
      <div className="card mt-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="eyebrow">Итоги за период</p>
          <button type="button" onClick={() => setAddChoiceOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </div>

        {!summary && summaryLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-hairline bg-paper p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-8 w-32" />
              </div>
            ))}
          </div>
        ) : !summary ? (
          <p className="text-sm text-graphite">Не удалось загрузить данные за период.</p>
        ) : (
          <div
            className={`grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 ${summaryLoading ? "opacity-50 transition-opacity" : "transition-opacity"}`}
          >
            <HeadlineTile label="Поступления" amount={summary.revenue} sub={`${summary.orderCount} заказов`} />
            <HeadlineTile label="Списания" amount={summary.expensesTotal} signPrefix="−" />
            <HeadlineTile label="Чистая прибыль" amount={summary.netProfit} emphasize />
          </div>
        )}
      </div>

      {/* A balance as of today, not a flow for the period above — kept
          visually smaller than the headline numbers so it never competes
          with them. */}
      <div className="card mt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-canvas text-graphite">
            <WarehouseIcon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Баланс · на сегодня</p>
            <p className="mt-1 text-sm font-medium text-ink">{summary ? formatUZS(summary.inventoryValue) : "—"}</p>
            <p className="text-xs text-graphite">Склад по себестоимости — не входит в прибыль за период выше.</p>
          </div>
        </div>
      </div>

      {/* Поступления / Списания — click to expand the full list */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setIncomeExpanded((v) => !v)} className="pill" data-active={incomeExpanded}>
          Поступления
        </button>
        <button type="button" onClick={() => setExpensesExpanded((v) => !v)} className="pill" data-active={expensesExpanded}>
          Списания
        </button>
      </div>

      {incomeExpanded && (
        <div className="anim-dropdown">
        <IncomeList
          orders={incomeOrders}
          loading={incomeLoading}
          page={incomePage}
          pages={incomePages}
          total={incomeTotal}
          onPrev={() => setIncomePage((p) => p - 1)}
          onNext={() => setIncomePage((p) => p + 1)}
        />
        </div>
      )}

      {expensesExpanded && (
        <div className="anim-dropdown mt-3">
          <label className="mb-3 block max-w-xs">
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

          {deleteError && <p className="mb-3 text-sm text-hermes-600">{deleteError}</p>}

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
            <Pager
              page={page}
              pages={pages}
              total={expensesTotalCount}
              noun="расходов"
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          </div>

          {/* Supplementary: where the expense money goes, ranked by size */}
          {chartData.length > 0 && (
            <div className="card mt-3">
              <p className="eyebrow mb-4">Расходы по категориям</p>
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
            </div>
          )}
        </div>
      )}

      {addChoiceOpen && (
        <AddChoiceModal
          onClose={() => setAddChoiceOpen(false)}
          onPickExpense={() => {
            setAddChoiceOpen(false);
            startCreate();
          }}
          onPickSale={() => {
            setAddChoiceOpen(false);
            setSaleOpen(true);
          }}
        />
      )}

      {showForm && (
        <ExpenseFormModal
          editingId={editingId}
          form={form}
          setForm={setForm}
          formError={formError}
          saving={saving}
          branches={branches}
          showBranchField={activeBranchId === null}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {saleOpen && (
        <QuickSaleModal
          branches={branches}
          activeBranchId={activeBranchId}
          activeBranch={activeBranch}
          isCEO={isCEO}
          onClose={() => setSaleOpen(false)}
          onSuccess={reloadAfterSale}
        />
      )}
    </div>
  );
}

function HeadlineTile({
  label,
  amount,
  signPrefix,
  sub,
  emphasize,
}: {
  label: string;
  amount: number;
  signPrefix?: "−";
  sub?: string;
  emphasize?: boolean;
}) {
  // Only an unsigned figure (net profit) can flag a loss — a signed flow
  // line (revenue, total expenses) is routine and never colored just for
  // carrying a sign, same convention the old P&L rows used.
  const isLoss = !signPrefix && amount < 0;
  const displayValue = signPrefix ? formatUZS(Math.abs(amount)) : formatUZS(amount);

  return (
    <div className={`rounded-2xl border bg-paper p-5 ${emphasize ? "border-2 border-ink" : "border-hairline"}`}>
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-2 font-display font-semibold tabular-nums ${emphasize ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} ${
          isLoss ? "text-hermes-600" : "text-ink"
        }`}
      >
        {signPrefix ? `${signPrefix} ` : ""}
        {displayValue}
      </p>
      {sub && <p className="mt-1 text-xs text-graphite">{sub}</p>}
    </div>
  );
}

function SourceBadge({ source }: { source: Order["source"] }) {
  const isPos = source === "pos";
  const Icon = isPos ? Store : Globe;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        isPos ? "border-navy/20 bg-navy/10 text-navy" : "border-hairline text-graphite"
      }`}
    >
      <Icon className="h-3 w-3" />
      {ORDER_SOURCE_LABELS[source]}
    </span>
  );
}

function Pager({
  page,
  pages,
  total,
  noun,
  onPrev,
  onNext,
}: {
  page: number;
  pages: number;
  total: number;
  noun: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline p-4 text-sm text-graphite">
      <button type="button" disabled={page <= 1} onClick={onPrev} className="btn-secondary disabled:opacity-40">
        ← Назад
      </button>
      <span>
        Стр. {page} из {pages} · {total} {noun}
      </span>
      <button type="button" disabled={page >= pages} onClick={onNext} className="btn-secondary disabled:opacity-40">
        Вперёд →
      </button>
    </div>
  );
}

function IncomeList({
  orders,
  loading,
  page,
  pages,
  total,
  onPrev,
  onNext,
}: {
  orders: Order[];
  loading: boolean;
  page: number;
  pages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (loading && orders.length === 0) {
    return (
      <div className="card mt-3 space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="card mt-3 overflow-x-auto p-0">
      <table className="admin-table w-full">
        <thead>
          <tr>
            <th>Дата</th>
            <th>Клиент</th>
            <th>Источник</th>
            <th className="text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order._id}>
              <td className="whitespace-nowrap text-graphite">{formatRu(order.createdAt)}</td>
              <td>{order.customer.name}</td>
              <td>
                <SourceBadge source={order.source} />
              </td>
              <td className="whitespace-nowrap text-right tabular-nums font-medium">{formatUZS(order.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="p-6 text-sm text-graphite">Поступлений за период не найдено.</p>}
      <Pager page={page} pages={pages} total={total} noun="заказов" onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

// First step of the unified "+" entry point — pick which kind of money
// movement is being recorded before showing either form.
function AddChoiceModal({
  onClose,
  onPickExpense,
  onPickSale,
}: {
  onClose: () => void;
  onPickExpense: () => void;
  onPickSale: () => void;
}) {
  return (
    <div className="anim-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="anim-modal card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Новая запись</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-graphite transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-3">
          <button type="button" onClick={onPickExpense} className="btn-secondary justify-start gap-3 py-4 text-base">
            <TrendingDown className="h-5 w-5 flex-none text-hermes-600" />
            Расход
          </button>
          <button type="button" onClick={onPickSale} className="btn-secondary justify-start gap-3 py-4 text-base">
            <TrendingUp className="h-5 w-5 flex-none text-hermes-600" />
            Продажа
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseFormModal({
  editingId,
  form,
  setForm,
  formError,
  saving,
  branches,
  showBranchField,
  onSubmit,
  onClose,
}: {
  editingId: string | null;
  form: ExpenseForm;
  setForm: React.Dispatch<React.SetStateAction<ExpenseForm>>;
  formError: string | null;
  saving: boolean;
  branches: Branch[];
  showBranchField: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="anim-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        className="anim-modal card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">{editingId ? "Редактировать расход" : "Новый расход"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-graphite transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
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

            {showBranchField && (
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
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
