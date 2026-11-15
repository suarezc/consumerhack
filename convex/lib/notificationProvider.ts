import { notificationText } from "./notificationPolicy";

const errors = new Set([
  "DeviceNotRegistered", "MessageTooBig", "MessageRateExceeded", "MismatchSenderId",
  "InvalidCredentials", "UNAUTHORIZED",
]);

type ProviderError = { kind: "rejected"; error: string; retryable: boolean };
export type PushResult = { kind: "accepted"; ticketId: string } | ProviderError | { kind: "unknown" };
export type ReceiptResult = { kind: "handed_off" } | ProviderError | { kind: "pending" };

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function rejection(value: Record<string, unknown>): ProviderError {
  const error = record(value.details)?.error;
  const code = typeof error === "string" && errors.has(error) ? error : "ProviderRejected";
  return { kind: "rejected", error: code, retryable: code === "MessageRateExceeded" };
}

export function parsePushResult(value: unknown): PushResult {
  const data = record(record(value)?.data);
  if (data?.status === "ok" && typeof data.id === "string" && /^[\w-]{1,200}$/.test(data.id)) {
    return { kind: "accepted", ticketId: data.id };
  }
  if (data?.status === "error") return rejection(data);
  return { kind: "unknown" };
}

export function parseReceipt(value: unknown, ticketId: string): ReceiptResult {
  const receipt = record(record(record(value)?.data)?.[ticketId]);
  if (receipt?.status === "ok") return { kind: "handed_off" };
  if (receipt?.status === "error") return rejection(receipt);
  return { kind: "pending" };
}

export async function sendPush(input: {
  token: string; date: string; streak: number; accessToken?: string;
}, request: typeof fetch = fetch): Promise<PushResult> {
  try {
    const response = await request("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
      },
      body: JSON.stringify({
        to: input.token,
        body: notificationText(input.streak),
        data: { kind: "watering-streak", date: input.date },
        ttl: 0,
        priority: "high",
        collapseId: `watering-${input.date}`,
        tag: `watering-${input.date}`,
        channelId: "watering",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { kind: "unknown" };
    return parsePushResult(await response.json());
  } catch {
    return { kind: "unknown" };
  }
}

export async function getPushReceipt(ticketId: string, accessToken?: string,
  request: typeof fetch = fetch): Promise<ReceiptResult> {
  try {
    const response = await request("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ ids: [ticketId] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { kind: "pending" };
    return parseReceipt(await response.json(), ticketId);
  } catch {
    return { kind: "pending" };
  }
}
