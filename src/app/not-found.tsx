import { ButtonLink, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center glow-bg px-4">
      <div className="max-w-md text-center">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <p className="eyebrow text-green">Erro 404</p>
        <h1 className="display mt-3 text-4xl">Página não encontrada</h1>
        <p className="mt-3 text-soft">O link pode estar incompleto ou você não tem acesso a este conteúdo.</p>
        <ButtonLink href="/painel" className="mt-8">Ir para o painel</ButtonLink>
      </div>
    </main>
  );
}
