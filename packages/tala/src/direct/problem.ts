/** A request the package refuses, with a stable `code` the screens can act on (the gateway's ApiProblem). */
export class TalaProblem extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 422,
  ) {
    super(message);
  }
}

export const invalid = (code: string, message: string) => new TalaProblem(code, message, 422);
export const notFound = (message: string) => new TalaProblem('not_found', message, 404);
