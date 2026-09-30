---
name: MyScreen
description: A Cut Sheet — a régua de captura do MyScreen, impressa em papel frio, tinta quase preta e um único azul de líder.
colors:
  paper: "#f2f2ef"
  sheet: "#ffffff"
  band: "#f7f7f4"
  band-2: "#ededea"
  ink: "#16171a"
  ink-2: "#4b4e55"
  ink-3: "#676b74"
  ink-4: "#9a9ea6"
  rule: "#d5d5ce"
  rule-2: "#b9b9b0"
  rule-3: "#8a8a80"
  signal: "#1b3a7d"
  signal-2: "#142c5c"
  signal-wash: "#eef1f7"
  signal-wash-2: "#e4e9f3"
  signal-line: "#b9c6e0"
  on-signal: "#ffffff"
  alert: "#8f2a1c"
  alert-line: "#d9b3ac"
  alert-line-2: "#b9705f"
  alert-wash: "#fbf1ef"
  alert-wash-2: "#f7e6e2"
  warn: "#8a5a12"
  warn-dot: "#c08a2a"
  monitor: "#101114"
  monitor-ink: "#8e9299"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem → 2.125rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.022em"
    fontFeature: "text-wrap: balance"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem → 1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontFeature: "max-width 70ch, text-wrap: pretty"
  label:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "10.5px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.13em"
    fontVariation: "uppercase"
  value:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "font-variant-numeric: tabular-nums"
  value-emphasis:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "font-variant-numeric: tabular-nums"
rounded:
  sheet: "3px"
  cell: "2px"
  none: "0px"
spacing:
  band: "2.25rem"
  cell: "0.5rem"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.on-signal}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.signal-2}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 1rem"
  button-secondary-hover:
    backgroundColor: "{colors.band}"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.alert}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 1rem"
  button-danger-hover:
    backgroundColor: "{colors.alert-wash}"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "0.5rem 0.75rem"
  input-focus:
    backgroundColor: "{colors.sheet}"
  card:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "1.5rem → 2rem"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.cell}"
    padding: "3px 0.375rem"
  chip-active:
    backgroundColor: "{colors.signal-wash}"
    textColor: "{colors.signal}"
  cell:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem 1.5rem"
  nav:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.cell}"
    padding: "0.375rem 0.625rem"
  nav-active:
    backgroundColor: "{colors.signal-wash}"
    textColor: "{colors.signal}"
---

# Design System: MyScreen

## Overview

**Creative North Star: "A Cut Sheet"**

MyScreen is the broadcast edit decision list, rendered as a real document. A cool neutral
desk (`paper`), a white sheet lifted a hair off it, hairline rules in warm gray, near-black
ink for anything that was measured, pencil gray for anything that was not, and exactly one
accent — a deep printed leader blue — reserved for the primary action and for live state.
Archivo carries headings and body with real cap discipline; Spline Sans Mono carries every id,
timecode, time and value, with tabular figures so numeric columns line up the way a column has
to line up. The maximum radius is 3px, because a cut sheet has no rounded corners, and depth
comes from rules and paper lift rather than from decorative shadow.

The system's spine is the **amendment mark**. A value cell that changes does not pop a toast:
the previous value stays on the sheet, struck through in graphite, while the new one settles
in ink, and the swap is announced in a visually-hidden `aria-live` region for anyone who cannot
see it happen. A change is a record, not a notification. That single interaction repeats on
every surface carrying a ruler — the home band and the pre-call lobby run the *same*
`CaptureRuler` component, so the home page's promise that this is the ruler you operate in the
lobby is literally true rather than aspirational.

The world is engineer-honest, and honesty is a visual commitment here, not only a copy one.
State is a column value, never a colour alone: stamps read PENDENTE / ATIVO / TRAVADO, the
participants roster writes "Câmera desligada" and "Microfone mudo", the microphone meter writes
"Captando áudio" / "Silêncio" / "Indisponível". The stats panel renders an unmeasured value as
`--` and a never-measured one as `n/d`. There is no badge, plan, tier, testimonial, logo or
screenshot anywhere in this product, so no surface may imply one exists.

**Key Characteristics:**
- One accent (leader blue `#1b3a7d`), used for the primary action and for live state only.
- The ruler is load-bearing: cells, mono values, and consequence lines repeat identically on
  the landing page and in the lobby.
