-- =====================================================================
-- migration_v6_rls.sql  ·  行级安全（RLS）加固
-- 目的：公开链接后，只有"登录用户"才能读写数据；未登录的任何人一律拒绝。
-- 运行方式：Supabase 控制台 → SQL Editor → 新建查询 → 全部粘贴 → Run
-- 前置：请先在 Authentication 里建好至少 1 个账号并能登录成功，再跑本脚本，
--       否则开启 RLS 后你自己也会暂时读不到数据（登录后即恢复）。
-- 本脚本可重复执行（幂等）。
-- =====================================================================

-- ---------- 1) 开启 RLS ----------
alter table public.projects    enable row level security;
alter table public.downstreams enable row level security;
alter table public.memos       enable row level security;
alter table public.todos       enable row level security;
alter table public.change_log  enable row level security;

-- ---------- 2) 清理旧策略（避免重复报错） ----------
drop policy if exists "auth_all_projects"    on public.projects;
drop policy if exists "auth_all_downstreams" on public.downstreams;
drop policy if exists "auth_all_memos"       on public.memos;
drop policy if exists "auth_all_todos"       on public.todos;
drop policy if exists "auth_all_change_log"  on public.change_log;

-- ---------- 3) 通用策略：仅 authenticated（已登录）可读写；anon（未登录）无策略即被拒 ----------
create policy "auth_all_projects"    on public.projects    for all to authenticated using (true) with check (true);
create policy "auth_all_downstreams" on public.downstreams for all to authenticated using (true) with check (true);
create policy "auth_all_memos"       on public.memos       for all to authenticated using (true) with check (true);
create policy "auth_all_todos"       on public.todos       for all to authenticated using (true) with check (true);
create policy "auth_all_change_log"  on public.change_log  for all to authenticated using (true) with check (true);

-- =====================================================================
-- 完成。此时：未登录 = 读不到任何数据；已登录 = 可正常读写。
-- "只读/填报"角色目前由前端界面控制（只读角色 UI 禁用编辑）。
-- =====================================================================


-- =====================================================================
-- 【可选·进阶】把"只读"做成数据库级硬边界（连绕过界面也改不了数据）
-- 说明：角色写入 app_metadata（用户自己改不了，仅管理员可改），
--       写操作策略校验 app_metadata.role = '填报'。若不需要可忽略本段。
-- 步骤：
--   (1) 先给每个账号设角色（把邮箱换成实际账号）：
--       -- 填报（可编辑）：
--       -- update auth.users set raw_app_meta_data =
--       --   coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"填报"}'::jsonb
--       --   where email = 'hu@example.com';
--       -- 只读（仅浏览）：
--       -- update auth.users set raw_app_meta_data =
--       --   coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"只读"}'::jsonb
--       --   where email = 'viewer@example.com';
--   (2) 用下面这组策略替换上面第 3 段的通用策略（先 drop 再 create）：
--
--   -- 所有登录用户都能读：
--   -- create policy "read_all_projects" on public.projects for select to authenticated using (true);
--   -- 仅"填报"角色能写：
--   -- create policy "write_projects" on public.projects for insert to authenticated
--   --   with check ((auth.jwt() -> 'app_metadata' ->> 'role') = '填报');
--   -- create policy "update_projects" on public.projects for update to authenticated
--   --   using ((auth.jwt() -> 'app_metadata' ->> 'role') = '填报')
--   --   with check ((auth.jwt() -> 'app_metadata' ->> 'role') = '填报');
--   -- create policy "delete_projects" on public.projects for delete to authenticated
--   --   using ((auth.jwt() -> 'app_metadata' ->> 'role') = '填报');
--   -- （downstreams/memos/todos/change_log 照此复制，改表名即可）
-- =====================================================================
