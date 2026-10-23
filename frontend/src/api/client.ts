const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Authorization'] = `Bearer ${token}`;
    headers['X-Auth-Token'] = token;
  }

  const agencyKey = sessionStorage.getItem('agency_access_key');
  if (agencyKey) {
    headers['X-Agency-Key'] = agencyKey;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    let details;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error || errorMsg;
      details = errorJson.details;
    } catch {
      // Non-JSON response
    }

    // Handle token expiration or unauthorized (401)
    if (response.status === 401) {
      const isAuthRoute =
        endpoint.includes('/auth/login') ||
        endpoint.includes('/auth/force-reset-password');
      if (!isAuthRoute) {
        console.warn('Session expired or unauthorized (401) on:', endpoint);
        localStorage.removeItem('token');
        window.dispatchEvent(
          new CustomEvent('auth:expired', { detail: { message: errorMsg } })
        );
      }
    }

    throw new ApiError(errorMsg, response.status, details);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, {
      method: 'POST',
      body: formData,
    }),
};
