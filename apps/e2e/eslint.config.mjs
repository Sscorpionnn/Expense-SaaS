import base from "@expense-saas/eslint-config/base";

export default [
  ...base,
  {
    ignores: ["playwright-report/**", "test-results/**"],
  },
];
