import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCircleUser, requireUser } from "./lib/helpers";

export const heartbeat = mutation({
  args: {
    token: v.string(),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.optional(v.number()),
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),
    battery: v.optional(v.number()),
    isCharging: v.optional(v.boolean()),
    isLowPower: v.optional(v.boolean()),
    deviceModel: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...presence }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.patch(user._id, { ...presence, lastSeen: Date.now() });
  },
});

export const breadcrumb = mutation({
  args: {
    token: v.string(),
    lat: v.number(),
    lng: v.number(),
    speed: v.number(),
  },
  handler: async (ctx, { token, lat, lng, speed }) => {
    const user = await requireUser(ctx, token);
    if (!user.circleId) throw new Error("Not in a circle");
    await ctx.db.insert("breadcrumbs", {
      circleId: user.circleId,
      userId: user._id,
      lat,
      lng,
      speed,
      ts: Date.now(),
    });
    // Keep only the last 200 breadcrumbs per user.
    const crumbs = await ctx.db
      .query("breadcrumbs")
      .withIndex("by_user_ts", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    for (const crumb of crumbs.slice(200)) {
      await ctx.db.delete(crumb._id);
    }
  },
});

export const breadcrumbsForUser = query({
  args: { token: v.string(), userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { token, userId, limit }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    const crumbs = await ctx.db
      .query("breadcrumbs")
      .withIndex("by_user_ts", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.min(limit ?? 100, 200));
    return crumbs.filter((c) => c.circleId === circleId);
  },
});
