import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    return this.socket;
  }

  joinDriverRoom(driverProfileId: string) {
    this.socket?.emit('driver:join', { driverProfileId });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  get instance() {
    return this.socket;
  }
}

export const socketService = new SocketService();
