#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
let nacl;
let bs58;
let Connection;
let Keypair;
let Transaction;

const BASE_URL = process.env.MINT_SMOKE_BASE_URL || "http://localhost:3000";
const CLUSTER = (process.env.MINT_SMOKE_CLUSTER || "devnet").toLowerCase();
const RPC_URL =
  process.env.MINT_SMOKE_RPC_URL ||
  (CLUSTER === "mainnet-beta" || CLUSTER === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");
const REQUEST_TIMEOUT_MS = Number(process.env.MINT_SMOKE_TIMEOUT_MS || 120_000);
const FLOW_MODE = (process.env.MINT_SMOKE_FLOW || "standard").toLowerCase();
const UPLOAD_IMAGE_PATH = process.env.MINT_SMOKE_UPLOAD_IMAGE_PATH || "";
const UPLOAD_PYTHON = process.env.MINT_SMOKE_PYTHON || "python3";
const UPLOAD_HELPER_PATH = path.resolve(__dirname, "prepare-upload-assets.py");
const SEED = Number(
  process.env.MINT_SMOKE_SEED || Math.floor(Date.now() % 1_000_000_000)
);
const CUSTOM_SEED = Number(process.env.MINT_SMOKE_CUSTOM_SEED || ((SEED + 1) % 1_000_000_000));

const DEFAULT_FLOW_FIELDS_PARAMS = {
  density: 0.55,
  lineWidth: 4.25,
  curvature: 5,
  grain: 0.5,
  contrast: 1.1,
  fieldScale: 2.75,
  lineCount: 275,
  stepCount: 105,
  turbulence: 1,
};

function requireWorkspaceModule(moduleName) {
  try {
    return require(moduleName);
  } catch (rootErr) {
    const appNodeModules = path.resolve(__dirname, "..", "apps", "web", "node_modules");
    try {
      return require(require.resolve(moduleName, { paths: [appNodeModules] }));
    } catch {
      throw rootErr;
    }
  }
}

function loadRuntimeDeps() {
  if (nacl && bs58 && Connection && Keypair && Transaction) return;

  nacl = requireWorkspaceModule("tweetnacl");
  const bs58Module = requireWorkspaceModule("bs58");
  bs58 = bs58Module.default ?? bs58Module;
  const web3 = requireWorkspaceModule("@solana/web3.js");
  Connection = web3.Connection;
  Keypair = web3.Keypair;
  Transaction = web3.Transaction;
}

function usage() {
  console.log(`
ArtMint Studio Mint E2E Smoke Test (local/devnet)

Usage:
  node scripts/test-mint-e2e.js

Required env:
  MINT_SMOKE_KEYPAIR_PATH=/path/to/solana/id.json
    or
  MINT_SMOKE_KEYPAIR_JSON='[1,2,3,...]'

Optional env:
  MINT_SMOKE_BASE_URL=http://localhost:3000
  MINT_SMOKE_CLUSTER=devnet|localnet
  MINT_SMOKE_RPC_URL=https://api.devnet.solana.com
  MINT_SMOKE_FLOW=standard|custom|both|upload|all
  MINT_SMOKE_UPLOAD_IMAGE_PATH=/path/to/image.jpg   (required for upload/all)
  MINT_SMOKE_PYTHON=python3
  MINT_SMOKE_SEED=123456
  MINT_SMOKE_CUSTOM_SEED=123457
  MINT_SMOKE_TIMEOUT_MS=60000

Notes:
  - Your app server must be running and configured for the same cluster/RPC.
  - The wallet must be funded (devnet SOL or local validator SOL).
  - This executes a real mint transaction (prepare -> sign -> submit -> confirm).
`);
}

function getSetCookieHeader(headers) {
  if (typeof headers.getSetCookie === "function") {
    const values = headers.getSetCookie();
    if (values && values.length > 0) return values[0];
  }
  return headers.get("set-cookie");
}

function cookieFromResponse(res) {
  const setCookie = getSetCookieHeader(res.headers);
  if (!setCookie) return null;
  return setCookie.split(";")[0];
}

async function fetchJson(url, options = {}, expectedStatus = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (expectedStatus !== null && res.status !== expectedStatus) {
      throw new Error(
        `Expected ${expectedStatus} from ${url}, got ${res.status}: ${text.slice(0, 400)}`
      );
    }

    return { res, json, text };
  } finally {
    clearTimeout(timeout);
  }
}

