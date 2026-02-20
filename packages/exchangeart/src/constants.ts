import { PublicKey } from "@solana/web3.js";

export const PROGRAM_IDS = {
  codeCanvas: new PublicKey("CoCaSGpuNso2yQP3oqi1tXt82wBp3y78SJDwLCboc8WS"),
  buyNowEditions: new PublicKey("EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5"),
  offers: new PublicKey("exofLDXJoFji4Qyf9jSAH59J4pp82UT5pmGgR6iT24Z"),
  tokenMetadata: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
  tokenAuth: new PublicKey("auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg"),
} as const;

export const CODE_CANVAS_FEE_RECIPIENT = new PublicKey(
  "rFqFJ9g7TGBD8Ed7TPDnvGKZ5pWLPDyxLcvcH2eRCtt"
);

export const CODE_CANVAS_UPDATE_AUTH = new PublicKey(
  "CCadmjFiVNvMWBMxTLdEby34oLR7cEf2JnKJKTFbHGSK"
);
