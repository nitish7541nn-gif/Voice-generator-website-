import React, { useState } from 'react';
import { Sparkles, Wand2, X, FileText, Loader2, Video, Ghost, Newspaper, Lightbulb, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { generateScript } from '../lib/gemini';
import { checkExplicitContent } from '../lib/moderation';

interface AiScriptGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScriptGenerated: (script: string) => void;
  language: string;
}

const CATEGORIES = [
  { id: 'YouTube Shorts / Reels', label: '📱 Shorts / Reels (30 Sec Hook)', icon: Video, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'Horror & Mystery Story', label: '👻 Horror / Kahani (Suspense Script)', icon: Ghost, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'Breaking News & Sports', label: '📰 Breaking News & Cricket Updates', icon: Newspaper, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'Motivational & Life Advice', label: '💡 Motivational & Life Hacks', icon: Lightbulb, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'Tech & Knowledge Explainer', label: '⚡ Tech & Facts Explainer', icon: Zap, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

const SUGGESTIONS = [
  "भारत के 5 सबसे रहस्यमयी स्थान (5 Secret Places in India)",
  "महीने के ₹50,000 कमाने के 3 आसान तरीके",
  "एक पुरानी हवेली की ख़ौफ़नाक रात की कहानी",
  "कल के भारत बनाम पाकिस्तान मैच का रोमांचक मोड़",
  "इंसानी दिमाग की 3 अनसुलझी शक्तियां"
];

export default function AiScriptGeneratorModal({ isOpen, onClose, onScriptGenerated, language }: AiScriptGeneratorModalProps) {
  const [topic, setTopic] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('YouTube Shorts / Reels');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) {
      setError('कृपया कोई विषय या टॉपिक लिखें!');
      return;
    }

    const check = checkExplicitContent(topic);
    if (check.isExplicit) {
      setError(check.reason);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const script = await generateScript(topic, selectedCategory, language);
      if (script) {
        onScriptGenerated(script);
        onClose();
      } else {
        setError('स्क्रिप्ट जनरेट नहीं हो सकी। कृपया पुनः प्रयास करें।');
      }
    } catch (err: any) {
      setError(err.message || 'Error generating script');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 border-2 border-indigo-200 shadow-2xl space-y-5 relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                <span>AI Script Writer (स्मार्ट स्क्रिप्ट लेखक)</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">1-Click में Shorts, Story & News Script जनरेट करें</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200 shadow-xs"
          >
            <X className="w-4 h-4" />
            <span>बाहर निकलें (Exit)</span>
          </button>
        </div>

        {/* Category Selector */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wide">
            1. कैटेगिरी चुनें (Select Category)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-2.5 rounded-2xl text-left border-2 transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-indigo-300 bg-slate-50'
                  }`}
                >
                  <div className={`p-1.5 rounded-xl border ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 leading-tight">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Topic Input */}
        <form onSubmit={handleGenerate} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wide">
              2. टॉपिक / आइडिया लिखें (Enter Topic / Idea)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 viral facts about space, Horrific village story..."
              className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:bg-white rounded-xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          {/* Quick Ideas Suggestions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500">💡 उदाहरण आइडियाज (Click to try):</span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTopic(sug)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 transition-all text-left cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI Script Likh Raha Hai... (Generating Script)</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>✨ Generate & Fill Editor (स्क्रिप्ट बनाएं)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>❌ बाहर निकलें / Close Modal</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
}
