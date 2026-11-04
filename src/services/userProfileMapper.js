import appConfig from '../config/appConfig.js';

export const resolveAvatarUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value, `${appConfig.apiBaseUrl}/`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.pathname.startsWith('/storage/avatars/')) {
      return new URL(`${url.pathname}${url.search}${url.hash}`, `${appConfig.apiBaseUrl}/`).href;
    }
    return url.href;
  } catch { return null; }
};

export const normalizeUserProfile = (profile = {}) => {
  const address = profile?.address && typeof profile.address === 'object'
    ? profile.address
    : {};

  const hasCanonicalName = Boolean(profile?.firstName || profile?.lastName);
  const firstName = profile?.firstName
    || (!hasCanonicalName ? profile?.fullName || '' : '');
  const lastName = profile?.lastName || '';
  const avatarUrl = resolveAvatarUrl(profile?.avatarUrl || profile?.avatar);

  return {
    ...profile,
    firstName,
    lastName,
    phoneNumber: profile?.phone || profile?.phoneNumber || '',
    province: address?.province || profile?.province || '',
    city: address?.city || profile?.city || '',
    avatarUrl,
    // Backward-compatible aliases used by existing profile pages.
    avatar: avatarUrl
  };
};

export default normalizeUserProfile;
