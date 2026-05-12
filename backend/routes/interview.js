const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  startSession,
  nextQuestion,
  submitAnswer,
  endSession,
  getHistory,
  getSessionDetail
} = require('../controllers/interviewController');

// protect all routes - user must be logged in
router.use(auth);

router.post('/start', startSession);
router.post('/next-question', nextQuestion);
router.post('/submit-answer', submitAnswer);
router.post('/end', endSession);
router.get('/history', getHistory);
router.get('/session/:id', getSessionDetail);

module.exports = router;
