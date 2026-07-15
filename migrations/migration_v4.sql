-- =====================================================================
-- migration_v4.sql  ·  阶段A：字段架构对齐（修订版 v4 — 修正约束顺序）
-- ---------------------------------------------------------------------
-- 修正点（相对 v3）：
--   ① 把【所有 DROP CONSTRAINT】移到【UPDATE】之前，
--      否则旧约束（只允许 已完成/进行中/未启动）会拦截改成 已结算/办理中/未结算。
--   ② 枚举映射后加一道兜底：任何映射不到的旧值统一置 NULL
--      （符合"全部非必填、缺失可标"的设计，且保证 ADD CONSTRAINT 不失败）。
--   ③ 当前 DB 里 type 取值仅 合作挂靠(6) + 空(64)，无 违法转包/待确认，
--      故 type 无需 UPDATE，仅更新约束。
--   ④ 金额列整体 ×10000（万元→元），默认值改 NULL（缺失语义）。
--
-- 整体在事务里，任一步失败全部回滚。前置：已建三表快照。
-- =====================================================================

BEGIN;

-- ============ ① 先删除所有旧约束（必须在 UPDATE 之前！）============
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_type_check;
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_risk_level_check;
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_owner_settle_status_check;
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_gc_settle_status_check;
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_worker_status_check;
ALTER TABLE projects    DROP CONSTRAINT IF EXISTS projects_priority_check;
ALTER TABLE downstreams DROP CONSTRAINT IF EXISTS downstreams_settled_check;
ALTER TABLE downstreams DROP CONSTRAINT IF EXISTS downstreams_role_type_check;

-- ============ ② 枚举值映射（旧约束已删，UPDATE 可自由执行）============

-- 上游结算状态（业主侧）：未结算/办理中/已结算
UPDATE projects SET owner_settle_status = '已结算' WHERE owner_settle_status = '已完成';
UPDATE projects SET owner_settle_status = '办理中' WHERE owner_settle_status = '进行中';
UPDATE projects SET owner_settle_status = '未结算' WHERE owner_settle_status = '未启动';

-- 上游结算状态（总包侧，分包时）：同上
UPDATE projects SET gc_settle_status = '已结算' WHERE gc_settle_status = '已完成';
UPDATE projects SET gc_settle_status = '办理中' WHERE gc_settle_status = '进行中';
UPDATE projects SET gc_settle_status = '未结算' WHERE gc_settle_status = '未启动';

-- 下游结算状态：未结算/办理中/已结算
UPDATE downstreams SET settled = '已结算' WHERE settled = '是';
UPDATE downstreams SET settled = '未结算' WHERE settled = '否';
UPDATE downstreams SET settled = '办理中' WHERE settled = '部分结算';

-- 农民工处理状态：待处理/处理中/已解决（"不涉及"由 worker_issue=false 表达）
UPDATE projects SET worker_status = NULL WHERE worker_status = '不涉及';

-- 兜底：任何映射不到的旧值统一置 NULL（避免 ADD CONSTRAINT 失败）
UPDATE projects    SET owner_settle_status = NULL WHERE owner_settle_status NOT IN ('已结算','办理中','未结算');
UPDATE projects    SET gc_settle_status    = NULL WHERE gc_settle_status    NOT IN ('已结算','办理中','未结算');
UPDATE downstreams SET settled             = NULL WHERE settled             NOT IN ('已结算','办理中','未结算');
UPDATE projects    SET worker_status       = NULL WHERE worker_status       NOT IN ('待处理','处理中','已解决');

-- ============ ③ 新增字段 ============

-- 优先级 P0/P1/P2
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT;

-- 核心事实确认摘要（一句话摸排结论）
ALTER TABLE projects ADD COLUMN IF NOT EXISTS fact_summary TEXT;

-- 资料是否缺失（项目级开关）+ 缺失情况说明
ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_missing BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS data_missing_note TEXT;

-- 上游（对甲）合同名称 + 金额（元）—— 总包时即与建设单位的那份合同
ALTER TABLE projects ADD COLUMN IF NOT EXISTS upstream_contract_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS upstream_contract_amt NUMERIC(16,2);

-- 对总包合同名称 + 金额（元）—— 分包时与总包的那份合同
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_contract_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS gc_contract_amt NUMERIC(16,2);

-- 资料存放位置 → 资料存放情况（开放文本，改名）
ALTER TABLE projects RENAME COLUMN doc_location TO doc_storage_status;

-- downstreams 新增字段
ALTER TABLE downstreams ADD COLUMN IF NOT EXISTS role_type TEXT;
ALTER TABLE downstreams ADD COLUMN IF NOT EXISTS settle_est NUMERIC(16,2);   -- 下游预计结算金额（元）
ALTER TABLE downstreams ADD COLUMN IF NOT EXISTS claim_amt NUMERIC(16,2);    -- 对方申报债权金额（元）
ALTER TABLE downstreams ADD COLUMN IF NOT EXISTS review_amt NUMERIC(16,2);   -- 管理人审核认定金额（元）
ALTER TABLE downstreams ADD COLUMN IF NOT EXISTS claim_dispute TEXT;         -- 审核意见/争议焦点

