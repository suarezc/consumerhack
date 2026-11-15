import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { paymentEvent } from "./lib/payments";

const http = httpRouter();

http.route({
  path: "/whop",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.WHOP_WEBHOOK_SECRET;
    if (process.env.WHOP_ENVIRONMENT !== "sandbox" || !secret || !process.env.WHOP_API_KEY) {
      return new Response("Sandbox payment verification is not configured", { status: 503 });
    }
    const raw = await request.text();
    if (raw.length > 262_144) return new Response("Payload too large", { status: 413 });
    let event;
    try {
      event = paymentEvent(raw, Object.fromEntries(request.headers), secret);
    } catch {
      return new Response("Invalid webhook", { status: 401 });
    }
    if (!event) return new Response("OK");
    try {
      await ctx.runAction(internal.lanterns.receivePayment, event);
    } catch {
      return new Response("Payment could not be verified", { status: 503 });
    }
    return new Response("OK");
  }),
});

export default http;
