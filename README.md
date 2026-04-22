# 🚀 ProjectFlow — Personal Project Manager Platform

A production-ready full-stack web application for managing personal projects with milestones, tasks, visual timelines, and attachments.

---

## 📁 Folder Structure

```
project-manager/
├── backend/
│   ├── middleware/
│   │   ├── auth.js          # JWT verify middleware
│   │   └── upload.js        # Multer file upload config
│   ├── models/
│   │   ├── User.js          # User schema (bcrypt hashing)
│   │   ├── Project.js       # Project schema (progress tracking)
│   │   ├── Milestone.js     # Milestone schema
│   │   ├── Task.js          # Task schema (auto-progress update)
│   │   └── Attachment.js    # Attachments schema (files + links)
│   ├── routes/
│   │   ├── auth.js          # POST /register, POST /login, GET /me
│   │   ├── projects.js      # CRUD + stats + search/filter/sort
│   │   ├── milestones.js    # CRUD for project milestones
│   │   ├── tasks.js         # CRUD + toggle completion
│   │   └── attachments.js   # File upload + link management
│   ├── uploads/             # Stored uploaded files (auto-created)
│   ├── .env.example         # Environment variables template
│   ├── package.json
│   └── server.js            # Express app entry point
│
└── frontend/
    ├── js/
    │   ├── api.js           # API client (all HTTP calls)
    │   └── utils.js         # Shared helpers (auth, dates, UI)
    ├── pages/
    │   ├── dashboard.html   # Main dashboard with stats + projects
    │   ├── projects.html    # Project list (grid + list view)
    │   └── project-detail.html  # Milestones, tasks, timeline, attachments
    └── index.html           # Login / Register page
```

---

## 🛠️ Prerequisites

- **Node.js** v18+ 
- **MongoDB** (local or Atlas)
- A modern browser

---

## ⚡ Quick Start

### 1. Clone / Download
```bash
cd project-manager
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` with your configuration:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/project-manager
JWT_SECRET=your_super_secret_key_at_least_32_characters_long
JWT_EXPIRE=7d
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### 3. Start MongoDB
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# Windows
net start MongoDB

# Or use MongoDB Atlas (cloud) — just update MONGODB_URI
```

### 4. Start the Backend
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

✅ Backend will run at: `http://localhost:5000`

### 5. Serve the Frontend

The frontend is plain HTML/CSS/JS — serve it with any static server:

```bash
# Option A: Using VS Code Live Server extension (recommended)
# Open frontend/index.html → Right-click → "Open with Live Server"

# Option B: Python
cd frontend
python3 -m http.server 3000

# Option C: Node.js serve package
npx serve frontend -p 3000

# Option D: npx http-server
cd frontend
npx http-server -p 3000
```

✅ Frontend will be at: `http://localhost:3000`

### 6. Open the App
Navigate to `http://localhost:3000` → Create an account → Start managing projects!

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login, receive JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/password` | Change password |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List projects (search/filter/sort/paginate) |
| GET | `/api/projects/stats` | Dashboard statistics |
| GET | `/api/projects/:id` | Get project with milestones/tasks/attachments |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project (cascade) |

#### Query Parameters for GET /api/projects:
- `search` — Full-text search in title, description, tags
- `status` — Filter: `all`, `planning`, `ongoing`, `on-hold`, `completed`, `cancelled`
- `priority` — Filter: `all`, `low`, `medium`, `high`, `critical`
- `sortBy` — `createdAt`, `deadline`, `progress`, `title`, `priority`
- `order` — `asc` or `desc`
- `page`, `limit` — Pagination

### Milestones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/milestones?projectId=` | List milestones with tasks |
| POST | `/api/milestones` | Create milestone |
| PUT | `/api/milestones/:id` | Update milestone |
| DELETE | `/api/milestones/:id` | Delete milestone |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks?projectId=` | List tasks |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| PATCH | `/api/tasks/:id/toggle` | Toggle completion (auto-updates progress) |
| DELETE | `/api/tasks/:id` | Delete task |

### Attachments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attachments?projectId=` | List project attachments |
| POST | `/api/attachments/file` | Upload file (multipart/form-data) |
| POST | `/api/attachments/link` | Add external link |
| DELETE | `/api/attachments/:id` | Delete attachment |

---

## 🗄️ Database Schema

### User
```js
{ name, email, password (bcrypt), avatar, preferences, lastLogin, timestamps }
```

### Project
```js
{ title, description, owner, status, priority, startDate, deadline, progress, 
  color, tags, stats: { totalTasks, completedTasks, totalMilestones, completedMilestones }, timestamps }
```

### Milestone
```js
{ title, description, project, owner, dueDate, order, status, progress, timestamps }
```

### Task
```js
{ title, description, project, milestone, owner, completed, completedAt,
  dueDate, priority, order, notes, timestamps }
```

### Attachment
```js
{ project, owner, type (file|link), filename, originalName, filePath, fileSize,
  mimeType, url, linkTitle, linkDescription, label, timestamps }
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| JWT Authentication (signup/login/logout) | ✅ |
| Password hashing with bcrypt | ✅ |
| Dashboard with stats | ✅ |
| Project CRUD (create/edit/delete) | ✅ |
| Search & filter projects | ✅ |
| Sort by deadline/progress/name | ✅ |
| Grid and list view toggle | ✅ |
| Milestones with due dates | ✅ |
| Tasks with priority levels | ✅ |
| Task completion toggle | ✅ |
| Auto-progress calculation | ✅ |
| File attachment upload | ✅ |
| External link attachments | ✅ |
| Visual Timeline view | ✅ |
| Deadline notifications | ✅ |
| Overdue warnings | ✅ |
| Responsive mobile design | ✅ |
| Dark UI with accent colors | ✅ |
| Toast notifications | ✅ |
| Project color coding | ✅ |
| Tag system | ✅ |
| Cascade delete | ✅ |

---

## 🔒 Security Features

- Passwords hashed with bcrypt (salt rounds: 12)
- JWT tokens with expiry (7 days default)
- Protected routes via middleware
- User-scoped data (users only see their own data)
- File type validation on upload
- File size limits
- Input validation on all endpoints
- CORS configuration

---

## 🚀 Production Deployment Notes

1. Set `NODE_ENV=production` in `.env`
2. Use a strong, random `JWT_SECRET` (32+ chars)
3. Use MongoDB Atlas for production database
4. Serve frontend from a CDN or static hosting (Netlify, Vercel)
5. Deploy backend to Railway, Render, or Heroku
6. Update `API_BASE` in `frontend/js/api.js` to your production backend URL
7. Add rate limiting with `express-rate-limit`
8. Add helmet.js for security headers
