import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetModifyInFlightForTests,
  isModifyInFlight,
  releaseModifyInFlight,
  tryAcquireModifyInFlight,
} from "./modifyInFlight";

describe("modifyInFlight", () => {
  beforeEach(() => {
    __resetModifyInFlightForTests();
  });

  it("acquires a free project lock", () => {
    expect(tryAcquireModifyInFlight("p1")).toBe(true);
    expect(isModifyInFlight("p1")).toBe(true);
  });

  it("rejects a second acquire while in flight", () => {
    expect(tryAcquireModifyInFlight("p1")).toBe(true);
    expect(tryAcquireModifyInFlight("p1")).toBe(false);
    expect(isModifyInFlight("p1")).toBe(true);
  });

  it("allows acquire again after release", () => {
    expect(tryAcquireModifyInFlight("p1")).toBe(true);
    releaseModifyInFlight("p1");
    expect(isModifyInFlight("p1")).toBe(false);
    expect(tryAcquireModifyInFlight("p1")).toBe(true);
  });

  it("isolates locks per project", () => {
    expect(tryAcquireModifyInFlight("p1")).toBe(true);
    expect(tryAcquireModifyInFlight("p2")).toBe(true);
    expect(tryAcquireModifyInFlight("p1")).toBe(false);
  });
});
