/**
 * Platform target registry + auto-conversion planner tests.
 */
import { describe, expect, it } from "vitest";
import type { BannerSpecDocument } from "@pcs/bannerspec";
import { TARGET_REGISTRY, TARGET_CATEGORIES, getTarget, targetsByCategory } from "../src/targets/registry.js";
import { planConversion, describePlan, isMasterAnimated, isPotentiallyTransparent } from "../src/targets/convert.js";

const doc = (over: Partial<BannerSpecDocument> = {}): BannerSpecDocument => ({
  specVersion: "0.3",
  canvas: { width: 1280, height: 640, background: "#0f1420" },
  layers: [],
  ...over,
});

const animatedDoc = (): BannerSpecDocument => ({
  ...doc(),
  animation: { duration: 6, loop: true },
  layers: [
    {
      id: "a", name: "A", type: "rect", x: 0, y: 0, width: 100, height: 100,
      visible: true, locked: false, opacity: 1, rotation: 0,
      tracks: [{ prop: "x", keys: [{ t: 0, value: 0 }, { t: 6, value: 400 }] }],
    },
  ],
});

const transparentDoc = (): BannerSpecDocument => doc({ canvas: { width: 1280, height: 640 } });

// ------------------------------------------------------------- registry

describe("target registry integrity", () => {
  it("has unique ids", () => {
    const ids = TARGET_REGISTRY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only known categories, and categories cover every target", () => {
    const catIds = TARGET_CATEGORIES.map((c) => c.id);
    for (const t of TARGET_REGISTRY) expect(catIds).toContain(t.category);
    const grouped = targetsByCategory();
    const total = Object.values(grouped).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(TARGET_REGISTRY.length);
  });

  it("every target carries a source URL and a checked date", () => {
    for (const t of TARGET_REGISTRY) {
      if (t.id === "custom-target") {
        // user-defined — no external source by design
        expect(typeof t.sourceCheckedAt).toBe("string");
        continue;
      }
      expect(t.sourceUrl).toMatch(/^https:\/\//);
      expect(t.sourceCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("recommended dimensions are >= minimum dimensions", () => {
    for (const t of TARGET_REGISTRY) {
      if (!t.minimum) continue;
      expect(t.recommended.width).toBeGreaterThanOrEqual(t.minimum.width);
      expect(t.recommended.height).toBeGreaterThanOrEqual(t.minimum.height);
    }
  });

  it("safe areas and avatar overlaps fit within recommended bounds", () => {
    for (const t of TARGET_REGISTRY) {
      for (const area of [...t.safeAreas, ...(t.avatarOverlaps ?? [])]) {
        expect(area.x).toBeGreaterThanOrEqual(0);
        expect(area.y).toBeGreaterThanOrEqual(0);
        expect(area.x + area.width).toBeLessThanOrEqual(t.recommended.width);
        expect(area.y + area.height).toBeLessThanOrEqual(t.recommended.height);
      }
    }
  });

  it("lookup helpers work", () => {
    expect(getTarget("github-repo-social")?.displayName).toContain("GitHub");
    expect(getTarget("nope-nope")).toBeUndefined();
    expect(targetsByCategory().code.some((t) => t.id === "github-profile-readme")).toBe(true);
  });

  it("includes the required seeds and omits non-targets", () => {
    const ids = TARGET_REGISTRY.map((t) => t.id);
    for (const id of [
      "github-repo-social", "github-profile-readme", "discord-profile-banner",
      "discord-server-profile", "youtube-channel-banner", "x-profile-header",
      "linkedin-background", "twitch-profile-banner", "reddit-community-banner",
      "gitlab-profile-readme", "codeberg-readme", "bluesky-header", "custom-target",
    ]) {
      expect(ids).toContain(id);
    }
    expect(getTarget("steam-avatar")!.verification).toBe("unverified");
    // Do not inflate the count with platforms without a customization surface.
    expect(ids.some((id) => id.startsWith("forgejo") || id.startsWith("gitea"))).toBe(false);
  });
});

// ------------------------------------------------------------- planning

describe("planConversion", () => {
  it("GitHub social 1280×640 master stays 1280×640 with fit scaling", () => {
    const target = getTarget("github-repo-social")!;
    const plan = planConversion(doc(), target);
    expect(plan.output.width).toBe(1280);
    expect(plan.output.height).toBe(640);
    expect(plan.scaleMode).toBe("fit");
    expect(plan.crop).toBeUndefined();
    expect(plan.targetId).toBe("github-repo-social");
  });

  it("animated master → static-only target yields animated:false + change entry", () => {
    const x = getTarget("x-profile-header")!; // animationSupport "none"
    const plan = planConversion(animatedDoc(), x, { preferAnimated: true });
    expect(plan.output.animated).toBe(false);
    expect(plan.changes.some((c) => /rasterized to a static frame/i.test(c.label))).toBe(true);
  });

  it("animated master → GIF target animates natively with fps/loop", () => {
    const gh = getTarget("github-repo-social")!;
    const plan = planConversion(animatedDoc(), gh, { preferAnimated: true });
    // GitHub accepts GIF but animation playback is unverified → static fallback
    expect(plan.output.animated).toBe(false);
    expect(plan.warnings.some((w) => /animation/i.test(w.label))).toBe(true);
  });

  it("transparent master → no-alpha target flattens with warning and background", () => {
    const x = getTarget("x-profile-header")!;
    const plan = planConversion(transparentDoc(), x);
    expect(isPotentiallyTransparent(transparentDoc())).toBe(true);
    expect(plan.output.alpha).toBe(false);
    expect(plan.output.flattenBackground).toBe("#0f1115");
    expect(plan.warnings.some((w) => /transparency/i.test(w.label))).toBe(true);
  });

  it("flatten background honors the override", () => {
    const x = getTarget("x-profile-header")!;
    const plan = planConversion(transparentDoc(), x, { flattenBackground: "#1a1b26" });
    expect(plan.output.flattenBackground).toBe("#1a1b26");
  });

  it("alpha-capable target keeps transparency without flattening", () => {
    const gh = getTarget("github-repo-social")!;
    const plan = planConversion(transparentDoc(), gh);
    expect(plan.output.alpha).toBe(true);
    expect(plan.output.flattenBackground).toBeUndefined();
    expect(plan.warnings.some((w) => /transparency/i.test(w.label))).toBe(false);
    expect(plan.warnings.some((w) => /unverified/i.test(w.label))).toBe(false);
  });

  it("dimension mismatch cover-crops centered on the safe area", () => {
    const yt = getTarget("youtube-channel-banner")!;
    const plan = planConversion(doc(), yt); // 2:1 master → 16:9 target
    expect(plan.scaleMode).toBe("cover-crop");
    expect(plan.crop).toBeDefined();
    const crop = plan.crop!;
    expect(crop.width / crop.height).toBeCloseTo(2560 / 1440, 2);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1280);
    expect(crop.y + crop.height).toBeLessThanOrEqual(640);
    // horizontally centered
    expect(crop.x).toBe(Math.round((1280 - crop.width) / 2));
  });

  it("same-aspect masters never crop", () => {
    const yt = getTarget("youtube-channel-banner")!;
    const plan = planConversion(doc({ canvas: { width: 1280, height: 720, background: "#000" } }), yt);
    expect(plan.scaleMode).toBe("fit");
    expect(plan.crop).toBeUndefined();
  });

  it("unverified targets produce the review warning", () => {
    const discord = getTarget("discord-profile-banner")!; // unverified
    const plan = planConversion(doc(), discord);
    expect(discord.verification).toBe("unverified");
    expect(plan.warnings.some((w) => /unverified/i.test(w.label))).toBe(true);
    expect(plan.warnings.some((w) => /auto-exports silently/i.test(w.detail))).toBe(true);
  });

  it("verified targets with no issues produce no warnings", () => {
    const yt = getTarget("youtube-channel-banner")!;
    // png estimate exceeds the 6MB limit at 2560×1440 → jpg stays well under
    const overPng = planConversion(doc({ canvas: { width: 2560, height: 1440, background: "#111" } }), yt);
    expect(overPng.warnings.some((w) => /limit/i.test(w.label))).toBe(true);
    const plan = planConversion(doc({ canvas: { width: 2560, height: 1440, background: "#111" } }), yt, { format: "jpg" });
    expect(plan.warnings).toHaveLength(0);
    expect(plan.output.format).toBe("jpg");
  });

  it("unsupported requested format falls back with a change note", () => {
    const yt = getTarget("youtube-channel-banner")!; // png/jpg only
    const plan = planConversion(doc(), yt, { format: "svg" });
    expect(plan.output.format).toBe("png");
    expect(plan.changes.some((c) => /format set to png/i.test(c.label))).toBe(true);
  });

  it("never mutates the master document", () => {
    const gh = getTarget("github-repo-social")!;
    const d = animatedDoc();
    const snapshot = JSON.stringify(d);
    planConversion(d, gh, { preferAnimated: true });
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it("describePlan emits readable report lines", () => {
    const x = getTarget("x-profile-header")!;
    // animated + transparent master → both a change and a warning are expected
    const master = { ...transparentDoc(), animation: { duration: 6, loop: true } as const };
    const plan = planConversion(master, x, { preferAnimated: true });
    const lines = describePlan(plan);
    expect(lines.some((l) => l.startsWith("Output: "))).toBe(true);
    expect(lines.some((l) => l.startsWith("Warning: "))).toBe(true);
    expect(lines.some((l) => l.includes("static frame"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Flattened against "))).toBe(true);
  });

  it("animation detection helpers behave", () => {
    expect(isMasterAnimated(doc())).toBe(false);
    expect(isMasterAnimated(animatedDoc())).toBe(true);
    expect(isMasterAnimated(doc({ animation: { duration: 4, loop: true } }))).toBe(true);
    expect(isPotentiallyTransparent(doc({ canvas: { width: 10, height: 10, background: "#123456" } }))).toBe(false);
    expect(isPotentiallyTransparent(doc({ canvas: { width: 10, height: 10, background: "#12345680" } }))).toBe(true);
    expect(isPotentiallyTransparent(doc({ canvas: { width: 10, height: 10 } }))).toBe(true);
  });
});
