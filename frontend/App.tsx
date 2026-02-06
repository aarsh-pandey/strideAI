
import React, { useState } from 'react';
import { LiveConversation } from './components/LiveConversation';
import { ResolutionForm } from './components/ResolutionForm';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'voice' | 'text'>('voice');
  const [voiceGoal, setVoiceGoal] = useState<string>('');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              <span className="text-indigo-400 font-semibold mr-1">strideAI</span>
              RESOLUTION <span className="text-indigo-400">QUEST</span>
            </h1>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-[0.2em]">Unlock Your 2026 Potential</p>
          </div>
        </div>

        <nav className="flex bg-gray-900/50 p-1 rounded-2xl border border-gray-800">
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'voice' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Live Voice
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Strategy Plan
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 pb-8 md:px-12 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Context / Tips */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-morphism rounded-2xl p-8">
              <h3 className="text-lg font-bold text-white mb-4">Goal Setting Tips</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Keep resolutions specific and measurable.</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Focus on just 1-2 major changes at a time.</p>
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Share your goals with your AI Voice coach to stay accountable.</p>
                </li>
              </ul>
            </div>

            <div className="glass-morphism rounded-2xl p-8 bg-indigo-900/10">
              <h3 className="text-lg font-bold text-white mb-2">Did You Know?</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Studies show that nearly 80% of people abandon their resolutions by February. 
                Regular check-ins with a coach or friend increases success rates by over 40%.
              </p>
              <div className="mt-4 flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
                <span className="w-8 h-[1px] bg-indigo-400"></span>
                Progress Tracking
              </div>
            </div>
          </div>

          {/* Right Column: Interaction Area */}
          <div className="lg:col-span-8 min-h-[600px] flex flex-col">
            {activeTab === 'voice' ? (
              <LiveConversation 
                onProceedToGoal={(goal) => {
                  setVoiceGoal(goal);
                  setActiveTab('text');
                }}
              />
            ) : (
              <ResolutionForm initialGoal={voiceGoal} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-12 border-t border-gray-800/50 flex flex-col md:flex-row justify-between items-center text-gray-500 text-xs">
        <p>&copy; 2026 strideAI Resolution Quest. Built with Gemini Live API.</p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Safety Guidelines</a>
          <a href="#" className="hover:text-white transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
};

export default App;
