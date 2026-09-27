"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/session";
import type { FileCategory } from "@/lib/types";

const BUCKET = "project-files";

/** Records a file the browser already uploaded to storage under `<projectId>/…`. */
export async function registerFile(input: { projectId: string; name: string; path: string; size: number; mime: string; category: FileCategory }) {
  const { supabase, profile } = await actionUser();
  if (!input.path.startsWith(input.projectId + "/")) throw new Error("Caminho de arquivo inválido.");
  const category = profile.role === "admin" ? input.category : "outro";
  const { error } = await supabase.from("files").insert({
    project_id: input.projectId,
    uploaded_by: profile.id,
    name: input.name.slice(0, 200),
    storage_path: input.path,
    size: input.size,
    mime: input.mime,
    category,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error("Não foi possível salvar o arquivo. Tente de novo.");
  }
  revalidatePath("/", "layout");
}

export async function fileDownloadUrl(fileId: string) {
  const { supabase } = await actionUser();
  const { data: file } = await supabase.from("files").select("name, storage_path").eq("id", fileId).single();
  if (!file) throw new Error("Arquivo não encontrado.");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, 60 * 5, { download: file.name });
  if (error || !data) throw new Error("Não foi possível gerar o link de download.");
  return data.signedUrl;
}

export async function deleteFile(form: FormData) {
  const { supabase } = await actionUser();
  const id = String(form.get("id") ?? "");
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", id).single();
  if (!file) return;
  const { error } = await supabase.from("files").delete().eq("id", id);
  if (!error) await supabase.storage.from(BUCKET).remove([file.storage_path]);
  revalidatePath("/", "layout");
}
