
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { StoredRoadmap } from '../types';

const STORAGE_KEY = 'rq_roadmaps_v1';
const CATEGORIES = [
  { name: 'Health', icon: '🏃‍♂️', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { name: 'Career', icon: '💼', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { name: 'Personal Growth', icon: '🌱', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { name: 'Finance', icon: '💰', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { name: 'Relationships', icon: '❤️', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  { name: 'Hobby', icon: '🎨', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
];

interface ResolutionFormProps {
  initialGoal?: string;
}

export const ResolutionForm: React.FC<ResolutionFormProps> = ({ initialGoal = '' }) => {
  const [goal, setGoal] = useState(initialGoal);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].name);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [roadmaps, setRoadmaps] = useState<StoredRoadmap[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmaps));
  }, [roadmaps]);

  // Update goal when initialGoal prop changes
  useEffect(() => {
    if (initialGoal) {
      setGoal(initialGoal);
    }
  }, [initialGoal]);

  const exportToCalendar = (item: StoredRoadmap) => {
    // Use full_plan instead of feedback for calendar export
    const planText = item.full_plan || item.feedback;
    const lines = planText.split('\n');
    
    // Set start date (today) and end date (deadline or 30 days from now)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of day
    
    const endDate = item.deadline ? new Date(item.deadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    endDate.setHours(23, 59, 59, 999); // End of day
    
    // Calculate number of days (add 1 to include the end date)
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    console.log(`Creating calendar for ${totalDays} days from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    // Parse markdown to extract daily tasks and map them to specific days
    const dailyTasks: Map<number, string[]> = new Map();
    
    let currentDay = -1;
    let currentTasks: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match patterns like "## Day 1", "## Day 2", etc.
      const dayMatch = line.match(/^#+\s*Day\s+(\d+)/i);
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      
      if (dayMatch) {
        // Save previous day's tasks if exists
        if (currentDay > 0 && currentTasks.length > 0) {
          dailyTasks.set(currentDay - 1, [...currentTasks]); // Store as 0-based index
        }
        
        currentDay = parseInt(dayMatch[1]);
        currentTasks = [];
      } else if (bulletMatch && currentDay > 0) {
        currentTasks.push(bulletMatch[1]);
      }
    }
    
    // Add the last day's tasks
    if (currentDay > 0 && currentTasks.length > 0) {
      dailyTasks.set(currentDay - 1, currentTasks);
    }
    
    console.log(`Parsed ${dailyTasks.size} days with specific tasks`);
    
    // Build ICS content with daily events
    const now = new Date();
    const formatICSDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };
    
    const icsEvents: string[] = [];
    
    // Create an event for EVERY single day
    for (let day = 0; day < totalDays; day++) {
      const eventStart = new Date(startDate);
      eventStart.setDate(eventStart.getDate() + day);
      eventStart.setHours(9, 0, 0, 0); // 9 AM
      
      const eventEnd = new Date(eventStart);
      eventEnd.setHours(10, 0, 0, 0); // 10 AM (1 hour duration)
      
      // Get tasks for this day
      const tasksForDay = dailyTasks.get(day);
      
      let summary: string;
      let description: string;
      
      if (tasksForDay && tasksForDay.length > 0) {
        summary = `Day ${day + 1}: ${item.goal}`;
        description = tasksForDay.join('\\n');
      } else {
        summary = `Day ${day + 1}: ${item.goal}`;
        description = `Continue working on: ${item.goal}`;
      }
      
      // Limit text length
      const escapedSummary = summary.substring(0, 200);
      const escapedDescription = description.substring(0, 900);
      
      const eventBlock = [
        'BEGIN:VEVENT',
        `UID:strideai-${item.timestamp}-day${day + 1}@strideai.app`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(eventStart)}`,
        `DTEND:${formatICSDate(eventEnd)}`,
        `SUMMARY:${escapedSummary}`,
        `DESCRIPTION:${escapedDescription}`,
        'END:VEVENT'
      ].join('\r\n');
      
      icsEvents.push(eventBlock);
    }
    
    console.log(`Created ${icsEvents.length} calendar events`);
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//strideAI//strideAI//EN',
      ...icsEvents,
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `strideAI-${item.goal.slice(0, 20).replace(/\s+/g, '-')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/generate-roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: goal,
          category: selectedCategory,
          deadline: deadline || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate roadmap');
      }

      const data = await response.json();
      
      const newRoadmap: StoredRoadmap = {
        goal: goal,
        category: selectedCategory,
        deadline: deadline,
        feedback: data.feedback || 'No feedback received.',
        full_plan: data.full_plan || data.feedback || 'No plan generated.',
        timestamp: Date.now()
      };
      
      setRoadmaps(prev => [newRoadmap, ...prev]);
      setGoal('');
      setDeadline('');
    } catch (err) {
      console.error(err);
      alert('Error generating feedback. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear all your saved roadmaps?')) {
      setRoadmaps([]);
    }
  };

  const getCategoryStyles = (catName: string) => {
    return CATEGORIES.find(c => c.name === catName) || CATEGORIES[0];
  };

  return (
    <div className="glass-morphism rounded-2xl p-8 h-full flex flex-col relative overflow-hidden">
      {roadmaps.length > 0 && (
        <button 
          onClick={clearHistory}
          className="absolute top-4 right-4 text-gray-500 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest z-10"
        >
          Clear All
        </button>
      )}
      <h2 className="text-2xl font-bold mb-6 text-indigo-300">Text-to-Action Plan</h2>
      <form onSubmit={handleSubmit} className="space-y-6 mb-8 shrink-0">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-3">Choose a Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]'
                    : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-400 mb-2">Target Deadline</label>
            <input
              type="date"
              value={deadline}
              min="2026-01-01"
              max="2026-12-31"
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">What's your goal for 2026?</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Learn to play piano, run a marathon, or read 24 books..."
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all h-24 resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !goal.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              Analyzing Resolution...
            </>
          ) : (
            'Generate Roadmap'
          )}
        </button>
      </form>

      <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-2 min-h-0">
        {roadmaps.length > 0 ? (
          roadmaps.map((item, idx) => {
            const catInfo = getCategoryStyles(item.category);
            return (
              <div key={idx} className="group bg-gray-900/40 border border-gray-700 rounded-xl p-6 animate-in fade-in slide-in-from-top-2 duration-500 relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center flex-wrap">
                      <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${catInfo.color}`}>
                        {catInfo.icon} {item.category}
                      </div>
                      {item.deadline && (
                        <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                          🎯 By {new Date(item.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <h3 className="text-white font-bold mt-2">"{item.goal}"</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => exportToCalendar(item)}
                      title="Export to Calendar"
                      className="p-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:text-white hover:bg-indigo-600/20 hover:border-indigo-500/50 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(item.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-gray-300 prose prose-invert prose-sm max-w-none whitespace-normal leading-relaxed border-t border-gray-800 pt-4">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-white mb-3 mt-4" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-bold text-indigo-300 mb-2 mt-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-indigo-200 mb-2 mt-2" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 text-gray-300" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="text-gray-300 ml-2" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                      em: ({node, ...props}) => <em className="italic text-indigo-200" {...props} />,
                      code: ({node, ...props}) => <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-300 text-sm" {...props} />,
                      pre: ({node, ...props}) => <pre className="bg-gray-800 p-3 rounded-lg overflow-x-auto mb-3" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 pl-4 italic text-gray-400 my-2" {...props} />,
                    }}
                  >
                    {item.feedback}
                  </ReactMarkdown>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 italic py-12">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Your roadmaps will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};
