import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Copy, Check, QrCode, Smartphone, Sparkles, 
  Settings, Heart, ShieldCheck, ArrowRight, Wallet, CheckCircle2
} from 'lucide-react';

interface UpiPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessStatus?: (msg: string) => void;
  onPlanActivated?: (plan: { name: string; price: number; wordLimit: number; minuteLimit: number }) => void;
}

export default function UpiPaymentModal({ isOpen, onClose, onSuccessStatus, onPlanActivated }: UpiPaymentModalProps) {
  // Official Fixed App Receiver UPI ID (Navi / PhonePe / Google Pay / Paytm)
  const cleanUpi = '7541022323@nyes';
  const cleanName = 'Voicewala AI';

  const [amount, setAmount] = useState<number>(29);
  const [customAmount, setCustomAmount] = useState<string>('29');
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [verified, setVerified] = useState(false);

  // Ensure stale custom UPI IDs in localStorage are cleaned up
  useEffect(() => {
    localStorage.setItem('voicewala_upi_id', cleanUpi);
    localStorage.setItem('voicewala_payee_name', cleanName);
  }, []);

  if (!isOpen) return null;

  const handleAmountChange = (val: number) => {
    setAmount(val);
    setCustomAmount(val.toString());
  };

  const handleCustomAmount = (val: string) => {
    setCustomAmount(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    }
  };

  const amountFormatted = amount.toFixed(2);

  const getPackDetails = (amt: number) => {
    if (amt <= 10) return { name: '₹10 Starter Pack', price: 10, wordLimit: 750, minuteLimit: 5, dailyGenerationsLimit: 15 };
    if (amt <= 29) return { name: '₹29 Best Value Pack', price: 29, wordLimit: 2250, minuteLimit: 15, dailyGenerationsLimit: 30 };
    if (amt <= 49) return { name: '₹49 Pro Pack', price: 49, wordLimit: 4500, minuteLimit: 30, dailyGenerationsLimit: 50 };
    return { name: '₹99 Unlimited Pack', price: 99, wordLimit: 9000, minuteLimit: 60, dailyGenerationsLimit: 100 };
  };

  const activatePlanNow = (customRef?: string) => {
    const pack = getPackDetails(amount);
    if (onPlanActivated) {
      onPlanActivated(pack);
    }
    setVerified(true);
    const refText = customRef || utrNumber || 'UTR-VERIFIED';
    if (onSuccessStatus) {
      onSuccessStatus(`🎉 ${pack.name} Activated Successfully! (${pack.minuteLimit} Min / ${pack.wordLimit.toLocaleString()} Words Limit Active)`);
    }
  };

  // Standard NPCI compliant UPI URI
  const upiUri = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${amountFormatted}&cu=INR&tn=${encodeURIComponent('Voicewala AI Recharge')}&tr=VW${Date.now()}`;
  
  // QR Code URL via QRServer API (strictly formatted)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiUri)}&margin=10`;

  const handleAppPayment = async (packageName?: string, appName: string = 'UPI App') => {
    // Copy UPI ID to clipboard
    try {
      await navigator.clipboard.writeText(cleanUpi);
    } catch (e) {
      console.warn("Clipboard copy skipped:", e);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);

    if (onSuccessStatus) {
      onSuccessStatus(`UPI ID (${cleanUpi}) copied! Opening ${appName}...`);
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const baseParams = `pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(cleanName)}&am=${amountFormatted}&cu=INR&tn=${encodeURIComponent('Voicewala AI')}&tr=VW${Date.now()}`;

    if (isAndroid && packageName) {
      // Android Intent protocol directly targets app without triggering "Invalid UPI link"
      const intentUrl = `intent://pay?${baseParams}#Intent;scheme=upi;package=${packageName};end;`;
      window.location.href = intentUrl;
    } else {
      // Standard universal NPCI UPI URI
      window.location.href = `upi://pay?${baseParams}`;
    }
  };

  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(cleanUpi);
    } catch (e) {
      console.warn("Clipboard copy skipped:", e);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    if (onSuccessStatus) onSuccessStatus('UPI ID copied to clipboard!');
  };

  const handleVerifyUTR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim() || utrNumber.length < 6) {
      alert('Kripya 12-digit UTR / Reference ID darj karein!');
      return;
    }
    activatePlanNow(utrNumber.trim());
  };

  return (
    <AnimatePresence>
      <div 
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden my-6"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white relative">
            <button 
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded-xl transition-all text-xs flex items-center gap-1 cursor-pointer shadow-md"
            >
              <X className="w-4 h-4" />
              <span>बाहर निकलें (Exit)</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-md">
                <Wallet className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h2 className="text-xl font-black flex items-center gap-2">
                  Direct UPI Pay <span className="bg-emerald-500/30 text-emerald-200 text-xs px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">Official Voicewala Gateway</span>
                </h2>
                <p className="text-xs text-indigo-100 font-medium mt-0.5">Pay directly via PhonePe, Google Pay & Paytm</p>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {!verified ? (
              <>
                {/* Amount Selectors */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      1. Select Recharge Pack (प्लांस और टाइम लिमिट चुनें)
                    </label>
                    <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Free: 2 Min Limit
                    </span>
                  </div>

                  {/* Pricing Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {[
                      { amt: 10, time: '5 Min Audio', words: '750 Words', gens: '15 Gens/Day', validity: '7 Days Valid', tag: 'Basic' },
                      { amt: 29, time: '15 Min Audio', words: '2,250 Words', gens: '30 Gens/Day', validity: '28 Days Valid', tag: '⭐ Best Value' },
                      { amt: 49, time: '30 Min Audio', words: '4,500 Words', gens: '50 Gens/Day', validity: '30 Days Valid', tag: 'Pro Pack' },
                      { amt: 99, time: '60 Min Audio', words: '9,000 Words', gens: '100 Gens/Day', validity: '60 Days Valid', tag: 'Unlimited' },
                    ].map((pack) => (
                      <button
                        key={pack.amt}
                        onClick={() => handleAmountChange(pack.amt)}
                        className={`p-2.5 rounded-2xl font-bold text-left transition-all border-2 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                          amount === pack.amt 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/30' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div>
                          <div className={`text-[9px] uppercase tracking-wider font-extrabold mb-0.5 ${amount === pack.amt ? 'text-indigo-200' : 'text-indigo-600'}`}>
                            {pack.tag}
                          </div>
                          <div className="text-base font-black">₹{pack.amt}</div>
                        </div>
                        <div className="mt-2 pt-1 border-t border-slate-200/30 text-[11px] font-bold">
                          <div>⏱️ {pack.time}</div>
                          <div className={`text-[10px] ${amount === pack.amt ? 'text-indigo-100' : 'text-slate-500'}`}>⚡ {pack.gens}</div>
                          <div className={`text-[10px] mt-0.5 font-extrabold ${amount === pack.amt ? 'text-amber-200' : 'text-amber-600'}`}>📅 {pack.validity}</div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Free vs Paid Limit Comparison Table */}
                  <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-amber-50 border-2 border-indigo-200/80 rounded-2xl p-3 text-xs space-y-2 mb-3">
                    <div className="font-black text-indigo-950 flex items-center justify-between">
                      <span className="flex items-center gap-1">✨ SELECT RECHARGE PACK (प्लान और टाइम लिमिट चुनें)</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-300 font-extrabold px-2 py-0.5 rounded-full">Free: 1 Min / 5 Gens/Day</span>
                    </div>

                    <div className="text-[11px] text-slate-700 font-medium leading-relaxed bg-white/70 p-2 rounded-xl border border-indigo-100 space-y-1">
                      <div><span className="font-extrabold text-indigo-900">⚡ Smart YouTuber Protection Policy:</span></div>
                      <div className="text-[10px] text-slate-700 font-medium bg-amber-50/80 px-2 py-1.5 rounded-lg border border-amber-200 leading-normal">
                        • <b>Free Plan:</b> Max 1 Min per audio, Max 5 Generations/Day.<br/>
                        • <b>Recharge Packs:</b> High audio lengths (up to 60 min) + 15 to 100 Daily Generations for YouTubers.
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-[10px] sm:text-[11px] text-slate-700 border-t border-indigo-200/60 pt-2">
                      <div className="font-bold text-slate-500">Plan</div>
                      <div className="font-bold text-slate-500">Per Voice Limit</div>
                      <div className="font-bold text-slate-500">Daily Generates</div>
                      <div className="font-bold text-slate-500">Validity (वैधता)</div>

                      <div className="font-bold text-slate-600">Free (₹0)</div>
                      <div className="text-slate-800 font-medium">1 Min (150 W)</div>
                      <div className="text-slate-700 font-bold">5 / Day</div>
                      <div className="text-slate-500 font-bold">Lifetime Free</div>

                      <div className="font-bold text-purple-700">₹10 Pack</div>
                      <div className="text-purple-900 font-bold">Up to 5 Min</div>
                      <div className="text-purple-900 font-bold">15 / Day</div>
                      <div className="text-purple-900 font-extrabold">7 Days (7 दिन)</div>

                      <div className="font-bold text-emerald-700">₹29 Pack ⭐</div>
                      <div className="text-emerald-900 font-black">Up to 15 Min</div>
                      <div className="text-emerald-900 font-black text-emerald-600">30 / Day (YouTuber)</div>
                      <div className="text-emerald-900 font-black">28 Days (1 महिना)</div>

                      <div className="font-bold text-blue-700">₹49 Pack</div>
                      <div className="text-blue-900 font-bold">Up to 30 Min</div>
                      <div className="text-blue-900 font-black text-emerald-600">50 / Day (Pro)</div>
                      <div className="text-blue-900 font-bold">30 Days (1 महिना)</div>

                      <div className="font-bold text-amber-700">₹99 Pack</div>
                      <div className="text-amber-900 font-black">Up to 60 Min</div>
                      <div className="text-amber-900 font-black text-emerald-600">100 / Day (VIP)</div>
                      <div className="text-amber-900 font-black">60 Days (2 महीने)</div>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => handleCustomAmount(e.target.value)}
                      placeholder="Enter Custom Amount"
                      className="w-full pl-8 pr-4 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Direct Mobile UPI Pay Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>2. Direct Payment Buttons (Mobile Friendly)</span>
                    <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Instant Redirect</span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* PhonePe */}
                    <button
                      type="button"
                      onClick={() => handleAppPayment('com.phonepe.app', 'PhonePe')}
                      className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>PhonePe</span>
                    </button>

                    {/* Google Pay */}
                    <button
                      type="button"
                      onClick={() => handleAppPayment('com.google.android.apps.nfc.plugin.card.p2p', 'Google Pay')}
                      className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>Google Pay</span>
                    </button>

                    {/* Paytm */}
                    <button
                      type="button"
                      onClick={() => handleAppPayment('net.one97.paytm', 'Paytm')}
                      className="p-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>Paytm</span>
                    </button>

                    {/* Navi UPI */}
                    <button
                      type="button"
                      onClick={() => handleAppPayment('com.navi.passport', 'Navi UPI')}
                      className="p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/20 transition-all cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>Navi UPI</span>
                    </button>
                  </div>

                  {/* Universal Intent Button */}
                  <button
                    type="button"
                    onClick={() => handleAppPayment(undefined, 'UPI App Selector')}
                    className="mt-2.5 w-full py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Pay ₹{amount} via Any UPI App (PhonePe / GPay / Navi / Paytm)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200/90 rounded-2xl text-[11px] text-amber-900 font-medium leading-relaxed">
                    💡 <b>अगर ऐप में "Invalid UPI" एरर आए:</b> बटन दबाते ही UPI ID (<span className="font-mono font-bold">{cleanUpi}</span>) automatically Copy हो जाती है। अपने PhonePe / GPay / Navi में <b>"Pay to UPI ID"</b> ऑप्शन में जाकर <span className="font-mono font-bold">{cleanUpi}</span> पे या पेस्ट करके ₹{amount} भेजें।
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-center">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-center gap-1.5">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span>Or Scan QR Code (GPay / PhonePe / Paytm)</span>
                  </div>

                  <div className="inline-block p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-md">
                    <img 
                      src={qrCodeUrl} 
                      alt="UPI QR Code" 
                      className="w-48 h-48 mx-auto rounded-lg"
                    />
                    <div className="mt-2 text-[11px] font-mono font-bold text-slate-600">
                      Amount: <span className="text-indigo-600 font-extrabold text-xs">₹{amount}</span>
                    </div>
                  </div>

                  {/* Copy UPI ID */}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-xs font-bold text-slate-500">UPI ID:</span>
                    <code className="text-xs font-mono font-bold text-slate-800 bg-slate-200 px-2.5 py-1 rounded-lg">
                      {cleanUpi}
                    </code>
                    <button
                      onClick={copyUpi}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-all cursor-pointer text-xs flex items-center gap-1 font-bold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Submit UTR Verification Form & Instant Unlock */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <form onSubmit={handleVerifyUTR} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        12-Digit UTR / Ref No दर्ज करें (या डायरेक्ट चालू करें):
                      </label>
                      <span className="text-[10px] text-indigo-600 font-bold">12 digits in UPI History</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        placeholder="e.g. 412356789012"
                        className="flex-1 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all shrink-0"
                      >
                        Submit UTR
                      </button>
                    </div>
                  </form>

                  {/* Backup Instant Unlock Button for users who don't know UTR */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center space-y-1.5">
                    <div className="text-[11px] font-extrabold text-amber-900">
                      💡 UTR नंबर नहीं मिल रहा या पेमेंट कर दिया है?
                    </div>
                    <p className="text-[10px] text-amber-800 font-medium">
                      अगर आपने PhonePe/GPay से पेमेंट कर दिया है तो नीचे बटन दबाकर तुरंत अपना Unlimited प्लान चालू करें:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const randomUtr = 'PAY-' + Math.floor(100000000000 + Math.random() * 900000000000);
                        setUtrNumber(randomUtr);
                        activatePlanNow(randomUtr);
                      }}
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                      <span>⚡ Instant Activate Plan (बिना UTR के प्लान तुरंत चालू करें)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-300 mt-3"
                  >
                    <X className="w-4 h-4 text-slate-500" />
                    <span>❌ बाहर निकलें / Close Modal</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Payment Request Received!</h3>
                <p className="text-xs text-slate-600 max-w-xs mx-auto font-medium">
                  Aapka UTR No <span className="font-mono font-bold text-slate-800">{utrNumber}</span> submit ho gaya hai. Thank you for supporting Voicewala AI!
                </p>
                <button
                  onClick={() => {
                    setVerified(false);
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close & Continue
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
