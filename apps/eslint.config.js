// Same rules as the packages; the apps name the Tala package by its alias (metro.config.js), which lint cannot see.
module.exports = [
  ...require('../packages/eslint.config.js'),
  { rules: { 'import/no-unresolved': ['error', { ignore: ['^@sailix/tala$'] }] } },
];
