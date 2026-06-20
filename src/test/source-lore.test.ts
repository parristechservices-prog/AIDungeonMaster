import { describe, expect, it } from 'vitest';
import { buildIdf, retrieveRelevant, selectGazetteer, tokenize } from '@/lib/llm/source-lore/retrieve';
import { sourceKeyForAdventure } from '@/lib/llm/source-lore/store.server';
import { SOURCE_INDEX_FORMAT, type SourceIndex } from '@/lib/llm/source-lore/types';

const index: SourceIndex = {
  key: 'test',
  title: 'Test Book',
  builtFormat: SOURCE_INDEX_FORMAT,
  chunks: [
    { id: 't-1', heading: '11. BRIDGE', text: 'A sloped bridge connects the village bailey to the motte. A falling rock destroyed a fifteen foot section of it, cutting off the keep. A strong creature can leap across the broken gap with a Strength check.' },
    { id: 't-2', heading: '14. NANDAR KEEP', text: 'Nandar Keep was left in a sorry state. Lady Velrosa Nandar, the High Steward, was buried under rubble and died of her wounds before the guards could reach her.' },
    { id: 't-3', heading: 'TOWER OF ZEPHYROS', text: 'A massive tower glides over the hills like a slow storm cloud, home to the eccentric cloud giant wizard Zephyros.' },
    { id: 't-4', heading: 'CREDITS', text: 'Lead designer and editors and illustrators and cartographers worked on this book together.' },
  ],
  gazetteer: [
    { name: 'Xolkin Alassandar', note: 'LE half-elf bandit captain who leads the Seven Snakes', heading: 'SEVEN SNAKES' },
    { name: 'Gurrash', note: 'Ear Seekers orc war chief', heading: 'EAR SEEKERS' },
    { name: 'Lady Velrosa Nandar', note: 'High Steward of Nightstone, slain in the keep', heading: '14. NANDAR KEEP' },
  ],
};

describe('source-lore tokenize', () => {
  it('drops stopwords, short tokens, and punctuation', () => {
    expect(tokenize('The keep is on the motte!')).toEqual(['keep', 'motte']);
  });
});

describe('source-lore retrieval', () => {
  const idf = buildIdf(index);

  it('returns the bridge passage for a broken-bridge query', () => {
    const hits = retrieveRelevant(index, 'is the keep bridge broken can I cross the gap', idf, { topK: 2 });
    expect(hits[0].heading).toBe('11. BRIDGE');
  });

  it('returns the keep passage for a Lady Nandar query', () => {
    const hits = retrieveRelevant(index, 'who is Lady Velrosa Nandar', idf, { topK: 2 });
    expect(hits[0].heading).toBe('14. NANDAR KEEP');
  });

  it('returns the Zephyros passage for a tower query', () => {
    const hits = retrieveRelevant(index, 'tell me about the floating tower and its giant wizard', idf, { topK: 2 });
    expect(hits[0].heading).toBe('TOWER OF ZEPHYROS');
  });

  it('surfaces a section via its heading even when the term is absent from the body', () => {
    // A rare area name in the query should pull its own section even if the body
    // text never repeats the heading word.
    const idxWithHeadingOnly: SourceIndex = {
      ...index,
      chunks: [
        ...index.chunks,
        { id: 't-5', heading: '10. WINDMILL', text: 'Two goblins named Longo and Yek climb among the rafters near the roof, heckling intruders and shooting arrows with half cover.' },
      ],
    };
    const idf2 = buildIdf(idxWithHeadingOnly);
    const hits = retrieveRelevant(idxWithHeadingOnly, 'I enter the windmill, who is inside?', idf2, { topK: 1 });
    expect(hits[0].heading).toBe('10. WINDMILL');
  });

  it('returns nothing for a query with no overlapping content terms', () => {
    expect(retrieveRelevant(index, 'spaceship laser dinosaur', idf, { topK: 3 })).toEqual([]);
  });

  it('respects topK and the character budget', () => {
    const hits = retrieveRelevant(index, 'bridge keep tower Nandar Zephyros', idf, { topK: 2, charBudget: 10_000 });
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

describe('selectGazetteer', () => {
  it('includes entities named in the retrieved passages', () => {
    const hits = retrieveRelevant(index, 'Lady Nandar in the keep', buildIdf(index), { topK: 2 });
    const names = selectGazetteer(index, 'Lady Nandar in the keep', hits).map((e) => e.name);
    expect(names).toContain('Lady Velrosa Nandar');
  });

  it('surfaces a canonical name from a vague follow-up via conversation terms', () => {
    // Passage retrieval may miss, but "Seven Snakes" in the query still pulls Xolkin.
    const names = selectGazetteer(index, "what is the leader's name? the Seven Snakes rode in", []).map((e) => e.name);
    expect(names).toContain('Xolkin Alassandar');
  });

  it('returns nothing when no entity matches', () => {
    expect(selectGazetteer(index, 'a spaceship full of robots', [])).toEqual([]);
  });
});

describe('sourceKeyForAdventure', () => {
  it('maps skt-* adventures to the skt source', () => {
    expect(sourceKeyForAdventure('skt-nightstone-chapter1')).toBe('skt');
    expect(sourceKeyForAdventure('skt-nightstone-starter')).toBe('skt');
  });

  it('returns null for non-SKT adventures', () => {
    expect(sourceKeyForAdventure('brindlehook-inn')).toBeNull();
  });
});
