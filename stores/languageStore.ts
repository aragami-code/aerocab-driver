import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations, { Lang, Translations } from '../lib/i18n';

interface LanguageState {
  lang: Lang;
  t: Translations;
  setLang: (lang: Lang) => void;
  toggle: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: 'fr',
      t: translations.fr,
      setLang: (lang) => set({ lang, t: translations[lang] }),
      toggle: () =>
        set((state) => {
          const next: Lang = state.lang === 'fr' ? 'en' : 'fr';
          return { lang: next, t: translations[next] };
        }),
    }),
    {
      name: 'landingride-language',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lang: state.lang }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = translations[state.lang];
        }
      },
    }
  )
);
