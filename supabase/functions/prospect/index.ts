// Elite Systems — "prospect" Edge Function: robô de prospecção do OrçaPro.
// action=tick                  (pg_cron a cada minuto, x-notify-secret) → responde leads, manda a 1ª mensagem, busca empresas
// ?hook=<wa_webhook_secret>    (webhook da Evolution API, MESSAGES_UPSERT) → registra respostas e agenda a resposta da IA
// action=setup|search|send     (JWT de admin) → liga o webhook, busca agora, responde manualmente pelo painel
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

type Cfg = Partial<Record<
  "google_places_key" | "anthropic_api_key" | "evolution_url" | "evolution_api_key" | "evolution_instance" |
  "notify_secret" | "wa_webhook_secret" | "app_url" | "functions_url",
  string
>>;
type Settings = {
  enabled: boolean; daily_max: number; window_start: number; window_end: number; weekdays_only: boolean;
  warmup_started: string | null; next_send_at: string | null; send_errors: number;
  sender_name: string; openers: string[]; pitch: string;
};
type Lead = {
  id: string; name: string; phone: string; wa_jid: string; category: string; address: string; status: string;
  bot_paused: boolean; bot_turns: number; reply_due_at: string | null;
};
type Msg = { author: "lead" | "bot" | "admin"; body: string; created_at: string };

