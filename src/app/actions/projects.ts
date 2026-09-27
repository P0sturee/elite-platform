"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionAdmin, actionUser, fail } from "@/lib/session";
import type { FormState, ProjectStatus, StageStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const dateOrNull = (form: FormData, key: string) => str(form, key) || null;

function normalizeUrl(url: string) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export async function createProject(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const { supabase } = await actionAdmin();
    const client_id = str(form, "client_id");
    const name = str(form, "name");
    if (!client_id) return { error: "Escolha o cliente." };
    if (name.length < 2) return { error: "Dê um nome ao projeto." };
    const { data, error } = await supabase
      .from("projects")
      .insert({
        client_id, name,
        kind: str(form, "kind"),
        summary: str(form, "summary"),
        staging_url: normalizeUrl(str(form, "staging_url")),
        start_date: dateOrNull(form, "start_date"),
        due_date: dateOrNull(form, "due_date"),
      })
      .select("id")
      .single();
    if (error) throw error;
    id = data.id;

    // Coming from a briefing: link it and make sure the client can see the project.
    const requestId = str(form, "request_id");
    if (requestId) await supabase.from("project_requests").update({ status: "converted", project_id: id }).eq("id", requestId);
    await supabase.from("profiles").update({ status: "active" }).eq("id", client_id).eq("status", "pending");
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/projetos/${id}`);
}

export async function updateProject(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const id = str(form, "id");
    const { error } = await supabase
      .from("projects")
      .update({
        name: str(form, "name"),
        kind: str(form, "kind"),
        summary: str(form, "summary"),
        status: str(form, "status") as ProjectStatus,
        staging_url: normalizeUrl(str(form, "staging_url")),
        start_date: dateOrNull(form, "start_date"),
        due_date: dateOrNull(form, "due_date"),
      })
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Projeto atualizado." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStage(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const status = str(form, "status") as StageStatus;
    const progress = Math.max(0, Math.min(100, Number(str(form, "progress")) || 0));
    const { error } = await supabase
      .from("project_stages")
      .update({
        status,
        progress: status === "done" ? 100 : status === "pending" ? 0 : progress,
        due_date: dateOrNull(form, "due_date"),
      })
      .eq("id", str(form, "id"));
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Etapa salva." };
  } catch (e) {
    return fail(e);
  }
}

export async function postUpdate(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, profile } = await actionAdmin();
    const title = str(form, "title");
    if (title.length < 2) return { error: "Escreva um título para a novidade." };
    const { error } = await supabase.from("project_updates").insert({
      project_id: str(form, "project_id"),
      stage_id: str(form, "stage_id") || null,
      author_id: profile.id,
      title,
      body: str(form, "body"),
    });
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, message: "Novidade publicada. O cliente foi avisado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteUpdate(form: FormData) {
  const { supabase } = await actionAdmin();
  await supabase.from("project_updates").delete().eq("id", str(form, "id"));
  revalidatePath("/", "layout");
}

export async function markProjectRead(projectId: string) {
  const { supabase, profile } = await actionUser();
  await supabase.from("project_reads").upsert({ project_id: projectId, user_id: profile.id, last_read_at: new Date().toISOString() });
}
