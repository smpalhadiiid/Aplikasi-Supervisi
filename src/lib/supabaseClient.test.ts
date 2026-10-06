import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  testSupabaseConnection,
  checkDatabaseHealth,
  getSupabaseConfigStatus,
  __setSupabaseClientForTesting,
  supabase,
  isSupabaseConfigured,
} from './supabaseClient';

describe('supabaseClient configuration & health check', () => {
  const initialClient = supabase;
  const initialConfigured = isSupabaseConfigured;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    __setSupabaseClientForTesting(initialClient, initialConfigured);
  });

  it('provides configuration status via getSupabaseConfigStatus', () => {
    const status = getSupabaseConfigStatus();
    expect(status).toHaveProperty('isConfigured');
    expect(status).toHaveProperty('hasUrl');
    expect(status).toHaveProperty('hasAnonKey');
    expect(status).toHaveProperty('missingVariables');
    expect(status).toHaveProperty('message');
  });

  describe('testSupabaseConnection()', () => {
    it('returns MISSING_CONFIG if supabase client is not initialized', async () => {
      __setSupabaseClientForTesting(null, false);

      const result = await testSupabaseConnection();
      expect(result.success).toBe(false);
      expect(result.category).toBe('MISSING_CONFIG');
      expect(result.message).toContain('Variabel lingkungan');
    });

    it('returns TABLE_NOT_FOUND if table does not exist (Error 42P01)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '42P01', message: 'relation "schools" does not exist' },
            }),
          }),
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const result = await testSupabaseConnection();
      expect(result.success).toBe(false);
      expect(result.category).toBe('TABLE_NOT_FOUND');
      expect(result.code).toBe('42P01');
      expect(result.message).toContain('BELUM DIBUAT');
    });

    it('returns RLS_DENIED if RLS policy rejects access (Error 42501)', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: { code: '42501', message: 'permission denied for table schools' },
            }),
          }),
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const result = await testSupabaseConnection();
      expect(result.success).toBe(false);
      expect(result.category).toBe('RLS_DENIED');
      expect(result.code).toBe('42501');
      expect(result.message).toContain('ROW LEVEL SECURITY');
    });

    it('returns TABLE_READABLE when real query succeeds', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: '11111111-1111-1111-1111-111111111111' }],
              error: null,
            }),
          }),
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const result = await testSupabaseConnection();
      expect(result.success).toBe(true);
      expect(result.category).toBe('TABLE_READABLE');
      expect(result.message).toContain('berhasil diakses dan dibaca');
    });

    it('returns NETWORK_ERROR on connection failure', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
          }),
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const result = await testSupabaseConnection();
      expect(result.success).toBe(false);
      expect(result.category).toBe('NETWORK_ERROR');
      expect(result.message).toContain('Network Error');
    });
  });

  describe('checkDatabaseHealth()', () => {
    it('verifies schools, users, and teachers tables', async () => {
      const queriedTables: string[] = [];
      const mockSupabase = {
        from: vi.fn().mockImplementation((tableName: string) => {
          queriedTables.push(tableName);
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 'test-id' }],
                count: 1,
                error: null,
              }),
            }),
          };
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const health = await checkDatabaseHealth();

      expect(queriedTables).toContain('schools');
      expect(queriedTables).toContain('users');
      expect(queriedTables).toContain('teachers');

      expect(health.healthy).toBe(true);
      expect(health.overallCategory).toBe('TABLE_READABLE');
      expect(health.tables.schools.healthy).toBe(true);
      expect(health.tables.users.healthy).toBe(true);
      expect(health.tables.teachers.healthy).toBe(true);
    });

    it('identifies if a specific table (e.g. teachers) is missing', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((tableName: string) => {
          if (tableName === 'teachers') {
            return {
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  count: null,
                  error: { code: '42P01', message: 'relation "teachers" does not exist' },
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ id: 'test-id' }],
                count: 1,
                error: null,
              }),
            }),
          };
        }),
      };

      __setSupabaseClientForTesting(mockSupabase, true);

      const health = await checkDatabaseHealth();

      expect(health.healthy).toBe(false);
      expect(health.overallCategory).toBe('TABLE_NOT_FOUND');
      expect(health.tables.schools.healthy).toBe(true);
      expect(health.tables.users.healthy).toBe(true);
      expect(health.tables.teachers.healthy).toBe(false);
      expect(health.tables.teachers.category).toBe('TABLE_NOT_FOUND');
    });
  });
});
