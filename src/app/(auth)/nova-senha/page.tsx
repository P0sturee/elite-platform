import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function NewPasswordPage() {
  return (
    <>
      <h1 className="display text-4xl">Nova senha</h1>
      <p className="mt-2 mb-8 text-soft">Escolha a senha que você vai usar a partir de agora.</p>
      <NewPasswordForm />
    </>
  );
}
