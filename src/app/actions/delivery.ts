"use server";

import { actionAdmin } from "@/lib/session";
import { callPlatform } from "@/lib/platform";

export type DeliveryStatus = {
  email?: { configured: boolean; from: string };
  whatsapp?: { state: string; number?: string; profileName?: string; error?: string };
  error?: string;
};

async function call<T>(action: string) {
  const { supabase } = await actionAdmin();
  const { data: { session } } = await supabase.auth.getSession();
  const { status, data } = await callPlatform<T & { error?: string }>({ action }, session?.access_token);
  if (status !== 200) return { error: data?.error ?? `Erro ${status}` } as T & { error?: string };
  return data;
}

export async function deliveryStatus() {
  return call<DeliveryStatus>("status");
}

export async function whatsappConnect() {
  return call<{ state?: string; qr?: string | null; pairingCode?: string | null; error?: string }>("wa_connect");
}

export async function whatsappLogout() {
  return call<{ ok?: boolean; error?: string }>("wa_logout");
}

export async function whatsappTest() {
  return call<{ result?: string; error?: string }>("wa_test");
}

export async function emailTest() {
  return call<{ result?: string; error?: string }>("mail_test");
}
