-- 林大林业项目管理 - 数据库建表SQL
-- 请复制此SQL到 Supabase SQL Editor 中执行
-- 位置: Supabase Dashboard → 左侧菜单 SQL Editor → New Query → 粘贴 → Run

-- 1. 项目主表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq INTEGER,
  internal_no TEXT,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('自营','合作挂靠','违法转包','待确认')),
  phase TEXT CHECK (phase IN ('并购前','并购后')),
  location TEXT,
  coop_mode TEXT,

  owner_unit TEXT,
  owner_contact TEXT,
  owner_phone TEXT,
  owner_contract_name TEXT,
  owner_contract_amt NUMERIC(16,2) DEFAULT 0,
  owner_settle_amt NUMERIC(16,2) DEFAULT 0,
  owner_received NUMERIC(16,2) DEFAULT 0,
  owner_remaining NUMERIC(16,2) DEFAULT 0,
  owner_settled TEXT CHECK (owner_settled IN ('是','否','部分结算')),
  owner_settle_note TEXT,

  claim_filed BOOLEAN DEFAULT false,
  claimant TEXT,
  claim_amt NUMERIC(16,2) DEFAULT 0,
  claim_type TEXT CHECK (claim_type IN ('工程款','材料款','劳务费','其他')),
  review_status TEXT CHECK (review_status IN ('待审核','已确认','部分确认','不予确认')),
  review_amt NUMERIC(16,2) DEFAULT 0,
  claim_dispute TEXT,

  litigation BOOLEAN DEFAULT false,
  case_type TEXT CHECK (case_type IN ('主诉','被诉','仲裁')),
  litigant_role TEXT CHECK (litigant_role IN ('原告','被告','第三人','申请执行人','被执行人')),
  case_no TEXT,
  court TEXT,
  case_stage TEXT CHECK (case_stage IN ('未立案','一审中','二审中','再审中','已判决','执行中','已结案')),
  dispute_amt NUMERIC(16,2) DEFAULT 0,
  judgment TEXT,
  execution TEXT,

  worker_issue BOOLEAN DEFAULT false,
  worker_count INTEGER DEFAULT 0,
  worker_amt NUMERIC(16,2) DEFAULT 0,
  worker_status TEXT CHECK (worker_status IN ('已解决','处理中','待处理','不涉及')),
  worker_note TEXT,

  doc_contract TEXT CHECK (doc_contract IN ('齐全','部分','缺失')),
  doc_settlement TEXT CHECK (doc_settlement IN ('齐全','部分','缺失')),
  doc_acceptance TEXT CHECK (doc_acceptance IN ('齐全','部分','缺失')),
  doc_payment TEXT CHECK (doc_payment IN ('齐全','部分','缺失')),
  doc_change TEXT CHECK (doc_change IN ('齐全','部分','缺失')),
  doc_bidding TEXT CHECK (doc_bidding IN ('齐全','部分','缺失')),
  doc_location TEXT,

  interview_person TEXT,
  interview_time DATE,
  interview_notes TEXT,

  filler TEXT,
  reviewer TEXT,
  fill_status TEXT DEFAULT '待填写' CHECK (fill_status IN ('待填写','已填写','待审核','已审核','需补充')),
  review_opinion TEXT,
  risk_level TEXT CHECK (risk_level IN ('高','中','低')),
  risk_note TEXT,
  remark TEXT,
  next_steps TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 下游分包表
CREATE TABLE downstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  contract_name TEXT,
  contract_amt NUMERIC(16,2) DEFAULT 0,
  settled TEXT CHECK (settled IN ('是','否','部分结算')),
  negotiation_note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 附件表
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER DEFAULT 0,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 索引
CREATE INDEX idx_downstreams_project ON downstreams(project_id);
CREATE INDEX idx_attachments_project ON attachments(project_id);
CREATE INDEX idx_projects_risk ON projects(risk_level);
CREATE INDEX idx_projects_phase ON projects(phase);
CREATE INDEX idx_projects_litigation ON projects(litigation);

-- 5. 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. RLS 策略（团队所有人可读写 - 后续可细化权限）
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE downstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON downstreams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON attachments FOR ALL USING (true) WITH CHECK (true);
