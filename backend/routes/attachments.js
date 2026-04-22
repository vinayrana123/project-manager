/**
 * Attachment Routes
 * GET    /api/attachments?projectId=   — List attachments for a project
 * POST   /api/attachments/file         — Upload file attachment
 * POST   /api/attachments/link         — Add link attachment
 * DELETE /api/attachments/:id          — Delete attachment
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const path = require('path');
const fs = require('fs');

const Attachment = require('../models/Attachment');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

// ─── Helper: Verify project ownership ────────────────────────────────────────
const verifyProject = async (projectId, userId) => {
  return await Project.findOne({ _id: projectId, owner: userId });
};

// ─── GET /api/attachments ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId required' });
    }
    
    const project = await verifyProject(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    const attachments = await Attachment.find({ project: projectId })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
    
    res.json({ success: true, attachments });
    
  } catch (err) {
    console.error('Get attachments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/attachments/file ───────────────────────────────────────────────
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const { projectId, label } = req.body;
    
    const project = await verifyProject(projectId, req.user.id);
    if (!project) {
      // Clean up uploaded file
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    const attachment = await Attachment.create({
      project: projectId,
      owner: req.user.id,
      type: 'file',
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path.replace(/\\/g, '/'),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      label: label || req.file.originalname
    });
    
    const populated = await Attachment.findById(attachment._id).lean({ virtuals: true });
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      attachment: populated
    });
    
  } catch (err) {
    // Clean up on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Upload file error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ─── POST /api/attachments/link ───────────────────────────────────────────────
router.post('/link', [
  body('projectId').notEmpty().withMessage('Project ID required'),
  body('url').isURL().withMessage('Valid URL required'),
  body('linkTitle').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { projectId, url, linkTitle, linkDescription, label } = req.body;
    
    const project = await verifyProject(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    const attachment = await Attachment.create({
      project: projectId,
      owner: req.user.id,
      type: 'link',
      url,
      linkTitle: linkTitle || url,
      linkDescription: linkDescription || '',
      label: label || linkTitle || url
    });
    
    const populated = await Attachment.findById(attachment._id).lean({ virtuals: true });
    
    res.status(201).json({
      success: true,
      message: 'Link added successfully',
      attachment: populated
    });
    
  } catch (err) {
    console.error('Add link error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/attachments/:id ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const attachment = await Attachment.findOne({ _id: req.params.id, owner: req.user.id });
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    
    // Delete physical file if it exists
    if (attachment.type === 'file' && attachment.filePath) {
      fs.unlink(path.resolve(attachment.filePath), (err) => {
        if (err) console.warn('Could not delete file:', err.message);
      });
    }
    
    await attachment.deleteOne();
    
    res.json({ success: true, message: 'Attachment deleted' });
    
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
