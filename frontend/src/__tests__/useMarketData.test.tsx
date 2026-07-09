import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMarketData } from "@/hooks/useMarketData";

// EventSource mock that captures the "price" listener so tests can dispatch updates.
let priceListener: ((e: MessageEvent) => void) | null = null;

class MockEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  addEventListener = vi.fn((type: string, listener: (e: MessageEvent) => void) => {
    if (type === "price") priceListener = listener;
  });
  removeEventListener = vi.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
}

function emitPrice(ticker: string, price: number, timestamp: string) {
  const event = new MessageEvent("price", {
    data: JSON.stringify({
      ticker,
      price,
      previous_price: price,
      timestamp,
      direction: "flat",
    }),
  });
  act(() => {
    priceListener?.(event);
  });
}

describe("useMarketData", () => {
  beforeEach(() => {
    priceListener = null;
    vi.stubGlobal("EventSource", MockEventSource);
  });

  it("accumulates price history across updates", async () => {
    const { result } = renderHook(() => useMarketData());
    await waitFor(() => expect(priceListener).not.toBeNull());

    emitPrice("AAPL", 100, "2026-07-10T00:00:00Z");
    emitPrice("AAPL", 101, "2026-07-10T00:00:01Z");

    expect(result.current.priceHistory.AAPL).toHaveLength(2);
    expect(result.current.priceHistory.AAPL[1].price).toBe(101);
  });

  it("keeps accumulating after a snapshot is frozen (no 'object is not extensible')", async () => {
    const { result } = renderHook(() => useMarketData());
    await waitFor(() => expect(priceListener).not.toBeNull());

    emitPrice("MSFT", 200, "2026-07-10T00:00:00Z");

    // Simulate a consumer freezing the snapshot it received (e.g. via a chart lib).
    const snapshot = result.current.priceHistory;
    Object.freeze(snapshot);
    Object.freeze(snapshot.MSFT);

    // Further updates must not throw and must keep growing history.
    expect(() =>
      emitPrice("MSFT", 201, "2026-07-10T00:00:01Z"),
    ).not.toThrow();

    expect(result.current.priceHistory.MSFT).toHaveLength(2);
    expect(result.current.priceHistory.MSFT[1].price).toBe(201);
  });
});
