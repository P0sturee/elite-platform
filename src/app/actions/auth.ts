"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { callPlatform } from "@/lib/platform";
import type { FormState } from "@/lib/types";

async function origin() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL || h.get("origin") || `https://${h.get("host")}`;
}

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/painel";
}

const authErrors: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar — enviamos um link para a sua caixa de entrada.",
  "User already registered": "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
};
const translate = (msg: string) =>
  authErrors[msg] ?? (msg.toLowerCase().includes("password") ? "A senha precisa ter pelo menos 8 caracteres." : msg);

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translate(error.message) };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const full_name = String(form.get("full_name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (full_name.length < 2) return { error: "Informe seu nome." };
  if (!email.includes("@")) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };

  // The Edge Function creates the account and sends our own confirmation e-mail (Resend).
  const { status, data } = await callPlatform<{ ok?: boolean }>({ action: "signup", email, password, full_name, company, phone });
  if (status === 409) return { error: "Já existe uma conta com este e-mail. Entre ou use “Esqueci minha senha”." };
  if (status === 429) return { error: "Muitas tentativas com este e-mail. Tente de novo em 1 hora." };
  if (status !== 200) return { error: "Não foi possível criar a conta agora. Tente de novo em instantes." };
  if (!data.ok) {
    return { ok: true, message: "Conta criada, mas o e-mail de confirmação não saiu. Use “Esqueci minha senha” no login para receber um link de acesso." };
  }
  return { ok: true, message: `Conta criada! Enviamos um link de confirmação para ${email}. Confira também a caixa de spam.` };
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Informe um e-mail válido." };
  await callPlatform({ action: "recovery", email });
  return { ok: true, message: "Se existir uma conta com este e-mail, você vai receber um link para criar uma nova senha." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== form.get("confirm")) return { error: "As senhas não conferem." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translate(error.message) };
  redirect("/painel");
}

export async function signInWithGoogle(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}` },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