const MODEL = "claude-opus-5-5";
const TZ_OFFSET = "-03:00"; // Brasília (sem horário de verão)
const MAX_BOT_TURNS = 4;
const REPLY_HOURS = [8, 21]; // a IA só responde nesse intervalo (hora local)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function secretKey() {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (key) return key as string;
  } catch { /* fall back to the legacy key */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const db = createClient(SUPABASE_URL, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

let cache: { cfg: Cfg; at: number } | null = null;
async function config(): Promise<Cfg> {
  if (cache && Date.now() - cache.at < 60_000) return cache.cfg;
  const { data, error } = await db.rpc("prospect_config");
  if (error) throw new Error(`config: ${error.message}`);
  cache = { cfg: (data ?? {}) as Cfg, at: Date.now() };
  return cache.cfg;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- time (Brasília)
function local(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      weekday: "short", hourCycle: "h23",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekend: parts.weekday === "Sat" || parts.weekday === "Sun",
  };
}
const atLocal = (date: string, hour: number, minute = 0) =>
  new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${TZ_OFFSET}`);

// The number is already warm; prospecting (messages to people who don't have it saved) still ramps up for a week,
// never above the admin's daily cap.
function dailyLimit(s: Settings, today: string) {
  const day = s.warmup_started ? Math.floor((Date.parse(today) - Date.parse(s.warmup_started)) / 86_400_000) : 0;
  const ramp = day < 2 ? 25 : day < 6 ? 35 : 80;
  return Math.min(ramp, s.daily_max);
}

// ---------------------------------------------------------------- phones
/** Brazilian mobile as 55 + DDD + 9 digits, or "" (landlines rarely have WhatsApp). */
function mobile(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 10 && /[6-9]/.test(d[2]!)) d = d.slice(0, 2) + "9" + d.slice(2); // old 8-digit mobile
  return d.length === 11 && d[2] === "9" ? `55${d}` : "";
}
/** Phone digits from a WhatsApp JID ("5541999999999@s.whatsapp.net"), with the 9th digit restored. */
function jidPhone(jid: unknown) {
  const s = String(jid ?? "");
  return s.endsWith("@s.whatsapp.net") ? mobile(s.split("@")[0]!) : "";
}

// ---------------------------------------------------------------- Evolution API (WhatsApp)
async function evo(cfg: Cfg, path: string, init: RequestInit = {}) {
  if (!cfg.evolution_url || !cfg.evolution_api_key) throw new Error("WhatsApp não configurado");
  const res = await fetch(cfg.evolution_url.replace(/\/$/, "") + path, {
    ...init,
    headers: { apikey: cfg.evolution_api_key, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: body as any };
}
const instance = (cfg: Cfg) => cfg.evolution_instance || "elite-systems";

async function waOpen(cfg: Cfg) {
  const r = await evo(cfg, `/instance/connectionState/${instance(cfg)}`);
  return (r.body?.instance?.state ?? r.body?.state) === "open";
}

/** Sends a text with a "digitando…" pause proportional to its length. Returns the WhatsApp message id. */
async function sendText(cfg: Cfg, number: string, text: string) {
  const r = await evo(cfg, `/message/sendText/${instance(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ number, text, delay: Math.round(Math.min(9000, 1800 + text.length * 35)), linkPreview: false }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return String(r.body?.key?.id ?? "") || null;
}

async function whatsappJid(cfg: Cfg, phone: string) {
  const r = await evo(cfg, `/chat/whatsappNumbers/${instance(cfg)}`, { method: "POST", body: JSON.stringify({ numbers: [phone] }) });
  if (!r.ok) throw new Error(`Evolution ${r.status}`);
  const row = Array.isArray(r.body) ? r.body[0] : undefined;
  return row?.exists ? String(row.jid ?? "") || `${phone}@s.whatsapp.net` : null;
}

async function record(lead: Lead, author: Msg["author"], body: string, waId: string | null) {
  const { error } = await db.from("prospect_messages").insert({
    lead_id: lead.id, direction: author === "lead" ? "in" : "out", author, body, wa_id: waId,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function notifyAdmins(title: string, body: string, link: string) {
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  if (!admins?.length) return;
  await db.from("notifications").insert(admins.map((a) => ({ user_id: a.id, kind: "prospect", title: title.slice(0, 200), body: body.slice(0, 400), link })));
}

async function senderName(s: Settings) {
  if (s.sender_name.trim()) return s.sender_name.trim();
  const { data } = await db.from("profiles").select("full_name").eq("role", "admin").order("created_at").limit(1).maybeSingle();
  return String(data?.full_name ?? "").split(" ")[0] || "Pedro";
}

// ---------------------------------------------------------------- Google Places (API oficial do Google Maps)
const PLACE_FIELDS = [
  "places.id", "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.websiteUri", "places.googleMapsUri", "places.rating", "places.userRatingCount", "places.primaryTypeDisplayName",
  "places.businessStatus", "nextPageToken",
].join(",");

async function runSearch(cfg: Cfg, search: { id: string; query: string; page_token: string | null; found: number; pages: number }) {
  if (!cfg.google_places_key) throw new Error("Cadastre a chave do Google Places em Prospecção → Ajustes.");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": cfg.google_places_key, "X-Goog-FieldMask": PLACE_FIELDS },
    body: JSON.stringify({ textQuery: search.query, languageCode: "pt-BR", regionCode: "BR", pageSize: 20, ...(search.page_token ? { pageToken: search.page_token } : {}) }),
  });
  const body = await res.json().catch(() => ({})) as any;
  if (!res.ok) {
    const msg = String(body?.error?.message ?? `Google ${res.status}`).slice(0, 300);
    await db.from("prospect_searches").update({ last_error: msg, last_run_at: new Date().toISOString() }).eq("id", search.id);
    throw new Error(msg);
  }

  // never prospect the platform's own clients
  const { data: clients } = await db.from("profiles").select("phone");
  const known = new Set((clients ?? []).map((c) => mobile(String(c.phone ?? ""))).filter(Boolean));

  let inserted = 0;
  for (const p of (body.places ?? []) as any[]) {
    if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
    const phone = mobile(String(p.internationalPhoneNumber || p.nationalPhoneNumber || ""));
    if (!phone || known.has(phone)) continue;
    const { error } = await db.from("prospect_leads").insert({
      search_id: search.id, place_id: String(p.id), name: String(p.displayName?.text ?? "Empresa").slice(0, 160), phone,
      category: String(p.primaryTypeDisplayName?.text ?? ""), address: String(p.formattedAddress ?? ""),
      website: String(p.websiteUri ?? ""), maps_url: String(p.googleMapsUri ?? ""),
      rating: typeof p.rating === "number" ? p.rating : null, reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    });
    if (!error) inserted++;
  }
  const next = body.nextPageToken ? String(body.nextPageToken) : null;
  await db.from("prospect_searches").update({
    page_token: next, exhausted: !next, pages: search.pages + 1, found: search.found + inserted, last_error: "", last_run_at: new Date().toISOString(),
  }).eq("id", search.id);
  return { inserted, exhausted: !next };
}

/** Keeps a small queue of companies to contact; one Google request per tick at most. */
async function discover(cfg: Cfg) {
  if (!cfg.google_places_key) return;
  const { count } = await db.from("prospect_leads").select("id", { count: "exact", head: true }).eq("status", "new");
  if ((count ?? 0) >= 20) return;
  const { data: search } = await db.from("prospect_searches").select("id, query, page_token, found, pages")
    .eq("active", true).eq("exhausted", false).order("last_run_at", { ascending: true, nullsFirst: true }).limit(1).maybeSingle();
  if (search) await runSearch(cfg, search).catch((e) => console.error("search", e.message));
}

// ---------------------------------------------------------------- first contact
function opener(s: Settings, lead: Lead, name: string) {
  const list = s.openers.filter((o) => o.trim());
  const text = list[Math.floor(Math.random() * list.length)] ?? "";
  const hour = local().hour;
  return text
    .replaceAll("{empresa}", lead.name)
    .replaceAll("{nome}", name)
    .replaceAll("{saudacao}", hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
}

async function pause(reason: string) {
  await db.from("prospect_settings").update({ enabled: false, paused_reason: reason }).eq("id", 1);
  await notifyAdmins("Prospecção pausada", reason, "/admin/prospeccao");
}

async function sendNext(cfg: Cfg, s: Settings) {
  const now = local();
  if (s.weekdays_only && now.weekend) return;
  if (now.hour < s.window_start || now.hour >= s.window_end) return;
  if (s.next_send_at && Date.now() < Date.parse(s.next_send_at)) return;
  if (!s.warmup_started) {
    s.warmup_started = now.date;
    await db.from("prospect_settings").update({ warmup_started: now.date }).eq("id", 1);
  }
  const limit = dailyLimit(s, now.date);
  const { count: sent } = await db.from("prospect_leads").select("id", { count: "exact", head: true })
    .gte("contacted_at", atLocal(now.date, 0).toISOString());
  if ((sent ?? 0) >= limit) return;

  const name = await senderName(s);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: lead } = await db.from("prospect_leads").select("*").eq("status", "new").order("created_at").limit(1).maybeSingle<Lead>();
    if (!lead) return;
    const jid = await whatsappJid(cfg, lead.phone);
    if (!jid) {
      await db.from("prospect_leads").update({ status: "no_whatsapp" }).eq("id", lead.id);
      continue;
    }
    const text = opener(s, lead, name);
    try {
      const waId = await sendText(cfg, lead.phone, text);
      await record(lead, "bot", text, waId);
      await db.from("prospect_leads").update({ status: "contacted", contacted_at: new Date().toISOString(), wa_jid: jid, error: "" }).eq("id", lead.id);
      // spread the day's messages over the whole window, with jitter, never closer than 4 minutes
      const spacing = ((s.window_end - s.window_start) * 60) / limit;
      const gapMin = Math.max(4, spacing * rand(0.6, 1.4));
      await db.from("prospect_settings").update({ send_errors: 0, next_send_at: new Date(Date.now() + gapMin * 60_000).toISOString() }).eq("id", 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("prospect_leads").update({ status: "error", error: msg.slice(0, 300) }).eq("id", lead.id);
      const errors = s.send_errors + 1;
      await db.from("prospect_settings").update({ send_errors: errors, next_send_at: new Date(Date.now() + 10 * 60_000).toISOString() }).eq("id", 1);
      if (errors >= 3) await pause("3 falhas seguidas ao enviar pelo WhatsApp. Confira a conexão do número antes de religar.");
    }
    return;
  }
}

// ---------------------------------------------------------------- AI replies
const DECISION_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["interested", "question", "not_interested", "opt_out", "human_needed"] },
    reply: { type: "string" },
    summary: { type: "string" },
  },
  required: ["intent", "reply", "summary"],
  additionalProperties: false,
};
type Decision = { intent: "interested" | "question" | "not_interested" | "opt_out" | "human_needed"; reply: string; summary: string };

