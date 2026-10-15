import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import asyncHandler from "express-async-handler";
import { fileURLToPath } from "url";
import { slugifyRu } from "../utils/slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../public/uploads");

// Product photos are resized/re-encoded to WebP on upload so the catalog
// never ships oversized originals straight from a phone camera — this is
// the "auto-compress on the way in" half of the pipeline. The other half
// (on-the-fly resizing per device/viewport) happens client-side via
// next/image, which re-optimizes whatever we serve here on every request
// (see the explicit `quality` prop on every <Image> in the client — its
// own default is a much lower 75).
//
// Quality is set high on purpose: this is a boutique catalog, not a photo
// host trying to save disk space, and WebP at this quality still comes out
// smaller than the average phone-camera JPEG despite the much larger
// working resolution.
const MAX_WIDTH = 2400;
const WEBP_QUALITY = 95;

// POST /api/uploads  (admin — multipart/form-data, field "images", optional "nameHint")
export const uploadProductImages = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    res.status(400);
    throw new Error("No files uploaded");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  // A descriptive, keyword-bearing filename (rather than a bare hash) is a
  // real Google Images ranking signal, so we slugify the product name the
  // admin is typing when the photo is attached.
  const nameHint = req.body.nameHint ? slugifyRu(req.body.nameHint) : "buket";

  const urls = await Promise.all(
    files.map(async (file) => {
      const suffix = crypto.randomBytes(4).toString("hex");
      const filename = `${nameHint}-${suffix}.webp`;
      const filepath = path.join(UPLOAD_DIR, filename);

      await sharp(file.buffer)
        .rotate() // respect EXIF orientation from phone cameras
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 6, smartSubsample: false })
        .toFile(filepath);

      return `/uploads/${filename}`;
    })
  );

  res.status(201).json({ urls });
});
