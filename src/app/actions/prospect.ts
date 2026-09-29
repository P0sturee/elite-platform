"use server";

import { revalidatePath } from "next/cache";
import { actionAdmin, fail } from "@/lib/session";
import { callProspect } from "@/lib/platform";
import type { FormState, LeadStatus } from "@/lib/types";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const PATH = "/admin/prospeccao";

async function call<T>(body: Record<string, unknown>) {
  const { supabase } = await actionAdmin();
  const { data: { session } } = await supabase.auth.getSession();
  const { status, data } = await callProspect<T & { error?: string }>(body, session?.access_token);
  if (status !== 200) throw new Error(data?.error ?? `Erro ${status}`);
  return data;
}

/** Liga (configura o webhook da Evolution) ou pausa o robô. */
export async function toggleProspecting(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const enable = str(form, "enabled") === "1";
    if (enable) {
      const [{ data: keys }, { data: st }] = await Promise.all([
        supabase.rpc("prospect_integrations"),
        supabase.from("prospect_settings").select("lead_source").eq("id", 1).single(),
      ]);
      if (!(keys?.gemini || keys?.anthropic)) return { error: "Cadastre a chave do Gemini em Ajustes antes de ligar." };
      if (st?.lead_source === "google" && !keys?.google) return { error: "Para buscar no Google Maps, cadastre a chave do Google Places (ou troque a fonte para OpenStreetMap)." };
      const { count } = await supabase.from("prospect_searches").select("id", { count: "exact", head: true }).eq("active", true);
      if (!count) return { error: "Adicione pelo menos uma busca (segmento + cidade) antes de ligar." };
      await call({ action: "setup" });
    }
    const { error } = await supabase.from("prospect_settings")
      .update({ enabled: enable, paused_reason: enable ? "" : "Pausado por você.", send_errors: 0 }).eq("id", 1);
    if (error) throw error;
    revalidatePath(PATH);
    return { ok: true, message: enable ? "Robô ligado. Ele envia só em horário comercial, no ritmo da primeira semana." : "Robô pausado." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProspectSettings(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const daily_max = Number(str(form, "daily_max"));
    const window_start = Number(str(form, "window_start"));
    const window_end = Number(str(form, "window_end"));
    if (!(daily_max >= 5 && daily_max <= 80)) return { error: "O limite diário vai de 5 a 80 mensagens." };
    if (!(window_start >= 6 && window_end <= 22 && window_end > window_start)) return { error: "Horário inválido: entre 6h e 22h, com o fim depois do início." };
    const openers = str(form, "openers").split(/\n\s*---\s*\n/).map((o) => o.trim()).filter(Boolean);
    if (!openers.length) return { error: "Escreva pelo menos uma mensagem de abertura." };
    if (openers.some((o) => !o.includes("{empresa}"))) return { error: "Cada mensagem de abertura precisa ter {empresa} (varia o texto e personaliza)." };
    if (openers.some((o) => !/sair/i.test(o))) return { error: "Mantenha em cada mensagem a opção de responder SAIR — protege o número e respeita a LGPD." };
    const pitch = str(form, "pitch");
    if (pitch.length < 40) return { error: "Descreva o OrçaPro para a IA (pelo menos algumas linhas)." };
    const { error } = await supabase.from("prospect_settings").update({
      daily_max, window_start, window_end, weekdays_only: form.get("weekdays_only") === "on",
      sender_name: str(form, "sender_name"), openers, pitch, lead_source: str(form, "lead_source") === "google" ? "google" : "osm",
    }).eq("id", 1);
    if (error) throw error;
    revalidatePath(PATH);
    return { ok: true, message: "Ajustes salvos." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveProspectKey(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const name = str(form, "name");
    const value = str(form, "value");
    if (!["google_places_key", "gemini_api_key", "anthropic_api_key"].includes(name)) return { error: "Chave inválida." };
    if (value && value.length < 20) return { error: "Essa chave parece incompleta." };
    const { error } = await supabase.rpc("prospect_save_key", { p_name: name, p_value: value });
    if (error) throw error;
    revalidatePath(PATH);
    return { ok: true, message: value ? "Chave salva no cofre." : "Chave removida." };
  } catch (e) {
    return fail(e);
  }
}

/** Cria uma busca para cada combinação segmento × cidade. */
export async function addSearches(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await actionAdmin();
    const split = (v: string) => v.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const segments = split(str(form, "segments"));
    const cities = split(str(form, "cities"));
    if (!segments.length || !cities.length) return { error: "Informe pelo menos um segmento e uma cidade." };
    const queries = segments.flatMap((s) => cities.map((c) => `${s} em ${c}`.slice(0, 120)));
    if (queries.length > 60) return { error: "Muitas combinações de uma vez (máx. 60). Divida em partes." };
    let added = 0;
    for (const query of queries) {
      const { error } = await supabase.from("prospect_searches").insert({ query });
      if (!error) added++;
      else if (error.code !== "23505") throw error; // 23505: the same search already exists
    }
    revalidatePath(PATH);
    return { ok: true, message: added ? `${added} busca(s) adicionada(s).` : "Essas buscas já existiam." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSearch(form: FormData) {
  const { supabase } = await actionAdmin();
  const id = str(form, "id");
  const op = str(form, "op");
  if (op === "delete") await supabase.from("prospect_searches").delete().eq("id", id);
  else if (op === "restart") await supabase.from("prospect_searches").update({ exhausted: false, page_token: null, active: true }).eq("id", id);
  else await supabase.from("prospect_searches").update({ active: op === "activate" }).eq("id", id);
  revalidatePath(PATH);
}

export async function runSearchNow(_: FormState, form: FormData): Promise<FormState> {
  try {
    const r = await call<{ inserted: number; exhausted: boolean }>({ action: "search", id: str(form, "id") });
    revalidatePath(PATH);
    return { ok: true, message: `${r.inserted} empresa(s) com telefone entraram na fila${r.exhausted ? " — busca concluída" : ""}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLead(form: FormData) {
  const { supabase } = await actionAdmin();
  const id = str(form, "id");
  const op = str(form, "op");
  const changes: Record<string, unknown> =
    op === "resume" ? { bot_paused: false, handoff_at: null, status: "replied" as LeadStatus }
    : op === "pause" ? { bot_paused: true, reply_due_at: null }
    : { status: op as LeadStatus, bot_paused: true, reply_due_at: null };
  if (!["resume", "pause", "meeting", "not_interested", "interested"].includes(op)) return;
  await supabase.from("prospect_leads").update(changes).eq("id", id);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/${id}`);
}

export async function sendLeadMessage(_: FormState, form: FormData): Promise<FormState> {
  try {
    const id = str(form, "id");
    const text = str(form, "text");
    if (!text) return { error: "Escreva a mensagem." };
    await call({ action: "send", id, text });
    revalidatePath(`${PATH}/${id}`);
    return { ok: true, message: "Enviada. O robô não responde mais esta conversa." };
  } catch (e) {
    return fail(e);
  }
}
