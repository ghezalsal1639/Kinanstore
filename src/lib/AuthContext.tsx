import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { Helper, subscribeToHelpers, findHelperByEmail, AppSettings, subscribeToAppSettings } from './data';

interface AuthContextType {
  user: User | null;
  helperUser: Helper | null;
  loading: boolean;
  isAdmin: boolean;
  isHelper: boolean;
  isStaff: boolean;
  appSettings: AppSettings;
  login: () => Promise<void>;
  helperLogin: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [helperUser, setHelperUser] = useState<Helper | null>(null);
  const [loading, setLoading] = useState(true);
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({});

  useEffect(() => {
    let unsubscribeHelpers: (() => void) | undefined;

    // Global settings subscription (once per app lifetime)
    const unsubscribeSettings = subscribeToAppSettings((settings) => {
      setAppSettings(settings);
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      // If we are logged in as admin, subscribe to helpers for management
      const admins = [
        'salimgh1639@gmail.com', 
        'salimgh1639-sys@gmail.com', 
        'ghezalsal1639@gmail.com'
      ];
      const isActuallyAdmin = !!(currentUser && !currentUser.isAnonymous && admins.includes(currentUser.email?.toLowerCase() || ''));

      if (isActuallyAdmin && !unsubscribeHelpers) {
        unsubscribeHelpers = subscribeToHelpers((data) => {
          setHelpers(data);
        });
      }

      // Check if this anonymous user was previously logged in as a helper
      if (currentUser?.isAnonymous) {
        const savedHelper = localStorage.getItem('kk_helper_session');
        if (savedHelper) {
          try {
            setHelperUser(JSON.parse(savedHelper));
          } catch (e) {
            localStorage.removeItem('kk_helper_session');
          }
        }
      } else if (!currentUser) {
        setHelperUser(null);
        localStorage.removeItem('kk_helper_session');
        if (unsubscribeHelpers) {
          unsubscribeHelpers();
          unsubscribeHelpers = undefined;
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      if (unsubscribeHelpers) unsubscribeHelpers();
    };
  }, []);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  }, []);

  const helperLogin = useCallback(async (email: string, pass: string) => {
    try {
      // 1. Sign in anonymously first to get permission to query the helpers collection
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (authErr: any) {
          if (authErr.code === 'auth/operation-not-allowed') {
            throw new Error('CONFIG_ERROR_ANONYMOUS_AUTH_DISABLED');
          }
          throw authErr;
        }
      }

      // 2. Look up the helper by email
      let helperRecord;
      try {
        helperRecord = await findHelperByEmail(email);
      } catch (dbErr: any) {
        // If query fails because of rules, it might be due to auth sync lag
        console.warn("Database query failed, retrying after auth sync...", dbErr);
        await new Promise(resolve => setTimeout(resolve, 500));
        helperRecord = await findHelperByEmail(email);
      }
      
      if (helperRecord && helperRecord.password === pass) {
        const sessionData = { id: helperRecord.id, email: helperRecord.email };
        setHelperUser(sessionData);
        localStorage.setItem('kk_helper_session', JSON.stringify(sessionData));
        return true;
      } else {
        // If it failed and we just signed in anonymously, sign out to be clean
        if (auth.currentUser?.isAnonymous) {
          await signOut(auth);
        }
        return false;
      }
    } catch (e: any) {
      console.error("Helper login process failed", e);
      // Ensure we clean up on error
      if (auth.currentUser?.isAnonymous) {
        await signOut(auth).catch(() => {});
      }
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setHelperUser(null);
    localStorage.removeItem('kk_helper_session');
  }, []);

  const admins = useMemo(() => [
    'salimgh1639@gmail.com', 
    'salimgh1639-sys@gmail.com', 
    'ghezalsal1639@gmail.com'
  ], []);

  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = useMemo(() => !!(user && !user.isAnonymous && admins.includes(userEmail)), [user, userEmail, admins]);
  const isHelper = !!helperUser;
  const isStaff = isAdmin || isHelper;

  const value = useMemo(() => ({
    user,
    helperUser,
    loading,
    isAdmin,
    isHelper,
    isStaff,
    appSettings,
    login,
    helperLogin,
    logout
  }), [user, helperUser, loading, isAdmin, isHelper, isStaff, appSettings, login, helperLogin, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
