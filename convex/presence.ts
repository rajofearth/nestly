import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCircleUser, requireUser } from "./lib/helpers";

// Sanity ceiling for GPS speed: 100 m/s is roughly 360 km/h.
const MAX_SPEED_MPS = 100;

export const heartbeat = mutation({
  args: {
    token: v.string(),
    lat: v.number(),
    lng: v.number(),
    accuracy: v.optional(v.union(v.number(), v.null())),
    speed: v.optional(v.union(v.number(), v.null())),
    heading: v.optional(v.union(v.number(), v.null())),
    battery: v.optional(v.union(v.number(), v.null())),
    isCharging: v.optional(v.union(v.boolean(), v.null())),
    isLowPower: v.optional(v.union(v.boolean(), v.null())),
    deviceModel: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    { token, lat, lng, accuracy, speed, heading, battery, isCharging, isLowPower, deviceModel },
  ) => {
    const user = await requireUser(ctx, token);
    // A null, NaN or negative speed means the device is still.
    const cleanSpeed =
      speed != null && Number.isFinite(speed)
        ? Math.min(Math.max(speed, 0), MAX_SPEED_MPS)
        : 0;
    await ctx.db.patch(user._id, {
      lat,
      lng,
      speed: cleanSpeed,
      lastSeen: Date.now(),
      ...(accuracy != null ? { accuracy } : {}),
      ...(heading != null ? { heading } : {}),
      ...(battery != null ? { battery } : {}),
      ...(isCharging != null ? { isCharging } : {}),
      ...(isLowPower != null ? { isLowPower } : {}),
      ...(deviceModel != null ? { deviceModel } : {}),
    });
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
