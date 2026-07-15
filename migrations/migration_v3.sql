-- ============================================================
-- 林大林业项目管理 - 数据库迁移 v3 (M1 基础数据层)
-- 执行位置：Supabase 控制台 → SQL Editor → 粘贴运行
-- 说明：本脚本只新增列 / 调整默认值 / 放松 CHECK 约束 / 建审计表，
--       不删除任何现有列，不改动已有业务数据。
-- ============================================================

-- ----------------------------------------------------------
-- 1. 金额类字段默认值 0 → NULL（让"资料缺失"可用 NULL 表达）
--    注：仅改默认值，历史 0 值保留不动。
--    若希望把"导入时遗留的 0"也视为缺失，可单独执行文末可选 UPDATE。
-- ----------------------------------------------------------
ALTER TABLE projects ALTER COLUMN gc_received    SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN gc_remaining   SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN owner_received SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN owner_remaining SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN claim_amt      SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN review_amt     SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN dispute_amt    SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN worker_amt     SET DEFAULT NULL;
ALTER TABLE contracts ALTER COLUMN amount        SET DEFAULT NULL;

-- downstreams 若存在 amount 列也放开（无则忽略）
ALTER TABLE downstreams ALTER COLUMN amount SET DEFAULT NULL;

-- ----------------------------------------------------------
-- 2. 状态枚举追加"资料缺失"选项（放松 CHECK 约束）
--    Postgres 对未命名 CHECK 的自动命名规则为 <表>_<列>_check
-- ----------------------------------------------------------
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner_settle_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_owner_settle_status_check
  CHECK (owner_settle_status IN ('已完成','进行中','未启动','资料缺失'));

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_gc_settle_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_gc_settle_status_check
  CHECK (gc_settle_status IN ('已完成','进行中','未启动','资料缺失'));

ALTER TABLE downstreams DROP CONSTRAINT IF EXISTS downstreams_settled_check;
ALTER TABLE downstreams ADD CONSTRAINT downstreams_settled_check
  CHECK (settled IN ('是','否','部分结算','资料缺失'));

-- review_status 为 text 字段（前端约束），无需改约束，前端加选项即可。

-- ----------------------------------------------------------
-- 3. 新增列：责任人认领 + 溯源 + 挂靠双轨（actual_performer 由管理人/审计访谈后填）
-- ----------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible                TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by                TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by                TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_performer          TEXT;   -- 实际履约主体/挂靠人
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_performer_contact  TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_performer_phone    TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS mgmt_fee                  NUMERIC(16,2) DEFAULT NULL;  -- 管理费
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_nominal_only           BOOLEAN DEFAULT FALSE;       -- 是否仅名义承接

-- ----------------------------------------------------------
-- 4. change_log 变更审计表（支撑"谁说的/凭什么"溯源）
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT,
  changed_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_change_log_project ON change_log(project_id);
CREATE INDEX IF NOT EXISTS idx_change_log_at     ON change_log(changed_at);

ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON change_log;
CREATE POLICY "Allow all access" ON change_log FOR ALL USING (true) WITH CHECK (true);

-- ----------------------------------------------------------
-- 5. （可选）把导入遗留的金额 0 视为"资料缺失"
--    仅当你确认这些 0 是"未填"而非"真实为零"时执行：
-- ----------------------------------------------------------
-- UPDATE projects SET gc_received=NULL    WHERE gc_received=0;
-- UPDATE projects SET gc_remaining=NULL   WHERE gc_remaining=0;
-- UPDATE projects SET owner_received=NULL WHERE owner_received=0;
-- UPDATE projects SET owner_remaining=NULL WHERE owner_remaining=0;
-- UPDATE projects SET claim_amt=NULL      WHERE claim_amt=0;
-- UPDATE projects SET review_amt=NULL     WHERE review_amt=0;
-- UPDATE projects SET dispute_amt=NULL    WHERE dispute_amt=0;
-- UPDATE projects SET worker_amt=NULL     WHERE worker_amt=0;
-- UPDATE contracts SET amount=NULL        WHERE amount=0;
