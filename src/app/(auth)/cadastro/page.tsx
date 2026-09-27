import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";
import { GoogleButton } from "@/components/google-button";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage({ searchParams }: PageProps<"/cadastro">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <>
      <p className="eyebrow text-green">Comece por aqui</p>
      <h1 className="display mt-3 text-4xl">Criar conta</h1>
      <p className="mt-2 mb-8 text-soft">
        Crie sua conta e envie o briefing do seu projeto. Quando a equipe vincular o projeto, tudo aparece no seu painel.{" "}
        Já tem conta? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-blue-2 hover:text-text">Entrar</Link>
      </p>
      <GoogleButton />
      <SignupForm next={next} />
    </>
  );
}
