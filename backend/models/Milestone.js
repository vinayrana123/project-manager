/**
 * Milestone Schema
 * Project milestones that group related tasks
 */

const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Milestone title is required'],
    trim: true,
    minlength: [2, 'Title must be at least 2 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: {
    type: Date,
    default: null
  },
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ─── Virtual: Is overdue ──────────────────────────────────────────────────────
milestoneSchema.virtual('isOverdue').get(function() {
  return this.dueDate && this.dueDate < new Date() && this.status !== 'completed';
});

// ─── Method: Recalculate progress from tasks ──────────────────────────────────
milestoneSchema.methods.recalculateProgress = async function() {
  const Task = mongoose.model('Task');
  const tasks = await Task.find({ milestone: this._id });
  
  if (tasks.length === 0) {
    this.progress = 0;
    this.status = 'pending';
  } else {
    const completed = tasks.filter(t => t.completed).length;
    this.progress = Math.round((completed / tasks.length) * 100);
    
    if (this.progress === 100) this.status = 'completed';
    else if (this.progress > 0) this.status = 'in-progress';
    else this.status = 'pending';
  }
  
  await this.save();
  return this;
};

milestoneSchema.index({ project: 1, order: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
