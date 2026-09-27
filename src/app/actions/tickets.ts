"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionAdmin, actionUser, fail } from "@/lib/session";
import type { FormState, TicketPriority, TicketStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createTicket(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const { supabase, profile } = await actionUser();
    if (profile.status !== "active") return { error: "O suporte fica disponível depois que sua conta for aprovada." };
    const subject = str(form, "subject");
    const body = str(form, "body");
    if (subject.length < 3) return { error: "Escreva um assunto curto para o chamado." };
    if (body.length < 5) return { error: "Descreva o que está acontecendo." };
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        client_id: profile.id,
        project_id: str(form, "project_id") || null,
        subject,
        priority: (str(form, "priority") || "normal") as TicketPriority,
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;
    const { error: msgError } = await supabase.from("ticket_messages").insert({ ticket_id: id, author_id: profile.id, body });
    if (msgError) throw msgError;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/suporte/${id}`);
}

export async function replyTicket(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, profile } = await actionUser();
    const body = str(form, "body");
    if (!body) return { error: "Escreva sua resposta." };
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: str(form, "ticket_id"), author_id: profile.id, body });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTicket(form: FormData) {
  const { supabase } = await actionAdmin();
  const patch: { status?: TicketStatus; priority?: TicketPriority } = {};
  if (form.get("status")) patch.status = str(form, "status") as TicketStatus;
  if (form.get("priority")) patch.priority = str(form, "priority") as TicketPriority;
  await supabase.from("tickets").update(patch).eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}
