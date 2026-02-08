'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { getRoom, type RoomDetail } from '@/lib/api/rooms';
import { getNfts, type Nft } from '@/lib/api/nfts';
import { spawnAgent, type Agent, type SpawnAgentRequest } from '@/lib/api/agents';
import { useAuthStore } from '@/lib/store/auth-store';
import { useWebSocket, type RoomStatsUpdate, type AgentMessageData, type AgentJoinedData, type DealLockedData, type DealCompletedData, type AgentLeftData } from '@/lib/hooks/useWebSocket';

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

// Agent status types
interface AgentWithStatus {
  id: string;
  name: string;
  avatar: string | null;
  role: 'buyer' | 'seller';
  status: 'active' | 'negotiating' | 'deal_locked' | 'completed';
  userId: string;
}

interface ChatMessage {
  id: string;
  agent: {
    id: string;
    name: string;
    avatar: string | null;
  };
  message: string;
  timestamp: string;
  priceMentioned?: number;
  intent?: string;
}

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

  // Real-time state
  const [roomStats, setRoomStats] = useState<RoomStatsUpdate | null>(null);
  const [agents, setAgents] = useState<AgentWithStatus[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dealNotification, setDealNotification] = useState<{
    type: 'locked' | 'verifying' | 'completed' | 'error';
    data: DealLockedData | DealCompletedData | { dealId: string; error: string; txHash?: string; blockNumber?: number; nft?: { name: string; collection: string } };
    verifyingProgress?: { stage: string; progress: number };
  } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedDeals, setCompletedDeals] = useState<DealCompletedData[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setAutoScroll(isNearBottom);
  }, []);

  // WebSocket callbacks
  const wsCallbacks = {
    onRoomStats: (data: RoomStatsUpdate) => {
      setRoomStats(data);
    },
    onAgentJoined: (data: AgentJoinedData) => {
      setAgents((prev) => {
        const exists = prev.find((a) => a.id === data.agent.id);
        if (exists) return prev;
        return [...prev, {
          id: data.agent.id,
          name: data.agent.name,
          avatar: data.agent.avatar,
          role: data.agent.role,
          status: 'active',
          userId: user?.id || '',
        }];
      });
    },
    onAgentMessage: (data: AgentMessageData) => {
      const newMessage: ChatMessage = {
        id: `${data.agent.id}-${Date.now()}`,
        agent: data.agent,
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      // Highlight price mentions
      const priceMatch = data.message.match(/\d+(?:\.\d{1,2})?/);
      if (priceMatch) {
        setMessages((prev) => prev.map((m) =>
          m.id === newMessage.id
            ? { ...m, priceMentioned: parseFloat(priceMatch[0]) }
            : m
        ));
      }
    },
    onDealLocked: (data: DealLockedData) => {
      setDealNotification({ type: 'locked', data });
      // Update agent statuses to deal_locked
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === data.buyerAgent.id || agent.id === data.sellerAgent.id
            ? { ...agent, status: 'deal_locked' as const }
            : agent
        )
      );
    },
    onDealVerifying: (data: { dealId: string; progress: number; stage: string }) => {
      setDealNotification((prev) => {
        if (prev?.type === 'locked' || prev?.type === 'verifying') {
          return {
            type: 'verifying',
            data: prev.data,
            verifyingProgress: { stage: data.stage, progress: data.progress },
          };
        }
        return prev;
      });
    },
    onDealCompleted: (data: DealCompletedData) => {
      setDealNotification({ type: 'completed', data });
      // Trigger confetti animation
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      // Mark agents as completed
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === data.buyer.id || agent.id === data.seller.id
            ? { ...agent, status: 'completed' as const }
            : agent
        )
      );
      // Add to completed deals
      setCompletedDeals((prev) => [...prev, data]);
      // Auto-dismiss notification after 8 seconds
      setTimeout(() => setDealNotification(null), 8000);
    },
    onAgentLeft: (data: AgentLeftData) => {
      setAgents((prev) => prev.filter((a) => a.id !== data.agentId));
    },
    onError: (data: { message: string }) => {
      setDealNotification({
        type: 'error',
        data: { dealId: '', error: data.message },
      });
      setTimeout(() => setDealNotification(null), 5000);
    },
  };

  useWebSocket(roomId, wsCallbacks);

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

      // Initialize room stats
      setRoomStats({
        floorPrice: roomData.floorPrice,
        topBid: roomData.topBid,
        activeAgents: roomData.activeAgents,
        activeBuyers: roomData.activeBuyers,
        activeSellers: roomData.activeSellers,
      });

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
    // Add agent to local state
    setAgents((prev) => [...prev, {
      id: agent.id,
      name: agent.name,
      avatar: agent.avatar,
      role: agent.role,
      status: 'active',
      userId: user?.id || '',
    }]);
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
        <div className="mb-6">
          <button
            onClick={() => router.push('/rooms')}
            className="text-gray-400 hover:text-gray-200 mb-4 flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Rooms
          </button>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <span className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-medium text-purple-400 mb-3">
                {room.collection}
              </span>
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                {room.name}
              </h1>
              <p className="text-gray-400">
                {roomStats?.activeAgents || room.activeAgents} active agents
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

        {/* Market Stats Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Floor Price" value={formatPrice(roomStats?.floorPrice || room.floorPrice)} />
          <StatCard label="Top Bid" value={formatPrice(roomStats?.topBid || room.topBid)} />
          <StatCard label="Active Buyers" value={roomStats?.activeBuyers?.toString() || room.activeBuyers.toString()} />
          <StatCard label="Active Sellers" value={roomStats?.activeSellers?.toString() || room.activeSellers.toString()} />
        </div>

        {/* Main Layout: Chat + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chat Window */}
          <div className="lg:col-span-3">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              {/* Chat Header */}
              <div className="bg-gray-900 px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-gray-100">Live Negotiation</h2>
                <p className="text-sm text-gray-400">Watch agents negotiate in real-time</p>
              </div>

              {/* Messages */}
              <div
                className="h-[500px] overflow-y-auto px-6 py-4 space-y-4"
                onScroll={handleScroll}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p>Waiting for messages...</p>
                      <p className="text-sm mt-1">Messages will appear here when agents start negotiating</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Auto-scroll indicator */}
              {!autoScroll && messages.length > 0 && (
                <button
                  onClick={() => {
                    setAutoScroll(true);
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                  Scroll to latest
                </button>
              )}
            </div>
          </div>

          {/* Agent Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-3 border-b border-gray-800">
                <h3 className="font-semibold text-gray-100">Active Agents</h3>
              </div>
              <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
                {agents.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No active agents yet
                  </div>
                ) : (
                  agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Deals */}
        {room.recentDeals.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Recent Deals</h2>
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

        {/* Deal Notification */}
        {dealNotification && (
          <DealNotification notification={dealNotification} />
        )}

        {/* Confetti Celebration */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[100]">
            <Confetti />
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
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-100">{value}</p>
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

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// Chat Message Component
function ChatMessage({ message }: { message: ChatMessage }) {
  const highlightPrice = (text: string): { __html: string } => {
    if (message.priceMentioned) {
      const regex = new RegExp(`\\b${message.priceMentioned}(?:\\.\\d{1,2})?\\b`, 'g');
      return { __html: text.replace(regex, '<span class="text-green-400 font-semibold">$&</span>') };
    }
    return { __html: text };
  };

  return (
    <div className="flex gap-3">
      <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl flex-shrink-0">
        {message.agent.avatar || '🤖'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-medium text-gray-200">{message.agent.name}</span>
          <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
        </div>
        <p className="text-gray-300 break-words" dangerouslySetInnerHTML={highlightPrice(message.message)} />
        {message.intent && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-xs text-purple-300 capitalize">
            {message.intent}
          </span>
        )}
      </div>
    </div>
  );
}

// Agent Card Component
function AgentCard({ agent }: { agent: AgentWithStatus }) {
  const statusConfig = {
    active: { color: 'bg-green-500', label: 'Active' },
    negotiating: { color: 'bg-blue-500', label: 'Negotiating' },
    deal_locked: { color: 'bg-yellow-500', label: 'In Deal' },
    completed: { color: 'bg-gray-500', label: 'Done' },
  };

  const config = statusConfig[agent.status];

  return (
    <div className="p-3 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-xl flex-shrink-0">
          {agent.avatar || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-200 truncate">{agent.name}</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs text-gray-400`}>
              {agent.role === 'buyer' ? '💰' : '🎨'}
              {agent.role}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.color.replace('bg-', 'text-')}`}>
              <span className={`w-1.5 h-1.5 ${config.color} rounded-full`}></span>
              {config.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Deal Notification Component
function DealNotification({ notification }: { notification: { type: 'locked' | 'verifying' | 'completed' | 'error'; data: DealLockedData | DealCompletedData | { dealId: string; error: string }; verifyingProgress?: { stage: string; progress: number } } }) {
  if (notification.type === 'error') {
    const data = notification.data as { dealId: string; error: string };
    return (
      <div className="fixed top-20 right-4 bg-red-900/90 border border-red-700 text-red-100 px-6 py-4 rounded-lg shadow-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-800 rounded-full flex items-center justify-center text-xl">❌</div>
          <div>
            <p className="font-medium">Deal Failed</p>
            <p className="text-sm text-red-200">{data.error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (notification.type === 'locked') {
    const data = notification.data as DealLockedData;
    return (
      <div className="fixed top-20 right-4 bg-yellow-900/90 border border-yellow-700 text-yellow-100 px-6 py-4 rounded-lg shadow-lg animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-800 rounded-full flex items-center justify-center text-xl">🔒</div>
          <div>
            <p className="font-medium">Deal Locked!</p>
            <p className="text-sm text-yellow-200">{data.buyerAgent.name} → {data.sellerAgent.name} ({formatPrice(data.price)})</p>
            <p className="text-xs text-yellow-300 mt-1">Verifying ownership...</p>
          </div>
        </div>
      </div>
    );
  }

  if (notification.type === 'verifying') {
    const stages = [
      { key: 'ownership', label: 'Ownership', icon: '🔐' },
      { key: 'balance', label: 'Balance', icon: '💰' },
      { key: 'consensus', label: 'Consensus', icon: '🤝' },
      { key: 'execution', label: 'Execution', icon: '⚡' },
    ];
    const currentStageIndex = stages.findIndex((s) => s.key === notification.verifyingProgress?.stage);

    return (
      <div className="fixed top-20 right-4 bg-blue-900/90 border border-blue-700 text-blue-100 px-6 py-4 rounded-lg shadow-lg max-w-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center text-xl animate-spin">⚙️</div>
          <div>
            <p className="font-medium">Verifying Deal...</p>
            <p className="text-sm text-blue-200">{notification.verifyingProgress?.stage || 'Processing'}</p>
          </div>
        </div>
        <div className="w-full bg-blue-950 rounded-full h-2 mb-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${notification.verifyingProgress?.progress || 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className={`flex flex-col items-center ${
                index <= currentStageIndex ? 'text-blue-200' : 'text-blue-400'
              }`}
            >
              <span className="text-lg">{stage.icon}</span>
              <span className="mt-1">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const data = notification.data as DealCompletedData;
  const blockExplorerUrl = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://ark-testnet.explorer';
  const txHashUrl = `${blockExplorerUrl}/tx/${data.txHash}`;

  return (
    <div className="fixed top-20 right-4 bg-green-900/90 border border-green-700 text-green-100 px-6 py-4 rounded-lg shadow-lg max-w-sm animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-green-800 rounded-full flex items-center justify-center text-xl">✅</div>
        <div>
          <p className="font-medium">Deal Completed!</p>
          <p className="text-sm text-green-200">{data.nft.name} sold for {formatPrice(data.price)}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-green-300">Buyer:</span>
          <span className="font-medium">{data.buyer.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-green-300">Seller:</span>
          <span className="font-medium">{data.seller.name}</span>
        </div>
        <div className="pt-2 border-t border-green-700">
          <a
            href={txHashUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-green-200 hover:text-green-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="font-mono text-xs truncate">{data.txHash.slice(0, 10)}...{data.txHash.slice(-8)}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// Confetti Component
function Confetti() {
  const colors = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6'];

  return (
    <>
      <style jsx>{`
        @keyframes fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
      `}</style>
      {Array.from({ length: 50 }, (_, i) => (
        <div
          key={i}
          className="animate-fall absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-20px',
            width: 5 + Math.random() * 10,
            height: 5 + Math.random() * 10,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        />
      ))}
    </>
  );
}

// Spawn Agent Modal Component (same as before, keeping it here for completeness)
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
                  onClick={() => setFormData({ ...formData, strategy: strategy.value as typeof formData.strategy })}
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
                  onClick={() => setFormData({ ...formData, personality: personality.value as typeof formData.personality })}
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
