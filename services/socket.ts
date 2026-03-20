import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') ?? '';

class SocketService {
  private socket: Socket | null = null;
  private _token: string | null = null;

  /** Connecte (ou retourne la socket existante). Passer token à la première connexion. */
  connect(token?: string): Socket {
    if (token) this._token = token;

    if (this.socket?.connected) return this.socket;

    // Nettoyer la socket périmée avant de recréer
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: this._token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
    });

    this.socket.on('connect', () =>
      console.log('[Socket] connecté', this.socket?.id),
    );
    this.socket.on('disconnect', (reason) =>
      console.log('[Socket] déconnecté', reason),
    );
    this.socket.on('connect_error', (e) =>
      console.warn('[Socket] erreur', e.message),
    );

    return this.socket;
  }

  /** Rejoindre la room du chauffeur (utiliser le driverId du profil, pas le JWT). */
  joinDriverRoom(driverId: string) {
    this.socket?.emit('join:driver', { driverId });
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this._token = null;
  }
}

export const socketService = new SocketService();
