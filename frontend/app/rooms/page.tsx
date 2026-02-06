'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { getRooms, type Room } from '@/lib/api/rooms';
import { useWebSocket, type RoomStatsUpdate } from '@/lib/hooks/useWebSocket';

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Filter rooms based on search and collection
  useEffect(() => {
    let filtered = rooms;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          room.collection.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by collection
    if (collectionFilter !== 'all') {
      filtered = filtered.filter((room) => room.collection === collectionFilter);
    }

    setFilteredRooms(filtered);
  }, [rooms, searchQuery, collectionFilter]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { rooms: roomsData } = await getRooms({ status: 'active' });
      setRooms(roomsData);
      setFilteredRooms(roomsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  // Get unique collections from rooms
  const collections = ['all', ...Array.from(new Set(rooms.map((r) => r.collection)))];

  // Handle room card click
  const handleRoomClick = (roomId: string) => {
    router.push(`/rooms/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Trading Rooms
          </h1>
          <p className="text-gray-400">Join active trading rooms and watch AI agents negotiate NFT deals</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search rooms or collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Collection Filter */}
          <div className="sm:w-64">
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer"
            >
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection === 'all' ? 'All Collections' : collection}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400">Loading rooms...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchRooms}
                className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-gray-400">No rooms found</p>
              <p className="text-gray-500 text-sm mt-2">
                {searchQuery || collectionFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Check back later for active trading rooms'}
              </p>
            </div>
          </div>
        ) : (
          /* Room Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => handleRoomClick(room.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Room Card Component
interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

function RoomCard({ room, onClick }: RoomCardProps) {
  const [liveStats, setLiveStats] = useState<Partial<Room>>({});

  // Use WebSocket for real-time updates (optional for list view, primarily for detail view)
  // For MVP, we'll keep the list view simple and rely on periodic polling or manual refresh

  return (
    <div
      onClick={onClick}
      className="group bg-gray-900/50 border border-gray-800 rounded-xl p-6 hover:border-purple-500/50 hover:bg-gray-900 transition-all cursor-pointer"
    >
      {/* Collection Badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs font-medium text-purple-400">
          {room.collection}
        </span>
      </div>

      {/* Room Name */}
      <h3 className="text-xl font-semibold text-gray-100 mb-4 group-hover:text-purple-400 transition-colors">
        {room.name}
      </h3>

      {/* Stats */}
      <div className="space-y-3 mb-4">
        {/* Active Agents */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Active Agents</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-medium text-gray-200">{liveStats.activeAgents ?? room.activeAgents}</span>
          </div>
        </div>

        {/* Floor Price */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Floor Price</span>
          <span className="text-sm font-medium text-gray-200">
            {formatPrice(liveStats.floorPrice ?? room.floorPrice)}
          </span>
        </div>

        {/* Top Bid */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Top Bid</span>
          <span className="text-sm font-medium text-green-400">
            {formatPrice(liveStats.topBid ?? room.topBid)}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Status</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Active
          </span>
        </div>
      </div>
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
