import { create } from 'zustand';

interface ChatState {
  unreadCount: number;
  bookingUnread: Record<string, number>;
  incrementBooking: (bookingId: string) => void;
  resetBooking: (bookingId: string) => void;
  resetAll: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  unreadCount: 0,
  bookingUnread: {},
  incrementBooking: (bookingId) => set((s) => ({
    bookingUnread: { ...s.bookingUnread, [bookingId]: (s.bookingUnread[bookingId] ?? 0) + 1 },
    unreadCount: s.unreadCount + 1,
  })),
  resetBooking: (bookingId) => set((s) => {
    const prev = s.bookingUnread[bookingId] ?? 0;
    const next = { ...s.bookingUnread };
    delete next[bookingId];
    return { bookingUnread: next, unreadCount: Math.max(0, s.unreadCount - prev) };
  }),
  resetAll: () => set({ unreadCount: 0, bookingUnread: {} }),
}));
