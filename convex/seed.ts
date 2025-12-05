import { mutation } from "./_generated/server";

// This file is kept for backwards compatibility but no longer seeds mock data
// Users should add their own tokens and components through the UI

export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    // No mock data - users create their own content
    return { 
      message: "No mock data to seed. Add your own tokens and components through the UI.",
      tokens: 0,
      components: 0
    };
  },
});
