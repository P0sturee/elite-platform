"use server";

import { revalidatePath } from "next/cache";
import { actionAdmin, actionUser, fail } from "@/lib/session";
import type { FormState } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function requestApproval(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, profile } = await actionAdmin();
    const title = str(form, "title");
    if (title.length < 2) return { error: "Diga o que o cliente precisa aprovar." };
    let link = str(form, "link_url");
    if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`;
    const { error } = await supabase.from("approvals").insert({
      project_id: str(form, "project_id"),
      stage_id: str(form, "stage_id") || null,
      file_id: str(form, "file_id") || null,
      title,
      description: str(form, "description"),
      link_url: link,
      requested_by: profile.id,
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Aprovação enviada. O cliente foi avisado." };
  } catch (e) {
    return fail(e);
  }
}

export async function decideApproval(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionUser();
    const decision = str(form, "decision");
    const note = str(form, "note");
    if (decision === "changes_requested" && note.length < 3) return { error: "Conte o que precisa ser ajustado." };
    const { error } = await supabase.rpc("decide_approval", { p_id: str(form, "id"), p_decision: decision, p_note: note });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: decision === "approved" ? "Aprovado! A equipe já foi avisada." : "Pedido de ajustes enviado para a equipe." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteApproval(form: FormData) {
  const { supabase } = await actionAdmin();
  await supabase.from("approvals").delete().eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}
