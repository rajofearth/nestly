import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCircleMembers,
  insertAlert,
  requireCircleUser,
} from "./lib/helpers";
import { queuePush } from "./push";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    return await ctx.db
      .query("places")
      .withIndex("by_circle", (q) => q.eq("circleId", circleId))
      .collect();
  },
});

export const add = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    emoji: v.string(),
    lat: v.number(),
    lng: v.number(),
    radiusM: v.optional(v.number()),
    notifyOnArrive: v.optional(v.boolean()),
    notifyOnLeave: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, name, emoji, lat, lng, radiusM, notifyOnArrive, notifyOnLeave }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const placeId = await ctx.db.insert("places", {
      circleId,
      name,
      emoji,
      lat,
      lng,
      radiusM: radiusM ?? 150,
      notifyOnArrive: notifyOnArrive ?? false,
      notifyOnLeave: notifyOnLeave ?? false,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    return { placeId };
  },
});

export const remove = mutation({
  args: { token: v.string(), placeId: v.id("places") },
  handler: async (ctx, { token, placeId }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    const place = await ctx.db.get(placeId);
    if (!place || place.circleId !== circleId) {
      throw new Error("Place not found in your circle");
    }
    // Clean up the place's event history along with it.
    const events = await ctx.db
      .query("placeEvents")
      .withIndex("by_place", (q) => q.eq("placeId", placeId))
      .collect();
    for (const event of events) {
      await ctx.db.delete(event._id);
    }
    await ctx.db.delete(placeId);
  },
});

export const events = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    const recentEvents = await ctx.db
      .query("placeEvents")
      .withIndex("by_circle_ts", (q) => q.eq("circleId", circleId))
      .order("desc")
      .take(limit ?? 50);
    const members = await getCircleMembers(ctx, circleId);
    const names = new Map(members.map((m) => [m._id, m.name]));
    return recentEvents.map((event) => ({
      ...event,
      memberName: names.get(event.userId) ?? "Unknown",
    }));
  },
});

// Client detects enter/exit geofences; the server just records the event and
// fans out an alert + push when the place has notifications enabled.
export const recordPlaceEvent = mutation({
  args: {
    token: v.string(),
    placeId: v.id("places"),
    type: v.union(v.literal("arrive"), v.literal("leave")),
  },
  handler: async (ctx, { token, placeId, type }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const place = await ctx.db.get(placeId);
    if (!place || place.circleId !== circleId) {
      throw new Error("Place not found in your circle");
    }
    await ctx.db.insert("placeEvents", {
      circleId,
      userId: user._id,
      placeId,
      type,
      ts: Date.now(),
    });
    const notify = type === "arrive" ? place.notifyOnArrive : place.notifyOnLeave;
    if (notify) {
      await insertAlert(ctx, {
        circleId,
        type,
        fromUserId: user._id,
        payload: { placeId, placeName: place.name, emoji: place.emoji },
      });
      const verb = type === "arrive" ? "arrived at" : "left";
      const others = (await getCircleMembers(ctx, circleId)).filter(
        (m) => m._id !== user._id && m.pushToken !== undefined,
      );
      await queuePush(
        ctx,
        others.map((m) => m._id),
        `${place.emoji} ${user.name} ${verb} ${place.name}`,
        "Location update",
        { kind: type, placeId, placeName: place.name },
      );
    }
  },
});
