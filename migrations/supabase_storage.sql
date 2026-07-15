-- 附件存储桶创建（在 Supabase SQL Editor 中执行）
-- 位置：Supabase Dashboard → SQL Editor → 新建查询 → 粘贴 → 运行

-- 创建附件存储桶（如果还没建的话，通常在 Supabase → Storage 中手动创建）
-- 如果SQL无法创建存储桶，请去 Supabase → Storage → New Bucket → 名称填 "attachments" → 勾选 Public bucket → 创建

-- 存储桶的 public 访问策略
CREATE POLICY "Public attachments access"
ON storage.objects FOR ALL
USING (bucket_id = 'attachments')
WITH CHECK (bucket_id = 'attachments');
