import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { MAX_UPLOAD_BYTES, UPLOAD_DIR } from '../config/uploads';
import { badRequest } from '../utils/http-error';

function createUpload(allowedExtensions: string[], maxBytes: number) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    fileFilter: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(extension)) return cb(null, true);
      cb(badRequest(`Format de fichier non pris en charge (${allowedExtensions.join(', ')})`));
    },
    limits: { fileSize: maxBytes, files: 1 },
  });
}

export const uploadArchive = createUpload(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.pdf'], MAX_UPLOAD_BYTES);
export const uploadStudentList = createUpload(['.csv', '.xlsx', '.xls', '.json'], 5 * 1024 * 1024);

export function removeUploadedFile(file?: { path: string } | null) {
  if (file) fs.rm(file.path, { force: true }, () => undefined);
}
