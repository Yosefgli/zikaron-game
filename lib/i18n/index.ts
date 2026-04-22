import { he } from './translations/he'
import { en } from './translations/en'
import { ru } from './translations/ru'

type Translations = typeof he

const translations: Record<string, Translations> = { he, en, ru }

// Returns translation object for a given language, defaulting to Hebrew
export function getT(language: string): Translations {
  return translations[language] ?? translations['he']
}

// RTL languages
const RTL_LANGS = new Set(['he', 'ar', 'fa'])
export function isRtl(language: string): boolean {
  return RTL_LANGS.has(language)
}
