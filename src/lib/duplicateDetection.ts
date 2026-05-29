import { Card, Island } from '../hooks/useUserProgress';

export function normalizeFront(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function resolvedType(type?: string): string {
  return type ?? 'flashcard';
}

export function isDuplicatePair(
  a: { front: string; type?: string },
  b: { front: string; type?: string }
): boolean {
  return (
    normalizeFront(a.front) === normalizeFront(b.front) &&
    resolvedType(a.type) === resolvedType(b.type)
  );
}

export interface DuplicateMatch {
  card: Card;
  islandId: string;
  islandName: string;
}

export function findDuplicatesForCard(
  card: { front: string; type?: string },
  islands: Island[],
  excludeCardId?: string
): DuplicateMatch[] {
  if (!card.front.trim()) return [];
  const results: DuplicateMatch[] = [];
  for (const island of islands) {
    for (const c of island.cards) {
      if (excludeCardId && c.id === excludeCardId) continue;
      if (isDuplicatePair(card, c)) {
        results.push({ card: c, islandId: island.id, islandName: island.name });
      }
    }
  }
  return results;
}

export interface DuplicateGroup {
  key: string;
  front: string;
  type: string;
  cards: Array<Card & { islandId: string; islandName: string }>;
}

export function findAllDuplicateGroups(islands: Island[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  for (const island of islands) {
    for (const card of island.cards) {
      const normalized = normalizeFront(card.front);
      if (!normalized) continue;
      const type = resolvedType(card.type);
      const key = `${type}::${normalized}`;

      if (!groups.has(key)) {
        groups.set(key, { key, front: card.front, type, cards: [] });
      }
      groups.get(key)!.cards.push({ ...card, islandId: island.id, islandName: island.name });
    }
  }

  return Array.from(groups.values()).filter(g => g.cards.length >= 2);
}
