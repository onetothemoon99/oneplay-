/* ---------------------------------------------------------
   ONEPLAY — game catalogue data
--------------------------------------------------------- */

export type TrophyTier = 'Bronze' | 'Silver' | 'Gold';

export interface Trophy {
  name: string;
  desc: string;
  tier: TrophyTier;
  target: number;
}

/** One row of the controls table: [key, what it does]. */
export type ControlRow = [key: string, action: string];

/** 'hub' = bundled canvas game, 'psx' = PlayStation title (disc supplied by the player). */
export type Platform = 'hub' | 'psx';

export interface Game {
  id: string;
  title: string;
  studio: string;
  glyph: string;
  genre: string;
  tags: string[];
  year: number;
  rating: number;
  players: string;
  size: string;
  difficulty: string;
  /** Exactly three colours: the cover gradient stops. */
  accent: string[];
  tagline: string;
  description: string;
  controls: ControlRow[];
  features: string[];
  trophies: Trophy[];
  /** Set by lib/gamesRepo; the bundled catalogue below is all 'hub'. */
  platform?: Platform;
  /** Overrides the default /game/{id} link — see lib/psxCatalogue. */
  href?: string;
  /** Whether the card can be played right now. */
  state?: 'ready' | 'needs-disc';
  /** Drawn over the cover for anything that is not ready to play. */
  badge?: string;
}

