-- migration_v8.sql
-- 删除下游分包表(downstreams)的「分包角色」(role_type) 列
-- 说明：前端已移除该字段，不再读写。本迁移为【可选清理】，不执行也不影响功能。
--      若确认历史数据无需保留「分包角色」，可运行以下语句；如需保留，跳过本文件即可。
-- 幂等：使用 IF EXISTS，可重复执行。

ALTER TABLE downstreams DROP COLUMN IF EXISTS role_type;
