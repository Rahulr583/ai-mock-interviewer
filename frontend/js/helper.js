// shared helper functions used across all pages

var API_URL = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('mi_token');
}

function getUser() {
  var u = localStorage.getItem('mi_user');
  return u ? JSON.parse(u) : null;
}

function saveAuth(token, user) {
  localStorage.setItem('mi_token', token);
  localStorage.setItem('mi_user', JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem('mi_token');
  localStorage.removeItem('mi_user');
}

function isLoggedIn() {
  return !!getToken();
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '../index.html';
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = 'pages/dashboard.html';
  }
}

// make an API call with auth header
async function apiCall(endpoint, method, body) {
  var options = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' }
  };

  var token = getToken();
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  var res = await fetch(API_URL + endpoint, options);
  var data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

// show a toast message at bottom right
function showToast(msg) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);

  setTimeout(function() { t.classList.add('show'); }, 10);
  setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { t.remove(); }, 300);
  }, 3000);
}

// nicely format a date string
function niceDate(str) {
  if (!str) return '-';
  var d = new Date(str);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// return color based on score value
function getScoreColor(score) {
  var s = parseFloat(score);
  if (s >= 7.5) return '#16a34a';
  if (s >= 5)   return '#d97706';
  return '#dc2626';
}

// return a difficulty tag class
function getDiffTag(diff) {
  var map = { easy: 'tag-green', medium: 'tag-orange', hard: 'tag-red' };
  return map[diff] || 'tag-gray';
}
