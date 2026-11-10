import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import asyncHandler from "express-async-handler";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
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

// Some browsers send no/generic mimetype for .mov specifically — same
// fallback as middleware/upload.js's fileFilter, so a real video never
// silently falls through to the photo path just because the browser
// didn't label it.
const VIDEO_EXTENSION_RE = /\.(mp4|webm|mov)$/i;

// Every place this ever renders (<video> in the admin thumbnail, the
// storefront card, the product gallery) sets muted — nobody can ever
// hear it, so stripping audio is free size savings, not a feature loss.
// Scaled down and bitrate-capped for the same reason the admin asked for
// this explicitly: a product preview clip has no reason to be
// multi-megabyte-per-second source footage once it's compressed for the
// web. faststart lets playback begin before the whole file has arrived.
const VIDEO_MAX_WIDTH = 960;
const VIDEO_TIMEOUT_MS = 90_000;

function transcodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-vf", `scale='min(${VIDEO_MAX_WIDTH},iw)':-2`,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "28",
      "-maxrate", "1500k",
      "-bufsize", "3000k",
      "-an",
      "-movflags", "+faststart",
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      ffmpeg.kill("SIGKILL");
      reject(new Error("Обработка видео заняла слишком много времени"));
    }, VIDEO_TIMEOUT_MS);

    ffmpeg.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}

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

      const isVideo = file.mimetype.startsWith("video/") || VIDEO_EXTENSION_RE.test(file.originalname);
      if (isVideo) {
        // ffmpeg needs real file paths, not buffers — the source is
        // written to a scratch file, transcoded, then cleaned up either
        // way (success or failure) so a bad upload never leaks disk space.
        const tmpInput = path.join(os.tmpdir(), `upload-${suffix}${path.extname(file.originalname) || ".tmp"}`);
        const filename = `${nameHint}-${suffix}.mp4`;
        const filepath = path.join(UPLOAD_DIR, filename);
        await fs.writeFile(tmpInput, file.buffer);
        try {
          await transcodeVideo(tmpInput, filepath);
        } finally {
          await fs.unlink(tmpInput).catch(() => {});
        }
        return `/uploads/${filename}`;
      }

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
