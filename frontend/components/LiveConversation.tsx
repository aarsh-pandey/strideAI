
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { ConnectionStatus, TranscriptionEntry } from '../types';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const STORAGE_KEY = 'rq_transcriptions_v1';

interface LiveConversationProps {
  onProceedToGoal?: (goal: string) => void;
}

export const LiveConversation: React.FC<LiveConversationProps> = ({ onProceedToGoal }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Buffer for transcriptions
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  // Persist transcriptions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transcriptions));
  }, [transcriptions]);

  const stopConversation = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outAudioContextRef.current) {
      outAudioContextRef.current.close();
      outAudioContextRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setStatus(ConnectionStatus.DISCONNECTED);
  }, []);

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear your conversation history?')) {
      setTranscriptions([]);
    }
  };

  const handleProceedToGoal = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Get all user messages from transcriptions
      const userMessages = transcriptions
        .filter(t => t.role === 'user')
        .map(t => t.text)
        .join(' ');

      if (!userMessages.trim()) {
        setError('No conversation found. Please talk about your goals first.');
        setIsProcessing(false);
        return;
      }

      // Call backend to summarize the conversation
      const response = await fetch('http://localhost:8000/api/summarize-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: userMessages })
      });

      if (!response.ok) {
        throw new Error('Failed to summarize conversation');
      }

      const data = await response.json();
      
      // Call the callback with the summarized goal
      if (onProceedToGoal) {
        onProceedToGoal(data.goal);
      }
    } catch (err) {
      console.error('Error processing conversation:', err);
      setError('Failed to process conversation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startConversation = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inputCtx;
      outAudioContextRef.current = outputCtx;
      
      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const newEntries: TranscriptionEntry[] = [];
              if (currentInputTranscription.current) {
                newEntries.push({ role: 'user', text: currentInputTranscription.current, timestamp: Date.now() });
                currentInputTranscription.current = '';
              }
              if (currentOutputTranscription.current) {
                newEntries.push({ role: 'model', text: currentOutputTranscription.current, timestamp: Date.now() });
                currentOutputTranscription.current = '';
              }
              if (newEntries.length > 0) {
                setTranscriptions(prev => [...prev, ...newEntries]);
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outAudioContextRef.current) {
              const ctx = outAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              
              source.connect(analyserRef.current!);
              analyserRef.current!.connect(ctx.destination);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Live API Error:', e);
            setError('Connection failed. Please check your microphone and try again.');
            setStatus(ConnectionStatus.ERROR);
            stopConversation();
          },
          onclose: () => {
            setStatus(ConnectionStatus.DISCONNECTED);
            stopConversation();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are a motivational coach specializing in New Year resolutions for 2026. Be encouraging, helpful, and provide actionable advice. If the user shares a resolution, help them break it down using SMART goals. Your personality is warm, professional, and optimistic.",
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setError('Could not initialize audio conversation.');
      setStatus(ConnectionStatus.ERROR);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="glass-morphism rounded-2xl p-8 flex flex-col items-center justify-center text-center relative">
        {transcriptions.length > 0 && (
          <button 
            onClick={clearHistory}
            className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest"
          >
            Clear History
          </button>
        )}
        <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
          {/* <span className="font-semibold mr-1">strideAI</span> */}
          Voice Coach
        </h2>
        <p className="text-gray-400 mb-8 max-w-md">
          Connect your microphone to have a real-time conversation about your 2026 goals.
        </p>

        <div className="relative mb-8">
          <button
            onClick={status === ConnectionStatus.CONNECTED ? stopConversation : startConversation}
            disabled={status === ConnectionStatus.CONNECTING}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl ${
              status === ConnectionStatus.CONNECTED 
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 pulse-glow' 
                : 'bg-indigo-600 text-white hover:bg-indigo-500'
            }`}
          >
            {status === ConnectionStatus.CONNECTED ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (status === ConnectionStatus.CONNECTING ? (
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ))}
          </button>
          
          {status === ConnectionStatus.CONNECTED && (
            <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500 opacity-20 -z-10"></div>
          )}
        </div>

        {status === ConnectionStatus.CONNECTED && analyserRef.current && (
          <Visualizer isActive={true} analyserNode={analyserRef.current} />
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
        
        <div className="mt-2 text-sm font-medium">
          {status === ConnectionStatus.CONNECTED ? (
            <span className="text-green-400 flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Live Conversation Active
            </span>
          ) : (
            <span className="text-gray-500">Ready to listen</span>
          )}
        </div>

        {/* Proceed Button - shown when there are transcriptions */}
        {transcriptions.length > 0 && onProceedToGoal && (
          <button
            onClick={handleProceedToGoal}
            disabled={isProcessing}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Proceed to Strategy Plan
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-2 pb-20 custom-scrollbar">
        {transcriptions.map((t, idx) => (
          <div 
            key={idx} 
            className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`max-w-[85%] rounded-2xl p-4 ${
              t.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'
            }`}>
              <p className="text-sm leading-relaxed">{t.text}</p>
              <span className="text-[10px] opacity-50 mt-2 block">
                {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {transcriptions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 italic">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Start speaking to see the live transcript</p>
          </div>
        )}
      </div>
    </div>
  );
};
