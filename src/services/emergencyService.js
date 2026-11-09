import { useUserAuthStore } from '../auth/user/userAuthStore.js';
import { recordEmergencyReceipt } from './userNotificationService.js';
import apiUser from '../api/apiUser.js';

export async function submitEmergency(payload) {
  const session = useUserAuthStore.getState();
  const { data } = await apiUser.post('/api/v1/emergencies', payload, { timeout: 15000 });
  if (!data?.id || data?.status !== 'received' || data?.requestId !== payload.requestId) {
    throw new Error('Emergency receipt was not confirmed');
  }
  recordEmergencyReceipt(session.user?.id, data);
  return data;
}
