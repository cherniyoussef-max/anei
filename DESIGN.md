---
name: ANEI Experience System
description: An institutional field guide that turns inclusive education into daily practice.
colors:
  institutional-navy: "#082d55"
  institutional-navy-strong: "#061f3d"
  field-gold: "#c9913f"
  field-gold-muted: "#ead6b8"
  editorial-ivory: "#fcfbf8"
  warm-paper: "#f6f3ee"
  cool-reference: "#f0f3f6"
  primary-ink: "#09284a"
  secondary-ink: "#34465a"
  muted-ink: "#647184"
  on-dark: "#f8fafc"
  on-dark-muted: "#c7d4e2"
  subtle-border: "#dce2e8"
  strong-border: "#bdc8d3"
  focus-blue: "#2c6bed"
  success-green: "#14765a"
typography:
  display:
    fontFamily: "Inter, Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "clamp(3rem, 4.1vw, 4rem)"
    fontWeight: 760
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "clamp(2.1rem, 3.4vw, 3.15rem)"
    fontWeight: 740
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "1.22rem"
    fontWeight: 700
    lineHeight: 1.28
  body:
    fontFamily: "Inter, Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, Segoe UI, Tahoma, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.45
rounded:
  control: "8px"
  card: "12px"
  media: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section-mobile: "64px"
  section-desktop: "96px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.on-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.institutional-navy-strong}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.institutional-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
    height: "48px"
  course-card:
    backgroundColor: "#ffffff"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.card}"
    padding: "22px"
  newsletter-input:
    backgroundColor: "#ffffff"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    height: "46px"
---

# Design System: ANEI

## Overview

**Creative North Star: "The Institutional Field Guide"**

ANEI presents inclusive education as a rigorous, human practice rather than a technology pitch. Its public experience behaves like an institutional learning publication: concise editorial copy, authentic documentary photography, disciplined grids, and clear routes into courses, resources, webinars, and professional support. Deep navy provides authority, warm ivory keeps the atmosphere humane, and scarce gold marks moments of orientation.

The system is deliberately one product with three visual experiences. The public website is spacious, editorial, and persuasive; the learner LMS is calm, focused, and progress-led; the admin console is a separate, dense enterprise workspace with its own shell, sidebar, tables, filters, and operational hierarchy. They share accessibility, bilingual quality, typographic discipline, and restrained geometry, but they must never be visually merged.

**Key Characteristics:**

- Editorial hierarchy before decorative containers.
- Documentary learning photography used only where it adds evidence and context.
- Border-led depth with restrained 8–16px geometry.
- Equal French and Arabic quality with genuine RTL composition.
- Real product actions and repository-backed content; no fabricated proof.

## Colors

The public palette combines institutional navy and warm gold with ivory paper and restrained cool reference surfaces; semantic state colors remain functional and sparse.

### Primary

- **Institutional Navy:** The public action, navigation, structural-band, footer, and high-authority color.
- **Institutional Navy Strong:** Hover, closing CTA, and deepest public surface.

### Secondary

- **Field Gold:** A scarce orientation cue for nav underlines, arrows, dates, counters, and newsletter action.
- **Field Gold Muted:** Supporting text and certification cues on dark surfaces.

### Neutral

- **Editorial Ivory:** Default public page field and hero ground.
- **Warm Paper:** Human, resource-oriented section changes and quiet hover feedback.
- **Cool Reference:** Course-discovery and informational surface changes.
- **Primary, Secondary, and Muted Ink:** A three-step hierarchy for headings, prose, and metadata.
- **Subtle and Strong Border:** The primary means of grouping, separating, and ordering content.
- **On Dark and On Dark Muted:** High- and low-emphasis content on navy.

### Named Rules

**The Scarce Gold Rule.** Gold points, dates, verifies, or orients; it does not become the global CTA color or a decorative wash.

**The Surface Change Rule.** Alternate ivory, warm paper, cool reference, white, and navy to signal chapter changes; do not wrap every chapter in a card.

## Typography

**Display Font:** Inter (with Segoe UI, Tahoma, Arial, and sans-serif fallbacks)

**Body Font:** Inter (with Segoe UI, Tahoma, Arial, and sans-serif fallbacks)

**Arabic Font:** Noto Sans Arabic (with Tahoma and Arial fallbacks)

**Character:** One professional sans-serif voice creates continuity between editorial storytelling and product utility. Compact Latin tracking gives headings authority; Arabic removes artificial tracking and uses more generous line height so it carries equal visual weight without imitation.

### Hierarchy

- **Display** (760, responsive display scale, 1.04): Hero missions only, held to roughly 12–15 characters per line; Arabic uses 1.23–1.30 line height.
- **Headline** (740, responsive section scale, 1.1): Chapter openings with balanced line wrapping; Arabic uses 1.35 line height.
- **Title** (700, 1.22rem, 1.28): Course, panel, and content-object titles.
- **Body** (400, 1rem, 1.7): Explanatory prose, normally constrained to 55–62 characters; Arabic prose uses approximately 1.9 line height.
- **Label** (700, 0.75rem, 1.45): Metadata, dates, categories, and compact operational cues. Uppercase is reserved for genuinely short Latin metadata, never used as decoration.

### Named Rules

**The Unified Voice Rule.** Typography establishes status and rhythm before cards, shadows, or ornamental display fonts.

**The Arabic Parity Rule.** Arabic is typeset for Arabic reading, with true RTL flow, zero forced tracking, appropriate line height, and independently validated crops and directional icons.

## Layout

