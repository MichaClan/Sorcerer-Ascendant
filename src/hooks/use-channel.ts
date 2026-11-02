"use client";
import { useEffect, useRef } from "react";
import { GoPusherClient } from "../lib/go-pusher-client";

// Eén gedeelde verbinding per app
let client: GoPusherClient | null = null;
let connectPromise: Promise<void> | null = null;

function getClient(clientKey: string): Promise<GoPusherClient> {
  if (!client) {
    client = new GoPusherClient(clientKey);
    connectPromise = client.connect();
  }
  return connectPromise!.then(() => client!);
}

/**
 * Abonneer op een kanaal en luister naar events.
 *
 * useChannel("CLIENT_KEY", "chat", "nieuw-bericht", (data) => {
 *   setBericht(data);
 * });
 */
export function useChannel<T = any>(
  clientKey: string,
  channel: string,
  event: string,
  callback: (data: T) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

 useEffect(() => {
  let cancelled = false;

  const handler = (data: T) => {
    console.log("EVENT RECEIVED", data);

    if (!cancelled) callbackRef.current(data);
  };

  getClient(clientKey).then(c => {
    console.log("CONNECTED");
    console.log("SUBSCRIBING TO", channel, event);

    if (cancelled) return;

    c.subscribe(channel).on(channel, event, handler);
  });

  return () => {
    cancelled = true;
    client?.off(channel, event, handler);
  };
}, [clientKey, channel, event]);
}

