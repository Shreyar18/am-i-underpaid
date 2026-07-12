import { ConvexError, v } from 'convex/values';
import { mutation } from './_generated/server';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const join = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      throw new ConvexError('Please enter a valid email address.');
    }

    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (existing) {
      throw new ConvexError("You're already on the list.");
    }

    await ctx.db.insert('waitlist', {
      email,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});
