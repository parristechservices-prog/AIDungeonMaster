/** One retrievable passage from an owned source book. */
export type SourceChunk = {
  id: string;
  /** Nearest section/area heading, for context and citation. */
  heading: string;
  /** Cleaned passage text (de-hyphenated, whitespace-collapsed). */
  text: string;
};

/** A canonical named entity (NPC, monster, place) extracted from the source. */
export type GazetteerEntry = {
  /** Canonical name, e.g. "Xolkin Alassandar". */
  name: string;
  /** One-line fact, e.g. "LE half-elf bandit captain who leads the Seven Snakes". */
  note: string;
  /** Section heading the entity was found under, for context. */
  heading: string;
};

/** A searchable index built from an owned source document. */
export type SourceIndex = {
  /** Which adventure family this grounds, e.g. "skt". */
  key: string;
  /** Human label, e.g. "Storm King's Thunder". */
  title: string;
  /** Prompt-version-like stamp so we can detect stale indexes. */
  builtFormat: number;
  chunks: SourceChunk[];
  /** Canonical named entities (names + one-line facts) for anti-hallucination. */
  gazetteer?: GazetteerEntry[];
};

export const SOURCE_INDEX_FORMAT = 2;
