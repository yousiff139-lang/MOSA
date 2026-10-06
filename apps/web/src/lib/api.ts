let cachedCsrfToken: string | null = null;

export const DEFAULT_API_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Creates an AbortController with automatic timeout and manual cancellation for React hooks
 */
export function createRequest(timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      controller.abort();
    }
  };
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // Attach token from localStorage if available (cookies are sent automatically with credentials: 'include')
  if (!headers.has('Authorization') && typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const method = (options.method || 'GET').toUpperCase();
  const requiresCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  // Exclude auth routes from CSRF
  if (requiresCsrf && !url.includes('/api/auth/')) {
     if (!cachedCsrfToken) {
       try {
         const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
         if (csrfRes.ok) {
            const data = await csrfRes.json();
            cachedCsrfToken = data.csrfToken;
         }
       } catch (e) {
         console.warn('Failed to fetch initial CSRF token');
       }
     }
     if (cachedCsrfToken) {
       headers.set('csrf-token', cachedCsrfToken);
     }
  }
  
  // Set default timeout signal if not provided
  let signal = options.signal;
  let timeoutId: NodeJS.Timeout | null = null;
  if (!signal) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), DEFAULT_API_TIMEOUT_MS);
    signal = controller.signal;
  }

  // Set credentials to include cookies automatically
  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
    signal
  };

  try {
    let response = await fetch(url, config);
    if (timeoutId) clearTimeout(timeoutId);

    const isAuthRoute = typeof window !== 'undefined' && (
      window.location.pathname.startsWith('/auth') ||
      window.location.pathname.startsWith('/setup')
    );
    const hasLocalToken = typeof window !== 'undefined' && Boolean(
      localStorage.getItem('token') ||
      document.cookie.includes('token=') ||
      document.cookie.includes('access_token=')
    );

    // If 401 Unauthorized, attempt Silent Refresh ONLY if there is an existing session and we're not on auth routes
    if (
      response.status === 401 &&
      hasLocalToken &&
      !isAuthRoute &&
      !(options as any)._retry &&
      !url.includes('/api/auth/refresh') &&
      !url.includes('/api/auth/login')
    ) {
      (options as any)._retry = true;
      
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            const refreshController = new AbortController();
            const refreshTimer = setTimeout(() => refreshController.abort(), 5000);

            const localToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            const refreshHeaders: Record<string, string> = {
              'Content-Type': 'application/json'
            };
            if (localToken) {
              refreshHeaders['Authorization'] = `Bearer ${localToken}`;
            }

            const refreshRes = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: refreshHeaders,
              body: JSON.stringify({}),
              credentials: 'include',
              signal: refreshController.signal
            });
            
            clearTimeout(refreshTimer);

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.accessToken && typeof window !== 'undefined') {
                const MAX_AGE = 15 * 60; // 15 mins
                localStorage.setItem('token', refreshData.accessToken);
                document.cookie = `token=${refreshData.accessToken}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
                document.cookie = `access_token=${refreshData.accessToken}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
              }
              return true;
            } else {
              // Refresh failed, clear session and redirect to login
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                document.cookie = 'token=; Max-Age=0; path=/;';
                document.cookie = 'access_token=; Max-Age=0; path=/;';
                window.location.href = '/auth/login';
              }
              return false;
            }
          } catch (e) {
            console.warn('Silent refresh error:', e);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              window.location.href = '/auth/login';
            }
            return false;
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }
        })();
      }

      const refreshed = await refreshPromise;
      if (refreshed) {
        const newLocalToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (newLocalToken) {
          headers.set('Authorization', `Bearer ${newLocalToken}`);
        }
        (config as any)._retry = true;
        response = await fetch(url, { ...config, headers });
      }
    }

    return response;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}