function loadKeypair() {
  const keypairJson = process.env.MINT_SMOKE_KEYPAIR_JSON;
  const keypairPath =
    process.env.MINT_SMOKE_KEYPAIR_PATH ||
    process.env.SOLANA_KEYPAIR_PATH ||
    process.env.KEYPAIR_PATH;

  let secret;
  if (keypairJson) {
    secret = JSON.parse(keypairJson);
  } else if (keypairPath) {
    const abs = path.resolve(keypairPath);
    secret = JSON.parse(fs.readFileSync(abs, "utf8"));
  } else {
    throw new Error(
      "Missing keypair. Set MINT_SMOKE_KEYPAIR_PATH or MINT_SMOKE_KEYPAIR_JSON."
    );
  }

  if (!Array.isArray(secret)) {
    throw new Error("Keypair must be a JSON array of bytes");
  }
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function clusterExplorerSuffix() {
  if (CLUSTER === "mainnet" || CLUSTER === "mainnet-beta") return "";
  if (CLUSTER === "devnet") return "?cluster=devnet";
  if (CLUSTER === "testnet") return "?cluster=testnet";
  return "";
}

function txExplorerUrl(signature) {
  const suffix = clusterExplorerSuffix();
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

function addressExplorerUrl(address) {
  const suffix = clusterExplorerSuffix();
  return `https://explorer.solana.com/address/${address}${suffix}`;
}

async function checkServerHealth() {
  console.log(`\n== Health Check ==`);
  const { res, json, text } = await fetchJson(`${BASE_URL}/api/health`);
  console.log(`Health status: ${res.status}`);
  if (!res.ok) {
    throw new Error(`Server health check failed: ${text.slice(0, 400)}`);
  }

  if (json && typeof json === "object") {
    const payload = json;
    const clusterValue =
      payload.cluster ||
      payload?.environment?.cluster ||
      payload?.checks?.rpc?.cluster ||
      payload?.details?.cluster;
    if (clusterValue) {
      console.log(`Server reported cluster: ${clusterValue}`);
      if (String(clusterValue).toLowerCase() !== CLUSTER) {
        console.warn(
          `WARNING: script cluster (${CLUSTER}) differs from server cluster (${clusterValue})`
        );
      }
    }
  }
}

async function signIn(walletKeypair) {
  console.log(`\n== Auth (SIWS) ==`);

  const nonceResp = await fetchJson(`${BASE_URL}/api/auth/nonce`, {
    method: "GET",
  });
  if (!nonceResp.res.ok) {
    throw new Error(
      `Nonce request failed (${nonceResp.res.status}): ${nonceResp.text.slice(0, 400)}`
    );
  }

  const { nonce, message } = nonceResp.json || {};
  if (!nonce || !message) {
    throw new Error("Nonce response missing nonce/message");
  }

  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, walletKeypair.secretKey);
  const signatureB58 = bs58.encode(signature);
  const wallet = walletKeypair.publicKey.toBase58();

  const verifyResp = await fetchJson(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      nonce,
      signature: signatureB58,
    }),
  });

  if (!verifyResp.res.ok) {
    throw new Error(
      `Auth verify failed (${verifyResp.res.status}): ${verifyResp.text.slice(0, 400)}`
    );
  }

  const cookie = cookieFromResponse(verifyResp.res);
  if (!cookie) {
    throw new Error("Auth verify succeeded but no session cookie was set");
  }

  console.log(`Authenticated wallet: ${wallet}`);
  return { wallet, cookie };
}

async function preparePendingMint(cookie) {
  console.log(`\n== Prepare Pending Mint Record ==`);

  const payload = {
    templateId: "flow_fields",
    seed: SEED,
    palette: ["#101820", "#f2aa4c", "#d81159", "#1e88e5"],
    params: DEFAULT_FLOW_FIELDS_PARAMS,
    prompt: `Smoke test mint ${new Date().toISOString()}`,
    title: `Smoke Mint ${SEED}`,
  };

  const resp = await fetchJson(`${BASE_URL}/api/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.res.ok || !resp.json?.success) {
    throw new Error(
      `Mint prepare-record failed (${resp.res.status}): ${resp.text.slice(0, 600)}`
    );
  }

  console.log(`Placeholder mint: ${resp.json.placeholderMintAddress}`);
  console.log(`Hash: ${resp.json.hash}`);
  if (resp.json.reused) {
    console.log(`Reused existing pending mint record`);
  }

  return resp.json;
}

async function preparePendingCustomMint(cookie) {
  console.log(`\n== Prepare Pending Custom Mint Record ==`);

  const pngBase64 = `data:image/png;base64,${Buffer.alloc(256, 7).toString("base64")}`;
  const payload = {
    code:
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1080 1080'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0%' stop-color='#0b132b'/>" +
      "<stop offset='100%' stop-color='#3a86ff'/></linearGradient></defs>" +
      "<rect width='1080' height='1080' fill='url(#g)'/>" +
      "<circle cx='540' cy='540' r='260' fill='#f2aa4c' opacity='0.9'/></svg>",
    mode: "svg",
    seed: CUSTOM_SEED,
    palette: ["#0b132b", "#3a86ff", "#f2aa4c"],
    title: `Custom ${CUSTOM_SEED}`,
    description: "ArtMint custom smoke test",
    pngBase64,
  };

  const resp = await fetchJson(`${BASE_URL}/api/mint/custom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.res.ok || !resp.json?.success) {
    throw new Error(
      `Custom mint prepare-record failed (${resp.res.status}): ${resp.text.slice(0, 600)}`
    );
  }

  console.log(`Custom placeholder mint: ${resp.json.placeholderMintAddress}`);
  console.log(`Custom hash: ${resp.json.hash}`);
  if (resp.json.reused) {
    console.log(`Reused existing pending custom mint record`);
  }

  return resp.json;
}

