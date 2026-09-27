"use client";

import { Button } from "@/components/ui";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <p className="eyebrow text-red">Algo deu errado</p>
      <h1 className="display mt-3 text-3xl">Não conseguimos carregar esta tela</h1>
      <p className="mt-3 text-soft">Verifique sua conexão e tente de novo. Se continuar, abra um chamado no Suporte.</p>
      <Button className="mt-8" onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
