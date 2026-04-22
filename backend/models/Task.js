/**
 * Task Schema
 * Individual tasks belonging to milestones/projects
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    minlength: [2, 'Title must be at least 2 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  milestone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Milestone',
    default: null
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  order: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Virtual: Is overdue ──────────────────────────────────────────────────────
taskSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && !this.completed;
});

// ─── Pre-save: Set completedAt timestamp ──────────────────────────────────────
taskSchema.pre('save', function(next) {
  if (this.isModified('completed')) {
    this.completedAt = this.completed ? new Date() : null;
  }
  next();
});

// ─── Post-save: Update parent milestone and project progress ──────────────────
taskSchema.post('save', async function(doc) {
  try {
    if (doc.milestone) {
      const Milestone = mongoose.model('Milestone');
      const milestone = await Milestone.findById(doc.milestone);
      if (milestone) await milestone.recalculateProgress();
    }
    
    const Project = mongoose.model('Project');
    const project = await Project.findById(doc.project);
    if (project) await project.recalculateProgress();
  } catch (err) {
    console.error('Error updating progress:', err.message);
  }
});

taskSchema.index({ project: 1, milestone: 1, order: 1 });
taskSchema.index({ project: 1, completed: 1 });

module.exports = mongoose.model('Task', taskSchema);
