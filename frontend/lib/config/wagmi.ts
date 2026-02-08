import { http, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Get WalletConnect Project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Create wagmi config
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({ projectId, showQrModal: false }),
  ],
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
