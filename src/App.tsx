/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic2, Play, Square, Download, Trash2, Wand2, 
  Settings, Languages, Volume2, FastForward, Activity,
  Music, History, Github, Share2, Info, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { rewriteText } from './lib/gemini.ts';

// --- Types ---
interface VoiceSettings {
  lang: string;
  style: string;
  speed: number;
  pitch: number;
  volume: number;
}

interface AudioHistoryItem {
  id: string;
  text: string;
  settings: VoiceSettings;
  timestamp: number;
}

// --- Constants ---
const LANGUAGES = [
  { code: 'hi-IN', label: '🇮🇳 Hindi', native: 'हिंदी', p: 1.0, r: 1.0 },
  { code: 'en-US', label: '🇺🇸 English', native: 'English', p: 1.1, r: 1.1 },
  { code: 'ta-IN', label: '🇮🇳 Tamil', native: 'தமிழ்', p: 1.15, r: 0.95 },
  { code: 'te-IN', label: '🇮🇳 Telugu', native: 'తెలుగు', p: 1.1, r: 0.98 },
  { code: 'bn-IN', label: '🇮🇳 Bengali', native: 'বাংলা', p: 1.05, r: 0.97 },
  { code: 'mr-IN', label: '🇮🇳 Marathi', native: 'मराठी', p: 1.0, r: 1.0 },
  { code: 'gu-IN', label: '🇮🇳 Gujarati', native: 'ગુજરાતી', p: 1.05, r: 1.02 },
  { code: 'fr-FR', label: '🇫🇷 French', native: 'Français', p: 1.15, r: 1.05 },
  { code: 'de-DE', label: '🇩🇪 German', native: 'Deutsch', p: 0.95, r: 0.98 },
  { code: 'es-ES', label: '🇪🇸 Spanish', native: 'Español', p: 1.1, r: 1.08 },
];

const STYLES = [
  { id: 'normal', label: 'Normal', icon: '👦', suffix: '', p: 1.0, r: 1.0 },
  { id: 'cat', label: 'Cat', icon: '🐱', suffix: ' meow meow', p: 1.7, r: 1.2 },
  { id: 'dog', label: 'Dog', icon: '🐶', suffix: ' bhow bhow', p: 1.4, r: 1.1 },
  { id: 'robot', label: 'Robot', icon: '🤖', suffix: '', p: 0.7, r: 0.85 },
  { id: 'happy', label: 'Happy', icon: '😊', suffix: ' haha!', p: 1.3, r: 1.15 },
  { id: 'sad', label: 'Sad', icon: '😢', suffix: ' ...oh no', p: 0.7, r: 0.75 },
  { id: 'angry', label: 'Angry', icon: '😠', suffix: ' GRRR!', p: 1.1, r: 1.25 },
  { id: 'excited', label: 'Excited', icon: '🤩', suffix: ' WOW!', p: 1.4, r: 1.35 },
];

