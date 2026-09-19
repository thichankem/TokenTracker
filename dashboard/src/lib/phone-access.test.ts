import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_PHONE_URL,
  getPhoneAccessDomain,
  getPhoneAccessUrl,
  normalizePhoneAccessDomain,
  setPhoneAccessDomain,
} from "./phone-access";

describe("normalizePhoneAccessDomain", () => {
  it("returns '' for empty input", () => {
    expect(normalizePhoneAccessDomain("")).toBe("");
    expect(normalizePhoneAccessDomain("   ")).toBe("");
  });

  it("normalizes a bare host to the dashboard route", () => {
    expect(normalizePhoneAccessDomain("token.example.com")).toBe("https://token.example.com/dashboard");
  });

  it("strips protocol, path, query and fragment, then appends /dashboard", () => {
    expect(normalizePhoneAccessDomain("https://token.example.com/dashboard?x=1#top")).toBe(
      "https://token.example.com/dashboard",
    );
    expect(normalizePhoneAccessDomain("http://TOKEN.example.com/")).toBe(
      "https://token.example.com/dashboard",
    );
  });

  it("rejects inputs that are not plausible hostnames", () => {
    expect(normalizePhoneAccessDomain("localhost")).toBe("");
    expect(normalizePhoneAccessDomain("not a domain")).toBe("");
    expect(normalizePhoneAccessDomain("foo")).toBe("");
    expect(normalizePhoneAccessDomain("https://")).toBe("");
  });
});

describe("phone-access domain preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the public dashboard URL when no domain is set", () => {
    expect(getPhoneAccessDomain()).toBe("");
    expect(getPhoneAccessUrl()).toBe(DEFAULT_PHONE_URL);
  });

  it("persists a normalized custom domain", () => {
    const stored = setPhoneAccessDomain("token.example.com");
    expect(stored).toBe("https://token.example.com/dashboard");
    expect(getPhoneAccessDomain()).toBe("https://token.example.com/dashboard");
    expect(getPhoneAccessUrl()).toBe("https://token.example.com/dashboard");
  });

  it("clears the preference when given an invalid value", () => {
    setPhoneAccessDomain("token.example.com");
    setPhoneAccessDomain("not a domain");
    expect(getPhoneAccessDomain()).toBe("");
    expect(getPhoneAccessUrl()).toBe(DEFAULT_PHONE_URL);
  });
});