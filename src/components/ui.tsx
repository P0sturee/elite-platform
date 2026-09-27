import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/labels";
import { initials } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "subtle" | "danger" | "success";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-blue text-white hover:bg-[#3f78ff] shadow-[0_8px_30px_-10px_rgb(45_107_255/0.7)]",
  ghost: "border border-line-2 text-text hover:border-blue-2 hover:text-white",
  subtle: "bg-surface-2 text-soft hover:text-text hover:bg-[#15213f]",
  danger: "border border-red/40 text-red hover:bg-red/10",
  success: "bg-green text-bg hover:bg-[#3de3a0]",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none",
    variants[variant], sizes[size], extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const toneClass: Record<Tone, string> = {
  blue: "bg-blue/15 text-blue-2 ring-blue/25",
  green: "bg-green/12 text-green ring-green/25",
  red: "bg-red/12 text-red ring-red/25",
  amber: "bg-amber/12 text-amber ring-amber/25",
  mute: "bg-white/5 text-mute ring-white/10",
};

export function Badge({ tone = "mute", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider ring-1 ring-inset whitespace-nowrap", toneClass[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Card({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action, eyebrow }: { title: ReactNode; action?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-mute mb-1">{eyebrow}</p>}
        <h2 className="font-semibold text-text truncate">{title}</h2>
      </div>
      {action}
    </header>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 animate-rise">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow text-green mb-3 flex items-center gap-2.5"><span className="h-px w-5 bg-current" />{eyebrow}</p>}
        <h1 className="display text-3xl sm:text-[40px] leading-[1.02]">{title}</h1>
        {description && <p className="mt-3 text-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-white/6", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue to-green transition-[width] duration-700" style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon && <div className="grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 text-blue-2">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-mute">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36, admin }: { name: string; size?: number; admin?: boolean }) {
  return (
    <span
      className={cx("grid shrink-0 place-items-center rounded-full font-mono font-medium", admin ? "bg-blue text-white" : "bg-surface-2 text-blue-2 ring-1 ring-line-2")}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line-2 bg-surface-2/70 px-3.5 text-[15px] text-text placeholder:text-mute/80 transition focus:border-blue focus:outline-none focus:ring-3 focus:ring-blue/25";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(fieldBase, "min-h-28 py-3 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(fieldBase, "h-11 appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20fill=%22none%22%20stroke=%22%237F8AA6%22%20stroke-width=%222%22%3E%3Cpath%20d=%22M2%204l4%204%204-4%22/%3E%3C/svg%3E')] bg-[position:right_14px_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-soft">{label}</label>
      {children}
      {hint && <p className="text-xs text-mute">{hint}</p>}
    </div>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; error?: string; message?: string } }) {
  if (!state?.error && !state?.message) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={cx("rounded-xl px-3.5 py-2.5 text-sm", state.error ? "bg-red/10 text-red" : "bg-green/10 text-green")}>
      {state.error ?? state.message}
    </p>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "green" | "red" | "amber" }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4">
      <p className="text-[13px] text-mute">{label}</p>
      <p className="display mt-1 text-2xl tabular">{value}</p>
      {hint && <p className={cx("mt-1 font-mono text-[11px]", tone === "green" ? "text-green" : tone === "red" ? "text-red" : tone === "amber" ? "text-amber" : "text-mute")}>{hint}</p>}
    </div>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 30 30" className="size-7 shrink-0" aria-hidden="true">
        <rect x=".75" y=".75" width="28.5" height="28.5" rx="8" fill="none" stroke="#2D6BFF" strokeWidth="1.5" />
        <rect x="8" y="8" width="14" height="3" rx="1.5" fill="#E9EEF8" />
        <rect x="8" y="13.5" width="9" height="3" rx="1.5" fill="#19D98B" />
        <rect x="8" y="19" width="14" height="3" rx="1.5" fill="#E9EEF8" />
      </svg>
      {!compact && (
        <span className="display text-[14px] tracking-[0.04em] whitespace-nowrap">
          ELITE <span className="text-blue-2">SYSTEMS</span>
        </span>
      )}
    </span>
  );
}
