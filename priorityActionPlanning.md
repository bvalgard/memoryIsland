# Memory Island — Priority Action Planning

UX/UI improvements identified from the Playwright review. Each item lists the issue and what needs to change.

---

## 🔴 Critical

### 1. Empty state: replace skeleton loaders with a zero-state CTA
**Issue:** A new user with no islands sees three black skeleton-loading rectangles indefinitely. The `+ Create New Island` and `Import Anki` buttons are small and buried in the top-right. There is no centered call-to-action, no illustration, no motivating copy.

**What to change:** When `currentIslands.length === 0` (and not loading), replace the skeleton cards with a centered zero-state: the mastery island images, a single large primary CTA ("Create your first Island"), and a short value statement. Demote `Import Anki` to a secondary link below it.

---

### 2. Mobile bottom nav: too many unlabeled icons
**Issue:** The bottom nav crams 8+ icons into a 390px bar with no labels. Touch targets are at their minimum viable size and users have no way to know what any icon does.

**What to change:** Cap visible items at 4–5. Add a short text label (1–2 words) below every icon. Move lower-priority items (Archive, Duplicate Scanner, etc.) behind a "More ⋯" overflow button.

---

### 3. Fix the demo button navigation path
**Issue:** `Auth.tsx:141` — `window.location.href = '/dashboard'` navigates to a Vite error page because the app base is `/memoryIsland/` and routing is HashRouter. The button is completely broken.

**What to change:** Change to `window.location.href = '/memoryIsland/#/dashboard'` or replace with a React Router `navigate('/dashboard')` call.

---

### 4. Desktop sidebar: add text labels to every icon
**Issue:** Nine icon-only buttons in the sidebar with hover-only tooltips. Users must hover each icon individually to discover what it does. This fails basic discoverability for new and returning users alike.

**What to change:** Add a short text label below each sidebar icon (matching the existing tooltip text). The sidebar can widen slightly to accommodate, or labels can be shown in small text (10–11px) beneath the icon within the existing 80px width.

---

### 5. Normalize the Distress Signals icon color
**Issue:** The Radio icon (Distress Signals / Q&A board) is permanently orange, making it look like a persistent alert on every single page load. It draws the eye away from primary features constantly.

**What to change:** Change the base icon color to match the other sidebar icons (grey, white on active). Add an orange dot-badge *only* when there are unread/unanswered questions — the same pattern used for the bell and social icons.

---

## 🟡 Important

### 6. Use plain-language labels for actions; keep thematic terms as secondary
**Issue:** Action labels throughout the app use the thematic vocabulary as primary text: "Anchor Island" (create), "Distress Signals" (Q&A), "Knowledge Map" (dashboard), "Exam Voyage" (test mode). These are charming as flavor but confusing as primary UI labels.

**What to change:** In buttons, modal headers, and nav tooltips, lead with plain language. Add the thematic term as a subtitle, badge, or decorative element. Examples:
- Button: `Create Island` (not "Anchor Island")
- Modal subtitle: *"Anchor your knowledge"*
- Nav tooltip: `Questions Board` (not "Distress Signals")
- Nav tooltip: `Dashboard` (not "Knowledge Map")

---

### 7. Dashboard subtitle: replace tagline with live study stats
**Issue:** The dashboard subtitle reads "Manage your knowledge base." on every visit — generic, uninspiring, and says nothing a returning user doesn't already know.

**What to change:** Replace the static tagline with a dynamic, context-aware message based on the user's current state. Examples: "12 cards due today — let's go." / "7-day streak. Keep it going." / "All caught up. Check back tomorrow." Falls back to the tagline only if no data is available yet.

---

### 8. Unify "Test Mode" and "Exam Voyage" into one name
**Issue:** The sidebar tooltip says "Test Mode". The modal header says "Test Mode / EXAM VOYAGE". Two names for the same feature creates inconsistency and reads like an unfinished rename.

**What to change:** Pick one name and use it everywhere consistently. Recommended: keep "Exam Voyage" as the primary name (it's distinctive and fits the theme) and update the sidebar icon tooltip to match. Or drop "Exam Voyage" entirely and use "Test Mode" everywhere.

---

### 9. Group Settings into named sections
**Issue:** The settings panel is a flat, ungrouped list of seven settings followed by library tools — mixing display preferences, learning behavior settings, and utility tools with no visual separation.

**What to change:** Divide into 2–3 clearly labeled sections with a visual divider between each:
- **Study** — Progress Tracking, Session Display, Written Recall, Study Grace Window
- **Account** — Island Sorting, Public Ranking
- **Library Tools** — Duplicate Scanner, Archive, Anki Import

---

### 10. Settle on one term: "Archipelago" or "Collection"
**Issue:** The Create Island modal labels the group field `ARCHIPELAGO (COLLECTION)` — using both terms simultaneously because neither is trusted to stand alone. This reads as indecision and adds cognitive load.

**What to change:** Pick one term and use it consistently throughout all UI surfaces. Recommendation: use "Collection" in all labels and modals (plain language, universally understood), and keep "Archipelago" as a visual/branding element only (e.g., section headers, empty state illustrations). Update all form labels, tooltips, and modal text accordingly.

---

## 🟢 Polish

### 11. Auth page: use the desktop viewport more effectively
**Issue:** On 1280px desktop, the auth card is 375px wide and centered in a solid black background — leaving ~900px of unused screen space.

**What to change:** Option A: 2-column desktop layout (auth form left, rotating app screenshots or island imagery right). Option B: Keep centered card but replace the solid black background with the island imagery or a subtle animated gradient that gives the page visual interest without distracting from the form.

---

### 12. Notifications: clarify "Memory Alerts" label
**Issue:** The bell icon panel is labeled "MEMORY ALERTS" — thematic but breaks the universal convention (bell = notifications). Friend requests, island shares, and crew invites don't feel like "alerts".

**What to change:** Rename the panel header to "Notifications". Optionally keep "Memory Alerts" as a sub-label or use it only for a specific category (e.g., SRS due reminders).

---

### 13. Rename "Study Grace Window" to plain language
**Issue:** "Grace window" is SRS jargon that most users — even flashcard-savvy ones — won't immediately understand.

**What to change:** Rename to "Early Study Window" with the description: "Include cards due within the next X minutes in your current session."

---

### 14. Clarify the "Both" mode description in Progress Tracking
**Issue:** The BOTH option description says "Both always track silently" — "silently" is vague and reads like a bug description, not a feature explanation.

**What to change:** Rewrite to: "Both systems run. The UI shows SRS progress — mastery status is tracked in the background." or similar plain-language explanation of what the user will and won't see.

---

### 15. Add a loading timeout / error state for Firebase failures
**Issue:** When Firebase is slow or fails to connect, the app shows skeleton loading cards indefinitely with no timeout, error message, or retry option. Users see a broken-looking UI with no way out.

**What to change:** After ~5–8 seconds of loading with no data, transition from skeleton state to either: the zero-state CTA (if no islands), or an error banner ("Trouble connecting — check your connection and try again") with a retry button. The skeleton state should never be permanent.
