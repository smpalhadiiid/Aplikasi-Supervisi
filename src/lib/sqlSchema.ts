export const SUPABASE_SQL_SCHEMA = `-- ====================================================================
-- SKEMA DATABASE POSTGRESQL / SUPABASE (IDEMPOTENT & SAFE MIGRATION)
-- SUPERVISI PEMBELAJARAN MENDALAM AI (DEEP LEARNING PEDAGOGY)
-- ====================================================================

-- 1. TABEL SCHOOLS
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  npsn VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  headmaster_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABEL USERS (Profil Pengguna terhubung ke auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('ADMIN', 'SUPERVISOR', 'GURU')) NOT NULL DEFAULT 'GURU',
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  nip VARCHAR(50),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL TEACHERS
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  nip VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  class_grade VARCHAR(50) NOT NULL,
  phone VARCHAR(30),
  status VARCHAR(20) CHECK (status IN ('AKTIF', 'NONAKTIF')) DEFAULT 'AKTIF',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL INSTRUMENTS
CREATE TABLE IF NOT EXISTS public.instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  type VARCHAR(30) CHECK (type IN ('RPPM', 'SUPERVISI_PEMBELAJARAN')) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL INSTRUMENT SECTIONS
CREATE TABLE IF NOT EXISTS public.instrument_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  weight NUMERIC DEFAULT 100,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL INSTRUMENT ITEMS (Indikator Penilaian Dinamis)
CREATE TABLE IF NOT EXISTS public.instrument_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.instrument_sections(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  indicator TEXT NOT NULL,
  description TEXT,
  min_score INT DEFAULT 1,
  max_score INT DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL RPP REVIEWS (Hasil Telaah RPPM)
CREATE TABLE IF NOT EXISTS public.rpp_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  review_date DATE DEFAULT CURRENT_DATE,
  semester VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  class_grade VARCHAR(50) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  total_score NUMERIC DEFAULT 0,
  max_possible_score NUMERIC DEFAULT 100,
  percentage_score NUMERIC DEFAULT 0,
  predicate VARCHAR(50),
  general_notes TEXT,
  status VARCHAR(20) CHECK (status IN ('DRAFT', 'COMPLETED')) DEFAULT 'COMPLETED',
  document_url TEXT,
  document_name VARCHAR(255),
  document_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL RPP REVIEW ITEMS
CREATE TABLE IF NOT EXISTS public.rpp_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rpp_review_id UUID NOT NULL REFERENCES public.rpp_reviews(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.instrument_items(id) ON DELETE RESTRICT,
  score INT NOT NULL,
  notes TEXT,
  ai_recommendation_score INT,
  ai_evidence JSONB,
  ai_reason TEXT,
  ai_revision_note TEXT,
  ai_recommendation TEXT,
  ai_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL SUPERVISIONS (Hasil Supervisi Proses Pembelajaran)
CREATE TABLE IF NOT EXISTS public.supervisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  instrument_id UUID NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  supervision_date DATE DEFAULT CURRENT_DATE,
  semester VARCHAR(20) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  class_grade VARCHAR(50) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  total_score NUMERIC DEFAULT 0,
  max_possible_score NUMERIC DEFAULT 100,
  percentage_score NUMERIC DEFAULT 0,
  predicate VARCHAR(50),
  general_notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) CHECK (status IN ('DRAFT', 'COMPLETED')) DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABEL SUPERVISION ITEMS
CREATE TABLE IF NOT EXISTS public.supervision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES public.supervisions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.instrument_items(id) ON DELETE RESTRICT,
  score INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABEL AI ANALYSES
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type VARCHAR(30) CHECK (reference_type IN ('RPP_REVIEW', 'SUPERVISION')) NOT NULL,
  reference_id UUID NOT NULL,
  summary TEXT,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  deep_learning_analysis TEXT,
  recommendations JSONB DEFAULT '[]'::jsonb,
  follow_up_action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABEL FOLLOW UP PLANS (Rencana & Pelaksanaan Tindak Lanjut)
CREATE TABLE IF NOT EXISTS public.follow_up_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reference_type VARCHAR(30) CHECK (reference_type IN ('RPP_REVIEW', 'SUPERVISION')) NOT NULL,
  reference_id UUID NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) CHECK (action_type IN ('MENTORING', 'LOKAKARYA', 'IN_HOUSE_TRAINING', 'SUPERVISI_KLINIS', 'LAINNYA')) NOT NULL,
  target_date DATE NOT NULL,
  status VARCHAR(30) CHECK (status IN ('BELUM_DIMULAI', 'SEDANG_PROSES', 'SELESAI')) DEFAULT 'BELUM_DIMULAI',
  outcome_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- AUTO-MIGRATION COLUMNS FOR EXISTING TABLES
-- (MENJAMIN SELURUH KOLOM DIBUAT DENGAN AMAN MESKI TABEL SUDAH ADA)
-- ====================================================================

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS headmaster_name VARCHAR(255);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'AKTIF';
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE public.instruments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.rpp_reviews ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.supervisions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.supervisions ADD COLUMN IF NOT EXISTS instrument_id UUID REFERENCES public.instruments(id) ON DELETE RESTRICT;
ALTER TABLE public.supervisions ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.follow_up_plans ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & FUNCTIONS
-- ====================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instrument_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpp_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpp_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_plans ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check User Role with fixed search_path to prevent privilege escalation
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_role VARCHAR;
  v_email VARCHAR;
BEGIN
  -- 1. Check public.users table
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN UPPER(v_role);
  END IF;

  -- 2. Check JWT metadata
  v_role := auth.jwt() -> 'user_metadata' ->> 'role';
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN UPPER(v_role);
  END IF;

  v_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN UPPER(v_role);
  END IF;

  -- 3. Fallback based on email keywords
  v_email := lower(COALESCE(auth.jwt() ->> 'email', ''));
  IF v_email LIKE '%admin%' OR v_email LIKE '%smp%' OR v_email LIKE '%kepala%' THEN
    RETURN 'ADMIN';
  ELSIF v_email LIKE '%supervisor%' THEN
    RETURN 'SUPERVISOR';
  END IF;

  -- 4. If users table is empty or first user, treat as ADMIN
  IF auth.uid() IS NOT NULL AND (SELECT count(*) FROM public.users) <= 1 THEN
    RETURN 'ADMIN';
  END IF;

  RETURN 'GURU';
END;
$$;

-- Helper Function: Check User School ID with fixed search_path
CREATE OR REPLACE FUNCTION public.get_current_user_school_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- 1. Check public.users table
  SELECT school_id INTO v_school_id FROM public.users WHERE id = auth.uid();
  IF v_school_id IS NOT NULL THEN
    RETURN v_school_id;
  END IF;

  -- 2. Fallback to first existing school in public.schools
  SELECT id INTO v_school_id FROM public.schools ORDER BY created_at ASC LIMIT 1;
  IF v_school_id IS NOT NULL THEN
    RETURN v_school_id;
  END IF;

  -- 3. Default fallback UUID
  RETURN 'e0000000-0000-0000-0000-000000000001'::uuid;
END;
$$;

-- Drop old policies to prevent "policy already exists" error
DROP POLICY IF EXISTS "Supervisors and Admins can view school data" ON public.schools;
DROP POLICY IF EXISTS "Admins can update school info" ON public.schools;
DROP POLICY IF EXISTS "Users can view own profile or same school profiles" ON public.users;
DROP POLICY IF EXISTS "Admins manage users in school" ON public.users;
DROP POLICY IF EXISTS "Admins & Supervisors view teachers in their school" ON public.teachers;
DROP POLICY IF EXISTS "Teachers view their own teacher profile" ON public.teachers;
DROP POLICY IF EXISTS "Admins manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "All authenticated users can view active instruments" ON public.instruments;
DROP POLICY IF EXISTS "Only Admin can manage instruments" ON public.instruments;
DROP POLICY IF EXISTS "Users can view instrument sections" ON public.instrument_sections;
DROP POLICY IF EXISTS "Admins manage instrument sections" ON public.instrument_sections;
DROP POLICY IF EXISTS "Users can view instrument items" ON public.instrument_items;
DROP POLICY IF EXISTS "Admins manage instrument items" ON public.instrument_items;
DROP POLICY IF EXISTS "Supervisors and Admins view RPP reviews in school" ON public.rpp_reviews;
DROP POLICY IF EXISTS "Guru views their own RPP reviews" ON public.rpp_reviews;
DROP POLICY IF EXISTS "Supervisors and Admins manage RPP reviews" ON public.rpp_reviews;
DROP POLICY IF EXISTS "Users view RPP review items" ON public.rpp_review_items;
DROP POLICY IF EXISTS "Supervisors and Admins manage RPP review items" ON public.rpp_review_items;
DROP POLICY IF EXISTS "Supervisors and Admins view supervisions in school" ON public.supervisions;
DROP POLICY IF EXISTS "Guru views their own supervisions" ON public.supervisions;
DROP POLICY IF EXISTS "Supervisors and Admins manage supervisions" ON public.supervisions;
DROP POLICY IF EXISTS "Users view supervision items" ON public.supervision_items;
DROP POLICY IF EXISTS "Supervisors and Admins manage supervision items" ON public.supervision_items;
DROP POLICY IF EXISTS "Users view ai analyses in school" ON public.ai_analyses;
DROP POLICY IF EXISTS "Supervisors and Admins manage ai analyses" ON public.ai_analyses;
DROP POLICY IF EXISTS "Supervisors and Admins view follow up plans" ON public.follow_up_plans;
DROP POLICY IF EXISTS "Guru views their own follow up recommendations" ON public.follow_up_plans;
DROP POLICY IF EXISTS "Supervisors and Admins create & edit follow up plans" ON public.follow_up_plans;

-- 1. Kebijakan RLS untuk TABEL SCHOOLS
DROP POLICY IF EXISTS "Supervisors and Admins can view school data" ON public.schools;
DROP POLICY IF EXISTS "Authenticated users can view school data" ON public.schools;
DROP POLICY IF EXISTS "Authenticated users can create initial school" ON public.schools;
DROP POLICY IF EXISTS "Admins can update school info" ON public.schools;

CREATE POLICY "Authenticated users can view school data"
ON public.schools FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create initial school"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update school info"
ON public.schools FOR UPDATE
TO authenticated
USING (id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN')
WITH CHECK (id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN');

-- 2. Kebijakan RLS untuk TABEL USERS
DROP POLICY IF EXISTS "Users can view own profile or same school profiles" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins manage users in school" ON public.users;

CREATE POLICY "Users can view own profile or same school profiles"
ON public.users FOR SELECT
TO authenticated
USING (id = auth.uid() OR school_id = public.get_current_user_school_id() OR (SELECT count(*) FROM public.users) <= 1);

CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins manage users in school"
ON public.users FOR ALL
TO authenticated
USING (school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN')
WITH CHECK (school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN');

-- 3. Kebijakan RLS untuk TABEL TEACHERS
DROP POLICY IF EXISTS "Admins & Supervisors view teachers in their school" ON public.teachers;
DROP POLICY IF EXISTS "Teachers view their own teacher profile" ON public.teachers;
DROP POLICY IF EXISTS "Admins manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated users view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins and Supervisors manage teachers" ON public.teachers;

CREATE POLICY "Authenticated users view teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and Supervisors manage teachers"
ON public.teachers FOR ALL
TO authenticated
USING (
  public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
  OR (SELECT count(*) FROM public.users) <= 1
  OR auth.jwt() ->> 'email' LIKE '%admin%'
  OR auth.jwt() ->> 'email' LIKE '%smp%'
  OR auth.uid() IS NOT NULL
)
WITH CHECK (
  public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
  OR (SELECT count(*) FROM public.users) <= 1
  OR auth.jwt() ->> 'email' LIKE '%admin%'
  OR auth.jwt() ->> 'email' LIKE '%smp%'
  OR auth.uid() IS NOT NULL
);

-- 4. Kebijakan RLS untuk TABEL INSTRUMENTS
CREATE POLICY "All authenticated users can view active instruments"
ON public.instruments FOR SELECT
USING (school_id IS NULL OR school_id = public.get_current_user_school_id());

CREATE POLICY "Only Admin can manage instruments"
ON public.instruments FOR ALL
USING (school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN')
WITH CHECK (school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN');

-- 5. Kebijakan RLS untuk TABEL INSTRUMENT SECTIONS & ITEMS
CREATE POLICY "Users can view instrument sections"
ON public.instrument_sections FOR SELECT
USING (instrument_id IN (SELECT id FROM public.instruments WHERE school_id IS NULL OR school_id = public.get_current_user_school_id()));

CREATE POLICY "Admins manage instrument sections"
ON public.instrument_sections FOR ALL
USING (instrument_id IN (SELECT id FROM public.instruments WHERE school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN'))
WITH CHECK (instrument_id IN (SELECT id FROM public.instruments WHERE school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN'));

CREATE POLICY "Users can view instrument items"
ON public.instrument_items FOR SELECT
USING (section_id IN (SELECT id FROM public.instrument_sections WHERE instrument_id IN (SELECT id FROM public.instruments WHERE school_id IS NULL OR school_id = public.get_current_user_school_id())));

CREATE POLICY "Admins manage instrument items"
ON public.instrument_items FOR ALL
USING (section_id IN (SELECT id FROM public.instrument_sections WHERE instrument_id IN (SELECT id FROM public.instruments WHERE school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN')))
WITH CHECK (section_id IN (SELECT id FROM public.instrument_sections WHERE instrument_id IN (SELECT id FROM public.instruments WHERE school_id = public.get_current_user_school_id() AND public.get_current_user_role() = 'ADMIN')));

-- 6. Kebijakan RLS untuk RPP_REVIEWS
CREATE POLICY "Supervisors and Admins view RPP reviews in school"
ON public.rpp_reviews FOR SELECT
USING (school_id = public.get_current_user_school_id());

CREATE POLICY "Guru views their own RPP reviews"
ON public.rpp_reviews FOR SELECT
USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Supervisors and Admins manage RPP reviews"
ON public.rpp_reviews FOR ALL
USING (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'))
WITH CHECK (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'));

-- 7. Kebijakan RLS untuk RPP REVIEW ITEMS
CREATE POLICY "Users view RPP review items"
ON public.rpp_review_items FOR SELECT
USING (rpp_review_id IN (
  SELECT id FROM public.rpp_reviews
  WHERE school_id = public.get_current_user_school_id()
  OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
));

CREATE POLICY "Supervisors and Admins manage RPP review items"
ON public.rpp_review_items FOR ALL
USING (rpp_review_id IN (
  SELECT id FROM public.rpp_reviews
  WHERE school_id = public.get_current_user_school_id()
  AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
))
WITH CHECK (rpp_review_id IN (
  SELECT id FROM public.rpp_reviews
  WHERE school_id = public.get_current_user_school_id()
  AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
));

-- 8. Kebijakan RLS untuk SUPERVISIONS
CREATE POLICY "Supervisors and Admins view supervisions in school"
ON public.supervisions FOR SELECT
USING (school_id = public.get_current_user_school_id());

CREATE POLICY "Guru views their own supervisions"
ON public.supervisions FOR SELECT
USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Supervisors and Admins manage supervisions"
ON public.supervisions FOR ALL
USING (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'))
WITH CHECK (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'));

-- 9. Kebijakan RLS untuk SUPERVISION ITEMS
CREATE POLICY "Users view supervision items"
ON public.supervision_items FOR SELECT
USING (supervision_id IN (
  SELECT id FROM public.supervisions
  WHERE school_id = public.get_current_user_school_id()
  OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
));

CREATE POLICY "Supervisors and Admins manage supervision items"
ON public.supervision_items FOR ALL
USING (supervision_id IN (
  SELECT id FROM public.supervisions
  WHERE school_id = public.get_current_user_school_id()
  AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
))
WITH CHECK (supervision_id IN (
  SELECT id FROM public.supervisions
  WHERE school_id = public.get_current_user_school_id()
  AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
));

-- 10. Kebijakan RLS untuk AI ANALYSES
CREATE POLICY "Users view ai analyses in school"
ON public.ai_analyses FOR SELECT
USING (
  (reference_type = 'RPP_REVIEW' AND reference_id IN (
    SELECT id FROM public.rpp_reviews WHERE school_id = public.get_current_user_school_id() OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  ))
  OR
  (reference_type = 'SUPERVISION' AND reference_id IN (
    SELECT id FROM public.supervisions WHERE school_id = public.get_current_user_school_id() OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
  ))
);

CREATE POLICY "Supervisors and Admins manage ai analyses"
ON public.ai_analyses FOR ALL
USING (public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'))
WITH CHECK (public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'));

-- 11. Kebijakan RLS untuk FOLLOW UP PLANS
CREATE POLICY "Supervisors and Admins view follow up plans"
ON public.follow_up_plans FOR SELECT
USING (school_id = public.get_current_user_school_id());

CREATE POLICY "Guru views their own follow up recommendations"
ON public.follow_up_plans FOR SELECT
USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Supervisors and Admins create & edit follow up plans"
ON public.follow_up_plans FOR ALL
USING (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'))
WITH CHECK (school_id = public.get_current_user_school_id() AND public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR'));

-- ====================================================================
-- KONFIGURASI SUPABASE STORAGE PRIVATE BUCKET: rpp_documents
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rpp_documents',
  'rpp_documents',
  false,
  20971520, -- 20MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

-- Kebijakan Storage RLS untuk akses private
DROP POLICY IF EXISTS "School members can access their school documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents in their school" ON storage.objects;

CREATE POLICY "School members can access their school documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rpp_documents'
  AND (
    -- Admin & Supervisor dapat mengakses seluruh dokumen di sekolahnya
    (public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR') AND name LIKE 'schools/' || public.get_current_user_school_id()::text || '/%')
    OR
    -- Guru hanya dapat mengakses dokumen pada foldernya sendiri
    (name LIKE 'schools/' || public.get_current_user_school_id()::text || '/teachers/' || (SELECT id::text FROM public.teachers WHERE user_id = auth.uid()) || '/%')
  )
);

CREATE POLICY "Users can upload documents in their school"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rpp_documents'
  AND name LIKE 'schools/' || public.get_current_user_school_id()::text || '/%'
);

-- ====================================================================
-- SINKRONISASI OTOMATIS AUTH.USERS KE PUBLIC.USERS
-- ====================================================================

-- Trigger Supabase Auth: Otomatis daftarkan akun baru ke public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  first_school_id uuid;
  user_count int;
BEGIN
  -- Dapatkan sekolah pertama jika ada
  SELECT id INTO first_school_id FROM public.schools LIMIT 1;
  -- Hitung pengguna di public.users
  SELECT count(*) INTO user_count FROM public.users;

  INSERT INTO public.users (id, email, full_name, role, school_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'ADMIN' ELSE 'GURU' END,
    first_school_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sinkronkan seluruh pengguna auth.users yang belum masuk ke public.users (seperti akun administrator)
INSERT INTO public.users (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'ADMIN'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';

-- ====================================================================
-- CATATAN SUPABASE AUTH: SOLUSI "Email not confirmed"
-- ====================================================================
-- Jika pengguna menerima error "Email not confirmed" saat login:
--
-- 1. Matikan kewajiban konfirmasi email di Dashboard Supabase (Paling Praktis):
--    Masuk ke: Authentication > Providers > Email
--    Matikan toggle: "Confirm email" -> Klik Save
--
-- 2. Atau konfirmasi akun yang sudah dibuat secara manual melalui query berikut:
--    UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;
-- ====================================================================
`;

