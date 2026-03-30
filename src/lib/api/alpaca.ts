const ALPACA_PAPER_BASE = "https://paper-api.alpaca.markets";
const ALPACA_LIVE_BASE = "https://api.alpaca.markets";

interface AlpacaConfig {
  apiKey: string;
  secretKey: string;
  paper: boolean;
}

function getBaseUrl(paper: boolean): string {
  return paper ? ALPACA_PAPER_BASE : ALPACA_LIVE_BASE;
}

async function alpacaFetch<T>(
  config: AlpacaConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBaseUrl(config.paper);
  const res = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: {
      "APCA-API-KEY-ID": config.apiKey,
      "APCA-API-SECRET-KEY": config.secretKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getAccount(config: AlpacaConfig) {
  return alpacaFetch<any>(config, "/v2/account");
}

export async function getPositions(config: AlpacaConfig) {
  return alpacaFetch<any[]>(config, "/v2/positions");
}

export async function getOrders(config: AlpacaConfig, status = "all", limit = 20) {
  return alpacaFetch<any[]>(config, `/v2/orders?status=${status}&limit=${limit}`);
}

export async function submitOrder(
  config: AlpacaConfig,
  order: {
    symbol: string;
    qty: number;
    side: "buy" | "sell";
    type?: "market" | "limit";
    time_in_force?: "day" | "gtc";
    limit_price?: number;
  }
) {
  return alpacaFetch<any>(config, "/v2/orders", {
    method: "POST",
    body: JSON.stringify({
      symbol: order.symbol,
      qty: String(order.qty),
      side: order.side,
      type: order.type || "market",
      time_in_force: order.time_in_force || "day",
      ...(order.limit_price && { limit_price: String(order.limit_price) }),
    }),
  });
}

export async function cancelOrder(config: AlpacaConfig, orderId: string) {
  const base = getBaseUrl(config.paper);
  const res = await fetch(`${base}/v2/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      "APCA-API-KEY-ID": config.apiKey,
      "APCA-API-SECRET-KEY": config.secretKey,
    },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Alpaca cancel error: ${res.status}`);
  }
  return { success: true };
}
