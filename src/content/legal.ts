// Legal markdown content. The English version is the legally binding text;
// PT/ES are provided for convenience only. Each translated document carries
// a notice at the top reminding users of that fact.
//
// To pick the right version at render time, call `getLegal(key, language)`.
// The Terms / Privacy / Cancellation page components do this automatically.

import type { Language } from "@/i18n/translations";
import { TERMS_OF_SERVICE_EN, PRIVACY_POLICY_EN, CANCELLATION_POLICY_EN } from "./legal/en";
import { TERMS_OF_SERVICE_PT, PRIVACY_POLICY_PT, CANCELLATION_POLICY_PT } from "./legal/pt";
import { TERMS_OF_SERVICE_ES, PRIVACY_POLICY_ES, CANCELLATION_POLICY_ES } from "./legal/es";

export type LegalKey = "terms" | "privacy" | "cancellation";

const docs: Record<LegalKey, Record<Language, string>> = {
  terms: { en: TERMS_OF_SERVICE_EN, pt: TERMS_OF_SERVICE_PT, es: TERMS_OF_SERVICE_ES },
  privacy: { en: PRIVACY_POLICY_EN, pt: PRIVACY_POLICY_PT, es: PRIVACY_POLICY_ES },
  cancellation: { en: CANCELLATION_POLICY_EN, pt: CANCELLATION_POLICY_PT, es: CANCELLATION_POLICY_ES },
};

export function getLegal(key: LegalKey, language: Language): string {
  return docs[key][language] ?? docs[key].en;
}

// Re-exports for any older imports.
export const TERMS_OF_SERVICE = TERMS_OF_SERVICE_EN;
export const PRIVACY_POLICY = PRIVACY_POLICY_EN;
export const CANCELLATION_POLICY = CANCELLATION_POLICY_EN;
