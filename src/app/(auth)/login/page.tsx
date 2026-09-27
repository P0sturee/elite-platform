import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
import { GoogleButton } from "@/components/google-button";

export const metadata: Metadata = { title: "Entrar" };

const notices: Record<string, string> = {
  link: "Esse link expirou ou já foi usado. Entre com sua senha ou peça um novo.",
  google: "Não foi possível entrar com o Google agora. Tente com e-mail e senha.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const notice =
    typeof sp.erro === "string" ? notices[sp.erro]
    : sp.bloqueado ? "Esta conta está bloqueada. Fale com a Elite Systems."
    : undefined;
  return (
    <>
      <p className="eyebrow text-green">Bem-vindo de volta</p>
      <h1 className="display mt-3 text-4xl">Entrar</h1>
      <p className="mt-2 mb-8 text-soft">
        Ainda não tem conta? <Link href={next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro"} className="text-blue-2 hover:text-text">Criar conta</Link>
      </p>
      {next?.startsWith("/novo-projeto") && !notice && (
        <p className="mb-6 rounded-xl bg-blue/10 px-3.5 py-2.5 text-sm text-blue-2">
          Entre ou crie sua conta para enviar o briefing. Suas respostas do site já estão guardadas.
        </p>
      )}
      {notice && <p role="alert" className="mb-6 rounded-xl bg-amber/10 px-3.5 py-2.5 text-sm text-amber">{notice}</p>}
      <GoogleButton next={next} />
      <LoginForm next={next} />
    </>
  );
}
