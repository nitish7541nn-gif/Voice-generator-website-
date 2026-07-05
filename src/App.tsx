/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic2, Play, Square, Download, Trash2, Wand2, 
  Settings, Languages, Volume2, FastForward, Activity,
  Music, Github, Share2, Info, Loader2, SlidersHorizontal, ChevronDown, ChevronUp,
  Wallet, Heart, QrCode, Sparkles, Users, History, Clock, FileText, VolumeX, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { rewriteText } from './lib/gemini.ts';
import { checkExplicitContent } from './lib/moderation.ts';
import UpiPaymentModal from './components/UpiPaymentModal.tsx';
import AiScriptGeneratorModal from './components/AiScriptGeneratorModal.tsx';
import DialogueBuilderModal from './components/DialogueBuilderModal.tsx';
import VoiceHistoryModal, { SavedAudioItem } from './components/VoiceHistoryModal.tsx';
import { containsAdultContent } from './utils/moderation.ts';

// --- Types ---
interface VoiceSettings {
  lang: string;
  speed: number;
  pitch: number;
  volume: number;
  voice: string;
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

const AI_VOICES = [
  // 👩 Female / Ladies Voices (महिला आवाजें - ElevenLabs Style)
  { id: 'Kore', label: '👩 कोरिया (Kore - Natural Female AI)', desc: 'Clear Natural Female Voice', gender: 'female', pitchOffset: 1.0 },
  { id: 'Aoede', label: '👩 आयोड (Aoede - Soft & Gentle Female)', desc: 'Soft Whispering Calm Female Voice', gender: 'female', pitchOffset: 1.15 },
  { id: 'Priya', label: '👩 प्रिया (Priya - News Anchor Female)', desc: 'Confident & Crisp News Reader Voice', gender: 'female', pitchOffset: 1.05 },
  { id: 'Ananya', label: '👩 अनन्या (Ananya - Young Energetic Girl)', desc: 'Cheerful & Bright Young Female Voice', gender: 'female', pitchOffset: 1.25 },
  { id: 'Kavya', label: '👩 काव्या (Kavya - Storyteller Woman)', desc: 'Warm, Expressive & Melodic Voice', gender: 'female', pitchOffset: 0.95 },
  { id: 'Sunita', label: '👩 सुनिता (Sunita - Professional Business)', desc: 'Formal Corporate Executive Voice', gender: 'female', pitchOffset: 1.02 },
  { id: 'Riya', label: '👩 रिया (Riya - Radio Jockey RJ)', desc: 'Upbeat & Friendly RJ Voice', gender: 'female', pitchOffset: 1.10 },
  { id: 'Shalini', label: '👩 शालिनी (Shalini - Teacher / Educator)', desc: 'Clear & Patient Teacher Voice', gender: 'female', pitchOffset: 1.08 },

  // 👨 Male Voices (पुरुष आवाजें)
  { id: 'Puck', label: '👨 पक् (Puck - Natural Male AI Voice)', desc: 'Clear Natural Male Voice', gender: 'male', pitchOffset: 1.0 },
  { id: 'Charon', label: '👨 कैरोन (Charon - Deep Baritone AI)', desc: 'Deep Male Baritone Voice', gender: 'male', pitchOffset: 0.85 },
  { id: 'Fenrir', label: '👨 फेनरिर (Fenrir - Expressive Male)', desc: 'Strong Expressive Male Voice', gender: 'male', pitchOffset: 0.95 },
];

export interface ActivePlan {
  name: string;
  price: number;
  wordLimit: number;
  minuteLimit: number;
  dailyGenerationsLimit?: number;
  activatedAt: string;
}

export default function App() {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [showDialogueModal, setShowDialogueModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [bgmStyle, setBgmStyle] = useState<'none' | 'cinematic' | 'lofi' | 'horror' | 'news'>('none');
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [activePlan, setActivePlan] = useState<ActivePlan | null>(() => {
    try {
      const saved = localStorage.getItem('voicewala_active_plan');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const getDailyGenerationCount = (): number => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const data = JSON.parse(localStorage.getItem('voicewala_daily_generations') || '{}');
      if (data.date === todayStr) {
        return data.count || 0;
      }
    } catch (e) {
      // ignore
    }
    return 0;
  };

  const [dailyCount, setDailyCount] = useState<number>(() => getDailyGenerationCount());

  const incrementDailyGenerationCount = () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const current = getDailyGenerationCount();
      const newCount = current + 1;
      localStorage.setItem('voicewala_daily_generations', JSON.stringify({
        date: todayStr,
        count: newCount
      }));
      setDailyCount(newCount);
    } catch (e) {
      // ignore
    }
  };

  const maxAllowedWords = activePlan ? activePlan.wordLimit : 150; // 1 Min = ~150 words
  const maxDailyGenerations = activePlan ? (activePlan.dailyGenerationsLimit || 15) : 5; // Free = 5/day

  const checkPlanLimit = (inputWordCount: number): boolean => {
    const todayCount = getDailyGenerationCount();

    // 1. Check daily count limit
    if (todayCount >= maxDailyGenerations) {
      if (!activePlan) {
        showStatus(`⚠️ Free Daily Limit Reached! (${todayCount}/${maxDailyGenerations} used today). Free limit is 1 Min audio, 5 times/day. Recharge / Activate Pack for more!`, 'error');
      } else {
        showStatus(`⚠️ Daily Limit Reached for ${activePlan.name}! (${todayCount}/${maxDailyGenerations} used today). Upgrade pack for more daily generations.`, 'error');
      }
      setShowUpiModal(true);
      return false;
    }

    // 2. Check word count / audio duration limit per voice
    if (inputWordCount > maxAllowedWords) {
      if (!activePlan) {
        showStatus(`⚠️ Free Audio Limit Exceeded (${inputWordCount} Words / ~${Math.ceil(inputWordCount / 150)} Min)! Free limit is 1 Min (150 words). Recharge / Activate Pack to unlock longer audio!`, 'error');
      } else {
        showStatus(`⚠️ Audio length exceeds ${activePlan.name} limit (${inputWordCount} Words > ${maxAllowedWords} limit)! Please upgrade pack for longer audio.`, 'error');
      }
      setShowUpiModal(true);
      return false;
    }

    return true;
  };

  const handlePlanActivated = (plan: { name: string; price: number; wordLimit: number; minuteLimit: number; dailyGenerationsLimit?: number }) => {
    const newPlanRecord: ActivePlan = {
      ...plan,
      activatedAt: new Date().toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    };
    setActivePlan(newPlanRecord);
    localStorage.setItem('voicewala_active_plan', JSON.stringify(newPlanRecord));
    showStatus(`🎉 ${plan.name} Activated! ${plan.minuteLimit} Min / ${plan.wordLimit.toLocaleString()} Words limit unlocked.`, 'success');
  };

  const [history, setHistory] = useState<SavedAudioItem[]>(() => {
    try {
      const saved = localStorage.getItem('voicewala_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [settings, setSettings] = useState<VoiceSettings>({
    lang: 'hi-IN',
    speed: 1,
    pitch: 1,
    volume: 80,
    voice: 'Puck'
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmOscsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  };

  const saveToHistory = (savedText: string, voiceName: string) => {
    try {
      const newItem: SavedAudioItem = {
        id: Date.now().toString(),
        text: savedText,
        voice: voiceName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        wordCount: savedText.trim().split(/\s+/).length,
      };
      const updated = [newItem, ...history.filter(h => h.text !== savedText).slice(0, 19)];
      setHistory(updated);
      localStorage.setItem('voicewala_history', JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save to history:", e);
    }
  };

  const insertTag = (tag: string) => {
    const textarea = document.getElementById('main-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = text.substring(start, end);

      let replacement = '';
      if (tag === '[pause]') replacement = ' [pause] ';
      else if (tag === '[pause: 2s]') replacement = ' [pause: 2s] ';
      else if (tag === '[whisper]') replacement = selected ? `[whisper]${selected}[/whisper]` : ' [whisper]यहाँ फुसफुसाती बात[/whisper] ';
      else if (tag === '[excited]') replacement = selected ? `[excited]${selected}[/excited]` : ' [excited]यहाँ जोशीली बात[/excited] ';
      else if (tag === '[dramatic]') replacement = selected ? `[dramatic]${selected}[/dramatic]` : ' [dramatic]यहाँ ड्रामाटिक बात[/dramatic] ';
      else if (tag === '[slow]') replacement = selected ? `[slow]${selected}[/slow]` : ' [slow]यहाँ धीमी बात[/slow] ';
      else if (tag === '[fast]') replacement = selected ? `[fast]${selected}[/fast]` : ' [fast]यहाँ तेज़ बात[/fast] ';

      const newText = text.substring(0, start) + replacement + text.substring(end);
      setText(newText);
      showStatus(`Added ${tag} tag!`, 'info');
    } else {
      setText(prev => prev + ` ${tag} `);
    }
  };

  const playVoiceSample = async (voiceId: string) => {
    const sampleSentences: Record<string, string> = {
      'Kore': 'नमस्ते! मैं कोरे हूँ, आपकी ऑल-राउंडर AI वॉइस।',
      'Puck': 'नमस्ते! मैं पक् हूँ, बिल्कुल नैचुरल पुरुष आवाज़।',
      'Charon': 'नमस्कार! कैरोन की डीप बैरिटोन आवाज़ में आपका स्वागत है।',
      'Fenrir': 'नमस्ते! मैं फेनरिर हूँ, पूरे जोश और उत्साह के साथ।',
      'Aoede': 'नमस्ते! मैं आयोड हूँ, कोमल और शांत महिला स्वर।',
      'Priya': 'नमस्कार! यह प्रिया है, आज की मुख्य खबरों के साथ।',
      'Ananya': 'हाय दोस्तों! मैं अनन्या हूँ, चलिए कुछ मज़ेदार बनाते हैं!',
      'Kavya': 'नमस्कार! मैं काव्या हूँ, कहानियों की मधुर आवाज़।',
      'Sunita': 'नमस्कार, कॉर्पोरेट प्रेजेंटेशन में आपका स्वागत है।',
      'Riya': 'हेलो दोस्तों! मैं आरजे रिया, रेडियो सिटी में आपका स्वागत है!',
      'Shalini': 'नमस्कार बच्चों! आज हम विज्ञान के बारे में पढ़ेंगे।'
    };

    const sampleText = sampleSentences[voiceId] || 'नमस्ते! यह AI वॉइस का सैंपल टेस्ट है।';
    showStatus(`🔊 Playing voice sample for ${voiceId}...`, 'info');

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          lang: settings.lang,
          voice: voiceId,
          fastMode: true
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      }
    } catch (e) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sampleText);
        u.lang = settings.lang;
        window.speechSynthesis.speak(u);
      }
    }
  };

