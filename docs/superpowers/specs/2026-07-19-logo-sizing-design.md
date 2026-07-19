# Tablet App Logo Sizing Design

## Goal

Make every Medico Kadapa brand logo in the tablet app larger and visually flat, without changing medicine or hospital images.

## Design

- Use a 56 × 56 px logo in the compact application header.
- Use a 96 × 96 px logo on the login, hospital-selection, and loading screens.
- Remove border, border-radius, and box-shadow styling from every `/logo.png` image.
- Preserve the logo's aspect ratio with `object-contain` so its full rectangular artwork remains visible without rounded clipping.
- Keep existing loading animation and spacing where they do not create border, rounding, or shadow effects.

## Scope

Only `/logo.png` presentations in `components/Layout.js`, `components/RecordTab.js`, `pages/login.js`, and `pages/index.js` are included. Database images, uploaded medicine images, hospital images, app icons, and surrounding cards are unchanged.

## Verification

- Search all tablet-app `/logo.png` usages to confirm none retain rounded, border, or shadow classes.
- Run the production build to catch styling or JSX regressions.
