import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const confirmSchema = z.object({
  placeholderMintAddress: z.string(),
  mintAddress: z.string(),
  txSignature: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { placeholderMintAddress, mintAddress, txSignature } = parsed.data;

    await prisma.mint.update({
      where: { mintAddress: placeholderMintAddress },
      data: { mintAddress },
    });

    return NextResponse.json({ success: true, mintAddress });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirm error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
