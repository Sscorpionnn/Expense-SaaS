import { loginSchema, registerSchema, resetPasswordSchema } from "./auth";

describe("registerSchema", () => {
  const valid = { email: "User@Example.com", password: "correct-horse-battery", name: "Ada" };

  it("accepts a valid payload and lowercases the email", () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe("user@example.com");
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(() => registerSchema.parse({ ...valid, password: "short1" })).toThrow();
  });

  it("rejects a common password even if long enough", () => {
    expect(() => registerSchema.parse({ ...valid, password: "welcome123" })).toThrow();
  });

  it("rejects unexpected extra fields (mass-assignment protection)", () => {
    expect(() =>
      registerSchema.parse({ ...valid, isAdmin: true, id: "attacker-supplied" }),
    ).toThrow();
  });

  it("rejects an invalid email", () => {
    expect(() => registerSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });
});

describe("loginSchema", () => {
  it("does not enforce the password policy on login (only presence)", () => {
    const result = loginSchema.parse({ email: "a@b.com", password: "x" });
    expect(result.password).toBe("x");
  });
});

describe("resetPasswordSchema", () => {
  it("enforces the same password policy as registration", () => {
    expect(() => resetPasswordSchema.parse({ token: "abc", newPassword: "short" })).toThrow();
  });
});
