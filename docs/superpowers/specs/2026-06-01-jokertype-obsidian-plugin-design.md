# JokerType Obsidian Plugin — Design Spec

**Date:** 2026-06-01
**Project:** JokerType
**Type:** Obsidian desktop plugin
**Status:** Approved draft for implementation planning

## Purpose

JokerType is an Obsidian plugin that makes writing feel more tactile, game-like, and satisfying. It is inspired by HyperType and Balatro-style feedback, but it is not a faithful port. The plugin should feel native to Obsidian and preserve normal editing behavior.

The plugin watches CodeMirror 6 document transactions, classifies text edits, and spawns short-lived visual and audio effects near the source text positions that changed.

## Goals

- Make typing feel responsive and playful without compromising editor safety.
- Observe CodeMirror transactions instead of intercepting keypresses.
- Spawn text particles from the inserted or affected source text position, not merely the final cursor position.
- Coalesce chunk edits such as paste, autocomplete, command insertion, or IME composition into compact bursts.
- Provide Web Audio typing sounds with pitch rising during fast typing streaks.
- Include settings for sound, intensity, reduced motion, and editor shake.
- Target desktop Obsidian first.

## Non-Goals

- Do not port HyperType faithfully.
- Do not depend on VS Code APIs.
- Do not override Obsidian or CodeMirror typing commands.
- Do not build mobile polish into the MVP.
- Do not add scoring, stats, combos, achievements, or gamified persistence in the MVP.
- Do not flood the editor with one particle per character for large edits.

## Plugin Architecture

### `main.ts`

Owns the Obsidian plugin lifecycle:

- Load and save settings.
- Register the settings tab.
- Register the CodeMirror extension with `this.registerEditorExtension(...)`.
- Create shared services, including the audio engine and effect configuration compartment.

### `settings.ts`

Defines persisted settings:

- `soundEnabled: boolean`
- `effectIntensity: 'low' | 'medium' | 'high'`
- `reducedMotion: boolean`
- `editorShake: boolean`
- `preset: 'classic'`

The MVP ships with a single `classic` preset. Additional presets are deferred until the base effect loop is proven stable.

### `typingEffectExtension.ts`

Exports a CodeMirror 6 extension factory. It creates a `ViewPlugin` that receives `ViewUpdate` objects and processes document changes.

Responsibilities:

- Ignore updates when effects are disabled.
- Inspect transactions and change sets.
- Pass changes to the classifier.
- Ask the overlay to spawn effects.
- Ask the audio engine to play matching sounds.
- Clean up editor-local DOM on destroy.

### `changeClassifier.ts`

Converts CodeMirror changes into normalized effect events.

Suggested event shape:

```ts
type TypingEffectEvent =
  | { type: 'char'; text: string; from: number; to: number }
  | { type: 'enter'; from: number }
  | { type: 'tab'; from: number }
  | { type: 'delete'; from: number; to: number; direction: 'backward' | 'forward' | 'unknown' }
  | { type: 'chunk'; text: string; from: number; length: number; reason: 'paste' | 'composition' | 'autocomplete' | 'unknown' }
```

Classification rules:

- Single printable inserted character becomes `char`.
- `\n` insertion becomes `enter`.
- `\t` insertion becomes `tab`.
- Deletion-only changes become `delete`, with direction inferred where possible from selection/transaction metadata.
- Multi-character insertions become `chunk`, except short typed bursts may be split up to a small cap.
- Unknown or structurally complex edits should degrade gracefully into one `chunk` burst or no effect.

### `effectOverlay.ts`

Creates an editor-local overlay anchored to the editor DOM instead of a global app overlay.

Responsibilities:

- Resolve event positions with `view.coordsAtPos(event.from)`.
- Prefer the source changed position over the final cursor position.
- Fall back to `view.coordsAtPos(view.state.selection.main.head)` only when source coordinates are unavailable.
- Spawn short-lived DOM particles with CSS animations.
- Remove particles on `animationend` and during plugin/view teardown.
- Apply optional editor shake through a scoped CSS class on the editor wrapper.

For chunk edits, the overlay should spawn one compact burst near the start of the changed range. It may display a symbol, short label, or representative glyph rather than every inserted character.

### `audioEngine.ts`

Provides lazy Web Audio playback:

