export interface Project {
  id: string;
  seq: number | null;
  name: string;
  type: '自营' | '转包' | '合作挂靠' | '';
  phase: '并购前' | '并购后' | '';
  location: string;
  ld_role: '总包' | '分包' | '';

  // 总包信息（ld_role=分包时使用）
  gc_unit: string;
  gc_contact: string;
  gc_phone: string;
  gc_received: number | null;
  gc_remaining: number | null;
  gc_settle_status: '未结算' | '办理中' | '已结算' | '';
  gc_settle_note: string;
  gc_contract_name: string;
  gc_contract_amt: number | null;

  // 业主信息
  owner_unit: string;
  owner_contact: string;
  owner_phone: string;
  owner_received: number | null;
  owner_remaining: number | null;
  owner_settle_status: '未结算' | '办理中' | '已结算' | '';
  owner_to_gc_settle: '未结算' | '办理中' | '已结算' | '';
  owner_settle_note: string;
  upstream_contract_name: string;
  upstream_contract_amt: number | null;

  // 诉讼
  litigation: boolean;
  case_type: '主诉' | '被诉' | '仲裁' | '';
  litigant_role: '原告' | '被告' | '第三人' | '申请执行人' | '被执行人' | '';
  case_no: string;
  court: string;
  case_stage: '未立案' | '一审中' | '二审中' | '再审中' | '已判决' | '执行中' | '已结案' | '';
  dispute_amt: number | null;
  judgment: string;
  execution: string;

  // 农民工
  worker_issue: boolean;
  worker_count: number | null;
  worker_amt: number | null;
  worker_status: '待处理' | '处理中' | '已解决' | '';
  worker_note: string;

  // 资料
  data_missing: boolean;
  data_missing_note: string;
  doc_storage_status: string;

  // 管理
  risk_level: '极高(维稳)' | '高' | '中' | '低' | '';
  priority: 'P0' | 'P1' | 'P2' | '';
  fact_summary: string;
  remark: string;
  next_steps: string;
  updated_by: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Memo {
  id: string;
  project_id: string;
  content: string;
  author: string;
  created_at: string;
}

export interface Todo {
  id: string;
  project_id: string;
  task: string;
  owner: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

export interface Downstream {
  id: string;
  project_id: string;
  name: string;
  contact: string;
  phone: string;
  settled: '未结算' | '办理中' | '已结算' | '';
  negotiation_note: string;
  sort_order: number;
  settle_est: number | null;
  claim_amt: number | null;
  review_amt: number | null;
  claim_dispute: string;
  paid: number | null;     // 对下已付（元）
  unpaid: number | null;   // 对下未付（元）
}

// 对下合同：每个下游分包可签多份
export interface DownstreamContract {
  id: string;
  downstream_id: string;
  name: string;
  amt: number | null;      // 合同金额（元）
  sort_order: number;
  created_at: string;
}

// 对甲合同（与总包 gc / 与业主 owner），一个主体可签多份
export interface Contract {
  id: string;
  project_id: string;
  party: 'gc' | 'owner';
  name: string;
  amt: number | null;      // 合同金额（元）
  sort_order: number;
  created_at: string;
}

export const BLANK_PROJECT: Project = {
  id: '', seq: null, name: '', type: '', phase: '', location: '', ld_role: '',
  gc_unit: '', gc_contact: '', gc_phone: '', gc_received: null, gc_remaining: null, gc_settle_status: '', gc_settle_note: '', gc_contract_name: '', gc_contract_amt: null,
  owner_unit: '', owner_contact: '', owner_phone: '', owner_received: null, owner_remaining: null,
  owner_settle_status: '', owner_to_gc_settle: '', owner_settle_note: '', upstream_contract_name: '', upstream_contract_amt: null,
  litigation: false, case_type: '', litigant_role: '', case_no: '', court: '', case_stage: '', dispute_amt: null, judgment: '', execution: '',
  worker_issue: false, worker_count: null, worker_amt: null, worker_status: '', worker_note: '',
  data_missing: false, data_missing_note: '', doc_storage_status: '',
  risk_level: '', priority: '', fact_summary: '', remark: '', next_steps: '', updated_by: '', archived: false,
  created_at: '', updated_at: ''
};
