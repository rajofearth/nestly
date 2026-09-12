import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { insertAlert, requireCircleUser } from "./lib/helpers";
import { queuePush } from "./push";

export const request = mutation({
  args: { token: v.string(), targetId: v.id("users") },
  handler: async (ctx, { token, targetId }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    if (targetId === user._id) throw new Error("Cannot request a check-in from yourself");
    const target = await ctx.db.get(targetId);
    if (!target || target.circleId !== circleId) {
      throw new Error("Target not in your circle");
    }
    const requestId = await ctx.db.insert("checkinRequests", {
      circleId,
      requestedBy: user._id,
      targetId,
      status: "pending",
      ts: Date.now(),
    });
    await insertAlert(ctx, {
      circleId,
      type: "checkin",
      fromUserId: user._id,
      toUserId: targetId,
      payload: { kind: "request", requestId },
    });
    if (target.pushToken !== undefined) {
      await queuePush(
        ctx,
        [targetId],
        `${user.name} asked for a check-in`,
        "Let the family know you are OK",
        { kind: "checkinRequest", requestId },
      );
    }
    return { requestId };
  },
});

export const respond = mutation({
  args: { token: v.string(), status: v.union(v.literal("ok")) },
  handler: async (ctx, { token, status }) => {
    const { user, circleId } = await requireCircleUser(ctx, token);
    const pending = await ctx.db
      .query("checkinRequests")
      .withIndex("by_target_status", (q) =>
        q.eq("targetId", user._id).eq("status", "pending"),
      )
      .order("desc")
      .collect();
    const latest = pending[0];
    if (!latest) throw new Error("No pending check-in request");
    await ctx.db.patch(latest._id, {
      status,
      respondedTs: Date.now(),
    });
    await insertAlert(ctx, {
      circleId,
      type: "checkin",
      fromUserId: user._id,
      toUserId: latest.requestedBy,
      payload: { kind: "responded", requestId: latest._id },
    });
    const requester = await ctx.db.get(latest.requestedBy);
    if (requester && requester.pushToken !== undefined) {
      await queuePush(
        ctx,
        [requester._id],
        `${user.name} checked in`,
        "They marked themselves as OK",
        { kind: "checkinResponded", requestId: latest._id },
      );
    }
  },
});

export const pendingForMe = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireCircleUser(ctx, token);
    return await ctx.db
      .query("checkinRequests")
      .withIndex("by_target_status", (q) =>
        q.eq("targetId", user.user._id).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

export const pendingForCircle = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const { circleId } = await requireCircleUser(ctx, token);
    return await ctx.db
      .query("checkinRequests")
      .withIndex("by_circle_status", (q) =>
        q.eq("circleId", circleId).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});
