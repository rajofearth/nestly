import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  genCode,
  getCircleMembers,
  insertAlert,
  publicUser,
  requireCircleUser,
  requireUser,
} from "./lib/helpers";
import { queuePush } from "./push";

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { token, name, role }) => {
    const user = await requireUser(ctx, token);
    if (user.circleId) throw new Error("Already in a circle");
    const circleId = await ctx.db.insert("circles", {
      name,
      code: genCode(),
      ownerId: user._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(user._id, { circleId, role, isOwner: true });
    return { circleId };
  },
});

export const join = mutation({
  args: {
    token: v.string(),
    code: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { token, code, role }) => {
    const user = await requireUser(ctx, token);
    if (user.circleId) throw new Error("Already in a circle");
    const circle = await ctx.db
      .query("circles")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!circle) throw new Error("Circle not found");
    await ctx.db.patch(user._id, { circleId: circle._id, role });
    await insertAlert(ctx, {
      circleId: circle._id,
      type: "memberJoined",
      fromUserId: user._id,
      payload: { name: user.name },
    });
    const others = (await getCircleMembers(ctx, circle._id)).filter(
      (m) => m._id !== user._id && m.pushToken !== undefined,
    );
    await queuePush(
      ctx,
      others.map((m) => m._id),
      `${user.name} joined ${circle.name}`,
      "A new member joined your circle",
      { kind: "memberJoined", userId: user._id },
    );
    return { circleId: circle._id, circle };
  },
});

export const leave = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    if (!user.circleId) throw new Error("Not in a circle");
    await ctx.db.patch(user._id, { circleId: undefined, isOwner: false });
  },
});

export const removeMember = mutation({
  args: { token: v.string(), memberId: v.id("users") },
  handler: async (ctx, { token, memberId }) => {
    const user = await requireUser(ctx, token);
    if (!user.circleId) throw new Error("Not in a circle");
    const circle = await ctx.db.get(user.circleId);
    if (!circle) throw new Error("Circle not found");
    if (circle.ownerId !== user._id) throw new Error("Only the owner can remove members");
    if (memberId === user._id) throw new Error("Cannot remove yourself");
    const member = await ctx.db.get(memberId);
    if (!member || member.circleId !== circle._id) {
      throw new Error("Member not in your circle");
    }
    await ctx.db.patch(memberId, { circleId: undefined, isOwner: false });
  },
});

export const regenerateCode = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    if (!user.circleId) throw new Error("Not in a circle");
    const circle = await ctx.db.get(user.circleId);
    if (!circle) throw new Error("Circle not found");
    if (circle.ownerId !== user._id) throw new Error("Only the owner can regenerate the code");
    await ctx.db.patch(circle._id, { code: genCode() });
  },
});

export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token);
    if (!user.circleId) return null;
    const circle = await ctx.db.get(user.circleId);
    if (!circle) return null;
    const members = (await getCircleMembers(ctx, circle._id)).map(publicUser);
    const places = await ctx.db
      .query("places")
      .withIndex("by_circle", (q) => q.eq("circleId", circle._id))
      .collect();
    return { circle, members, placesCount: places.length };
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const circle = await ctx.db
      .query("circles")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    return circle ? { name: circle.name } : null;
  },
});
