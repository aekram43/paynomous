import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ChallengeResponse {
  message: string;
  nonce: string;
}

export interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    walletAddress: string;
    createdAt: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
}

export interface MeResponse {
  user: {
    id: string;
    walletAddress: string;
    createdAt: string;
  };
}

// Get authentication challenge
export async function getChallenge(walletAddress: string): Promise<ChallengeResponse> {
  const response = await axios.post(`${API_URL}/auth/challenge`, { walletAddress });
  return response.data;
}

// Verify signature and get tokens
export async function verifySignature(
  walletAddress: string,
  signature: string,
  nonce: string
): Promise<VerifyResponse> {
  const response = await axios.post(`${API_URL}/auth/verify`, {
    walletAddress,
    signature,
    nonce,
  });
  return response.data;
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  return response.data;
}

// Get current user
export async function getCurrentUser(accessToken: string): Promise<MeResponse> {
  const response = await axios.get(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
}

// Create axios instance with auth interceptor
export const apiClient = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('agentrooms-auth');
    if (token) {
      const auth = JSON.parse(token);
      if (auth.state.accessToken) {
        config.headers.Authorization = `Bearer ${auth.state.accessToken}`;
      }
    }
  }
  return config;
});

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('agentrooms-auth');
        if (token) {
          const auth = JSON.parse(token);
          if (auth.state.refreshToken) {
            try {
              const { accessToken } = await refreshAccessToken(auth.state.refreshToken);
              auth.state.accessToken = accessToken;
              localStorage.setItem('agentrooms-auth', JSON.stringify(auth));
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return apiClient(originalRequest);
            } catch (refreshError) {
              // Refresh failed, clear auth
              localStorage.removeItem('agentrooms-auth');
              window.location.href = '/';
            }
          }
        }
      }
    }

    return Promise.reject(error);
  }
);
