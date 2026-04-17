import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Shield, Lock, User, ArrowLeft, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscribeToAppSettings, AppSettings } from '../lib/data';

export default function AdminLogin() {
  const { user, helperUser, isAdmin, isHelper, login, helperLogin, loading } = useAuth();
  const [loginType, setLoginType] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({});

  useEffect(() => {
    const unsubscribe = subscribeToAppSettings(setAppSettings);
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-100" />;
  }

  if ((user && isAdmin) || (helperUser && isHelper)) {
    return <Navigate to="/admin" replace />;
  }

  const handleAdminLogin = async () => {
    try {
      await login();
      toast.success('تم تسجيل الدخول بنجاح');
    } catch (error) {
      toast.error('فشل تسجيل الدخول');
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    
    if (!cleanEmail || !cleanPassword) {
      toast.error('يرجى ملأ جميع الحقول');
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await helperLogin(cleanEmail, cleanPassword);
      if (success) {
        toast.success('مرحباً بك مجدداً');
      } else {
        toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      }
    } catch (error: any) {
      if (error.message === 'CONFIG_ERROR_ANONYMOUS_AUTH_DISABLED') {
        toast.error('خطأ في الإعدادات: يرجى تفعيل Anonymous Auth في لوحة تحكم Firebase', { duration: 6000 });
      } else {
        toast.error('حدث خطأ أثناء تسجيل الدخول، تأكد من الاتصال بالإنترنت');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-teal" />
        
        <div className="w-32 h-32 flex items-center justify-center mx-auto mb-6 overflow-hidden">
          <img src={appSettings.logoUrl || "/logo.png"} alt="Logo" className="w-full h-full object-contain" />
        </div>

        <h1 className="text-4xl font-black text-brand-teal text-center mb-2 tracking-tighter uppercase">{appSettings.storeName || "KINAN STORE"}</h1>
        <p className="text-slate-500 text-center mb-8 text-sm font-medium">لوحة الإدارة - سجل الدخول للمتابعة</p>
        
        {/* Toggle Switches */}
        <div className="flex p-1 bg-slate-100 rounded-2xl mb-8 relative">
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${loginType === 'staff' ? 'translate-x-[calc(-100%)]' : 'translate-x-0'}`}
          />
          <button 
            onClick={() => setLoginType('admin')}
            className={`flex-1 py-2.5 text-sm font-black relative z-10 transition-colors ${loginType === 'admin' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            المدير (Google)
          </button>
          <button 
            onClick={() => setLoginType('staff')}
            className={`flex-1 py-2.5 text-sm font-black relative z-10 transition-colors ${loginType === 'staff' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            الموظفين
          </button>
        </div>

        {loginType === 'admin' ? (
          <div className="space-y-6">
            {user && !isAdmin && (
              <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl text-xs font-bold leading-relaxed border border-amber-100">
                عذراً، هذا الحساب ({user.email}) ليس لديه صلاحيات الإدارة.
              </div>
            )}
            
            <button
              onClick={handleAdminLogin}
              className="w-full bg-brand-teal text-white px-6 py-4 rounded-2xl font-bold hover:bg-brand-teal/90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-teal/20"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              تسجيل الدخول باستخدام Google
            </button>
          </div>
        ) : (
          <form onSubmit={handleStaffLogin} className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="البريد الإلكتروني"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-12 pl-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all text-right"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة المرور"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-12 pl-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-brand-teal transition-all text-right"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-teal text-white px-6 py-4 rounded-2xl font-bold hover:bg-brand-teal/90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-teal/20 disabled:opacity-50"
            >
              {isSubmitting ? 'جاري التحقق...' : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
