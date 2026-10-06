import {
  School,
  User,
  Teacher,
  Instrument,
  InstrumentType,
  InstrumentSection,
  InstrumentItem,
  RppReview,
  RppReviewItem,
  Supervision,
  SupervisionItem,
  AIAnalysis,
  FollowUpPlan,
  DashboardStats,
  UserRole,
} from '../types';
import { supabase } from './supabaseClient';
import {
  DEFAULT_INSTRUMENTS_TEMPLATES,
  InstrumentTemplate,
  getDefaultInstruments,
  DEFAULT_RPPM_TEMPLATE,
  DEFAULT_SUPERVISI_TEMPLATE,
  DEFAULT_RPPM_INSTRUMENT_ID,
  DEFAULT_SUPERVISI_INSTRUMENT_ID,
} from './instrumentTemplates';

export interface DBState {
  schools: School[];
  users: User[];
  teachers: Teacher[];
  instruments: Instrument[];
  rppReviews: RppReview[];
  supervisions: Supervision[];
  aiAnalyses: AIAnalysis[];
  followUpPlans: FollowUpPlan[];
}

export const DEFAULT_SCHOOL: School = {
  id: 'e0000000-0000-0000-0000-000000000001',
  npsn: '20109988',
  name: 'SMP Al Hadiid',
  address: 'Jl. Raya Bogor',
  headmaster_name: 'Kepala Sekolah SMP Al Hadiid',
  created_at: '2026-09-10T04:41:28.949075+00:00',
};

const EMPTY_SCHOOL: School = DEFAULT_SCHOOL;

class DatabaseService {
  private state: DBState = {
    schools: [DEFAULT_SCHOOL],
    users: [],
    teachers: [],
    instruments: getDefaultInstruments(),
    rppReviews: [],
    supervisions: [],
    aiAnalyses: [],
    followUpPlans: [],
  };

  private listeners: Set<() => void> = new Set();
  private isSyncing = false;
  private pollingTimer: any = null;

