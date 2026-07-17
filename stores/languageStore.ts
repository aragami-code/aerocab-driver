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
      t: translations.fr as Translations,
      setLang: (lang) => set({ lang, t: translations[lang] as Translations }),
      toggle: () =>
        set((state) => {
          const langs: Lang[] = ['fr', 'en', 'ar', 'es', 'zh'];
          const idx = langs.indexOf(state.lang);
          const next = langs[(idx + 1) % langs.length];
          return { lang: next, t: translations[next] as Translations };
        }),
    }),
    {
      name: 'aerogo24-driver-language',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lang: state.lang }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.t = translations[state.lang] as Translations;
        }
      },
    }
  )
);
