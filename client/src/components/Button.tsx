import { Link } from "@/i18n/Link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type ButtonProps =
  | ({ href: string; variant?: "primary" | "outline" } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined; variant?: "primary" | "outline" } & ButtonHTMLAttributes<HTMLButtonElement>);

// The house button system: strict rectangles, no gradients, no glow — a
// solid Hermès-orange fill for the one primary action per screen, and a
// quiet ink-outline for everything secondary.
export default function Button({ href, variant = "primary", children, className, ...props }: ButtonProps) {
  const base = variant === "primary" ? "btn-primary" : "btn-outline";

  if (href) {
    return (
      <Link href={href} className={`${base} ${className ?? ""}`} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={`${base} ${className ?? ""}`} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
