type EventCallback = (data: any) => void;

export class GoPusherClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Map<string, Set<EventCallback>>>();
  private socketId: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedChannels = new Set<string>();
  private host: string;

  constructor(
    private clientKey: string,
    host?: string,
  ) {
    this.host = host || process.env.NEXT_PUBLIC_GOPUSHER_URL || window.location.host;
  }

  /** Verbind met Go-Pusher */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isExternal = !this.host.includes("localhost");
      const proto = (location.protocol === "https:" || isExternal) ? "wss" : "ws";
      this.ws = new WebSocket(
        `${proto}://${this.host.replace("https://", "").replace("http://", "")}/ws/app/${this.clientKey}`
      );

      this.ws.onopen = () => {
        this.pingInterval = setInterval(() => {
          this.send("pusher:ping", {});
        }, 30000);
      };

      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.event === "pusher:connection_established") {
          const d = typeof msg.data === "string"
            ? JSON.parse(msg.data) : msg.data;
          this.socketId = d.socket_id;
          resolve();
          return;
        }
        this.dispatch(msg.channel, msg.event, msg.data);
      };

      this.ws.onerror = () => reject(new Error("Verbinding mislukt"));
      this.ws.onclose = () => {
        this.cleanup();
        this.reconnectTimer = setTimeout(() => {
          this.connect().then(() => {
            this.subscribedChannels.forEach(ch => this.subscribe(ch));
          });
        }, 3000);
      };
    });
  }

  /** Abonneer op een publiek kanaal */
  subscribe(channel: string): this {
    this.subscribedChannels.add(channel);
    this.send("pusher:subscribe", { channel });
    return this;
  }

  /** Abonneer op een privé- of presence-kanaal */
  async subscribePrivate(
    channel: string,
    authEndpoint = "/api/pusher/auth",
    channelData?: { user_id: string; user_info: Record<string, any> },
  ): Promise<this> {
    const body: Record<string, string> = {
      socket_id: this.socketId!,
      channel_name: channel,
    };
    if (channelData) {
      body.channel_data = JSON.stringify(channelData);
    }
    const res = await fetch(authEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { auth, channel_data } = await res.json();

    this.subscribedChannels.add(channel);
    this.send("pusher:subscribe", {
      channel,
      auth,
      channel_data: channel_data ?? body.channel_data,
    });
    return this;
  }

  /** Luister naar een event op een kanaal */
  on(channel: string, event: string, cb: EventCallback): this {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Map());
    }
    const ch = this.listeners.get(channel)!;
    if (!ch.has(event)) ch.set(event, new Set());
    ch.get(event)!.add(cb);
    return this;
  }

  /** Stop met luisteren */
  off(channel: string, event: string, cb: EventCallback): void {
    this.listeners.get(channel)?.get(event)?.delete(cb);
  }

  /** Afmelden van een kanaal */
  unsubscribe(channel: string): void {
    this.subscribedChannels.delete(channel);
    this.listeners.delete(channel);
    this.send("pusher:unsubscribe", { channel });
  }

  /** Socket ID (nodig voor kanaal-auth) */
  getSocketId(): string | null { return this.socketId; }

  /** Verbreek de verbinding */
  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanup();
    this.ws?.close();
  }

  private send(event: string, data: any): void {
    this.ws?.send(JSON.stringify({ event, data }));
  }

  private dispatch(ch: string, ev: string, data: any): void {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    this.listeners.get(ch)?.get(ev)?.forEach(cb => cb(parsed));
  }

  private cleanup(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.socketId = null;
  }
}