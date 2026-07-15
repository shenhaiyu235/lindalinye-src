-- =====================================================================
-- migration_v9.sql  ·  下游分包合同多份化
-- 目的：
--   1) 新增 downstream_contracts 表，承载每个下游分包与林大签订的对下合同，
--      支持一个下游单位签订多份合同，金额逐份填写。
--   2) 将 downstreams 表旧的单合同字段（contract_name / contract_amt）
--      迁移进 downstream_contracts 表。
--   3) 下游合同表开启 RLS，沿用 v6 的「仅登录用户可读写」策略。
-- 运行方式：Supabase 控制台 → SQL Editor → 新建查询 → 全部粘贴 → Run
-- 本脚本可重复执行（幂等）。
-- =====================================================================

-- ---------- 1) 新建 downstream_contracts 表 ----------
create table if not exists public.downstream_contracts (
  id            uuid primary key default gen_random_uuid(),
  downstream_id uuid not null references public.downstreams(id) on delete cascade,
  name          text default '',
  amt           numeric default 0,
  sort_order    int default 0,
  created_at    timestamptz default now()
);
create index if not exists idx_downstream_contracts_downstream on public.downstream_contracts(downstream_id);

-- ---------- 2) 迁移旧单合同字段（每个下游一份时 → 一行） ----------
insert into public.downstream_contracts (downstream_id, name, amt, sort_order)
select d.id, d.contract_name, coalesce(d.contract_amt, 0), 0
from public.downstreams d
where d.contract_name is not null and d.contract_name <> ''
  and not exists (
    select 1 from public.downstream_contracts c
    where c.downstream_id = d.id
  );

-- （可选）迁移完成后，旧字段已不再被前端使用，可保留或手动删除：
--   alter table public.downstreams drop column if exists contract_name;
--   alter table public.downstreams drop column if exists contract_amt;

-- ---------- 3) downstream_contracts 表 RLS（沿用 v6 风格） ----------
alter table public.downstream_contracts enable row level security;
drop policy if exists "auth_all_downstream_contracts" on public.downstream_contracts;
create policy "auth_all_downstream_contracts" on public.downstream_contracts
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- 完成。此时每个下游分包可维护多份对下合同，并自动汇总合同金额总计。
-- 前端改动需重新 npm run build 并部署后方能生效。
-- =====================================================================
