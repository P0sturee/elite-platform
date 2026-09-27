import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { waNumber } from "@/lib/format";

// Called by Supabase (pg_net) for every new notification row.
// Delivers it by e-mail (Resend) and WhatsApp (Meta Cloud API) according to the user's preferences.

type Row = {
  id: string; kind: string; title: string; body: string; link: string; emailed_at: string | null; whatsapp_at: string | null;
  profiles: { email: string; full_name: string; phone: string; notify_email: boolean; notify_whatsapp: boolean; status: string } | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function emailHtml(n: Row, url: string, name: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#05070E;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#E9EEF8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070E;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0A1020;border:1px solid #1A2440;border-radius:18px">
<tr><td style="padding:28px 32px 0;font-weight:800;letter-spacing:.06em;font-size:13px">ELITE <span style="color:#79A2FF">SYSTEMS</span></td></tr>
<tr><td style="padding:24px 32px 8px">
<p style="margin:0 0 6px;color:#7F8AA6;font-size:14px">Olá, ${esc(name)}</p>
<h1 style="margin:0;font-size:22px;line-height:1.25;color:#E9EEF8">${esc(n.title)}</h1>
${n.body ? `<p style="margin:14px 0 0;color:#AEB8CD;font-size:15px;line-height:1.6">${esc(n.body)}</p>` : ""}
</td></tr>
<tr><td style="padding:24px 32px 32px"><a href="${url}" style="display:inline-block;background:#2D6BFF;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 22px;border-radius:999px">Abrir na plataforma</a></td></tr>
</table>
<p style="max-width:560px;margin:18px auto 0;color:#7F8AA6;font-size:12px;line-height:1.5">Você recebe este e-mail porque tem uma conta na plataforma Elite Systems. Ajuste seus avisos em Minha conta.</p>
</td></tr></table></body></html>`;
}

export async function POST(req: Request) {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret || req.headers.get("x-notify-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db
    .from("notifications")
    .select("id, kind, title, body, link, emailed_at, whatsapp_at, profiles(email, full_name, phone, notify_email, notify_whatsapp, status)")
    .eq("id", id)
    .single();
  const n = data as unknown as Row | null;
  if (!n?.profiles || n.profiles.status === "blocked") return NextResponse.json({ skipped: true });

  const p = n.profiles;
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
  const url = `${base}${n.link || "/notificacoes"}`;
  const firstName = (p.full_name || "").split(" ")[0] || "cliente";
  const result: Record<string, string> = {};

  if (process.env.RESEND_API_KEY && p.notify_email && !n.emailed_at) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Elite Systems <onboarding@resend.dev>",
      to: p.email,
      subject: n.title,
      html: emailHtml(n, url, firstName),
      text: `Olá, ${firstName}\n\n${n.title}\n${n.body}\n\nAbrir na plataforma: ${url}`,
    });
    result.email = error ? `error: ${error.message}` : "sent";
    if (!error) await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (token && phoneId && p.notify_whatsapp && p.phone && n.kind !== "file" && !n.whatsapp_at) {
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v23.0"}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: waNumber(p.phone),
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE || "aviso_plataforma",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "pt_BR" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: firstName },
              { type: "text", text: n.title.slice(0, 180) },
              { type: "text", text: url },
            ],
          }],
        },
      }),
    });
    result.whatsapp = res.ok ? "sent" : `error: ${res.status}`;
    if (res.ok) await db.from("notifications").update({ whatsapp_at: new Date().toISOString() }).eq("id", n.id);
  }

  return NextResponse.json(result);
}
