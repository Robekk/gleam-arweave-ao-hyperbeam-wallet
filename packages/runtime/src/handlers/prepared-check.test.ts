import { describe, expect, it } from "vitest";
import { bytesToBase64Url, type ArweaveTransactionJson, type Tag, type UnsignedPayload } from "@gleam/core";
import { l1TransferTags } from "@gleam/core/src/ao/l1-transfer.ts";
import { collectibleTransferTags } from "@gleam/core/src/ao/collectible-transfer.ts";
import { assertTransferMatches, type ApprovedTransfer } from "./prepared-check";

const PID = "EuEkh8ZYkoPKXimgjre7W268XXX_qRn5vofc66oRTOw";
const RECIPIENT = "rEcIpIeNt_AdDrEsS-0123456789abcdefghijklmno";

const encoder = new TextEncoder();

/** A prepared transaction payload, with its tags base64url-encoded as `buildUnsignedTransaction` leaves them. */
function payload(target: string, quantity: string, reward: string, plainTags: Tag[]): UnsignedPayload {
  const transaction: ArweaveTransactionJson = {
    format: 2,
    id: "",
    last_tx: "",
    owner: "",
    tags: plainTags.map((tag) => ({
      name: bytesToBase64Url(encoder.encode(tag.name)),
      value: bytesToBase64Url(encoder.encode(tag.value)),
    })),
    target,
    quantity,
    data: "",
    data_size: "0",
    data_root: "",
    reward,
    signature: "",
  };
  return { kind: "transaction", transaction };
}

describe("assertTransferMatches: an L1 token transfer pays exactly the approved fee", () => {
  const approved: ApprovedTransfer = { recipient: RECIPIENT, amount: "311", token: PID, fee: "1000" };
  const tags = l1TransferTags(RECIPIENT, "311");

  it("accepts a transfer that moves no AR and pays the whole fee as reward", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "0", "1000", tags))).not.toThrow();
  });

  it("accepts the activation winston taken out of the fee", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "1", "999", tags))).not.toThrow();
  });

  it("refuses a transfer that moves more AR than the activation winston", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "2", "998", tags))).toThrow(/prepared amount doesn't match/);
  });

  it("refuses a transfer whose reward plus value exceeds the approved fee", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "1", "1000", tags))).toThrow(/prepared fee doesn't match/);
  });

  it("refuses a transfer that pays less than the approved fee", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "0", "999", tags))).toThrow(/prepared fee doesn't match/);
  });

  it("refuses a transfer whose fee can't cover the activation winston", () => {
    const broke: ApprovedTransfer = { ...approved, fee: "0" };
    expect(() => assertTransferMatches(broke, payload(PID, "1", "0", tags))).toThrow(/prepared fee doesn't match/);
  });

  it("refuses a transfer to a different recipient", () => {
    const other = l1TransferTags(PID, "311");
    expect(() => assertTransferMatches(approved, payload(PID, "0", "1000", other))).toThrow(/prepared tags doesn't match/);
  });
});

describe("assertTransferMatches: a collectible send pays exactly the approved fee", () => {
  const approved: ApprovedTransfer = {
    recipient: RECIPIENT,
    amount: "0",
    token: null,
    fee: "1000",
    collectible: { id: PID },
  };
  const tags = collectibleTransferTags(RECIPIENT);

  it("accepts the activation winston taken out of the fee", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "1", "999", tags))).not.toThrow();
  });

  it("refuses a collectible send that moves extra AR to the asset", () => {
    expect(() => assertTransferMatches(approved, payload(PID, "5", "995", tags))).toThrow(/prepared amount doesn't match/);
  });
});

describe("assertTransferMatches: an AR send pays exactly the approved fee", () => {
  const approved: ApprovedTransfer = { recipient: RECIPIENT, amount: "500", token: null, fee: "42" };

  it("accepts the send the user approved", () => {
    expect(() => assertTransferMatches(approved, payload(RECIPIENT, "500", "42", []))).not.toThrow();
  });

  it("refuses a send whose reward differs from the approved fee", () => {
    expect(() => assertTransferMatches(approved, payload(RECIPIENT, "500", "41", []))).toThrow(/prepared fee doesn't match/);
  });
});
