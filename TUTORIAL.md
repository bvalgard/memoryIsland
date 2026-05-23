# Memory Island — Student Guide

## What Is Memory Island?

Memory Island is a flashcard app built around **spaced repetition** — a scientifically backed study method that shows you cards at the exact moment your brain is about to forget them. Instead of grinding through the same deck over and over in a single night, Memory Island spreads your reviews out over days and weeks, spacing each review further apart as your confidence grows.

The payoff: you study less total time and remember more, because you're spending effort on cards that actually need attention rather than drilling ones you already know.

If you're a nursing student grinding NCLEX questions, a pre-med student working through pharmacology, or anyone trying to retain a large body of facts — Memory Island is built for you.

---

## Core Concepts

### Cards

A **Card** is the fundamental unit of learning. Every card represents one piece of knowledge you want to retain. Cards have a front (the question or prompt) and a back (the answer), though the exact format varies by card type.

Every card in Memory Island has a **status** that reflects how well you know it:

| Status | What it means |
|---|---|
| **Learning** | You've seen this card and are building familiarity with it |
| **Struggling** | You got this card wrong after previously knowing it — it needs extra attention |
| **Mastered** | You've answered this card correctly enough times that the app trusts you know it |

Cards with no status yet (brand new cards) are treated as Learning.

### Islands

An **Island** is a collection of cards — essentially a deck. You might have an Island for "Cardiac Medications," another for "Anatomy of the Hand," another for "Spanish Irregular Verbs." Think of each Island as one subject area or study unit.

Islands have a **color score** (shown as a colored ring or bar) that reflects the overall mastery level of all cards inside. As cards move toward Mastered, the color score improves.

### Archipelagos

An **Archipelago** is a named group of Islands. Think of it as a course or a subject umbrella that contains multiple related decks.

For example:
```
Archipelago: "NCLEX Prep"
  ├── Island: Cardiac Medications
  ├── Island: Respiratory Drugs
  └── Island: Fluid & Electrolytes
```

Archipelagos let you study all related Islands together or drill into a single Island when you need to focus.

---

## Getting Started

### Creating Your First Island

1. From the Dashboard, tap the **+** button to create a new Island.
2. Give it a name that reflects what you're studying.
3. Optionally assign it to an existing Archipelago, or create a new one.

### Creating Cards

Inside an Island, tap **Add Card**. You'll be prompted to choose a card type (see below) and fill in the content.

**Tips for writing good cards:**
- One concept per card. "What is the mechanism of action of metoprolol?" is better than "Tell me everything about metoprolol."
- Phrase the front as a question or a prompt, not a topic.
- On the back, be precise but not wordy. You're testing recall, not writing a textbook.

---

## Card Types

Memory Island supports six card types. Choose the type that matches how you'll be tested on the material.

### 1. Flashcard

The classic. A front (question/term) and a back (answer/definition). You reveal the back and mark yourself correct or incorrect.

**Best for:** definitions, facts, direct question-answer pairs.

### 2. Multiple Choice (MCQ)

You're shown a question and four answer options. You tap the correct one. The app tells you immediately if you're right.

**Best for:** NCLEX-style practice, standardized test prep, anything where the real test is multiple choice.

### 3. Fill-in-the-Blank

A sentence or phrase with a word or phrase missing. You type your answer. The app checks it against the expected answer.

**Best for:** medication names, formulas, foreign language vocabulary, anything where exact wording matters.

### 4. Matching

You're shown two columns of items and drag to match them correctly.

**Best for:** pairing concepts (drug → side effect, term → definition, country → capital).

### 5. Multi-Select

Like MCQ, but multiple answers can be correct. You select all that apply.

**Best for:** "Select all that apply" NCLEX questions, scenarios where several things are simultaneously true.

### 6. Sequencing

You're given a list of items in a scrambled order and must arrange them correctly.

**Best for:** steps in a procedure, chain-of-events questions, prioritization (e.g., nursing interventions in order).

---

## Scenario Groups

For NCLEX and MCAT-style studying, Memory Island supports **Scenario Groups**: a shared passage or patient vignette pinned at the top of the screen while a series of related questions cycle through one at a time.

