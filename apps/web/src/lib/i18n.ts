import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import sq from '../locales/sq.json'

const STORAGE_KEY = 'mg_teacher_lang'

export type Language = 'en' | 'sq'

export function getSavedLanguage(): Language {
  return (localStorage.getItem(STORAGE_KEY) as Language) ?? 'en'
}

export function saveLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang)
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sq: { translation: sq },
  },
  lng:           getSavedLanguage(),
  fallbackLng:   'en',
  interpolation: { escapeValue: false },
})

export default i18n
