import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { Helper, subscribeToHelpers } from './data';

interface AuthContextType {
  user: User | null;
  helperUser: Helper | null;
  loading: boolean;
  isAdmin: boolean;
  isHelper: boolean;
  isStaff: boolean;
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
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
      }
    });

    const unsubscribeHelpers = subscribeToHelpers((data) => {
      setHelpers(data);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeHelpers();
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  };

  const helperLogin = async (email: string, pass: string) => {
    const match = helpers.find(h => h.email.toLowerCase() === email.toLowerCase() && h.password === pass);
    if (match) {
      // 1. Sign in anonymously with Firebase to satisfy security rules (isSignedIn)
      try {
        await signInAnonymously(auth);
        const sessionData = { id: match.id, email: match.email };
        setHelperUser(sessionData);
        localStorage.setItem('kk_helper_session', JSON.stringify(sessionData));
        return true;
      } catch (e) {
        console.error("Anonymous auth failed", e);
        return false;
      }
    }
    return false;
  };

  const logout = async () => {
    await signOut(auth);
    setHelperUser(null);
    localStorage.removeItem('kk_helper_session');
  };

  const admins = [
    'salimgh1639@gmail.com', 
    'salimgh1639-sys@gmail.com', 
    'ghezalsal1639@gmail.com'
  ];

  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = !!(user && !user.isAnonymous && admins.includes(userEmail));
  const isHelper = !!helperUser;
  const isStaff = isAdmin || isHelper;

  return (
    <AuthContext.Provider value={{ user, helperUser, loading, isAdmin, isHelper, isStaff, login, helperLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
