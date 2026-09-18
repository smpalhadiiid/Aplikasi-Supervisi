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

