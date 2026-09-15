export const normalizeUserProfile = (profile = {}) => {
  const address = profile?.address && typeof profile.address === 'object'
    ? profile.address
    : {};

  const hasCanonicalName = Boolean(profile?.firstName || profile?.lastName);
  const firstName = profile?.firstName
    || (!hasCanonicalName ? profile?.fullName || '' : '');
  const lastName = profile?.lastName || '';
  const avatarUrl = profile?.avatarUrl || profile?.avatar || null;

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
