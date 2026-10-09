import { describe, expect, it } from "vitest";
import {
  STATS_STYLES,
  formatStatValue,
  statIcon,
  statsSectionMarkdown,
  statsSparkline,
  statsStyleThumbSvg,
  type StatsStyleName,
} from "../src/github/stats-styles.js";
import { DEMO_STATS, type StatsField } from "../src/github/stats.js";

const FIELDS: StatsField[] = [
  { key: "repos", label: "Repositories", value: 42 },
  { key: "stars", label: "Stars earned", value: 1280 },
  { key: "followers", label: "Followers", value: 318 },
];

describe("stats styles — formatting", () => {
  it("formats plain and k-suffixed values", () => {
    expect(formatStatValue(42)).toBe("42");
    expect(formatStatValue(1280)).toBe("1.3k");
    expect(formatStatValue(3000)).toBe("3k");
  });

  it("maps known stat keys to icons and falls back to a bullet", () => {
    expect(statIcon("stars")).toBe("⭐");
    expect(statIcon("mystery")).toBe("•");
  });
});

describe("statsSectionMarkdown", () => {
  it("returns empty markdown for empty fields (nothing fake emitted)", () => {
    for (const s of STATS_STYLES) {
      expect(statsSectionMarkdown(s.id, [])).toBe("");
    }
  });

  it("produces non-empty GitHub-safe markdown for every style", () => {
    for (const s of STATS_STYLES) {
      const md = statsSectionMarkdown(s.id, FIELDS);
      expect(md.length).toBeGreaterThan(0);
      // GitHub-compatible only: no raw HTML, no scripts/images
      expect(md).not.toMatch(/<\s*(img|script|div|span|table|br)\b/i);
      expect(md).toContain("1.3k");
    }
  });

  it("terminal style uses a fenced code block with key = value lines", () => {
    const md = statsSectionMarkdown("terminal", FIELDS);
    expect(md).toMatch(/^```/);
    expect(md).toContain("> stars_earned = 1.3k");
  });

  it("cards style is a table with icon + label + value", () => {
    const md = statsSectionMarkdown("cards", FIELDS);
    expect(md).toContain("| ⭐ Stars earned | **1.3k** |");
    expect(md).toMatch(/^\| Stat \| Value \|/m);
  });

  it("minimal style uses plain bold lines and inline stays one line", () => {
    expect(statsSectionMarkdown("minimal", FIELDS)).toContain("**Repositories:** 42");
    const inline = statsSectionMarkdown("inline", FIELDS);
    expect(inline.split("\n")).toHaveLength(1);
    expect(inline).toContain("Repositories **42**");
  });

  it("appends a sparkline only when history is actually supplied", () => {
    const history = [1, 4, 2, 8, 0, 5];
    const md = statsSectionMarkdown("inline", FIELDS, history);
    const spark = statsSparkline(history)!;
    expect(md).toContain(`\`${spark}\` recent activity`);
    expect(spark[0]).toBe("▂"); // 1 of max 8
    expect(spark).toContain("█"); // 8 of max 8
    expect(statsSectionMarkdown("inline", FIELDS)).not.toContain("recent activity");
  });
});

describe("statsSparkline", () => {
  it("returns null without data, with too little data, or all-zero data", () => {
    expect(statsSparkline(undefined)).toBeNull();
    expect(statsSparkline([3])).toBeNull();
    expect(statsSparkline([0, 0, 0])).toBeNull();
  });

  it("renders one unicode block per data point", () => {
    const spark = statsSparkline([0, 5, 10]);
    expect(spark).toHaveLength(3);
    expect(spark![0]).toBe("▁");
    expect(spark![2]).toBe("█");
  });
});

describe("statsStyleThumbSvg", () => {
  it("renders a real SVG thumbnail for every style, including with empty fields", () => {
    const all: StatsStyleName[] = [...STATS_STYLES.map((s) => s.id)];
    for (const s of all) {
      const svg = statsStyleThumbSvg(s, FIELDS);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("GitHub Stats");
    }
    expect(statsStyleThumbSvg("terminal", []).startsWith("<svg")).toBe(true);
  });
});
