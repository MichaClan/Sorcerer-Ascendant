import { createHmac } from "crypto";

export class GoPusherServer {
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {}
  
publish(channel: string, event: string, data: unknown): Promise<void>

  async publish(
    channel: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        event,
        data: JSON.stringify(data),
      }),
    });
    if (!res.ok) {
      throw new Error(`Go-Pusher publish mislukt: ${res.status}`);
    }
  }

  /** Onderteken een kanaal-autorisatie (voor privé/presence) */
  authenticate(
    socketId: string,
    channelName: string,
    channelData?: string,
  ): { auth: string; channel_data?: string } {
    let stringToSign = `${socketId}:${channelName}`;
    if (channelData) stringToSign += `:${channelData}`;

    const auth = createHmac("sha256", this.apiKey)
      .update(stringToSign)
      .digest("hex");

    return {
      auth,
      ...(channelData && { channel_data: channelData }),
    };
  }
}

// Maak één instantie aan en exporteer die:
export const pusher = new GoPusherServer(
  process.env.GOPUSHER_API_KEY!, // 27c20461ba26160af1b31f7934aadccf41fb0af6ed98be975872df4469d8b90f
  process.env.GOPUSHER_URL!,     // https://wilson-pusherr.eduinsights.nl
);