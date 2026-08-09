import { API_URL } from './config';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiFetch(url, options = {}) {
  const opts = { ...options };
  opts.headers = { ...opts.headers };

  // Set Content-Type default if body exists and is not FormData
  if (opts.body && !(opts.body instanceof FormData) && !opts.headers['Content-Type']) {
    opts.headers['Content-Type'] = 'application/json';
  }

  // Attach access token automatically if present
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken && !opts.headers['Authorization']) {
    opts.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(url, opts);
  } catch (err) {
    throw err;
  }

  // Check if response is 401 Unauthorized (and not from the /refresh endpoint itself)
  if (response.status === 401 && !url.includes('/api/auth/refresh')) {
    const refreshToken = localStorage.getItem('refreshToken');

    if (!refreshToken) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('token');

      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/signup') && !path.startsWith('/reset-password')) {
        window.location.href = '/login';
      }
      return response;
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          opts.headers['Authorization'] = `Bearer ${newToken}`;
          return fetch(url, opts);
        })
        .catch(() => response);
    }

    isRefreshing = true;

    try {
      const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.accessToken) {
          localStorage.setItem('accessToken', refreshData.accessToken);
          isRefreshing = false;
          processQueue(null, refreshData.accessToken);

          // Retry original request once
          opts.headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          return await fetch(url, opts);
        }
      }
    } catch (refreshErr) {
      console.error('Failed to refresh access token:', refreshErr);
    }

    // Refresh failed or revoked
    isRefreshing = false;
    processQueue(new Error('Token refresh failed'), null);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('token');

    const path = window.location.pathname;
    if (!path.startsWith('/login') && !path.startsWith('/signup') && !path.startsWith('/reset-password')) {
      window.location.href = '/login';
    }
  }

  return response;
}
