/** The Tala address and switches this build was made with (app.config.ts puts them in `extra`). */
export function readTalaConfig(extra: Record<string, unknown> | undefined) {
  return {
    talaBaseUrl: String(extra?.talaBaseUrl ?? ''),
    // quizzes, flashcards and joining a course write to Tala: off unless the build turns them on
    progressWrites: Boolean(extra?.talaProgressWrites),
  };
}
