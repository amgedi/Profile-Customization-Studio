# PCS design system

Studio UI tokens are defined in `apps/studio/src/styles/tokens.css`; shell/application styles and reusable controls consume those tokens. Appearance settings provide multiple palettes, accents, density, contrast and glow preferences. PCS lettering follows the active accent/text colours. Launcher uses its own Slint styling.

Keep focus indicators, labels and keyboard operation intact. Respect reduced-motion preferences in UI transitions and animated preview cards. Document controls that affect exported artwork separately from editor-only preferences. Side panels can resize/collapse within limits; arbitrary docking is not currently supported.

Use Lucide icons consistently where practical. Imported/photo artwork must carry rights metadata. Treat presets as data and keep rendered previews isolated from the active document. Review layout at 1366x768 and the 960x640 minimum, plus common larger windows. A passing build does not prove visual quality or accessibility.
