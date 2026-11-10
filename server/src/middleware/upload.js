import multer from "multer";

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
// One slot can be a short clip instead of a photo — .mov is what an iPhone
// actually produces, so it has to be accepted even though nothing re-
// encodes it (see uploads.controller.js; there's no ffmpeg in this
// pipeline, only sharp, which only ever handled images).
const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    // memoryStorage holds every file in RAM at once on this 1.9GB VPS —
    // kept well below what 6 concurrent uploads could add up to, since a
    // product realistically has at most one video among its photos.
    fileSize: 20 * 1024 * 1024,
    files: 6,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype) && !ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      cb(new Error("Unsupported file type — use JPEG, PNG, WebP, AVIF, MP4, WebM or MOV"));
      return;
    }
    cb(null, true);
  },
});
