/**
 * Where unexpected errors go. The app has NO third-party crash service wired in: choosing one sends customer-device
 * data to another company, which is a decision for the product owner (docs/15). Until then errors are only logged in
 * development builds. A reporter is attached once, at startup, with `setCrashReporter`.
 *
 * Never put tokens, passwords, answers or personal data in `context`: it is the one place that could leave the device.
 */
export type CrashContext = { source: 'render' | 'global' | 'promise'; fatal?: boolean };
export type CrashReporter = (error: Error, context: CrashContext) => void;

let reporter: CrashReporter = (error, context) => {
  if (__DEV__) console.warn(`[crash:${context.source}]`, error.message);
};

export function setCrashReporter(next: CrashReporter): void {
  reporter = next;
}

/** Reporting must never throw or block: a broken reporter cannot be allowed to cause the next crash. */
export function reportCrash(error: unknown, context: CrashContext): void {
  try {
    reporter(error instanceof Error ? error : new Error(String(error)), context);
  } catch {
    // swallow
  }
}

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
};

/** Reports uncaught JS errors, then lets the platform's own handling run as before. Safe to call once. */
export function installGlobalCrashHandler(
  utils: ErrorUtilsLike | undefined = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils,
): void {
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    reportCrash(error, { source: 'global', fatal: isFatal });
    previous(error, isFatal);
  });
}
