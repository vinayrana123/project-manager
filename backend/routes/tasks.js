/**
 * Task Routes
 * GET    /api/tasks?projectId=      — List tasks for a project
 * POST   /api/tasks                 — Create task
 * PUT    /api/tasks/:id             — Update task
 * PATCH  /api/tasks/:id/toggle      — Toggle completion
 * DELETE /api/tasks/:id             — Delete task
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const Task = require('../models/Task');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const { protect } = require('../middleware/auth');

router.use(protect);

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { projectId, milestoneId, completed } = req.query;
    
    const filter = { owner: req.user.id };
    if (projectId) filter.project = projectId;
    if (milestoneId) filter.milestone = milestoneId;
    if (completed !== undefined) filter.completed = completed === 'true';
    
    const tasks = await Task.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .lean({ virtuals: true });
    
    res.json({ success: true, tasks });
    
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Title must be 2-200 characters'),
  body('projectId').notEmpty().withMessage('Project ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { title, description, projectId, milestoneId, dueDate, priority, notes } = req.body;
    
    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, owner: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Verify milestone belongs to project (if provided)
    if (milestoneId) {
      const milestone = await Milestone.findOne({ _id: milestoneId, project: projectId });
      if (!milestone) {
        return res.status(404).json({ success: false, message: 'Milestone not found in this project' });
      }
    }
    
    // Get max order
    const filter = { project: projectId };
    if (milestoneId) filter.milestone = milestoneId;
    const lastTask = await Task.findOne(filter).sort({ order: -1 });
    
    const task = await Task.create({
      title, description,
      project: projectId,
      milestone: milestoneId || null,
      owner: req.user.id,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      notes: notes || '',
      order: lastTask ? lastTask.order + 1 : 0
    });
    
    res.status(201).json({ success: true, message: 'Task created', task });
    
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const allowedUpdates = ['title', 'description', 'dueDate', 'priority', 'notes', 'order', 'milestone'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) task[field] = req.body[field];
    });
    
    await task.save();
    res.json({ success: true, message: 'Task updated', task });
    
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/tasks/:id/toggle ─────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    task.completed = !task.completed;
    await task.save(); // Post-save hook updates milestone and project progress
    
    res.json({
      success: true,
      message: task.completed ? 'Task marked complete' : 'Task marked incomplete',
      task,
      completed: task.completed
    });
    
  } catch (err) {
    console.error('Toggle task error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, owner: req.user.id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const { project: projectId, milestone: milestoneId } = task;
    await task.deleteOne();
    
    // Recalculate progress
    if (milestoneId) {
      const milestone = await Milestone.findById(milestoneId);
      if (milestone) await milestone.recalculateProgress();
    }
    
    const project = await Project.findById(projectId);
    if (project) await project.recalculateProgress();
    
    res.json({ success: true, message: 'Task deleted' });
    
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
