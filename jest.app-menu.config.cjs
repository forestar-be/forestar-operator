// `@forestar-be/core` est publié en ESM seul : ts-jest le transpile pour jest.
module.exports = {
  clearMocks: true,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/AppMenu.test.tsx', '**/printTickets.test.ts'],
  transform: {
    '^.+\\.(ts|tsx|js)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm/)?@forestar-be)'],
};
