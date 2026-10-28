import type { TalaHost } from '@sailix/tala';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import type { Credential } from '@/models/session';
import { useSessionStore } from '@/store/sessionStore';
import { useBrand, useBrandStore, type Brand } from '@/theme/brand';
import { talaScopeOf } from './talaTokens';

/** True while the Tala package (packages/tala) replaces Sailix's own Tala screens: build flag `TALA_PACKAGE=1`. */
export const talaPackageEnabled = (): boolean => Boolean(Constants.expoConfig?.extra?.talaPackage);

/** What Sailix tells the Tala package: where to keep its data, how to look, how it is built, and how to leave. */
export function buildTalaHost(input: {
  credential: Pick<Credential, 'tenantId' | 'membershipId'>;
  brand: Brand;
  fontPreset: string | null | undefined;
  extra: Record<string, unknown> | undefined;
  onExit: () => void;
}): TalaHost {
  const { credential, brand, fontPreset, extra, onExit } = input;
  return {
    scope: talaScopeOf(credential),
    theme: {
      background: brand.background,
      text: brand.text,
      primary: brand.primary,
      accent: brand.accent,
      ...(fontPreset ? { fontPreset } : {}),
    },
    config: {
      talaBaseUrl: String(extra?.talaBaseUrl ?? ''),
      progressWrites: Boolean(extra?.talaProgressWrites),
    },
    onExit,
  };
}

/**
 * A stable host for the signed-in member: the package restarts when its host changes, and the session token and `me` are
 * renewed every time the app returns to the foreground, so the host is rebuilt only when what it carries changes.
 * Null when nobody is signed in.
 */
export function useTalaHost(onExit: () => void): TalaHost | null {
  const tenantId = useSessionStore((s) => s.credential?.tenantId);
  const membershipId = useSessionStore((s) => s.credential?.membershipId);
  const brand = useBrand();
  const fontPreset = useBrandStore((s) => s.look?.font_preset);
  const { background, text, primary, accent } = brand;
  return useMemo(
    () =>
      tenantId === undefined || membershipId === undefined
        ? null
        : buildTalaHost({
            credential: { tenantId, membershipId },
            brand: { background, text, primary, accent } as Brand,
            fontPreset,
            extra: Constants.expoConfig?.extra,
            onExit,
          }),
    [tenantId, membershipId, background, text, primary, accent, fontPreset, onExit],
  );
}

/** True when Services opens the Tala package for this module (flag on and the organization has it on). */
export const usesTalaPackage = (module: { code: string; enabled: boolean } | undefined): boolean =>
  module?.code === 'tala' && module.enabled && talaPackageEnabled();
