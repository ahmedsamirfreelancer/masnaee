import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('masna3i_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('masna3i_token');
      localStorage.removeItem('masna3i_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Safe helper: always returns array from API response
export function safeArray(response) {
  const d = response?.data?.data;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    // Try common nested array keys
    for (const key of ['rows', 'items', 'settings', 'list', 'results']) {
      if (Array.isArray(d[key])) return d[key];
    }
  }
  return [];
}

export default api;
