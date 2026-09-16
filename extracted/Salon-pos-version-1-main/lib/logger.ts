import { db } from './db';

/**
 * Production audit log engine.
 *
 * Records sensitive actions locally in IndexedDB so the
 * existing offline-first POS architecture is preserved.
 */
export async function logAction(
  action: string,
  details: string
): Promise<void> {
  try {
    const userId =
      typeof window !== 'undefined'
        ? localStorage.getItem('userId') || '0'
        : '0';

    const username =
      typeof window !== 'undefined'
        ? localStorage.getItem('username') || 'System'
        : 'System';

    await db.auditLogs.add({
      userId,
      username,
      action: action.toUpperCase(),
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error(
      'Audit Logging Failed:',
      error
    );
  }
}
