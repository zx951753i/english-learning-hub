import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-cream hover:bg-navy-deep",
  secondary: "border border-navy/30 bg-paper text-navy hover:bg-sky",
  danger: "border border-danger/40 bg-paper text-danger hover:bg-danger-soft",
  ghost: "text-muted hover:bg-sky hover:text-navy",
};

export const buttonClass = (variant: Variant = "primary") =>
  `inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-control px-4 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]}`;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${buttonClass(variant)} ${className}`} {...props} />;
}
