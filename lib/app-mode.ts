"use client";

/**
 * Two isolated environments live inside the same compiled app:
 *
 *  - "production": the real salon's live data. This is what opens by
 *    default, always, with no extra screen — day-to-day staff never see
 *    this file exist.
 *  - "training": a completely separate database, separate license, and
 *    separate login, used for demos and staff training. Nothing done in
 *    Training can ever touch Production data, and vice versa, because
 *    every storage key below is namespaced per mode.
 *
 * Switching modes requires a full app reload (see switchAppMode) because
 * the Dexie database instance in lib/db.ts is created once, at import
 * time, from whatever mode is active. A reload re-runs that import with
 * the new mode selected.
 */

export type AppMode = "production" | "training";

const MODE_STORAGE_KEY = "mh_digital_salon_pos_mode";

export const SESSION_KEYS = [
  "userRole",
  "username",
  "userId",
  "userPermissions",
];

export function getAppMode(): AppMode {
  if (typeof window === "undefined") {
    return "production";
  }

  const stored = window.localStorage.getItem(MODE_STORAGE_KEY);

  return stored === "training" ? "training" : "production";
}

export function isTrainingMode(): boolean {
  return getAppMode() === "training";
}

/** Dexie/IndexedDB database name for the given (or current) mode. */
export function getDbName(mode: AppMode = getAppMode()): string {
  return mode === "training"
    ? "SalonPOS_Training_v1"
    : "SalonPOS_Production_v2";
}

/** localStorage key used to store the license for the given (or current) mode. */
export function getLicenseStorageKey(mode: AppMode = getAppMode()): string {
  return mode === "training"
    ? "mh_digital_salon_pos_license_training"
    : "mh_digital_salon_pos_license";
}

/**
 * Switches the active environment and reloads the app. Clears the
 * logged-in session first, since the other mode has an entirely
 * separate users table — whoever lands on the login screen after the
 * reload has to sign in again with that mode's own admin account.
 */
export function switchAppMode(mode: AppMode): void {
  if (typeof window === "undefined") return;

  for (const key of SESSION_KEYS) {
    window.localStorage.removeItem(key);
  }

  window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  window.location.href = "/";
}

/**
 * Selects an environment from the Setup wizard itself, before any
 * admin account exists — so no password check is needed here. Reloads
 * straight back into /setup, now bound to the chosen environment's
 * (empty) database.
 */
export function beginAppModeSetup(mode: AppMode): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  window.location.href = "/setup";
}

export function modeLabel(mode: AppMode = getAppMode()): string {
  return mode === "training" ? "Training Mode" : "Production";
}
