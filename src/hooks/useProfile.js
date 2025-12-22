import { useCallback, useState } from 'react';
import {
  getProfile as getProfileApi,
  updateProfile as updateProfileApi,
  updateProfileFallback
} from '../services/publicAuth/publicAuthClient';
import { mapApiErrorToFields, mapApiErrorToMessage, usePublicAuth } from './usePublicAuth';

export const useProfile = () => {
  const { setUser } = usePublicAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const getProfile = useCallback(async () => {
    setLoading(true);
    setErrors({});
    try {
      const profile = await getProfileApi();
      setUser(profile);
      return profile;
    } catch (error) {
      setErrors(mapApiErrorToFields(error));
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  const updateProfile = useCallback(
    async (payload) => {
      setLoading(true);
      setErrors({});
      try {
        const profile = await updateProfileApi(payload);
        setUser(profile);
        return profile;
      } catch (error) {
        setErrors(mapApiErrorToFields(error));
        if (error?.response?.status === 404) {
          // try fallback endpoint if primary is not available
          const profile = await updateProfileFallback(payload);
          setUser(profile);
          return profile;
        }
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setUser]
  );

  return { getProfile, updateProfile, loading, errors, mapApiErrorToMessage };
};

export default useProfile;
