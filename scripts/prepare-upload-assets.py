#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

try:
    from PIL import Image
except Exception as exc:
    print(f"Failed to import Pillow (PIL): {exc}", file=sys.stderr)
    sys.exit(2)


MAX_MINT_DIM = 4096
MAX_THUMB_DIM = 512
ALLOWED_MIME = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
    "GIF": "image/gif",
}


def sha256_hex(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def render_square_contain(src: Image.Image, side: int) -> Image.Image:
    src_rgba = src.convert("RGBA")
    src_w, src_h = src_rgba.size
    if src_w == 0 or src_h == 0:
        raise ValueError("Invalid source dimensions")

    scale = min(side / src_w, side / src_h)
    out_w = max(1, int(round(src_w * scale)))
    out_h = max(1, int(round(src_h * scale)))
    resized = src_rgba.resize((out_w, out_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset_x = (side - out_w) // 2
    offset_y = (side - out_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare ArtMint upload assets from an image")
    parser.add_argument("--input", required=True, help="Path to original image")
    parser.add_argument("--out-dir", required=True, help="Directory for generated assets")
    parser.add_argument("--mint-max-side", type=int, default=MAX_MINT_DIM)
    parser.add_argument("--thumb-max-side", type=int, default=MAX_THUMB_DIM)
    parser.add_argument("--quality", type=int, default=85, help="WebP quality 1-100")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    out_dir = os.path.abspath(args.out_dir)
    os.makedirs(out_dir, exist_ok=True)

    with Image.open(input_path) as im:
        fmt = (im.format or "").upper()
        mime = ALLOWED_MIME.get(fmt)
        if not mime:
            raise ValueError(f"Unsupported input format: {fmt or 'unknown'}")

        original_w, original_h = im.size
        if original_w < 1 or original_h < 1:
            raise ValueError("Invalid source dimensions")

        max_side_src = max(original_w, original_h)
        mint_side = min(args.mint_max_side, max_side_src)
        thumb_side = min(args.thumb_max_side, max_side_src)

        mint_img = render_square_contain(im, mint_side)
        thumb_img = render_square_contain(im, thumb_side)

    mint_path = os.path.join(out_dir, "mint.webp")
    thumb_path = os.path.join(out_dir, "thumb.webp")
    mint_img.save(mint_path, format="WEBP", quality=args.quality)
    thumb_img.save(thumb_path, format="WEBP", quality=args.quality)

    with open(input_path, "rb") as f:
        original_bytes = f.read()
    with open(mint_path, "rb") as f:
        mint_bytes = f.read()
    with open(thumb_path, "rb") as f:
        thumb_bytes = f.read()

    meta = {
        "description": "ArtMint upload smoke test",
        "original": {
            "filename": os.path.basename(input_path),
            "mime": mime,
            "bytes": len(original_bytes),
            "width": original_w,
            "height": original_h,
            "sha256": hashlib.sha256(original_bytes).hexdigest(),
        },
        "mint": {
            "mime": "image/webp",
            "bytes": len(mint_bytes),
            "width": mint_side,
            "height": mint_side,
            "maxSide": mint_side,
            "fit": "contain",
            "format": "webp",
            "quality": 0.85,
        },
        "thumbnail": {
            "mime": "image/webp",
            "bytes": len(thumb_bytes),
            "width": thumb_side,
            "height": thumb_side,
            "maxSide": thumb_side,
        },
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "appVersion": "smoke-test",
    }

    stem = os.path.splitext(os.path.basename(input_path))[0].strip()
    if stem:
        meta["title"] = stem

    result = {
        "files": {
            "tempDir": out_dir,
            "originalPath": input_path,
            "mintPath": mint_path,
            "thumbnailPath": thumb_path,
            "originalFilename": os.path.basename(input_path),
            "mintFilename": "mint.webp",
            "thumbnailFilename": "thumb.webp",
        },
        "meta": meta,
    }

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise
