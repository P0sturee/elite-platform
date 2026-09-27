"use server";

import { revalidatePath } from "next/cache";
import { actionAdmin, actionUser, fail } from "@/lib/session";
import type { AccountStatus, FormState, RequestStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, profile } = await actionUser();
    const full_name = str(form, "full_name");
    if (full_name.length < 2) return { error: "Informe seu nome." };
    const phone = str(form, "phone").replace(/\D/g, "");
    const notify_whatsapp = form.get("notify_whatsapp") === "on";
    if (notify_whatsapp && phone.length < 10) return { error: "Para receber avisos no WhatsApp, informe o número com DDD." };
    const { error } = await supabase
      .from("profiles")
      .update({ full_name, company: str(form, "company"), phone, notify_email: form.get("notify_email") === "on", notify_whatsapp })
      .eq("id", profile.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Dados salvos." };
  } catch (e) {
    return fail(e);
  }
}

export async function setClientStatus(form: FormData) {
  const { supabase } = await actionAdmin();
  await supabase.from("profiles").update({ status: str(form, "status") as AccountStatus }).eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const { supabase, profile } = await actionUser();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", profile.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function createRequest(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, profile } = await actionUser();
    const types = form.getAll("types").map(String).filter(Boolean);
    const context = str(form, "context");
    if (!types.length) return { error: "Escolha pelo menos um tipo de sistema." };
    if (context.length < 10) return { error: "Conte um pouco mais sobre o que você precisa." };
    const { error } = await supabase.from("project_requests").insert({
      client_id: profile.id,
      types,
      team_size: str(form, "team_size"),
      priority: str(form, "priority"),
      budget: str(form, "budget"),
      deadline: str(form, "deadline"),
      context,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Pedido enviado! A equipe vai analisar e falar com você em até 1 dia útil." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRequest(form: FormData) {
  const { supabase } = await actionAdmin();
  const patch: { status?: RequestStatus; admin_note?: string } = {};
  if (form.get("status")) patch.status = str(form, "status") as RequestStatus;
  if (form.has("admin_note")) patch.admin_note = str(form, "admin_note");
  await supabase.from("project_requests").update(patch).eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}
