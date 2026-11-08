import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totpCode, verifyTotp } from "@/lib/totp";

describe("TOTP", () => {
  it("odpovídá testovacím vektorům RFC 6238 (SHA1)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(secret, 2_000_000_000_000)).toBe("279037");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
  });
  it("ověří kód s tolerancí jednoho kroku", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const t = 1_111_111_109_000;
    expect(verifyTotp(secret, totpCode(secret, t - 30_000), t)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, t - 90_000), t)).toBe(false);
    expect(verifyTotp(secret, "abc", t)).toBe(false);
  });
});
