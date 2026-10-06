import { describe, it, expect, vi } from "vitest";
import {
  UserRole,
  authorizeRoles,
  requireSchoolAccess,
  requireTeacherOwnership,
  authenticateToken,
  AuthenticatedRequest,
} from "./auth";

describe("RBAC Authorization Rules", () => {
  function checkPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    if (requiredRoles.length === 0) return true;
    return requiredRoles.includes(userRole);
  }

  it("allows ADMIN access to all routes", () => {
    expect(checkPermission("ADMIN", ["SUPERVISOR", "ADMIN"])).toBe(true);
    expect(checkPermission("ADMIN", ["SUPERVISOR"])).toBe(false);
  });

  it("allows SUPERVISOR access to supervisor and teacher routes", () => {
    expect(checkPermission("SUPERVISOR", ["SUPERVISOR", "ADMIN"])).toBe(true);
  });

  it("restricts GURU from supervisor-only routes", () => {
    expect(checkPermission("GURU", ["SUPERVISOR", "ADMIN"])).toBe(false);
  });

  it("allows GURU to access guru routes", () => {
    expect(checkPermission("GURU", ["GURU", "SUPERVISOR", "ADMIN"])).toBe(true);
  });
});

describe("School & Teacher Isolation Helpers", () => {
  it("allows access if user school matches target school", () => {
    const req = {
      user: {
        id: "u-1",
        email: "admin@test.com",
        role: "ADMIN" as UserRole,
        school_id: "sch-123",
      },
    } as AuthenticatedRequest;

    expect(requireSchoolAccess(req, "sch-123")).toBe(true);
    expect(requireSchoolAccess(req, "sch-999")).toBe(false);
  });

  it("restricts GURU from viewing another teacher data", () => {
    const guruReq = {
      user: {
        id: "u-guru-1",
        email: "guru1@test.com",
        role: "GURU" as UserRole,
        school_id: "sch-123",
        teacher_id: "teach-1",
      },
    } as AuthenticatedRequest;

    expect(requireTeacherOwnership(guruReq, "teach-1")).toBe(true);
    expect(requireTeacherOwnership(guruReq, "teach-2")).toBe(false);
  });

  it("allows SUPERVISOR and ADMIN to review any teacher in their school", () => {
    const supReq = {
      user: {
        id: "u-sup-1",
        email: "sup@test.com",
        role: "SUPERVISOR" as UserRole,
        school_id: "sch-123",
      },
    } as AuthenticatedRequest;

    expect(requireTeacherOwnership(supReq, "teach-any")).toBe(true);
  });
});

describe("authenticateToken middleware edge cases", () => {
  it("rejects request without authorization header with HTTP 401", async () => {
    const req = { headers: {} } as AuthenticatedRequest;
    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);
    expect(statusCode).toBe(401);
    expect(jsonBody?.error).toBe("UNAUTHORIZED");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects request with invalid or empty bearer token with HTTP 401", async () => {
    const req = {
      headers: {
        authorization: "Bearer ",
      },
    } as AuthenticatedRequest;
    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);
    expect(statusCode).toBe(401);
    expect(jsonBody?.error).toBe("UNAUTHORIZED");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects request when token is invalid or expired from Supabase Auth with HTTP 401", async () => {
    const { setSupabaseServerClient } = await import("./auth");

    const mockClient: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("Invalid or expired JWT token"),
        }),
      },
    };
    setSupabaseServerClient(mockClient);

    const req = {
      headers: {
        authorization: "Bearer expired-or-invalid-token",
        "x-user-role": "SUPERVISOR", // attempting to spoof role
      },
    } as unknown as AuthenticatedRequest;

    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    // Strict 401, no fallback to supervisor
    expect(statusCode).toBe(401);
    expect(jsonBody?.error).toBe("UNAUTHORIZED");
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();

    setSupabaseServerClient(null);
  });

  it("returns HTTP 403 if Auth user is valid but profile is missing in database", async () => {
    const { setSupabaseServerClient } = await import("./auth");

    const mockClient: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-valid-uuid", email: "newuser@test.com" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
    setSupabaseServerClient(mockClient);

    const req = {
      headers: {
        authorization: "Bearer valid-auth-token",
        "x-user-role": "ADMIN",
      },
    } as unknown as AuthenticatedRequest;

    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    // Rule 12: HTTP 403
    expect(statusCode).toBe(403);
    expect(jsonBody?.error).toBe("FORBIDDEN_PROFILE_NOT_FOUND");
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();

    setSupabaseServerClient(null);
  });

  it("authenticates valid token and loads role and school_id strictly from database, ignoring spoofed headers", async () => {
    const { setSupabaseServerClient } = await import("./auth");

    const mockClient: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-uuid-123", email: "teacher@test.com" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "auth-uuid-123",
                    email: "teacher@test.com",
                    full_name: "Siti Rahayu, S.Pd.",
                    role: "GURU", // Database says GURU
                    school_id: "sch-database-456", // Database says sch-database-456
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "teachers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "teach-db-999" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };
    setSupabaseServerClient(mockClient);

    const req = {
      headers: {
        authorization: "Bearer valid-token",
        "x-user-role": "ADMIN", // Attacker trying to spoof ADMIN
        "x-school-id": "sch-attacker-666", // Attacker trying to spoof school
      },
    } as unknown as AuthenticatedRequest;

    let statusCode = 0;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return { json: vi.fn() };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCode).toBe(0); // No error status set
    expect(next).toHaveBeenCalled();

    // Verify identity, role, school_id are from database, not spoofed headers
    expect(req.user).toBeDefined();
    expect(req.user?.id).toBe("auth-uuid-123");
    expect(req.user?.role).toBe("GURU"); // From database, NOT "ADMIN"
    expect(req.user?.school_id).toBe("sch-database-456"); // From database, NOT "sch-attacker-666"
    expect(req.user?.teacher_id).toBe("teach-db-999");

    // Verify spoofed headers were stripped
    expect(req.headers["x-user-role"]).toBeUndefined();
    expect(req.headers["x-school-id"]).toBeUndefined();

    setSupabaseServerClient(null);
  });

  it("returns HTTP 403 if profile has invalid role or missing school_id in database", async () => {
    const { setSupabaseServerClient } = await import("./auth");

    const mockClient: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-uuid-roleless", email: "roleless@test.com" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "auth-uuid-roleless",
                email: "roleless@test.com",
                role: "UNKNOWN_ROLE",
                school_id: "sch-1",
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    setSupabaseServerClient(mockClient);

    const req = {
      headers: {
        authorization: "Bearer valid-token",
      },
    } as unknown as AuthenticatedRequest;

    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCode).toBe(403);
    expect(jsonBody?.error).toBe("FORBIDDEN_INVALID_ROLE");
    expect(next).not.toHaveBeenCalled();

    setSupabaseServerClient(null);
  });

  it("authorizeRoles blocks unauthorized roles with HTTP 403", () => {
    const req = {
      user: {
        id: "u-guru-1",
        email: "guru@test.com",
        role: "GURU" as UserRole,
        school_id: "sch-1",
      },
    } as AuthenticatedRequest;

    let statusCode = 0;
    let jsonBody: any = null;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            jsonBody = body;
          },
        };
      },
    } as any;
    const next = vi.fn();

    const middleware = authorizeRoles("ADMIN", "SUPERVISOR");
    middleware(req, res, next);

    expect(statusCode).toBe(403);
    expect(jsonBody?.error).toBe("FORBIDDEN");
    expect(next).not.toHaveBeenCalled();
  });
});

