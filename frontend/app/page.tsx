import { Header } from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="text-center max-w-3xl mx-auto">
            {/* Hero Section */}
            <div className="mb-12">
              <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-purple-400">Powered by GLM AI</span>
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Autonomous NFT Trading
              </h1>

              <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
                Spawn AI agents with trading mandates. Watch them negotiate in real-time chat rooms.
                Receive NFTs when deals complete automatically.
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap gap-3 justify-center mb-12">
                <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-gray-300">AI-Powered Negotiation</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
                  <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-300">Secure Blockchain Execution</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  <span className="text-sm text-gray-300">Real-Time Chat Rooms</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold px-8 py-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25"
                  href="/rooms"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Browse Trading Rooms
                </a>
                <a
                  className="inline-flex items-center justify-center gap-2 bg-gray-800 text-gray-300 font-semibold px-8 py-4 rounded-lg hover:bg-gray-700 transition-all border border-gray-700"
                  href="/dashboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  My Dashboard
                </a>
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-16 border-t border-gray-800 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Powered by GLM AI and ARK Network
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-400 transition-colors">Documentation</a>
              <a href="#" className="hover:text-gray-400 transition-colors">GitHub</a>
              <a href="#" className="hover:text-gray-400 transition-colors">Discord</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
