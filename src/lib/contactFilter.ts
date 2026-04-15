// Advanced anti-off-platform contact detection system
// Detects phone numbers, emails, social media, disguised numbers, and payment apps

// Word-to-digit mapping for disguised numbers
const WORD_DIGITS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  oh: "0", o: "0", ten: "10",
};

// Convert word-based numbers to digits for detection
function wordsToDigits(text: string): string {
  let result = text.toLowerCase();
  for (const [word, digit] of Object.entries(WORD_DIGITS)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  return result;
}

// Normalize leet speak and symbol substitutions
function normalizeLeetSpeak(text: string): string {
  return text
    .replace(/[@]/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t");
}

export type ViolationType = "phone" | "email" | "social_media" | "payment_app" | "disguised_number" | "social_handle";

interface DetectionResult {
  detected: boolean;
  types: ViolationType[];
  severity: number; // 1-3
}

// Phone number patterns (US, BR, international)
const PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,
  /\+\d{1,3}\s?\(?\d{2,3}\)?\s?\d{4,5}[-.\s]?\d{4}/,
  /\+\d{1,3}\s?\d{4,}/,
  /\b\d{10,11}\b/,
  // Spaced out digits (e.g. "3 1 0 5 5 5 1 2 3 4")
  /\b\d\s\d\s\d\s\d\s\d\s\d\s\d/,
];

// Email patterns
const EMAIL_PATTERNS = [
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/,
  /\b[A-Za-z0-9._%+\-]+\s*@\s*[A-Za-z0-9.\-]+\s*\.\s*[A-Za-z]{2,}\b/,
  // "at gmail dot com" style
  /\b\w+\s+at\s+\w+\s+dot\s+(com|net|org|io|co)\b/i,
];

// Social media keywords
const SOCIAL_PATTERNS = [
  /whatsapp/i, /whats\s*app/i, /wpp/i,
  /telegram/i, /tele\s*gram/i,
  /signal\s*(app)?/i,
  /instagram/i, /insta\s*gram/i, /\bIG\b/,
  /facebook/i, /\bFB\b/,
  /snapchat/i, /\bsnap\b/i,
  /tiktok/i, /tik\s*tok/i,
  /twitter/i, /\b𝕏\b/,
  /linkedin/i,
  /discord/i,
  /messenger/i,
];

// Social handles (@username style)
const HANDLE_PATTERNS = [
  /@[A-Za-z0-9_]{3,30}\b/,
];

// Payment app keywords
const PAYMENT_PATTERNS = [
  /venmo/i, /cashapp/i, /cash\s*app/i,
  /zelle/i, /paypal/i, /pay\s*pal/i,
  /pix/i, /\bpicpay\b/i,
  /\$[a-zA-Z][a-zA-Z0-9]{2,}/,  // $cashtag
];

export function detectContactInfo(text: string): DetectionResult {
  const types: ViolationType[] = [];
  let severity = 0;

  const normalized = normalizeLeetSpeak(text);
  const withDigits = wordsToDigits(text);

  // Check phone numbers
  if (PHONE_PATTERNS.some(p => p.test(text) || p.test(withDigits))) {
    types.push("phone");
    severity = Math.max(severity, 3);
  }

  // Check disguised numbers (word-based)
  const digitized = wordsToDigits(text);
  const digitOnly = digitized.replace(/[^\d]/g, "");
  if (digitOnly.length >= 7 && /\b(zero|one|two|three|four|five|six|seven|eight|nine|oh)\b/i.test(text)) {
    types.push("disguised_number");
    severity = Math.max(severity, 3);
  }

  // Check emails
  if (EMAIL_PATTERNS.some(p => p.test(text) || p.test(normalized))) {
    types.push("email");
    severity = Math.max(severity, 3);
  }

  // Check social media
  if (SOCIAL_PATTERNS.some(p => p.test(text) || p.test(normalized))) {
    types.push("social_media");
    severity = Math.max(severity, 2);
  }

  // Check social handles
  if (HANDLE_PATTERNS.some(p => p.test(text))) {
    types.push("social_handle");
    severity = Math.max(severity, 2);
  }

  // Check payment apps
  if (PAYMENT_PATTERNS.some(p => p.test(text) || p.test(normalized))) {
    types.push("payment_app");
    severity = Math.max(severity, 3);
  }

  return { detected: types.length > 0, types, severity };
}

// Legacy compatibility
export function containsContactInfo(text: string): boolean {
  return detectContactInfo(text).detected;
}

export function maskContactInfo(text: string): string {
  let masked = text;
  masked = masked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
  masked = masked.replace(/\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, "(***) ***-****");
  masked = masked.replace(/\+\d{1,3}\s?\d{4,}/g, "+** ****");
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "****@****.***");
  masked = masked.replace(/@[A-Za-z0-9_]{3,30}\b/g, "@*****");
  masked = masked.replace(/\$[a-zA-Z][a-zA-Z0-9]{2,}/g, "$*****");
  return masked;
}

export function validateNoContactInfo(text: string): string | null {
  const result = detectContactInfo(text);
  if (result.detected) {
    return "External contact sharing is not allowed.";
  }
  return null;
}
