# Tablet App Logo Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all Medico Kadapa logos in the tablet app larger and flat, without changing uploaded medicine or hospital images.

**Architecture:** Update only the Tailwind utility classes on the four `/logo.png` render sites. Use a role-based size: 56 px in the application header and 96 px on standalone screens, with `object-contain` and no border, rounding, or shadow utilities.

**Tech Stack:** Next.js Pages Router, React, Tailwind CSS

## Global Constraints

- Use a 56 × 56 px logo in the compact application header.
- Use a 96 × 96 px logo on the login, hospital-selection, and loading screens.
- Remove border, border-radius, and box-shadow styling from every `/logo.png` image.
- Preserve the logo's aspect ratio with `object-contain`.
- Do not modify medicine images, hospital images, app icons, surrounding cards, or unrelated worktree changes.

---

### Task 1: Normalize Medico Logo Presentation

**Files:**
- Modify: `components/Layout.js`
- Modify: `components/RecordTab.js`
- Modify: `pages/login.js`
- Modify: `pages/index.js`

**Interfaces:**
- Consumes: Existing `/logo.png` public asset and Tailwind utility classes.
- Produces: Four consistently styled logo render sites with role-appropriate dimensions.

- [ ] **Step 1: Run the static styling check and confirm the current code fails it**

Run:

```bash
node -e "const fs=require('fs'); const files=['components/Layout.js','components/RecordTab.js','pages/login.js','pages/index.js']; const expected={'components/Layout.js':'w-14 h-14 object-contain','components/RecordTab.js':'w-24 h-24 object-contain mb-4','pages/login.js':'w-24 h-24 object-contain mb-4 animate-pulse','pages/index.js':'w-24 h-24 object-contain animate-pulse'}; for (const file of files) { const source=fs.readFileSync(file,'utf8'); if (!source.includes(expected[file])) throw new Error(file+' does not have approved logo classes'); }"
```

Expected: FAIL because at least `components/Layout.js` still uses `w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm`.

- [ ] **Step 2: Apply the approved Tailwind classes**

In `components/Layout.js`, set the `/logo.png` image class to:

```jsx
className="w-14 h-14 object-contain"
```

In `components/RecordTab.js`, set the hospital-selection `/logo.png` image class to:

```jsx
className="w-24 h-24 object-contain mb-4"
```

In `pages/login.js`, set the `/logo.png` image class to:

```jsx
className="w-24 h-24 object-contain mb-4 animate-pulse"
```

In `pages/index.js`, set the loading `/logo.png` image class to:

```jsx
className="w-24 h-24 object-contain animate-pulse"
```

- [ ] **Step 3: Run the static styling check and confirm it passes**

Run the exact Node command from Step 1.

Expected: exit code 0 with no output.

- [ ] **Step 4: Confirm no `/logo.png` render site retains forbidden styling**

Run:

```bash
rg -n -U 'src="/logo\.png"[\s\S]{0,180}className="[^"]*(rounded|border|shadow|object-cover)' components pages
```

Expected: no matches.

- [ ] **Step 5: Build the tablet app**

Run:

```bash
npm run build
```

Expected: production build completes successfully.

- [ ] **Step 6: Review the focused diff**

Run:

```bash
git diff -- components/Layout.js components/RecordTab.js pages/login.js pages/index.js
```

Expected: only the four `/logo.png` class strings change; pre-existing unrelated changes remain untouched.

- [ ] **Step 7: Commit only the logo styling changes**

```bash
git add components/Layout.js components/RecordTab.js pages/login.js pages/index.js
git commit -m "Increase and flatten tablet app logos"
```
