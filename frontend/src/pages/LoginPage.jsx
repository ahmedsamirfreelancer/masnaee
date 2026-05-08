import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import useAuth from '../hooks/useAuth';
import api from '../utils/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data);
      toast.success(`مرحباً ${data.user.full_name}`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-sky-800 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur rounded-2xl mb-4">
            <img src="/logo-icon.svg" alt="مصنعي" className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-bold text-white">مصنعي</h1>
          <p className="text-primary-200 mt-1">نظام إدارة المصانع</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">اسم المستخدم</label>
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <LockClosedIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full pr-10 pl-10 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="أدخل كلمة المرور"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input type="checkbox" id="remember" className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="remember" className="mr-2 text-sm text-slate-600 dark:text-slate-400">تذكرني</label>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-lg shadow-primary-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
            تسجيل الدخول
          </button>
        </form>

        <p className="text-center text-primary-200 text-sm mt-6">مصنعي &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