  const startBgMusic = (ctx: AudioContext, style: string, destinationGain: GainNode) => {
    if (style === 'none') return null;

    try {
      const bgGain = ctx.createGain();
      bgGain.gain.value = 0.05; // Subtle background level

      let freqs = [220, 277.18, 329.63]; // Cinematic A Major
      if (style === 'horror') freqs = [110, 116.54, 130.81]; // Dark horror sawtooth
      if (style === 'news') freqs = [261.63, 329.63, 392.00]; // Bright news synth
      if (style === 'lofi') freqs = [174.61, 220.00, 261.63]; // Chill lofi

      const oscs = freqs.map(f => {
        const osc = ctx.createOscillator();
        osc.type = style === 'horror' ? 'sawtooth' : style === 'news' ? 'square' : 'sine';
        osc.frequency.value = f;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = style === 'news' ? 800 : 400;

        osc.connect(filter);
        filter.connect(bgGain);
        osc.start(0);
        return osc;
      });

      bgGain.connect(destinationGain);

      return {
        stop: () => {
          oscs.forEach(o => {
            try { o.stop(); } catch(e) {}
          });
        }
      };
    } catch (e) {
      return null;
    }
  };

  const handleShareApp = async () => {
    const shareData = {
      title: 'VOICEWALA - AI Text to Speech',
      text: '🎙️ Voicewala AI - Convert any text to natural voiceover instantly! Free & Fast AI TTS.',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showStatus('App link shared successfully! (शेयर कर दिया गया)', 'success');
      } catch (e) {
        // User cancelled or share failed, fallback to copy
        copyAppUrl();
      }
    } else {
      copyAppUrl();
    }
  };

  const copyAppUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showStatus('📋 App Link copied! Share on WhatsApp, Telegram or SMS.', 'success');
    } catch (e) {
      showStatus(`📲 Share App Link: ${window.location.href}`, 'info');
    }
  };

  const speak = async () => {
    if (!text.trim()) return showStatus('Please enter some text!', 'error');

    if (containsAdultContent(text)) {
      return showStatus('🔞 Adult & sexually explicit content is strictly prohibited. (अश्लील/वयस्क कंटेंट जनरेट करना सख्त मना है)', 'error');
    }

    const wordCount = text.trim().split(/\s+/).length;
    if (!checkPlanLimit(wordCount)) return;

    incrementDailyGenerationCount();

    stop();

    setIsSpeaking(true);
    if (wordCount > 250) {
      showStatus(`⚡ Superfast Mode: Synthesizing voice for ${wordCount} words...`, 'info');
    } else {
      showStatus('Generating natural AI voice...', 'info');
    }

    try {
      let response: Response | null = null;
      const ttsEndpoints = ['/api/tts', '/.netlify/functions/tts'];

      for (const ep of ttsEndpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              lang: settings.lang,
              voice: settings.voice,
              fastMode: text.length > 400
            })
          });
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              response = res;
              break;
            }
          }
        } catch (e) {
          // try next
        }
      }

      if (!response) {
        throw new Error('Server audio endpoint not reachable');
      }

      const blob = await response.blob();

      // Web Audio API for guaranteed distinct male/female pitch and tone tuning
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = settings.speed;

          // Pitch shift in cents (100 cents = 1 semitone)
          let detuneCents = 0;
          if (settings.voice === 'Charon') {
            detuneCents = -380; // Deep Baritone Male
          } else if (settings.voice === 'Puck') {
            detuneCents = -180; // Clear Natural Male
          } else if (settings.voice === 'Fenrir') {
            detuneCents = -240; // Strong Expressive Male
          } else if (settings.voice === 'Aoede') {
            detuneCents = +180; // Soft Gentle Female
          } else if (settings.voice === 'Priya') {
            detuneCents = +80;  // Confident News Anchor Female
          } else if (settings.voice === 'Ananya') {
            detuneCents = +320; // Cheerful Young Girl Voice
          } else if (settings.voice === 'Kavya') {
            detuneCents = -60;  // Warm Melodic Storyteller Woman
          } else if (settings.voice === 'Sunita') {
            detuneCents = +120; // Professional Corporate Female
          } else if (settings.voice === 'Riya') {
            detuneCents = +220; // Upbeat Radio Jockey Female
          } else if (settings.voice === 'Shalini') {
            detuneCents = +140; // Clear Teacher Female
          } else {
            detuneCents = +20;  // Natural Clear Female (Kore)
          }

          if (settings.pitch !== 1) {
            detuneCents += (settings.pitch - 1) * 500;
          }

          source.detune.value = detuneCents;

          // Frequency equalizer filter for voice realism
          const filter = ctx.createBiquadFilter();
          if (settings.voice === 'Charon' || settings.voice === 'Puck' || settings.voice === 'Fenrir') {
            filter.type = 'lowshelf';
            filter.frequency.value = 400;
            filter.gain.value = 6; // Deep male vocal resonance
          } else if (settings.voice === 'Ananya' || settings.voice === 'Riya') {
            filter.type = 'highshelf';
            filter.frequency.value = 3000;
            filter.gain.value = 5; // Young girl / RJ voice sparkle
          } else if (settings.voice === 'Kavya') {
            filter.type = 'peaking';
            filter.frequency.value = 800;
            filter.gain.value = 4; // Storyteller warmth
          } else {
            filter.type = 'highshelf';
            filter.frequency.value = 2400;
            filter.gain.value = 3; // Clear female vocal brilliance
          }

          const gainNode = ctx.createGain();
          gainNode.gain.value = settings.volume / 100;

          source.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);

          sourceNodeRef.current = source;

          source.onended = () => {
            setIsSpeaking(false);
          };

          source.start(0);
          setIsSpeaking(true);
          saveToHistory(text, settings.voice);
          showStatus('AI Voice started speaking!', 'success');
          return;
        } catch (audioErr) {
          console.warn("Web Audio API processing fallback:", audioErr);
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const audioObj = new Audio(objectUrl);

      audioObj.volume = settings.volume / 100;
      audioObj.playbackRate = settings.speed;

      audioObj.oncanplaythrough = () => {
        audioObj.playbackRate = settings.speed;
      };

      audioObj.onplay = () => {
        setIsSpeaking(true);
      };

      audioObj.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(objectUrl);
      };

      audioObj.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        showStatus('Error playing voice!', 'error');
        URL.revokeObjectURL(objectUrl);
      };

      audioRef.current = audioObj;
      await audioObj.play();

      showStatus('AI Voice started speaking!', 'success');
    } catch (err: any) {
      console.error(err);
      if ('speechSynthesis' in window) {
        showStatus('Playing voice via fallback synthesizer...', 'info');
        speakWithBrowserTTS();
      } else {
        setIsSpeaking(false);
        showStatus(`Failed to generate voice: ${err.message}`, 'error');
      }
    }
  };

  const speakWithBrowserTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const langObj = LANGUAGES.find(l => l.code === settings.lang) || LANGUAGES[0];
      const voiceObj = AI_VOICES.find(v => v.id === settings.voice) || AI_VOICES[0];
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.lang;
      utterance.rate = langObj.r * settings.speed;
      utterance.pitch = langObj.p * settings.pitch * voiceObj.pitchOffset;
      utterance.volume = settings.volume / 100;

      const voices = window.speechSynthesis.getVoices();
      const langVoices = voices.filter(v => v.lang === settings.lang || v.lang.startsWith(settings.lang.split('-')[0]));
      
      const isFemale = voiceObj.id === 'Kore' || voiceObj.id === 'Aoede';
      let preferredVoice = langVoices.find(v => 
        isFemale ? (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Natural'))
                 : (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Mark'))
      ) || langVoices[0];

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        showStatus('Speech Error!', 'error');
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const stop = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch(e) {}
      audioCtxRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleRewrite = async () => {
    if (!text.trim()) return;
    if (containsAdultContent(text)) {
      return showStatus('🔞 Adult or sexually explicit content is strictly prohibited. (अश्लील/वयस्क कंटेंट अलाउड नहीं है)', 'error');
    }
    setIsRewriting(true);
    try {
      const rewritten = await rewriteText(text, 'natural', settings.lang);
      setText(rewritten);
      showStatus('Text rewritten with AI magic!', 'success');
    } catch (e) {
      showStatus('AI Rewrite failed', 'error');
    } finally {
      setIsRewriting(false);
    }
  };

  // Helper to encode AudioBuffer to a standard 16-bit PCM WAV Blob for browser download
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result: Float32Array;
    if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      result = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
        result[i * 2] = left[i];
        result[i * 2 + 1] = right[i];
      }
    } else {
      result = buffer.getChannelData(0);
    }

    const dataLength = result.length * 2;
    const headerLength = 44;
    const wav = new Uint8Array(headerLength + dataLength);
    const view = new DataView(wav.buffer);

    const writeString = (v: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([wav], { type: 'audio/wav' });
  };

  // Client-Side Superfast TTS Audio Generator for Netlify / Static Hosting Deployments
  const generateClientSideAudioDownload = async () => {
    const wordCount = text.trim().split(/\s+/).length;
    if (!checkPlanLimit(wordCount)) return;

    incrementDailyGenerationCount();

    showStatus('⚡ Superfast Mode: Generating audio file directly in browser...', 'info');
    const cleanLang = (settings.lang || 'hi-IN').split('-')[0];
    
    // Sanitize text from bullet symbols and tags
    const cleanText = text
      .replace(/[•·*#_~`]/g, ' ')
      .replace(/\[\/?(pause|slow|fast|dramatic|whisper|excited|sad)(:\d+s)?\]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) throw new Error('Text is empty!');

    // Split text into ~180 char chunks cut cleanly at sentence endings or spaces
    const maxLen = 180;
    const chunks: string[] = [];
    let remaining = cleanText;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let cutIdx = remaining.lastIndexOf(' ', maxLen);
      if (cutIdx <= 0) cutIdx = maxLen;
      chunks.push(remaining.slice(0, cutIdx).trim());
      remaining = remaining.slice(cutIdx).trim();
    }

    // Voice mapping for StreamElements fallback
    const voiceName = cleanLang === 'hi' ? 'Aditi' :
                      cleanLang === 'ta' ? 'Valluvar' :
                      cleanLang === 'fr' ? 'Mathieu' :
                      cleanLang === 'es' ? 'Conchita' :
                      cleanLang === 'de' ? 'Hans' : 'Brian';

    // Single chunk downloader with 7s timeout for mobile 4G networks
    const fetchSingleChunk = async (chunk: string, index: number): Promise<{ index: number; buffer: ArrayBuffer | null }> => {
      if (!chunk.trim()) return { index, buffer: null };
      const encoded = encodeURIComponent(chunk);
      const rawGtUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${cleanLang}&client=gtx`;

      const endpoints = [
        `/.netlify/functions/tts?text=${encoded}&lang=${cleanLang}`,
        `/api/tts?text=${encoded}&lang=${cleanLang}`,
        `https://api.streamelements.com/kappa/v2/speech?voice=${voiceName}&text=${encoded}`,
        rawGtUrl,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rawGtUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(rawGtUrl)}`
      ];

      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          const res = await fetch(ep, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              const buf = await res.arrayBuffer();
              if (buf && buf.byteLength > 100) {
                return { index, buffer: buf };
              }
            }
          }
        } catch (e) {
          // continue to next endpoint
        }
      }
      return { index, buffer: null };
    };

    // Parallel Worker Batches (3 concurrent requests for smooth mobile execution)
    const BATCH_SIZE = 3;
    const audioBuffers: (ArrayBuffer | null)[] = new Array(chunks.length).fill(null);
    let completed = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batchChunks.map((c, idx) => fetchSingleChunk(c, i + idx));
      const results = await Promise.all(batchPromises);

      for (const res of results) {
        audioBuffers[res.index] = res.buffer;
        completed++;
      }
      const pct = Math.round((completed / chunks.length) * 100);
      showStatus(`⚡ Generating Audio: ${pct}% complete...`, 'info');
    }

    const validBuffers = audioBuffers.filter((b): b is ArrayBuffer => b !== null && b.byteLength > 100);

    if (validBuffers.length === 0) {
      throw new Error("Could not download audio stream. Please check internet connection.");
    }

    // Process array buffers with AudioContext to compile into a single downloadable WAV file
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        const tempCtx = new AudioCtx();
        const decodedBuffers: AudioBuffer[] = [];

        for (const buf of validBuffers) {
          const decoded = await tempCtx.decodeAudioData(buf.slice(0));
          decodedBuffers.push(decoded);
        }

        let totalDuration = 0;
        for (const b of decodedBuffers) {
          totalDuration += b.duration;
        }

        const sampleRate = decodedBuffers[0].sampleRate;
        const totalSamples = Math.ceil(totalDuration * sampleRate);
        const mergedBuffer = tempCtx.createBuffer(1, totalSamples, sampleRate);
        const mergedChannel = mergedBuffer.getChannelData(0);

        let offset = 0;
        for (const b of decodedBuffers) {
          const channelData = b.getChannelData(0);
          mergedChannel.set(channelData, offset);
          offset += channelData.length;
        }

        await tempCtx.close();

        // Convert merged AudioBuffer to WAV Blob
        const wavBlob = audioBufferToWav(mergedBuffer);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

        const a = document.createElement('a');
        a.href = url;
        a.download = `voicewala_${settings.voice}_${Date.now()}.wav`;
        a.click();

        showStatus('Audio download started successfully!', 'success');
        return;
      } catch (procErr) {
        console.warn("AudioContext processing fallback:", procErr);
      }
    }

    // Combined Blob fallback
    const combinedBlob = new Blob(validBuffers, { type: 'audio/mp3' });
    const url = URL.createObjectURL(combinedBlob);
    setAudioUrl(url);

    const a = document.createElement('a');
    a.href = url;
    a.download = `voicewala_${settings.voice}_${Date.now()}.mp3`;
    a.click();

    showStatus('Audio download started successfully!', 'success');
  };

  const generateDownload = async () => {
    if (!text.trim()) return showStatus('Write text first!', 'error');
    if (containsAdultContent(text)) {
      return showStatus('🔞 Adult or sexually explicit content is strictly prohibited. (अश्लील/वयस्क कंटेंट अलाउड नहीं है)', 'error');
    }

    const wordCount = text.trim().split(/\s+/).length;
    if (!checkPlanLimit(wordCount)) return;

    incrementDailyGenerationCount();

    setIsSynthesizing(true);
    
    showStatus(`⚡ Generating superfast audio for ${wordCount} words...`, 'info');

    const apiEndpoints = [
      '/api/generate-tts',
      '/.netlify/functions/generate-tts',
      '/.netlify/functions/tts'
    ];

    for (const ep of apiEndpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            lang: settings.lang,
            voice: settings.voice,
            fastMode: true
          })
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            const ext = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'wav';
            const blob = await response.blob();
            if (blob && blob.size > 100) {
              const url = URL.createObjectURL(blob);
              setAudioUrl(url);

              const a = document.createElement('a');
              a.href = url;
              a.download = `voicewala_${settings.voice}_${Date.now()}.${ext}`;
              a.click();
              
              saveToHistory(text, settings.voice);
              showStatus('Audio download started!', 'success');
              setIsSynthesizing(false);
              return;
            }
          }
        }
      } catch (e) {
        // try next endpoint
      }
    }

    console.warn("Server endpoints unreachable. Falling back to client-side audio worker...");
    try {
      await generateClientSideAudioDownload();
    } catch (fallbackErr: any) {
      console.error(fallbackErr);
      showStatus(`Download Error: ${fallbackErr.message || 'Failed to generate audio'}`, 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/20 text-slate-900 bg-slate-100">
      {/* Background Gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-indigo-50/70 via-slate-100 to-slate-100 pointer-events-none" />

      <main className="container max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header id="app-header" className="flex flex-col items-center mb-8 text-center relative">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            {/* Top Single Prominent Recharge Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUpiModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer transition-all border border-white/30"
            >
              <Wallet className="w-4 h-4 text-amber-300 animate-bounce" />
              <span>💳 Recharge / Pack Activate</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 rounded-md font-black">₹10 - ₹99</span>
            </motion.button>

            {/* Active Plan Indicator Badge */}
            {activePlan ? (
              <div className="px-3 py-1.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>⚡ Active: {activePlan.name} ({dailyCount}/{maxDailyGenerations} Today, {activePlan.minuteLimit} Min Max)</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-[11px] font-black flex items-center gap-1">
                <span>🆓 Free Tier: 1 Min Limit ({dailyCount}/5 Used Today)</span>
              </div>
            )}

            {/* Smart Tools Header Quick Buttons */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowHistoryModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-2xl text-xs font-extrabold flex items-center gap-1.5 border-2 border-slate-200 shadow-sm cursor-pointer transition-all"
            >
              <History className="w-4 h-4 text-indigo-600" />
              <span>📜 History ({history.length})</span>
            </motion.button>

            {/* Share App Quick Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShareApp}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-2xl text-xs font-black flex items-center gap-1.5 border-2 border-indigo-200 shadow-sm cursor-pointer transition-all"
            >
              <Share2 className="w-4 h-4 text-indigo-600" />
              <span>📲 शेयर ऐप (Share App)</span>
            </motion.button>

            {/* Exit / Reset App Quick Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setText('');
                setShowScriptModal(false);
                setShowDialogueModal(false);
                setShowHistoryModal(false);
                setShowUpiModal(false);
                showStatus('एप्लीकेशन रीसेट हो गई! (App Reset)', 'info');
              }}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl text-xs font-black flex items-center gap-1.5 border-2 border-rose-200 shadow-sm cursor-pointer transition-all"
            >
              <X className="w-4 h-4 text-rose-600" />
              <span>⬅️ बाहर निकलें (Exit / Reset)</span>
            </motion.button>
          </div>

          <motion.div 
            id="logo-icon"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/30"
          >
            <Mic2 className="w-7 h-7 text-white" />
          </motion.div>
          <motion.h1 
            id="main-title"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl md:text-4xl font-black tracking-tight text-slate-900"
          >
            VOICEWALA
          </motion.h1>
          <p id="app-subtitle" className="text-sm text-slate-600 font-bold mt-1">Simple & Powerful AI Text to Speech</p>
        </header>

        {/* Clean Single-Column Core Container */}
        <div className="space-y-5">
          {/* Main Text Area Card */}
          <section id="editor-section" className="bg-white rounded-2xl p-5 md:p-6 border-2 border-slate-200 shadow-md relative space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <Activity className="w-4 h-4 text-indigo-600" /> Enter Text / यहाँ टेक्स्ट लिखें
              </span>
              <button 
                id="clear-text-btn" 
                onClick={() => setText('')} 
                title="Clear text"
                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>

            <textarea
              id="main-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें... Type or paste any text here..."
              className="w-full bg-slate-50 border-2 border-slate-300 focus:bg-white rounded-xl p-4 text-base md:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 min-h-[170px] resize-none transition-all leading-relaxed font-medium"
            />

            <div className="mt-2 text-xs font-mono text-slate-600 font-bold flex justify-between items-center">
              <span>{text.trim() ? text.trim().split(/\s+/).length : 0} Words | {text.length} Chars</span>
              <span className="text-emerald-700 font-bold">Auto Long Text Processing</span>
            </div>
          </section>

          {/* Essential Quick Controls */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-indigo-600" /> Select Language
              </label>
              <select 
                value={settings.lang}
                onChange={(e) => setSettings({...settings, lang: e.target.value})}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer shadow-sm"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Mic2 className="w-4 h-4 text-indigo-600" /> Select Voice</span>
                <button
                  type="button"
                  onClick={() => playVoiceSample(settings.voice)}
                  className="text-[10px] font-bold text-indigo-700 uppercase bg-indigo-100 hover:bg-indigo-200 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>🔊 Preview Sample</span>
                </button>
              </label>
              <select 
                value={settings.voice}
                onChange={(e) => setSettings({...settings, voice: e.target.value})}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer shadow-sm"
              >
                <optgroup label="👩 महिला आवाजें (Female / Ladies Voices)">
                  {AI_VOICES.filter(v => v.gender === 'female').map(v => (
                    <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                  ))}
                </optgroup>
                <optgroup label="👨 पुरुष आवाजें (Male Voices)">
                  {AI_VOICES.filter(v => v.gender === 'male').map(v => (
                    <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Collapsible Speed, Audio Sliders & BGM Mixer */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" /> Audio Speed, Pitch & BGM Mixer
              </span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4 text-slate-700" /> : <ChevronDown className="w-4 h-4 text-slate-700" />}
            </button>

            <AnimatePresence>
              {showAdvancedSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 border-t border-slate-200 bg-slate-50 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><FastForward className="w-3.5 h-3.5 text-indigo-600" /> Speed</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.speed}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2" step="0.1" value={settings.speed}
                        onChange={(e) => setSettings({...settings, speed: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5 text-indigo-600" /> Pitch</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.pitch}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2" step="0.1" value={settings.pitch}
                        onChange={(e) => setSettings({...settings, pitch: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5 text-indigo-600" /> Volume</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.volume}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={settings.volume}
                        onChange={(e) => setSettings({...settings, volume: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Background Music (BGM) Track Selector */}
                  <div className="pt-3 border-t border-slate-200">
                    <label className="text-xs font-extrabold text-slate-800 mb-1.5 block flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-purple-600" /> 🎵 Background Music (BGM Track)
                    </label>
                    <select
                      value={bgmStyle}
                      onChange={(e: any) => setBgmStyle(e.target.value)}
                      className="w-full bg-white border-2 border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                      <option value="none">🔇 No BGM (केवल वाइस)</option>
                      <option value="cinematic">🎬 Inspiring Cinematic BGM (शांत सिनेमाटिक)</option>
                      <option value="lofi">☕ Chill Lofi Lounge BGM (लो-फाई रिलैक्स)</option>
                      <option value="horror">👻 Dark Horror & Suspense BGM (हॉरर सस्पेंस)</option>
                      <option value="news">📰 News Studio BGM (न्यूज़ स्टूडियो टोन)</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Bar */}
          <div id="action-bar" className="flex flex-wrap gap-3 items-center justify-between bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md">
            <div className="flex gap-2 w-full sm:w-auto">
              {!isSpeaking ? (
                <motion.button
                  id="speak-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={speak}
                  className="flex-1 sm:flex-initial px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all text-base cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" /> Speak Voice
                </motion.button>
              ) : (
                <motion.button
                  id="stop-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stop}
                  className="flex-1 sm:flex-initial px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-red-600/30 transition-all text-base cursor-pointer"
                >
                  <Square className="w-5 h-5 fill-current" /> Stop
                </motion.button>
              )}
            </div>

            <motion.button
              id="export-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSynthesizing}
              onClick={generateDownload}
              className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50 text-sm cursor-pointer"
            >
              {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download Audio
            </motion.button>
          </div>

          {/* Status Message */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`p-3.5 rounded-xl flex items-center gap-3 font-bold text-xs md:text-sm border-2 ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                  status.type === 'error' ? 'bg-red-50 text-red-800 border-red-300' :
                  'bg-indigo-50 text-indigo-900 border-indigo-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  status.type === 'success' ? 'bg-emerald-600 animate-pulse' :
                  status.type === 'error' ? 'bg-red-600' :
                  'bg-indigo-600 animate-pulse'
                }`} />
                {status.msg}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Clean Minimal Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600 text-xs">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-700">Voicewala AI Studio</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowUpiModal(true)}
              className="font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-current" /> Support / UPI Pay
            </button>
            <div className="font-mono text-[10px] font-bold text-slate-500">
              &copy; {new Date().getFullYear()} VOICEWALA SYSTEM
            </div>
          </div>
        </footer>

        {/* Direct UPI Payment Modal */}
        <UpiPaymentModal
          isOpen={showUpiModal}
          onClose={() => setShowUpiModal(false)}
          onSuccessStatus={(msg) => showStatus(msg, 'success')}
          onPlanActivated={handlePlanActivated}
        />

        {/* 1-Click AI Script Generator Modal */}
        <AiScriptGeneratorModal
          isOpen={showScriptModal}
          onClose={() => setShowScriptModal(false)}
          language={settings.lang}
          onScriptGenerated={(genScript) => {
            setText(genScript);
            showStatus('✨ AI Script generated & loaded into editor!', 'success');
          }}
        />

        {/* Multi-Voice Dialogue Creator Modal */}
        <DialogueBuilderModal
          isOpen={showDialogueModal}
          onClose={() => setShowDialogueModal(false)}
          voices={AI_VOICES}
          onSendToEditor={(stitchedText) => {
            setText(stitchedText);
            showStatus('🎭 Multi-character dialogue loaded into editor!', 'success');
          }}
        />

        {/* Saved Audio & Script History Modal */}
        <VoiceHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          history={history}
          onClearHistory={() => {
            setHistory([]);
            localStorage.removeItem('voicewala_history');
            showStatus('History cleared!', 'info');
          }}
          onLoadText={(historicalText, voiceName) => {
            setText(historicalText);
            const foundVoice = AI_VOICES.find(v => v.label.includes(voiceName) || v.id === voiceName);
            if (foundVoice) setSettings(prev => ({ ...prev, voice: foundVoice.id }));
            showStatus('Loaded saved text into editor!', 'success');
          }}
        />
      </main>
    </div>
  );
}
