module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage-e2e',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
  globalSetup: '<rootDir>/test/setup.ts',
  globalTeardown: '<rootDir>/test/teardown.ts',
};