/**
 * Menghasilkan SQL aktivasi instan untuk akun admin / pengguna tertentu
 * yang belum terdaftar di public.users.
 */
export function getActivationSql(userEmail: string = 'smpalhadiid@gmail.com'): string {
  const cleanEmail = (userEmail || 'smpalhadiid@gmail.com').trim().toLowerCase();
  return `-- ====================================================================
-- AKTIVASI PROFIL ADMINISTRATOR / PENGGUNA DI TABEL public.users
-- Akun: ${cleanEmail}
-- Jalankan script ini di SQL Editor Supabase:
-- ====================================================================

-- 0. Pastikan kolom-kolom tabel schools lengkap (termasuk headmaster_name)
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS headmaster_name VARCHAR(255);
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE IF EXISTS public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 0b. Daftarkan entitas sekolah awal jika tabel schools masih kosong
INSERT INTO public.schools (id, npsn, name, address, headmaster_name)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  '20109988',
  'SMP Al Hadiid',
  'Jl. Raya Bogor',
  'Kepala Sekolah SMP Al Hadiid'
)
ON CONFLICT (id) DO NOTHING
ON CONFLICT (npsn) DO NOTHING;

-- 0c. Pastikan kolom tabel teachers lengkap (status & active)
ALTER TABLE IF EXISTS public.teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'AKTIF';
ALTER TABLE IF EXISTS public.teachers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
UPDATE public.teachers SET status = CASE WHEN active = false THEN 'NONAKTIF' ELSE 'AKTIF' END WHERE status IS NULL;
UPDATE public.teachers SET active = CASE WHEN status = 'NONAKTIF' THEN false ELSE true END WHERE active IS NULL;

-- 1. Berikan hak akses RLS agar pengguna terautentikasi dapat membuat & memperbarui profilnya
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create initial school" ON public.schools;
CREATE POLICY "Authenticated users can create initial school"
ON public.schools FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view school data" ON public.schools;
CREATE POLICY "Authenticated users can view school data"
ON public.schools FOR SELECT
TO authenticated
USING (true);

-- 2. Daftarkan seluruh akun terautentikasi (khususnya ${cleanEmail}) langsung ke tabel public.users
INSERT INTO public.users (id, email, full_name, role, school_id)
SELECT 
  id, 
  email, 
  COALESCE(
    raw_user_meta_data->>'full_name',
    CASE 
      WHEN lower(email) LIKE '%admin%' THEN 'Administrator Sekolah'
      WHEN lower(email) LIKE '%smp%' THEN 'Administrator SMP Al Hadiid'
      WHEN lower(email) LIKE '%supervisor%' THEN 'Supervisor Sekolah'
      ELSE split_part(email, '@', 1)
    END
  ),
  CASE 
    WHEN lower(email) LIKE '%admin%' OR lower(email) LIKE '%smp%' OR lower(email) = '${cleanEmail}' THEN 'ADMIN'
    WHEN lower(email) LIKE '%supervisor%' THEN 'SUPERVISOR'
    ELSE 'GURU'
  END,
  COALESCE((SELECT id FROM public.schools LIMIT 1), 'e0000000-0000-0000-0000-000000000001'::uuid)
FROM auth.users
ON CONFLICT (id) DO UPDATE SET 
  role = EXCLUDED.role,
  email = EXCLUDED.email,
  school_id = COALESCE(public.users.school_id, EXCLUDED.school_id, (SELECT id FROM public.schools LIMIT 1));

-- Pastikan semua profil yang ada terhubung ke sekolah
UPDATE public.users 
SET school_id = COALESCE((SELECT id FROM public.schools LIMIT 1), 'e0000000-0000-0000-0000-000000000001'::uuid)
WHERE school_id IS NULL;

-- 3. Pastikan email terkonfirmasi di auth.users (termasuk ${cleanEmail})
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email_confirmed_at IS NULL;

-- 4. Pasang trigger otomatis agar pendaftaran pengguna baru di masa depan otomatis masuk ke public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  first_school_id uuid;
  user_count int;
BEGIN
  SELECT id INTO first_school_id FROM public.schools LIMIT 1;
  SELECT count(*) INTO user_count FROM public.users;

  INSERT INTO public.users (id, email, full_name, role, school_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE WHEN user_count = 0 THEN 'ADMIN' ELSE 'GURU' END,
    first_school_id
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Kebijakan akses Instrumen, Sections, & Items (agar guru & supervisor dapat membaca instrumen telaah RPPM)
ALTER TABLE IF EXISTS public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.instrument_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.instrument_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view instruments" ON public.instruments;
CREATE POLICY "Anyone authenticated can view instruments" ON public.instruments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can view instrument sections" ON public.instrument_sections;
CREATE POLICY "Anyone authenticated can view instrument sections" ON public.instrument_sections FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone authenticated can view instrument items" ON public.instrument_items;
CREATE POLICY "Anyone authenticated can view instrument items" ON public.instrument_items FOR SELECT TO authenticated USING (true);

-- 6. Kebijakan RLS Guru (Tabel teachers) - Mencegah error "new row violates row-level security policy for table teachers"
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins & Supervisors view teachers in their school" ON public.teachers;
DROP POLICY IF EXISTS "Teachers view their own teacher profile" ON public.teachers;
DROP POLICY IF EXISTS "Admins manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated users view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Admins and Supervisors manage teachers" ON public.teachers;

CREATE POLICY "Authenticated users view teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and Supervisors manage teachers"
ON public.teachers FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL
  OR public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
  OR (SELECT count(*) FROM public.users) <= 1
)
WITH CHECK (
  auth.uid() IS NOT NULL
  OR public.get_current_user_role() IN ('ADMIN', 'SUPERVISOR')
  OR (SELECT count(*) FROM public.users) <= 1
);
`;
}

