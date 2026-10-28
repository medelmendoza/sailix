import { TalaRoot, type ExtraTab } from './TalaRoot';

export type { TalaHost, TalaTheme } from './host';
export type { ExtraTab };
export { forgetTalaSession } from './direct/auth';

/** The standard shape of a service package: a descriptor and one root component. */
export const talaModule = {
  code: 'tala' as const,
  title: 'Tala',
  Root: TalaRoot,
};
