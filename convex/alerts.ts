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
