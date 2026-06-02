export type Background = {
  id: string;
  label: string;
  description: string;
  /** Logged as a canon fact when the adventure begins */
  canonFact: string;
};

export const BACKGROUNDS: Background[] = [
  {
    id: 'soldier',
    label: 'Soldier',
    description: 'You marched for a lord who never learned your name. Discipline and grit still define you.',
    canonFact: 'The hero served as a soldier and values discipline and loyalty.',
  },
  {
    id: 'scholar',
    label: 'Scholar',
    description: 'Libraries and dusty tomes taught you that most monsters leave a paper trail.',
    canonFact: 'The hero is a scholar who trusts research and careful observation.',
  },
  {
    id: 'criminal',
    label: 'Criminal',
    description: 'You know alleys, codes, and when to disappear. Trust is earned in coin.',
    canonFact: 'The hero has underworld contacts and reads danger in a room quickly.',
  },
  {
    id: 'acolyte',
    label: 'Acolyte',
    description: 'Faith guided you through famine and plague. Sacred symbols still steady your hand.',
    canonFact: 'The hero is an acolyte devoted to protecting the innocent from darkness.',
  },
];

export function getBackground(id: string): Background | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}