  constructor() {
    if (supabase) {
      void this.refreshFromSupabase();
      if (typeof window !== 'undefined') {
        this.pollingTimer = setInterval(() => {
          void this.refreshFromSupabase();
        }, 15000);
      }
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[DB notify error]:', err);
      }
    });
  }

  public uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback compliant UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  public isUuid(value: string | null | undefined): boolean {
    if (!value || typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  }

  private ensureSupabaseClient() {
    if (!supabase) {
      throw new Error(
        'Supabase belum terkonfigurasi. Pastikan variabel lingkungan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY telah diisi dengan benar.'
      );
    }
    return supabase;
  }

  // --- ENSURE VALID SCHOOL ID ---
  public async ensureValidSchoolId(profile?: Partial<User> | null): Promise<string> {
    const fallbackId = this.state.schools[0]?.id || DEFAULT_SCHOOL.id;

    if (!supabase) {
      return fallbackId;
    }

    try {
      const client = this.ensureSupabaseClient();

      // 1. If profile has valid UUID school_id, check if it exists in Supabase
      if (profile?.school_id && this.isUuid(profile.school_id)) {
        try {
          const { data: existingSchool } = await client
            .from('schools')
            .select('id')
            .eq('id', profile.school_id)
            .maybeSingle();

          if (existingSchool?.id) {
            return existingSchool.id;
          }
        } catch (err) {
          console.warn('[DB] Gagal memeriksa existing school_id:', err);
        }
      }

      // 2. Query any existing school from public.schools
      const { data: schools, error: schoolErr } = await client
        .from('schools')
        .select('id')
        .limit(1);

      if (!schoolErr && schools && schools.length > 0 && this.isUuid(schools[0].id)) {
        const targetId = schools[0].id;
        if (profile?.id && this.isUuid(profile.id) && profile.school_id !== targetId) {
          try {
            await client.from('users').update({ school_id: targetId }).eq('id', profile.id);
          } catch {
            // ignore silent background update
          }
        }
        return targetId;
      }

      // 3. If no school exists yet in Supabase, create initial school safely
      // We purposefully try column sets that do NOT require 'headmaster_name' first,
      // so if the user's Supabase schema doesn't have 'headmaster_name', it won't fail with PostgREST schema cache error!
      const targetSchoolId = this.isUuid(fallbackId) ? fallbackId : this.uuid();
      const curSchool = this.getSchool();

      const candidatePayloads: Array<Record<string, any>> = [
        // Candidate 1: Standard columns without headmaster_name (safe for all schema variations)
        {
          id: targetSchoolId,
          npsn: curSchool.npsn || '20109988',
          name: curSchool.name || 'SMP Al Hadiid',
          address: curSchool.address || 'Jl. Raya Bogor',
        },
        // Candidate 2: Minimal columns
        {
          id: targetSchoolId,
          npsn: curSchool.npsn || '20109988',
          name: curSchool.name || 'SMP Al Hadiid',
        },
        // Candidate 3: Full columns with headmaster_name
        {
          id: targetSchoolId,
          npsn: curSchool.npsn || '20109988',
          name: curSchool.name || 'SMP Al Hadiid',
          address: curSchool.address || 'Jl. Raya Bogor',
          headmaster_name: curSchool.headmaster_name || 'Kepala Sekolah SMP Al Hadiid',
        },
      ];

      for (const payload of candidatePayloads) {
        try {
          const { data: createdSchool, error: createErr } = await client
            .from('schools')
            .insert(payload)
            .select('id')
            .maybeSingle();

          if (!createErr && createdSchool?.id) {
            if (profile?.id && this.isUuid(profile.id)) {
              try {
                await client.from('users').update({ school_id: createdSchool.id }).eq('id', profile.id);
              } catch {
                // ignore
              }
            }
            return createdSchool.id;
          }
        } catch (insertErr) {
          console.warn('[DB] Percobaan insert sekolah ke Supabase gagal, mencoba payload alternatif:', insertErr);
        }
      }
    } catch (err) {
      console.warn('[DB] Penyiapan entitas sekolah di Supabase belum selesai, beralih ke ID fallback:', err);
    }

    // Gracefully return fallback school ID so UI and app processes NEVER crash
    return fallbackId;
  }

  /**
   * Menyinkronkan identitas pengguna sesi Supabase Auth & entitas sekolah ke database Supabase (public.users & public.schools).
   * Menjamin bahwa fungsi RLS get_current_user_role() dan get_current_user_school_id() tidak bernilai NULL.
   */
  public async syncAuthUserToDatabase(): Promise<{ schoolId: string; userSynced: boolean }> {
    const fallbackId = 'e0000000-0000-0000-0000-000000000001';
    if (!supabase) {
      return { schoolId: fallbackId, userSynced: true };
    }
    const client = supabase;
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session?.user) {
        const schoolId = await this.ensureValidSchoolId();
        return { schoolId, userSynced: false };
      }

      const authUser = session.user;
      const cleanEmail = (authUser.email || '').toLowerCase();
      const isAdmin = cleanEmail.includes('admin') || cleanEmail.includes('smp') || cleanEmail.includes('kepala');
      const isSupervisor = cleanEmail.includes('supervisor');
      const matchedUser = this.state.users.find(u => u.id === authUser.id || (u.email && u.email.toLowerCase() === cleanEmail));
      const targetRole: UserRole = matchedUser?.role || (isAdmin ? 'ADMIN' : (isSupervisor ? 'SUPERVISOR' : 'GURU'));

      // 1. Dapatkan atau buat ID sekolah aktif
      const activeSchoolId = await this.ensureValidSchoolId(matchedUser);

      // 2. Cek apakah record profil sudah ada di public.users
      const { data: existingUser } = await client
        .from('users')
        .select('id, school_id, role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!existingUser) {
        const fullName =
          matchedUser?.full_name ||
          authUser.user_metadata?.full_name ||
          (isAdmin ? 'Administrator SMP Al Hadiid' : cleanEmail.split('@')[0]);

        const payloadsToTry = [
          {
            id: authUser.id,
            email: cleanEmail,
            full_name: fullName,
            role: targetRole,
            school_id: activeSchoolId,
          },
          {
            id: authUser.id,
            email: cleanEmail,
            full_name: fullName,
            role: targetRole,
            school_id: null,
          },
        ];

        for (const p of payloadsToTry) {
          try {
            const { error: insErr } = await client.from('users').insert(p);
            if (!insErr) {
              if (p.school_id === null && activeSchoolId) {
                try {
                  await client.from('users').update({ school_id: activeSchoolId }).eq('id', authUser.id);
                } catch {
                  // ignore
                }
              }
              break;
            }
          } catch {
            // lanjut payload berikutnya
          }
        }
      } else {
        // Jika profil sudah ada tetapi school_id masih kosong atau role perlu disesuaikan
        const needsUpdate =
          (!existingUser.school_id && activeSchoolId) ||
          (existingUser.role !== 'ADMIN' && targetRole === 'ADMIN');

        if (needsUpdate) {
          try {
            await client
              .from('users')
              .update({
                school_id: activeSchoolId || existingUser.school_id,
                role: targetRole,
              })
              .eq('id', authUser.id);
          } catch {
            // ignore
          }
        }
      }

      return { schoolId: activeSchoolId, userSynced: true };
    } catch (err) {
      console.warn('[DB] syncAuthUserToDatabase dilewati:', err);
      return { schoolId: fallbackId, userSynced: false };
    }
  }

  // --- VALID SUPERVISOR ID RESOLVER (PREVENTS UUID & FOREIGN KEY ERRORS) ---
  public async ensureValidSupervisorId(providedId?: string): Promise<string> {
    const fallbackSupervisorId = 'a0000000-0000-0000-0000-000000000001';

    // 1. If provided ID is already a valid UUID
    if (providedId && this.isUuid(providedId)) {
      return providedId;
    }

    // 2. Check Supabase auth session
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUid = sessionData.session?.user?.id;
        if (authUid && this.isUuid(authUid)) {
          return authUid;
        }
      } catch {
        // Continue fallback
      }
    }

    // 3. Check local users for any user with valid UUID and admin/supervisor role
    const adminUser = this.state.users.find(
      (u) => this.isUuid(u.id) && (u.role === 'ADMIN' || u.role === 'SUPERVISOR')
    );
    if (adminUser?.id) {
      return adminUser.id;
    }

    // 4. Any user with a valid UUID
    const anyUuidUser = this.state.users.find((u) => this.isUuid(u.id));
    if (anyUuidUser?.id) {
      return anyUuidUser.id;
    }

    // 5. Ensure fallback supervisor profile exists in public.users if Supabase is connected
    if (supabase) {
      try {
        const schoolId = await this.ensureValidSchoolId();
        await supabase.from('users').upsert(
          {
            id: fallbackSupervisorId,
            email: 'supervisor@smpalhadiid.sch.id',
            full_name: 'Supervisor Resmi',
            role: 'SUPERVISOR',
            school_id: schoolId,
          },
          { onConflict: 'id' }
        );
      } catch {
        // ignore
      }
    }

    return fallbackSupervisorId;
  }

  // --- SEED DEFAULT INSTRUMENTS IF TABLE IS EMPTY OR MISSING ITEMS ---
  public async ensureInstrumentsSeeded(schoolId: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    try {
      const defaults = getDefaultInstruments(schoolId);

      for (const inst of defaults) {
        // 1. Upsert instrument parent
        await client.from('instruments').upsert(
          {
            id: inst.id,
            school_id: schoolId,
            type: inst.type,
            title: inst.title,
            description: inst.description || null,
            version: inst.version || 'v1.0',
            is_active: true,
          },
          { onConflict: 'id' }
        );

        // 2. Upsert sections & items
        if (inst.sections && inst.sections.length > 0) {
          for (const sec of inst.sections) {
            await client.from('instrument_sections').upsert(
              {
                id: sec.id,
                instrument_id: inst.id,
                title: sec.title,
                weight: sec.weight || 0,
                sort_order: sec.sort_order || 0,
              },
              { onConflict: 'id' }
            );

            if (sec.items && sec.items.length > 0) {
              const itemRows = sec.items.map((item) => ({
                id: item.id,
                section_id: sec.id,
                code: item.code,
                indicator: item.indicator,
                description: item.description || null,
                min_score: item.min_score || 1,
                max_score: item.max_score || 4,
                is_active: item.is_active !== false,
                sort_order: item.sort_order || 0,
              }));

              await client.from('instrument_items').upsert(itemRows, { onConflict: 'id' });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[DB] ensureInstrumentsSeeded info:', err?.message || err);
    }
  }

  // --- REGISTER / UPDATE LOGGED IN USER IN LOCAL STATE ---
  public setCurrentUserInState(user: User): void {
    if (!user || !user.id) return;
    const existingIndex = this.state.users.findIndex(
      (u) => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase())
    );
    if (existingIndex >= 0) {
      this.state.users[existingIndex] = { ...this.state.users[existingIndex], ...user };
    } else {
      this.state.users.push(user);
    }
  }

  // --- ENSURE INSTRUMENTS INTEGRITY (FALLBACK & HYDRATION) ---
  public ensureInstrumentsIntegrity(): void {
    const defaults = getDefaultInstruments();
    if (!this.state.instruments || this.state.instruments.length === 0) {
      this.state.instruments = defaults;
      return;
    }

    // 1. Ensure RPPM exists and has complete sections & items
    const rppmIdx = this.state.instruments.findIndex((i) => i.type === 'RPPM');
    const defaultRppm = defaults.find((i) => i.type === 'RPPM')!;
    if (rppmIdx === -1) {
      this.state.instruments.unshift(defaultRppm);
    } else {
      const currentRppm = this.state.instruments[rppmIdx];
      const itemsCount = (currentRppm.sections || []).reduce((acc, s) => acc + (s.items?.length || 0), 0);
      if (!currentRppm.sections || currentRppm.sections.length === 0 || itemsCount === 0) {
        this.state.instruments[rppmIdx] = {
          ...currentRppm,
          type: 'RPPM',
          title: currentRppm.title || defaultRppm.title,
          description: currentRppm.description || defaultRppm.description,
          is_active: currentRppm.is_active !== false,
          sections: defaultRppm.sections?.map((s) => ({
            ...s,
            instrument_id: currentRppm.id,
            items: s.items?.map((it) => ({ ...it, section_id: s.id })),
          })),
        };
      }
    }

    // 2. Ensure SUPERVISI_PEMBELAJARAN exists and has complete sections & items
    const supIdx = this.state.instruments.findIndex((i) => i.type === 'SUPERVISI_PEMBELAJARAN');
    const defaultSup = defaults.find((i) => i.type === 'SUPERVISI_PEMBELAJARAN')!;
    if (supIdx === -1) {
      this.state.instruments.push(defaultSup);
    } else {
      const currentSup = this.state.instruments[supIdx];
      const itemsCount = (currentSup.sections || []).reduce((acc, s) => acc + (s.items?.length || 0), 0);
      if (!currentSup.sections || currentSup.sections.length === 0 || itemsCount === 0) {
        this.state.instruments[supIdx] = {
          ...currentSup,
          type: 'SUPERVISI_PEMBELAJARAN',
          title: currentSup.title || defaultSup.title,
          description: currentSup.description || defaultSup.description,
          is_active: currentSup.is_active !== false,
          sections: defaultSup.sections?.map((s) => ({
            ...s,
            instrument_id: currentSup.id,
            items: s.items?.map((it) => ({ ...it, section_id: s.id })),
          })),
        };
      }
    }
  }

  // --- REFRESH ALL DATA FROM SUPABASE ---
  public async refreshFromSupabase(): Promise<void> {
    if (!supabase || this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Fetch School
      const { data: schoolsData, error: schoolsError } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1);

      if (schoolsError) {
        console.warn('[DB] Gagal mengambil data schools dari Supabase:', schoolsError.message);
      } else if (schoolsData && schoolsData.length > 0) {
        const s = schoolsData[0];
        this.state.schools = [
          {
            id: s.id,
            npsn: s.npsn || '',
            name: s.name || '',
            address: s.address || '',
            headmaster_name: s.headmaster_name || s.principal || s.leader || s.kepala_sekolah || DEFAULT_SCHOOL.headmaster_name,
            created_at: s.created_at || new Date().toISOString(),
          },
        ];
      } else if (this.state.schools.length === 0) {
        this.state.schools = [DEFAULT_SCHOOL];
      }

      // 2. Fetch Users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (usersError) {
        console.warn('[DB] Gagal mengambil data users dari Supabase:', usersError.message);
      } else if (usersData) {
        this.state.users = usersData.map((u: any): User => ({
          id: u.id,
          email: u.email || '',
          full_name: u.full_name || '',
          role: (String(u.role || 'GURU').toUpperCase() as UserRole),
          school_id: u.school_id || undefined,
          nip: u.nip || undefined,
          avatar_url: u.avatar_url || undefined,
          created_at: u.created_at || new Date().toISOString(),
        }));
      }

      // 3. Fetch Teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .order('full_name', { ascending: true });

      if (teachersError) {
        console.warn('[DB] Gagal mengambil data teachers dari Supabase:', teachersError.message);
      } else if (teachersData) {
        this.state.teachers = teachersData.map((t: any): Teacher => ({
          id: t.id,
          user_id: t.user_id || undefined,
          school_id: t.school_id,
          nip: t.nip || '',
          full_name: t.full_name || '',
          email: t.email || '',
          subject: t.subject || '',
          class_grade: t.class_grade || '',
          phone: t.phone || undefined,
          status: t.status || (t.active === false ? 'NONAKTIF' : 'AKTIF'),
          created_at: t.created_at || new Date().toISOString(),
        }));
      }

      // 4. Fetch Instruments with Sections and Items
      const { data: instrumentsData, error: instrumentsError } = await supabase
        .from('instruments')
        .select('*, instrument_sections(*, instrument_items(*))')
        .order('created_at', { ascending: true });

      if (instrumentsError) {
        console.warn('[DB] Gagal mengambil data instruments dari Supabase:', instrumentsError.message);
        this.ensureInstrumentsIntegrity();
      } else if (instrumentsData && instrumentsData.length > 0) {
        this.state.instruments = instrumentsData.map((inst: any): Instrument => {
          const rawCode = String(inst.code || inst.type || '').toUpperCase();
          const rawName = String(inst.name || inst.title || '').toLowerCase();
          const type: InstrumentType =
            rawCode === 'RPPM' || rawName.includes('rppm') || rawName.includes('telaah')
              ? 'RPPM'
              : 'SUPERVISI_PEMBELAJARAN';
          const title: string =
            inst.title || inst.name || (type === 'RPPM' ? DEFAULT_RPPM_TEMPLATE.title : DEFAULT_SUPERVISI_TEMPLATE.title);
          const is_active: boolean =
            inst.is_active !== undefined
              ? Boolean(inst.is_active)
              : inst.active !== undefined
              ? Boolean(inst.active)
              : true;

          const rawSections = inst.instrument_sections || [];
          let sortedSections = rawSections
            .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((sec: any, secIdx: number): InstrumentSection => ({
              id: sec.id,
              instrument_id: sec.instrument_id || inst.id,
              title: sec.title || sec.name || `Bagian ${secIdx + 1}`,
              weight: Number(sec.weight || 0),
              sort_order: sec.sort_order || secIdx + 1,
              created_at: sec.created_at || new Date().toISOString(),
              items: (sec.instrument_items || [])
                .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
                .map((item: any, itmIdx: number): InstrumentItem => ({
                  id: item.id,
                  section_id: item.section_id || sec.id,
                  code: item.code || `IND-${secIdx + 1}-${itmIdx + 1}`,
                  indicator: item.indicator || '',
                  description: item.description || '',
                  min_score: item.min_score || 1,
                  max_score: item.max_score || (type === 'RPPM' ? 3 : 4),
                  is_active: item.is_active !== undefined ? Boolean(item.is_active) : (item.active !== undefined ? Boolean(item.active) : true),
                  sort_order: item.sort_order || itmIdx + 1,
                  created_at: item.created_at || new Date().toISOString(),
                })),
            }));

          // If database returned 0 sections or 0 items in sections, hydrate from standard template!
          const totalItems = sortedSections.reduce((acc: number, s: InstrumentSection) => acc + (s.items?.length || 0), 0);
          if (sortedSections.length === 0 || totalItems === 0) {
            const template = type === 'RPPM' ? DEFAULT_RPPM_TEMPLATE : DEFAULT_SUPERVISI_TEMPLATE;
            sortedSections = template.sections.map((sec, secIdx): InstrumentSection => {
              const secId = `${inst.id}-sec-${secIdx + 1}`;
              return {
                id: secId,
                instrument_id: inst.id,
                title: sec.title,
                weight: sec.weight,
                sort_order: sec.sort_order,
                created_at: inst.created_at || new Date().toISOString(),
                items: sec.items.map((item, itemIdx): InstrumentItem => ({
                  id: `${inst.id}-itm-${item.code.toLowerCase().replace(/[^a-z0-9]/g, '-') || `${secIdx + 1}-${itemIdx + 1}`}`,
                  section_id: secId,
                  code: item.code,
                  indicator: item.indicator,
                  description: item.description,
                  min_score: item.min_score,
                  max_score: item.max_score,
                  is_active: true,
                  sort_order: item.sort_order,
                  created_at: inst.created_at || new Date().toISOString(),
                })),
              };
            });
          }

          return {
            id: inst.id,
            school_id: inst.school_id || undefined,
            type,
            title,
            description: inst.description || (type === 'RPPM' ? DEFAULT_RPPM_TEMPLATE.description : DEFAULT_SUPERVISI_TEMPLATE.description),
            version: inst.version || 'v1.0',
            is_active,
            created_at: inst.created_at || new Date().toISOString(),
            updated_at: inst.updated_at || new Date().toISOString(),
            sections: sortedSections,
          };
        });

        this.ensureInstrumentsIntegrity();
      } else {
        this.ensureInstrumentsIntegrity();
      }

      // 5. Fetch RPP Reviews and Items
      const { data: rppsData, error: rppsError } = await supabase
        .from('rpp_reviews')
        .select('*')
        .order('review_date', { ascending: false });

      if (rppsError) {
        console.warn('[DB] Gagal mengambil data rpp_reviews dari Supabase:', rppsError.message);
      } else if (rppsData) {
        const reviewIds = rppsData.map((r: any) => r.id).filter(this.isUuid);
        let itemRows: any[] = [];
        if (reviewIds.length > 0) {
          const { data: itemsData, error: itemsErr } = await supabase
            .from('rpp_review_items')
            .select('*')
            .in('rpp_review_id', reviewIds);

          if (!itemsErr && itemsData) {
            itemRows = itemsData;
          }
        }

        this.state.rppReviews = rppsData.map((r: any): RppReview => {
          const teacher = this.state.teachers.find((t) => t.id === r.teacher_id);
          const supervisor = this.state.users.find((u) => u.id === r.supervisor_id);

          return {
            id: r.id,
            school_id: r.school_id,
            teacher_id: r.teacher_id,
            supervisor_id: r.supervisor_id,
            instrument_id: r.instrument_id,
            review_date: r.review_date,
            semester: r.semester,
            academic_year: r.academic_year,
            subject: r.subject,
            class_grade: r.class_grade,
            topic: r.topic,
            total_score: Number(r.total_score || 0),
            max_possible_score: Number(r.max_possible_score || 0),
            percentage_score: Number(r.percentage_score || 0),
            predicate: r.predicate || '',
            general_notes: r.general_notes || '',
            status: r.status || 'COMPLETED',
            teacher_name: teacher?.full_name || '',
            supervisor_name: supervisor?.full_name || '',
            document_url: r.document_url || undefined,
            document_name: r.document_name || undefined,
            document_text: r.document_text || undefined,
            items: itemRows
              .filter((x: any) => x.rpp_review_id === r.id)
              .map((x: any): RppReviewItem => ({
                id: x.id,
                rpp_review_id: x.rpp_review_id,
                item_id: x.item_id,
                score: Number(x.score || 0),
                notes: x.notes || '',
                ai_recommendation_score: x.ai_recommendation_score,
                ai_evidence: x.ai_evidence,
                ai_reason: x.ai_reason,
                ai_revision_note: x.ai_revision_note,
                ai_recommendation: x.ai_recommendation,
                ai_status: x.ai_status,
                created_at: x.created_at || new Date().toISOString(),
              })),
            created_at: r.created_at || new Date().toISOString(),
          };
        });
      }

      // 6. Fetch Supervisions and Items
      const { data: supsData, error: supsError } = await supabase
        .from('supervisions')
        .select('*')
        .order('supervision_date', { ascending: false });

      if (supsError) {
        console.warn('[DB] Gagal mengambil data supervisions dari Supabase:', supsError.message);
      } else if (supsData) {
        const supIds = supsData.map((s: any) => s.id).filter(this.isUuid);
        let itemRows: any[] = [];
        if (supIds.length > 0) {
          const { data: itemsData, error: itemsErr } = await supabase
            .from('supervision_items')
            .select('*')
            .in('supervision_id', supIds);

          if (!itemsErr && itemsData) {
            itemRows = itemsData;
          }
        }

        this.state.supervisions = supsData.map((s: any): Supervision => {
          const teacher = this.state.teachers.find((t) => t.id === s.teacher_id);
          const supervisor = this.state.users.find((u) => u.id === s.supervisor_id);

          let photosArr: string[] = [];
          if (Array.isArray(s.photos)) {
            photosArr = s.photos;
          } else if (typeof s.photos === 'string') {
            try {
              photosArr = JSON.parse(s.photos);
            } catch {
              photosArr = [];
            }
          }

          return {
            id: s.id,
            school_id: s.school_id,
            teacher_id: s.teacher_id,
            supervisor_id: s.supervisor_id,
            instrument_id: s.instrument_id,
            supervision_date: s.supervision_date,
            semester: s.semester,
            academic_year: s.academic_year,
            subject: s.subject,
            class_grade: s.class_grade,
            topic: s.topic,
            total_score: Number(s.total_score || 0),
            max_possible_score: Number(s.max_possible_score || 0),
            percentage_score: Number(s.percentage_score || 0),
            predicate: s.predicate || '',
            general_notes: s.general_notes || '',
            status: s.status || 'COMPLETED',
            teacher_name: teacher?.full_name || '',
            supervisor_name: supervisor?.full_name || '',
            photos: photosArr,
            items: itemRows
              .filter((x: any) => x.supervision_id === s.id)
              .map((x: any): SupervisionItem => ({
                id: x.id,
                supervision_id: x.supervision_id,
                item_id: x.item_id,
                score: Number(x.score || 0),
                notes: x.notes || '',
                created_at: x.created_at || new Date().toISOString(),
              })),
            created_at: s.created_at || new Date().toISOString(),
          };
        });
      }

      // 7. Fetch AI Analyses
      const { data: aiData, error: aiError } = await supabase
        .from('ai_analyses')
        .select('*')
        .order('created_at', { ascending: false });

      if (aiError) {
        console.warn('[DB] Gagal mengambil data ai_analyses dari Supabase:', aiError.message);
      } else if (aiData) {
        this.state.aiAnalyses = aiData.map((a: any): AIAnalysis => ({
          id: a.id,
          reference_type: a.reference_type,
          reference_id: a.reference_id,
          summary: a.summary || '',
          strengths: Array.isArray(a.strengths) ? a.strengths : [],
          weaknesses: Array.isArray(a.weaknesses) ? a.weaknesses : [],
          deep_learning_analysis: a.deep_learning_analysis || '',
          recommendations: Array.isArray(a.recommendations) ? a.recommendations : [],
          follow_up_action: a.follow_up_action || '',
          created_at: a.created_at || new Date().toISOString(),
        }));
      }

      // 8. Fetch Follow Up Plans
      const { data: followData, error: followError } = await supabase
        .from('follow_up_plans')
        .select('*')
        .order('target_date', { ascending: true });

      if (followError) {
        console.warn('[DB] Gagal mengambil data follow_up_plans dari Supabase:', followError.message);
      } else if (followData) {
        this.state.followUpPlans = followData.map((f: any): FollowUpPlan => {
          const teacher = this.state.teachers.find((t) => t.id === f.teacher_id);
          const supervisor = this.state.users.find((u) => u.id === f.supervisor_id);

          return {
            id: f.id,
            school_id: f.school_id,
            teacher_id: f.teacher_id,
            supervisor_id: f.supervisor_id,
            reference_type: f.reference_type,
            reference_id: f.reference_id,
            activity_name: f.activity_name,
            action_type: f.action_type,
            target_date: f.target_date,
            status: f.status,
            outcome_notes: f.outcome_notes || undefined,
            teacher_name: teacher?.full_name || '',
            supervisor_name: supervisor?.full_name || '',
            created_at: f.created_at || new Date().toISOString(),
          };
        });
      }

      this.notify();
    } catch (err) {
      console.error('[DB] Gagal sinkronisasi data dari Supabase:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  // --- DISABLED / DEPRECATED PUSH LOCAL MECHANISM ---
  public async pushLocalDataToSupabase(): Promise<{ success: boolean; message: string; count: number }> {
    return {
      success: true,
      message:
        'Supabase telah aktif sebagai Single Source of Truth aplikasi. Seluruh operasi CRUD membaca dan menulis langsung ke Supabase tanpa database lokal.',
      count: 0,
    };
  }

  // ==========================================
  // 1. SCHOOLS CRUD
  // ==========================================
  public getSchool(): School {
    return this.state.schools[0] || DEFAULT_SCHOOL;
  }

  public async fetchSchool(): Promise<School | null> {
    if (!supabase) return this.getSchool();

    try {
      const client = this.ensureSupabaseClient();
      const { data, error } = await client
        .from('schools')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(`[DB] Gagal mengambil data sekolah dari Supabase: ${error.message}`);
        return this.getSchool();
      }

      if (data) {
        const school: School = {
          id: data.id,
          npsn: data.npsn || '',
          name: data.name || '',
          address: data.address || '',
          headmaster_name: data.headmaster_name || data.principal || data.leader || data.kepala_sekolah || DEFAULT_SCHOOL.headmaster_name,
          created_at: data.created_at || new Date().toISOString(),
        };
        this.state.schools = [school];
        this.notify();
        return school;
      }
    } catch (err) {
      console.warn('[DB] fetchSchool exception:', err);
    }

    return this.getSchool();
  }

  public async updateSchool(data: Partial<School>): Promise<School> {
    const current = this.getSchool();
    const targetId = data.id || current.id || DEFAULT_SCHOOL.id;

    const payloadWithHeadmaster: Record<string, any> = {
      npsn: data.npsn !== undefined ? data.npsn : current.npsn,
      name: data.name !== undefined ? data.name : current.name,
      address: data.address !== undefined ? data.address : current.address,
      headmaster_name: data.headmaster_name !== undefined ? data.headmaster_name : current.headmaster_name,
    };

    let updatedFromSupabase: any = null;

    if (supabase && this.isUuid(targetId)) {
      try {
        const client = this.ensureSupabaseClient();
        const { data: updated, error } = await client
          .from('schools')
          .update(payloadWithHeadmaster)
          .eq('id', targetId)
          .select('*')
          .maybeSingle();

        if (error) {
          // If error is about headmaster_name column missing in schema cache, retry without it
          if (error.message.includes('headmaster_name') || error.message.includes('column')) {
            const { headmaster_name, ...safePayload } = payloadWithHeadmaster;
            const { data: retryData, error: retryErr } = await client
              .from('schools')
              .update(safePayload)
              .eq('id', targetId)
              .select('*')
              .maybeSingle();

            if (!retryErr && retryData) {
              updatedFromSupabase = retryData;
            } else {
              console.warn('[DB] Update sekolah Supabase (safe retry) gagal:', retryErr?.message);
            }
          } else {
            console.warn('[DB] Update sekolah Supabase gagal:', error.message);
          }
        } else {
          updatedFromSupabase = updated;
        }
      } catch (err) {
        console.warn('[DB] Exception saat update sekolah di Supabase:', err);
      }
    }

    const updatedSchool: School = {
      id: updatedFromSupabase?.id || targetId,
      npsn: updatedFromSupabase?.npsn || payloadWithHeadmaster.npsn || current.npsn,
      name: updatedFromSupabase?.name || payloadWithHeadmaster.name || current.name,
      address: updatedFromSupabase?.address || payloadWithHeadmaster.address || current.address,
      headmaster_name: updatedFromSupabase?.headmaster_name || payloadWithHeadmaster.headmaster_name || current.headmaster_name,
      created_at: updatedFromSupabase?.created_at || current.created_at,
    };

    this.state.schools = [updatedSchool];
    this.notify();
    return updatedSchool;
  }

  // ==========================================
  // 2. USERS CRUD
  // ==========================================
  public getUsers(): User[] {
    return this.state.users;
  }

  public async fetchUsers(): Promise<User[]> {
    const client = this.ensureSupabaseClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Gagal mengambil data pengguna dari Supabase: ${error.message}`);
    }

    this.state.users = (data || []).map((u: any): User => ({
      id: u.id,
      email: u.email || '',
      full_name: u.full_name || '',
      role: (String(u.role || 'GURU').toUpperCase() as UserRole),
      school_id: u.school_id || undefined,
      nip: u.nip || undefined,
      avatar_url: u.avatar_url || undefined,
      created_at: u.created_at || new Date().toISOString(),
    }));

    this.notify();
    return this.state.users;
  }

  public async addUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const client = this.ensureSupabaseClient();
    const id = this.uuid();

    const payload = {
      id,
      email: user.email.trim().toLowerCase(),
      full_name: user.full_name.trim(),
      role: user.role,
      school_id: user.school_id && this.isUuid(user.school_id) ? user.school_id : null,
      nip: user.nip?.trim() || null,
      avatar_url: user.avatar_url || null,
    };

    const { data, error } = await client
      .from('users')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Gagal menambahkan pengguna ke Supabase: ${error?.message}`);
    }

    const newUser: User = {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      role: (String(data.role).toUpperCase() as UserRole),
      school_id: data.school_id || undefined,
      nip: data.nip || undefined,
      avatar_url: data.avatar_url || undefined,
      created_at: data.created_at || new Date().toISOString(),
    };

    this.state.users.push(newUser);
    this.notify();
    return newUser;
  }

  public async updateUser(id: string, data: Partial<User>): Promise<User> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID pengguna "${id}" bukan format UUID yang valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.full_name !== undefined) payload.full_name = data.full_name.trim();
    if (data.role !== undefined) payload.role = data.role;
    if (data.school_id !== undefined) payload.school_id = data.school_id && this.isUuid(data.school_id) ? data.school_id : null;
    if (data.nip !== undefined) payload.nip = data.nip ? data.nip.trim() : null;
    if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url || null;

    const { data: updated, error } = await client
      .from('users')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !updated) {
      throw new Error(`Gagal memperbarui pengguna di Supabase: ${error?.message}`);
    }

    const updatedUser: User = {
      id: updated.id,
      email: updated.email,
      full_name: updated.full_name,
      role: (String(updated.role).toUpperCase() as UserRole),
      school_id: updated.school_id || undefined,
      nip: updated.nip || undefined,
      avatar_url: updated.avatar_url || undefined,
      created_at: updated.created_at || new Date().toISOString(),
    };

    const idx = this.state.users.findIndex((u) => u.id === id);
    if (idx >= 0) {
      this.state.users[idx] = updatedUser;
    } else {
      this.state.users.push(updatedUser);
    }

    this.notify();
    return updatedUser;
  }

  public async deleteUser(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID pengguna "${id}" bukan format UUID yang valid.`);
    }

    const { error } = await client.from('users').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus pengguna dari Supabase: ${error.message}`);
    }

    this.state.users = this.state.users.filter((u) => u.id !== id);
    this.notify();
  }

  // ==========================================
  // 3. TEACHERS CRUD
  // ==========================================
  public resolveTeacherId(currentTeacherIdOrUserId?: string): string | undefined {
    if (!currentTeacherIdOrUserId) return undefined;
    const clean = currentTeacherIdOrUserId.trim().toLowerCase();

    // 1. Direct match by teacher.id
    const matchById = this.state.teachers.find((t) => t.id === currentTeacherIdOrUserId);
    if (matchById) return matchById.id;

    // 2. Match by teacher.user_id
    const matchByUserId = this.state.teachers.find((t) => t.user_id === currentTeacherIdOrUserId);
    if (matchByUserId) return matchByUserId.id;

    // 3. Match by user email
    const user = this.state.users.find(
      (u) => u.id === currentTeacherIdOrUserId || u.email.toLowerCase() === clean
    );
    if (user) {
      const matchByEmail = this.state.teachers.find(
        (t) =>
          t.email.toLowerCase() === user.email.toLowerCase() ||
          (t.nip && user.nip && t.nip === user.nip)
      );
      if (matchByEmail) return matchByEmail.id;
    }

    // 4. Direct match by teacher email or NIP
    const matchDirect = this.state.teachers.find(
      (t) =>
        (t.email && t.email.toLowerCase() === clean) ||
        (t.nip && t.nip === currentTeacherIdOrUserId)
    );
    if (matchDirect) return matchDirect.id;

    return currentTeacherIdOrUserId;
  }

  public getTeachers(role?: UserRole, currentUserId?: string): Teacher[] {
    if (role === 'GURU') {
      const tid = this.resolveTeacherId(currentUserId);
      if (tid) {
        const filtered = this.state.teachers.filter((t) => t.id === tid);
        if (filtered.length > 0) return filtered;
      }
    }
    return this.state.teachers;
  }

  private cachedTeacherStatusField: 'status' | 'active' | 'none' | null = null;

  private async getTeacherStatusField(): Promise<'status' | 'active' | 'none'> {
    if (this.cachedTeacherStatusField) {
      return this.cachedTeacherStatusField;
    }
    if (!supabase) {
      this.cachedTeacherStatusField = 'status';
      return 'status';
    }
    try {
      const { error: statusErr } = await supabase.from('teachers').select('status').limit(1);
      if (!statusErr) {
        this.cachedTeacherStatusField = 'status';
        return 'status';
      }
    } catch {
      // ignore
    }
    try {
      const { error: activeErr } = await supabase.from('teachers').select('active').limit(1);
      if (!activeErr) {
        this.cachedTeacherStatusField = 'active';
        return 'active';
      }
    } catch {
      // ignore
    }
    this.cachedTeacherStatusField = 'none';
    return 'none';
  }

  public async fetchTeachers(role?: UserRole, currentUserId?: string): Promise<Teacher[]> {
    const client = this.ensureSupabaseClient();
    const { data, error } = await client
      .from('teachers')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(`Gagal mengambil data guru dari Supabase: ${error.message}`);
    }

    this.state.teachers = (data || []).map((t: any): Teacher => ({
      id: t.id,
      user_id: t.user_id || undefined,
      school_id: t.school_id,
      nip: t.nip || '',
      full_name: t.full_name || '',
      email: t.email || '',
      subject: t.subject || '',
      class_grade: t.class_grade || '',
      phone: t.phone || undefined,
      status: t.status || (t.active === false ? 'NONAKTIF' : 'AKTIF'),
      created_at: t.created_at || new Date().toISOString(),
    }));

    this.notify();
    return this.getTeachers(role, currentUserId);
  }

  public async addTeacher(teacher: Omit<Teacher, 'id' | 'created_at'>): Promise<Teacher> {
    const client = this.ensureSupabaseClient();
    
    // 1. Pastikan profil sesi pengguna dan sekolah tersinkronisasi di Supabase
    const syncInfo = await this.syncAuthUserToDatabase();
    const schoolId = await this.ensureValidSchoolId({ school_id: teacher.school_id || syncInfo.schoolId });
    const id = this.uuid();

    const isNonActive = teacher.status === 'NONAKTIF';
    const statusCol = await this.getTeacherStatusField();

    const basePayload: Record<string, any> = {
      id,
      user_id: teacher.user_id && this.isUuid(teacher.user_id) ? teacher.user_id : null,
      school_id: schoolId,
      nip: teacher.nip.trim(),
      full_name: teacher.full_name.trim(),
      email: teacher.email.trim().toLowerCase(),
      subject: teacher.subject.trim(),
      class_grade: teacher.class_grade.trim(),
      phone: teacher.phone?.trim() || null,
    };

    const payloadsToTry: Array<Record<string, any>> = [];
    if (statusCol === 'active') {
      payloadsToTry.push({ ...basePayload, active: !isNonActive });
      payloadsToTry.push({ ...basePayload, status: teacher.status || 'AKTIF' });
      payloadsToTry.push(basePayload);
    } else if (statusCol === 'status') {
      payloadsToTry.push({ ...basePayload, status: teacher.status || 'AKTIF' });
      payloadsToTry.push({ ...basePayload, active: !isNonActive });
      payloadsToTry.push(basePayload);
    } else {
      payloadsToTry.push({ ...basePayload, active: !isNonActive });
      payloadsToTry.push(basePayload);
    }

    let insertedData: any = null;
    let lastError: any = null;

    for (const p of payloadsToTry) {
      try {
        const { data, error } = await client
          .from('teachers')
          .insert(p)
          .select('*')
          .single();

        if (!error && data) {
          insertedData = data;
          if ('active' in p) this.cachedTeacherStatusField = 'active';
          else if ('status' in p) this.cachedTeacherStatusField = 'status';
          break;
        } else {
          lastError = error;
          if (error?.message?.includes('column') || error?.message?.includes('schema cache')) {
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    // 2. Pemulihan otomatis jika terdeteksi pelanggaran RLS (Row-Level Security)
    if (!insertedData && (lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates'))) {
      console.warn('[DB] Pelanggaran RLS pada tabel teachers terdeteksi. Mencoba perbaikan otomatis profil & sekolah...');
      await this.syncAuthUserToDatabase();

      for (const p of payloadsToTry) {
        try {
          const { data, error } = await client
            .from('teachers')
            .insert(p)
            .select('*')
            .single();

          if (!error && data) {
            insertedData = data;
            break;
          } else {
            lastError = error;
          }
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    if (!insertedData) {
      const isRls = lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates');
      
      // Amankan data ke state memori agar tidak hilang dari formulir pengguna
      const fallbackTeacher: Teacher = {
        id,
        user_id: teacher.user_id && this.isUuid(teacher.user_id) ? teacher.user_id : undefined,
        school_id: schoolId,
        nip: teacher.nip.trim(),
        full_name: teacher.full_name.trim(),
        email: teacher.email.trim().toLowerCase(),
        subject: teacher.subject.trim(),
        class_grade: teacher.class_grade.trim(),
        phone: teacher.phone?.trim() || undefined,
        status: teacher.status || 'AKTIF',
        created_at: new Date().toISOString(),
      };

      this.state.teachers.push(fallbackTeacher);
      this.notify();

      if (isRls) {
        throw new Error(
          `Gagal menyimpan data guru ke Supabase karena pembatasan RLS (Row-Level Security). Data guru telah disimpan sementara di aplikasi. Silakan buka menu Pengaturan > Salin SQL Schema dan jalankan di SQL Editor Supabase untuk memperbarui izin RLS tabel teachers.`
        );
      }

      throw new Error(`Gagal menyimpan data guru ke Supabase: ${lastError?.message || 'Terjadi kesalahan sistem'}`);
    }

    const newTeacher: Teacher = {
      id: insertedData.id,
      user_id: insertedData.user_id || undefined,
      school_id: insertedData.school_id,
      nip: insertedData.nip,
      full_name: insertedData.full_name,
      email: insertedData.email,
      subject: insertedData.subject,
      class_grade: insertedData.class_grade,
      phone: insertedData.phone || undefined,
      status: insertedData.status || (insertedData.active === false ? 'NONAKTIF' : (teacher.status || 'AKTIF')),
      created_at: insertedData.created_at || new Date().toISOString(),
    };

    this.state.teachers.push(newTeacher);
    this.notify();
    return newTeacher;
  }

  public async updateTeacher(id: string, data: Partial<Teacher>): Promise<Teacher> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID guru "${id}" bukan format UUID yang valid.`);
    }

    await this.syncAuthUserToDatabase();

    const basePayload: Record<string, any> = {};
    if (data.nip !== undefined) basePayload.nip = data.nip.trim();
    if (data.full_name !== undefined) basePayload.full_name = data.full_name.trim();
    if (data.email !== undefined) basePayload.email = data.email.trim().toLowerCase();
    if (data.subject !== undefined) basePayload.subject = data.subject.trim();
    if (data.class_grade !== undefined) basePayload.class_grade = data.class_grade.trim();
    if (data.phone !== undefined) basePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.user_id !== undefined) basePayload.user_id = data.user_id && this.isUuid(data.user_id) ? data.user_id : null;

    const statusCol = await this.getTeacherStatusField();
    const payloadsToTry: Array<Record<string, any>> = [];

    if (data.status !== undefined) {
      const isNonActive = data.status === 'NONAKTIF';
      if (statusCol === 'active') {
        payloadsToTry.push({ ...basePayload, active: !isNonActive });
        payloadsToTry.push({ ...basePayload, status: data.status });
        payloadsToTry.push(basePayload);
      } else if (statusCol === 'status') {
        payloadsToTry.push({ ...basePayload, status: data.status });
        payloadsToTry.push({ ...basePayload, active: !isNonActive });
        payloadsToTry.push(basePayload);
      } else {
        payloadsToTry.push({ ...basePayload, active: !isNonActive });
        payloadsToTry.push(basePayload);
      }
    } else {
      payloadsToTry.push(basePayload);
    }

    let updated: any = null;
    let lastError: any = null;

    for (const p of payloadsToTry) {
      try {
        const { data: resData, error } = await client
          .from('teachers')
          .update(p)
          .eq('id', id)
          .select('*')
          .single();

        if (!error && resData) {
          updated = resData;
          if ('active' in p) this.cachedTeacherStatusField = 'active';
          else if ('status' in p) this.cachedTeacherStatusField = 'status';
          break;
        } else {
          lastError = error;
          if (error?.message?.includes('column') || error?.message?.includes('schema cache')) {
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    // Pemulihan otomatis jika terdeteksi pembatasan RLS
    if (!updated && (lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates'))) {
      console.warn('[DB] Pelanggaran RLS pada update teachers terdeteksi. Mencoba sinkronisasi ulang...');
      await this.syncAuthUserToDatabase();

      for (const p of payloadsToTry) {
        try {
          const { data: resData, error } = await client
            .from('teachers')
            .update(p)
            .eq('id', id)
            .select('*')
            .single();

          if (!error && resData) {
            updated = resData;
            break;
          } else {
            lastError = error;
          }
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    if (!updated) {
      const isRls = lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates');
      
      // Tetap update di state aplikasi
      const idx = this.state.teachers.findIndex((t) => t.id === id);
      if (idx >= 0) {
        this.state.teachers[idx] = {
          ...this.state.teachers[idx],
          ...data,
          status: data.status || this.state.teachers[idx].status,
        };
        this.notify();
      }

      if (isRls) {
        throw new Error(
          `Gagal memperbarui data guru di Supabase karena pembatasan RLS. Perubahan telah disimpan sementara di aplikasi. Silakan jalankan SQL Schema di SQL Editor Supabase untuk memperbarui izin RLS.`
        );
      }

      throw new Error(`Gagal memperbarui data guru di Supabase: ${lastError?.message || 'Terjadi kesalahan sistem'}`);
    }

    const updatedTeacher: Teacher = {
      id: updated.id,
      user_id: updated.user_id || undefined,
      school_id: updated.school_id,
      nip: updated.nip,
      full_name: updated.full_name,
      email: updated.email,
      subject: updated.subject,
      class_grade: updated.class_grade,
      phone: updated.phone || undefined,
      status: updated.status || (updated.active === false ? 'NONAKTIF' : (data.status || 'AKTIF')),
      created_at: updated.created_at || new Date().toISOString(),
    };

    const idx = this.state.teachers.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.state.teachers[idx] = updatedTeacher;
    } else {
      this.state.teachers.push(updatedTeacher);
    }

    this.notify();
    return updatedTeacher;
  }

  public async deleteTeacher(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID guru "${id}" bukan format UUID yang valid.`);
    }

    await this.syncAuthUserToDatabase();

    const { error } = await client.from('teachers').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus data guru dari Supabase: ${error.message}`);
    }

    this.state.teachers = this.state.teachers.filter((t) => t.id !== id);
    this.notify();
  }

  public async importTeachers(
    teacherList: Omit<Teacher, 'id' | 'created_at'>[]
  ): Promise<Teacher[]> {
    const client = this.ensureSupabaseClient();
    const syncInfo = await this.syncAuthUserToDatabase();
    const schoolId = await this.ensureValidSchoolId({ school_id: syncInfo.schoolId });
    const statusCol = await this.getTeacherStatusField();

    const buildRows = (col: 'active' | 'status' | 'none') => {
      return teacherList.map((t) => {
        const row: Record<string, any> = {
          id: this.uuid(),
          user_id: t.user_id && this.isUuid(t.user_id) ? t.user_id : null,
          school_id: t.school_id && this.isUuid(t.school_id) ? t.school_id : schoolId,
          nip: t.nip.trim(),
          full_name: t.full_name.trim(),
          email: t.email.trim().toLowerCase(),
          subject: t.subject.trim(),
          class_grade: t.class_grade.trim(),
          phone: t.phone ? t.phone.trim() : null,
        };
        if (col === 'active') {
          row.active = (t.status || 'AKTIF') !== 'NONAKTIF';
        } else if (col === 'status') {
          row.status = t.status || 'AKTIF';
        }
        return row;
      });
    };

    const modesToTry: Array<'active' | 'status' | 'none'> =
      statusCol === 'active'
        ? ['active', 'status', 'none']
        : statusCol === 'status'
        ? ['status', 'active', 'none']
        : ['active', 'none'];

    let importedData: any[] | null = null;
    let lastError: any = null;

    for (const mode of modesToTry) {
      try {
        const rows = buildRows(mode);
        const { data, error } = await client.from('teachers').insert(rows).select('*');
        if (!error && data) {
          importedData = data;
          if (mode !== 'none') this.cachedTeacherStatusField = mode;
          break;
        } else {
          lastError = error;
          if (error?.message?.includes('column') || error?.message?.includes('schema cache')) {
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    // Pemulihan otomatis jika terdeteksi pembatasan RLS
    if (!importedData && (lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates'))) {
      console.warn('[DB] Pelanggaran RLS pada impor guru terdeteksi. Mencoba sinkronisasi ulang...');
      await this.syncAuthUserToDatabase();

      for (const mode of modesToTry) {
        try {
          const rows = buildRows(mode);
          const { data, error } = await client.from('teachers').insert(rows).select('*');
          if (!error && data) {
            importedData = data;
            break;
          } else {
            lastError = error;
          }
        } catch (err: any) {
          lastError = err;
        }
      }
    }

    if (!importedData) {
      const isRls = lastError?.message?.includes('row-level security') || lastError?.message?.includes('violates');
      
      // Amankan seluruh data impor ke state aplikasi
      const fallbackImported: Teacher[] = teacherList.map((t) => ({
        id: this.uuid(),
        user_id: t.user_id && this.isUuid(t.user_id) ? t.user_id : undefined,
        school_id: schoolId,
        nip: t.nip.trim(),
        full_name: t.full_name.trim(),
        email: t.email.trim().toLowerCase(),
        subject: t.subject.trim(),
        class_grade: t.class_grade.trim(),
        phone: t.phone ? t.phone.trim() : undefined,
        status: t.status || 'AKTIF',
        created_at: new Date().toISOString(),
      }));

      this.state.teachers.push(...fallbackImported);
      this.notify();

      if (isRls) {
        throw new Error(
          `Gagal mengimpor data guru ke Supabase karena pembatasan RLS. ${fallbackImported.length} guru telah disimpan sementara di aplikasi. Silakan jalankan SQL Schema di SQL Editor Supabase untuk memperbarui izin RLS.`
        );
      }

      throw new Error(`Gagal mengimpor daftar guru ke Supabase: ${lastError?.message || 'Terjadi kesalahan sistem'}`);
    }

    const imported: Teacher[] = importedData.map((d: any) => ({
      id: d.id,
      user_id: d.user_id || undefined,
      school_id: d.school_id,
      nip: d.nip,
      full_name: d.full_name,
      email: d.email,
      subject: d.subject,
      class_grade: d.class_grade,
      phone: d.phone || undefined,
      status: d.status || (d.active === false ? 'NONAKTIF' : 'AKTIF'),
      created_at: d.created_at || new Date().toISOString(),
    }));

    this.state.teachers.push(...imported);
    this.notify();
    return imported;
  }

  // ==========================================
  // 4. INSTRUMENTS CRUD
  // ==========================================
  public getInstruments(): Instrument[] {
    this.ensureInstrumentsIntegrity();
    return this.state.instruments;
  }

  public getInstrumentById(id: string): Instrument | undefined {
    this.ensureInstrumentsIntegrity();
    return this.state.instruments.find((i) => i.id === id);
  }

  public async fetchInstruments(): Promise<Instrument[]> {
    await this.refreshFromSupabase();
    return this.state.instruments;
  }

  public async addInstrument(
    instrument: Omit<Instrument, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Instrument> {
    const client = this.ensureSupabaseClient();
    const schoolId = await this.ensureValidSchoolId({ school_id: instrument.school_id });
    const instId = this.uuid();

    const { data: createdInst, error: instErr } = await client
      .from('instruments')
      .insert({
        id: instId,
        school_id: schoolId,
        type: instrument.type,
        title: instrument.title.trim(),
        description: instrument.description?.trim() || null,
        version: instrument.version || 'v1.0',
        is_active: instrument.is_active !== undefined ? instrument.is_active : true,
      })
      .select('*')
      .single();

    if (instErr || !createdInst) {
      throw new Error(`Gagal menambahkan instrumen ke Supabase: ${instErr?.message}`);
    }

    const createdSections: InstrumentSection[] = [];

    if (instrument.sections && instrument.sections.length > 0) {
      for (const sec of instrument.sections) {
        const secId = this.uuid();
        const { data: createdSec, error: secErr } = await client
          .from('instrument_sections')
          .insert({
            id: secId,
            instrument_id: instId,
            title: sec.title.trim(),
            weight: sec.weight || 0,
            sort_order: sec.sort_order || 0,
          })
          .select('*')
          .single();

        if (secErr || !createdSec) {
          throw new Error(`Gagal menambahkan bagian instrumen ke Supabase: ${secErr?.message}`);
        }

        const createdItems: InstrumentItem[] = [];

        if (sec.items && sec.items.length > 0) {
          const itemRows = sec.items.map((item) => ({
            id: this.uuid(),
            section_id: secId,
            code: item.code.trim(),
            indicator: item.indicator.trim(),
            description: item.description?.trim() || null,
            min_score: item.min_score || 1,
            max_score: item.max_score || 4,
            is_active: item.is_active !== undefined ? item.is_active : true,
            sort_order: item.sort_order || 0,
          }));

          const { data: itemsData, error: itemsErr } = await client
            .from('instrument_items')
            .insert(itemRows)
            .select('*');

          if (itemsErr || !itemsData) {
            throw new Error(`Gagal menambahkan butir instrumen ke Supabase: ${itemsErr?.message}`);
          }

          createdItems.push(
            ...itemsData.map((d: any) => ({
              id: d.id,
              section_id: d.section_id,
              code: d.code,
              indicator: d.indicator,
              description: d.description || '',
              min_score: d.min_score,
              max_score: d.max_score,
              is_active: d.is_active,
              sort_order: d.sort_order,
              created_at: d.created_at,
            }))
          );
        }

        createdSections.push({
          id: createdSec.id,
          instrument_id: createdSec.instrument_id,
          title: createdSec.title,
          weight: Number(createdSec.weight || 0),
          sort_order: createdSec.sort_order || 0,
          created_at: createdSec.created_at,
          items: createdItems,
        });
      }
    }

    const fullInstrument: Instrument = {
      id: createdInst.id,
      school_id: createdInst.school_id,
      type: createdInst.type,
      title: createdInst.title,
      description: createdInst.description || '',
      version: createdInst.version,
      is_active: createdInst.is_active,
      created_at: createdInst.created_at,
      updated_at: createdInst.updated_at,
      sections: createdSections,
    };

    this.state.instruments.push(fullInstrument);
    this.notify();
    return fullInstrument;
  }

  public async updateInstrument(id: string, data: Partial<Instrument>): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID instrumen "${id}" bukan format UUID yang valid.`);
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.description !== undefined) payload.description = data.description?.trim() || null;
    if (data.version !== undefined) payload.version = data.version;
    if (data.is_active !== undefined) payload.is_active = data.is_active;

    const { error } = await client.from('instruments').update(payload).eq('id', id);
    if (error) {
      throw new Error(`Gagal memperbarui instrumen di Supabase: ${error.message}`);
    }

    const idx = this.state.instruments.findIndex((i) => i.id === id);
    if (idx >= 0) {
      this.state.instruments[idx] = {
        ...this.state.instruments[idx],
        ...data,
        updated_at: payload.updated_at,
      };
      this.notify();
    }
  }

  public async deleteInstrument(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID instrumen "${id}" bukan format UUID yang valid.`);
    }

    const { error } = await client.from('instruments').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus instrumen dari Supabase: ${error.message}`);
    }

    this.state.instruments = this.state.instruments.filter((i) => i.id !== id);
    this.notify();
  }

  // --- SECTIONS & ITEMS CRUD ---
  public async addInstrumentSection(
    instrumentId: string,
    sectionData: Omit<InstrumentSection, 'id' | 'instrument_id' | 'created_at'>
  ): Promise<InstrumentSection> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(instrumentId)) {
      throw new Error(`ID instrumen "${instrumentId}" tidak valid.`);
    }

    const secId = this.uuid();
    const payload = {
      id: secId,
      instrument_id: instrumentId,
      title: sectionData.title.trim(),
      weight: sectionData.weight || 0,
      sort_order: sectionData.sort_order || 0,
    };

    const { data, error } = await client
      .from('instrument_sections')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Gagal menambahkan bagian instrumen ke Supabase: ${error?.message}`);
    }

    const newSection: InstrumentSection = {
      id: data.id,
      instrument_id: data.instrument_id,
      title: data.title,
      weight: Number(data.weight || 0),
      sort_order: data.sort_order || 0,
      created_at: data.created_at || new Date().toISOString(),
      items: [],
    };

    const inst = this.getInstrumentById(instrumentId);
    if (inst) {
      inst.sections = inst.sections || [];
      inst.sections.push(newSection);
      inst.updated_at = new Date().toISOString();
      this.notify();
    }

    return newSection;
  }

  public async updateInstrumentSection(
    instrumentId: string,
    sectionId: string,
    data: Partial<InstrumentSection>
  ): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(sectionId)) {
      throw new Error(`ID bagian instrumen "${sectionId}" tidak valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.title !== undefined) payload.title = data.title.trim();
    if (data.weight !== undefined) payload.weight = Number(data.weight);
    if (data.sort_order !== undefined) payload.sort_order = Number(data.sort_order);

    const { error } = await client.from('instrument_sections').update(payload).eq('id', sectionId);
    if (error) {
      throw new Error(`Gagal memperbarui bagian instrumen di Supabase: ${error.message}`);
    }

    const inst = this.getInstrumentById(instrumentId);
    if (inst?.sections) {
      const idx = inst.sections.findIndex((s) => s.id === sectionId);
      if (idx >= 0) {
        inst.sections[idx] = { ...inst.sections[idx], ...data };
        inst.updated_at = new Date().toISOString();
        this.notify();
      }
    }
  }

  public async deleteInstrumentSection(instrumentId: string, sectionId: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(sectionId)) {
      throw new Error(`ID bagian instrumen "${sectionId}" tidak valid.`);
    }

    const { error } = await client.from('instrument_sections').delete().eq('id', sectionId);
    if (error) {
      throw new Error(`Gagal menghapus bagian instrumen dari Supabase: ${error.message}`);
    }

    const inst = this.getInstrumentById(instrumentId);
    if (inst?.sections) {
      inst.sections = inst.sections.filter((s) => s.id !== sectionId);
      inst.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  public async addInstrumentItem(
    instrumentId: string,
    sectionId: string,
    itemData: Omit<InstrumentItem, 'id' | 'section_id' | 'created_at'>
  ): Promise<InstrumentItem> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(sectionId)) {
      throw new Error(`ID bagian instrumen "${sectionId}" tidak valid.`);
    }

    const itemId = this.uuid();
    const payload = {
      id: itemId,
      section_id: sectionId,
      code: itemData.code.trim(),
      indicator: itemData.indicator.trim(),
      description: itemData.description?.trim() || null,
      min_score: itemData.min_score || 1,
      max_score: itemData.max_score || 4,
      is_active: itemData.is_active !== undefined ? itemData.is_active : true,
      sort_order: itemData.sort_order || 0,
    };

    const { data, error } = await client
      .from('instrument_items')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Gagal menambahkan butir indikator ke Supabase: ${error?.message}`);
    }

    const newItem: InstrumentItem = {
      id: data.id,
      section_id: data.section_id,
      code: data.code,
      indicator: data.indicator,
      description: data.description || '',
      min_score: data.min_score,
      max_score: data.max_score,
      is_active: data.is_active,
      sort_order: data.sort_order,
      created_at: data.created_at || new Date().toISOString(),
    };

    const inst = this.getInstrumentById(instrumentId);
    const sec = inst?.sections?.find((s) => s.id === sectionId);
    if (sec) {
      sec.items = sec.items || [];
      sec.items.push(newItem);
      inst!.updated_at = new Date().toISOString();
      this.notify();
    }

    return newItem;
  }

  public async updateInstrumentItem(
    instrumentId: string,
    itemId: string,
    data: Partial<InstrumentItem>
  ): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(itemId)) {
      throw new Error(`ID butir instrumen "${itemId}" tidak valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.code !== undefined) payload.code = data.code.trim();
    if (data.indicator !== undefined) payload.indicator = data.indicator.trim();
    if (data.description !== undefined) payload.description = data.description?.trim() || null;
    if (data.min_score !== undefined) payload.min_score = data.min_score;
    if (data.max_score !== undefined) payload.max_score = data.max_score;
    if (data.is_active !== undefined) payload.is_active = data.is_active;
    if (data.sort_order !== undefined) payload.sort_order = data.sort_order;

    const { error } = await client.from('instrument_items').update(payload).eq('id', itemId);
    if (error) {
      throw new Error(`Gagal memperbarui butir instrumen di Supabase: ${error.message}`);
    }

    const inst = this.getInstrumentById(instrumentId);
    if (inst?.sections) {
      for (const sec of inst.sections) {
        const idx = sec.items?.findIndex((i) => i.id === itemId) ?? -1;
        if (idx >= 0) {
          sec.items![idx] = { ...sec.items![idx], ...data };
          inst.updated_at = new Date().toISOString();
          this.notify();
          break;
        }
      }
    }
  }

  public async deleteInstrumentItem(instrumentId: string, itemId: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(itemId)) {
      throw new Error(`ID butir instrumen "${itemId}" tidak valid.`);
    }

    const { error } = await client.from('instrument_items').delete().eq('id', itemId);
    if (error) {
      throw new Error(`Gagal menghapus butir instrumen dari Supabase: ${error.message}`);
    }

    const inst = this.getInstrumentById(instrumentId);
    if (inst?.sections) {
      for (const sec of inst.sections) {
        if (sec.items) {
          sec.items = sec.items.filter((i) => i.id !== itemId);
        }
      }
      inst.updated_at = new Date().toISOString();
      this.notify();
    }
  }

  // ==========================================
  // 5. RPP REVIEWS & ITEMS CRUD
  // ==========================================
  public getRppReviews(role?: UserRole, currentTeacherId?: string): RppReview[] {
    if (role === 'GURU') {
      const tid = this.resolveTeacherId(currentTeacherId);
      if (tid) {
        const filtered = this.state.rppReviews.filter((r) => r.teacher_id === tid);
        if (filtered.length > 0) return filtered;
      }
    }
    return this.state.rppReviews;
  }

  public async fetchRppReviews(role?: UserRole, currentTeacherId?: string): Promise<RppReview[]> {
    await this.refreshFromSupabase();
    return this.getRppReviews(role, currentTeacherId);
  }

  public async addRppReview(review: Omit<RppReview, 'id' | 'created_at'>): Promise<RppReview> {
    const client = this.ensureSupabaseClient();

    // 1. Resolve Teacher ID
    let teacherId = review.teacher_id;
    if (!this.isUuid(teacherId)) {
      const match = this.state.teachers.find(
        (t) => t.id === teacherId || (review.teacher_name && t.full_name.toLowerCase() === review.teacher_name.toLowerCase())
      );
      if (match && this.isUuid(match.id)) {
        teacherId = match.id;
      } else if (this.state.teachers.length > 0 && this.isUuid(this.state.teachers[0].id)) {
        teacherId = this.state.teachers[0].id;
      } else {
        throw new Error('Teacher ID tidak valid. Pilih guru dari data yang tersimpan di Supabase.');
      }
    }

    // 2. Resolve Supervisor ID (guaranteed valid UUID in public.users)
    const supervisorId = await this.ensureValidSupervisorId(review.supervisor_id);

    // 3. Resolve School ID
    const schoolId = await this.ensureValidSchoolId({ school_id: review.school_id });

    // 4. Resolve Instrument ID and ensure default templates are seeded in Supabase
    let instrumentId = review.instrument_id;
    if (!this.isUuid(instrumentId) || instrumentId === DEFAULT_RPPM_INSTRUMENT_ID) {
      instrumentId = DEFAULT_RPPM_INSTRUMENT_ID;
    }
    await this.ensureInstrumentsSeeded(schoolId);

    const reviewId = this.uuid();

    const parentPayload = {
      id: reviewId,
      school_id: schoolId,
      teacher_id: teacherId,
      supervisor_id: supervisorId,
      instrument_id: instrumentId,
      review_date: review.review_date || new Date().toISOString().split('T')[0],
      semester: review.semester,
      academic_year: review.academic_year,
      subject: review.subject,
      class_grade: review.class_grade,
      topic: review.topic,
      total_score: Number(review.total_score || 0),
      max_possible_score: Number(review.max_possible_score || 0),
      percentage_score: Number(review.percentage_score || 0),
      predicate: review.predicate || '',
      general_notes: review.general_notes || '',
      status: review.status || 'COMPLETED',
      document_url: review.document_url || null,
      document_name: review.document_name || null,
      document_text: review.document_text || null,
    };

    let parentSavedToCloud = false;
    let revErr: any = null;

    const { error: initialErr } = await client.from('rpp_reviews').insert(parentPayload);
    if (!initialErr) {
      parentSavedToCloud = true;
    } else {
      revErr = initialErr;
      const errMsg = initialErr.message || '';
      // Self-healing: if error is RLS or foreign key, sync auth user & re-seed instruments, then retry once
      if (errMsg.includes('violates row-level security') || errMsg.includes('RLS') || errMsg.includes('foreign key')) {
        await this.syncAuthUserToDatabase();
        await this.ensureInstrumentsSeeded(schoolId);
        const { error: retryErr } = await client.from('rpp_reviews').insert(parentPayload);
        if (!retryErr) {
          parentSavedToCloud = true;
          revErr = null;
        } else {
          revErr = retryErr;
        }
      }
    }

    const itemsSaved: RppReviewItem[] = [];

    if (review.items && review.items.length > 0) {
      const defaultItemFallback = DEFAULT_RPPM_INSTRUMENT_ID.slice(0, 24) + '000001000001';

      const itemRows = review.items.map((item) => {
        let itemId = item.item_id;
        if (!this.isUuid(itemId)) {
          itemId = defaultItemFallback;
        }

        return {
          id: this.uuid(),
          rpp_review_id: reviewId,
          item_id: itemId,
          score: Number(item.score || 0),
          notes: item.notes || null,
          ai_recommendation_score: item.ai_recommendation_score ?? null,
          ai_evidence: item.ai_evidence ?? null,
          ai_reason: item.ai_reason ?? null,
          ai_revision_note: item.ai_revision_note ?? null,
          ai_recommendation: item.ai_recommendation ?? null,
          ai_status: item.ai_status ?? null,
        };
      });

      if (parentSavedToCloud) {
        const { data: insertedItems, error: itemsErr } = await client
          .from('rpp_review_items')
          .insert(itemRows)
          .select('*');

        if (itemsErr) {
          console.warn('[DB] Butir rpp_review_items gagal disimpan ke cloud, disimpan di lokal:', itemsErr.message);
        } else if (insertedItems) {
          itemsSaved.push(
            ...insertedItems.map((x: any): RppReviewItem => ({
              id: x.id,
              rpp_review_id: x.rpp_review_id,
              item_id: x.item_id,
              score: Number(x.score || 0),
              notes: x.notes || '',
              ai_recommendation_score: x.ai_recommendation_score,
              ai_evidence: x.ai_evidence,
              ai_reason: x.ai_reason,
              ai_revision_note: x.ai_revision_note,
              ai_recommendation: x.ai_recommendation,
              ai_status: x.ai_status,
              created_at: x.created_at || new Date().toISOString(),
            }))
          );
        }
      }

      if (itemsSaved.length === 0) {
        itemsSaved.push(
          ...review.items.map((it) => ({
            ...it,
            id: this.isUuid(it.id) ? it.id : this.uuid(),
            rpp_review_id: reviewId,
            created_at: it.created_at || new Date().toISOString(),
          }))
        );
      }
    }

    const fullReview: RppReview = {
      ...review,
      id: reviewId,
      school_id: schoolId,
      teacher_id: teacherId,
      supervisor_id: supervisorId,
      instrument_id: instrumentId,
      items: itemsSaved,
      created_at: new Date().toISOString(),
    };

    this.state.rppReviews.unshift(fullReview);
    this.notify();

    if (revErr && !parentSavedToCloud) {
      throw new Error(`Data telaah RPPM telah disimpan sementara di aplikasi (Cloud: ${revErr.message})`);
    }

    return fullReview;
  }

  public async updateRppReview(id: string, data: Partial<RppReview>): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID telaah RPPM "${id}" tidak valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.topic !== undefined) payload.topic = data.topic;
    if (data.general_notes !== undefined) payload.general_notes = data.general_notes;
    if (data.total_score !== undefined) payload.total_score = Number(data.total_score);
    if (data.percentage_score !== undefined) payload.percentage_score = Number(data.percentage_score);
    if (data.predicate !== undefined) payload.predicate = data.predicate;
    if (data.status !== undefined) payload.status = data.status;

    const { error } = await client.from('rpp_reviews').update(payload).eq('id', id);
    if (error) {
      throw new Error(`Gagal memperbarui data telaah RPPM di Supabase: ${error.message}`);
    }

    const idx = this.state.rppReviews.findIndex((r) => r.id === id);
    if (idx >= 0) {
      this.state.rppReviews[idx] = { ...this.state.rppReviews[idx], ...data };
      this.notify();
    }
  }

  public async deleteRppReview(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID telaah RPPM "${id}" tidak valid.`);
    }

    const { error } = await client.from('rpp_reviews').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus telaah RPPM dari Supabase: ${error.message}`);
    }

    this.state.rppReviews = this.state.rppReviews.filter((r) => r.id !== id);
    this.notify();
  }

  // ==========================================
  // 6. SUPERVISIONS & ITEMS CRUD
  // ==========================================
  public getSupervisions(role?: UserRole, currentTeacherId?: string): Supervision[] {
    if (role === 'GURU') {
      const tid = this.resolveTeacherId(currentTeacherId);
      if (tid) {
        const filtered = this.state.supervisions.filter((s) => s.teacher_id === tid);
        if (filtered.length > 0) return filtered;
      }
    }
    return this.state.supervisions;
  }

  public async fetchSupervisions(role?: UserRole, currentTeacherId?: string): Promise<Supervision[]> {
    await this.refreshFromSupabase();
    return this.getSupervisions(role, currentTeacherId);
  }

  public async addSupervision(supervision: Omit<Supervision, 'id' | 'created_at'>): Promise<Supervision> {
    const client = this.ensureSupabaseClient();

    if (!this.isUuid(supervision.teacher_id)) {
      throw new Error('Teacher ID tidak valid. Pilih guru yang tersimpan di Supabase.');
    }
    if (!this.isUuid(supervision.supervisor_id)) {
      throw new Error('Supervisor ID tidak valid.');
    }
    if (!this.isUuid(supervision.instrument_id)) {
      throw new Error('Instrument ID tidak valid. Pilih instrumen supervisi resmi di Supabase.');
    }

    const schoolId = await this.ensureValidSchoolId({ school_id: supervision.school_id });
    const supId = this.uuid();

    const parentPayload = {
      id: supId,
      school_id: schoolId,
      teacher_id: supervision.teacher_id,
      supervisor_id: supervision.supervisor_id,
      instrument_id: supervision.instrument_id,
      supervision_date: supervision.supervision_date || new Date().toISOString().split('T')[0],
      semester: supervision.semester,
      academic_year: supervision.academic_year,
      subject: supervision.subject,
      class_grade: supervision.class_grade,
      topic: supervision.topic,
      total_score: Number(supervision.total_score || 0),
      max_possible_score: Number(supervision.max_possible_score || 0),
      percentage_score: Number(supervision.percentage_score || 0),
      predicate: supervision.predicate || '',
      general_notes: supervision.general_notes || '',
      status: supervision.status || 'COMPLETED',
      photos: supervision.photos || [],
    };

    const { error: supErr } = await client.from('supervisions').insert(parentPayload);
    if (supErr) {
      throw new Error(`Gagal menyimpan data supervisi ke Supabase: ${supErr.message}`);
    }

    const itemsSaved: SupervisionItem[] = [];

    if (supervision.items && supervision.items.length > 0) {
      const itemRows = supervision.items.map((item) => ({
        id: this.uuid(),
        supervision_id: supId,
        item_id: item.item_id,
        score: Number(item.score || 0),
        notes: item.notes || null,
      }));

      const { data: insertedItems, error: itemsErr } = await client
        .from('supervision_items')
        .insert(itemRows)
        .select('*');

      if (itemsErr) {
        // Rollback parent if items failed
        await client.from('supervisions').delete().eq('id', supId);
        throw new Error(`Gagal menyimpan butir supervisi ke Supabase: ${itemsErr.message}`);
      }

      if (insertedItems) {
        itemsSaved.push(
          ...insertedItems.map((x: any): SupervisionItem => ({
            id: x.id,
            supervision_id: x.supervision_id,
            item_id: x.item_id,
            score: Number(x.score || 0),
            notes: x.notes || '',
            created_at: x.created_at || new Date().toISOString(),
          }))
        );
      }
    }

    const fullSupervision: Supervision = {
      ...supervision,
      id: supId,
      school_id: schoolId,
      items: itemsSaved,
      created_at: new Date().toISOString(),
    };

    this.state.supervisions.unshift(fullSupervision);
    this.notify();
    return fullSupervision;
  }

  public async updateSupervision(id: string, data: Partial<Supervision>): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID supervisi "${id}" tidak valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.topic !== undefined) payload.topic = data.topic;
    if (data.general_notes !== undefined) payload.general_notes = data.general_notes;
    if (data.total_score !== undefined) payload.total_score = Number(data.total_score);
    if (data.percentage_score !== undefined) payload.percentage_score = Number(data.percentage_score);
    if (data.predicate !== undefined) payload.predicate = data.predicate;
    if (data.status !== undefined) payload.status = data.status;
    if (data.photos !== undefined) payload.photos = data.photos;

    const { error } = await client.from('supervisions').update(payload).eq('id', id);
    if (error) {
      throw new Error(`Gagal memperbarui data supervisi di Supabase: ${error.message}`);
    }

    const idx = this.state.supervisions.findIndex((s) => s.id === id);
    if (idx >= 0) {
      this.state.supervisions[idx] = { ...this.state.supervisions[idx], ...data };
      this.notify();
    }
  }

  public async deleteSupervision(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID supervisi "${id}" tidak valid.`);
    }

    const { error } = await client.from('supervisions').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus supervisi dari Supabase: ${error.message}`);
    }

    this.state.supervisions = this.state.supervisions.filter((s) => s.id !== id);
    this.notify();
  }

  // ==========================================
  // 7. AI ANALYSES CRUD
  // ==========================================
  public getAIAnalysis(
    refType: 'RPP_REVIEW' | 'SUPERVISION',
    refId: string
  ): AIAnalysis | undefined {
    return this.state.aiAnalyses.find(
      (a) => a.reference_type === refType && a.reference_id === refId
    );
  }

  public async fetchAIAnalysis(
    refType: 'RPP_REVIEW' | 'SUPERVISION',
    refId: string
  ): Promise<AIAnalysis | null> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(refId)) return null;

    const { data, error } = await client
      .from('ai_analyses')
      .select('*')
      .eq('reference_type', refType)
      .eq('reference_id', refId)
      .maybeSingle();

    if (error) {
      console.warn('[DB] Gagal mengambil analisis AI dari Supabase:', error.message);
      return null;
    }

    if (data) {
      const item: AIAnalysis = {
        id: data.id,
        reference_type: data.reference_type,
        reference_id: data.reference_id,
        summary: data.summary || '',
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
        deep_learning_analysis: data.deep_learning_analysis || '',
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
        follow_up_action: data.follow_up_action || '',
        created_at: data.created_at || new Date().toISOString(),
      };

      const idx = this.state.aiAnalyses.findIndex(
        (a) => a.reference_type === refType && a.reference_id === refId
      );
      if (idx >= 0) {
        this.state.aiAnalyses[idx] = item;
      } else {
        this.state.aiAnalyses.push(item);
      }

      this.notify();
      return item;
    }

    return null;
  }

  public async saveAIAnalysis(
    analysis: Omit<AIAnalysis, 'id' | 'created_at'>
  ): Promise<AIAnalysis> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(analysis.reference_id)) {
      throw new Error(`Reference ID "${analysis.reference_id}" bukan format UUID yang valid.`);
    }

    const existing = this.getAIAnalysis(analysis.reference_type, analysis.reference_id);
    const id = existing?.id || this.uuid();

    const payload = {
      id,
      reference_type: analysis.reference_type,
      reference_id: analysis.reference_id,
      summary: analysis.summary || '',
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      deep_learning_analysis: analysis.deep_learning_analysis || '',
      recommendations: analysis.recommendations || [],
      follow_up_action: analysis.follow_up_action || '',
    };

    const { data, error } = await client
      .from('ai_analyses')
      .upsert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Gagal menyimpan analisis AI ke Supabase: ${error?.message}`);
    }

    const saved: AIAnalysis = {
      id: data.id,
      reference_type: data.reference_type,
      reference_id: data.reference_id,
      summary: data.summary || '',
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
      deep_learning_analysis: data.deep_learning_analysis || '',
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      follow_up_action: data.follow_up_action || '',
      created_at: data.created_at || new Date().toISOString(),
    };

    const idx = this.state.aiAnalyses.findIndex(
      (a) => a.reference_type === saved.reference_type && a.reference_id === saved.reference_id
    );
    if (idx >= 0) {
      this.state.aiAnalyses[idx] = saved;
    } else {
      this.state.aiAnalyses.push(saved);
    }

    this.notify();
    return saved;
  }

  // ==========================================
  // 8. FOLLOW UP PLANS CRUD
  // ==========================================
  public getFollowUpPlans(role?: UserRole, currentTeacherId?: string): FollowUpPlan[] {
    if (role === 'GURU') {
      const tid = this.resolveTeacherId(currentTeacherId);
      if (tid) {
        const filtered = this.state.followUpPlans.filter((f) => f.teacher_id === tid);
        if (filtered.length > 0) return filtered;
      }
    }
    return this.state.followUpPlans;
  }

  public async fetchFollowUpPlans(role?: UserRole, currentTeacherId?: string): Promise<FollowUpPlan[]> {
    await this.refreshFromSupabase();
    return this.getFollowUpPlans(role, currentTeacherId);
  }

  public async addFollowUpPlan(
    plan: Omit<FollowUpPlan, 'id' | 'created_at'>
  ): Promise<FollowUpPlan> {
    const client = this.ensureSupabaseClient();

    if (!this.isUuid(plan.teacher_id)) {
      throw new Error('Teacher ID tidak valid. Pilih guru dari data Supabase.');
    }
    if (!this.isUuid(plan.supervisor_id)) {
      throw new Error('Supervisor ID tidak valid.');
    }

    const schoolId = await this.ensureValidSchoolId({ school_id: plan.school_id });
    const id = this.uuid();
    const referenceId = this.isUuid(plan.reference_id) ? plan.reference_id : this.uuid();

    const payload = {
      id,
      school_id: schoolId,
      teacher_id: plan.teacher_id,
      supervisor_id: plan.supervisor_id,
      reference_type: plan.reference_type,
      reference_id: referenceId,
      activity_name: plan.activity_name.trim(),
      action_type: plan.action_type,
      target_date: plan.target_date,
      status: plan.status || 'BELUM_DIMULAI',
      outcome_notes: plan.outcome_notes?.trim() || null,
    };

    const { data, error } = await client
      .from('follow_up_plans')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Gagal menyimpan rencana tindak lanjut ke Supabase: ${error?.message}`);
    }

    const teacher = this.state.teachers.find((t) => t.id === data.teacher_id);
    const supervisor = this.state.users.find((u) => u.id === data.supervisor_id);

    const newPlan: FollowUpPlan = {
      id: data.id,
      school_id: data.school_id,
      teacher_id: data.teacher_id,
      supervisor_id: data.supervisor_id,
      reference_type: data.reference_type,
      reference_id: data.reference_id,
      activity_name: data.activity_name,
      action_type: data.action_type,
      target_date: data.target_date,
      status: data.status,
      outcome_notes: data.outcome_notes || undefined,
      teacher_name: teacher?.full_name || '',
      supervisor_name: supervisor?.full_name || '',
      created_at: data.created_at || new Date().toISOString(),
    };

    this.state.followUpPlans.unshift(newPlan);
    this.notify();
    return newPlan;
  }

  public async updateFollowUpPlan(id: string, data: Partial<FollowUpPlan>): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID rencana tindak lanjut "${id}" tidak valid.`);
    }

    const payload: Record<string, any> = {};
    if (data.activity_name !== undefined) payload.activity_name = data.activity_name.trim();
    if (data.action_type !== undefined) payload.action_type = data.action_type;
    if (data.target_date !== undefined) payload.target_date = data.target_date;
    if (data.status !== undefined) payload.status = data.status;
    if (data.outcome_notes !== undefined) payload.outcome_notes = data.outcome_notes ? data.outcome_notes.trim() : null;

    const { error } = await client.from('follow_up_plans').update(payload).eq('id', id);
    if (error) {
      throw new Error(`Gagal memperbarui rencana tindak lanjut di Supabase: ${error.message}`);
    }

    const idx = this.state.followUpPlans.findIndex((f) => f.id === id);
    if (idx >= 0) {
      this.state.followUpPlans[idx] = { ...this.state.followUpPlans[idx], ...data };
      this.notify();
    }
  }

  public async deleteFollowUpPlan(id: string): Promise<void> {
    const client = this.ensureSupabaseClient();
    if (!this.isUuid(id)) {
      throw new Error(`ID rencana tindak lanjut "${id}" tidak valid.`);
    }

    const { error } = await client.from('follow_up_plans').delete().eq('id', id);
    if (error) {
      throw new Error(`Gagal menghapus rencana tindak lanjut dari Supabase: ${error.message}`);
    }

    this.state.followUpPlans = this.state.followUpPlans.filter((f) => f.id !== id);
    this.notify();
  }

  // ==========================================
  // 9. DASHBOARD STATS
  // ==========================================
  public getDashboardStats(role: UserRole, currentTeacherId?: string): DashboardStats {
    const teachers = this.getTeachers(role, currentTeacherId);
    const rppReviews = this.getRppReviews(role, currentTeacherId);
    const supervisions = this.getSupervisions(role, currentTeacherId);
    const followUps = this.getFollowUpPlans(role, currentTeacherId);

    const totalTeachers = teachers.length;
    const totalRppReviews = rppReviews.length;
    const totalSupervisions = supervisions.length;

    const avgRppScore =
      totalRppReviews > 0
        ? Math.round((rppReviews.reduce((acc, curr) => acc + curr.percentage_score, 0) / totalRppReviews) * 10) / 10
        : 0;

    const avgSupervisionScore =
      totalSupervisions > 0
        ? Math.round(
            (supervisions.reduce((acc, curr) => acc + curr.percentage_score, 0) / totalSupervisions) * 10
          ) / 10
        : 0;

    const needyTeacherIds = new Set<string>();
    rppReviews.forEach((r) => {
      if (r.percentage_score < 75) needyTeacherIds.add(r.teacher_id);
    });
    supervisions.forEach((s) => {
      if (s.percentage_score < 75) needyTeacherIds.add(s.teacher_id);
    });
    followUps.forEach((f) => {
      if (f.status !== 'SELESAI') needyTeacherIds.add(f.teacher_id);
    });

    const teachersNeedingFollowUp = teachers.filter((t) => needyTeacherIds.has(t.id));

    return {
      totalTeachers,
      totalRppReviews,
      totalSupervisions,
      avgRppScore,
      avgSupervisionScore,
      teachersNeedingFollowUp,
      monthlyProgress: [
        { month: 'Mei', rppAvg: totalRppReviews > 0 ? 72 : 0, supervisionAvg: totalSupervisions > 0 ? 68 : 0 },
        { month: 'Jun', rppAvg: totalRppReviews > 0 ? 76 : 0, supervisionAvg: totalSupervisions > 0 ? 71 : 0 },
        { month: 'Jul', rppAvg: totalRppReviews > 0 ? 81 : 0, supervisionAvg: totalSupervisions > 0 ? 75 : 0 },
        { month: 'Agt', rppAvg: totalRppReviews > 0 ? Math.max(avgRppScore, 78) : 0, supervisionAvg: totalSupervisions > 0 ? Math.max(avgSupervisionScore, 74) : 0 },
        { month: 'Sep', rppAvg: avgRppScore, supervisionAvg: avgSupervisionScore },
      ],
    };
  }

  // ==========================================
  // 10. SYSTEM MAINTENANCE
  // ==========================================
  public clearAllTransactionalData(): void {
    this.state.rppReviews = [];
    this.state.supervisions = [];
    this.state.aiAnalyses = [];
    this.state.followUpPlans = [];
    this.notify();
  }

  public resetToDefaults(): void {
    this.state = {
      schools: [],
      users: [],
      teachers: [],
      instruments: [],
      rppReviews: [],
      supervisions: [],
      aiAnalyses: [],
      followUpPlans: [],
    };
    this.notify();
    void this.refreshFromSupabase();
  }
}

export const db = new DatabaseService();
