/**
 * Attachment Schema
 * File uploads and external links attached to projects
 */

const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['file', 'link'],
    required: true
  },
  // For files
  filename: {
    type: String,
    default: null
  },
  originalName: {
    type: String,
    default: null
  },
  filePath: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  mimeType: {
    type: String,
    default: null
  },
  // For links
  url: {
    type: String,
    default: null
  },
  linkTitle: {
    type: String,
    trim: true,
    maxlength: 200,
    default: null
  },
  linkDescription: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },
  // Common
  label: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Virtual: File size in human-readable format ──────────────────────────────
attachmentSchema.virtual('fileSizeFormatted').get(function() {
  if (!this.fileSize) return null;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// ─── Virtual: File icon based on mime type ────────────────────────────────────
attachmentSchema.virtual('fileIcon').get(function() {
  if (this.type === 'link') return 'link';
  if (!this.mimeType) return 'file';
  
  if (this.mimeType.includes('pdf')) return 'file-pdf';
  if (this.mimeType.includes('image')) return 'file-image';
  if (this.mimeType.includes('word') || this.mimeType.includes('document')) return 'file-word';
  if (this.mimeType.includes('excel') || this.mimeType.includes('spreadsheet')) return 'file-excel';
  if (this.mimeType.includes('zip') || this.mimeType.includes('rar')) return 'file-archive';
  if (this.mimeType.includes('text')) return 'file-text';
  return 'file';
});

module.exports = mongoose.model('Attachment', attachmentSchema);
