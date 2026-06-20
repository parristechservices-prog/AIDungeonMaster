/** One retrievable passage from an owned source book. */
export type SourceChunk = {
  id: string;
  /** Nearest section/area heading, for context and citation. */
  heading: string;
  /** Cleaned passage text (de-hyphenated, whitespace-collapsed). */
  text: string;
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
};

export const SOURCE_INDEX_FORMAT = 1;