function systemPrompt(pitch: string, name: string) {
  return `Você responde, pelo WhatsApp, empresas que receberam uma mensagem de prospecção do OrçaPro enviada em nome de ${name}. Seu trabalho é entender a resposta, tirar dúvidas simples e, se houver interesse, deixar a apresentação encaminhada para ${name} marcar.

Sobre o OrçaPro:
${pitch}

Como responder:
- Português do Brasil, simpático e direto, como uma pessoa no WhatsApp: 1 a 3 frases curtas, sem listas, sem markdown, no máximo um emoji.
- Use só as informações acima. Não invente preços, descontos, prazos, integrações ou recursos. Se perguntarem preço, diga que depende do tamanho da empresa e que na apresentação ${name} mostra o plano ideal (os planos também estão em orcapro.site).
- Se perguntarem se é robô ou atendimento automático, seja honesto: você é o assistente virtual do OrçaPro e quem faz a apresentação é o ${name}.
- Se perguntarem de onde veio o contato, diga que foi do perfil público da empresa no Google Maps.
- Nunca peça dados sensíveis (CPF, senha, cartão) e não mande links além de orcapro.site.
- O objetivo é uma apresentação online rápida (15 a 20 minutos). Não proponha dias nem horários.

Classifique a situação depois da última mensagem do cliente (intent) e escreva a resposta (reply):
- "interested": aceitou a apresentação, pediu para ver o sistema, perguntou como contratar ou quando pode ser. A resposta agradece e diz que você vai verificar o melhor horário na agenda e já retorna por aqui para confirmar.
- "question": fez uma pergunta ou comentário e ainda não decidiu. Responda e, quando fizer sentido, convide para a apresentação.
- "not_interested": disse que não tem interesse, já usa outro sistema e não quer trocar, ou pediu para deixar para depois sem data. Agradeça com educação em uma frase, sem insistir.
- "opt_out": pediu para parar de receber mensagens ou reclamou do contato. Peça desculpas pelo incômodo e diga que não vai mais mandar mensagens.
- "human_needed": áudio, imagem, assunto fora do OrçaPro, negociação, reclamação séria ou qualquer dúvida em que você não tenha certeza. Responda apenas que vai pedir para o ${name} responder pessoalmente.

summary: uma linha para o ${name} saber o que o cliente quer (ex.: "Quer ver o sistema; tem 3 técnicos e hoje usa planilha").`;
}

