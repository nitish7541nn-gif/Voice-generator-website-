export function checkExplicitContent(text: string): { isExplicit: boolean; reason: string } {
  if (!text) return { isExplicit: false, reason: "" };
  const lower = text.toLowerCase();

  const nsfwPatterns = [
    /\bsex\b/i,
    /\bsexual\b/i,
    /\bsexually\b/i,
    /\bporn\b/i,
    /\bporno\b/i,
    /\bpornography\b/i,
    /\bxxx\b/i,
    /\berotic\b/i,
    /\berotica\b/i,
    /\bhentai\b/i,
    /\bintercourse\b/i,
    /\borgasm\b/i,
    /\bnsfw\b/i,
    /\bnude\b/i,
    /\bnudity\b/i,
    /\bboobs?\b/i,
    /\bvagina\b/i,
    /\bpenis\b/i,
    /\bdick\b/i,
    /\bpussy\b/i,
    /\bmasturbat\w*/i,
    /\bejaculat\w*/i,
    /\bhardcore\b/i,
    /\bprostitut\w*/i,
    /\bescort\w*/i,
    /\bincest\b/i,
    /सेक्स/i,
    /पोर्न/i,
    /अश्लील/i,
    /चुदाई/i,
    /चोद/i,
    /भोसड़ी/i,
    /गांड/i,
    /लंड/i,
    /छूत/i,
    /हवस/i,
    /मुठ/i,
    /ब्लू फिल्म/i,
    /\bchudai\b/i,
    /\bchodai\b/i,
    /\bgaand\b/i,
    /\blund\b/i,
    /\bchoot\b/i,
    /\bmuth\b/i,
    /\bblue film\b/i,
    /\bhot sex\b/i,
    /\badult content\b/i
  ];

  const matched = nsfwPatterns.some((pattern) => pattern.test(lower));
  if (matched) {
    return {
      isExplicit: true,
      reason: "🚫 यौन या अश्लील (NSFW/Adult) सामग्री वॉइसवाला में प्रतिबंधित है। कृपया केवल स्वच्छ और सुरक्षित कंटेंट दर्ज करें।"
    };
  }

  return { isExplicit: false, reason: "" };
}
