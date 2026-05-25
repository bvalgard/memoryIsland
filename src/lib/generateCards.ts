import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Card } from '../hooks/useUserProgress';

const DAILY_LIMIT = 20;

async function getRateLimitData(userId: string): Promise<{ date: string; count: number }> {
  const snap = await getDoc(doc(db, 'users', userId));
  const data = snap.data();
  return {
    date: data?.aiGenerationsDate ?? '',
    count: data?.aiGenerationsToday ?? 0,
  };
}

export async function getRemainingGenerations(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const { date, count } = await getRateLimitData(userId);
  if (date !== today) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - count);
}

async function incrementGenerationCount(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const { date, count } = await getRateLimitData(userId);
  const ref = doc(db, 'users', userId);
  if (date !== today) {
    await updateDoc(ref, { aiGenerationsDate: today, aiGenerationsToday: 1 });
  } else {
    await updateDoc(ref, { aiGenerationsToday: count + 1 });
  }
}

function friendlyApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    const body = JSON.parse(msg.match(/\{[\s\S]*\}/)?.[0] ?? '');
    const code: number = body?.error?.code ?? 0;
    const status: string = body?.error?.status ?? '';
    if (code === 503 || status === 'UNAVAILABLE') return 'Gemini is overloaded right now. Wait a moment and try again.';
    if (code === 429 || status === 'RESOURCE_EXHAUSTED') return 'Rate limit hit. Wait a few seconds and try again.';
    if (code === 401 || code === 403) return 'AI generation is not configured correctly. Check your API key.';
    if (body?.error?.message) return `AI error: ${body.error.message}`;
  } catch { /* not JSON — fall through */ }
  if (/overload|unavailable|capacity/i.test(msg)) return 'Gemini is overloaded right now. Wait a moment and try again.';
  if (/rate.?limit|quota/i.test(msg)) return 'Rate limit hit. Wait a few seconds and try again.';
  return 'Generation failed. Please try again.';
}

const ALL_TYPES = ['mcq', 'multi-select', 'sequencing', 'fill-in-the-blank', 'flashcard'] as const;

function buildTypeInstructions(selected: string[]): string {
  const active = ALL_TYPES.filter(t => selected.includes(t));
  const hasMcq = active.includes('mcq');
  const shares: Partial<Record<string, number>> = {};

  if (hasMcq) {
    shares['mcq'] = 50;
    const rest = active.filter(t => t !== 'mcq');
    const each = rest.length > 0 ? Math.floor(50 / rest.length) : 0;
    rest.forEach(t => { shares[t] = each; });
  } else {
    const each = Math.floor(100 / active.length);
    active.forEach(t => { shares[t] = each; });
  }

  const lines: string[] = ['Choose card types that best fit each piece of knowledge:'];
  if (shares['mcq'])               lines.push(`- mcq: ~${shares['mcq']}% — factual recall with plausible distractors`);
  if (shares['multi-select'])      lines.push(`- multi-select: ~${shares['multi-select']}% — when multiple answers are simultaneously correct`);
  if (shares['sequencing'])        lines.push(`- sequencing: ~${shares['sequencing']}% — when order matters (steps, stages, progression)`);
  if (shares['fill-in-the-blank']) lines.push(`- fill-in-the-blank: ~${shares['fill-in-the-blank']}% — key terms or values worth memorizing verbatim`);
  if (shares['flashcard'])         lines.push(`- flashcard: ~${shares['flashcard']}% — simple definitions that don't fit other formats`);
  lines.push(`\nOnly use these types: ${active.join(', ')}. Do NOT generate any other types.`);
  return lines.join('\n');
}

