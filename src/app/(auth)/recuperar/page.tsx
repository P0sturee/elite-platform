import Link from "next/link";
import type { Metadata } from "next";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ResetPage() {
  return (
    <>
      <h1 className="display text-4xl">Recuperar senha</h1>
      <p className="mt-2 mb-8 text-soft">Enviaremos um link para você criar uma nova senha.</p>
      <ResetForm />
      <p className="mt-6 text-sm text-mute">
        <Link href="/login" className="text-blue-2 hover:text-text">Voltar para o login</Link>
      </p>
    </>
  );
}
