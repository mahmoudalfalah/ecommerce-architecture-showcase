import React, { createContext, useContext, useEffect, useMemo } from 'react';

import { useAdminSession } from '@/features/auth/hooks/admin/useAdminSession';
import type { AdminUser, AuthActions } from '@/features/auth/types/auth.types';

type AuthState = {
  isAuthenticated: boolean;
  isInitializing: boolean;
  user: AdminUser | null;
};

type AuthContextType = {
  state: AuthState;
  actions: AuthActions;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const {
    user,
    isAuthenticated,
    isInitializing,
    logout,
    expireLocalSession,
    isLogoutLoading,
    refetchSession,
  } = useAdminSession();

  useEffect(() => {
    const handleSessionExpired = () => {
      expireLocalSession();
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [expireLocalSession]);

  const contextValue = useMemo(
    () => ({
      state: { isAuthenticated, isInitializing, user },
      actions: { logout, refetchSession, isLogoutLoading },
    }),
    [isAuthenticated, isInitializing, user, logout, refetchSession, isLogoutLoading],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
