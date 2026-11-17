/**
 * One place that says who may do what.
 * admin      – everything, including roles and (future) financial totals and salaries
 * manager    – sees and runs everything staff see, but never financial totals or salaries
 * operator   – day-to-day bookings, schedule, students, password reset for students
 * instructor – own lessons and own students
 * student    – own bookings
 */
export const ROLES = [
  "student",
  "instructor",
  "operator",
  "manager",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];
/** Roles that may see every booking and student. */
export const STAFF: string[] = ["admin", "manager", "operator"];
export const isStaff = (role?: string | null) => STAFF.includes(role || "");
/** Report totals and final salaries: administrators only. */
export const canSeeFinance = (role?: string | null) => role === "admin";
/** Only administrators change roles and content settings. */
export const canManageRoles = (role?: string | null) => role === "admin";
