import multer from "multer";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
// One slot can be a short clip instead of a photo — .mov is what an iPhone
// actually produces, so it has to be accepted even though nothing re-
// encodes it (see uploads.controller.js; there's no ffmpeg in this
// pipeline, only sharp, which only ever handled images).
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const VIDEO_EXTENSION_RE = /\.(mp4|webm|mov)$/i;

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    // memoryStorage holds every file in RAM at once on this 1.9GB VPS —
    // kept well below what 6 concurrent uploads could add up to, since a
    // product realistically has at most one video among its photos. This
    // is the *source* clip ffmpeg compresses down, not what ends up
    // stored/served (see uploads.controller.js).
    fileSize: 30 * 1024 * 1024,
    files: 6,
  },
  fileFilter(req, file, cb) {
    // Some browsers send a generic/empty mimetype for .mov in particular
    // (no clear OS-level mapping) — the extension is the fallback that
    // actually catches it instead of rejecting a perfectly real video.
    const isVideo = ALLOWED_VIDEO_MIME.has(file.mimetype) || VIDEO_EXTENSION_RE.test(file.originalname);
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype) && !isVideo) {
      cb(new Error("Unsupported file type — use JPEG, PNG, WebP, AVIF, MP4, WebM or MOV"));
      return;
    }
    cb(null, true);
  },
});
