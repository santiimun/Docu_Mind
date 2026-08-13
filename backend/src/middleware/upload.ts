import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Límite estricto de 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Validamos que el tipo MIME sea estrictamente un PDF
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Formato no permitido: Solo se pueden subir archivos PDF (.pdf)'));
    }
    cb(null, true);
  },
});