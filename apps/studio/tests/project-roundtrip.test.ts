import { describe, expect, it } from "vitest";
import { migrateDocument } from "@pcs/bannerspec";
import { SceneStore } from "@pcs/scene-core";
import { newProject, parseProject, serializeProject } from "../src/project.js";

describe("project preservation", () => {
  it("roundtrips scene effects and profile text in the existing format", () => {
    const project = newProject("Roundtrip"); const store = new SceneStore(project.bannerSpec);
    const id = store.addText({ text: "Original identity" });
    store.updateLayer(id, { effects: [{ id: "glow", type: "glow", visible: true, params: { amount: 8 } }] });
    project.bannerSpec = store.getDocument();
    project.settings = { target: "discord-profile-banner" };
    const loaded = parseProject(serializeProject(project));
    expect(loaded.project.bannerSpec).toEqual(project.bannerSpec);
    expect(loaded.project.settings).toEqual(project.settings);
    expect(loaded.project.formatVersion).toBe(1); expect(loaded.warnings).toEqual([]);
  });
  it("migrates a legacy scene copy while preserving the original bytes", () => {
    const project = newProject(); project.bannerSpec.specVersion = "0.1";
    const bytes = serializeProject(project); const loaded = parseProject(bytes);
    const migrated = migrateDocument(loaded.project.bannerSpec);
    expect(migrated.to).toBe("0.3"); expect(loaded.project.bannerSpec.specVersion).toBe("0.1");
    expect(JSON.parse(bytes).bannerSpec.specVersion).toBe("0.1"); expect(loaded.warnings).toHaveLength(1);
  });
  it("rejects foreign projects and future formats explicitly", () => {
    const project = newProject();
    expect(() => parseProject(JSON.stringify({ ...project, application: "other" }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, formatVersion: 99 }))).toThrow();
    expect(() => parseProject(JSON.stringify({ ...project, bannerSpec: { ...project.bannerSpec, specVersion: "99" } }))).toThrow();
  });
});
