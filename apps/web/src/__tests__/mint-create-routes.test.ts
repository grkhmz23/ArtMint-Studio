import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { defaultFlowFieldsParams } from "@artmint/common";

const mocks = vi.hoisted(() => {
  return {
    requireAuth: vi.fn(),
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
    uploadFile: vi.fn(),
    mintFindUnique: vi.fn(),
    mintCreate: vi.fn(),
    generateSVG: vi.fn(),
    renderPNGFromSVG: vi.fn(),
    buildHtmlArtifact: vi.fn(),
    buildCustomSvgArtifact: vi.fn(),
    buildCustomCodeArtifact: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: mocks.uploadFile,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    mint: {
      create: mocks.mintCreate,
      findUnique: mocks.mintFindUnique,
    },
  },
}));

vi.mock("@artmint/render", () => ({
  RENDERER_VERSION: "test-renderer",
  generateSVG: mocks.generateSVG,
  renderPNGFromSVG: mocks.renderPNGFromSVG,
  buildHtmlArtifact: mocks.buildHtmlArtifact,
  buildCustomSvgArtifact: mocks.buildCustomSvgArtifact,
  buildCustomCodeArtifact: mocks.buildCustomCodeArtifact,
}));

import { POST as mintPreparePost } from "../app/api/mint/route";
import { POST as mintCustomPost } from "../app/api/mint/custom/route";

function makeJsonReq(body: unknown, headers?: Record<string, string>) {
  return {
    headers: new Headers(headers),
    json: async () => body,
  } as any;
}

