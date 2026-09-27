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

## Arquitetura

```
Navegador ──▶ Next.js (Vercel, gru1) ──▶ Supabase (Auth, Postgres/RLS, Storage, Realtime · sa-east-1)
                                              │ trigger em notifications (pg_net)
                                              ▼
                                   Edge Function "platform" ──▶ Resend (e-mail)
                                                            └─▶ Evolution API no Railway (WhatsApp)
```

- **Sem segredos na Vercel:** só a URL e a chave pública do Supabase. As chaves do Resend e da Evolution
  ficam no **Supabase Vault** (`resend_api_key`, `email_from`, `evolution_url`, `evolution_api_key`,
  `evolution_instance`, `notify_secret`); a Edge Function lê via `public.delivery_config()` (só service role).
- **E-mails de conta** (confirmação e nova senha) são enviados pela Edge Function com link `token_hash`
  direto para `/auth/callback` — não dependem do SMTP nem das URLs do painel do Supabase.
- **WhatsApp:** conecte o número em *Configurações → Avisos* (QR Code). Instância `elite-systems`.

## Configuração

1. Rode `supabase/migrations/` em ordem e publique `supabase/functions/platform` (`verify_jwt = false`).
2. Crie os segredos do Vault e `private.config` (`app_url`, `functions_url`) — veja a migração 0004.
3. Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`.
4. O primeiro cadastro com **elitesystems.br@gmail.com** vira administrador (`public.admin_emails`).

### Site + plataforma no mesmo endereço
- `https://elitesystems.online/` serve o site institucional (`public/site.html`, via rewrite em `next.config.ts`).
  **Edite o site aqui** — o repositório `elitesystems.online` (GitHub Pages) ficou só como backup.
- As demais rotas são a plataforma (`/login`, `/cadastro`, `/painel`, `/admin`…). O botão “Área do cliente”
  do site leva a `/painel`; o briefing do site leva a `/novo-projeto?tipos=…&equipe=…&prioridade=…&contexto=…`,
  que pede login/cadastro e chega com o formulário preenchido.
- `www.` e `app.` redirecionam para o domínio principal.

### DNS (Hostinger)
| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `@` | `76.76.21.21` (Vercel) |
| CNAME | `www` | `cname.vercel-dns.com` |
| TXT | `resend._domainkey` | chave DKIM do Resend |
| MX | `send` | `10 feedback-smtp.sa-east-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| CNAME | `rsend` | `send.forge.rmta.net` |

Para voltar o site ao GitHub Pages: A `@` → `185.199.108.153`, `.109`, `.110`, `.111` e CNAME `www` → `elitesystems.online`.

### Pix
A chave fica em Configurações com o tipo (CPF, CNPJ, telefone, e-mail ou aleatória) e é salva no formato do
Banco Central (telefone vira `+55…`). O QR segue o padrão BR Code estático com valor e descrição da parcela.

## Desenvolvimento

```bash
npm install
npm run dev
```

Estrutura: `src/app/(auth)` telas de login, `src/app/(app)` área logada, `src/app/actions` escritas no banco
(server actions), `src/app/api/notify` entrega de avisos, `supabase/migrations` banco e regras de acesso.
