const expoConfig = require('eslint-config-expo/flat');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  { ignores: ['dist/*', 'docs/*', 'coverage/*', 'ios/*', 'android/*', '.expo/*'] },
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
];
