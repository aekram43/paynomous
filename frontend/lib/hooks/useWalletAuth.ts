'use client';

import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { getChallenge, verifySignature, getCurrentUser } from '@/lib/api/auth';

export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { setAuth, clearAuth, isAuthenticated, user } = useAuthStore();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticate with wallet signature
  const authenticate = useCallback(async () => {
    if (!address) {
      setError('No wallet connected');
      return false;
    }

    setIsPending(true);
    setError(null);

    try {
      // Step 1: Get challenge from backend
      const { message, nonce } = await getChallenge(address);

      // Step 2: Sign message with wallet
      const signature = await signMessageAsync({ message });

      // Step 3: Verify signature and get tokens
      const response = await verifySignature(address, signature, nonce);

      // Step 4: Store auth data
      setAuth(response.accessToken, response.refreshToken, response.user);

      return true;
    } catch (err: unknown) {
      // User rejected signature
      if (err && typeof err === 'object' && 'name' in err && err.name === 'UserRejectedRequestError') {
        setError('Signature request was rejected');
      } else {
        setError(typeof err === 'string' ? err : 'Authentication failed');
      }
      return false;
    } finally {
      setIsPending(false);
    }
  }, [address, signMessageAsync, setAuth]);

  // Disconnect wallet and clear auth
  const disconnectWallet = useCallback(async () => {
    try {
      await disconnect();
      clearAuth();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  }, [disconnect, clearAuth]);

  // Auto-authenticate when wallet connects and not already authenticated
  useEffect(() => {
    if (isConnected && address && !isAuthenticated) {
      authenticate();
    }
  }, [isConnected, address, isAuthenticated, authenticate]);

  // Verify existing token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (isAuthenticated && user) {
        try {
          await getCurrentUser(useAuthStore.getState().accessToken || '');
        } catch {
          // Token invalid, clear auth
          clearAuth();
        }
      }
    };

    verifyToken();
  }, [isAuthenticated, user, clearAuth]);

  return {
    isAuthenticated,
    user,
    address,
    isConnected,
    isPending,
    error,
    authenticate,
    disconnect: disconnectWallet,
  };
}