function prepareUploadArtifacts(imagePath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "artmint-upload-smoke-"));
  const helper = spawnSync(
    UPLOAD_PYTHON,
    [UPLOAD_HELPER_PATH, "--input", imagePath, "--out-dir", tempDir],
    {
      encoding: "utf8",
      env: process.env,
    }
  );

  if (helper.status !== 0) {
    const stderr = (helper.stderr || "").trim();
    const stdout = (helper.stdout || "").trim();
    throw new Error(
      `Upload asset preparation failed (${helper.status}): ${stderr || stdout || "unknown error"}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(helper.stdout);
  } catch (err) {
    throw new Error(
      `Upload asset helper returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed?.files?.originalPath || !parsed?.files?.mintPath || !parsed?.files?.thumbnailPath || !parsed?.meta) {
    throw new Error("Upload asset helper returned incomplete data");
  }

  return parsed;
}

async function preparePendingUploadMint(cookie) {
  console.log(`\n== Prepare Pending Upload Mint Record ==`);
  if (!UPLOAD_IMAGE_PATH) {
    throw new Error(
      "Missing MINT_SMOKE_UPLOAD_IMAGE_PATH for upload flow."
    );
  }

  const inputPath = path.resolve(UPLOAD_IMAGE_PATH);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Upload image not found: ${inputPath}`);
  }

  console.log(`Input image: ${inputPath}`);
  const preparedAssets = prepareUploadArtifacts(inputPath);
  const { files, meta } = preparedAssets;

  console.log(`Prepared upload assets in: ${files.tempDir}`);
  console.log(
    `Original ${meta.original.width}x${meta.original.height}, mint ${meta.mint.width}x${meta.mint.height}, thumb ${meta.thumbnail.width}x${meta.thumbnail.height}`
  );

  const form = new FormData();
  form.append(
    "original",
    new Blob([fs.readFileSync(files.originalPath)], { type: meta.original.mime }),
    files.originalFilename || path.basename(files.originalPath)
  );
  form.append(
    "mint",
    new Blob([fs.readFileSync(files.mintPath)], { type: meta.mint.mime }),
    files.mintFilename || path.basename(files.mintPath)
  );
  form.append(
    "thumbnail",
    new Blob([fs.readFileSync(files.thumbnailPath)], { type: meta.thumbnail.mime }),
    files.thumbnailFilename || path.basename(files.thumbnailPath)
  );
  form.append("meta", JSON.stringify(meta));

  const resp = await fetchJson(`${BASE_URL}/api/upload/commit`, {
    method: "POST",
    headers: {
      Cookie: cookie,
    },
    body: form,
  });

  if (!resp.res.ok || !resp.json?.success) {
    throw new Error(
      `Upload commit failed (${resp.res.status}): ${resp.text.slice(0, 600)}`
    );
  }

  console.log(`Upload placeholder mint: ${resp.json.placeholderMintAddress}`);
  console.log(`Upload hash: ${resp.json.hash}`);
  if (resp.json.reused) {
    console.log(`Reused existing pending upload mint record`);
  }

  return resp.json;
}

async function prepareOnChainMint(cookie, placeholderMintAddress) {
  console.log(`\n== Prepare On-Chain Mint Transaction ==`);

  const resp = await fetchJson(`${BASE_URL}/api/mint/prepare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ placeholderMintAddress }),
  });

  if (!resp.res.ok || !resp.json?.success) {
    throw new Error(
      `Mint tx prepare failed (${resp.res.status}): ${resp.text.slice(0, 600)}`
    );
  }

  const prepared = resp.json.prepared;
  console.log(`Prepared mint address: ${prepared.mintAddress}`);
  console.log(`Blockhash: ${prepared.blockhash}`);
  console.log(`Last valid block height: ${prepared.lastValidBlockHeight}`);
  return prepared;
}

