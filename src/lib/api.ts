import { supabase } from './supabaseClient';

/**
 * Retrieves the current Supabase JWT access token asynchronously.
 */
export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Returns Authorization header with Supabase Bearer token if session exists.
 * If token is available in local storage or session, it provides standard headers.
 */
export function getAuthHeader(): Record<string, string> {
  if (!supabase) return {};
  try {
    // Attempt to inspect active session from client storage
    const storageKey = `sb-${new URL(supabase['supabaseUrl'] || 'https://default.supabase.co').hostname.split('.')[0]}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      const token = parsed?.access_token || parsed?.currentSession?.access_token;
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch {
    // ignore parse error
  }
  return {};
}

/**
 * Performs an authenticated fetch to backend API endpoints.
 * Automatically injects the Supabase JWT Bearer token into the Authorization header.
 * Strictly never relies on spoofable x-user-role or x-user-id headers.
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  // Remove any legacy insecure headers if present
  delete headers['X-User-Role'];
  delete headers['x-user-role'];
  delete headers['X-User-Id'];
  delete headers['x-user-id'];
  delete headers['X-User-Email'];
  delete headers['x-user-email'];

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    let result: any = null;
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      return {
        success: response.ok,
        error: response.ok ? undefined : 'NON_JSON_RESPONSE',
        message: text,
      };
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: err?.message || 'Gagal menghubungi server.',
    };
  }
}
