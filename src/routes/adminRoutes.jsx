import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import AdminProtectedRoute from '../auth/admin/AdminProtectedRoute';
import AdminGuestRoute from '../auth/admin/AdminGuestRoute';
import AdminLayout from '../auth/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Amain from '../AdminPanel/Amain';
import Alogin from '../AdminPanel/Alogin';

const adminRoutes = (
  <>
    <Route
      path="/admin/login"
      element={(
        <AdminGuestRoute>
          <Alogin />
        </AdminGuestRoute>
      )}
    />
    <Route
      path="/admin"
      element={(
        <AdminProtectedRoute>
          <AdminLayout />
        </AdminProtectedRoute>
      )}
    >
      <Route index element={<Amain />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="legacy" element={<Navigate to="/admin" replace />} />
    </Route>
  </>
);

export default adminRoutes;
