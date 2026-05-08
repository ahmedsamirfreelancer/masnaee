import { create } from 'zustand';

const useAuth = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('masna3i_user') || 'null'),
  token: localStorage.getItem('masna3i_token') || null,

  login: ({ token, user }) => {
    localStorage.setItem('masna3i_token', token);
    localStorage.setItem('masna3i_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('masna3i_token');
    localStorage.removeItem('masna3i_user');
    set({ token: null, user: null });
  },

  isAuthenticated: () => !!get().token,

  hasPermission: (permission) => {
    const { user } = get();
    if (!user?.permissions) return false;
    if (user.permissions.includes('*')) return true;
    const [mod] = permission.split('.');
    return user.permissions.includes(permission) || user.permissions.includes(`${mod}.*`);
  },
}));

export default useAuth;