export default function App() {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<VoiceSettings>({
    lang: 'hi-IN',
    style: 'normal',
    speed: 1,
    pitch: 1,
    volume: 80,
  });

  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      if (synthRef.current) synthRef.current.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const savedHistory = localStorage.getItem('voicewala_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  };

  const speak = () => {
    if (!text.trim()) return showStatus('Please enter some text!', 'error');

    synthRef.current?.cancel();
    const styleObj = STYLES.find(s => s.id === settings.style) || STYLES[0];
    const langObj = LANGUAGES.find(l => l.code === settings.lang) || LANGUAGES[0];
    
    const utterance = new SpeechSynthesisUtterance(text + styleObj.suffix);
    
    utterance.lang = settings.lang;
    utterance.rate = langObj.r * styleObj.r * settings.speed;
    utterance.pitch = langObj.p * styleObj.p * settings.pitch;
    utterance.volume = settings.volume / 100;

    // Safety limits for browser TTS
    utterance.rate = Math.max(0.5, Math.min(2.0, utterance.rate));
    utterance.pitch = Math.max(0.1, Math.min(2.0, utterance.pitch));

    // Voice Selection
    if (synthRef.current) {
      const voices = synthRef.current.getVoices();
      const preferredVoice = voices.find(v => v.lang === settings.lang) || 
                            voices.find(v => v.lang.startsWith(settings.lang.split('-')[0]));
      if (preferredVoice) utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error(e);
      setIsSpeaking(false);
      showStatus('Speech Error!', 'error');
    };

    synthRef.current?.speak(utterance);
    addToHistory();
  };

  const stop = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  const addToHistory = () => {
    const newItem: AudioHistoryItem = {
      id: Date.now().toString(),
      text: text.slice(0, 50),
      settings: { ...settings },
      timestamp: Date.now(),
    };
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('voicewala_history', JSON.stringify(updated));
  };

  const handleRewrite = async () => {
    if (!text.trim()) return;
    setIsRewriting(true);
    try {
      const rewritten = await rewriteText(text, settings.style, settings.lang);
      setText(rewritten);
      showStatus('AI Magic applied!', 'success');
    } catch (e) {
      showStatus('AI Rewrite failed', 'error');
    } finally {
      setIsRewriting(false);
    }
  };

  // Improved Synthesizer for Download (MP3)
  const generateDownload = async () => {
    if (!text.trim()) return showStatus('Write text first!', 'error');
    setIsSynthesizing(true);
    
    try {
      const styleObj = STYLES.find(s => s.id === settings.style) || STYLES[0];
      const langCode = settings.lang.split('-')[0];
      const finalText = text + styleObj.suffix;

      const response = await fetch(`/api/tts?text=${encodeURIComponent(finalText)}&lang=${langCode}`);
      
      if (!response.ok) throw new Error('API Error');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const a = document.createElement('a');
      a.href = url;
      a.download = `voicewala_${Date.now()}.mp3`;
      a.click();
      
      showStatus('Real Voice Download Ready!', 'success');
    } catch (e) {
      console.error(e);
      showStatus('Download Error', 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-brand-primary/30">
      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--color-slate-900),_transparent)] opacity-40" />
      <div className="fixed top-20 left-10 w-72 h-72 bg-brand-primary/10 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="fixed bottom-20 right-10 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px] animate-pulse-slow" />

      <main className="container max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header id="app-header" className="flex flex-col items-center mb-10 text-center">
          <motion.div 
            id="logo-icon"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-gradient-to-tr from-brand-primary to-brand-secondary rounded-2xl flex items-center justify-center mb-4 shadow-xl glow-primary"
          >
            <Mic2 className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1 
            id="main-title"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-5xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 mb-2"
          >
            VOICEWALA
          </motion.h1>
          <p id="app-subtitle" className="text-slate-400 font-medium">Professional AI Voice Morphing & Synthesis</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Controls - 8 cols */}
          <div className="lg:col-span-8 space-y-6">
            {/* Text Editor */}
            <section id="editor-section" className="glass rounded-2xl md:rounded-3xl p-6 relative group">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-accent" /> Input Content
                </label>
                <div className="flex gap-2">
                  <motion.button
                    id="rewrite-btn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRewrite}
                    disabled={isRewriting || !text}
                    className="flex items-center gap-2 px-3 py-1.5 bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {isRewriting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Smart Rewrite
                  </motion.button>
                  <button id="clear-text-btn" onClick={() => setText('')} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <textarea
                id="main-textarea"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type anything... e.g., Hello, how can I help you today?"
                className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-4 text-lg text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 min-h-[160px] resize-none transition-all"
              />
              <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500 flex justify-between font-mono">
                <span>{text.length} Characters</span>
                <span className="text-brand-accent">Live Preview Ready</span>
              </div>
            </section>

            {/* Voice Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="glass rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Languages className="w-4 h-4" /> Tone & Language
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-2 block">Language</label>
                    <select 
                      value={settings.lang}
                      onChange={(e) => setSettings({...settings, lang: e.target.value})}
                      className="w-full bg-slate-900 border border-white/5 rounded-xl p-2.5 text-sm"
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-2 block">Voice Character</label>
                    <div className="grid grid-cols-4 gap-2">
                      {STYLES.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSettings({...settings, style: s.id})}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                            settings.style === s.id 
                            ? 'bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                            : 'bg-slate-900 border-white/5 hover:border-brand-primary/50 text-slate-400'
                          }`}
                        >
                          <span className="text-xl mb-1">{s.icon}</span>
                          <span className="text-[10px] font-bold truncate w-full text-center">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="glass rounded-2xl p-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Parameters
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span className="flex items-center gap-1"><FastForward className="w-3 h-3" /> Speed</span>
                      <span className="text-brand-accent">{settings.speed}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" value={settings.speed}
                      onChange={(e) => setSettings({...settings, speed: parseFloat(e.target.value)})}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span className="flex items-center gap-1"><Music className="w-3 h-3" /> Pitch</span>
                      <span className="text-brand-accent">{settings.pitch}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" value={settings.pitch}
                      onChange={(e) => setSettings({...settings, pitch: parseFloat(e.target.value)})}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-accent"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Volume</span>
                      <span className="text-brand-accent">{settings.volume}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={settings.volume}
                      onChange={(e) => setSettings({...settings, volume: parseInt(e.target.value)})}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Action Bar */}
            <div id="action-bar" className="flex flex-wrap gap-4 items-center justify-between glass rounded-2xl p-4">
              <div className="flex gap-2">
                {!isSpeaking ? (
                  <motion.button
                    id="speak-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={speak}
                    className="px-6 py-3 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg glow-primary transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" /> Speak
                  </motion.button>
                ) : (
                  <motion.button
                    id="stop-btn"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={stop}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all"
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop
                  </motion.button>
                )}
              </div>

              <div className="flex gap-2">
                <motion.button
                  id="export-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isSynthesizing}
                  onClick={generateDownload}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-2 border border-white/5 disabled:opacity-50"
                >
                  {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export WAV
                </motion.button>
              </div>
            </div>

            {/* Status Feed */}
            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`p-3 rounded-xl flex items-center gap-3 font-medium text-sm ${
                    status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-brand-primary/10 text-brand-primary border border-brand-primary/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    status.type === 'success' ? 'bg-emerald-400 animate-pulse' :
                    status.type === 'error' ? 'bg-red-400' :
                    'bg-brand-primary animate-pulse'
                  }`} />
                  {status.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar - 4 cols */}
          <aside className="lg:col-span-4 space-y-6">
            <section className="glass rounded-2xl p-6 h-full">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-brand-accent" />
                <h2 className="font-bold text-slate-200">Recent Creations</h2>
              </div>
              
              <div className="space-y-3">
                {history.length > 0 ? history.map((item) => (
                  <div key={item.id} className="p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] text-brand-accent font-bold uppercase">{item.settings.style} • {item.settings.lang.split('-')[0]}</span>
                      <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-2 leading-snug group-hover:text-white transition-colors">{item.text}</p>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                    <Music className="w-12 h-12 mb-2 opacity-20" />
                    <p className="text-xs font-medium italic">No history yet</p>
                  </div>
                )}
              </div>

              <div className="mt-8 p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-brand-primary" />
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Usage Tip</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Combine <strong>Smart Rewrite</strong> with different <strong>Voice Characters</strong> to get unique emotional results. Exported WAV files include high-quality synthesis data.
                </p>
              </div>
            </section>
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-800 rounded-lg flex items-center justify-center">
                <Github className="w-3 h-3" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase">Open Source</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="w-3 h-3" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Community Powered</span>
            </div>
          </div>
          <div className="text-[10px] font-mono">
            &copy; {new Date().getFullYear()} VOICEWALA SYSTEM v2.0.4-LATEST
          </div>
        </footer>
      </main>
    </div>
  );
}
