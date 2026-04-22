/**
 * Milestone Routes
 * GET    /api/milestones?projectId=  — List project milestones
 * POST   /api/milestones             — Create milestone
 * PUT    /api/milestones/:id         — Update milestone
 * DELETE /api/milestones/:id         — Delete milestone
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Milestone = require('../models/Milestone');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── Helper: Verify project ownership ────────────────────────────────────────
const verifyProjectOwner = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, owner: userId });
  return project;
};

// ─── GET /api/milestones ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId query parameter required' });
    }
    
    // Verify ownership
    const project = await verifyProjectOwner(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    const milestones = await Milestone.find({ project: projectId })
      .sort({ order: 1, createdAt: 1 })
      .lean({ virtuals: true });
    
    // Attach tasks to each milestone
    const milestoneIds = milestones.map(m => m._id);
    const tasks = await Task.find({ milestone: { $in: milestoneIds } })
      .sort({ order: 1 })
      .lean({ virtuals: true });
    
    const tasksMap = {};
    tasks.forEach(t => {
      const key = t.milestone.toString();
      if (!tasksMap[key]) tasksMap[key] = [];
      tasksMap[key].push(t);
    });
    
    const result = milestones.map(m => ({
      ...m,
      tasks: tasksMap[m._id.toString()] || []
    }));
    
    res.json({ success: true, milestones: result });
    
  } catch (err) {
    console.error('Get milestones error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/milestones ─────────────────────────────────────────────────────
router.post('/', [
  body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be 2-100 characters'),
  body('projectId').notEmpty().withMessage('Project ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { title, description, projectId, dueDate, order } = req.body;
    
    const project = await verifyProjectOwner(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Get max order
    const lastMilestone = await Milestone.findOne({ project: projectId }).sort({ order: -1 });
    const newOrder = order !== undefined ? order : (lastMilestone ? lastMilestone.order + 1 : 0);
    
    const milestone = await Milestone.create({
      title, description,
      project: projectId,
      owner: req.user.id,
      dueDate: dueDate || null,
      order: newOrder
    });
    
    // Update project milestone stats
    await Project.findByIdAndUpdate(projectId, { $inc: { 'stats.totalMilestones': 1 } });
    
    res.status(201).json({ success: true, message: 'Milestone created', milestone });
    
  } catch (err) {
    console.error('Create milestone error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/milestones/:id ──────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const milestone = await Milestone.findOne({ _id: req.params.id, owner: req.user.id });
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }
    
    const allowedUpdates = ['title', 'description', 'dueDate', 'order', 'status'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) milestone[field] = req.body[field];
    });
    
    await milestone.save();
    res.json({ success: true, message: 'Milestone updated', milestone });
    
  } catch (err) {
    console.error('Update milestone error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/milestones/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const milestone = await Milestone.findOne({ _id: req.params.id, owner: req.user.id });
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }
    
    // Unassign tasks from this milestone (don't delete them)
    await Task.updateMany({ milestone: milestone._id }, { $set: { milestone: null } });
    
    // Update project stats
    await Project.findByIdAndUpdate(milestone.project, {
      $inc: { 'stats.totalMilestones': -1 }
    });
    
    await milestone.deleteOne();
    
    // Recalculate project progress
    const project = await Project.findById(milestone.project);
    if (project) await project.recalculateProgress();
    
    res.json({ success: true, message: 'Milestone deleted' });
    
  } catch (err) {
    console.error('Delete milestone error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
