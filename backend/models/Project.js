/**
 * Project Schema
 * Core project entity with progress tracking and status management
 */

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    minlength: [2, 'Title must be at least 2 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['planning', 'ongoing', 'on-hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  color: {
    type: String,
    default: '#6366f1' // Default indigo accent
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 30
  }],
  // Computed stats (updated by tasks/milestones)
  stats: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    totalMilestones: { type: Number, default: 0 },
    completedMilestones: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Virtual: Days remaining until deadline ───────────────────────────────────
projectSchema.virtual('daysRemaining').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  const diff = this.deadline - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ─── Virtual: Is overdue ──────────────────────────────────────────────────────
projectSchema.virtual('isOverdue').get(function() {
  return this.deadline < new Date() && this.status !== 'completed';
});

// ─── Method: Recalculate progress from tasks ──────────────────────────────────
projectSchema.methods.recalculateProgress = async function() {
  const Task = mongoose.model('Task');
  const tasks = await Task.find({ project: this._id });
  
  this.stats.totalTasks = tasks.length;
  this.stats.completedTasks = tasks.filter(t => t.completed).length;
  
  if (tasks.length === 0) {
    this.progress = 0;
  } else {
    this.progress = Math.round((this.stats.completedTasks / this.stats.totalTasks) * 100);
  }
  
  // Auto-update status to completed if 100%
  if (this.progress === 100 && this.status === 'ongoing') {
    this.status = 'completed';
  }
  
  await this.save();
  return this;
};

// ─── Index for search performance ────────────────────────────────────────────
projectSchema.index({ owner: 1, createdAt: -1 });
projectSchema.index({ owner: 1, deadline: 1 });
projectSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Project', projectSchema);
