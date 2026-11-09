// Local receipts contain only events confirmed by the server, never sample data.
const storageKey = (userId) => `gp_notifications:${userId ?? 'guest'}`;
export function readNotifications(userId) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(value) ? value.filter(n => n?.id && n?.timestamp).slice(0, 100) : [];
  } catch { return []; }
}
export function writeNotifications(userId, notifications) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(notifications.slice(0, 100))); } catch { /* Storage unavailable. */ }
}
export function recordEmergencyReceipt(userId, receipt) {
  const entries = readNotifications(userId);
  const id = `emergency:${receipt.id}`;
  if (entries.some(n => n.id === id)) return;
  writeNotifications(userId, [{ id, type: 'system', title: 'emergencyTitle',
    description: 'emergencySubmissionSuccess', timestamp: new Date().toISOString(),
    read: false, icon: '⚙️' }, ...entries]);
}
