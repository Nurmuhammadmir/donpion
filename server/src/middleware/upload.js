import multer from "multer";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const storage = multer.memoryStorage();

export const uploadImages = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB per original file, before compression
    files: 6,
  },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Unsupported file type — use JPEG, PNG, WebP or AVIF"));
      return;
    }
    cb(null, true);
  },
});
