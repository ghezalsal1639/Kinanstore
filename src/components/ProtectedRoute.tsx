import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isStaff } = useAuth();

  if (loading) {
    return null;
  }

  if (!user || !isStaff) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
