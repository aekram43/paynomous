'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { getMyAgents, deleteAgent, type Agent } from '@/lib/api/agents';
import { getMyDeals, type Deal } from '@/lib/api/deals';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Pause,
  Play,
  Filter,
  ChevronDown,
  Home,
  User,
  Lock,
} from 'lucide-react';

interface Analytics {
  totalDeals: number;
  successRate: number;
  avgNegotiationTime: number;
  activeAgents: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalDeals: 0,
    successRate: 0,
    avgNegotiationTime: 0,
    activeAgents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'agents' | 'deals' | 'analytics'>('agents');
  const [agentStatusFilter, setAgentStatusFilter] = useState<string>('all');
  const [dealStatusFilter, setDealStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    filterAgents();
  }, [agents, agentStatusFilter]);

  useEffect(() => {
    filterDeals();
  }, [deals, dealStatusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchDeals()]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    const { agents: agentsData } = await getMyAgents();
    setAgents(agentsData);
  };

  const fetchDeals = async () => {
    const { deals: dealsData } = await getMyDeals();
    setDeals(dealsData);
  };

  const filterAgents = () => {
    let filtered = agents;
    if (agentStatusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === agentStatusFilter);
    }
    setFilteredAgents(filtered);
  };

  const filterDeals = () => {
    let filtered = deals;
    if (dealStatusFilter !== 'all') {
      filtered = filtered.filter((d) => d.status === dealStatusFilter);
    }
    setFilteredDeals(filtered);
  };

  const calculateAnalytics = () => {
    const completedDeals = deals.filter((d) => d.status === 'completed');
    const totalDeals = deals.length;
    const successRate = totalDeals > 0 ? (completedDeals.length / totalDeals) * 100 : 0;

    // Calculate average negotiation time
    const dealsWithTime = completedDeals.filter((d) => d.completedAt);
    const avgTime =
      dealsWithTime.length > 0
        ? dealsWithTime.reduce((sum, d) => {
            const time = new Date(d.completedAt!).getTime() - new Date(d.createdAt).getTime();
            return sum + time;
          }, 0) / dealsWithTime.length
        : 0;

    const activeAgentsCount = agents.filter((a) =>
      ['active', 'negotiating', 'deal_locked'].includes(a.status)
    ).length;

    setAnalytics({
      totalDeals,
      successRate,
      avgNegotiationTime: avgTime,
      activeAgents: activeAgentsCount,
    });
  };

  useEffect(() => {
    calculateAnalytics();
  }, [agents, deals]);

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;

    try {
      await deleteAgent(agentId);
      await fetchAgents();
    } catch (err: any) {
      alert(err.message || 'Failed to delete agent');
    }
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getAgentStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      active: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Active' },
      negotiating: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Negotiating' },
      deal_locked: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'Deal Locked' },
      completed: { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', label: 'Completed' },
    };
    const badge = badges[status] || badges.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getDealStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: any }> = {
      locked: { color: 'bg-yellow-500/10 text-yellow-400', label: 'Locked', icon: Lock },
      verifying: { color: 'bg-blue-500/10 text-blue-400', label: 'Verifying', icon: AlertCircle },
      completed: { color: 'bg-green-500/10 text-green-400', label: 'Completed', icon: CheckCircle },
      failed: { color: 'bg-red-500/10 text-red-400', label: 'Failed', icon: XCircle },
    };
    const badge = badges[status] || badges.locked;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <User className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-200 mb-2">Authentication Required</h2>
          <p className="text-gray-400">Please connect your wallet to access the dashboard</p>
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
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-400">Manage your agents and track your trading activity</p>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <AnalyticsCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Total Deals"
            value={analytics.totalDeals.toString()}
            color="purple"
          />
          <AnalyticsCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Success Rate"
            value={`${analytics.successRate.toFixed(0)}%`}
            color="green"
          />
          <AnalyticsCard
            icon={<Clock className="w-5 h-5" />}
            label="Avg. Deal Time"
            value={formatTime(analytics.avgNegotiationTime)}
            color="blue"
          />
          <AnalyticsCard
            icon={<Wallet className="w-5 h-5" />}
            label="Active Agents"
            value={analytics.activeAgents.toString()}
            color="orange"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-gray-800">
          <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')}>
            My Agents ({filteredAgents.length})
          </TabButton>
          <TabButton active={activeTab === 'deals'} onClick={() => setActiveTab('deals')}>
            Deal History ({filteredDeals.length})
          </TabButton>
          <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
            Analytics
          </TabButton>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400">Loading dashboard...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={fetchData} variant="default">
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Agents Tab */}
            {activeTab === 'agents' && (
              <AgentsTab
                agents={filteredAgents}
                statusFilter={agentStatusFilter}
                setStatusFilter={setAgentStatusFilter}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                onDeleteAgent={handleDeleteAgent}
                onNavigateToRoom={(roomId) => router.push(`/rooms/${roomId}`)}
                formatPrice={formatPrice}
                getStatusBadge={getAgentStatusBadge}
              />
            )}

            {/* Deals Tab */}
            {activeTab === 'deals' && (
              <DealsTab
                deals={filteredDeals}
                statusFilter={dealStatusFilter}
                setStatusFilter={setDealStatusFilter}
                showFilters={showFilters}
                setShowFilters={setShowFilters}
                formatPrice={formatPrice}
                getStatusBadge={getDealStatusBadge}
              />
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <AnalyticsTab
                analytics={analytics}
                deals={deals}
                formatPrice={formatPrice}
                formatTime={formatTime}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Analytics Card Component
interface AnalyticsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'purple' | 'green' | 'blue' | 'orange';
}

function AnalyticsCard({ icon, label, value, color }: AnalyticsCardProps) {
  const colors = {
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  };

  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
        active
          ? 'border-purple-500 text-purple-400'
          : 'border-transparent text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

// Agents Tab Component
interface AgentsTabProps {
  agents: Agent[];
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  onDeleteAgent: (agentId: string) => void;
  onNavigateToRoom: (roomId: string) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function AgentsTab({
  agents,
  statusFilter,
  setStatusFilter,
  showFilters,
  setShowFilters,
  onDeleteAgent,
  onNavigateToRoom,
  formatPrice,
  getStatusBadge,
}: AgentsTabProps) {
  return (
    <div>
      {/* Filters */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="mt-4 flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="negotiating">Negotiating</option>
              <option value="deal_locked">Deal Locked</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
      </div>

      {/* Agents Grid */}
      {agents.length === 0 ? (
        <EmptyState
          icon={<User className="w-16 h-16" />}
          title="No agents found"
          description="You haven't spawned any agents yet"
          actionLabel="Browse Rooms"
          onAction={() => (window.location.href = '/rooms')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={onDeleteAgent}
              onNavigateToRoom={onNavigateToRoom}
              formatPrice={formatPrice}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Agent Card Component
interface AgentCardProps {
  agent: Agent;
  onDelete: (agentId: string) => void;
  onNavigateToRoom: (roomId: string) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function AgentCard({ agent, onDelete, onNavigateToRoom, formatPrice, getStatusBadge }: AgentCardProps) {
  const canDelete = ['active', 'negotiating'].includes(agent.status);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-purple-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.avatar || '🤖'}</span>
          <div>
            <h3 className="font-semibold text-gray-100">{agent.name}</h3>
            <p className="text-sm text-gray-400">
              {agent.role === 'buyer' ? '💰 Buyer' : '🎨 Seller'}
            </p>
          </div>
        </div>
        {getStatusBadge(agent.status)}
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Room</span>
          <button
            onClick={() => onNavigateToRoom(agent.roomId)}
            className="text-purple-400 hover:text-purple-300"
          >
            {agent.room.name}
          </button>
        </div>
        {agent.nft && (
          <div className="flex justify-between">
            <span className="text-gray-400">NFT</span>
            <span className="text-gray-200">{agent.nft.name}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Current Price</span>
          <span className="text-gray-200">{formatPrice(agent.startingPrice)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Messages Sent</span>
          <span className="text-gray-200">{agent.messagesSent}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Strategy</span>
          <span className="text-gray-200 capitalize">{agent.strategy}</span>
        </div>
      </div>

      {/* Actions */}
      {canDelete && (
        <button
          onClick={() => onDelete(agent.id)}
          className="w-full px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Agent
        </button>
      )}
    </div>
  );
}

// Deals Tab Component
interface DealsTabProps {
  deals: Deal[];
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function DealsTab({
  deals,
  statusFilter,
  setStatusFilter,
  showFilters,
  setShowFilters,
  formatPrice,
  getStatusBadge,
}: DealsTabProps) {
  return (
    <div>
      {/* Filters */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
          <div className="mt-4 flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="locked">Locked</option>
              <option value="verifying">Verifying</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        )}
      </div>

      {/* Deals List */}
      {deals.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-16 h-16" />}
          title="No deals found"
          description="Completed deals will appear here"
        />
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} formatPrice={formatPrice} getStatusBadge={getStatusBadge} />
          ))}
        </div>
      )}
    </div>
  );
}

// Deal Card Component
interface DealCardProps {
  deal: Deal;
  formatPrice: (price: number) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function DealCard({ deal, formatPrice, getStatusBadge }: DealCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 hover:border-purple-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {getStatusBadge(deal.status)}
            <span className="text-sm text-gray-400">
              {new Date(deal.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-semibold text-gray-100">{deal.nft.collection}</h3>
          <p className="text-sm text-gray-400">Token #{deal.nft.tokenId}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{formatPrice(deal.price)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-400 mb-1">Buyer</p>
          <p className="text-gray-200">{deal.buyer.agent}</p>
          <p className="text-xs text-gray-500">{deal.buyer.wallet.slice(0, 10)}...</p>
        </div>
        <div>
          <p className="text-gray-400 mb-1">Seller</p>
          <p className="text-gray-200">{deal.seller.agent}</p>
          <p className="text-xs text-gray-500">{deal.seller.wallet.slice(0, 10)}...</p>
        </div>
      </div>

      {deal.txHash && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <a
            href={`${process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL}/tx/${deal.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            View Transaction ↗
          </a>
        </div>
      )}
    </div>
  );
}

// Analytics Tab Component
interface AnalyticsTabProps {
  analytics: Analytics;
  deals: Deal[];
  formatPrice: (price: number) => string;
  formatTime: (ms: number) => string;
}

function AnalyticsTab({ analytics, deals, formatPrice, formatTime }: AnalyticsTabProps) {
  const bestDeals = [...deals]
    .filter((d) => d.status === 'completed')
    .sort((a, b) => b.price - a.price)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Performance Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Deals</span>
              <span className="text-gray-200 font-semibold">{analytics.totalDeals}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Success Rate</span>
              <span className="text-green-400 font-semibold">{analytics.successRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg. Negotiation Time</span>
              <span className="text-gray-200 font-semibold">{formatTime(analytics.avgNegotiationTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active Agents</span>
              <span className="text-purple-400 font-semibold">{analytics.activeAgents}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Best Deals</h3>
          {bestDeals.length === 0 ? (
            <p className="text-gray-400 text-sm">No completed deals yet</p>
          ) : (
            <div className="space-y-3">
              {bestDeals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-gray-200">{deal.nft.collection}</p>
                    <p className="text-xs text-gray-500">#{deal.nft.tokenId}</p>
                  </div>
                  <span className="text-green-400 font-semibold">{formatPrice(deal.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deals by Status */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Deals by Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['locked', 'verifying', 'completed', 'failed'].map((status) => {
            const count = deals.filter((d) => d.status === status).length;
            const percentage = deals.length > 0 ? (count / deals.length) * 100 : 0;
            return (
              <div key={status} className="text-center">
                <p className="text-2xl font-bold text-gray-200">{count}</p>
                <p className="text-sm text-gray-400 capitalize">{status}</p>
                <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-gray-700 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-300 mb-2">{title}</h3>
      <p className="text-gray-400 mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="default">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