async function decide(cfg: Cfg, s: Settings, lead: Lead, msgs: Msg[], name: string): Promise<Decision | null> {
  if (!cfg.anthropic_api_key) return null;
  const client = new Anthropic({ apiKey: cfg.anthropic_api_key });
  const transcript = msgs.map((m) => `${m.author === "lead" ? "Cliente" : name}: ${m.body}`).join("\n");
  const params: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: DECISION_SCHEMA } },
    system: systemPrompt(s.pitch, name),
    messages: [{
      role: "user",
      content: `Empresa: ${lead.name}${lead.category ? ` (${lead.category})` : ""}${lead.address ? ` — ${lead.address}` : ""}\n\nConversa até agora:\n${transcript}\n\nDecida a próxima resposta.`,
    }],
  };
  // deno-lint-ignore no-explicit-any
  const res = await client.beta.messages.create(params as any) as any;
  if (res.stop_reason === "refusal") return { intent: "human_needed", reply: "", summary: "A IA não quis responder esta conversa." };
  const text = (res.content as any[]).find((b) => b.type === "text")?.text;
  if (!text) return null;
  const d = JSON.parse(text) as Decision;
  return { intent: d.intent, reply: String(d.reply ?? "").trim(), summary: String(d.summary ?? "").trim() };
}

