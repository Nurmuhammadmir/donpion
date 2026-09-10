// The house wordmark — "Don" in ink, "Pion" in the bright brand orange.
// Used in the header, footer and mobile nav so the split never drifts out
// of sync between them.
export default function Logo({ className }: { className?: string }) {
  return (
    <span className={`font-display uppercase tracking-wide2 ${className ?? ""}`}>
      <span className="text-ink">Don</span>
      <span className="text-hermes-500">Pion</span>
    </span>
  );
}
