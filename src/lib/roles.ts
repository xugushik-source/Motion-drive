/**
 * One place that says who may do what.
 * admin      – everything: roles, prices, settings, financial reports and statistics
 * manager    – everything staff do (see operator); kept as a separate role for later differences
 * operator   – bookings, schedule changes, students, payments and debts, content like photos
 * instructor – own lessons and own students
 * lecturer   – like an instructor, for theory
 * student    – own bookings
 */
export const ROLES = [
  "student",
  "instructor",
  "lecturer",
  "operator",
  "manager",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];
/** Roles that may see every booking and student. */
export const STAFF: string[] = ["admin", "manager", "operator"];
export const isStaff = (role?: string | null) => STAFF.includes(role || "");
/** Teachers see and run only their own lessons. */
export const isTeacher = (role?: string | null) =>
  role === "instructor" || role === "lecturer";
/** Report totals, revenue analysis, statistics and salaries: administrators only. */
export const canSeeFinance = (role?: string | null) => role === "admin";
/** Entering payments and seeing who still owes money: all staff. */
export const canRecordPayments = (role?: string | null) => isStaff(role);
/** Only administrators change roles, create staff accounts and settings. */
export const canManageRoles = (role?: string | null) => role === "admin";
/** Site content staff may edit (photos, descriptions, FAQ). Prices and settings stay with admins. */
export const STAFF_KINDS = [
  "media",
  "instructors",
  "branches",
  "courses",
  "reviews",
  "faq",
  "knowledge",
  "materials",
  "translations",
];
export const canEditKind = (role: string | null | undefined, kind: string) =>
  role === "admin" || (isStaff(role) && STAFF_KINDS.includes(kind));