function buildPrompt(notes: string, cardCount: number, selectedTypes: string[], instructions?: string): string {
  return `You are a medical/academic flashcard generator. Create exactly ${cardCount} study cards from the notes below.
${instructions ? `\nAdditional instructions: ${instructions}\n` : ''}

${buildTypeInstructions(selectedTypes)}

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.

--- MCQ ---
{
  "type": "mcq",
  "front": "<question>",
  "back": "<correct answer — must exactly match one entry in options and correctOptions>",
  "options": ["<correct>", "<wrong>", "<wrong>", "<wrong>"],
  "correctOptions": ["<correct>"],
  "explanation": "<1-2 sentence concept explanation>",
  "explanations": {
    "<correct>": "Correct — <why>",
    "<wrong>": "Incorrect — <why>",
    "<wrong>": "Incorrect — <why>",
    "<wrong>": "Incorrect — <why>"
  }
}

--- MULTI-SELECT (multiple correct answers) ---
{
  "type": "multi-select",
  "front": "<question asking to select all that apply>",
  "back": "<comma-separated list of correct answers>",
  "options": ["<opt1>", "<opt2>", "<opt3>", "<opt4>", "<opt5>"],
  "correctOptions": ["<opt1>", "<opt3>"],
  "explanation": "<concept explanation>",
  "explanations": {
    "<opt1>": "Correct — <why>",
    "<opt2>": "Incorrect — <why>",
    "<opt3>": "Correct — <why>",
    "<opt4>": "Incorrect — <why>",
    "<opt5>": "Incorrect — <why>"
  }
}

--- SEQUENCING (put steps in correct order) ---
{
  "type": "sequencing",
  "front": "<question asking to order the following>",
  "back": "<brief description of the correct sequence>",
  "options": ["<step 1>", "<step 2>", "<step 3>", "<step 4>"]
}
Note: options must be listed in the CORRECT order — the app will shuffle them for the learner.

--- FILL-IN-THE-BLANK ---
{
  "type": "fill-in-the-blank",
  "front": "<sentence with ___ where the key term belongs>",
  "back": "<exact word or phrase that fills the blank>"
}

--- FLASHCARD ---
{
  "type": "flashcard",
  "front": "<question or concept>",
  "back": "<answer>"
}

Rules:
- Every MCQ and multi-select must have at least 4 options
- MCQ correctOptions has exactly 1 entry; multi-select has 2 or more
- "back" and all "correctOptions" strings must exactly match strings in "options"
- All "explanations" keys must exactly match strings in "options"
- Shuffle options (correct answer not always first)
- Plausible distractors only

Notes:
${notes}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawCard = Record<string, any>;

export async function generateCardsFromNotes(
  notes: string,
  cardCount: number,
  userId: string,
  selectedTypes: string[] = [...ALL_TYPES],
  instructions?: string
): Promise<Card[]> {
  const remaining = await getRemainingGenerations(userId);
  if (remaining === 0) throw new Error('Daily generation limit reached. Try again tomorrow.');

  const workerBase = ((import.meta as unknown as Record<string, Record<string, string>>).env.VITE_UPLOAD_WORKER_URL ?? '').replace(/\/+$/, '');
  if (!workerBase) throw new Error('AI generation is not configured.');

  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to generate cards.');
  const token = await user.getIdToken();

  const prompt = buildPrompt(notes, cardCount, selectedTypes, instructions);

  let res: Response;
  try {
    res = await fetch(`${workerBase}/generate-cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt }),
    });
  } catch (err) {
    throw new Error(friendlyApiError(err));
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errMsg = errBody?.error ? JSON.stringify({ error: errBody.error }) : String(res.status);
    throw new Error(friendlyApiError(new Error(errMsg)));
  }

  const { text } = await res.json() as { text: string };
  const cleaned = (text ?? '').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  let parsed: RawCard[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned an unreadable format. Please try again.');
  }

  if (!Array.isArray(parsed)) throw new Error('AI returned unexpected format. Please try again.');

  await incrementGenerationCount(userId);

  return parsed
    .filter((c: RawCard) => typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim())
    .slice(0, cardCount)
    .map((c: RawCard): Card => {
      const front = c.front.trim();
      const back = c.back.trim();

      if ((c.type === 'mcq' || c.type === 'multi-select') && Array.isArray(c.options) && c.options.length > 0) {
        return {
          front, back, type: c.type,
          options: c.options,
          correctOptions: Array.isArray(c.correctOptions) && c.correctOptions.length > 0 ? c.correctOptions : [back],
          explanation: c.explanation ?? '',
          explanations: c.explanations ?? {},
        };
      }
      if (c.type === 'sequencing' && Array.isArray(c.options) && c.options.length > 0) {
        return { front, back, type: 'sequencing', options: c.options };
      }
      if (c.type === 'fill-in-the-blank') {
        return { front, back, type: 'fill-in-the-blank' };
      }
      return { front, back, type: 'flashcard' };
    });
}
