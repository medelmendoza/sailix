import { installGlobalCrashHandler, reportCrash, setCrashReporter } from '../crashReporter';

afterEach(() => setCrashReporter(() => undefined));

describe('crash reporter', () => {
  it('hands the error and where it came from to the attached reporter', () => {
    const seen: unknown[] = [];
    setCrashReporter((e, c) => seen.push([e.message, c.source]));
    reportCrash(new Error('boom'), { source: 'render' });
    expect(seen).toEqual([['boom', 'render']]);
  });

  it('wraps a thrown non-error value', () => {
    const seen: string[] = [];
    setCrashReporter((e) => seen.push(e.message));
    reportCrash('plain text', { source: 'promise' });
    expect(seen).toEqual(['plain text']);
  });

  it('never throws, even when the reporter itself is broken', () => {
    setCrashReporter(() => {
      throw new Error('reporter down');
    });
    expect(() => reportCrash(new Error('x'), { source: 'global' })).not.toThrow();
  });

  it('reports uncaught errors and still runs the platform handler afterwards', () => {
    const order: string[] = [];
    setCrashReporter((e, c) => order.push(`report:${e.message}:${c.fatal}`));
    let handler: (e: unknown, f?: boolean) => void = () => undefined;
    installGlobalCrashHandler({
      getGlobalHandler: () => () => order.push('platform'),
      setGlobalHandler: (h) => (handler = h),
    });
    handler(new Error('uncaught'), true);
    expect(order).toEqual(['report:uncaught:true', 'platform']);
  });
});
