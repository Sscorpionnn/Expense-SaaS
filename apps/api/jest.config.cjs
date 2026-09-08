/** @type {import('jest').Config} */
const base = {
  rootDir: ".",
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
};

module.exports = {
  projects: [
    {
      ...base,
      displayName: "unit",
      testMatch: ["<rootDir>/src/**/*.spec.ts"],
    },
    {
      ...base,
      displayName: "integration",
      testMatch: ["<rootDir>/test/**/*.e2e-spec.ts"],
      // Integration tests need Postgres + Redis (docker compose up) and
      // DATABASE_URL/REDIS_URL pointed at them — see docs/testing.md.
    },
  ],
};
