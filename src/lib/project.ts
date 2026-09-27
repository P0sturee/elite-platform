import type { Installment, Stage } from "./types";
import { isOverdue } from "./format";

export function projectProgress(stages: Pick<Stage, "progress" | "status">[]) {
  if (!stages.length) return 0;
  const total = stages.reduce((sum, s) => sum + (s.status === "done" ? 100 : s.progress), 0);
  return Math.round(total / stages.length);
}

export function currentStage<T extends Pick<Stage, "status" | "position">>(stages: T[]) {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  return sorted.find((s) => s.status === "in_progress") ?? sorted.find((s) => s.status === "pending") ?? sorted.at(-1);
}

export function installmentState(i: Pick<Installment, "status" | "due_date">) {
  return isOverdue(i.due_date, i.status) ? "overdue" : i.status;
}

export function financeSummary(items: Installment[]) {
  const active = items.filter((i) => i.status !== "cancelled");
  const paid = active.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount_cents, 0);
  const total = active.reduce((s, i) => s + i.amount_cents, 0);
  const overdue = active.filter((i) => installmentState(i) === "overdue");
  const next = active.filter((i) => i.status === "pending").sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  return { total, paid, open: total - paid, overdue, next };
}
