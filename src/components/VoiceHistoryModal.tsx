import React from 'react';
import { History, Trash2, Download, Play, X, Music, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export interface SavedAudioItem {
  id: string;
  text: string;
  voice: string;
  timestamp: string;
  wordCount: number;
}

interface VoiceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedAudioItem[];
  onClearHistory: () => void;
  onLoadText: (text: string, voice: string) => void;
}

export default function VoiceHistoryModal({ isOpen, onClose, history, onClearHistory, onLoadText }: VoiceHistoryModalProps) {
  if (!isOpen) return null;

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
        className="bg-white rounded-3xl max-w-lg w-full p-6 border-2 border-indigo-200 shadow-2xl space-y-4 relative max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                <span> Saved Voice History (इतिहास)</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">आपके पिछले जनरेट किए गए ऑडियो सहेजे गए हैं</p>
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

        {/* History List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {history.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Music className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-500">अभी तक कोई ऑडियो इतिहास सहेजा नहीं गया है</p>
              <p className="text-[11px] text-slate-400">जब आप ऑडियो जनरेट करेंगे, तो यहाँ दिखेगा!</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50 hover:bg-indigo-50/50 border-2 border-slate-200 hover:border-indigo-300 rounded-2xl transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-600" /> {item.timestamp}
                  </span>
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-extrabold">
                    🗣️ {item.voice} ({item.wordCount} Words)
                  </span>
                </div>

                <p className="text-xs text-slate-800 font-medium line-clamp-2 leading-relaxed bg-white p-2 rounded-xl border border-slate-200">
                  "{item.text}"
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      onLoadText(item.text, item.voice);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>पुनः इस्तेमाल करें (Re-use)</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold">कुल सहेजे गए: {history.length}</span>
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>हिस्ट्री साफ़ करें (Clear)</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>❌ बाहर निकलें / Close Modal</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
