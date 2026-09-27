-- Hardening after the Supabase advisors: lock internal functions, pin search paths,
-- move pg_net out of public, evaluate auth.uid() once per query and index foreign keys.

-- Internal functions are only for triggers; nobody should call them through the API.
do $$
declare f text;
begin
  foreach f in array array[
    'public.handle_new_user()', 'public.protect_profile()', 'public.create_default_stages()',
    'public.ticket_after_message()', 'public.display_name(uuid)',
    'public.tg_notify_profile()', 'public.tg_notify_project()', 'public.tg_notify_stage()',
    'public.tg_notify_update()', 'public.tg_notify_approval()', 'public.tg_notify_file()',
    'public.tg_notify_message()', 'public.tg_notify_installment()', 'public.tg_notify_ticket()',
    'public.tg_notify_ticket_message()', 'public.tg_notify_request()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- Only signed-in users decide approvals.
revoke execute on function public.decide_approval(uuid, public.approval_status, text) from public, anon;
grant execute on function public.decide_approval(uuid, public.approval_status, text) to authenticated;

alter function public.try_uuid(text) set search_path = '';
alter function public.touch_updated_at() set search_path = '';
alter function public.stage_timestamps() set search_path = '';

-- pg_net can't change schema in place; recreate it in "extensions" (net.* functions stay the same).
drop extension if exists pg_net;
create extension pg_net schema extensions;

-- ---------------------------------------------------------------- policies: one per action, auth.uid() evaluated once
drop policy "profiles: self or admin read"   on public.profiles;
drop policy "profiles: self or admin update" on public.profiles;
create policy "profiles: read"   on public.profiles for select using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update" on public.profiles for update using (id = (select auth.uid()) or (select public.is_admin()));

drop policy "projects: read"  on public.projects;
drop policy "projects: admin" on public.projects;
create policy "projects: read"   on public.projects for select using (client_id = (select auth.uid()) or (select public.is_admin()));
create policy "projects: insert" on public.projects for insert with check ((select public.is_admin()));
create policy "projects: update" on public.projects for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "projects: delete" on public.projects for delete using ((select public.is_admin()));

drop policy "stages: admin" on public.project_stages;
create policy "stages: insert" on public.project_stages for insert with check ((select public.is_admin()));
create policy "stages: update" on public.project_stages for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "stages: delete" on public.project_stages for delete using ((select public.is_admin()));

drop policy "updates: admin" on public.project_updates;
create policy "updates: insert" on public.project_updates for insert with check ((select public.is_admin()));
create policy "updates: update" on public.project_updates for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "updates: delete" on public.project_updates for delete using ((select public.is_admin()));

drop policy "files: upload" on public.files;
drop policy "files: delete" on public.files;
create policy "files: upload" on public.files for insert with check (public.can_access_project(project_id) and uploaded_by = (select auth.uid()));
create policy "files: delete" on public.files for delete using ((select public.is_admin()) or uploaded_by = (select auth.uid()));

drop policy "approvals: admin" on public.approvals;
create policy "approvals: insert" on public.approvals for insert with check ((select public.is_admin()));
create policy "approvals: update" on public.approvals for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "approvals: delete" on public.approvals for delete using ((select public.is_admin()));

drop policy "messages: write" on public.messages;
create policy "messages: write" on public.messages for insert with check (public.can_access_project(project_id) and author_id = (select auth.uid()));

drop policy "reads: own" on public.project_reads;
create policy "reads: own" on public.project_reads for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_access_project(project_id));

drop policy "installments: admin" on public.installments;
create policy "installments: insert" on public.installments for insert with check ((select public.is_admin()));
create policy "installments: update" on public.installments for update using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "installments: delete" on public.installments for delete using ((select public.is_admin()));

drop policy "settings: read" on public.settings;
create policy "settings: read" on public.settings for select using ((select auth.uid()) is not null);

drop policy "tickets: read" on public.tickets;
drop policy "tickets: open" on public.tickets;
create policy "tickets: read" on public.tickets for select using (client_id = (select auth.uid()) or (select public.is_admin()));
create policy "tickets: open" on public.tickets for insert with check (
  client_id = (select auth.uid()) and (select public.is_active())
  and (project_id is null or public.can_access_project(project_id)));

drop policy "ticket_messages: read"  on public.ticket_messages;
drop policy "ticket_messages: write" on public.ticket_messages;
create policy "ticket_messages: read" on public.ticket_messages for select using (
  exists (select 1 from public.tickets t where t.id = ticket_id and (t.client_id = (select auth.uid()) or (select public.is_admin()))));
create policy "ticket_messages: write" on public.ticket_messages for insert with check (
  author_id = (select auth.uid())
  and exists (select 1 from public.tickets t where t.id = ticket_id and (t.client_id = (select auth.uid()) or (select public.is_admin()))));

drop policy "requests: read"   on public.project_requests;
drop policy "requests: create" on public.project_requests;
create policy "requests: read"   on public.project_requests for select using (client_id = (select auth.uid()) or (select public.is_admin()));
create policy "requests: create" on public.project_requests for insert with check (client_id = (select auth.uid()));

drop policy "notifications: own read"   on public.notifications;
drop policy "notifications: own update" on public.notifications;
create policy "notifications: own read"   on public.notifications for select using (user_id = (select auth.uid()));
create policy "notifications: own update" on public.notifications for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- foreign-key indexes
create index if not exists approvals_decided_by_idx    on public.approvals (decided_by);
create index if not exists approvals_file_id_idx       on public.approvals (file_id);
create index if not exists approvals_requested_by_idx  on public.approvals (requested_by);
create index if not exists approvals_stage_id_idx      on public.approvals (stage_id);
create index if not exists files_uploaded_by_idx       on public.files (uploaded_by);
create index if not exists messages_author_id_idx      on public.messages (author_id);
create index if not exists project_reads_user_id_idx   on public.project_reads (user_id);
create index if not exists project_requests_project_idx on public.project_requests (project_id);
create index if not exists project_updates_author_idx  on public.project_updates (author_id);
create index if not exists project_updates_stage_idx   on public.project_updates (stage_id);
create index if not exists ticket_messages_author_idx  on public.ticket_messages (author_id);
create index if not exists tickets_project_id_idx      on public.tickets (project_id);
