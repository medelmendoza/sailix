import type { TalaHost } from './host';
import { TalaRoot } from './TalaRoot';

export type { TalaHost, TalaTheme } from './host';

/** The standard shape of a service package: a descriptor and one root component. */
export const talaModule = {
  code: 'tala' as const,
  title: 'Tala',
  Root: TalaRoot as (p: { host: TalaHost }) => React.JSX.Element,
};