export const GAMES: Game[] = [
  {
    id: 'astro-drift',
    title: 'Astro Drift',
    studio: 'Nebula Forge',
    glyph: 'AD',
    genre: 'Arcade Shooter',
    tags: ['Arcade', 'Space', 'Single player'],
    year: 2025,
    rating: 4.8,
    players: '1 player',
    size: '184 KB',
    difficulty: 'Medium',
    accent: ['#7C3AED', '#DB2777', '#F59E0B'],
    tagline: 'Rotate, thrust, survive the belt.',
    description:
      'Zero-gravity dogfighting against a collapsing asteroid belt. Every rock you break splits into faster debris, so clearing a wave is always a trade between safety and score. Momentum never stops — learn to fly with the drift instead of against it.',
    controls: [
      ['← →', 'Rotate ship'],
      ['↑', 'Thrust'],
      ['Space', 'Fire']
    ],
    features: ['Endless waves', 'Score multiplier', 'Local leaderboard'],
    trophies: [
      { name: 'First Contact', desc: 'Destroy 10 asteroids', tier: 'Bronze', target: 500 },
      { name: 'Belt Runner', desc: 'Reach 3,000 points', tier: 'Silver', target: 3000 },
      { name: 'Void Ace', desc: 'Reach 8,000 points', tier: 'Gold', target: 8000 }
    ]
  },
  {
    id: 'neon-runner',
    title: 'Neon Runner',
    studio: 'Halcyon Bit',
    glyph: 'NR',
    genre: 'Endless Runner',
    tags: ['Runner', 'Reflex', 'Single player'],
    year: 2026,
    rating: 4.6,
    players: '1 player',
    size: '132 KB',
    difficulty: 'Easy',
    accent: ['#06B6D4', '#3B82F6', '#8B5CF6'],
    tagline: 'The city speeds up. You do not slow down.',
    description:
      'A one-track sprint through a skyline that keeps accelerating. Jump the barriers, slide under the beams, and read the road two obstacles ahead. Simple to start, brutal past the 60-second mark.',
    controls: [
      ['↑ / Space', 'Jump'],
      ['↓', 'Slide'],
      ['Hold ↑', 'Higher jump']
    ],
    features: ['Speed ramp', 'Distance scoring', 'One-button friendly'],
    trophies: [
      { name: 'Warm Up', desc: 'Run 500 metres', tier: 'Bronze', target: 500 },
      { name: 'City Blur', desc: 'Run 2,000 metres', tier: 'Silver', target: 2000 },
      { name: 'Light Speed', desc: 'Run 5,000 metres', tier: 'Gold', target: 5000 }
    ]
  },
  {
    id: 'block-fall',
    title: 'Block Fall',
    studio: 'Grid Theory',
    glyph: 'BF',
    genre: 'Puzzle',
    tags: ['Puzzle', 'Classic', 'Single player'],
    year: 2024,
    rating: 4.9,
    players: '1 player',
    size: '96 KB',
    difficulty: 'Medium',
    accent: ['#10B981', '#84CC16', '#EAB308'],
    tagline: 'Stack it clean or drown in your own mistakes.',
    description:
      'The falling-block puzzle in its purest form: seven pieces, ten levels of gravity, and one well that punishes hesitation. Clear four rows at once for the big payout, or play it safe and keep the stack flat.',
    controls: [
      ['← →', 'Move piece'],
      ['↑', 'Rotate'],
      ['↓', 'Soft drop'],
      ['Space', 'Hard drop']
    ],
    features: ['10 gravity levels', 'Next-piece preview', 'Quad-clear bonus'],
    trophies: [
      { name: 'Clean Line', desc: 'Score 1,000 points', tier: 'Bronze', target: 1000 },
      { name: 'Stack Master', desc: 'Score 6,000 points', tier: 'Silver', target: 6000 },
      { name: 'Perfect Well', desc: 'Score 15,000 points', tier: 'Gold', target: 15000 }
    ]
  },
  {
    id: 'sky-breaker',
    title: 'Sky Breaker',
    studio: 'Orbital Nine',
    glyph: 'SB',
    genre: 'Arcade',
    tags: ['Arcade', 'Classic', 'Single player'],
    year: 2025,
    rating: 4.4,
    players: '1 player',
    size: '88 KB',
    difficulty: 'Easy',
    accent: ['#F43F5E', '#F97316', '#FACC15'],
    tagline: 'Six rows between you and the next level.',
    description:
      'Angle the paddle, bend the ball, bring the wall down. Hitting the edge of the paddle throws sharper angles — the fastest clears come from players who stop centring every bounce.',
    controls: [
      ['← →', 'Move paddle'],
      ['Mouse', 'Move paddle'],
      ['Space', 'Launch ball']
    ],
    features: ['Angle physics', 'Level progression', '3 lives'],
    trophies: [
      { name: 'Cracked It', desc: 'Score 500 points', tier: 'Bronze', target: 500 },
      { name: 'Wall Down', desc: 'Score 2,500 points', tier: 'Silver', target: 2500 },
      { name: 'Sky Clear', desc: 'Score 6,000 points', tier: 'Gold', target: 6000 }
    ]
  },
  {
    id: 'snake-protocol',
    title: 'Snake Protocol',
    studio: 'Grid Theory',
    glyph: 'SP',
    genre: 'Arcade',
    tags: ['Arcade', 'Classic', 'Single player'],
    year: 2024,
    rating: 4.3,
    players: '1 player',
    size: '64 KB',
    difficulty: 'Easy',
    accent: ['#22C55E', '#14B8A6', '#0EA5E9'],
    tagline: 'Grow long. Stay alive. Same as always.',
    description:
      'A data-worm loose in a 30×20 grid. Each packet you collect makes you longer and slightly faster, and the walls are not decorative. The only real enemy is the tail you built yourself.',
    controls: [
      ['Arrows', 'Turn'],
      ['P', 'Pause']
    ],
    features: ['Speed scaling', 'Wall collision', 'Compact grid'],
    trophies: [
      { name: 'First Packet', desc: 'Score 50 points', tier: 'Bronze', target: 50 },
      { name: 'Long Protocol', desc: 'Score 300 points', tier: 'Silver', target: 300 },
      { name: 'Full Loop', desc: 'Score 800 points', tier: 'Gold', target: 800 }
    ]
  },
  {
    id: 'paddle-arena',
    title: 'Paddle Arena',
    studio: 'Halcyon Bit',
    glyph: 'PA',
    genre: 'Sports',
    tags: ['Sports', 'Versus', 'Classic'],
    year: 2023,
    rating: 4.1,
    players: '1 player vs CPU',
    size: '58 KB',
    difficulty: 'Medium',
    accent: ['#0EA5E9', '#6366F1', '#A855F7'],
    tagline: 'First to seven takes the arena.',
    description:
      'The original versus match, rebuilt with a CPU that actually reads the ball. Rally length feeds the ball speed, so long points get dangerous fast. Best of seven, no mercy rule.',
    controls: [
      ['↑ ↓', 'Move paddle'],
      ['Mouse', 'Move paddle']
    ],
    features: ['Adaptive CPU', 'Rally acceleration', 'First to 7'],
    trophies: [
      { name: 'On the Board', desc: 'Win 1 point', tier: 'Bronze', target: 1 },
      { name: 'Match Point', desc: 'Reach 5 points', tier: 'Silver', target: 5 },
      { name: 'Arena Champion', desc: 'Win the match', tier: 'Gold', target: 7 }
    ]
  },
  {
    id: 'memory-grid',
    title: 'Memory Grid',
    studio: 'Nebula Forge',
    glyph: 'MG',
    genre: 'Casual',
    tags: ['Casual', 'Puzzle', 'Family'],
    year: 2026,
    rating: 4.5,
    players: '1 player',
    size: '72 KB',
    difficulty: 'Relaxed',
    accent: ['#EC4899', '#8B5CF6', '#38BDF8'],
    tagline: 'Sixteen tiles. Eight pairs. One memory.',
    description:
      'A calm pattern-matching board with a running clock. Fewer moves and faster clears push your score higher, so the perfect run is a memory exercise, not a clicking race.',
    controls: [
      ['Click / Tap', 'Flip tile'],
      ['Arrows + Enter', 'Keyboard play']
    ],
    features: ['Move counter', 'Time bonus', 'Mouse or keyboard'],
    trophies: [
      { name: 'Pair Up', desc: 'Score 200 points', tier: 'Bronze', target: 200 },
      { name: 'Sharp Recall', desc: 'Score 700 points', tier: 'Silver', target: 700 },
      { name: 'Total Recall', desc: 'Score 1,200 points', tier: 'Gold', target: 1200 }
    ]
  },
  {
    id: 'reflex-ring',
    title: 'Reflex Ring',
    studio: 'Orbital Nine',
    glyph: 'RR',
    genre: 'Casual',
    tags: ['Casual', 'Reflex', 'Party'],
    year: 2026,
    rating: 4.2,
    players: '1 player',
    size: '54 KB',
    difficulty: 'Hard',
    accent: ['#FACC15', '#F97316', '#EF4444'],
    tagline: 'Thirty seconds. Hit every ring.',
    description:
      'Targets bloom and shrink across the arena on a thirty-second clock. Hitting a ring dead centre pays triple, a miss breaks your streak, and the rings get smaller the better you do.',
    controls: [
      ['Click / Tap', 'Hit ring'],
      ['—', '30 second round']
    ],
    features: ['Streak multiplier', 'Centre-hit bonus', '30s rounds'],
    trophies: [
      { name: 'Quick Hand', desc: 'Score 400 points', tier: 'Bronze', target: 400 },
      { name: 'Locked In', desc: 'Score 1,500 points', tier: 'Silver', target: 1500 },
      { name: 'Untouchable', desc: 'Score 3,000 points', tier: 'Gold', target: 3000 }
    ]
  }
];

export const getGame = (id: string): Game | null => GAMES.find((g) => g.id === id) || null;
