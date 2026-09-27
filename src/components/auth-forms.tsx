"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset, signIn, signUp, updatePassword } from "@/app/actions/auth";
import { Field, FormMessage, Input } from "./ui";
import { SubmitButton } from "./ui-client";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" />
      </Field>
      <Field label="Senha" htmlFor="password" hint={<Link href="/recuperar" className="text-blue-2 hover:text-text">Esqueci minha senha</Link>}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Entrando…" className="mt-2 w-full">Entrar</SubmitButton>
    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" htmlFor="full_name">
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Empresa" htmlFor="company">
          <Input id="company" name="company" autoComplete="organization" />
        </Field>
      </div>
      <Field label="WhatsApp" htmlFor="phone" hint="Com DDD. Usamos para avisar sobre o seu projeto.">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(41) 99999-9999" />
      </Field>
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Criando conta…" className="mt-2 w-full">Criar conta</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(requestReset, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="E-mail da conta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage state={state} />
      {!state?.ok && <SubmitButton pendingText="Enviando…" className="mt-2 w-full">Enviar link</SubmitButton>}
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="grid gap-4">
      <Field label="Nova senha" htmlFor="password" hint="Mínimo de 8 caracteres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…" className="mt-2 w-full">Salvar e entrar</SubmitButton>
    </form>
  );
}
