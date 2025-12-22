import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import usePublicAuth from '../../hooks/usePublicAuth';

const ProfileGuard = ({ children }) => {
  const { profileCompleted } = usePublicAuth();
  const location = useLocation();

  if (!profileCompleted) {
    return <Navigate to="/complete-profile" state={{ from: location }} replace />;
  }

  return children;
};

export default ProfileGuard;
