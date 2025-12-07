import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface ExtractionStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  details?: string;
}

export const create = mutation({
  args: {
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    projectId: v.id("projects"),
    figmaUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const progressId = await ctx.db.insert("extractionProgress", {
      userId: args.userId,
      tenantId: args.tenantId,
      projectId: args.projectId,
      figmaUrl: args.figmaUrl,
      status: "pending",
      currentStep: "Initializing...",
      steps: [
        { id: "validate", label: "Validating Figma URL", status: "pending" },
        { id: "fetch", label: "Fetching component from Figma", status: "pending" },
        { id: "extract_structure", label: "Extracting component structure", status: "pending" },
        { id: "extract_typography", label: "Extracting typography", status: "pending" },
        { id: "extract_colors", label: "Extracting colors & fills", status: "pending" },
        { id: "extract_layout", label: "Extracting layout & spacing", status: "pending" },
        { id: "extract_effects", label: "Extracting shadows & effects", status: "pending" },
        { id: "extract_variants", label: "Extracting variants", status: "pending" },
        { id: "extract_tokens", label: "Matching design tokens", status: "pending" },
        { id: "classify", label: "Classifying component type", status: "pending" },
        { id: "generate_types", label: "Generating TypeScript types", status: "pending" },
        { id: "generate_component", label: "Generating React component", status: "pending" },
        { id: "generate_styles", label: "Generating CSS styles", status: "pending" },
        { id: "finalize", label: "Finalizing component", status: "pending" },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return progressId;
  },
});

export const updateStep = internalMutation({
  args: {
    progressId: v.id("extractionProgress"),
    stepId: v.string(),
    status: v.union(v.literal("in_progress"), v.literal("completed"), v.literal("failed")),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) return;

    const steps = progress.steps.map(step => {
      if (step.id === args.stepId) {
        return {
          ...step,
          status: args.status,
          details: args.details || step.details,
        };
      }
      return step;
    });

    // Find current step label
    const currentStep = steps.find(s => s.id === args.stepId);
    const currentStepLabel = currentStep?.label || progress.currentStep;

    // Update overall status
    let overallStatus = progress.status;
    if (args.status === "in_progress") {
      overallStatus = "extracting";
    } else if (args.status === "completed" && steps.every(s => s.status === "completed" || s.status === "pending")) {
      overallStatus = "completed";
    } else if (args.status === "failed") {
      overallStatus = "failed";
    }

    await ctx.db.patch(args.progressId, {
      steps,
      currentStep: currentStepLabel,
      status: overallStatus,
      updatedAt: Date.now(),
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    progressId: v.id("extractionProgress"),
    status: v.union(
      v.literal("fetching"),
      v.literal("extracting"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    currentStep: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.progressId, {
      status: args.status,
      currentStep: args.currentStep,
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const get = query({
  args: {
    progressId: v.id("extractionProgress"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.progressId);
  },
});

export const getByUser = query({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractionProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .order("desc")
      .first();
  },
});

export const remove = mutation({
  args: {
    progressId: v.id("extractionProgress"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.progressId);
  },
});

