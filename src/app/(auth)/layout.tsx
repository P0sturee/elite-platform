import Link from "next/link";
import { Logo } from "@/components/ui";

const points = [
  ["Linha do tempo", "cada etapa do seu sistema, com progresso e datas"],
  ["Aprovações", "aprove protótipos e entregas com um clique"],
  ["Arquivos e mensagens", "tudo do projeto num só lugar, fora do WhatsApp"],
  ["Financeiro", "parcelas e Pix copia e cola sempre à mão"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line glow-bg lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_70%_30%,#000_20%,transparent_75%)]" />
        <Link href="/" className="relative w-fit"><Logo /></Link>
        <div className="relative max-w-lg">
          <p className="eyebrow mb-5 flex items-center gap-2.5 text-green">
            <span className="size-2 rounded-full bg-green shadow-[0_0_12px] shadow-green" />Plataforma do cliente
          </p>
          <h1 className="display text-5xl leading-[0.95] xl:text-6xl">
            Seu sistema,<br />
            <span className="text-transparent [-webkit-text-stroke:1.5px_var(--color-text)]">em tempo</span><br />
            real.
          </h1>
          <ul className="mt-10 grid gap-4">
            {points.map(([title, text]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-green/15 ring-1 ring-green/40">
                  <span className="size-1.5 rounded-full bg-green" />
                </span>
                <p className="text-soft"><span className="font-semibold text-text">{title}</span> — {text}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative eyebrow text-mute">© 2026 Elite Systems</p>
      </aside>
      <main className="flex flex-col justify-center px-4 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md animate-rise">
          <div className="mb-10 lg:hidden"><Logo /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
