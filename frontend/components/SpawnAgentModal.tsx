'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { spawnAgent, type SpawnAgentRequest } from '@/lib/api/agents';
import { getNfts, verifyOwnership, type Nft } from '@/lib/api/nfts';

interface SpawnAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomCollection: string;
  onSuccess?: () => void;
}

const AVATARS = ['🤖', '🦾', '🧠', '👾', '🎭', '🦊', '🐱', '🦸', '🧙', '🚀'];

const STRATEGIES = [
  { value: 'competitive', label: 'Competitive', description: 'React quickly to market changes' },
  { value: 'patient', label: 'Patient', description: 'Wait for the best offers' },
  { value: 'aggressive', label: 'Aggressive', description: 'Close deals fast' },
  { value: 'conservative', label: 'Conservative', description: 'Cautious approach' },
  { value: 'sniper', label: 'Sniper', description: 'Strike at perfect moments' },
];

const PERSONALITIES = [
  { value: 'formal', label: 'Formal', description: 'Professional and polite' },
  { value: 'casual', label: 'Casual', description: 'Friendly and approachable' },
  { value: 'professional', label: 'Professional', description: 'Direct business-focused' },
  { value: 'aggressive', label: 'Aggressive', description: 'Bold and assertive' },
];

export function SpawnAgentModal({
  isOpen,
  onClose,
  roomId,
  roomCollection,
  onSuccess,
}: SpawnAgentModalProps) {
  const [step, setStep] = useState<'role' | 'details' | 'pricing'>('role');
  const [role, setRole] = useState<'buyer' | 'seller' | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [strategy, setStrategy] = useState('competitive');
  const [personality, setPersonality] = useState('professional');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [startingPrice, setStartingPrice] = useState('');
  const [nftId, setNftId] = useState('');
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch NFTs when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchNfts();
    }
  }, [isOpen]);

  const fetchNfts = async () => {
    try {
      setLoadingNfts(true);
      const { nfts: nftsData } = await getNfts(roomCollection);
      setNfts(nftsData.filter((nft) => nft.collection === roomCollection));
    } catch (err: any) {
      setError(err.message || 'Failed to load NFTs');
    } finally {
      setLoadingNfts(false);
    }
  };

  const resetForm = () => {
    setStep('role');
    setRole(null);
    setName('');
    setAvatar(AVATARS[0]);
    setStrategy('competitive');
    setPersonality('professional');
    setMinPrice('');
    setMaxPrice('');
    setStartingPrice('');
    setNftId('');
    setFieldErrors({});
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateRoleStep = () => {
    if (!role) {
      setError('Please select a role');
      return false;
    }
    setError(null);
    return true;
  };

  const validateDetailsStep = () => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Agent name is required';
    } else if (name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (name.length > 30) {
      errors.name = 'Name must be less than 30 characters';
    }

    if (role === 'seller' && !nftId) {
      errors.nftId = 'Please select an NFT to sell';
    }

    setFieldErrors(errors);
    setError(Object.keys(errors).length > 0 ? 'Please fix the errors below' : null);
    return Object.keys(errors).length === 0;
  };

  const validatePricingStep = () => {
    const errors: Record<string, string> = {};

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    const starting = parseFloat(startingPrice);

    if (!minPrice || isNaN(min) || min <= 0) {
      errors.minPrice = 'Minimum price must be greater than 0';
    }

    if (!maxPrice || isNaN(max) || max <= 0) {
      errors.maxPrice = 'Maximum price must be greater than 0';
    }

    if (!startingPrice || isNaN(starting) || starting <= 0) {
      errors.startingPrice = 'Starting price must be greater than 0';
    }

    if (!isNaN(min) && !isNaN(max) && min >= max) {
      errors.minPrice = 'Minimum price must be less than maximum';
      errors.maxPrice = 'Maximum price must be greater than minimum';
    }

    if (!isNaN(starting) && !isNaN(min) && starting < min) {
      errors.startingPrice = 'Starting price cannot be below minimum';
    }

    if (!isNaN(starting) && !isNaN(max) && starting > max) {
      errors.startingPrice = 'Starting price cannot exceed maximum';
    }

    setFieldErrors(errors);
    setError(Object.keys(errors).length > 0 ? 'Please fix the errors below' : null);
    return Object.keys(errors).length === 0;
  };

  const handleRoleNext = () => {
    if (validateRoleStep()) {
      setStep('details');
    }
  };

  const handleDetailsNext = () => {
    if (validateDetailsStep()) {
      setStep('pricing');
    }
  };

  const handleSubmit = async () => {
    if (!validatePricingStep()) {
      return;
    }

    if (!role) {
      setError('Role is required');
      return;
    }

    // Verify ownership for sellers
    if (role === 'seller' && nftId) {
      try {
        setLoading(true);
        const verification = await verifyOwnership({ nftId, walletAddress: '' }); // Will use authenticated user's wallet
        if (!verification.owns) {
          setError('You do not own this NFT');
          setLoading(false);
          return;
        }
      } catch (err: any) {
        setError(err.message || 'Failed to verify NFT ownership');
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      const data: SpawnAgentRequest = {
        roomId,
        name: name.trim(),
        avatar,
        role,
        nftId: role === 'seller' ? nftId : undefined,
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
        startingPrice: parseFloat(startingPrice),
        strategy: strategy as SpawnAgentRequest['strategy'],
        personality: personality as SpawnAgentRequest['personality'],
      };

      await spawnAgent(data);
      onSuccess?.();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to spawn agent');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-gray-100">
            {step === 'role' && 'Choose Role'}
            {step === 'details' && 'Agent Details'}
            {step === 'pricing' && 'Set Pricing'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 p-4 border-b border-gray-800">
          <div className={`h-2 flex-1 rounded-full transition-colors ${step === 'role' || step === 'details' || step === 'pricing' ? 'bg-purple-500' : 'bg-gray-800'}`} />
          <div className={`h-2 flex-1 rounded-full transition-colors ${step === 'details' || step === 'pricing' ? 'bg-purple-500' : 'bg-gray-800'}`} />
          <div className={`h-2 flex-1 rounded-full transition-colors ${step === 'pricing' ? 'bg-purple-500' : 'bg-gray-800'}`} />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Role Selection Step */}
          {step === 'role' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Select the role for your AI agent</p>

              <div className="grid grid-cols-2 gap-4">
                {/* Buyer Role */}
                <button
                  onClick={() => setRole('buyer')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    role === 'buyer'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                  }`}
                >
                  <div className="text-4xl mb-3">🛒</div>
                  <h3 className="font-semibold text-gray-100 mb-1">Buyer</h3>
                  <p className="text-xs text-gray-400">Looking to purchase NFTs</p>
                </button>

                {/* Seller Role */}
                <button
                  onClick={() => setRole('seller')}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    role === 'seller'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                  }`}
                >
                  <div className="text-4xl mb-3">💎</div>
                  <h3 className="font-semibold text-gray-100 mb-1">Seller</h3>
                  <p className="text-xs text-gray-400">Selling NFTs from collection</p>
                </button>
              </div>
            </div>
          )}

          {/* Details Step */}
          {step === 'details' && (
            <div className="space-y-5">
              {/* Agent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Agent Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Trading Bot Alpha"
                  className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                    fieldErrors.name ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              {/* Avatar Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`p-3 rounded-lg text-2xl transition-all ${
                        avatar === a
                          ? 'bg-purple-500/20 border-2 border-purple-500'
                          : 'bg-gray-900 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* NFT Selection (Sellers Only) */}
              {role === 'seller' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select NFT to Sell <span className="text-red-400">*</span>
                  </label>
                  {loadingNfts ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : nfts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No NFTs available in this collection</p>
                  ) : (
                    <select
                      value={nftId}
                      onChange={(e) => setNftId(e.target.value)}
                      className={`w-full px-4 py-3 bg-gray-900 border rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        fieldErrors.nftId ? 'border-red-500' : 'border-gray-700'
                      }`}
                    >
                      <option value="">Select an NFT</option>
                      {nfts.map((nft) => (
                        <option key={nft.id} value={nft.id}>
                          {nft.name} ({nft.collection})
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors.nftId && <p className="mt-1 text-xs text-red-400">{fieldErrors.nftId}</p>}
                </div>
              )}

              {/* Strategy Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Trading Strategy</label>
                <div className="space-y-2">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStrategy(s.value)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        strategy === s.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-200">{s.label}</span>
                        {strategy === s.value && (
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Communication Style</label>
                <div className="space-y-2">
                  {PERSONALITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPersonality(p.value)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        personality === p.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-200">{p.label}</span>
                        {personality === p.value && (
                          <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pricing Step */}
          {step === 'pricing' && (
            <div className="space-y-5">
              <p className="text-sm text-gray-400">
                {role === 'buyer'
                  ? 'Set your budget range for purchasing NFTs'
                  : 'Set your price range for selling your NFT'}
              </p>

              {/* Minimum Price */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {role === 'buyer' ? 'Minimum Budget' : 'Minimum Acceptable Price'}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-3 bg-gray-900 border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      fieldErrors.minPrice ? 'border-red-500' : 'border-gray-700'
                    }`}
                  />
                </div>
                {fieldErrors.minPrice && <p className="mt-1 text-xs text-red-400">{fieldErrors.minPrice}</p>}
              </div>

              {/* Maximum Price */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {role === 'buyer' ? 'Maximum Budget' : 'Maximum Target Price'}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-3 bg-gray-900 border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      fieldErrors.maxPrice ? 'border-red-500' : 'border-gray-700'
                    }`}
                  />
                </div>
                {fieldErrors.maxPrice && <p className="mt-1 text-xs text-red-400">{fieldErrors.maxPrice}</p>}
              </div>

              {/* Starting Price */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {role === 'buyer' ? 'Initial Offer' : 'Listing Price'}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={startingPrice}
                    onChange={(e) => setStartingPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-3 bg-gray-900 border rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                      fieldErrors.startingPrice ? 'border-red-500' : 'border-gray-700'
                    }`}
                  />
                </div>
                {fieldErrors.startingPrice && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.startingPrice}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  This is the price your agent will start negotiating with
                </p>
              </div>

              {/* Summary */}
              <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Name:</span>
                    <span className="text-gray-200">{avatar} {name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Role:</span>
                    <span className="text-gray-200 capitalize">{role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strategy:</span>
                    <span className="text-gray-200 capitalize">{strategy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Style:</span>
                    <span className="text-gray-200 capitalize">{personality}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-800">
          {step === 'role' && (
            <>
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRoleNext} className="flex-1" disabled={!role}>
                Next
              </Button>
            </>
          )}

          {step === 'details' && (
            <>
              <Button variant="outline" onClick={() => setStep('role')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleDetailsNext} className="flex-1">
                Next
              </Button>
            </>
          )}

          {step === 'pricing' && (
            <>
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={loading}>
                {loading ? 'Spawning...' : 'Spawn Agent'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
