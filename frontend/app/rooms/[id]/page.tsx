'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { getRoom, type RoomDetail } from '@/lib/api/rooms';
import { getNfts, type Nft } from '@/lib/api/nfts';
import { spawnAgent, type Agent, type SpawnAgentRequest } from '@/lib/api/agents';
import { useAuthStore } from '@/lib/store/auth-store';

const AVATARS = ['🤖', '🦊', '🐸', '🦄', '🐲', '👾', '🎭', '🦸', '🧙', '🚀'];

const STRATEGIES: Array<{
  value: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper';
  label: string;
  description: string;
}> = [
  { value: 'competitive', label: 'Competitive', description: 'React quickly to market changes' },
  { value: 'patient', label: 'Patient', description: 'Wait for the best offers' },
  { value: 'aggressive', label: 'Aggressive', description: 'Close deals fast with bold moves' },
  { value: 'conservative', label: 'Conservative', description: 'Start cautious and adjust slowly' },
  { value: 'sniper', label: 'Sniper', description: 'Watch quietly and strike at the right moment' },
];

const PERSONALITIES: Array<{
  value: 'formal' | 'casual' | 'professional' | 'aggressive';
  label: string;
  description: string;
}> = [
  { value: 'formal', label: 'Formal', description: 'Professional and polite' },
  { value: 'casual', label: 'Casual', description: 'Friendly and approachable' },
  { value: 'professional', label: 'Professional', description: 'Direct and business-focused' },
  { value: 'aggressive', label: 'Aggressive', description: 'Bold and assertive' },
];

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [spawnedAgent, setSpawnedAgent] = useState<Agent | null>(null);
  const [userNfts, setUserNfts] = useState<Nft[]>([]);

  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  const fetchRoom = async () => {
    try {
      setLoading(true);
      const { room: roomData } = await getRoom(roomId);
      setRoom(roomData);

      // Fetch user's NFTs for potential seller agents
      if (isAuthenticated) {
        const { nfts } = await getNfts();
        setUserNfts(nfts);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  const handleSpawnAgent = (agent: Agent) => {
    setSpawnedAgent(agent);
    setShowSpawnModal(false);
    // Refresh room data to show the new agent
    fetchRoom();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400">Loading room...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error || 'Room not found'}</p>
            <Button onClick={() => router.push('/rooms')}>Back to Rooms</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/rooms')}
            className="text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Rooms
          </button>
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-medium text-purple-400 mb-3">
                {room.collection}
              </span>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                {room.name}
              </h1>
              <p className="text-gray-400">
                {room.activeBuyers + room.activeSellers} active agents • {room.recentDeals.length} recent deals
              </p>
            </div>
            <Button onClick={() => setShowSpawnModal(true)} size="lg">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Spawn Agent
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Floor Price" value={formatPrice(room.floorPrice)} />
          <StatCard label="Top Bid" value={formatPrice(room.topBid)} />
          <StatCard label="Active Agents" value={room.activeAgents.toString()} />
        </div>

        {/* Recent Deals */}
        {room.recentDeals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-100 mb-4">Recent Deals</h2>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {room.recentDeals.map((deal) => (
                <div key={deal.id} className="p-4 border-b border-gray-800 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-200 font-medium">{deal.nft.name}</p>
                      <p className="text-sm text-gray-400">{deal.nft.collection}</p>
                    </div>
                    <p className="text-lg font-semibold text-green-400">{formatPrice(deal.finalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spawned Agent Success */}
        {spawnedAgent && (
          <div className="fixed bottom-4 right-4 bg-green-900/90 border border-green-700 text-green-100 px-6 py-4 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center text-xl">
                {spawnedAgent.avatar || '🤖'}
              </div>
              <div>
                <p className="font-medium">Agent spawned successfully!</p>
                <p className="text-sm text-green-200">{spawnedAgent.name} is now negotiating</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spawn Agent Modal */}
      {showSpawnModal && (
        <SpawnAgentModal
          room={room}
          userNfts={userNfts}
          onClose={() => setShowSpawnModal(false)}
          onSpawn={handleSpawnAgent}
        />
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
    </div>
  );
}

function formatPrice(price: number): string {
  if (price === 0) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

// Spawn Agent Modal Component
interface SpawnAgentModalProps {
  room: RoomDetail;
  userNfts: Nft[];
  onClose: () => void;
  onSpawn: (agent: Agent) => void;
}

function SpawnAgentModal({ room, userNfts, onClose, onSpawn }: SpawnAgentModalProps) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [formData, setFormData] = useState<{
    name: string;
    avatar: string;
    role: 'buyer' | 'seller';
    nftId: string;
    minPrice: string;
    maxPrice: string;
    startingPrice: string;
    strategy: 'competitive' | 'patient' | 'aggressive' | 'conservative' | 'sniper';
    personality: 'formal' | 'casual' | 'professional' | 'aggressive';
  }>({
    name: '',
    avatar: AVATARS[0],
    role: 'buyer',
    nftId: '',
    minPrice: '',
    maxPrice: '',
    startingPrice: '',
    strategy: 'competitive',
    personality: 'formal',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedNft = userNfts.find((n) => n.id === formData.nftId);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    }
    if (formData.role === 'seller' && !formData.nftId) {
      newErrors.nftId = 'Please select an NFT to sell';
    }
    const minPrice = parseFloat(formData.minPrice);
    const maxPrice = parseFloat(formData.maxPrice);
    const startingPrice = parseFloat(formData.startingPrice);

    if (isNaN(minPrice) || minPrice < 0) {
      newErrors.minPrice = 'Valid minimum price is required';
    }
    if (isNaN(maxPrice) || maxPrice < 0) {
      newErrors.maxPrice = 'Valid maximum price is required';
    }
    if (isNaN(startingPrice) || startingPrice < 0) {
      newErrors.startingPrice = 'Valid starting price is required';
    }
    if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > maxPrice) {
      newErrors.minPrice = 'Minimum price cannot exceed maximum price';
    }
    if (formData.role === 'buyer') {
      if (!isNaN(startingPrice) && !isNaN(maxPrice) && startingPrice > maxPrice) {
        newErrors.startingPrice = 'Starting price cannot exceed maximum for buyers';
      }
    } else {
      if (!isNaN(startingPrice) && !isNaN(minPrice) && startingPrice < minPrice) {
        newErrors.startingPrice = 'Starting price cannot be below minimum for sellers';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      router.push('/');
      onClose();
      return;
    }

    if (!validateForm()) return;

    try {
      setLoading(true);

      const spawnData: SpawnAgentRequest = {
        roomId: room.id,
        name: formData.name.trim(),
        avatar: formData.avatar,
        role: formData.role,
        nftId: formData.role === 'seller' ? formData.nftId : undefined,
        minPrice: parseFloat(formData.minPrice),
        maxPrice: parseFloat(formData.maxPrice),
        startingPrice: parseFloat(formData.startingPrice),
        strategy: formData.strategy,
        personality: formData.personality,
      };

      const { agent } = await spawnAgent(spawnData);
      onSpawn(agent);
    } catch (err: any) {
      setErrors({ form: err.response?.data?.message || err.message || 'Failed to spawn agent' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-100">Spawn AI Agent</h2>
              <p className="text-gray-400">Create an agent to negotiate on your behalf</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.form && (
            <div className="bg-red-900/20 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
              {errors.form}
            </div>
          )}

          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Agent Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Trader Joe"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Avatar Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Avatar
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar })}
                  className={`w-12 h-12 text-2xl rounded-lg border-2 transition-all ${
                    formData.avatar === avatar
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'buyer' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.role === 'buyer'
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">💰</div>
                <div className="font-medium text-gray-200">Buyer</div>
                <div className="text-sm text-gray-400">Looking to purchase NFTs</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'seller' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.role === 'seller'
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-2">🎨</div>
                <div className="font-medium text-gray-200">Seller</div>
                <div className="text-sm text-gray-400">Selling NFTs from collection</div>
              </button>
            </div>
          </div>

          {/* NFT Selection (for sellers) */}
          {formData.role === 'seller' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select NFT to Sell *
              </label>
              {userNfts.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                  <p className="text-gray-400">No NFTs available. Make sure you own NFTs from this collection.</p>
                </div>
              ) : (
                <select
                  value={formData.nftId}
                  onChange={(e) => setFormData({ ...formData, nftId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select an NFT</option>
                  {userNfts.map((nft) => (
                    <option key={nft.id} value={nft.id}>
                      {nft.name} ({nft.collection})
                    </option>
                  ))}
                </select>
              )}
              {errors.nftId && <p className="text-red-400 text-sm mt-1">{errors.nftId}</p>}
              {selectedNft && (
                <div className="mt-2 bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    {selectedNft.imageUrl ? (
                      <img src={selectedNft.imageUrl} alt={selectedNft.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-2xl">🖼️</span>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-200 font-medium">{selectedNft.name}</p>
                    <p className="text-sm text-gray-400">{selectedNft.collection}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Price Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {formData.role === 'seller' ? 'Min Acceptable *' : 'Min Price *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                  placeholder="50"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {errors.minPrice && <p className="text-red-400 text-sm mt-1">{errors.minPrice}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {formData.role === 'buyer' ? 'Max Willing *' : 'Asking Price *'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                  placeholder="100"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {errors.maxPrice && <p className="text-red-400 text-sm mt-1">{errors.maxPrice}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Starting Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={formData.startingPrice}
                  onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })}
                  placeholder="75"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {errors.startingPrice && <p className="text-red-400 text-sm mt-1">{errors.startingPrice}</p>}
            </div>
          </div>

          {/* Strategy Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Trading Strategy *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STRATEGIES.map((strategy) => (
                <button
                  key={strategy.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, strategy: strategy.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    formData.strategy === strategy.value
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-gray-200">{strategy.label}</div>
                  <div className="text-sm text-gray-400">{strategy.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Personality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Communication Style *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PERSONALITIES.map((personality) => (
                <button
                  key={personality.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, personality: personality.value })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    formData.personality === personality.value
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-gray-200">{personality.label}</div>
                  <div className="text-sm text-gray-400">{personality.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Spawning...
                </>
              ) : (
                'Spawn Agent'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
