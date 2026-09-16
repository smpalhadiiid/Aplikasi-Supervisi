export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'GURU';

export interface School {
  id: string;
  npsn: string;
  name: string;
  address: string;
  headmaster_name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  password?: string;
  full_name: string;
  role: UserRole;
  school_id: string;
  avatar_url?: string;
  nip?: string;
  created_at: string;
}

export interface Teacher {
  id: string;
  user_id?: string;
  school_id: string;
  nip: string;
  full_name: string;
  email: string;
  username?: string;
  password?: string;
  subject: string;
  class_grade: string;
  phone: string;
  status: 'AKTIF' | 'NONAKTIF';
  created_at: string;
}

export type InstrumentType = 'RPPM' | 'SUPERVISI_PEMBELAJARAN';

export interface InstrumentItem {
  id: string;
  section_id: string;
  code: string;
  indicator: string;
  description: string;
  min_score: number;
  max_score: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface InstrumentSection {
  id: string;
  instrument_id: string;
  title: string;
  weight: number;
  sort_order: number;
  items?: InstrumentItem[];
  created_at: string;
}

export interface Instrument {
  id: string;
  school_id?: string;
  type: InstrumentType;
  title: string;
  description: string;
  version: string;
  is_active: boolean;
  sections?: InstrumentSection[];
  created_at: string;
  updated_at: string;
}

export interface AIDocumentIndicatorAnalysis {
  item_id: string;
  score_recommendation: number; // 1, 2, or 3
  evidence: string[];
  reason: string;
  strength: string;
  revision_note: string;
  recommendation: string;
  confidence: number;
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
  supervisor_score?: number;
  supervisor_notes?: string;
}

export interface AIDocumentAnalysisResponse {
  analysis: AIDocumentIndicatorAnalysis[];
  summary: {
    strengths: string[];
    priority_improvements: string[];
    general_recommendation: string;
  };
}

export interface RppReviewItem {
  id: string;
  rpp_review_id: string;
  item_id: string;
  score: number;
  notes: string;
  ai_recommendation_score?: number;
  ai_evidence?: string[];
  ai_reason?: string;
  ai_revision_note?: string;
  ai_recommendation?: string;
  ai_status?: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'PENDING';
  created_at: string;
}

export interface RppReview {
  id: string;
  school_id: string;
  teacher_id: string;
  supervisor_id: string;
  instrument_id: string;
  review_date: string;
  semester: string;
  academic_year: string;
  subject: string;
  class_grade: string;
  topic: string;
  total_score: number;
  max_possible_score: number;
  percentage_score: number;
  predicate: string;
  general_notes: string;
  status: 'DRAFT' | 'COMPLETED';
  teacher_name?: string;
  supervisor_name?: string;
  document_url?: string;
  document_name?: string;
  document_text?: string;
  ai_item_analysis?: AIDocumentIndicatorAnalysis[];
  items?: RppReviewItem[];
  created_at: string;
}

export interface SupervisionItem {
  id: string;
  supervision_id: string;
  item_id: string;
  score: number;
  notes: string;
  created_at: string;
}

export interface Supervision {
  id: string;
  school_id: string;
  teacher_id: string;
  supervisor_id: string;
  instrument_id: string;
  supervision_date: string;
  semester: string;
  academic_year: string;
  subject: string;
  class_grade: string;
  topic: string;
  total_score: number;
  max_possible_score: number;
  percentage_score: number;
  predicate: string;
  general_notes: string;
  status: 'DRAFT' | 'COMPLETED';
  teacher_name?: string;
  supervisor_name?: string;
  photos?: string[];
  items?: SupervisionItem[];
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  reference_type: 'RPP_REVIEW' | 'SUPERVISION';
  reference_id: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  deep_learning_analysis: string;
  recommendations: string[];
  follow_up_action: string;
  created_at: string;
}

export interface FollowUpPlan {
  id: string;
  school_id: string;
  teacher_id: string;
  supervisor_id: string;
  reference_type: 'RPP_REVIEW' | 'SUPERVISION';
  reference_id: string;
  activity_name: string;
  action_type: 'MENTORING' | 'LOKAKARYA' | 'IN_HOUSE_TRAINING' | 'SUPERVISI_KLINIS' | 'LAINNYA';
  target_date: string;
  status: 'BELUM_DIMULAI' | 'SEDANG_PROSES' | 'SELESAI';
  outcome_notes?: string;
  teacher_name?: string;
  supervisor_name?: string;
  created_at: string;
}

export interface DashboardStats {
  totalTeachers: number;
  totalRppReviews: number;
  totalSupervisions: number;
  avgRppScore: number;
  avgSupervisionScore: number;
  teachersNeedingFollowUp: Teacher[];
  monthlyProgress: {
    month: string;
    rppAvg: number;
    supervisionAvg: number;
  }[];
}
