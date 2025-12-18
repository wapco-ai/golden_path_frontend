import React, { Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import AdminProtectedRoute from '../auth/admin/AdminProtectedRoute';
import AdminGuestRoute from '../auth/admin/AdminGuestRoute';
import AdminLayout from '../auth/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Alogin from '../AdminPanel/Alogin';

const AdminMapPage = React.lazy(() => import('../pages/admin/AdminMapPage'));
const AdminContentPage = React.lazy(() => import('../pages/admin/AdminContentPage'));
const AdminUsersPage = React.lazy(() => import('../pages/admin/AdminUsersPage'));
const AdminReportsPage = React.lazy(() => import('../pages/admin/AdminReportsPage'));

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
      <Route index element={<Navigate to="/admin/map" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route
        path="map"
        element={(
          <Suspense fallback={<div>Loading...</div>}>
            <AdminMapPage />
          </Suspense>
        )}
      />
      <Route
        path="content"
        element={(
          <Suspense fallback={<div>Loading...</div>}>
            <AdminContentPage />
          </Suspense>
        )}
      />
      <Route
        path="users"
        element={(
          <Suspense fallback={<div>Loading...</div>}>
            <AdminUsersPage />
          </Suspense>
        )}
      />
      <Route
        path="reports"
        element={(
          <Suspense fallback={<div>Loading...</div>}>
            <AdminReportsPage />
          </Suspense>
        )}
      />
      <Route path="legacy" element={<Navigate to="/admin" replace />} />
    </Route>
  </>
);

export default adminRoutes;
