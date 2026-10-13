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
  needs_relink: 'Your link expired. Link your account again to keep using this service.',
  revoked: 'Your access to this service was revoked. Contact your administrator.',
};