Public pages use a 1260px maximum container with generous gutters: 48px per side on wide screens, 40px below 1180px, 32px below 1024px, and 20px on mobile. Sections follow a 4/8px rhythm and typically breathe at 80–104px on desktop and 64px on mobile. Reading measures stay near 55–62 characters.

The public homepage is an editorial sequence, not a repeated card stack: mission and documentary photograph; three-part proof strip; role-based routes; real learning paths; method; live human support; resources and news; closing action. The first viewport gives the course-discovery action priority and lets the proof strip enter the lower edge. Grids vary with content: asymmetrical course emphasis, two-column method and knowledge layouts, bordered lists, and dark support bands.

At 1023px, complex grids reduce or recompose; at 767px, they become intentional single-column reading flows. Actions become full-width where appropriate, the method copy and image reorder semantically, proof items become a divided list, and footer/navigation structures become touch-first. Validate 375, 768, 1024, 1280, and 1440px without page-level overflow.

The learner LMS uses a calmer, task-first layout centered on continuation, progress, lessons, certificates, and profile actions. The admin console uses a dedicated enterprise shell with higher density, compact panels, explicit filters, tabular data, and mobile strategies for operational tables. Neither inherits the public homepage composition.

## Elevation & Depth

The public system is flat and border-led by default. Section-tone changes, rules, image crops, and contrast create most depth. A single low, cool navy shadow is reserved for important documentary media and course cards responding to hover; the mobile hero photograph intentionally drops it. Translucency is limited to the sticky public header and the readable caption over photography.

### Shadow Vocabulary

- **Documentary Raised:** A broad, low-opacity navy shadow for hero media and meaningfully elevated course states.
- **Mobile Drawer:** A directional lateral shadow that clarifies the off-canvas navigation edge and reverses with RTL.

### Named Rules

**The Border-Before-Shadow Rule.** Use dividers, strokes, tonal shifts, and crop before elevation; no shadow is the default state.

## Shapes

The public form language is restrained: controls and compact date/action tiles use 8px corners, content cards and support panels use 12px, and documentary media uses 16px. Circular geometry is limited to human initials and true status/avatar forms. Borders are one pixel and structural; the course feature may use a three-pixel navy top rule as hierarchy. Image frames clip decisively rather than floating inside oversized shells.

**The Earned Pill Rule.** Pills are only for compact status, mode, or tag information; buttons, panels, and layout containers remain gently squared.

## Components

### Buttons

- **Shape:** Confident compact rectangle (8px radius), at least 48px high in the public hero and CTA.
- **Primary:** Institutional navy with on-dark text, 11px × 20px internal padding, bold compact label, and optional directional arrow.
- **Hover / Focus:** Deepens to strong navy and may rise 1px on precise pointers; active compresses to 98%. Focus uses a 2px blue outline with 3px offset. Reduced motion removes translation.
- **Secondary:** Transparent with a strong border and navy text; on dark surfaces it becomes a white outline or white-filled action.

### Cards / Containers

- **Corner Style:** 12px for course and support objects; 16px for documentary media.
- **Background:** White on cool discovery fields; restrained translucent white only inside the navy support band.
- **Shadow Strategy:** Flat at rest; course cards may use Documentary Raised on hover.
- **Border:** One-pixel subtle border, strengthening on hover; non-featured courses use a navy top rule.
- **Internal Padding:** 18–22px for course objects and 21–28px for support panels.

### Inputs / Fields

- **Style:** White field, visible external label, 8px corners, and a minimum 46px height in the public newsletter composition.
- **Focus:** The shared 2px focus-blue outline with 3px offset; never remove the native-accessible focus indication.
- **Error / Disabled:** Errors remain textual as well as colored; status messaging keeps stable space to avoid layout jumps.

### Navigation

The sticky public header is 76px on desktop and 68px on mobile, with a compact institutional wordmark, 44px targets, navy text, and a two-pixel gold underline for hover/current state. Below 1180px it switches to a real off-canvas drawer; active state uses a gold inset edge that reverses in RTL. Learner and admin navigation use their own shells and must not reuse this public header.

### Proof Strip

Three concise claims sit in one border-led row beneath the hero, divided without cards. On mobile they become a vertical list with horizontal separators. Claims describe the product method—structured learning, usable resources, human support—without invented metrics.

### Method Steps

An ordered, rule-separated list pairs zero-padded gold counters with understand/apply/progress language. It is a signature field-guide device: instructional, compact, and responsive without becoming a timeline illustration.

## Do's and Don'ts

### Do:

- **Do** treat the public website as an editorial institutional guide with course discovery as its primary first-view action.
- **Do** use authentic documentary education imagery in a few high-value moments with meaningful alt text and deliberate crops.
- **Do** preserve distinct public, learner, and admin shells, density, navigation, and interaction priorities.
- **Do** use logical properties, mirror only directional icons, and inspect French and Arabic independently.
- **Do** preserve 44px targets, visible focus, semantic landmarks, reduced motion, and forced-colors support.

### Don't:

- **Don't** turn ANEI into a generic SaaS card-stack brochure, bento grid, or startup dashboard.
- **Don't** use childish illustration, decorative blobs, random gradients, glass surfaces, oversized headings, huge radii, emoji, or continuous motion.
- **Don't** fabricate metrics, testimonials, institutional claims, staff portraits, or controls without real behavior.
- **Don't** use gold as the default action color or scatter it decoratively.
- **Don't** place the public header, footer, photography, or marketing composition inside learner or admin workflows.