- Create `AudioContext` only after the first user interaction/effect.
- Play short click/chip sounds for normal typing.
- Play distinct sounds for enter and delete if available.
- Maintain a pitch streak that rises during rapid input.
- Reset pitch after a short idle window, around 250-350ms.
- Respect `soundEnabled` and reduced-motion-like quiet modes if added later.

MVP audio starts as procedural Web Audio oscillators/noise to avoid asset licensing friction. If HyperType audio assets are reused later, include the MIT attribution and license notice in the repo before shipping them.

## Effect Behavior

### Normal Typed Characters

For a single typed printable character:

- Source position: insertion `from` position.
- Visual: floating pixel-style text particle using the typed glyph.
- Audio: normal typing chip.
- Pitch: increment streak.

### Enter

For newline insertion:

- Source position: newline insertion point.
- Visual: compact vertical pulse, corner brackets, or `ENTER` label.
- Audio: enter sound.
- Motion: slightly stronger than normal character, scaled by intensity.

### Tab

For tab insertion:

- Source position: tab insertion point.
- Visual: small horizontal streak or `TAB` label.
- Audio: normal typing chip or softer enter-like sound.

### Delete / Backspace

For deletion-only changes:

- Source position: removed range boundary.
- Visual: slice, collapse, or fading fragment.
- Audio: sharper delete chip.
- Direction: infer backward/forward when possible, but avoid fragile assumptions.

### Chunk Edits

For paste, autocomplete, IME commit, command insertion, or other multi-character insertion:

- Source position: start of inserted range.
- Visual: one coalesced burst, capped particle cluster, or short label.
- Audio: one stronger chip or brief layered burst.
- Performance: never spawn unbounded particles proportional to inserted length.

## Visual Style

The visual style should be crisp and playful, borrowing the energy of Balatro/HyperType without copying implementation details.

MVP visual components:

- Pixel-style floating glyphs.
- Bright but tasteful color bursts.
- Short lifetimes, roughly 400-800ms.
- Optional corner bracket flashes around source text.
- Optional editor shake scoped to the active editor.

CSS should be namespaced to avoid leaking into Obsidian themes.

## Settings UI

The settings tab should include:

- Sound toggle.
- Effect intensity selector.
- Reduced motion toggle.
- Editor shake toggle.
- Attribution note if using HyperType assets or adapted logic.

Default settings should be conservative:

- Sound on by default at a low volume, with an obvious toggle.
- Medium visual intensity.
- Editor shake off by default.
- Respect Obsidian and OS reduced motion preferences where available.

## Accessibility and Safety

- Reduced motion should replace movement-heavy particles and shake with a subtle opacity or color pulse.
- Effects must not block text selection, mouse input, or editor focus.
- DOM overlays must use `pointer-events: none`.
- The plugin must tolerate folded ranges, hidden panes, source/reading mode switches, and layout changes.
- Effects should be disabled or no-op in non-editor views.

## Performance Constraints

- Avoid unbounded DOM particle creation.
- Cap active particles per editor.
- Coalesce large edits.
- Clean particles promptly.
- Avoid layout thrash by batching coordinate reads and DOM writes where practical.
- Keep transaction handling cheap enough to run on every editor update.

## Testing Strategy

MVP testing should cover:

- Change classification for char, enter, tab, deletion, and chunk insertions.
- Settings load/save defaults.
- Audio pitch streak logic as pure unit behavior where possible.
- Manual desktop Obsidian smoke testing with typing, paste, autocomplete-like changes, split panes, theme changes, and reduced motion.

Automated DOM positioning tests can be limited initially because CodeMirror coordinate APIs depend on rendered layout.

## MVP Acceptance Criteria

- The plugin loads in Obsidian desktop as a local development plugin.
- Typing normal characters spawns particles from the changed text position.
- Enter, tab, delete/backspace, and chunk insertions produce distinct effects.
- Large paste or autocomplete-style changes coalesce instead of flooding particles.
- Sound can be toggled and pitch rises during fast typing.
- Reduced motion and intensity settings affect output.
- Normal Obsidian editing, shortcuts, undo/redo, selections, and panes continue to work.

## Deferred Decisions

- Final marketplace name can change before release; the working repo and implementation name is JokerType.
- HyperType audio assets may be evaluated after the procedural MVP works.
- Additional presets and palette variants are deferred until the core typing loop is stable.