**Example:** A vignette describes a 67-year-old patient presenting with shortness of breath and chest pain. Below it, five separate questions appear one after another — each asking about assessment, intervention, medications, and priority — all tied to that same patient scenario.

**To create a Scenario Group:** in the card editor, choose the **Scenario** tab. Write the passage once, then add as many questions as you need under it. Each question can be any card type (MCQ, multi-select, fill-in-the-blank, etc.).

During study, scenario groups always appear together in sequence — the app never splits them apart or shuffles them into the middle of unrelated cards.

---

## How Spaced Repetition Works

Spaced repetition is based on the idea that **the right time to review something is just before you forget it.** If you study a card today, you might remember it tomorrow. If you get it right tomorrow, you'll probably remember it in 3 days. Get it right again then, and maybe you won't need to see it for a week. And so on.

Memory Island uses a well-known algorithm (SM-2) that tracks each card's **review interval** — the number of days until the card is due again. Here's how intervals grow:

- First correct answer → due again in **1 day**
- Second correct in a row → due in **6 days**
- Third correct in a row → interval multiplied by your card's **ease factor** (starts at 2.5)
- A wrong answer → interval resets to **1 day**

The ease factor adjusts based on your performance. Consistently easy cards get longer intervals. Cards you keep missing have their ease factor reduced, so they come back more frequently.

**What "Due" means:** A card is "due" when its next review date has arrived. The app won't show you a mastered card every session — only when it's actually time.

