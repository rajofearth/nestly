import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { avatarValidator, genToken, requireUser } from "./lib/helpers";

export const register = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    roleLabel: v.optional(v.string()),
    avatar: avatarValidator,
  },
  handler: async (ctx, { name, role, roleLabel, avatar }) => {
    const userId = await ctx.db.insert("users", {
      token: genToken(),
      name,
      role,
      roleLabel,
      avatar,
      isOwner: false,
      createdAt: Date.now(),
    });
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found after insert");
    return { token: user.token, userId, user };
  },
});

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    return user ?? null;
  },
});

export const updateProfile = mutation({
  args: {
    token: v.string(),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    roleLabel: v.optional(v.string()),
    avatar: v.optional(avatarValidator),
  },
  handler: async (ctx, { token, name, role, roleLabel, avatar }) => {
    const user = await requireUser(ctx, token);
    const patch: {
      name?: string;
      role?: string;
      roleLabel?: string;
      avatar?: { shape: string; color: string; expression: string };
    } = {};
    if (name !== undefined) patch.name = name;
    if (role !== undefined) patch.role = role;
    if (roleLabel !== undefined) patch.roleLabel = roleLabel;
    if (avatar !== undefined) patch.avatar = avatar;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});

export const setPushToken = mutation({
  args: { token: v.string(), pushToken: v.string() },
  handler: async (ctx, { token, pushToken }) => {
    const user = await requireUser(ctx, token);
    await ctx.db.patch(user._id, { pushToken });
  },
});
