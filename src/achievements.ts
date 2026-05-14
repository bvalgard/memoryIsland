export interface SessionMeta {
  sessionDurationMs: number;
  cardCount: number;
  correctCount: number;
  sessionStartHour: number;
  calibrationCorrect?: number;
  calibrationTotal?: number;
}

export type AchievementCategory = 'resilience' | 'motivating' | 'quirky';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  hidden: boolean;
  icon: string;
  unlockedAt?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Resilience
  {
    id: 'lost-in-the-fog',
    name: 'Lost in the Fog',
    description: 'Every great explorer gets lost sometimes. A concept just dropped a tier.',
    category: 'resilience',
    hidden: false,
    icon: '🌫️',
  },
  {
    id: 'bermuda-triangle',
    name: 'The Bermuda Triangle',
    description: 'Over 20 cards are lost in the Struggling zone at the same time.',
    category: 'resilience',
    hidden: false,
    icon: '🔺',
  },
  {
    id: 'against-the-current',
    name: 'Against the Current',
    description: 'You finally mastered a card that slipped back to Struggling three separate times.',
    category: 'resilience',
    hidden: false,
    icon: '🌊',
  },
  // Motivating
  {
    id: 'lighthouse-keeper-bronze',
    name: 'Lighthouse Keeper',
    description: 'Keep the light burning for 7 days in a row.',
    category: 'motivating',
    hidden: false,
    icon: '🥉',
  },
  {
    id: 'lighthouse-keeper-silver',
    name: 'Lighthouse Keeper II',
    description: 'An unbroken streak of 30 days. The light never dims.',
    category: 'motivating',
    hidden: false,
    icon: '🥈',
  },
  {
    id: 'lighthouse-keeper-gold',
    name: 'Lighthouse Keeper III',
    description: '100 consecutive days. You are the keeper of the light.',
    category: 'motivating',
    hidden: false,
    icon: '🥇',
  },
  {
    id: 'master-cartographer-creation',
    name: 'Master Cartographer',
    description: 'You have charted over 500 cards. The map grows vast.',
    category: 'motivating',
    hidden: false,
    icon: '🗺️',
  },
  {
    id: 'master-cartographer-share',
    name: 'Open Waters',
    description: 'You shared an island with the community. Fair winds and following seas.',
    category: 'motivating',
    hidden: false,
    icon: '⚓',
  },
  {
    id: 'perfect-voyage',
    name: 'The Perfect Voyage',
    description: 'Completed a session of 20+ cards without a single mistake.',
    category: 'motivating',
    hidden: false,
    icon: '🌟',
  },
  {
    id: 'archipelago-sovereign',
    name: 'Archipelago Sovereign',
    description: 'You mastered every single card in an island with 50 or more cards.',
    category: 'motivating',
    hidden: false,
    icon: '👑',
  },
  {
    id: 'horizon-chaser',
    name: 'The Horizon Chaser',
    description: 'Completed a study session lasting longer than 45 minutes.',
    category: 'motivating',
    hidden: false,
    icon: '🌅',
  },
  {
    id: 'trade-winds',
    name: 'Trade Winds',
    description: 'One of your public islands has been imported by 10 different explorers.',
    category: 'motivating',
    hidden: false,
    icon: '💨',
  },
  {
    id: 'high-tide',
    name: 'High Tide',
    description: 'You broke your personal record for cards reviewed in a single day.',
    category: 'motivating',
    hidden: false,
    icon: '🏄',
  },
  // Quirky (hidden)
  {
    id: 'night-watch',
    name: 'The Night Watch',
    description: 'Completed a study session between 2 AM and 4 AM. Dedicated.',
    category: 'quirky',
    hidden: true,
    icon: '🌙',
  },
  {
    id: 'the-hoarder',
    name: 'The Hoarder',
    description: 'You have 50+ cards that have never been studied. Time to set sail?',
    category: 'quirky',
    hidden: true,
    icon: '📦',
  },
  {
    id: 'stowaway',
    name: 'Stowaway',
    description: 'Created a card with just one word on the front and one word on the back.',
    category: 'quirky',
    hidden: true,
    icon: '🐀',
  },
  {
    id: 'shipwrecked',
    name: 'Shipwrecked',
    description: 'Started a voyage but abandoned ship before reviewing even 5 cards.',
    category: 'quirky',
    hidden: true,
    icon: '🪵',
  },
  // SOS Flare — peer rescue rewards
  {
    id: 'life-saver',
    name: 'Life Saver',
    description: 'Your memory trick helped a fellow explorer escape the Struggling zone.',
    category: 'motivating',
    hidden: false,
    icon: '🛟',
  },
  {
    id: 'coast-guard',
    name: 'Coast Guard',
    description: '10 of your hints have been marked helpful by other explorers.',
    category: 'motivating',
    hidden: false,
    icon: '⛵',
  },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
