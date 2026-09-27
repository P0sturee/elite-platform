import type { Metadata } from "next";
import { Badge, ButtonLink, Card, CardHeader, PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/session";
import { accountStatus } from "@/lib/labels";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const { profile } = await requireUser();
  const st = accountStatus[profile.status];
  return (
    <>
      <PageHeader eyebrow="Conta" title="Minha conta" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-7"><ProfileForm profile={profile} /></Card>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Situação" />
            <dl className="grid gap-4 p-5 text-sm">
              <div className="flex items-center justify-between"><dt className="text-mute">Conta</dt><dd><Badge tone={st.tone} dot>{st.label}</Badge></dd></div>
              <div className="flex items-center justify-between"><dt className="text-mute">Cliente desde</dt><dd>{date(profile.created_at)}</dd></div>
            </dl>
          </Card>
          <Card className="p-5">
            <p className="font-semibold">Senha</p>
            <p className="mt-1 mb-4 text-sm text-mute">Defina uma nova senha para entrar na plataforma.</p>
            <ButtonLink href="/nova-senha" variant="ghost" size="sm">Trocar senha</ButtonLink>
          </Card>
        </div>
      </div>
    </>
  );
}
