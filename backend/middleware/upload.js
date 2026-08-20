const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const uploadsBase = path.join(__dirname, '..', 'uploads');
ensureDir(path.join(uploadsBase, 'avatars'));
ensureDir(path.join(uploadsBase, 'assignments'));

// Allowed MIME types
const AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ASSIGNMENT_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed'
];

// Extension validation
const AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const ASSIGNMENT_EXTS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.zip'
];

// Storage factory
const createStorage = (subDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(uploadsBase, subDir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Generate safe filename: UUID + original extension
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `${uuidv4()}${ext}`;
      cb(null, safeName);
    }
  });
};

// File filter factory
const createFileFilter = (allowedMimes, allowedExts) => {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`File type not allowed. Allowed: ${allowedExts.join(', ')}`), false);
    }
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`File extension not allowed. Allowed: ${allowedExts.join(', ')}`), false);
    }
    cb(null, true);
  };
};

// Avatar upload middleware
const uploadAvatar = multer({
  storage: createStorage('avatars'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: createFileFilter(AVATAR_MIMES, AVATAR_EXTS)
}).single('avatar');

// Assignment file upload middleware
const uploadAssignment = multer({
  storage: createStorage('assignments'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createFileFilter(ASSIGNMENT_MIMES, ASSIGNMENT_EXTS)
}).single('file');

// Wrap multer in error-handling middleware
const handleUpload = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds the allowed limit.'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      next();
    });
  };
};

module.exports = {
  uploadAvatar: handleUpload(uploadAvatar),
  uploadAssignment: handleUpload(uploadAssignment)
};
