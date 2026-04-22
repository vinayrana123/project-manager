/**
 * Project Routes
 * GET    /api/projects         — List all projects (with search/filter/sort)
 * POST   /api/projects         — Create project
 * GET    /api/projects/:id     — Get single project with milestones/tasks
 * PUT    /api/projects/:id     — Update project
 * DELETE /api/projects/:id     — Delete project (cascades)
 * GET    /api/projects/stats   — Dashboard stats
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const Task = require('../models/Task');
const Attachment = require('../models/Attachment');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ─── GET /api/projects/stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [projects, tasks] = await Promise.all([
      Project.find({ owner: userId }),
      Task.find({ owner: userId })
    ]);
    
    const now = new Date();
    const stats = {
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      ongoingProjects: projects.filter(p => p.status === 'ongoing').length,
      overdueProjects: projects.filter(p => p.deadline < now && p.status !== 'completed').length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      pendingTasks: tasks.filter(t => !t.completed).length,
      overdueTasks: tasks.filter(t => t.dueDate && t.dueDate < now && !t.completed).length,
      avgProgress: projects.length
        ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
        : 0,
      // Upcoming deadlines (next 7 days)
      upcomingDeadlines: projects.filter(p => {
        const days = (p.deadline - now) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 7 && p.status !== 'completed';
      }).length
    };
    
    res.json({ success: true, stats });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/projects ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, status, priority, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
    
    const filter = { owner: req.user.id };
    
    // Search in title, description, tags
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Filter by status
    if (status && status !== 'all') filter.status = status;
    
    // Filter by priority
    if (priority && priority !== 'all') filter.priority = priority;
    
    // Sort options
    const sortOptions = {
      'deadline': { deadline: order === 'asc' ? 1 : -1 },
      'progress': { progress: order === 'asc' ? 1 : -1 },
      'title': { title: order === 'asc' ? 1 : -1 },
      'createdAt': { createdAt: order === 'asc' ? 1 : -1 },
      'priority': { priority: order === 'asc' ? 1 : -1 }
    };
    
    const sort = sortOptions[sortBy] || { createdAt: -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean({ virtuals: true }),
      Project.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      projects,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
    
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/projects ───────────────────────────────────────────────────────
router.post('/', [
  body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be 2-100 characters'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('deadline').isISO8601().withMessage('Valid deadline required'),
  body('status').optional().isIn(['planning', 'ongoing', 'on-hold', 'completed', 'cancelled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { title, description, startDate, deadline, status, priority, color, tags } = req.body;
    
    if (new Date(deadline) <= new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'Deadline must be after start date' });
    }
    
    const project = await Project.create({
      title, description, startDate, deadline,
      status: status || 'planning',
      priority: priority || 'medium',
      color: color || '#6366f1',
      tags: tags || [],
      owner: req.user.id
    });
    
    res.status(201).json({ success: true, message: 'Project created', project });
    
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id })
      .lean({ virtuals: true });
    
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Fetch milestones with their tasks
    const milestones = await Milestone.find({ project: project._id })
      .sort({ order: 1, createdAt: 1 })
      .lean({ virtuals: true });
    
    // Fetch all tasks for this project
    const tasks = await Task.find({ project: project._id })
      .sort({ order: 1, createdAt: 1 })
      .lean({ virtuals: true });
    
    // Group tasks by milestone
    const tasksMap = {};
    tasks.forEach(task => {
      const key = task.milestone ? task.milestone.toString() : 'unassigned';
      if (!tasksMap[key]) tasksMap[key] = [];
      tasksMap[key].push(task);
    });
    
    const milestonesWithTasks = milestones.map(m => ({
      ...m,
      tasks: tasksMap[m._id.toString()] || []
    }));
    
    // Fetch attachments
    const attachments = await Attachment.find({ project: project._id })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });
    
    res.json({
      success: true,
      project: {
        ...project,
        milestones: milestonesWithTasks,
        unassignedTasks: tasksMap['unassigned'] || [],
        attachments
      }
    });
    
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────
router.put('/:id', [
  body('title').optional().trim().isLength({ min: 2, max: 100 }),
  body('deadline').optional().isISO8601(),
  body('status').optional().isIn(['planning', 'ongoing', 'on-hold', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    const allowedUpdates = ['title', 'description', 'startDate', 'deadline', 'status', 'priority', 'color', 'tags'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });
    
    await project.save();
    
    res.json({ success: true, message: 'Project updated', project });
    
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user.id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    // Cascade delete all related data
    await Promise.all([
      Milestone.deleteMany({ project: project._id }),
      Task.deleteMany({ project: project._id }),
      Attachment.deleteMany({ project: project._id }),
      project.deleteOne()
    ]);
    
    res.json({ success: true, message: 'Project and all related data deleted' });
    
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