async function submitMintTransaction(walletKeypair, prepared) {
  console.log(`\n== Sign + Submit Mint Transaction ==`);
  console.log(`RPC: ${RPC_URL}`);

  const connection = new Connection(RPC_URL, "confirmed");
  const tx = Transaction.from(
    Buffer.from(prepared.serializedTransaction, "base64")
  );
  tx.partialSign(walletKeypair);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(`Submitted tx: ${signature}`);
  console.log(`Explorer: ${txExplorerUrl(signature)}`);

  const confirmation = await Promise.race([
    connection.confirmTransaction(
      {
        signature,
        blockhash: prepared.blockhash,
        lastValidBlockHeight: prepared.lastValidBlockHeight,
      },
      "finalized"
    ),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Transaction confirmation timeout")), REQUEST_TIMEOUT_MS)
    ),
  ]);

  if (confirmation.value && confirmation.value.err) {
    throw new Error(
      `Mint transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  console.log(`Finalized on-chain`);
  return signature;
}

async function confirmMintBackend(cookie, placeholderMintAddress, mintAddress, txSignature) {
  console.log(`\n== Confirm Mint With Backend ==`);

  const resp = await fetchJson(`${BASE_URL}/api/mint/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      placeholderMintAddress,
      mintAddress,
      txSignature,
    }),
  });

  if (!resp.res.ok || !resp.json?.success) {
    throw new Error(
      `Mint backend confirm failed (${resp.res.status}): ${resp.text.slice(0, 600)}`
    );
  }

  console.log(`Backend confirmed mint: ${resp.json.mintAddress}`);
  return resp.json;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  console.log("ArtMint Studio Mint E2E Smoke Test");
  console.log("==================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Cluster: ${CLUSTER}`);
  console.log(`Flow mode: ${FLOW_MODE}`);
  console.log(`Seed: ${SEED}`);
  if (FLOW_MODE === "custom" || FLOW_MODE === "both") {
    console.log(`Custom seed: ${CUSTOM_SEED}`);
  }
  if (FLOW_MODE === "upload" || FLOW_MODE === "all") {
    console.log(`Upload image: ${UPLOAD_IMAGE_PATH || "(missing)"}`);
  }

  loadRuntimeDeps();
  const walletKeypair = loadKeypair();
  console.log(`Wallet: ${walletKeypair.publicKey.toBase58()}`);

  await checkServerHealth();

  const { cookie } = await signIn(walletKeypair);
  const shouldRunStandard =
    FLOW_MODE === "standard" || FLOW_MODE === "both" || FLOW_MODE === "all";
  const shouldRunCustom =
    FLOW_MODE === "custom" || FLOW_MODE === "both" || FLOW_MODE === "all";
  const shouldRunUpload = FLOW_MODE === "upload" || FLOW_MODE === "all";
  if (!shouldRunStandard && !shouldRunCustom && !shouldRunUpload) {
    throw new Error(
      `Invalid MINT_SMOKE_FLOW="${FLOW_MODE}". Use standard|custom|both|upload|all.`
    );
  }

  const results = [];

  if (shouldRunStandard) {
    const pending = await preparePendingMint(cookie);
    const prepared = await prepareOnChainMint(cookie, pending.placeholderMintAddress);
    const txSignature = await submitMintTransaction(walletKeypair, prepared);
    const confirmed = await confirmMintBackend(
      cookie,
      pending.placeholderMintAddress,
      prepared.mintAddress,
      txSignature
    );
    results.push({ flow: "standard", mintAddress: confirmed.mintAddress });
  }

  if (shouldRunCustom) {
    const pending = await preparePendingCustomMint(cookie);
    const prepared = await prepareOnChainMint(cookie, pending.placeholderMintAddress);
    const txSignature = await submitMintTransaction(walletKeypair, prepared);
    const confirmed = await confirmMintBackend(
      cookie,
      pending.placeholderMintAddress,
      prepared.mintAddress,
      txSignature
    );
    results.push({ flow: "custom", mintAddress: confirmed.mintAddress });
  }

  if (shouldRunUpload) {
    const pending = await preparePendingUploadMint(cookie);
    const prepared = await prepareOnChainMint(cookie, pending.placeholderMintAddress);
    const txSignature = await submitMintTransaction(walletKeypair, prepared);
    const confirmed = await confirmMintBackend(
      cookie,
      pending.placeholderMintAddress,
      prepared.mintAddress,
      txSignature
    );
    results.push({ flow: "upload", mintAddress: confirmed.mintAddress });
  }

  console.log(`\n== Success ==`);
  for (const result of results) {
    console.log(`[${result.flow}] Mint address: ${result.mintAddress}`);
    if (CLUSTER !== "localnet") {
      console.log(`[${result.flow}] Mint explorer: ${addressExplorerUrl(result.mintAddress)}`);
    }
    console.log(`[${result.flow}] Asset page: ${BASE_URL}/asset/${result.mintAddress}`);
  }
}

main().catch((err) => {
  console.error(`\nSmoke test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
