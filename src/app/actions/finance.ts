"use server";

import { revalidatePath } from "next/cache";
import { actionAdmin, fail } from "@/lib/session";
import { parseMoney } from "@/lib/format";
import type { FormState, InstallmentStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y!, m! - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d!, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Splits a total into N monthly installments (the last one absorbs rounding). */
export async function createInstallments(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const projectId = str(form, "project_id");
    const total = parseMoney(str(form, "amount"));
    const count = Math.max(1, Math.min(48, Number(str(form, "count")) || 1));
    const firstDue = str(form, "first_due");
    const description = str(form, "description");
    if (!Number.isFinite(total) || total <= 0) return { error: "Informe um valor válido." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDue)) return { error: "Informe a data do primeiro vencimento." };

    const { data: last } = await supabase
      .from("installments").select("number").eq("project_id", projectId)
      .order("number", { ascending: false }).limit(1).maybeSingle();
    const start = (last?.number ?? 0) + 1;
    const base = Math.floor(total / count);
    const rows = Array.from({ length: count }, (_, i) => ({
      project_id: projectId,
      number: start + i,
      description: count > 1 ? `${description || "Parcela"} ${i + 1}/${count}` : description || "Parcela única",
      amount_cents: i === count - 1 ? total - base * (count - 1) : base,
      due_date: addMonths(firstDue, i),
    }));
    const { error } = await supabase.from("installments").insert(rows);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: count > 1 ? `${count} parcelas criadas.` : "Parcela criada." };
  } catch (e) {
    return fail(e);
  }
}

export async function setInstallmentStatus(form: FormData) {
  const { supabase } = await actionAdmin();
  const status = str(form, "status") as InstallmentStatus;
  await supabase
    .from("installments")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}

export async function deleteInstallment(form: FormData) {
  const { supabase } = await actionAdmin();
  await supabase.from("installments").delete().eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}

export async function saveSettings(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const { error } = await supabase
      .from("settings")
      .update({
        pix_key: str(form, "pix_key"),
        pix_name: str(form, "pix_name"),
        pix_city: str(form, "pix_city"),
        support_whatsapp: str(form, "support_whatsapp").replace(/\D/g, ""),
      })
      .eq("id", 1);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return fail(e);
  }
}
