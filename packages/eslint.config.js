const path = require('path');
const { createRequire } = require('module');

// The packages have no node_modules of their own: use the mobile app's lint setup and plugins.
const fromMobile = createRequire(path.resolve(__dirname, '../mobile/package.json'));
const expoConfig = fromMobile('eslint-config-expo/flat');
const tsPlugin = fromMobile('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  { ignores: ['**/node_modules/**', 'eslint.config.js', '**/eslint.config.js'] },
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // a package stands alone: nothing from the app that mounts it
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/*', '**/mobile/**', '**/apps/**'], message: 'A package imports nothing from an app.' },
          ],
        },
      ],
    },
  },
];