**Status thresholds:** The app categorizes your interval into a status:
- **Struggling** — interval under 3 days (you're still getting this wrong frequently)
- **Learning** — interval 3–13 days (you're building confidence)
- **Mastered** — interval 14+ days (the app trusts you know this)

---

## Study Modes

When you open an Island or Archipelago to study, you can choose a mode:

| Mode | What you see |
|---|---|
| **All** | Every card in the Island, shuffled |
| **Learning** | Cards you haven't mastered yet (new + learning status) |
| **Struggling** | Only cards you've been getting wrong — high-priority review |
| **Mastered** | Cards you've already mastered (useful for a confidence check) |
| **Due** | Only cards whose spaced repetition review date has arrived |

**Due mode is the most efficient way to study daily.** It shows you exactly the cards the algorithm determined are ready for review — no more, no less. This is what separates spaced repetition from traditional flashcard drilling.

### The Grace Window (Reviewing Cards Due Soon)

Sometimes you want to study for 30 minutes but a handful of cards aren't technically due until this evening. The **Grace Window** setting lets you pull those in early.

To configure it:
1. Go to **Settings** (usually accessible from your profile or the top of the Dashboard).
2. Find **Grace Window** (or "Due Window").
3. Set a number of minutes. Cards due within that many minutes from now will count as "due" and appear in Due mode.

**Examples:**
- `0 minutes` (default) — strict: only cards due right now
- `480 minutes` — include cards due within the next 8 hours
- `1440 minutes` — include anything due within the next 24 hours

This is especially useful the night before an exam when you want to sweep up anything due tomorrow morning.

---

## Card Progression and Tiered Cards

### How Cards Advance

Cards move through statuses (Learning → Mastered) based on their SRS interval, not a simple streak counter. Each correct answer increases the interval; each wrong answer shrinks it back.

A card you've mastered won't disappear — it simply won't come up until its review date. The app is tracking hundreds of due dates in the background so you don't have to.

### Tiered Cards

Some Islands have **tiered cards** — an advanced feature where mastering one version of a card unlocks a harder version of the same concept. Think of it as leveling up: once you can recognize a drug's name, a harder card might ask for its mechanism, then its side effects, then a clinical scenario where you apply all of it.

The app surfaces only the highest active tier for each card chain during study, so you're always working at your current edge.

---

## Sharing vs. Collaborating

Memory Island has two distinct ways to share study content, and understanding the difference matters.

### Sharing (Publishing)

When you **share** or **publish** an Island, you're creating a copy that other users can discover and download. Once someone downloads your Island, they get their own independent copy — they can study it, edit it, and track their own progress on it. Changes you make to the original after they've downloaded it won't affect their copy.

**Publishing workflow:**
1. In your Island, tap **Share** or **Publish**.
2. Your Island enters **pending** status — it goes to the public discovery feed pending approval.
3. Once approved, it appears in the global **Discover** tab for anyone to find and import.

Use sharing when you want to distribute a polished deck to classmates or the broader community.

### Collaborating (Collaborative Islands)

A **Collaborative Island** is a live, shared workspace. Multiple people can add, edit, and delete cards in real time. Everyone who's a collaborator sees the same Island, and changes appear immediately for all members.

Crucially, each collaborator tracks their **own** study progress independently — your "mastered" cards don't affect your partner's counts.

**Use collaborative islands when:**
- You're building a study deck as a group and want to divide up the card creation
- A study partner and you want to work from the same maintained source of truth
- A professor or tutor wants to push updates to a shared deck their students use

The same collaborative model applies to **Archipelagos** — you can create a shared Archipelago where a whole group contributes Islands.

---

## Publishing and Discovery

The **Discover** tab lets you browse Islands that other users have published. You can search by topic, preview the content, and import any Island into your own library.

When you import from Discover, you get your own personal copy. Study it, customize it, make it yours — the original author won't see your edits.

---

## Community Q&A

Stuck on a card you keep getting wrong? Memory Island has a built-in community Q&A system.

When you answer a card incorrectly during a study session, you'll see an option to **Ask the Community**. Posting a question sends it to the community feed where other users — especially those studying the same material — can write answers, upvote helpful responses, and leave comments.

The question includes the card content automatically, so helpers have full context.

When an answer genuinely helps you understand, tap **"This Saved Me!"** to mark it as accepted. This rewards the person who helped you and makes that answer more visible to future learners with the same question.

You can browse all community questions from the **Questions Board** (the bell icon on the Dashboard). Filter by All, Crew (friends), Islands you own, or your own questions.

---

## Social Features

### Leaderboard

The **Leaderboard** shows mastery scores across the community. You can opt in or out of the global leaderboard in Settings (`Show on Global Leaderboard`).

### Friends

Add friends to see how your progress compares to theirs and to filter the Q&A feed to questions from people you know.

---

## Achievements

Memory Island tracks your habits and milestones and awards **Achievements** (badges) for them. There are 16 achievements across three categories:

- **Consistency** — rewards for daily streaks, regular study habits
- **Resilience** — rewards for bouncing back from wrong answers and tough cards
- **Discovery** — rewards for exploring the Discover tab, sharing Islands, helping others in Q&A

View all your earned and locked badges in the **Captain's Quarters** (Trophy Room), accessible from your profile. Locked badges show what you're working toward.

A toast notification slides up automatically whenever you unlock something new.

---

## Settings Worth Knowing

| Setting | What it does |
|---|---|
| **Grace Window** | Minutes ahead of schedule a card qualifies as "due" |
| **Show on Global Leaderboard** | Opt in/out of the public score board |
| **Progress Tracking Mode** | Whether to show SRS intervals, status labels, or both |
| **Session Display** | "Focused" hides stats mid-session; "Stats" shows counts as you go |
| **Written Recall Mode** | Forces you to type your answer before flipping a flashcard |

---

## Quick Tips for Effective Studying

**Study Due cards every day.** Even 10–15 minutes in Due mode beats a two-hour cram session once a week. The algorithm only works if you show up consistently.

**Don't skip cards you know.** Marking an easy card correct is the mechanism that pushes it further into the future and frees up your session time. Skipping it doesn't advance anything.

**Use Struggling mode before exams.** A focused session on only your struggling cards is one of the highest-leverage things you can do the day before a test.

**Be honest when grading yourself on flashcards.** If you sort-of remembered it, mark it wrong. The cost of seeing a card one extra time is low. The cost of falsely advancing a card you don't really know is a gap in your knowledge when it counts.

**Build cards as you go.** The best time to make a card is immediately after encountering something you didn't know. Don't wait until you have 200 things to enter.

**Use Scenario Groups for clinical reasoning.** If your exam presents patient vignettes, build your cards the same way. Practicing in context is fundamentally different from drilling isolated facts.
