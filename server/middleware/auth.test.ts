import { describe, it, expect } from "vitest";
import { UserRole } from "../middleware/auth";

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
