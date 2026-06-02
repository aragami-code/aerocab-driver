import { create } from 'zustand';
import { api } from '../services/api';

type Announcement = Awaited<ReturnType<typeof api.getAnnouncementsFeed>>['announcements'][number];
type Version = { min: string; latest: string; apkUrl: string };

interface State {
  announcements: Announcement[];
  version: Version | null;
  lastFetch: number;
  fetchFeed: (token: string) => Promise<void>;
  markSeen: (token: string, id: string) => void;
}

const CACHE_MS = 5 * 60 * 1000;

export const useAnnouncementsStore = create<State>((set, get) => ({
  announcements: [],
  version: null,
  lastFetch: 0,
  fetchFeed: async (token) => {
    if (Date.now() - get().lastFetch < CACHE_MS && get().version) return;
    try {
      const res = await api.getAnnouncementsFeed(token);
      set({ announcements: res.announcements, version: res.version, lastFetch: Date.now() });
    } catch { /* garder le cache existant */ }
  },
  markSeen: (token, id) => {
    set((s) => ({ announcements: s.announcements.map(a => a.id === id ? { ...a, seen: true } : a) }));
    api.markAnnouncementSeen(token, id).catch(() => {});
  },
}));
