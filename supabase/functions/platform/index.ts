// Elite Systems — "platform" Edge Function.
// action=notify            (database trigger, x-notify-secret)  → e-mail (Resend) + WhatsApp (Evolution API)
// action=signup | recovery (public, rate limited)               → confirmation / password-reset e-mails
// action=wa_* | mail_test  (admin user JWT)                     → WhatsApp connection and test messages
import { createClient } from "npm:@supabase/supabase-js@2";

type Cfg = Partial<Record<
  "resend_api_key" | "email_from" | "email_from_fallback" | "evolution_url" | "evolution_api_key" | "evolution_instance" | "notify_secret" | "app_url",
  string
>>;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function secretKey() {
  try {
    const key = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
    if (key) return key as string;
  } catch { /* fall back to the legacy key */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const admin = createClient(SUPABASE_URL, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

let cache: { cfg: Cfg; at: number } | null = null;
async function config(): Promise<Cfg> {
  if (cache && Date.now() - cache.at < 60_000) return cache.cfg;
  const { data, error } = await admin.rpc("delivery_config");
  if (error) throw new Error(`config: ${error.message}`);
  cache = { cfg: (data ?? {}) as Cfg, at: Date.now() };
  return cache.cfg;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const appUrl = (cfg: Cfg) => (cfg.app_url || "https://elitesystems.online").replace(/\/$/, "");

function emailHtml(o: { greeting: string; title: string; body?: string; cta: string; url: string; footer: string }) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#05070E;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#E9EEF8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070E;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0A1020;border:1px solid #1A2440;border-radius:18px">
<tr><td style="padding:28px 32px 0;font-weight:800;letter-spacing:.06em;font-size:13px;color:#E9EEF8">ELITE <span style="color:#79A2FF">SYSTEMS</span></td></tr>
<tr><td style="padding:24px 32px 8px">
<p style="margin:0 0 6px;color:#7F8AA6;font-size:14px">${esc(o.greeting)}</p>
<h1 style="margin:0;font-size:22px;line-height:1.25;color:#E9EEF8">${esc(o.title)}</h1>
${o.body ? `<p style="margin:14px 0 0;color:#AEB8CD;font-size:15px;line-height:1.6">${esc(o.body)}</p>` : ""}
</td></tr>
<tr><td style="padding:24px 32px 32px"><a href="${o.url}" style="display:inline-block;background:#2D6BFF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:999px">${esc(o.cta)}</a></td></tr>
</table>
<p style="max-width:560px;margin:18px auto 0;color:#7F8AA6;font-size:12px;line-height:1.5">${esc(o.footer)}</p>
</td></tr></table></body></html>`;
}

// Tries the main sender first; while its domain is not verified in Resend (403/422) it falls back.
async function sendEmail(cfg: Cfg, to: string, subject: string, html: string, text: string) {
  if (!cfg.resend_api_key) return "skipped: no key";
  const senders = [cfg.email_from, cfg.email_from_fallback].filter((f): f is string => !!f);
  if (!senders.length) senders.push("Elite Systems <onboarding@resend.dev>");
  let last = "";
  for (const from of senders) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.resend_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (res.ok) return "sent";
    last = `error ${res.status}: ${await res.text()}`;
    if (res.status !== 403 && res.status !== 422) break;
  }
  return last;
}

function waNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 12 && digits.startsWith("55") ? digits : `55${digits}`;
}

async function evo(cfg: Cfg, path: string, init: RequestInit = {}) {
  if (!cfg.evolution_url || !cfg.evolution_api_key) throw new Error("WhatsApp não configurado");
  const res = await fetch(cfg.evolution_url.replace(/\/$/, "") + path, {
    ...init,
    headers: { apikey: cfg.evolution_api_key, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: body as Record<string, any> };
}
const instance = (cfg: Cfg) => cfg.evolution_instance || "elite-systems";

async function sendWhatsApp(cfg: Cfg, phone: string, text: string) {
  const r = await evo(cfg, `/message/sendText/${instance(cfg)}`, {
    method: "POST",
    body: JSON.stringify({ number: waNumber(phone), text }),
  });
  return r.ok ? "sent" : `error ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`;
}

async function waState(cfg: Cfg) {
  const r = await evo(cfg, `/instance/connectionState/${instance(cfg)}`);
  if (r.status === 404) return { state: "missing" as const };
  const state = (r.body?.instance?.state ?? r.body?.state ?? "unknown") as string;
  let number = "", profileName = "";
  if (state === "open") {
    const f = await evo(cfg, `/instance/fetchInstances?instanceName=${instance(cfg)}`);
    const row = Array.isArray(f.body) ? f.body[0] : undefined;
    number = String(row?.ownerJid ?? row?.number ?? "").split("@")[0];
    profileName = String(row?.profileName ?? "");
  }
  return { state, number, profileName };
}

async function requireAdmin(req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;
  const { data: p } = await admin.from("profiles").select("id, email, full_name, phone, role").eq("id", data.user.id).single();
  return p?.role === "admin" ? p : null;
}

async function mailAllowed(email: string, kind: string) {
  const { data } = await admin.rpc("auth_mail_allowed", { p_email: email, p_kind: kind });
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const cfg = await config();
  const action = String(body.action ?? "");

  // ---------------------------------------------------------------- notification delivery
  if (action === "notify") {
    if (!cfg.notify_secret || req.headers.get("x-notify-secret") !== cfg.notify_secret) return json({ error: "unauthorized" }, 401);
    const { data: n } = await admin
      .from("notifications")
      .select("id, kind, title, body, link, emailed_at, whatsapp_at, profiles(email, full_name, phone, notify_email, notify_whatsapp, status)")
      .eq("id", body.id)
      .single();
    const p = (n as any)?.profiles;
    if (!n || !p || p.status === "blocked") return json({ skipped: true });
    const url = `${appUrl(cfg)}${n.link || "/notificacoes"}`;
    const firstName = String(p.full_name || "").split(" ")[0] || "cliente";
    const result: Record<string, string> = {};

    if (p.notify_email && !n.emailed_at) {
      result.email = await sendEmail(cfg, p.email, n.title,
        emailHtml({ greeting: `Olá, ${firstName}`, title: n.title, body: n.body, cta: "Abrir na plataforma", url,
          footer: "Você recebe este e-mail porque tem uma conta na plataforma Elite Systems. Ajuste seus avisos em Minha conta." }),
        `Olá, ${firstName}\n\n${n.title}\n${n.body}\n\nAbrir na plataforma: ${url}`);
      if (result.email === "sent") await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    }
    if (p.notify_whatsapp && p.phone && n.kind !== "file" && !n.whatsapp_at && cfg.evolution_url) {
      const text = `*Elite Systems*\n\nOlá, ${firstName}!\n*${n.title}*${n.body ? `\n${n.body}` : ""}\n\nAcesse: ${url}`;
      result.whatsapp = await sendWhatsApp(cfg, p.phone, text).catch((e) => `error: ${e.message}`);
      if (result.whatsapp === "sent") await admin.from("notifications").update({ whatsapp_at: new Date().toISOString() }).eq("id", n.id);
    }
    return json(result);
  }

  // ---------------------------------------------------------------- auth e-mails
  if (action === "signup") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email.includes("@") || password.length < 8) return json({ error: "invalid" }, 400);
    if (!(await mailAllowed(email, "signup"))) return json({ error: "rate_limited" }, 429);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { data: { full_name: String(body.full_name ?? ""), company: String(body.company ?? ""), phone: String(body.phone ?? "") } },
    });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message) || ["email_exists", "user_already_exists"].includes(String((error as any).code));
      return json({ error: exists ? "exists" : error.message }, exists ? 409 : 400);
    }
    const nextPath = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "/painel";
    const link = `${appUrl(cfg)}/auth/callback?token_hash=${data.properties.hashed_token}&type=signup&next=${encodeURIComponent(nextPath)}`;
    const name = String(body.full_name ?? "").split(" ")[0] || "tudo bem";
    const sent = await sendEmail(cfg, email, "Confirme seu e-mail — Elite Systems",
      emailHtml({ greeting: `Olá, ${name}`, title: "Confirme seu e-mail para acessar a plataforma",
        body: "Falta só um clique. Depois disso você já pode enviar o briefing do seu projeto e acompanhar tudo por aqui.",
        cta: "Confirmar e-mail", url: link, footer: "Se você não criou esta conta, ignore este e-mail." }),
      `Confirme seu e-mail: ${link}`);
    return json({ ok: sent === "sent", email: sent });
  }

  if (action === "recovery") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@") || !(await mailAllowed(email, "recovery"))) return json({ ok: true });
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.properties?.hashed_token) return json({ ok: true });
    const link = `${appUrl(cfg)}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery&next=/nova-senha`;
    await sendEmail(cfg, email, "Crie uma nova senha — Elite Systems",
      emailHtml({ greeting: "Olá", title: "Crie uma nova senha", body: "Recebemos um pedido para trocar a senha da sua conta. O link vale por 1 hora.",
        cta: "Criar nova senha", url: link, footer: "Se não foi você, ignore este e-mail — sua senha continua a mesma." }),
      `Crie uma nova senha: ${link}`);
    return json({ ok: true });
  }

  // ---------------------------------------------------------------- admin tools
  const me = await requireAdmin(req);
  if (!me) return json({ error: "forbidden" }, 403);

  try {
    if (action === "status") {
      const whatsapp = cfg.evolution_url ? await waState(cfg).catch((e) => ({ state: "error", error: e.message })) : { state: "not_configured" };
      return json({ email: { configured: !!cfg.resend_api_key, from: cfg.email_from ?? "" }, whatsapp });
    }
    if (action === "wa_connect") {
      const current = await waState(cfg);
      if (current.state === "open") return json({ state: "open" });
      const r = current.state === "missing"
        ? await evo(cfg, "/instance/create", { method: "POST", body: JSON.stringify({ instanceName: instance(cfg), integration: "WHATSAPP-BAILEYS", qrcode: true }) })
        : await evo(cfg, `/instance/connect/${instance(cfg)}`);
      const qr = r.body?.qrcode?.base64 ?? r.body?.base64 ?? null;
      const pairingCode = r.body?.qrcode?.pairingCode ?? r.body?.pairingCode ?? null;
      return json({ state: "connecting", qr, pairingCode, error: r.ok ? undefined : `Evolution ${r.status}` });
    }
    if (action === "wa_logout") {
      await evo(cfg, `/instance/logout/${instance(cfg)}`, { method: "DELETE" });
      return json({ ok: true });
    }
    if (action === "wa_test") {
      if (!me.phone) return json({ error: "Cadastre seu WhatsApp em Minha conta para receber o teste." }, 400);
      const r = await sendWhatsApp(cfg, me.phone, "*Elite Systems*\n\nTeste de aviso da plataforma. Se você recebeu, o WhatsApp está funcionando ✅");
      return json({ result: r });
    }
    if (action === "mail_test") {
      const r = await sendEmail(cfg, me.email, "Teste de e-mail — Elite Systems",
        emailHtml({ greeting: "Olá", title: "O envio de e-mails está funcionando", body: "Este é um teste enviado pelo painel da equipe.",
          cta: "Abrir a plataforma", url: `${appUrl(cfg)}/admin/config`, footer: "E-mail de teste da plataforma Elite Systems." }),
        "O envio de e-mails da plataforma Elite Systems está funcionando.");
      return json({ result: r });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro" }, 500);
  }
  return json({ error: "unknown action" }, 400);
});
