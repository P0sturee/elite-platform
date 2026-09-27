const TZ = "America/Sao_Paulo";

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Parses "1.234,56", "1234.56" or "1234" into cents. */
export function parseMoney(input: string): number {
  const s = input.replace(/[^\d,.-]/g, "");
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : NaN;
}

function toDate(value: string | Date) {
  // plain dates ("2026-10-01") are calendar days, not instants
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + "T12:00:00");
  return new Date(value);
}

export function date(value: string | Date | null | undefined) {
  if (!value) return "—";
  return toDate(value).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
}

export function shortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return toDate(value).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(".", "");
}

export function dateTime(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function timeOnly(value: string | Date) {
  return new Date(value).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function relative(value: string | Date) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return date(value);
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

export function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function isOverdue(dueDate: string, status: string) {
  return status === "pending" && dueDate < todayISO();
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

/** Digits for wa.me links: adds Brazil's 55 when the number came without it. */
export function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
}

export function daysFromTodayISO(days: number) {
  return new Date(Date.now() + days * 86400_000).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function isPast(value: Date | string) {
  return new Date(value).getTime() < Date.now();
}
