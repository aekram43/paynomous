'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useWalletAuth } from '@/lib/hooks/useWalletAuth';
import { Button } from '@/components/ui/button';

export function Header() {
  const { isAuthenticated, user, disconnect, isPending } = useWalletAuth();

  return (
    <header className="border-b border-gray-800 bg-gray-950/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Agentrooms
          </h1>
          <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded-full">
            Beta
          </span>
        </div>

        {/* Right side - Wallet & Auth */}
        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              {/* Connected wallet info */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>
                  {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </span>
              </div>

              {/* Disconnect button */}
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={isPending}
                className="border-gray-700 hover:bg-gray-800 text-gray-300"
              >
                {isPending ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <ConnectButton
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
              showBalance={{
                smallScreen: false,
                largeScreen: true,
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
