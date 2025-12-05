import { mutation } from "./_generated/server";

// Clear all data from the database
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear tokens
    const tokens = await ctx.db.query("tokens").collect();
    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }
    
    // Clear components
    const components = await ctx.db.query("components").collect();
    for (const component of components) {
      await ctx.db.delete(component._id);
    }
    
    // Clear activity
    const activity = await ctx.db.query("activity").collect();
    for (const act of activity) {
      await ctx.db.delete(act._id);
    }
    
    // Clear releases
    const releases = await ctx.db.query("releases").collect();
    for (const release of releases) {
      await ctx.db.delete(release._id);
    }
    
    // Clear settings
    const settings = await ctx.db.query("settings").collect();
    for (const setting of settings) {
      await ctx.db.delete(setting._id);
    }
    
    return { 
      message: "All data cleared",
      deleted: {
        tokens: tokens.length,
        components: components.length,
        activity: activity.length,
        releases: releases.length,
        settings: settings.length,
      }
    };
  },
});

// Kept for backwards compatibility - does nothing
export const seedInitialData = mutation({
  args: {},
  handler: async () => {
    return { 
      message: "No mock data to seed. Add your own data through the UI.",
      tokens: 0,
      components: 0
    };
  },
});
