import React from 'react';
import { Route } from 'react-router-dom';
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
      <Route index element={<AdminDashboard />} />
      <Route path="legacy" element={<Amain />} />
    </Route>
  </>
);

export default adminRoutes;
