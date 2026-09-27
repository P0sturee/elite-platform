import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single<Profile>();
  if (!profile) return null;
  return { supabase, profile };
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.profile.status === "blocked") redirect("/login?bloqueado=1");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.profile.role !== "admin") redirect("/painel");
  return session;
}

/** Throws inside server actions instead of redirecting. */
export async function actionUser() {
  const session = await getSession();
  if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
  return session;
}

export async function actionAdmin() {
  const session = await actionUser();
  if (session.profile.role !== "admin") throw new Error("Apenas a equipe Elite Systems pode fazer isso.");
  return session;
}

export function fail(e: unknown) {
  return { error: e instanceof Error ? e.message : "Algo deu errado. Tente de novo." };
}
