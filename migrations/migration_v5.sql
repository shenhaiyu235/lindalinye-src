-- ============================================================
-- 阶段 B/C 数据库迁移：新增 Memo / 待办 / 变更日志
-- 项目：xnxmzgmgmfesrathfnnl（林大林业债权债务管理平台）
-- 说明：全部幂等（IF NOT EXISTS），不删任何现有列、不动业务数据。
--       请在此项目 SQL Editor 粘贴运行（有快照兜底）。
-- ============================================================

BEGIN;

-- 1. projects 表补充两列：操作人溯源 + 归档冻结
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_by   text DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived     boolean DEFAULT false;

-- 2. 管理人备忘表（动态追踪，时间倒序展示）
CREATE TABLE IF NOT EXISTS memos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content     text NOT NULL DEFAULT '',
  author      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memos_project ON memos(project_id, created_at DESC);

-- 3. 待办 / 事项提醒表
CREATE TABLE IF NOT EXISTS todos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task        text NOT NULL DEFAULT '',
  owner       text NOT NULL DEFAULT '',          -- 责任人
  due_date    date,                               -- 截止日（逾期/今日到期高亮）
  done        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project_id, done, due_date);

-- 4. 变更日志（字段级留痕，配合轻量登录的 updated_by）
CREATE TABLE IF NOT EXISTS change_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field       text NOT NULL DEFAULT '',
  old_value   text,
  new_value   text,
  by          text NOT NULL DEFAULT '',
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_changelog_project ON change_log(project_id, at DESC);

COMMIT;

-- ============================================================
-- 验证（可选，单独贴到新查询页运行）：
--   SELECT
--     (SELECT count(*) FROM projects)        AS projects,
--     (SELECT count(*) FROM downstreams)     AS downstreams,
--     (SELECT to_regclass('public.memos'))   AS memos_table,
--     (SELECT to_regclass('public.todos'))   AS todos_table,
--     (SELECT to_regclass('public.change_log')) AS changelog_table;
--   -- 期望：projects=70, downstreams=234, 三表名均非 NULL
-- ============================================================
