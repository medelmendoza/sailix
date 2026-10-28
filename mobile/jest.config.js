module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>', '<rootDir>/../packages', '<rootDir>/../apps'],
  // packages/ and apps/ sit outside this folder: resolve their imports (react-native, ...) from here, and @sailix/tala to its source
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sailix/tala$': '<rootDir>/../packages/tala/src/index.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
};