- Density over decoration; one primary action per screen; hierarchy from space, rule and weight.
- The monitor is dark on purpose — the one documented exception to the paper ground, because
  that is how a video image is judged.
- Nothing floats over the sheet: warnings are ruled rows, room creation is an inline band.

**What this system deliberately does not have.** A dark theme. It is explicitly deferred, not
pending — see the entry in "Do's and Don'ts" below for what it would need if it is built.

## Colors

A four-step paper neutral stack, a four-step ink ladder bounded by measured contrast, three
weights of rule, one printed signal blue, and a tokenized attention family that exists to mark
that something jammed — never a second brand colour.

### Primary
- **Leader Blue** (`--color-signal` `#1b3a7d`): the single accent. Primary actions ("Iniciar
  agora", "Entrar na reunião", "Salvar sala"), the active state of a control, the live stamp,
  the selected `Choice` value, the reconnecting band, and the focus outline. 10.8:1 on the
  sheet, 9.6:1 on the paper, 9.5:1 on its own wash. Its rarity is the point: if two things on a
  screen are blue, one of them is wrong.
- **Leader Blue Pressed** (`--color-signal-2` `#142c5c`): hover/active on primary buttons
  only. 13.6:1 against white button text.

### Secondary
- **Signal Wash** (`--color-signal-wash` `#eef1f7`) and **Signal Wash 2** (`#e4e9f3`): the
  selected-cell fill. State is still carried by the value written in it, never by the fill
  alone. `signal-line` (`#b9c6e0`) is the hairline around a focused or selected control.
- **Attention Red** (`--color-alert` `#8f2a1c`): a jammed sheet, not a brand voice. 8.4:1 on the
  sheet, 7.5:1 on `alert-wash`. It never carries a byte of a URL and never becomes a CTA. Its
  line/wash pair (`alert-line` `#d9b3ac`, `alert-wash` `#fbf1ef`, plus `-2` tones for the
  pressed state) makes every alert a ruled block instead of a floating banner.
- **Warning Ochre** (`--color-warn` `#8a5a12`, dot `#c08a2a`): a condition worth watching —
  unstable connection, packet loss. 5.9:1 as text on the sheet.

### Neutral
- **Desk** (`--color-paper` `#f2f2ef`): the page ground, behind every sheet; also the Navbar
  ground and the scrollbar track.
- **Sheet** (`--color-sheet` `#ffffff`): the only card colour. Elevated blocks, inputs,
  sidebars, the stats panel.
- **Band** (`--color-band` `#f7f7f4`) and **Band 2** (`--color-band-2` `#ededea`): recessed
  rules inside the sheet — table headers, the chat composer, the recording block, the VU track.
- **Ink** (`--color-ink` `#16171a`): primary text. 17.9:1 on the sheet, 16.0:1 on the paper.
- **Ink 2** (`--color-ink-2` `#4b4e55`): secondary text and prose. 8.3:1 on the sheet.
- **Ink 3** (`--color-ink-3` `#676b74`): graphite. Column headers, notes, placeholders,
  labels, de-emphasised instrument text. 5.3:1 on the sheet, 4.8:1 on the paper, 5.0:1 on a
  band.
- **Ink 4** (`--color-ink-4` `#9a9ea6`): 2.7:1 on the sheet. **Disabled borders and rules only —
  never copy.** It is used today as the `line-through` decoration on a struck amendment value
  and nowhere else.
- **Rule** (`--color-rule` `#d5d5ce`) the inside line, **Rule 2** (`#b9b9b0`) the block border
  and input stroke, **Rule 3** (`#8a8a80`, 3.5:1 on the sheet) the outer frame and hover
  border.
- **Monitor** (`--color-monitor` `#101114`) with **Monitor Ink** (`--color-monitor-ink`
  `#8e9299`, 6.0:1 on it): the video surfaces. Deliberate exception — see below.

Contrast figures are measured with the WCAG 2.x relative-luminance formula against the exact
hex values above. The figures quoted in `globals.css` (`16.9:1`, `8.4:1`, `4.9:1`, `2.7:1`) are
rounded approximations of the same ladder; the values in this section are the measured ones and
are the ones to trust.

### Named Rules

**The One Signal Rule.** Leader blue appears for the primary action and for live state. It is
never decorative, never a second CTA, and never an illustration colour. On the landing page
exactly one element is blue: "Iniciar agora".

**The Ink Ladder Rule.** Body copy is `ink`, secondary copy is `ink-2`, and anything
unmeasured, instrumental or de-emphasised is `ink-3` — the lightest step that still passes
4.5:1 on the sheet *and* the paper. `ink-4` measures 2.7:1 and is forbidden for copy: it exists
only for disabled borders, rules and the strike decoration on an amended value. A state that
can only be distinguished by a nearly invisible gray distinguishes nothing.

**The Monitor Exception.** Video surfaces are dark. A screen share, a camera tile and the lobby
preview sit on `#101114` because a neutral mid-dark surround is how you judge an image, and a
white page around it lies to the eye about brightness. Because the ground there is the monitor
and not the sheet, monitor copy uses `monitor-ink` (6.0:1), which is deliberately lighter than
`ink-3`. No other surface may use `monitor` as a background, and no non-video surface may use
`monitor-ink` as text.

**The Tokenized Alert Rule.** Attention is a name, not a literal. Alert, alert-line,
alert-wash (and their `-2` tones) plus warn and warn-dot exist so that no raw hex ever appears
in a className across `src/`. A second brand colour is the failure mode this rule exists to
prevent.

## Typography

**Display Font:** Archivo (fallback `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Archivo (fallback `ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** Spline Sans Mono, weights 400/500/600 (fallback `ui-monospace, "SFMono-Regular", monospace`)

**Character:** two printed grotesk jobs and one monospace job. Archivo does the speaking;
Spline Sans Mono does the accounting — every id, timecode, duration, resolution, value and
statistic, with tabular figures. The mono is not a "code" flavour here; it is the type of a
column that has to align.

### Hierarchy
- **Display** (600, 1.75rem → 2.125rem at `sm`, line-height 1.12, tracking −0.022em): the page
  title. `SheetTitle` defaults to `h1` and is the only size that shrinks a block.
- **Headline** (600, 1.375rem → 1.5rem, tracking −0.02em): the lobby title and the error
  boundaries' heading.
- **Title** (600, 0.875–0.9375rem, tracking −0.01em): `SheetHead` block titles, table
  definitions, form legends. Structural, never a kicker.
- **Body** (400, 0.875rem, line-height 1.5–1.65): prose and notes. `SheetProse` caps the
  measure at 70ch with `text-wrap: pretty`; the home and the ruler cap their consequence lines
  at 62ch, cell notes at 42ch.
- **Label** (Spline Sans Mono 500, 10.5px, tracking 0.13em, uppercase): every column header,
  field label, group legend and panel title. Graphite, over a hairline.
- **Value** (Spline Sans Mono 400, 1.0625rem, tabular-nums; 1.375rem/600 in `signal` for an
  emphasized cell): the value inside a cell, a timecode, a stat row.

There is **no kicker and no eyebrow** anywhere in the system. A title carries itself; the weight
and the space above it build the hierarchy. Type sizes are in `rem` (so they follow the root
size) and title measures are in `ch` — never title sizes in `ch`, because `ch` resolves against
the parent's font size, not the heading's, and silently produced a 405px column and three broken
lines instead of two.

### Named Rules

**The Two Voices Rule.** Archivo says something; Spline Sans Mono reports a fact. Any string
containing a value, an id, a time, a count or a setting is mono with tabular figures, and
tabular figures are applied globally to `input`, `select`, `textarea` and `button` — a numeric
column that does not align is a broken column.

**The Label Is A Rule Rule.** Every column header and field label is a mono uppercase caption in
`ink-3` sitting on a hairline. It is data structure, not a floating label.

## Layout

**Container.** `max-width: 1180px` with `px-4` / `sm:px-6` gutters for the home, the dashboard
and the Navbar; `max-width: 68rem` for the lobby; `max-width: 30rem` for auth (`AuthShell`);
`max-width: 34rem` for the loading and error states; `max-width: 46rem` for the settings modal
panel; `max-width: 80rem` for the in-room footer rail. Vertical page rhythm is
`mt-16` / `sm:mt-20` between bands — the visible gap is what keeps the page from reading as one
continuous surface.

**The sheet is the only container.** `Sheet` (white, `rule` border, `shadow-lift`, 3px radius)
is the single elevated block in the system. A block inside a block is always wrong: content
inside a sheet uses `Band` (a ruled, padded section with a real gap around it), never another
`Sheet`.

**The ruler grid.** `CaptureRuler` is a two-row grid. Both rows are `grid-cols-2` on mobile and
`md:grid-cols-4` — the *same* breakpoints, deliberately, so the option cells stay under the
value cells they change. The option row nests one grid per column (3 / 3 / 2 / 2 columns) and
the gaps are collapsed to hairlines by `gap-px` over a `bg-rule` frame, which is how the
command rail and the panel toggles in the room are built too.

**Responsive rules.**
- At `sm` the page title steps up, `Band` padding goes `px-6 py-7` → `px-8 py-8`, and the home's
  two-column sections and the settings device grid become two-up.
- At `md` the ruler goes to four columns, the home's "Entrar" row splits into
  `minmax(0,1fr) 15rem`, the capabilities list splits at `15rem`, and the hosting block splits
  at `26rem`.
- At `lg` the room becomes a two-column stage: monitor (fluid, `min-h-[45vh]`) beside a
  `17.5rem` command column; the lobby becomes preview + a `23rem` identity column; the
  participants and chat sidebars take `20rem` / `22rem`; the MediaControls rail flips from a
  3-across grid to a single column.
- Below `lg` those same panels stack full width, and the media control rail stays a 3-across
  grid so the keys keep their shared baseline.
- The dashboard table scrolls horizontally inside its own sheet with a `min-w-[42rem]`; the page
  itself never scrolls sideways (`body` uses `overflow-x: clip`).
- `min-height: 100dvh` with a `100vh` fallback, and `viewportFit: "cover"`, because `100vh` on
  mobile includes the address bar and cuts content.

**Density.** One primary action per screen. Table rows `py-4` on the sheet, `py-2.5` in a
header band, sidebars `py-3`. The room deliberately runs the command rail at 0.6875rem
(11px) labels with a 15px glyph, because in a call nobody is reading; they are scanning.

## Elevation & Depth

This system uses **two shadows and nothing else**. It is not flat: a sheet lifted off the desk
projects a short, offset, real shadow. `--shadow-lift: 0 1px 2px rgb(22 23 26 / 0.06),
0 6px 16px -10px rgb(22 23 26 / 0.18)` travels with every `Sheet` — the page ground, the
lobby, the auth card, the error card. `--shadow-overlay: 0 2px 4px rgb(22 23 26 / 0.07),
0 24px 48px -18px rgb(22 23 26 / 0.28)` is reserved for the settings modal, the one thing in
the product that genuinely floats over everything else. The global-error boundary inlines the
lift value as a literal because it replaces the root layout and the stylesheet may be exactly
what failed.

### Shadow Vocabulary
- **Lift** (`0 1px 2px rgb(22 23 26 / 0.06), 0 6px 16px -10px rgb(22 23 26 / 0.18)`): the
  sheet, and only the sheet. Real offset and real blur — without them it is a decorative halo.
- **Overlay** (`0 2px 4px rgb(22 23 26 / 0.07), 0 24px 48px -18px rgb(22 23 26 / 0.28)`): the
  settings modal panel. Nothing else.

### Named Rules

**The Rules Carry Depth Rule.** No shadow does structural work, and nothing inside a sheet
shadows. Nested depth is expressed with `--color-band` / `--color-band-2` and a hairline; if a
block needs a shadow to be readable, it is a second `Sheet` and should be a `Band` instead.

**The Two Shadows Rule.** If a new surface needs a third shadow, it has found a new job: either
it is a sheet (use `lift`) or it is the modal (use `overlay`). There is no third category.

## Shapes

**Radius is capped at 3px.** `--radius-sheet: 3px` is the sheet, every button, the action, the
stats panel, the control rail, the room-code input group and the modal panel.
`--radius-cell: 2px` is the finer register: inputs, selects, small buttons, the Stamp, the
Navbar links, the checkbox. Anything joining two inputs directly uses `0` on the touching side
and the cell radius on the outer side, so a compound control reads as one control, not two.

**Borders are the shape language.** Structure is drawn with `border-rule` hairlines (`h-px`,
`border-b`, `divide-y`) and `border-rule-2` for block edges and input strokes; `border-rule-3`
is the outer frame and the hover state. A filled block with no rule is not a shape this system
produces. Where a panel needs a seam between adjacent cells, the technique is `gap-px` over a
`bg-rule` frame rather than two half-borders.

**Clipping.** Video containers clip to the sheet radius (`--radius-sheet`, forced on the LiveKit
`lk-video-container` with `!important` because the SDK writes that class). Nothing else is
clipped except the scrollbars, which are 10px with a 3px paper border and a 9999px thumb.

## Components

The primitives live in `src/components/sheet/` and are the only container vocabulary. Every
surface composes them; none of them grows a second opinion.

### Buttons
- **Shape:** 3px (`--radius-sheet`), `px-4 py-2`, 0.8125rem semibold, `gap-2`, 150ms colour
  transition, `disabled:opacity-40` with pointer events off. `Button` (a `<button>`) and
  `Action` (a `next/link` with the identical class) are the same button; pick by element, not
  by look. The landing CTA and the form submits use `px-5 py-2.5` at 0.875rem.
- **Primary:** `bg-signal` / `text-on-signal` / `border-signal`; hover and active go
  `signal-2`. Used once per screen.
- **Secondary:** `bg-sheet` / `text-ink` / `border-rule-2`; hover `bg-band` + `border-rule-3`;
  active `bg-band-2`.
- **Quiet:** transparent, `text-ink-2`; hover `bg-band` + `text-ink`. For the third action.
- **Danger:** `bg-sheet` / `text-alert` / `border-alert-line`; hover `alert-wash` +
  `alert-line-2`; active `alert-wash-2`. Leaving the room is danger, not primary — the styling
  says the same thing the label does.
- **Hover / Focus:** colour only, no lift, no scale. Focus is the global 2px `signal` outline
  with a 2px offset and a 2px radius.

### Chips (Stamps)
- **Style:** `Stamp` is a 10px mono uppercase label in a 2px box with a 1px `rule-2` border and
  3px vertical padding. Three system states, all of them written out: PENDENTE, ATIVO, TRAVADO.
  ATIVO adds `border-signal bg-signal-wash text-signal` plus a 5px signal dot; PENDENTE and
  TRAVADO are `ink-3` with a `rule-2` border.
- **State:** the label is the state. `children` overrides the word when a domain has its own
  name — "Pública"/"Com senha" for room access, "Compartilhando tela" for a live share,
  "Aberta" for an unlocked lobby. The text is never `ink-4`, and a state is never conveyed by
  the border colour alone.

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** `bg-sheet` on the paper ground. `bg-band` and `bg-band-2` for recessed rows
  inside a sheet; `bg-monitor` for video only.
- **Shadow Strategy:** `shadow-lift` on the sheet only.
- **Border:** `border-rule`, or `border-rule-2` for a block that has to read as a control
  (inputs, the settings panel, the video frame).
- **Internal Padding:** `p-5 sm:p-6` for a form sheet, `p-6 sm:p-7`/`p-8` for a content sheet,
  `px-6 py-7 sm:px-8 sm:py-8` for a `Band`, `px-5 py-4 sm:px-6` for a cell.

### Cells and the Ruler
- **Cell** (`Cell`): mono uppercase label in `ink-3` over a hairline, then the value in mono
  and ink, then the optional note (max 42ch, `ink-3`). `value` is a `string` on purpose — the
  amendment compares values, so the cell carries data, not arbitrary nodes.
- **The amendment mark** (`useAmendment`, used by `Cell`): on every value change the previous
  value stays visible, struck through in `ink-3` with an `ink-4` strike, immediately before the
  new value, which carries `.amended` (`ink-settle`, 260ms, `cubic-bezier(0.16, 1, 0.3, 1)`,
  starting from `opacity .35` and `translateY(2px)` so nothing is ever hidden mid-flight). The
  previous value is part of the layout for 4.5s (`holdMs`), it is `aria-hidden` as duplicate
  text, and a visually-hidden `aria-live="polite"` region announces
  `"<label>: <previous> alterado para <value>"`. First mount is not an amendment. This is not a
  toast and must not be built as one.
- **Choice:** a native radio inside a `label`. Selected = `bg-signal-wash` + `text-signal`;
  unselected = `bg-sheet` + `text-ink-2`, `group-hover:text-ink`; hover and `focus-within` =
  `bg-band`. Options are separated by `border-r border-rule` with `last:border-r-0`.
- **ChoiceRow:** `role="radiogroup"` in a `grid` framed by `border-y border-rule`, one column
  per option, `minmax(0, 1fr)`. This is the shape every resolution/FPS/content-type selector
  takes in the product.
- **CheckCell:** a 15px square (2px radius) with a 12px square-capped check in `on-signal`;
  unchecked is `border-rule-2` on the sheet. The label goes `ink-2` to `ink` when checked. The
  native input stays `sr-only` and the row is a `label`, so keyboard and screen-reader support
  is free.

### Inputs / Fields
- **Style:** `inputClass` — `border-rule-2`, `bg-sheet`, `px-3 py-2`, 0.875rem, 2px radius,
  `placeholder:text-ink-3`. Field labels are the mono uppercase caption over a hairline
  (`Field`), and the error or hint sits below at 0.8125rem.
- **Focus:** the border becomes `signal` and the native outline is suppressed, because the
  global `:focus-visible` rule already draws the 2px signal outline with offset.
- **Error / Disabled:** errors are `text-alert` with `role="alert"`, on an `alert-line` /
  `alert-wash` block when the error is page-level. Disabled is `opacity-40`/`opacity-45` with
  pointer events off. The dashboard's `/room/` prefix is a `bg-band` box joined to the input
  with `border-r-0` and complementary radii.

### Navigation
- **Style:** the sheet's own head. Sticky, `h-14`, `border-b border-rule`,
  `bg-paper/92` with a light backdrop blur, 1180px container. Wordmark left at
  1.0625rem semibold with `Screen` in `signal`; session controls right in 0.8125rem cells with
  2px radius.
- **States:** idle `text-ink-2` on a transparent border, hover `bg-band` + `text-ink`;
  current page `border-signal-line bg-signal-wash text-signal` with `aria-current="page"`. The
  while-loading slot reserves the final width (a 9.5rem spacer) so the bar does not reflow
  after hydration. There is no "PRO" badge: the product is MIT and has no plan, so a plan badge
  would be a claim that does not exist.

### The CaptureRuler (signature component)

`src/components/site/CaptureRuler.tsx` is one component used by both the home `QualityBand` and
the lobby. Four columns — Resolução, Taxa, Conteúdo, Áudio — each with a value cell above and
the option cells below it, then a consequence paragraph (`ink-2`, 62ch, `aria-live="polite"`)
and an audio line (`ink-3`). The consequence is derived from the selected values, in a fixed
precedence — content type, then frame rate, then resolution — and it never hardcodes a number
the neighbouring cell contradicts ("4K na faixa de tela, em {frameRate} FPS", not "em 60 FPS").
The home passes `showConsequence={false}` and renders the same text beside the CTA instead,
because there the row yields its width to the primary action; the rule for the sentence is the
same in both places. `capturePrefs.ts` is what makes the promise true: the home writes the
settings to `sessionStorage` on "Iniciar agora", the lobby reads them, and the room consumes
them as live settings.

### In-call surfaces

- **Command rail (`MediaControls`):** a `gap-px`/`bg-rule` grid of 15px lucide glyphs at
  `strokeWidth={1.5}` with the state written underneath — "Microfone ligado" / "Microfone mudo",
  "Câmera ligada" / "Câmera desligada", "Compartilhando" / "Tela". On state: `bg-signal-wash`
  `text-signal`; off: `bg-sheet text-ink-2`. Every key carries `aria-pressed` and a state
  `aria-label`, and the clipboard result is also announced in a visually-hidden
  `role="status"`. "Sair" hovers to `alert-wash`/`alert`.
- **The monitor:** the shared screen at `bg-monitor` with a `rule-2` frame, the screen share
  `object-contain` and camera tiles `object-cover`, with an empty state in `monitor-ink`. The
  live/idle state above it is a `Stamp` ("Compartilhando tela" / "Tela"). Camera tiles are
  contact sheets below the monitor: `aspect-video`, `bg-monitor`, and a `bg-sheet` caption bar
  with the name in 0.75rem `ink-2`.
- **Roster (`ParticipantsList`):** a column, not cards. Each person is a row with a definition
  list of written states — "Câmera: desligada", "Microfone: mudo", "Tela: compartilhando" —
  and "(Você)" in 11px mono. Speaking shows "Falando..." in signal. The states are words on
  purpose: an icon alone would make the room's meaning a private alphabet.
- **Chat (`ChatSidebar`):** an occurrence book, not balloons. Each message is a ruled row with
  the author and an `HH:MM` mono timestamp right-aligned, separated by `divide-y divide-rule`;
  the composer is a `bg-band` footer with an input and a 40px signal send button. A failed send
  returns the draft, focuses the input and shows an `alert-line` block — the message is never
  silently dropped.
- **Stats (`TrackStatsDropdown`):** a `role="dialog"` sheet with a `<dl>` of ruled rows —
  frame rate, resolution, bitrate, RTT, jitter, codec, packet loss, PLI/NACK/FIR, decoder.
  Unmeasured is `--`; never-measured latency and unknown quality are `n/d`. Quality is spelled
  out ("Excelente", "Boa", "Instável", "Conexão perdida") and only then tinted
  (`ink`, `warn`, `alert`, `ink-3` for unknown), with a dot beside it. Polled at 1s only while
  open; `Escape` closes it.
- **Settings (`SettingsModal`):** the one true overlay. `rgb(22 23 26 / 0.32)` scrim, a
  `max-w-[46rem]`, `max-h-[92dvh]` sheet panel with `shadow-overlay`, sheet-bottom on mobile
  and centred from `sm` up, portalled. Focus is trapped, the rest of the page is `inert`, focus
  returns to the trigger on close, `Escape` closes, and the close affordance is a "Concluído"
  button (a dialog with no state to save should say so). The transmission `fieldset` is
  `disabled` while a share is live and says why, because changing FPS under a live publisher
  does nothing.
- **Recorder (`LocalRecorder`):** recording state is a signal-washed block with a 7px signal
  dot and a tabular `MM:SS`, idle is a quiet text button, and a second bordered row re-offers
  the download. Errors are an `alert-line` block. The component states the real container
  format ("A gravação fica no seu navegador, em WEBM/MP4") because the file extension follows
  the actual `MediaRecorder` mimeType.
- **Warnings (`WarnRow`):** a ruled row on a `bg-band` band, `role="status"`, with a
  "Dispensar" text button — never a floating toast. The lobby's media-permission problem uses
  the `alert-line`/`alert-wash` block form because it needs to be read before anything else.

## Do's and Don'ts

### Do:
- **Do** put every value change through `Cell` + `useAmendment`, so the previous value stays
  struck through in graphite and the swap is announced — on every surface, not only where it
  is most visible.
- **Do** keep state a column value: write PENDENTE / ATIVO / TRAVADO, "Câmera desligada",
  "Captando áudio", "Falando..." next to the control or the gauge, and pair the colour.
- **Do** use `CaptureRuler` for any new capture control surface rather than a parallel
  implementation, and keep its two rows on the same breakpoints so the option cells stay
  under the value cells they change.
- **Do** derive consequence copy from the current values, and keep it inside 62ch in `ink-2`
  with a second `ink-3` line for audio.
- **Do** measure a new text colour against the sheet, the paper *and* the band before adding
  it; `ink-3` is the floor for copy, and the fourth ink step is for rules.
- **Do** reach for `bg-monitor` only behind a video element, and for a raised block only for
  the `Sheet` (lift) and the settings modal (overlay).
- **Do** let the focus ring be a marked cell: 2px `signal` outline, 2px offset, 2px radius,
  with negative-offset variants on full-cell radio/checkbox targets.
- **Do** keep the surface set's responsiveness honest: two to four columns at `md`, stage
  split at `lg`, table scroll inside the sheet, `100dvh` plus `viewportFit: "cover"`.

### Don't:
- **Don't** put copy in `ink-4` or on `rule-2`-scale grays. It measures 2.7:1; it is for
  disabled borders, rules and the strike on an amended value, and nothing else.
- **Don't** use leader blue for anything but the primary action and live state, and don't
  introduce a second accent. A second brand colour is how attention stops meaning attention.
- **Don't** signal state by colour alone — no green/red dots, no unlabelled toggles, no
  colour-only "live" badge. Every state also carries a word, a shape or an `aria` value.
- **Don't** invent numbers. Unmeasured is `--`; never-measured is `n/d`; a zero where the
  measurement does not exist is a lie, and RTT on the receiving side is exactly that case.
- **Don't** add a modal for a short, non-interrupting task. Room creation is an inline band on
  the sheet for exactly this reason; the settings dialog earns its overlay only because it
  interrupts a live call.
- **Don't** use a toast for a value change, and don't hide content during an animation. The
  amendment starts from a visible state; a fade-in from `opacity: 0` would erase the very
  record the interaction exists to keep.
- **Don't** nest a `Sheet` inside a `Sheet`, exceed 3px of radius, add a third shadow, or put
  a kicker/eyebrow above a title. Titles speak for themselves; nested cards are always wrong.
- **Don't** add a logo, favicon, screenshot, testimonial, sponsor logo, user count or plan
  badge. None exists in the repository, and the product is MIT-distributed with no commercial
  offer — the interface must not claim capability that does not exist.
- **Don't** round a claim up into a metric. `n/d` and `--` are a product-level honesty
  commitment that outranks visual tidiness.
- **Don't** ship a dark theme as an extension of this file. Dark is explicitly out of scope for
  this round, deferred by the user. It would need a full second ink ladder re-measured against
  a dark paper, a re-measured `ink-4` boundary, a decision on whether `monitor` survives as a
  distinct step at all, and a `prefers-color-scheme` strategy that the current single-source
  `@theme` block has no room for. Nothing in the current build supports it; do not imply it.

### Known limitations carried by this build (recorded, not canonized)

- **The in-call surfaces are not runtime-verified.** `ConferenceRoom`, `MediaControls`,
  `SettingsModal`, `LocalRecorder`, `TrackStatsDropdown`, `ParticipantsList` and `ChatSidebar`
  are typechecked, linted and code-reviewed, but capturing them needs a live LiveKit SFU and a
  real screen-share source, and Docker was unavailable in this environment. They are recorded
  here as built code, not as visually verified surfaces; the rendered evidence in
  `.impeccable/review/` covers the home, dashboard, login, register and the lobby preview.
- **Input boundaries sit at 1.98:1.** `inputClass` strokes with `rule-2` (`#b9b9b0`), which
  is below the 3:1 non-text threshold on the sheet. The boundary is reinforced by the mono
  uppercase label on a hairline, the `rule-3` hover border (3.5:1) and the signal focus border
  (10.8:1) — but the resting state is carried by the label, not by the border contrast. Do not
  record the `rule-2` stroke as compliant.
- **`src/lib/validate.ts` carries a pre-existing copy defect.** `FIELD_LABELS.password` is
  `"A senha"` and the template appends `deve ser preenchido.`, so a failed login can render
  "A senha deve ser preenchido." — wrong agreement in pt-BR. `src/lib/` is user-scoped as
  preserved and was not touched, so this is recorded rather than repaired. The fix belongs in
  the validation layer, and this document must not be used to legitimise the wording.

### Accessibility commitments already in the build

- The ink ladder is contrast-bounded (see the Ink Ladder Rule); body text runs 17.9:1 and the
  lightest copy tone 4.8:1 on the paper, 5.3:1 on the sheet.
- The value change exists in voice: `Cell` renders a visually-hidden `aria-live="polite"`
  amendment sentence, and the clipboard result in the command rail is a `role="status"` region.
- Every control is a real control: native radio and checkbox inputs behind `sr-only`, with
  `role="radiogroup"` and `aria-label` on the row, `aria-pressed` on the media keys, and
  `aria-current="page"` in the Navbar. Focus is a 2px signal outline with a 2px offset, and
  full-cell targets use negative offsets so the ring marks the cell instead of clipping it.
- The microphone meter is a `role="meter"` with `aria-valuemin/max/now` and an `aria-valuetext`
  of "Captando áudio" / "Silêncio" / "Indisponível".
- The settings dialog is `role="dialog" aria-modal`, labelled and described, focus-trapped,
  with the rest of the page `inert` and focus restored on close; `Escape` closes it, as it
  does the stats panel.
- The page is `lang="pt-BR"`; tables carry an `sr-only` `caption` and scoped headers;
  icon-only buttons have `aria-label`s and their glyphs are `aria-hidden`;
  `-webkit-tap-highlight-color` is cleared on interactive elements.
- `prefers-reduced-motion: reduce` collapses every animation and transition in the app to
  0.01ms, so the amendment and the rule-draw still resolve to their final state.

### Browser-surface theming

The surfaces a browser draws and nobody designs are part of this world, not leftovers:
`::selection` is leader blue at 18% mixed over transparent with ink preserved on top;
`::placeholder` is `ink-3` at full opacity (never the browser's default gray); the scrollbar is
10px on a `paper` track with a `rule-2` thumb carrying a 3px paper border and turning to
`rule-3` on hover; the scrollbar corner matches the track. Tabular numerals are applied
globally to `input`, `select`, `textarea` and `button`.
