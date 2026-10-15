"use client";

const PREFIX = "+998";

interface PhoneInputProps {
  value: string;
  onChange: (fullValue: string) => void;
  required?: boolean;
}

// (99) 999 99 99 — grouped 2/3/2/2 so a run of 9 digits stays easy to read
// back at a glance instead of running together.
function formatLocalDigits(digits: string): string {
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 7);
  const part4 = digits.slice(7, 9);

  let result = "";
  if (part1) result += `(${part1}`;
  if (part1.length === 2) result += ")";
  if (part2) result += ` ${part2}`;
  if (part3) result += ` ${part3}`;
  if (part4) result += ` ${part4}`;
  return result;
}

// The "+998" country code is fixed and shown outside the editable field —
// the visitor only ever types their local digits, formatted live as they
// type. The stored value (passed to onChange) always stays plain digits
// with the "+998" prefix; only the on-screen display is grouped/punctuated.
export default function PhoneInput({ value, onChange, required }: PhoneInputProps) {
  const rawDigits = (value.startsWith(PREFIX) ? value.slice(PREFIX.length) : value.replace(/^\+?998/, ""))
    .replace(/\D/g, "")
    .slice(0, 9);

  return (
    <div className="flex">
      <span className="flex items-center border border-r-0 border-hairline bg-hermes-50/30 px-3 text-sm text-ink">
        {PREFIX}
      </span>
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatLocalDigits(rawDigits)}
        onChange={(e) => onChange(PREFIX + e.target.value.replace(/\D/g, "").slice(0, 9))}
        className="input flex-1"
        placeholder="(90) 000 00 00"
      />
    </div>
  );
}