-- ============ ④ 金额 万元 → 元（×10000）============
-- NULL→NULL，0→0，其余 ×10000；非破坏性。
UPDATE projects SET
    owner_contract_amt = owner_contract_amt * 10000,
    owner_settle_amt   = owner_settle_amt   * 10000,
    owner_received     = owner_received     * 10000,
    owner_remaining    = owner_remaining    * 10000,
    gc_received        = gc_received        * 10000,
    gc_remaining       = gc_remaining       * 10000,
    dispute_amt        = dispute_amt        * 10000,
    worker_amt         = worker_amt         * 10000;

UPDATE downstreams SET contract_amt = contract_amt * 10000;

-- 金额列默认值改 NULL（新行未填即缺失，汇总显"待查"）
ALTER TABLE projects ALTER COLUMN owner_contract_amt SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN owner_settle_amt   SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN owner_received     SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN owner_remaining    SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN gc_received        SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN gc_remaining       SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN dispute_amt        SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN worker_amt         SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN upstream_contract_amt SET DEFAULT NULL;
ALTER TABLE projects ALTER COLUMN gc_contract_amt    SET DEFAULT NULL;
ALTER TABLE downstreams ALTER COLUMN contract_amt    SET DEFAULT NULL;
ALTER TABLE downstreams ALTER COLUMN settle_est      SET DEFAULT NULL;
ALTER TABLE downstreams ALTER COLUMN claim_amt       SET DEFAULT NULL;
ALTER TABLE downstreams ALTER COLUMN review_amt      SET DEFAULT NULL;

-- ============ ⑤ contracts 并入 projects 后删除；attachments 删除 ============

-- 5.1 owner 合同 → upstream_contract_*（金额同步 ×10000）
UPDATE projects p
SET upstream_contract_name = c.name,
    upstream_contract_amt  = c.amount * 10000
FROM contracts c
WHERE c.project_id = p.id AND c.counterparty = 'owner';

-- 5.2 gc 合同 → gc_contract_*（金额同步 ×10000）
UPDATE projects p
SET gc_contract_name = c.name,
    gc_contract_amt  = c.amount * 10000
FROM contracts c
WHERE c.project_id = p.id AND c.counterparty = 'gc';

-- 5.3 删除 contracts 表（数据已并入，备份另存 contracts_backup_20260714）
DROP TABLE IF EXISTS contracts;

-- 5.4 删除 attachments 表（去附件化；资料存放情况改由 projects.doc_storage_status 文本记录）
DROP TABLE IF EXISTS attachments;

-- ============ ⑥ 重新添加新约束（此时数据已对齐，校验必过）============
ALTER TABLE projects ADD CONSTRAINT projects_type_check
  CHECK ("type" IN ('自营','转包','合作挂靠'));
ALTER TABLE projects ADD CONSTRAINT projects_risk_level_check
  CHECK (risk_level IN ('极高(维稳)','高','中','低'));
ALTER TABLE projects ADD CONSTRAINT projects_owner_settle_status_check
  CHECK (owner_settle_status IN ('未结算','办理中','已结算'));
ALTER TABLE projects ADD CONSTRAINT projects_gc_settle_status_check
  CHECK (gc_settle_status IN ('未结算','办理中','已结算'));
ALTER TABLE projects ADD CONSTRAINT projects_worker_status_check
  CHECK (worker_status IN ('待处理','处理中','已解决'));
ALTER TABLE projects ADD CONSTRAINT projects_priority_check
  CHECK (priority IN ('P0','P1','P2'));
ALTER TABLE downstreams ADD CONSTRAINT downstreams_settled_check
  CHECK (settled IN ('未结算','办理中','已结算'));
ALTER TABLE downstreams ADD CONSTRAINT downstreams_role_type_check
  CHECK (role_type IN ('专业分包','劳务','材料','实际施工人'));

-- ============ ⑦ 索引 ============
CREATE INDEX IF NOT EXISTS idx_projects_priority     ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_data_missing ON projects(data_missing);
CREATE INDEX IF NOT EXISTS idx_projects_phase        ON projects(phase);
CREATE INDEX IF NOT EXISTS idx_projects_risk         ON projects(risk_level);

COMMIT;

-- =====================================================================
-- 验证（运行后可执行以下查询核对，非必须）：
--   SELECT COUNT(*) AS 项目数 FROM projects;                    -- 应为 70
--   SELECT COUNT(*) AS 下游数 FROM downstreams;                  -- 应为 234
--   SELECT to_regclass('contracts'), to_regclass('attachments');-- 应均为 NULL（已删）
--   SELECT name, upstream_contract_name, upstream_contract_amt
--     FROM projects WHERE upstream_contract_name IS NOT NULL LIMIT 5;  -- 抽查对甲合同并入
--   SELECT name, owner_received FROM projects LIMIT 3;          -- 金额应已是"元"（大数，如 2424500）
--   SELECT settled, COUNT(*) FROM downstreams GROUP BY settled; -- 应只剩 未结算/办理中/已结算/NULL
-- =====================================================================
