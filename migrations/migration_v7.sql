-- =====================================================================
-- migration_v7.sql  ·  合同多份化 + 下游对下已付/未付
-- 目的：
--   1) 下游分包（downstreams）增加「对下已付」「对下未付」两列（单位：元）。
--   2) 新增 contracts 表，承载「对甲合同」（与总包 gc / 与业主 owner），
--      支持一个主体签订多份合同，金额可逐份填写。
--   3) 将 projects 表中旧的单合同字段（gc_contract_name/amt、
--      upstream_contract_name/amt）迁移进 contracts 表，保留历史数据。
--   4) contracts 表开启 RLS，沿用 v6 的「仅登录用户可读写」策略。
-- 运行方式：Supabase 控制台 → SQL Editor → 新建查询 → 全部粘贴 → Run
-- 本脚本可重复执行（幂等）。
-- =====================================================================

-- ---------- 1) 下游分包：增加对下已付 / 对下未付（元） ----------
alter table public.downstreams add column if not exists paid   numeric default 0;
alter table public.downstreams add column if not exists unpaid numeric default 0;

-- ---------- 2) 新建 contracts 表 ----------
create table if not exists public.contracts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  party       text not null check (party in ('gc','owner')),
  name        text default '',
  amt         numeric default 0,
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists idx_contracts_project on public.contracts(project_id);

-- ---------- 3) 迁移旧单合同字段（每个主体一份时 → contracts 一行） ----------
-- 与总包（gc）：仅当 ld_role=分包 时有意义，但为稳妥按 project_id 迁移，避免重复
insert into public.contracts (project_id, party, name, amt, sort_order)
select p.id, 'gc', p.gc_contract_name, coalesce(p.gc_contract_amt, 0), 0
from public.projects p
where p.gc_contract_name is not null and p.gc_contract_name <> ''
  and not exists (select 1 from public.contracts c where c.project_id = p.id and c.party = 'gc');

-- 与业主（owner）：仅当 ld_role=总包 时有意义
insert into public.contracts (project_id, party, name, amt, sort_order)
select p.id, 'owner', p.upstream_contract_name, coalesce(p.upstream_contract_amt, 0), 0
from public.projects p
where p.upstream_contract_name is not null and p.upstream_contract_name <> ''
  and not exists (select 1 from public.contracts c where c.project_id = p.id and c.party = 'owner');

-- （可选）迁移完成后，旧字段已不再被前端使用，可保留或手动删除：
--   alter table public.projects drop column if exists gc_contract_name;
--   alter table public.projects drop column if exists gc_contract_amt;
--   alter table public.projects drop column if exists upstream_contract_name;
--   alter table public.projects drop column if exists upstream_contract_amt;

-- ---------- 4) contracts 表 RLS（沿用 v6 风格：仅 authenticated 可读写） ----------
alter table public.contracts enable row level security;
drop policy if exists "auth_all_contracts" on public.contracts;
create policy "auth_all_contracts" on public.contracts
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- 完成。此时：
--   - downstreams 多了 paid / unpaid 两列；
--   - contracts 表已建好并迁移了历史单合同数据；
--   - 前端「对甲合同」改为可增删多份，并自动汇总「合同金额总计」。
-- 前端改动需重新 npm run build 并部署后方能生效。
-- =====================================================================
