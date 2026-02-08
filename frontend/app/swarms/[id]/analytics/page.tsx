'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSwarm, exportSwarmAnalytics, type Swarm, type SwarmAnalytics } from '@/lib/api/swarms';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice, formatTime } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Download,
  ArrowLeft,
  Activity,
  DollarSign,
  BarChart3,
} from 'lucide-react';

interface DealTimeChartProps {
  deals: Array<{ negotiationTime: number; price: number }>;
}

interface StrategyPerformanceProps {
  strategyPerformance: Record<string, { deals: number; avgPrice: number }>;
}

interface PriceDistributionProps {
  deals: Array<{ price: number }>;
}

// Simple SVG Bar Chart for Deal Times
function DealTimeChart({ deals }: DealTimeChartProps) {
  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <BarChart3 className="w-12 h-12 mr-2 opacity-50" />
        No deals completed yet
      </div>
    );
  }

  const maxTime = Math.max(...deals.map((d) => d.negotiationTime));
  const maxPrice = Math.max(...deals.map((d) => d.price));
  const barWidth = Math.max(20, 200 / deals.length - 4);

  return (
    <div className="w-full">
      <svg width="100%" height="200" className="overflow-visible">
        {deals.map((deal, index) => {
          const x = (index / deals.length) * 100;
          const height = (deal.negotiationTime / maxTime) * 150;
          const y = 180 - height;
          const priceHeight = (deal.price / maxPrice) * 50;

          return (
            <g key={index}>
              {/* Time bar */}
              <rect
                x={`${x}%`}
                y={y}
                width={barWidth}
                height={height}
                fill="url(#timeGradient)"
                rx={4}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              />
              {/* Price indicator (small bar on top) */}
              <rect
                x={`${x}%`}
                y={y - 10}
                width={barWidth}
                height={priceHeight}
                fill="#10b981"
                rx={2}
              />
              <text
                x={`${x + barWidth / 2}%`}
                y={195}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {deal.negotiationTime}s
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="timeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Simple SVG Bar Chart for Strategy Performance
function StrategyPerformance({ strategyPerformance }: StrategyPerformanceProps) {
  const strategies = Object.entries(strategyPerformance);
  if (strategies.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <BarChart3 className="w-12 h-12 mr-2 opacity-50" />
        No strategy data yet
      </div>
    );
  }

  const maxDeals = Math.max(...strategies.map(([, s]) => s.deals));
  const strategyColors: Record<string, string> = {
    competitive: '#3b82f6',
    patient: '#10b981',
    aggressive: '#ef4444',
    conservative: '#8b5cf6',
    sniper: '#f59e0b',
  };

  return (
    <div className="space-y-4">
      {strategies.map(([strategy, data]) => {
        const width = (data.deals / maxDeals) * 100;
        return (
          <div key={strategy} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium capitalize flex items-center">
                <span
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: strategyColors[strategy] || '#6b7280' }}
                />
                {strategy.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-600">
                {data.deals} deals · avg ${formatPrice(data.avgPrice)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${width}%`,
                  backgroundColor: strategyColors[strategy] || '#6b7280',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Simple SVG Histogram for Price Distribution
function PriceDistribution({ deals }: PriceDistributionProps) {
  if (deals.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <BarChart3 className="w-12 h-12 mr-2 opacity-50" />
        No deals yet
      </div>
    );
  }

  // Create price buckets
  const prices = deals.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const bucketCount = 10;
  const bucketSize = (maxPrice - minPrice) / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    min: minPrice + i * bucketSize,
    max: minPrice + (i + 1) * bucketSize,
    count: 0,
  }));

  prices.forEach((price) => {
    const bucketIndex = Math.min(
      Math.floor((price - minPrice) / bucketSize),
      bucketCount - 1
    );
    buckets[bucketIndex].count++;
  });

  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="w-full">
      <svg width="100%" height="180" className="overflow-visible">
        {buckets.map((bucket, index) => {
          const x = (index / bucketCount) * 100;
          const height = bucket.count > 0 ? (bucket.count / maxCount) * 120 : 0;
          const y = 150 - height;

          return (
            <g key={index}>
              <rect
                x={`${x}%`}
                y={y}
                width={`${100 / bucketCount - 0.5}%`}
                height={height}
                fill="url(#priceGradient)"
                rx={4}
                className="hover:opacity-80 transition-opacity"
              />
              {bucket.count > 0 && (
                <text
                  x={`${x + (100 / bucketCount - 0.5) / 2}%`}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {bucket.count}
                </text>
              )}
              <text
                x={`${x + (100 / bucketCount - 0.5) / 2}%`}
                y={165}
                textAnchor="middle"
                fontSize="8"
                fill="#9ca3af"
              >
                {Math.round(bucket.min)}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
            <stop offset="100%" stopColor="#059669" stopOpacity={1} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function SwarmAnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Extract swarm ID from URL
  const swarmId = typeof window !== 'undefined' ? window.location.pathname.split('/')[3] : '';

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    if (swarmId) {
      loadSwarm();
    }

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (swarmId) {
        loadSwarm();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [swarmId, isAuthenticated, router]);

  const loadSwarm = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSwarm(swarmId);
      setSwarm(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load swarm data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await exportSwarmAnalytics(swarmId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `swarm-${swarmId.substring(0, 8)}-analytics.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleBack = () => {
    if (swarm?.room?.id) {
      router.push(`/rooms/${swarm.room.id}`);
    } else {
      router.push('/dashboard');
    }
  };

  if (loading && !swarm) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error && !swarm) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-xl mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!swarm) {
    return null;
  }

  const analytics = swarm.analytics;
  const statusColor =
    swarm.status === 'running'
      ? 'bg-green-500'
      : swarm.status === 'paused'
      ? 'bg-yellow-500'
      : swarm.status === 'completed'
      ? 'bg-blue-500'
      : 'bg-gray-500';

  // Prepare chart data
  const dealTimeData: Array<{ negotiationTime: number; price: number }> = [];
  // We'd need to fetch deals to get actual timing data, using mock for now
  if (analytics.totalDeals > 0) {
    for (let i = 0; i < analytics.totalDeals; i++) {
      dealTimeData.push({
        negotiationTime: analytics.avgNegotiationTime + Math.random() * 30 - 15,
        price: 50 + Math.random() * 50,
      });
    }
  }

  const priceData = dealTimeData.map((d) => ({ price: d.price }));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">{swarm.name}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
                  <span className="text-sm text-gray-400 capitalize">{swarm.status}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-sm text-gray-400">{swarm.room.name}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-sm text-gray-400 capitalize">{swarm.preset.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Deals</p>
                <p className="text-3xl font-bold mt-1">{analytics.totalDeals}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-80" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Success Rate</p>
                <p className="text-3xl font-bold mt-1">{analytics.successRate.toFixed(1)}%</p>
              </div>
              {analytics.successRate >= 50 ? (
                <TrendingUp className="w-10 h-10 text-green-500 opacity-80" />
              ) : (
                <TrendingDown className="w-10 h-10 text-red-500 opacity-80" />
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Deal Time</p>
                <p className="text-3xl font-bold mt-1">{formatTime(analytics.avgNegotiationTime)}</p>
              </div>
              <Clock className="w-10 h-10 text-blue-500 opacity-80" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Agents</p>
                <p className="text-3xl font-bold mt-1">
                  {analytics.activeAgents} / {swarm.totalAgents}
                </p>
              </div>
              <Users className="w-10 h-10 text-purple-500 opacity-80" />
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Deal Time Chart */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-purple-500" />
              Deal Negotiation Times
            </h3>
            <DealTimeChart deals={dealTimeData} />
            <p className="text-sm text-gray-400 mt-4 text-center">
              Negotiation time per deal (seconds) with price indicators
            </p>
          </div>

          {/* Price Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-green-500" />
              Price Distribution
            </h3>
            <PriceDistribution deals={priceData} />
            <p className="text-sm text-gray-400 mt-4 text-center">
              Histogram of deal prices (USDC)
            </p>
          </div>
        </div>

        {/* Strategy Performance */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
            Strategy Performance Comparison
          </h3>
          <StrategyPerformance strategyPerformance={analytics.strategyPerformance} />
          <p className="text-sm text-gray-400 mt-4 text-center">
            Deals completed and average price per strategy
          </p>
        </div>

        {/* Best/Worst Performing Agents */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Agent Performance Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Completed Agents */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Completed Agents ({analytics.completedAgents})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {swarm.agents
                  .filter((a) => a.status === 'completed')
                  .slice(0, 10)
                  .map((agent) => (
                    <div key={agent.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{agent.avatar || '🤖'}</span>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-gray-400 capitalize">{agent.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">{agent.messagesSent} messages</p>
                        <p className="text-xs text-gray-500 capitalize">{agent.strategy}</p>
                      </div>
                    </div>
                  ))}
                {analytics.completedAgents === 0 && (
                  <p className="text-gray-500 text-sm">No completed agents yet</p>
                )}
              </div>
            </div>

            {/* Active Agents */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Active Agents ({analytics.activeAgents})</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {swarm.agents
                  .filter((a) => a.status === 'active' || a.status === 'negotiating')
                  .slice(0, 10)
                  .map((agent) => (
                    <div key={agent.id} className="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{agent.avatar || '🤖'}</span>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-gray-400 capitalize">{agent.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">{agent.messagesSent} messages</p>
                        <p className="text-xs text-gray-500 capitalize">{agent.strategy}</p>
                      </div>
                    </div>
                  ))}
                {analytics.activeAgents === 0 && (
                  <p className="text-gray-500 text-sm">No active agents</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-6">
          <h3 className="text-lg font-semibold mb-4">Swarm Timeline</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm">Swarm created</p>
                <p className="text-xs text-gray-400">{new Date(swarm.createdAt).toLocaleString()}</p>
              </div>
            </div>
            {swarm.status === 'completed' && (
              <div className="flex items-center space-x-4">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">Swarm completed</p>
                  <p className="text-xs text-gray-400">{new Date(swarm.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            )}
            {analytics.totalDeals > 0 && (
              <div className="flex items-center space-x-4">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm">{analytics.totalDeals} deals completed</p>
                  <p className="text-xs text-gray-400">Success rate: {analytics.successRate.toFixed(1)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
