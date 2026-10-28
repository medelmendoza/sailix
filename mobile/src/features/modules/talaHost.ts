import type { TalaHost } from '@sailix/tala';
import Constants from 'expo-constants';
import { useMemo } from 'react';
import type { Credential } from '@/models/session';
import { useSessionStore } from '@/store/sessionStore';
import { useBrand, useBrandStore, type Brand } from '@/theme/brand';

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
    scope: `org:${credential.tenantId}:member:${credential.membershipId}`,
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

/** A stable host for the signed-in member (the package restarts when its host changes). Null when nobody is signed in. */
export function useTalaHost(onExit: () => void): TalaHost | null {
  const credential = useSessionStore((s) => s.credential);
  const brand = useBrand();
  const fontPreset = useBrandStore((s) => s.look?.font_preset);
  return useMemo(
    () =>
      credential
        ? buildTalaHost({
            credential,
            brand,
            fontPreset,
            extra: Constants.expoConfig?.extra,
            onExit,
          })
        : null,
    [credential, brand, fontPreset, onExit],
  );
}
