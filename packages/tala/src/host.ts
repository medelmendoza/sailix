export interface TalaTheme {
  background: string;
  text: string;
  primary: string;
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
    teamId?: number;
  };
  /** Return to the host (Sailix: back to Services). */
  onExit: () => void;
}
