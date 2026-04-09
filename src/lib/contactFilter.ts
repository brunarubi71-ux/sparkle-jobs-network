// Anti-bypass: detect phone numbers, emails, WhatsApp mentions
const CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /whatsapp/i, /telegram/i, /signal/i,
  /\+\d{1,3}\s?\d{4,}/,
  /venmo/i, /cashapp/i, /zelle/i, /paypal/i,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(pattern => pattern.test(text));
}

export function maskContactInfo(text: string): string {
  let masked = text;
  masked = masked.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "***-***-****");
  masked = masked.replace(/\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, "(***) ***-****");
  masked = masked.replace(/\+\d{1,3}\s?\d{4,}/g, "+** ****");
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "****@****.***");
  return masked;
}

/** Validate text input and return error message if contact info detected */
export function validateNoContactInfo(text: string): string | null {
  if (containsContactInfo(text)) {
    return "External contact sharing is not allowed.";
  }
  return null;
}
