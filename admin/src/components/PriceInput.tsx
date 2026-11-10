// A 6-7 digit UZS sum (common for bouquets, expenses, batch costs) is hard
// to read or double-check while typing — "1500000" vs "15000000" look
// nearly identical at a glance. This groups by thousands live, the same
// way every displayed price in the app already does (Intl "ru-RU": a
// space every 3 digits, e.g. "1 500 000" — not a comma, which in Russian
// notation is a decimal point, not a thousands separator). The value/
// onChange contract is still the plain digit string the rest of the form
// already stores — only what's drawn in the box changes.
export default function PriceInput({
  value,
  onChange,
  className = "input",
  placeholder,
  required,
  autoFocus,
}: {
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const digits = value.replace(/\D/g, "");
  const display = digits ? new Intl.NumberFormat("ru-RU").format(Number(digits)) : "";

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      required={required}
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder={placeholder}
      className={className}
    />
  );
}
