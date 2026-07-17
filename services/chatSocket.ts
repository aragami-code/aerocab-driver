import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/api$/, '') ?? '';

class ChatSocketService {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(`${SOCKET_URL}/chat`, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
    });

    this.socket.on('connect',       () => console.log(`[ChatSocket] connected to ${SOCKET_URL}/chat`));
    this.socket.on('disconnect',    (r) => console.warn(`[ChatSocket] disconnected from ${SOCKET_URL}/chat — reason=${r}`));
    this.socket.on('connect_error', (e: any) => console.error(`[ChatSocket] connect_error url=${SOCKET_URL}/chat err=${e?.message ?? e} type=${e?.type ?? 'unknown'}`));
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('join', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leave', { conversationId });
  }

  sendMessage(conversationId: string, content: string, mediaUrl?: string, mediaType?: string) {
    this.socket?.emit('message', { conversationId, content, mediaUrl, mediaType });
  }

  sendTyping(conversationId: string, isTyping: boolean) {
    this.socket?.emit('typing', { conversationId, isTyping });
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const chatSocket = new ChatSocketService();