async function answerDue(cfg: Cfg, s: Settings) {
  const { data: due } = await db.from("prospect_leads").select("*").lte("reply_due_at", new Date().toISOString())
    .order("reply_due_at").limit(3).returns<Lead[]>();
  if (!due?.length) return;
  const now = local();
  const name = await senderName(s);
  for (const lead of due) {
    if (lead.bot_paused || !["contacted", "replied"].includes(lead.status)) {
      await db.from("prospect_leads").update({ reply_due_at: null }).eq("id", lead.id);
      continue;
    }
    if (now.hour < REPLY_HOURS[0] || now.hour >= REPLY_HOURS[1]) {
      // answer next morning, a few minutes after 8h
      const next = now.hour >= REPLY_HOURS[1] ? new Date(Date.now() + 86_400_000) : new Date();
      await db.from("prospect_leads").update({ reply_due_at: atLocal(local(next).date, REPLY_HOURS[0], Math.floor(rand(2, 40))).toISOString() }).eq("id", lead.id);
      continue;
    }
    await db.from("prospect_leads").update({ reply_due_at: null }).eq("id", lead.id);
    const { data: msgs } = await db.from("prospect_messages").select("author, body, created_at").eq("lead_id", lead.id).order("created_at").limit(40);

    let d: Decision | null = null;
    try {
      d = await decide(cfg, s, lead, (msgs ?? []) as Msg[], name);
    } catch (e) {
      console.error("ai", e instanceof Error ? e.message : e);
    }
    if (!d) d = { intent: "human_needed", reply: "", summary: cfg.anthropic_api_key ? "A IA falhou ao responder." : "Chave da Anthropic não cadastrada." };
    const turns = lead.bot_turns + 1;
    if (d.intent === "question" && turns >= MAX_BOT_TURNS) d = { ...d, intent: "human_needed" };

    if (d.reply) {
      try {
        const waId = await sendText(cfg, lead.phone, d.reply);
        await record(lead, "bot", d.reply, waId);
      } catch (e) {
        console.error("reply", e instanceof Error ? e.message : e);
        d = { intent: "human_needed", reply: "", summary: `Não consegui enviar a resposta pelo WhatsApp. ${d.summary}`.trim() };
      }
    }
    const update: Record<string, unknown> = { bot_turns: turns, summary: d.summary.slice(0, 300) };
    if (d.intent === "interested" || d.intent === "human_needed") {
      Object.assign(update, { status: d.intent === "interested" ? "interested" : "replied", bot_paused: true, handoff_at: new Date().toISOString() });
      await notifyAdmins(
        d.intent === "interested" ? `Quer apresentação: ${lead.name}` : `Precisa de você: ${lead.name}`,
        d.summary || "Abra a conversa para continuar.",
        `/admin/prospeccao/${lead.id}`,
      );
    } else if (d.intent === "not_interested") update.status = "not_interested";
    else if (d.intent === "opt_out") update.status = "opted_out";
    else update.status = "replied";
    await db.from("prospect_leads").update(update).eq("id", lead.id);
  }
}

// ---------------------------------------------------------------- webhook (Evolution → here)
const OPT_OUT = /^\s*(sair|pare|parar|stop|remover|descadastrar|cancelar)\s*[.!]*\s*$/i;

function messageText(message: any): string {
  if (!message) return "";
  const text = message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? message.videoMessage?.caption;
  if (text) return String(text);
  if (message.audioMessage) return "[o cliente enviou um áudio]";
  if (message.imageMessage) return "[o cliente enviou uma imagem]";
  if (message.documentMessage) return "[o cliente enviou um documento]";
  if (message.stickerMessage || message.reactionMessage) return "";
  return "[o cliente enviou uma mensagem sem texto]";
}

async function findLead(key: any, m: any): Promise<Lead | null> {
  const jids = [key.remoteJid, key.remoteJidAlt, key.senderPn, key.participant, m.remoteJidAlt]
    .map((j) => String(j ?? "")).filter((j) => j.endsWith("@s.whatsapp.net"));
  const phones = [...new Set(jids.map(jidPhone).filter(Boolean))];
  if (!phones.length && !jids.length) return null;
  const filters = [
    ...(phones.length ? [`phone.in.(${phones.join(",")})`] : []),
    ...(jids.length ? [`wa_jid.in.(${jids.map((j) => `"${j}"`).join(",")})`] : []),
  ];
  const { data } = await db.from("prospect_leads").select("*").or(filters.join(",")).limit(1).maybeSingle<Lead>();
  return data ?? null;
}

async function onMessage(cfg: Cfg, m: any) {
  const key = m?.key ?? {};
  const remote = String(key.remoteJid ?? "");
  if (!remote || remote.endsWith("@g.us") || remote === "status@broadcast") return;
  const text = messageText(m.message).trim();
  if (!text) return;
  const lead = await findLead(key, m);
  if (!lead || lead.status === "new") return; // not a prospect we contacted (clients, friends, other chats)
  const waId = key.id ? String(key.id) : null;

  if (key.fromMe) {
    // Our own API sends echo back here; anything else was typed by you on the phone → the bot steps aside.
    const known = async () => !!waId && !!(await db.from("prospect_messages").select("id").eq("wa_id", waId).maybeSingle()).data;
    if (await known()) return;
    await sleep(3000);
    if (await known()) return;
    await record(lead, "admin", text, waId);
    await db.from("prospect_leads").update({ bot_paused: true, reply_due_at: null }).eq("id", lead.id);
    return;
  }

  await record(lead, "lead", text, waId);
  const now = new Date();
  if (lead.bot_paused || !["contacted", "replied"].includes(lead.status)) {
    await db.from("prospect_leads").update({ last_inbound_at: now.toISOString() }).eq("id", lead.id);
    return;
  }
  if (OPT_OUT.test(text)) {
    const reply = "Combinado, não vou mais te mandar mensagens. Desculpe o incômodo e bom trabalho!";
    const id = await sendText(cfg, lead.phone, reply).catch(() => null);
    await record(lead, "bot", reply, id);
    await db.from("prospect_leads").update({ status: "opted_out", reply_due_at: null, last_inbound_at: now.toISOString(), summary: "Pediu para sair." }).eq("id", lead.id);
    return;
  }
  // wait a bit so several short messages get a single answer
  await db.from("prospect_leads").update({
    status: "replied", last_inbound_at: now.toISOString(), reply_due_at: new Date(now.getTime() + rand(35, 70) * 1000).toISOString(),
  }).eq("id", lead.id);
}

