import mongoose from 'mongoose';
import path from 'path';
import { Readable } from 'stream';

/**
 * Returns the MongoDB GridFSBucket instance for chat attachments.
 * Always binds to the active MongoDB Atlas database connection.
 */
export function getChatGridFSBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB is not connected. Cannot access GridFS bucket.');
  }

  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'chatAttachments',
  });
}

/**
 * Strips dangerous path traversal, control characters, and unsafe symbols
 * to produce a safe original filename.
 */
export function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') {
    return `attachment-${Date.now()}`;
  }

  // Extract base filename without path separators
  const base = path.basename(originalName).replace(/[\0\x00-\x1f\x7f/\\]/g, '');
  // Replace characters other than alphanumeric, dots, underscores, dashes with underscores
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_').trim();

  return sanitized || `attachment-${Date.now()}`;
}

export type AttachmentCategory = 'image' | 'document';

export interface ValidatedAttachment {
  category: AttachmentCategory;
  mimeType: string;
  safeFilename: string;
}

/**
 * Validates file size (max 10MB) and allowed extensions & MIME types.
 *
 * Images: JPG, JPEG, PNG, WEBP
 * Documents: PDF, DOC, DOCX
 */
export function validateAttachment(
  originalname: string,
  mimetype: string,
  size: number
): { valid: boolean; error?: string; validated?: ValidatedAttachment } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per attachment

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 10 MB limit (${(size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const ext = path.extname(originalname).toLowerCase();
  const safeFilename = sanitizeFilename(originalname);

  // 1. Supported image formats
  if (['.jpg', '.jpeg'].includes(ext)) {
    return {
      valid: true,
      validated: {
        category: 'image',
        mimeType: 'image/jpeg',
        safeFilename,
      },
    };
  }

  if (ext === '.png') {
    return {
      valid: true,
      validated: {
        category: 'image',
        mimeType: 'image/png',
        safeFilename,
      },
    };
  }

  if (ext === '.webp') {
    return {
      valid: true,
      validated: {
        category: 'image',
        mimeType: 'image/webp',
        safeFilename,
      },
    };
  }

  // 2. Supported document formats
  if (ext === '.pdf') {
    return {
      valid: true,
      validated: {
        category: 'document',
        mimeType: 'application/pdf',
        safeFilename,
      },
    };
  }

  if (ext === '.doc') {
    return {
      valid: true,
      validated: {
        category: 'document',
        mimeType: 'application/msword',
        safeFilename,
      },
    };
  }

  if (ext === '.docx') {
    return {
      valid: true,
      validated: {
        category: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        safeFilename,
      },
    };
  }

  return {
    valid: false,
    error: `Unsupported file format "${ext || mimetype}". Supported formats are JPG, JPEG, PNG, WEBP, PDF, DOC, and DOCX.`,
  };
}

/**
 * Uploads a file buffer directly to the MongoDB GridFS bucket 'chatAttachments'.
 * Does not write to the local filesystem.
 */
export async function uploadToGridFS(
  buffer: Buffer,
  filename: string,
  contentType: string,
  metadata: {
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    senderId: string;
    conversationId: string;
  }
): Promise<mongoose.Types.ObjectId> {
  const bucket = getChatGridFSBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata: {
        ...metadata,
        createdAt: new Date(),
      },
    });

    uploadStream.on('error', (err) => reject(err));
    uploadStream.on('finish', () => resolve(uploadStream.id as mongoose.Types.ObjectId));

    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
  });
}

/**
 * Deletes a file from the GridFS bucket.
 * Used for cleanup if message persistence fails after file upload.
 */
export async function deleteFromGridFS(fileId: mongoose.Types.ObjectId | string): Promise<void> {
  try {
    const bucket = getChatGridFSBucket();
    const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(id);
  } catch (err) {
    console.error(`[GridFS] Error deleting file ${fileId}:`, err);
  }
}

/**
 * Retrieves file metadata from the GridFS files collection.
 */
export async function getFileFromGridFS(fileId: mongoose.Types.ObjectId | string) {
  const bucket = getChatGridFSBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  const files = await bucket.find({ _id: id }).toArray();
  return files.length > 0 ? files[0] : null;
}

/**
 * Opens a readable download stream from GridFS.
 */
export function openDownloadStreamFromGridFS(
  fileId: mongoose.Types.ObjectId | string
): mongoose.mongo.GridFSBucketReadStream {
  const bucket = getChatGridFSBucket();
  const id = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(id);
}
