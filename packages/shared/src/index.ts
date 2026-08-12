/**
 * Shared types, constants and utilities for the NYSC Ekiti platform.
 * Expand as domain concepts stabilize.
 */

export const APP_NAME = "NYSC Ekiti Digital Platform";

export type LifecycleStatus =
  | "MOBILISED"
  | "VERIFIED"
  | "CHECKED_IN"
  | "ACCOMMODATED"
  | "REGISTERED"
  | "BANK_REGISTERED"
  | "PLATOON_ASSIGNED"
  | "KIT_ISSUED"
  | "CAMP_ACTIVE"
  | "CAMP_EXIT_REQUESTED"
  | "CAMP_EXITED"
  | "PPA_POSTED"
  | "CLEARED"
  | "COMPLETED";
