import nestjs from "@expense-saas/eslint-config/nestjs";

export default [
  ...nestjs,
  {
    ignores: ["dist/**", "jest.config.cjs"],
  },
];