// ---------------------------------------------------------------- admin
async function requireAdmin(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await db.from("profiles").select("id, role").eq("id", data.user.id).single();
  return p?.role === "admin" ? p : null;
}

async function setupWebhook(cfg: Cfg) {
  if (!cfg.functions_url || !cfg.wa_webhook_secret) throw new Error("functions_url ou segredo do webhook ausente");
  const url = `${cfg.functions_url.replace(/\/$/, "")}/prospect?hook=${cfg.wa_webhook_secret}`;
  const r = await evo(cfg, `/webhook/set/${instance(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] } }),
  });
  if (!r.ok) throw new Error(`Evolution ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`);
  return true;
}

// ---------------------------------------------------------------- entry
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = new URL(req.url);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const cfg = await config();

  // Evolution webhook
  if (url.searchParams.has("hook")) {
    if (!cfg.wa_webhook_secret || url.searchParams.get("hook") !== cfg.wa_webhook_secret) return json({ error: "unauthorized" }, 401);
    const event = String(body.event ?? "").toLowerCase().replace("_", ".");
    if (event !== "messages.upsert") return json({ ignored: event });
    const items = Array.isArray(body.data) ? body.data : [body.data];
    for (const m of items) await onMessage(cfg, m).catch((e) => console.error("hook", e instanceof Error ? e.message : e));
    return json({ ok: true });
  }

  const action = String(body.action ?? "");
  if (action === "tick") {
    if (!cfg.notify_secret || req.headers.get("x-notify-secret") !== cfg.notify_secret) return json({ error: "unauthorized" }, 401);
    const { data: claimed } = await db.rpc("prospect_claim_tick");
    if (!claimed) return json({ skipped: "busy" });
    const { data: s } = await db.from("prospect_settings").select("*").eq("id", 1).single<Settings>();
    if (!s?.enabled) return json({ skipped: "disabled" });
    try {
      if (!(await waOpen(cfg))) {
        await pause("O WhatsApp da Elite está desconectado. Reconecte em Configurações e religue a prospecção.");
        return json({ paused: "whatsapp" });
      }
      await answerDue(cfg, s);
      await sendNext(cfg, s);
      await discover(cfg);
      return json({ ok: true });
    } catch (e) {
      console.error("tick", e instanceof Error ? e.message : e);
      return json({ error: e instanceof Error ? e.message : "erro" }, 500);
    } finally {
      await db.from("prospect_settings").update({ tick_lock_until: null }).eq("id", 1);
    }
  }

  const me = await requireAdmin(req);
  if (!me) return json({ error: "forbidden" }, 403);
  try {
    if (action === "setup") {
      if (!(await waOpen(cfg))) return json({ error: "Conecte o WhatsApp em Configurações antes de ligar a prospecção." }, 400);
      await setupWebhook(cfg);
      return json({ ok: true });
    }
    if (action === "search") {
      const { data: search } = await db.from("prospect_searches").select("id, query, page_token, found, pages").eq("id", body.id).single();
      if (!search) return json({ error: "Busca não encontrada." }, 404);
      return json(await runSearch(cfg, search));
    }
    if (action === "send") {
      const text = String(body.text ?? "").trim();
      const { data: lead } = await db.from("prospect_leads").select("*").eq("id", body.id).single<Lead>();
      if (!lead || !text) return json({ error: "Mensagem vazia." }, 400);
      const waId = await sendText(cfg, lead.phone, text);
      await record(lead, "admin", text, waId);
      await db.from("prospect_leads").update({ bot_paused: true, reply_due_at: null }).eq("id", lead.id);
      return json({ ok: true });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
  return json({ error: "unknown action" }, 400);
});
