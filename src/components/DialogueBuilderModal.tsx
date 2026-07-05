import React, { useState } from 'react';
import { Users, Plus, Trash2, Play, Download, X, Loader2, Sparkles, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DialogueLine {
  id: string;
  speaker: string; // e.g. 'Ananya' or 'Puck'
  text: string;
}

interface DialogueBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToEditor: (stitchedText: string) => void;
  voices: { id: string; label: string; gender: string }[];
}

export default function DialogueBuilderModal({ isOpen, onClose, onSendToEditor, voices }: DialogueBuilderModalProps) {
  const [lines, setLines] = useState<DialogueLine[]>([
    { id: '1', speaker: 'Ananya', text: 'सुनो राहुल! क्या तुमने कल का मैच देखा?' },
    { id: '2', speaker: 'Puck', text: 'हाँ अनन्या! आख़िरी ओवर में तो दिल की धड़कनें रुक गई थीं!' },
    { id: '3', speaker: 'Ananya', text: 'बिल्कुल! क्या शानदार छक्का मारा था!' },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleAddLine = () => {
    const lastSpeaker = lines.length > 0 ? lines[lines.length - 1].speaker : 'Ananya';
    const nextSpeaker = lastSpeaker === 'Ananya' ? 'Puck' : 'Ananya';
    setLines([...lines, { id: Date.now().toString(), speaker: nextSpeaker, text: '' }]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines(lines.filter(l => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: 'speaker' | 'text', val: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: val } : l));
  };

  const handleTransferToEditor = () => {
    // Format dialogues into structured tagged text that VoiceWala TTS can read seamlessly
    const formattedText = lines
      .filter(l => l.text.trim().length > 0)
      .map(l => `[${l.speaker}]: ${l.text}`)
      .join('\n\n');

    onSendToEditor(formattedText);
    onClose();
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
        className="bg-white rounded-3xl max-w-xl w-full p-6 border-2 border-indigo-200 shadow-2xl space-y-4 relative max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                <span>🎭 Multi-Voice Dialogue Creator</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">दो या दो से अधिक पात्रों की बातचीत/डायलॉग बनाएं</p>
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

        {/* Lines List Scrollable Container */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {lines.map((line, index) => (
            <div
              key={line.id}
              className="p-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-2 hover:border-indigo-300 transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black flex items-center justify-center">
                    {index + 1}
                  </span>
                  <select
                    value={line.speaker}
                    onChange={(e) => handleUpdateLine(line.id, 'speaker', e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-sm"
                  >
                    <optgroup label="👩 Female Voices">
                      {voices.filter(v => v.gender === 'female').map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="👨 Male Voices">
                      {voices.filter(v => v.gender === 'male').map(v => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveLine(line.id)}
                  disabled={lines.length <= 1}
                  className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={line.text}
                onChange={(e) => handleUpdateLine(line.id, 'text', e.target.value)}
                placeholder="यहाँ इस पात्र का डायलॉग लिखें... Enter dialogue..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 min-h-[50px] resize-none font-medium"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddLine}
            className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold text-xs border-2 border-dashed border-indigo-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ अगला डायलॉग जोड़ें (Add Next Dialogue Line)</span>
          </button>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-slate-200 shrink-0 space-y-2">
          <button
            type="button"
            onClick={handleTransferToEditor}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs md:text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>एडीटर में ट्रांसफर करें (Load Dialogue into Editor)</span>
          </button>

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
