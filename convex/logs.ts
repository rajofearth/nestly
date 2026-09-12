import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const post = mutation({
  args: {
    level: v.union(
      v.literal("crash"),
      v.literal("error"),
      v.literal("warn"),
      v.literal("info"),
    ),
    tag: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    device: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    userIdTokenHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      ts: Date.now(),
      level: args.level,
      tag: args.tag.slice(0, 64),
      message: args.message.slice(0, 2000),
      stack: args.stack ? args.stack.slice(0, 8000) : undefined,
      device: args.device ? args.device.slice(0, 200) : undefined,
      appVersion: args.appVersion ? args.appVersion.slice(0, 32) : undefined,
      userIdTokenHash: args.userIdTokenHash
        ? args.userIdTokenHash.slice(0, 16)
        : undefined,
    });
  },
});

// OPEN for dev — lock down with auth before production.
export const list = query({
  args: { n: v.optional(v.number()) },
  handler: async (ctx, { n }) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_ts")
      .order("desc")
      .take(Math.min(n ?? 50, 200));
  },
});
