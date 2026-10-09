import { shortcutFor } from "./shortcuts.js";
/**
 * Central command registry: menus, context menu, command palette and
 * shortcuts all reference these entries. `enabled` gates availability;
 * commands without real backing functionality must not be registered.
 */
import type { Editor } from "./editor.js";

export interface CommandContext {
  editor: Editor;
  actions: StudioActions;
}

export interface StudioActions {
  newProject(): void;
  openProject(): void;
  saveProject(): void;
  saveProjectAs?(): void;
  openGuide?(): void;
  startTour?(): void;
  exportSvg(): void;
  exportPackage(): void;
  openTimeline(): void;
  openReadme(): void;
  openContribution(): void;
  openStats(): void;
  openTutorial(): void;
  openCompatibility(): void;
  showAbout(): void;
  insertImage(): void;
}

export interface CommandDef {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  enabled: (c: CommandContext) => boolean;
  run: (c: CommandContext) => void;
  keywords?: string;
}

export function buildCommands(actions: StudioActions): CommandDef[] {
  const withLayer = (c: CommandContext) => c.editor.selectedId !== null;
  const cmds: CommandDef[] = [
    {id:'tool.select',label:'Selection tool',group:'Tools',shortcut:'V',enabled:()=>true,run:c=>c.editor.setTool('select')},
    {id:'tool.pan',label:'Hand tool',group:'Tools',shortcut:'H',enabled:()=>true,run:c=>c.editor.setTool('hand')},
    {id:'tool.text',label:'Text tool',group:'Tools',shortcut:'T',enabled:()=>true,run:c=>c.editor.setTool('text')},
    {id:'motion.toggle',label:'Play / pause animation',group:'Animation',shortcut:'Space',enabled:()=>true,run:c=>c.editor.setPlaying(!c.editor.playing)},
    {id:'view.actual',label:'Actual size',group:'View',shortcut:'Ctrl+1',enabled:()=>true,run:c=>c.editor.setZoom(1)},
    {id:'edit.copy',label:'Copy layers',group:'Edit',shortcut:'Ctrl+C',enabled:withLayer,run:c=>c.editor.copySelected()},
    {id:'edit.cut',label:'Cut layers',group:'Edit',shortcut:'Ctrl+X',enabled:withLayer,run:c=>c.editor.cutSelected()},
    {id:'edit.paste',label:'Paste layers',group:'Edit',shortcut:'Ctrl+V',enabled:()=>true,run:c=>c.editor.paste()},
    {id:'edit.selectAll',label:'Select all layers',group:'Edit',shortcut:'Ctrl+A',enabled:()=>true,run:c=>c.editor.selectAll()},
    // File
    { id: "file.new", label: "New Project…", group: "File", shortcut: "Ctrl+N", enabled: () => true, run: (c) => c.actions.newProject() },
    { id: "file.open", label: "Open Project…", group: "File", shortcut: "Ctrl+O", enabled: () => true, run: (c) => c.actions.openProject() },
    { id: "file.save", label: "Save Project", group: "File", shortcut: "Ctrl+S", enabled: () => true, run: (c) => c.actions.saveProject() },
    { id: "file.saveAs", label: "Save Project As…", group: "File", shortcut: "Ctrl+Shift+S", enabled: c => !!c.actions.saveProjectAs, run: c => c.actions.saveProjectAs?.() },
    // Edit
    { id: "edit.undo", label: "Undo", group: "Edit", shortcut: "Ctrl+Z", enabled: (c) => c.editor.store.canUndo(), run: (c) => c.editor.undo() },
    { id: "edit.redo", label: "Redo", group: "Edit", shortcut: "Ctrl+Shift+Z", enabled: (c) => c.editor.store.canRedo(), run: (c) => c.editor.redo() },
    { id: "edit.duplicate", label: "Duplicate Layer", group: "Edit", shortcut: "Ctrl+D", enabled: withLayer, run: (c) => c.editor.duplicateSelected() },
    { id: "edit.delete", label: "Delete Layer", group: "Edit", shortcut: "Del", enabled: withLayer, run: (c) => c.editor.selectedIds.length ? c.editor.selectedIds.forEach(id=>c.editor.removeLayer(id)) : c.editor.selectedId && c.editor.removeLayer(c.editor.selectedId) },
    { id: "edit.rename", label: "Rename Layer…", group: "Edit", enabled: withLayer, run: (c) => { const n = window.prompt("Layer name", c.editor.selected?.name ?? ""); if (n && c.editor.selectedId) c.editor.updateLayer(c.editor.selectedId, { name: n }); } },
    // View
    { id: "view.zoomIn", label: "Zoom In", shortcut: "+", group: "View", enabled: () => true, run: (c) => c.editor.setZoom(Math.min(3, c.editor.zoom * 1.15)) },
    { id: "view.zoomOut", label: "Zoom Out", shortcut: "-", group: "View", enabled: () => true, run: (c) => c.editor.setZoom(Math.max(0.1, c.editor.zoom * 0.87)) },
    { id: "view.fit", label: "Fit Canvas", group: "View", shortcut: "Ctrl+0", enabled: () => true, run: (c) => c.editor.requestFit() },
    { id: "view.safe", label: "Toggle Safe Areas", group: "View", enabled: () => true, run: (c) => c.editor.setShowSafeArea(!c.editor.showSafeArea) },
    { id: "view.focus", label: "Focus Canvas", group: "View", enabled: () => true, run: (c) => c.editor.setFocusMode(!c.editor.focusMode) },
    // Insert
    { id: "insert.text", label: "Text", group: "Insert", enabled: () => true, run: (c) => c.editor.addText() },
    { id: "insert.rect", label: "Rectangle", group: "Insert", shortcut: "R", enabled: () => true, run: (c) => c.editor.addRect() },
    { id: "insert.ellipse", label: "Ellipse", group: "Insert", enabled: () => true, run: (c) => c.editor.addEllipse() },
    { id: "insert.line", label: "Line", group: "Insert", enabled: () => true, run: (c) => c.editor.addLine() },
    { id: "insert.image", label: "Image…", group: "Insert", enabled: () => true, run: (c) => c.actions.insertImage() },
    // Object
    { id: "object.lock", label: "Toggle Lock", group: "Object", enabled: withLayer, run: (c) => c.editor.selected && c.editor.updateLayer(c.editor.selected.id, { locked: !c.editor.selected.locked }) },
    { id: "object.hide", label: "Toggle Visibility", group: "Object", enabled: withLayer, run: (c) => c.editor.selected && c.editor.updateLayer(c.editor.selected.id, { visible: !c.editor.selected.visible }) },
    // Arrange
    { id: "object.group", label: "Group Selection", shortcut: "Ctrl+G", group: "Object", enabled: c => c.editor.selectedIds.length > 1, run: c => { c.editor.groupSelected(); } },
    { id: "object.ungroup", label: "Ungroup", shortcut: "Ctrl+Shift+G", group: "Object", enabled: c => c.editor.selected?.type === "group", run: c => c.editor.ungroupSelected() },
    { id: "arrange.front", label: "Bring to Front", group: "Arrange", enabled: withLayer, run: (c) => c.editor.reorderLayerTo(c.editor.selectedId!, "front") },
    { id: "arrange.forward", label: "Bring Forward", group: "Arrange", enabled: withLayer, run: (c) => c.editor.reorderLayerTo(c.editor.selectedId!, "forward") },
    { id: "arrange.backward", label: "Send Backward", group: "Arrange", enabled: withLayer, run: (c) => c.editor.reorderLayerTo(c.editor.selectedId!, "backward") },
    { id: "arrange.back", label: "Send to Back", group: "Arrange", enabled: withLayer, run: (c) => c.editor.reorderLayerTo(c.editor.selectedId!, "back") },
    // Animation
    { id: "motion.timeline", label: "Open Timeline", group: "Animation", enabled: () => true, run: (c) => c.actions.openTimeline() },
    { id: "motion.preview", label: "Preview Animation", group: "Animation", enabled: () => true, run: (c) => c.editor.setMode("preview") },
    // Platform / Export
    { id: "export.svg", label: "Export SVG…", group: "Export", enabled: () => true, run: (c) => c.actions.exportSvg() },
    { id: "export.package", label: "Export GitHub Profile Package…", group: "Export", enabled: () => true, run: (c) => c.actions.exportPackage() },
    { id: "platform.readme", label: "Open README Composer", group: "Platform", enabled: () => true, run: (c) => c.actions.openReadme() },
    { id: "platform.compatibility", label: "GitHub Compatibility Inspector", group: "Platform", enabled: () => true, run: (c) => c.actions.openCompatibility() },
    // Contribution / stats
    { id: "tools.contribution", label: "Contribution Playground", group: "Tools", enabled: () => true, run: (c) => c.actions.openContribution() },
    { id: "tools.stats", label: "Stats Studio", group: "Tools", enabled: () => true, run: (c) => c.actions.openStats() },
    // Help
    { id: "help.startup", label: "Restart startup tutorial", group: "Help", enabled: c => !!c.actions.startTour, run: c => c.actions.startTour?.() },
    { id: "help.guide", label: "Guide Me…", group: "Help", enabled: c => !!c.actions.openGuide, run: c => c.actions.openGuide?.() },
    { id: "help.tutorial", label: "GitHub Profile Tutorial", group: "Help", enabled: () => true, run: (c) => c.actions.openTutorial() },
    { id: "help.about", label: "About Profile Customization Studio", group: "Help", enabled: () => true, run: (c) => c.actions.showAbout() },
  ];
  return cmds.map(c=>({...c,shortcut:shortcutFor(c)}));
}
