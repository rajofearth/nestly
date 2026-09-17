import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getCircleMembers,
  insertAlert,
  requireCircleUser,
} from "./lib/helpers";
import { queuePush } from "./push";

export const list = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { token, limit }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    // Alerts addressed to the whole circle (no toUserId) or to me directly.
    const recent = await ctx.db
      .query("alerts")
      .withIndex("by_circle_ts", (q) => q.eq("circleId", circleId))
      .order("desc")
      .take(200);
    const mine = recent.filter(
      (alert) => alert.toUserId === undefined || alert.toUserId === user._id,
    );
    return mine.slice(0, limit ?? 100);
  },
});

// Notification cursor query for the background task. It asks for everything
// newer than the last seen timestamp and decides locally what to notify.
export const since = query({
  args: { token: v.string(), since: v.optional(v.number()) },
  handler: async (ctx, { token, since }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const recent = await ctx.db
      .query("alerts")
      .withIndex("by_circle_ts", (q) => q.eq("circleId", circleId))
      .order("desc")
      .take(50);
    const members = await getCircleMembers(ctx, circleId);
    const names = new Map(members.map((m) => [m._id, m.name] as const));
    return recent
      .filter(
        (alert) =>
          alert.ts > (since ?? 0) &&
          alert.fromUserId !== user._id &&
          (alert.toUserId === undefined || alert.toUserId === user._id),
      )
      .map((alert) => ({
        _id: alert._id,
        type: alert.type,
        fromUserId: alert.fromUserId,
        fromName: names.get(alert.fromUserId) ?? "Someone",
        ts: alert.ts,
        payload: alert.payload,
      }));
  },
});

export const markRead = mutation({
  args: { token: v.string(), alertId: v.id("alerts") },
  handler: async (ctx, { token, alertId }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const alert = await ctx.db.get(alertId);
    if (
      !alert ||
      alert.circleId !== circleId ||
      (alert.toUserId !== undefined && alert.toUserId !== user._id)
    ) {
      throw new Error("Alert not found");
    }
    if (!alert.read) {
      await ctx.db.patch(alertId, { read: true });
    }
  },
});

export const sos = mutation({
  args: { token: v.string(), payload: v.optional(v.any()) },
  handler: async (ctx, { token, payload }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    await insertAlert(ctx, {
      circleId,
      type: "sos",
      fromUserId: user._id,
      payload: payload ?? {},
    });
    const others = (await getCircleMembers(ctx, circleId)).filter(
      (m) => m._id !== user._id && m.pushToken !== undefined,
    );
    await queuePush(
      ctx,
      others.map((m) => m._id),
      `SOS from ${user.name}`,
      `${user.name} triggered an SOS alert`,
      { kind: "sos", userId: user._id },
    );
  },
});
