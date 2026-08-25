---
name: anei-visual-qa
description: Perform browser-based visual, responsive, accessibility, state, and UX QA on ANIE interfaces using deterministic routes and screenshots.
---

# ANIE Visual QA

Do not redesign during the first inspection.

Run the application and inspect actual rendered behavior.

Check each target screen at approximately:

1440 desktop
1024 laptop/tablet landscape
768 tablet
390 mobile

Check FR and AR/RTL.

For each screen inspect:

- visual hierarchy
- spacing consistency
- typography
- overflow
- clipping
- wrapping
- navigation
- touch targets
- keyboard focus
- tab order
- contrast
- form labels
- empty states
- loading states
- error states
- long content
- long French labels
- Arabic labels
- browser console errors

Use screenshots for comparison.

Do not approve based only on JSX/CSS inspection.

Check interactions:

hover
focus
pressed
disabled
loading
open dialog/drawer
menu
dropdown
navigation
form validation
success
failure

Verify prefers-reduced-motion.

Do not change business behavior during visual QA.

Return issues ordered:

BLOCKER
HIGH
MEDIUM
POLISH

Include exact route/component and reproduction.
