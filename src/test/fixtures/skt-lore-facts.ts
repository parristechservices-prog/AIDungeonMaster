// Concise, structured Storm King's Thunder canon facts used ONLY for QA/test
// validation. No copyrighted prose — just names, identities, relationships, and
// flow facts needed to assert the app never contradicts canon.
//
// Source: Storm King's Thunder reference — Introduction ("The Ordning",
// "King Hekaton and His Daughters", "The Kraken Society") and Chapter 1
// ("Nightstone"). Facts only; see the published adventure for full text.

export type LoreFact = {
  id: string;
  /** Plain-English canonical assertion. */
  truth: string;
  /** Common WRONG statements the app must never present as true. */
  contradictions: string[];
  /** True when this is a late-campaign secret a starting PC should not "just know". */
  spoiler: boolean;
};

export const SKT_LORE_FACTS: LoreFact[] = [
  {
    id: 'ordning-shattered',
    truth: 'Annam the All-Father shattered the ordning (the giants\' social hierarchy); the campaign premise is that giant society is in upheaval, not unified or stable.',
    contradictions: ['the giants are unified under a stable ordning', 'giant society is at peace under one king'],
    spoiler: false,
  },
  {
    id: 'hekaton-abducted',
    truth: 'King Hekaton is the storm giant king, abducted by the Kraken Society; he is not present or available in Nightstone Chapter 1.',
    contradictions: ['Hekaton is in Nightstone', 'Hekaton rules peacefully at the start', 'King Hekaton greets the party in Nightstone'],
    spoiler: true,
  },
  {
    id: 'iymrith-villain',
    truth: 'Iymrith is an ancient blue dragon and a hidden antagonist manipulating events; she is disguised, not openly known to starting characters.',
    contradictions: ['Iymrith is a friendly silver dragon', 'Iymrith is a helpful ally', 'Iymrith is a silver dragon'],
    spoiler: true,
  },
  {
    id: 'serissa-daughter',
    truth: 'Serissa is the youngest daughter of King Hekaton, broadly an ally of order, not his enemy.',
    contradictions: ['Serissa is Hekaton\'s enemy', 'Serissa abducted Hekaton'],
    spoiler: true,
  },
  {
    id: 'neri-deceased',
    truth: 'Queen Neri, Hekaton\'s wife, was killed by small folk before the adventure; her death helped set events in motion.',
    contradictions: ['Queen Neri rules alongside Hekaton', 'Neri is alive and well in Nightstone'],
    spoiler: true,
  },
  {
    id: 'kraken-society',
    truth: 'The Kraken Society is a sinister faction behind Hekaton\'s abduction.',
    contradictions: ['the Kraken Society is a fishing guild', 'there is no Kraken Society'],
    spoiler: true,
  },
  {
    id: 'nightstone-attacked',
    truth: 'When the party arrives, Nightstone has just been attacked (cloud giant rocks and goblin raiders); it is damaged and largely abandoned, not a bustling normal village.',
    contradictions: ['Nightstone is a bustling peaceful village', 'Nightstone is untouched and lively'],
    spoiler: false,
  },
];

/** Canonical Nightstone map areas (Chapter 1, Map 1.1), by name. */
export const NIGHTSTONE_AREAS = [
  'drawbridge',
  'watchtowers',
  'square',
  'residences',
  'temple',
  'graveyards',
  'stable',
  'inn',
  'trading post',
  'windmill',
  'bridge',
  'gate to the keep',
  'inner bailey',
  'nandar keep',
] as const;

/** Proper nouns that name late-campaign secrets — used to test spoiler gating. */
export const SKT_SPOILER_TERMS = [
  'iymrith',
  'hekaton',
  'serissa',
  'mirran',
  'nym',
  'neri',
  'kraken society',
] as const;
