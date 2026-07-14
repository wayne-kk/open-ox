import { describe, expect, it } from "vitest";
import { WELCOME_CREDITS } from "./credits";
import { welcomeTopUpAmount } from "./account";

describe("welcomeTopUpAmount", () => {
  it("gives full welcome pack for empty unpaid Free", () => {
    expect(
      welcomeTopUpAmount({
        balance: 0,
        plan: "free",
        hasPaidGrants: false,
        welcomeAlreadyApplied: false,
      })
    ).toBe(WELCOME_CREDITS);
  });

  it("tops unpaid Free up to 12 when balance is below floor", () => {
    expect(
      welcomeTopUpAmount({
        balance: 3,
        plan: "free",
        hasPaidGrants: false,
        welcomeAlreadyApplied: false,
      })
    ).toBe(9);
  });

  it("does nothing when balance is already at or above 12", () => {
    expect(
      welcomeTopUpAmount({
        balance: 12,
        plan: "free",
        hasPaidGrants: false,
        welcomeAlreadyApplied: false,
      })
    ).toBe(0);
    expect(
      welcomeTopUpAmount({
        balance: 15,
        plan: "free",
        hasPaidGrants: false,
        welcomeAlreadyApplied: false,
      })
    ).toBe(0);
  });

  it("does nothing when welcome/migrate already applied", () => {
    expect(
      welcomeTopUpAmount({
        balance: 3,
        plan: "free",
        hasPaidGrants: false,
        welcomeAlreadyApplied: true,
      })
    ).toBe(0);
  });

  it("excludes Pro and users with paid grants", () => {
    expect(
      welcomeTopUpAmount({
        balance: 3,
        plan: "pro",
        hasPaidGrants: false,
        welcomeAlreadyApplied: false,
      })
    ).toBe(0);
    expect(
      welcomeTopUpAmount({
        balance: 3,
        plan: "free",
        hasPaidGrants: true,
        welcomeAlreadyApplied: false,
      })
    ).toBe(0);
  });
});
