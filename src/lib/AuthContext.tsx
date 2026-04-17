import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { subscribeToAuthSettings } from './data';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isHelper: boolean;
  isStaff: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [helperEmails, setHelperEmails] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    const unsubscribeSettings = subscribeToAuthSettings((settings) => {
      setHelperEmails(settings.helperEmails || []);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
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

  const logout = async () => {
    await signOut(auth);
  };

  // Define administrators
  const admins = [
    'salimgh1639@gmail.com', 
    'salimgh1639-sys@gmail.com', 
    'ghezalsal1639@gmail.com'
  ];

  const userEmail = user?.email?.toLowerCase() || '';
  const isAdmin = admins.includes(userEmail);
  const isHelper = helperEmails.map(e => e.toLowerCase()).includes(userEmail);
  const isStaff = isAdmin || isHelper;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isHelper, isStaff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
