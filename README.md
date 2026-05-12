# Mock AI Interviewer

A full-stack mock interview web app using Node.js, Express, MySQL, OpenAI, JWT, SSE, and Web Speech API.

---

## Project Structure

```
mock-interviewer/
├── backend/
│   ├── config/
│   │   └── db.js                  - MySQL connection + auto table creation
│   ├── controllers/
│   │   ├── authController.js      - register, login, getMe
│   │   └── interviewController.js - start, questions, SSE feedback, history
│   ├── middleware/
│   │   └── auth.js                - JWT token checker
│   ├── routes/
│   │   ├── auth.js
│   │   └── interview.js
│   ├── server.js                  - main Express server
│   ├── package.json
│   └── .env.example               - copy this to .env
│
└── frontend/
    ├── css/
    │   └── style.css              - all page styles
    ├── js/
    │   └── helper.js              - shared utilities
    ├── pages/
    │   ├── dashboard.html         - home after login
    │   ├── interview.html         - live interview page
    │   └── results.html           - results review page
    └── index.html                 - login / register page
```

---

## Setup Steps

### 1. Create MySQL Database

Open MySQL and run:
```sql
CREATE DATABASE mock_interviewer;
```

### 2. Setup Backend

```bash
cd backend
npm install
copy .env.example .env
```

Fill in your .env file:
```
DB_PASSWORD=your_mysql_root_password
JWT_SECRET=any_random_text_here
OPENAI_API_KEY=sk-your-key-here
```

Then start server:
```bash
node server.js
```

You should see:
```
MySQL connected
All tables ready
Server started on http://localhost:5000
```

### 3. Open Frontend

- Install Live Server extension in VS Code
- Right click `frontend/index.html`
- Click "Open with Live Server"
- Opens at http://127.0.0.1:5500

---

## API Endpoints

| Method | Route | What it does |
|--------|-------|--------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login, get JWT |
| GET | /api/auth/me | Get current user |
| POST | /api/interview/start | Start session, get first question |
| POST | /api/interview/next-question | Get next AI question |
| POST | /api/interview/submit-answer | Submit answer (SSE streams feedback) |
| POST | /api/interview/end | End session |
| GET | /api/interview/history | All past sessions |
| GET | /api/interview/session/:id | Full session with all Q&A |

---

## Technologies Used

- Node.js + Express.js - backend server
- MySQL - database
- JWT - user authentication
- bcryptjs - password hashing
- OpenAI API - question generation and feedback
- SSE (Server-Sent Events) - real-time streaming of AI feedback
- Web Speech API - voice input and text-to-speech
