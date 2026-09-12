import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCircleUser } from "./lib/helpers";

const MAX_TEXT_LENGTH = 2000;
const KEEP_LAST = 300;

export const list = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_circle_ts", (q) => q.eq("circleId", circleId))
      .order("desc")
      .take(limit ?? 100);
    return messages.reverse();
  },
});

export const send = mutation({
  args: { token: v.string(), text: v.string() },
  handler: async (ctx, { token, text }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const trimmed = text.trim();
    if (trimmed.length === 0) throw new Error("Message is empty");
    if (trimmed.length > MAX_TEXT_LENGTH) {
      throw new Error("Message too long");
    }
    await ctx.db.insert("messages", {
      circleId,
      userId: user._id,
      text: trimmed,
      ts: Date.now(),
    });
    // Keep only the last 300 messages per circle.
    const all = await ctx.db
      .query("messages")
      .withIndex("by_circle_ts", (q) => q.eq("circleId", circleId))
      .order("desc")
      .collect();
    for (const message of all.slice(KEEP_LAST)) {
      await ctx.db.delete(message._id);
    }
  },
});
