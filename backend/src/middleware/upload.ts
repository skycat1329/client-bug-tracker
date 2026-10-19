import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { AppError } from './errorHandler.js';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (config.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Allowed types: ${config.allowedMimeTypes.join(', ')}`,
        400
      )
    );
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSizeBytes,
  },
  fileFilter,
});
