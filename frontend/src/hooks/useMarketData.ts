"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { ConnectionStatus } from "@/components/Header";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: string;
  direction: "up" | "down" | "flat";
}

export type PriceMap = Record<string, PriceUpdate>;
export type PriceHistory = Record<string, { price: number; time: string }[]>;

const MAX_HISTORY = 500;

export function useMarketData() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const historyRef = useRef<PriceHistory>({});
  const [historyVersion, setHistoryVersion] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/stream/prices");
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
    };

    const onPrice = (event: MessageEvent) => {
      const data = JSON.parse(event.data) as PriceUpdate | PriceUpdate[];
      const updates = Array.isArray(data) ? data : [data];

      setPrices((prev) => {
        const next = { ...prev };
        for (const u of updates) {
          next[u.ticker] = u;
        }
        return next;
      });

      // Accumulate history without mutating snapshotted arrays/objects.
      // Build a fresh history object with new arrays for changed tickers so
      // values already handed to components (and possibly frozen) stay intact.
      const prevHistory = historyRef.current;
      const nextHistory: PriceHistory = { ...prevHistory };
      for (const u of updates) {
        const existing = nextHistory[u.ticker] ?? [];
        const appended = [...existing, { price: u.price, time: u.timestamp }];
        nextHistory[u.ticker] =
          appended.length > MAX_HISTORY ? appended.slice(-MAX_HISTORY) : appended;
      }
      historyRef.current = nextHistory;
      setHistoryVersion((v) => v + 1);
    };

    es.addEventListener("price", onPrice as EventListener);

    es.onerror = () => {
      setStatus("reconnecting");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  // Snapshot ref into a render-safe value keyed on historyVersion
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const priceHistory = useMemo(() => historyRef.current, [historyVersion]);

  return {
    prices,
    connectionStatus: status,
    priceHistory,
    historyVersion,
  };
}
