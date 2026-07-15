-- 林大林业项目管理 - 数据库迁移 v2
-- 在 Supabase SQL Editor 中运行

-- 1. 新增字段
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ld_role TEXT CHECK (ld_role IN ('总包','分包'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_unit TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_contact TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_phone TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_received NUMERIC(16,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_remaining NUMERIC(16,2) DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_settle_status TEXT CHECK (gc_settle_status IN ('已完成','进行中','未启动'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_settle_note TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_settle_status TEXT CHECK (owner_settle_status IN ('已完成','进行中','未启动'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_to_gc_settle TEXT;

-- 2. 合同表（动态行：对甲合同/对总包合同）
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  counterparty TEXT NOT NULL DEFAULT 'owner',
  name TEXT NOT NULL DEFAULT '',
  amount NUMERIC(16,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);

-- 3. RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON contracts;
CREATE POLICY "Allow all access" ON contracts FOR ALL USING (true) WITH CHECK (true);

-- 4. 迁移已有对甲合同数据到contracts表
INSERT INTO contracts (project_id, counterparty, name, amount, sort_order)
SELECT id, 'owner', owner_contract_name, owner_contract_amt, 0
FROM projects
WHERE owner_contract_name IS NOT NULL AND owner_contract_name != ''
ON CONFLICT DO NOTHING;
