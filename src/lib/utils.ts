import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Card } from '../hooks/useUserProgress';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

export function getActiveTierCards(allCards: Card[]): Card[] {
  const cardsById = new Map<string, Card>();
  allCards.forEach(c => {
    if (c.id) cardsById.set(c.id, c);
  });

  const childrenMap = new Map<string, Card[]>();
  const roots: Card[] = [];

  allCards.forEach(c => {
    const hasParent = c.prevTierCardId && cardsById.has(c.prevTierCardId);
    if (!hasParent) {
      roots.push(c);
    } else {
      if (!childrenMap.has(c.prevTierCardId!)) {
        childrenMap.set(c.prevTierCardId!, []);
      }
      childrenMap.get(c.prevTierCardId!)!.push(c);
    }
  });

  const getActiveNodes = (node: Card): Card[] => {
    const children = childrenMap.get(node.id!) || [];
    const isMastered = node.status === 'mastered';
    const childrenUnlocked = isMastered || node.nextTierUnlocked === true;

    if (isMastered && children.length > 0) {
      return children.flatMap(child => getActiveNodes(child));
    }

    if (!isMastered) {
      if (childrenUnlocked && children.length > 0) {
        return [node, ...children.flatMap(child => getActiveNodes(child))];
      }
      return [node];
    }

    // mastered terminal (no children)
    return [node];
  };

  return roots.flatMap(root => getActiveNodes(root));
}