describe("mint preparation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireAuth.mockResolvedValue("Wallet111111111111111111111111111111111111111");
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, resetMs: 0 });
    mocks.generateSVG.mockReturnValue("<svg></svg>");
    mocks.renderPNGFromSVG.mockReturnValue(Buffer.from("png-binary"));
    mocks.buildHtmlArtifact.mockReturnValue("<html>artifact</html>");
    mocks.buildCustomSvgArtifact.mockReturnValue("<html>custom-svg</html>");
    mocks.buildCustomCodeArtifact.mockReturnValue("<html>custom-js</html>");
    mocks.uploadFile.mockImplementation(async (_data: unknown, filename: string) => ({
      url: `https://storage.test/${filename}`,
    }));
    mocks.mintFindUnique.mockResolvedValue(null);
    mocks.mintCreate.mockResolvedValue({ id: "mint-1" });
  });

  it("POST /api/mint creates a pending mint record for AI/manual flow", async () => {
    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 12345,
        palette: ["#111111", "#eeeeee", "#ff0066"],
        params: defaultFlowFieldsParams,
        prompt: "dense monochrome flow field with accent streaks",
        title: "Flow Test",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.placeholderMintAddress).toMatch(/^pending-/);
    expect(json.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(json.metadataUrl).toContain("-metadata.json");
    expect(mocks.uploadFile).toHaveBeenCalledTimes(3);
    expect(mocks.mintCreate).toHaveBeenCalledTimes(1);

    const createArg = mocks.mintCreate.mock.calls[0][0];
    expect(createArg.data.wallet).toBe("Wallet111111111111111111111111111111111111111");
    expect(createArg.data.mintAddress).toBe(json.placeholderMintAddress);
    expect(createArg.data.status).toBeUndefined(); // default in Prisma schema
  });

  it("POST /api/mint rejects invalid request bodies", async () => {
    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 1,
        palette: ["#111111", "#ffffff"],
        params: { density: 99 }, // invalid schema
        prompt: "",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint rejects unknown template params (strict sanitization)", async () => {
    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 42,
        palette: ["#ABCDEF", "#123456"],
        params: {
          ...defaultFlowFieldsParams,
          extraField: 1,
        },
        prompt: "  strict params test  ",
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint rejects titles that exceed on-chain metadata byte limit", async () => {
    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 123,
        palette: ["#111111", "#ffffff"],
        params: defaultFlowFieldsParams,
        prompt: "valid prompt",
        title: "a".repeat(33),
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint canonicalizes persisted payloads", async () => {
    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 777,
        palette: ["#ABCDEF", "#123456"],
        params: defaultFlowFieldsParams,
        prompt: "  canonical prompt  ",
        title: "  Canonical Title  ",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.canonicalInput.prompt).toBe("canonical prompt");
    expect(json.canonicalInput.palette).toEqual(["#abcdef", "#123456"]);

    const createArg = mocks.mintCreate.mock.calls[0][0];
    const storedInput = JSON.parse(createArg.data.inputJson);
    expect(storedInput.prompt).toBe("canonical prompt");
    expect(storedInput.palette).toEqual(["#abcdef", "#123456"]);
    expect(createArg.data.title).toBe("Canonical Title");
  });

  it("POST /api/mint returns idempotent success for duplicate pending mints", async () => {
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: "pending-existingmint",
      wallet: "Wallet111111111111111111111111111111111111111",
      status: "pending",
      hash: "e".repeat(64),
      metadataUrl: "https://storage.test/existing-meta.json",
      imageUrl: "https://storage.test/existing.png",
      animationUrl: "https://storage.test/existing.html",
      inputJson: JSON.stringify({
        rendererVersion: "test-renderer",
        templateId: "flow_fields",
        seed: 12345,
        palette: ["#111111", "#eeeeee"],
        params: defaultFlowFieldsParams,
        prompt: "existing prompt",
        createdAt: "2026-02-26T00:00:00.000Z",
      }),
    });

    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 12345,
        palette: ["#111111", "#eeeeee"],
        params: defaultFlowFieldsParams,
        prompt: "existing prompt",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
    expect(json.placeholderMintAddress).toBe("pending-existingmint");
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint handles create races via P2002", async () => {
    const p2002 = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype
    ) as Prisma.PrismaClientKnownRequestError;
    (p2002 as any).code = "P2002";
    (p2002 as any).message = "Unique constraint failed";

    mocks.mintCreate.mockRejectedValueOnce(p2002);
    mocks.mintFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        mintAddress: "pending-racemint",
        wallet: "Wallet111111111111111111111111111111111111111",
        status: "pending",
        hash: "f".repeat(64),
        metadataUrl: "https://storage.test/racemint-meta.json",
        imageUrl: "https://storage.test/racemint.png",
        animationUrl: "https://storage.test/racemint.html",
        inputJson: JSON.stringify({
          rendererVersion: "test-renderer",
          templateId: "flow_fields",
          seed: 12345,
          palette: ["#111111", "#eeeeee"],
          params: defaultFlowFieldsParams,
          prompt: "race prompt",
          createdAt: "2026-02-26T00:00:00.000Z",
        }),
      });

    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 12345,
        palette: ["#111111", "#eeeeee"],
        params: defaultFlowFieldsParams,
        prompt: "race prompt",
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
  });

  it("POST /api/mint passes through auth failures", async () => {
    mocks.requireAuth.mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 })
    );

    const res = await mintPreparePost(
      makeJsonReq({
        templateId: "flow_fields",
        seed: 12345,
        palette: ["#111111", "#eeeeee"],
        params: defaultFlowFieldsParams,
        prompt: "test",
      })
    );

    expect(res.status).toBe(401);
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/custom creates a pending mint record for code studio", async () => {
    const pngBytes = Buffer.alloc(256, 7);
    const res = await mintCustomPost(
      makeJsonReq({
        code: "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        mode: "svg",
        seed: 999,
        palette: ["#000000", "#ffffff"],
        title: "Code Test",
        pngBase64: `data:image/png;base64,${pngBytes.toString("base64")}`,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.placeholderMintAddress).toMatch(/^pending-/);
    expect(json.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.buildCustomSvgArtifact).toHaveBeenCalledTimes(1);
    expect(mocks.uploadFile).toHaveBeenCalledTimes(3);

    const createArg = mocks.mintCreate.mock.calls[0][0];
    expect(createArg.data.title).toBe("Code Test");
    expect(createArg.data.wallet).toBe("Wallet111111111111111111111111111111111111111");
  });

  it("POST /api/mint/custom canonicalizes code and returns idempotent duplicate response", async () => {
    const existingCanonicalInput = {
      rendererVersion: "test-renderer",
      templateId: "custom_code",
      seed: 999,
      palette: ["#abcdef", "#123456"],
      params: { code: "line1\nline2" },
      prompt: "custom_code",
      createdAt: "2026-02-26T00:00:00.000Z",
    };
    mocks.mintFindUnique.mockResolvedValue({
      mintAddress: "pending-duplicate12345",
      wallet: "Wallet111111111111111111111111111111111111111",
      status: "pending",
      hash: "a".repeat(64),
      metadataUrl: "https://storage.test/custom-meta.json",
      imageUrl: "https://storage.test/custom.png",
      animationUrl: "https://storage.test/custom.html",
      inputJson: JSON.stringify(existingCanonicalInput),
    });

    const pngBytes = Buffer.alloc(256, 7);
    const res = await mintCustomPost(
      makeJsonReq({
        code: "line1\r\nline2",
        mode: "svg",
        seed: 999,
        palette: ["#ABCDEF", "#123456"],
        title: "  Duplicate Code  ",
        pngBase64: `data:image/png;base64,${pngBytes.toString("base64")}`,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
    expect(json.placeholderMintAddress).toBe("pending-duplicate12345");
    expect(json.canonicalInput.params.code).toBe("line1\nline2");
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/custom handles create races via P2002", async () => {
    const p2002 = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype
    ) as Prisma.PrismaClientKnownRequestError;
    (p2002 as any).code = "P2002";
    (p2002 as any).message = "Unique constraint failed";

    mocks.mintCreate.mockRejectedValueOnce(p2002);
    mocks.mintFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      mintAddress: "pending-race1234567890",
      wallet: "Wallet111111111111111111111111111111111111111",
      status: "pending",
      hash: "b".repeat(64),
      metadataUrl: "https://storage.test/race-meta.json",
      imageUrl: "https://storage.test/race.png",
      animationUrl: "https://storage.test/race.html",
      inputJson: JSON.stringify({
        rendererVersion: "test-renderer",
        templateId: "custom_code",
        seed: 123,
        palette: ["#000000", "#ffffff"],
        params: { code: "ok" },
        prompt: "custom_code",
        createdAt: "2026-02-26T00:00:00.000Z",
      }),
    });

    const pngBytes = Buffer.alloc(256, 1);
    const res = await mintCustomPost(
      makeJsonReq({
        code: "ok",
        mode: "svg",
        seed: 123,
        palette: ["#000000", "#ffffff"],
        pngBase64: `data:image/png;base64,${pngBytes.toString("base64")}`,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reused).toBe(true);
  });

  it("POST /api/mint/custom enforces request size limit", async () => {
    const res = await mintCustomPost(
      makeJsonReq(
        {
          code: "x",
          mode: "svg",
          seed: 1,
          palette: ["#000000", "#ffffff"],
          pngBase64: "data:image/png;base64,AA==",
        },
        { "content-length": "12000001" }
      )
    );

    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toContain("Request body too large");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/custom rejects empty image captures", async () => {
    const tiny = Buffer.alloc(20, 1);
    const res = await mintCustomPost(
      makeJsonReq({
        code: "console.log('hi')",
        mode: "javascript",
        seed: 123,
        palette: ["#000000", "#ffffff"],
        pngBase64: `data:image/png;base64,${tiny.toString("base64")}`,
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("appears empty");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });

  it("POST /api/mint/custom fails closed when rate limiting backend errors", async () => {
    mocks.checkRateLimit.mockRejectedValueOnce(new Error("db unavailable"));

    const pngBytes = Buffer.alloc(256, 1);
    const res = await mintCustomPost(
      makeJsonReq({
        code: "ok",
        mode: "svg",
        seed: 1,
        palette: ["#000000", "#ffffff"],
        pngBase64: `data:image/png;base64,${pngBytes.toString("base64")}`,
      })
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain("Rate limit service unavailable");
    expect(mocks.mintCreate).not.toHaveBeenCalled();
  });
});
