const OpenAI = require('openai');
const { pool } = require('../config/db');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// POST /api/interview/start
async function startSession(req, res) {
  const { job_role, difficulty } = req.body;

  if (!job_role) {
    return res.status(400).json({ success: false, message: 'Job role is required' });
  }

  try {
    // create session row
    const [result] = await pool.execute(
      'INSERT INTO sessions (user_id, job_role, difficulty) VALUES (?, ?, ?)',
      [req.user.id, job_role, difficulty || 'medium']
    );
    const sessionId = result.insertId;

    // generate first question from openai
    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a technical interviewer. The candidate is applying for: ${job_role}. Difficulty level: ${difficulty || 'medium'}. Ask one relevant interview question. Return only the question, nothing else.`
        },
        { role: 'user', content: 'Ask me the first interview question.' }
      ],
      max_tokens: 150
    });

    const questionText = response.choices[0].message.content.trim();

    // save question
    const [qResult] = await pool.execute(
      'INSERT INTO questions (session_id, question_text, q_number) VALUES (?, ?, ?)',
      [sessionId, questionText, 1]
    );

    res.json({
      success: true,
      session: { id: sessionId, job_role, difficulty: difficulty || 'medium' },
      question: { id: qResult.insertId, text: questionText, number: 1 }
    });
  } catch (err) {
    console.log('startSession error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to start interview' });
  }
}

// POST /api/interview/next-question
async function nextQuestion(req, res) {
  const { session_id } = req.body;

  try {
    const [sessions] = await pool.execute(
      'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
      [session_id, req.user.id]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const session = sessions[0];

    // get all previous questions so we dont repeat
    const [prevQs] = await pool.execute(
      'SELECT question_text, q_number FROM questions WHERE session_id = ? ORDER BY q_number',
      [session_id]
    );
    const nextNum = prevQs.length + 1;
    const prevList = prevQs.map(q => `Q${q.q_number}: ${q.question_text}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are interviewing a candidate for ${session.job_role}. Difficulty: ${session.difficulty}.\nPrevious questions:\n${prevList}\nAsk a new different question. Return only the question text.`
        },
        { role: 'user', content: `Give question number ${nextNum}.` }
      ],
      max_tokens: 150
    });

    const questionText = response.choices[0].message.content.trim();

    const [qResult] = await pool.execute(
      'INSERT INTO questions (session_id, question_text, q_number) VALUES (?, ?, ?)',
      [session_id, questionText, nextNum]
    );

    res.json({
      success: true,
      question: { id: qResult.insertId, text: questionText, number: nextNum }
    });
  } catch (err) {
    console.log('nextQuestion error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to get next question' });
  }
}

// POST /api/interview/submit-answer
// uses SSE to stream feedback word by word
async function submitAnswer(req, res) {
  const { session_id, question_id, answer_text } = req.body;

  if (!session_id || !question_id || !answer_text) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const [questions] = await pool.execute('SELECT * FROM questions WHERE id = ?', [question_id]);
    const [sessions] = await pool.execute('SELECT * FROM sessions WHERE id = ?', [session_id]);

    if (questions.length === 0 || sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Question or session not found' });
    }

    const question = questions[0];
    const session = sessions[0];

    // SSE setup - keeps connection open and streams data
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    let fullFeedback = '';

    // stream openai response chunk by chunk
    const stream = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      stream: true,
      messages: [
        {
          role: 'system',
          content: `You are evaluating a ${session.job_role} interview answer.
Give structured feedback:
1. Strengths
2. What to improve
3. Score out of 10
Keep it short and helpful. Under 150 words.`
        },
        {
          role: 'user',
          content: `Question: ${question.question_text}\nAnswer: ${answer_text}`
        }
      ],
      max_tokens: 300
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        fullFeedback += text;
        // send each word/piece to frontend
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      }
    }

    // parse score from feedback
    const scoreMatch = fullFeedback.match(/(\d+(\.\d+)?)\s*\/\s*10/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;

    // save answer and feedback to db
    await pool.execute(
      'INSERT INTO answers (session_id, question_id, answer_text, feedback, score) VALUES (?, ?, ?, ?, ?)',
      [session_id, question_id, answer_text, fullFeedback, score]
    );

    // update session average score
    const [avgRes] = await pool.execute(
      'SELECT AVG(score) as avg FROM answers WHERE session_id = ?',
      [session_id]
    );
    await pool.execute('UPDATE sessions SET score = ? WHERE id = ?', [avgRes[0].avg, session_id]);

    // tell frontend streaming is done
    res.write(`data: ${JSON.stringify({ type: 'done', score })}\n\n`);
    res.end();

  } catch (err) {
    console.log('submitAnswer error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to get feedback' })}\n\n`);
    res.end();
  }
}

// POST /api/interview/end
async function endSession(req, res) {
  const { session_id } = req.body;
  try {
    await pool.execute(
      'UPDATE sessions SET status = "completed", ended_at = NOW() WHERE id = ? AND user_id = ?',
      [session_id, req.user.id]
    );
    res.json({ success: true, message: 'Session ended' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not end session' });
  }
}

// GET /api/interview/history
async function getHistory(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*,
        COUNT(DISTINCT q.id) as total_questions,
        COUNT(DISTINCT a.id) as total_answers
       FROM sessions s
       LEFT JOIN questions q ON q.session_id = s.id
       LEFT JOIN answers a ON a.session_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.started_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, sessions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load history' });
  }
}

// GET /api/interview/session/:id
async function getSessionDetail(req, res) {
  const { id } = req.params;
  try {
    const [sessions] = await pool.execute(
      'SELECT * FROM sessions WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const [questions] = await pool.execute(
      `SELECT q.*, a.answer_text, a.feedback, a.score as ans_score, a.answered_at
       FROM questions q
       LEFT JOIN answers a ON a.question_id = q.id
       WHERE q.session_id = ?
       ORDER BY q.q_number`,
      [id]
    );

    res.json({ success: true, session: sessions[0], questions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not load session' });
  }
}

module.exports = { startSession, nextQuestion, submitAnswer, endSession, getHistory, getSessionDetail };
