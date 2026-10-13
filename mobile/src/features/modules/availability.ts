/**
 * Whether a module's CONTENT screens are reachable in this build. Tala content and account linking go through the
 * Sailix gateway (milestone M3), which does not exist yet and may not be called until the Tala environment is
 * approved (D-T1). Flip a flag only together with the real, tested gateway-backed screens: no screen may pretend.
 */
export const MODULE_CONTENT_AVAILABLE: Readonly<Record<string, boolean>> = { tala: false };

export const isModuleContentAvailable = (code: string): boolean =>
  MODULE_CONTENT_AVAILABLE[code] === true;

export const STATUS_LABEL: Readonly<Record<string, string>> = {
  disabled: 'Turned off',
  not_linked: 'Not linked',
  linked: 'Linked',
  needs_relink: 'Needs re-link',
  revoked: 'Access revoked',
};

export const STATUS_DESCRIPTION: Readonly<Record<string, string>> = {
  disabled: 'Your organization has turned this service off. Contact your administrator.',
  not_linked: 'Link your existing account to use this service.',
  linked: 'Your account is linked.',
  needs_relink: 'Your link expired. Sign in to the service again to re-link it.',
  revoked: 'Your access to this service was revoked. Contact your administrator.',
};
