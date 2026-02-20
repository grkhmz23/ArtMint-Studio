import { describe, it, expect } from "vitest";
import { PROGRAM_IDS } from "../constants";

describe("Exchange Art program IDs", () => {
  it("has correct Code Canvas program ID", () => {
    expect(PROGRAM_IDS.codeCanvas.toBase58()).toBe(
      "CoCaSGpuNso2yQP3oqi1tXt82wBp3y78SJDwLCboc8WS"
    );
  });

  it("has correct Buy Now + Editions program ID", () => {
    expect(PROGRAM_IDS.buyNowEditions.toBase58()).toBe(
      "EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5"
    );
  });

  it("has correct Offers program ID", () => {
    expect(PROGRAM_IDS.offers.toBase58()).toBe(
      "exofLDXJoFji4Qyf9jSAH59J4pp82UT5pmGgR6iT24Z"
    );
  });
});
