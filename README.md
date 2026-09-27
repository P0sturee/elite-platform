# Plataforma Elite Systems

Área do cliente da Elite Systems: o cliente cria a conta, envia o briefing e acompanha cada projeto
(linha do tempo, aprovações, arquivos, mensagens, financeiro com Pix e suporte). A equipe gerencia tudo
pelo painel administrativo.

**Stack:** Next.js 16 (App Router) · Supabase (Auth, Postgres com RLS, Storage, Realtime) · Tailwind v4 ·
Resend (e-mail) · WhatsApp Cloud API (Meta) · deploy na Vercel.

## Funcionalidades

| Cliente | Equipe (admin) |
| --- | --- |
| Cadastro com e-mail/senha (Google opcional) | Aprovar/bloquear cadastros |
| Painel com pendências, projetos e novidades | Fila de trabalho: cadastros, pedidos, ajustes, vencidos, chamados |
| Linha do tempo com as 5 etapas e progresso | Editar etapas, prazos e publicar novidades |
| Aprovar ou pedir ajustes em entregas | Pedir aprovação com link ou arquivo |
| Arquivos do projeto (upload até 50 MB) | Arquivos com categoria (contrato, protótipo, entrega…) |
| Chat em tempo real por projeto | Chat com todos os clientes |
| Parcelas com Pix copia e cola + QR Code | Criar parcelas, marcar como paga, visão financeira geral |
| Chamados de suporte com prazo por prioridade | Gerenciar status e prioridade dos chamados |
| Briefing de novo projeto | Converter pedido em projeto com um clique |
| Avisos no sininho, e-mail e WhatsApp | Configurar Pix e ver status das integrações |

## Configuração

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo).
2. Rode os arquivos de `supabase/migrations/` em ordem (SQL Editor ou `supabase db push`).
3. **Authentication → URL Configuration:** *Site URL* = URL da Vercel; em *Redirect URLs* adicione
   `https://SEU-APP.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`.
4. **Authentication → SMTP:** use o Resend como SMTP (o e-mail padrão do Supabase só envia poucos e-mails por hora).
5. O primeiro login com **elitesystems.br@gmail.com** vira administrador automaticamente
   (lista em `public.admin_emails`).

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha. Na Vercel, cadastre as mesmas variáveis.

### 3. Deploy na Vercel
Importe o repositório na Vercel (framework Next.js, sem configuração extra).

### 4. Disparo de avisos (depois do deploy)
No SQL Editor do Supabase, com o mesmo valor de `NOTIFY_SECRET` da Vercel:

```sql
insert into private.config (key, value) values
  ('app_url', 'https://SEU-APP.vercel.app'),
  ('notify_secret', 'MESMO_VALOR_DO_NOTIFY_SECRET')
on conflict (key) do update set value = excluded.value;
```

### 5. E-mail (Resend)
Verifique o domínio `elitesystems.online` no Resend (registros DNS) e use
`EMAIL_FROM="Elite Systems <avisos@elitesystems.online>"`.

### 6. WhatsApp (opcional)
1. Crie um app no [Meta for Developers](https://developers.facebook.com) com o produto WhatsApp e um número.
2. Crie e aprove o modelo **aviso_plataforma** (categoria Utilidade, português) com o corpo:
   `Olá, {{1}}! {{2}}. Acesse: {{3}}`
3. Preencha `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e `WHATSAPP_TEMPLATE`.

## Desenvolvimento

```bash
npm install
npm run dev
```

Estrutura: `src/app/(auth)` telas de login, `src/app/(app)` área logada, `src/app/actions` escritas no banco
(server actions), `src/app/api/notify` entrega de avisos, `supabase/migrations` banco e regras de acesso.
