import { createContext, useContext } from 'react';

export interface TalaTheme {
  background: string;
  text: string;
  primary: string;
  secondary?: string;
  accent?: string;
  /** The font style an organization chose (`rounded`, `serif`, `system`...), as Sailix names them. */
  fontPreset?: string;
}

/** What the app that mounts Tala passes in. The package imports nothing from that app. */
export interface TalaHost {
  /** Namespaces the package's caches and offline files (Sailix: organization + member; standalone: empty). */
  scope: string;
  theme: TalaTheme;
  config: {
    /** The Tala server; HTTPS only. */
    talaBaseUrl: string;
    progressWrites: boolean;
    /** The organization's Tala team, when the host has one. */
    teamId?: string;
  };
  /** Return to the host (Sailix: back to Services). Absent in the standalone app: there is nothing to return to. */
  onExit?: () => void;
}

export const HostContext = createContext<TalaHost | null>(null);

export function useHost(): TalaHost {
  const host = useContext(HostContext);
  if (!host) throw new Error('Tala screens must be rendered inside <TalaRoot>.');
  return host;
}
