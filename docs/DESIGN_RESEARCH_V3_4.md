# ANEI v3.4 — Design research synthesis

This release does not clone any education platform. It synthesizes patterns that fit ANEI's product: public institutional discovery, learner LMS, and professional back-office.

## Skill / workflow references

### UI/UX Pro Max
Used as the baseline decision system for accessibility, touch targets, responsive layout, typography/color discipline, navigation, forms, and reduced motion.

### Anthropic Claude Code — `frontend-design`
Reference: https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design

Useful principle applied: commit to an intentional visual point of view instead of producing generic AI/SaaS UI. For ANEI that direction is **Human Editorial Institutional** rather than maximalism, playful education, or generic bento SaaS.

### `jiji262/claude-design-skill`
Reference: https://github.com/jiji262/claude-design-skill

Useful principles applied:
- gather real product/code context before styling;
- treat assets and imagery as first-class design inputs;
- declare the design system before implementation;
- actively avoid common AI-design tells;
- verify the result in a real browser before calling it finished.

### Claude Code Frontend Design Toolkit
Reference: https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit

Used as a broader checklist for site-wide theming, accessibility/research, browser testing, and avoiding isolated one-page redesigns.

## Education-product benchmarks

### Coursera
Patterns worth adapting: prominent discovery/search, compact course metadata, credentials, professional/academic trust, and clear catalog pathways.

### edX
Patterns worth adapting: strong academic information architecture, clear separation of learning types, structured program/course presentation, and institutional tone.

### LinkedIn Learning
Patterns worth adapting: continue-learning prominence, career/goal context, compact professional course surfaces, and progress visibility.

### Pluralsight
Patterns worth adapting: structured learning paths, progress orientation, efficient professional dashboard density, and focused learning workspace.

### MasterClass
Pattern worth adapting: strong editorial composition and human imagery. ANEI uses this only as a quality bar for photographic hierarchy, not its entertainment/luxury visual identity.

## ANEI v3.4 decisions

1. **Photography with purpose** — anonymous learner/facilitator imagery appears in the hero, editorial story, auth, course discovery, course purchase context, and learner welcome. It is never attached to named staff/AVS identities.
2. **Blue remains institutional** — cobalt/navy anchors trust; warm neutral surfaces make the platform less sterile.
3. **Editorial type hierarchy** — shorter headline measures, stronger copy/photo composition, fewer generic cards.
4. **Course discovery is visual but compact** — photographic cover, category/level, metadata, trainer, price/action.
5. **Learner UI is action-first** — Continue Learning remains the main object; the photo is context, not gamification.
6. **Admin stays operational** — the back-office does not inherit marketing photography or oversized editorial styling.
7. **No new UI dependency** — the redesign stays inside the existing Next.js/React/CSS system.

## Generated image assets

The release includes locally stored generated imagery:
- `public/media/anei-hero-learning.webp`
- `public/media/anei-learning-story.webp`
- `public/media/anei-learning-path.webp`

They are anonymous thematic visuals and are not representations of named ANEI staff, trainers, AVS profiles, or learners.
