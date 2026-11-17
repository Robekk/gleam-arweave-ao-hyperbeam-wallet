import { describe, expect, it } from "vitest";
import { base64ToBytes, base64UrlToBytes, bytesToBase64, bytesToBase64Url } from "./base64";

describe("vault/base64", () => {
  it("round-trips bytes through base64 and base64url", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it("accepts unpadded base64url, as Arweave encodes keys and signatures", () => {
    expect(base64UrlToBytes("AQID")).toEqual(new Uint8Array([1, 2, 3]));
    expect(base64UrlToBytes("AQI")).toEqual(new Uint8Array([1, 2]));
    expect(base64UrlToBytes("AQ")).toEqual(new Uint8Array([1]));
  });

  it("throws on characters outside the base64 alphabet instead of skipping them", () => {
    // envelope.ts relies on this throw to tell a corrupted envelope from a
    // wrong password; a lenient decoder would blur the two.
    expect(() => base64ToBytes("AQ!D")).toThrow();
    expect(() => base64UrlToBytes("AQ!D")).toThrow();
  });

  it("encodes base64url without padding or standard-alphabet characters", () => {
    const encoded = bytesToBase64Url(new Uint8Array([251, 255, 190]));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlToBytes(encoded)).toEqual(new Uint8Array([251, 255, 190]));
  });
});
