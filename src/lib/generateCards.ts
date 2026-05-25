import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Card } from '../hooks/useUserProgress';

const GEMINI_MODEL = 'gemini-3.5-flash';
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

type RawCard =
  | { type: 'flashcard'; front: string; back: string }
  | {
      type: 'mcq';
      front: string;
      back: string;
      options: string[];
      correctOptions: string[];
      explanation: string;
      explanations: Record<string, string>;
    };

export async function generateCardsFromNotes(
  notes: string,
  cardCount: number,
  userId: string
): Promise<Card[]> {
  const remaining = await getRemainingGenerations(userId);
  if (remaining === 0) throw new Error('Daily generation limit reached. Try again tomorrow.');

  const apiKey = (process.env as Record<string, string>).GEMINI_API_KEY;
  if (!apiKey) throw new Error('AI generation is not configured.');

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a medical/academic flashcard generator. Create exactly ${cardCount} study cards from the notes below.

Prefer MCQ cards (aim for ~70%). Use flashcard only for simple definitions or facts that don't lend themselves to multiple choice.

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.

Each MCQ card must follow this exact shape:
{
  "type": "mcq",
  "front": "<clinical question>",
  "back": "<correct answer text — must exactly match one of the options>",
  "options": ["<correct answer>", "<wrong A>", "<wrong B>", "<wrong C>"],
  "correctOptions": ["<correct answer>"],
  "explanation": "<1-2 sentence explanation of the underlying concept>",
  "explanations": {
    "<correct answer>": "Correct — <why this is right>",
    "<wrong A>": "Incorrect — <why this is wrong>",
    "<wrong B>": "Incorrect — <why this is wrong>",
    "<wrong C>": "Incorrect — <why this is wrong>"
  }
}

Each flashcard must follow this exact shape:
{
  "type": "flashcard",
  "front": "<question or concept>",
  "back": "<answer>"
}

Rules:
- Every MCQ must have exactly 4 options
- The value of "back" must exactly match one of the strings in "options" and in "correctOptions"
- Every option in "explanations" must exactly match a string in "options"
- Options should be shuffled (correct answer not always first)
- Plausible distractors only — no obviously wrong answers

Notes:
${notes}`;

  const result = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  const text = result.text?.trim() ?? '';
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  console.log('[generateCards] raw response:', cleaned.slice(0, 500));

  let parsed: RawCard[];
  try {
    parsed = JSON.parse(cleaned);
    console.log('[generateCards] types returned:', parsed.map((c: any) => c.type));
  } catch {
    throw new Error('AI returned an unreadable format. Please try again.');
  }

  if (!Array.isArray(parsed)) throw new Error('AI returned unexpected format. Please try again.');

  await incrementGenerationCount(userId);

  return parsed
    .filter(c => typeof c.front === 'string' && typeof c.back === 'string' && c.front.trim() && c.back.trim())
    .slice(0, cardCount)
    .map((c): Card => {
      if (c.type === 'mcq' && Array.isArray(c.options) && c.options.length > 0) {
        return {
          front: c.front.trim(),
          back: c.back.trim(),
          type: 'mcq',
          options: c.options,
          correctOptions: c.correctOptions ?? [c.back.trim()],
          explanation: c.explanation ?? '',
          explanations: c.explanations ?? {},
        };
      }
      return {
        front: c.front.trim(),
        back: c.back.trim(),
        type: 'flashcard',
      };
    });
}
