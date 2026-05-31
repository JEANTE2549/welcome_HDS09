// ==========================================================================
// Welcome HDS-09 Single Page Application Core Controller
// ==========================================================================

// Global Reactive States
const state = {
  currentRoute: '/',
  categories: [],
  faqs: [],
  messages: [],
  selectedCategoryId: null,
  activeAdminTab: 'questions',
  activeSticker: '🎉',
  activeGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  adminKey: null,
  isConfettiActive: false
};

// ----------------------------------------------------
// 1. CONFETTI ENGINE (Pure JavaScript Canvas Shower)
// ----------------------------------------------------
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');
let particles = [];

function resizeConfettiCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeConfettiCanvas);
resizeConfettiCanvas();

class ConfettiParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * -100 - 20;
    this.size = Math.random() * 8 + 6;
    this.speedX = Math.random() * 4 - 2;
    this.speedY = Math.random() * 5 + 4;
    this.color = `hsl(${Math.random() * 360}, 90%, 65%)`;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function startConfettiShower() {
  particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push(new ConfettiParticle());
  }
  if (!state.isConfettiActive) {
    state.isConfettiActive = true;
    animateConfetti();
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  particles.forEach((p, idx) => {
    p.update();
    p.draw();
    // Remove if fallen below viewport
    if (p.y > canvas.height) {
      particles.splice(idx, 1);
    }
  });

  if (particles.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    state.isConfettiActive = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ----------------------------------------------------
// 2. SPA ROUTER & VIEW NAVIGATION
// ----------------------------------------------------
function navigateTo(route) {
  state.currentRoute = route;
  
  // Update header active styling tabs
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.route-view').forEach(view => view.classList.remove('active'));
  
  if (route === '/') {
    document.getElementById('nav-faq').classList.add('active');
    document.getElementById('route-faq').classList.add('active');
    initFaqView();
  } else if (route === '/wall') {
    document.getElementById('nav-wall').classList.add('active');
    document.getElementById('route-wall').classList.add('active');
    initWallView();
  } else if (route === '/admin') {
    document.getElementById('nav-admin').classList.add('active');
    document.getElementById('route-admin').classList.add('active');
    initAdminView();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Intercept inline search parameters for administrative magic links
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get('key');
  if (key) {
    // Attempt administrative auto-unlock
    document.getElementById('admin-passkey-input').value = key;
    navigateTo('/admin');
    handleAdminAuth(null);
  } else {
    navigateTo('/');
  }
  lucide.createIcons();
});

// ----------------------------------------------------
// 3. TOAST & NOTIFICATION MANAGER
// ----------------------------------------------------
function showToast(message, emoji = '✨') {
  const toast = document.getElementById('global-toast');
  toast.querySelector('.toast-icon').textContent = emoji;
  toast.querySelector('.toast-message').textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ----------------------------------------------------
// 4. FAQ VIEW & FUZZY SEARCH LOGIC
// ----------------------------------------------------
async function initFaqView() {
  await fetchCategories();
  await fetchFaqs();
  renderFaqCategories();
  renderFaqList();
  renderQuickTags();
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    state.categories = await res.json();
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

async function fetchFaqs() {
  try {
    const res = await fetch('/api/faqs');
    state.faqs = await res.json();
  } catch (err) {
    console.error("Error loading FAQs:", err);
  }
}

function renderFaqCategories() {
  const track = document.getElementById('category-track-element');
  track.innerHTML = '';
  
  // 1. "All Topics" Card
  const allBtn = document.createElement('button');
  allBtn.className = `category-btn ${state.selectedCategoryId === null ? 'active' : ''}`;
  allBtn.setAttribute('role', 'tab');
  allBtn.innerHTML = `<i data-lucide="layers" style="color:var(--color-primary)"></i> All Topics`;
  allBtn.onclick = () => {
    state.selectedCategoryId = null;
    updateCategoryActiveStates();
    renderFaqList();
  };
  track.appendChild(allBtn);
  
  // 2. Individual dynamic categories
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-btn ${state.selectedCategoryId === cat.id ? 'active' : ''}`;
    btn.setAttribute('role', 'tab');
    // Set custom icon representation
    btn.innerHTML = `<i data-lucide="${cat.icon || 'help-circle'}" style="color:${cat.color_scheme}"></i> ${cat.name}`;
    btn.onclick = () => {
      state.selectedCategoryId = cat.id;
      updateCategoryActiveStates();
      renderFaqList();
    };
    track.appendChild(btn);
  });
  
  lucide.createIcons();
}

function updateCategoryActiveStates() {
  const track = document.getElementById('category-track-element');
  const buttons = track.querySelectorAll('.category-btn');
  buttons.forEach((btn, idx) => {
    if (idx === 0) {
      state.selectedCategoryId === null ? btn.classList.add('active') : btn.classList.remove('active');
    } else {
      const cat = state.categories[idx - 1];
      state.selectedCategoryId === cat.id ? btn.classList.add('active') : btn.classList.remove('active');
    }
  });
}

function renderQuickTags() {
  const container = document.getElementById('quick-tags-container');
  // Retain tag title span
  container.innerHTML = `<span class="tag-title">Try searching:</span>`;
  
  const tags = ["#Uniforms", "#Bus", "#Documents", "#Food", "#Electives"];
  tags.forEach(tag => {
    const pill = document.createElement('span');
    pill.className = "search-tag-pill";
    pill.textContent = tag;
    pill.onclick = () => {
      const input = document.getElementById('faq-search');
      input.value = tag.replace('#', '');
      triggerSearch(input.value);
    };
    container.appendChild(pill);
  });
}

// Attach Search event listeners
document.getElementById('faq-search').addEventListener('input', (e) => {
  triggerSearch(e.target.value);
});

function clearSearch() {
  const input = document.getElementById('faq-search');
  input.value = '';
  document.getElementById('search-clear-btn').style.display = 'none';
  renderFaqList();
}

function triggerSearch(query) {
  const clearBtn = document.getElementById('search-clear-btn');
  if (query.trim().length > 0) {
    clearBtn.style.display = 'flex';
  } else {
    clearBtn.style.display = 'none';
  }
  renderFaqList(query);
}

function renderFaqList(searchQuery = '') {
  const container = document.getElementById('faq-list-element');
  const catTitle = document.getElementById('current-category-title');
  const countBadge = document.getElementById('faq-count-badge');
  container.innerHTML = '';
  
  // Filter state
  let filtered = state.faqs;
  
  // Category filter
  if (state.selectedCategoryId !== null) {
    filtered = filtered.filter(f => f.category_id === state.selectedCategoryId);
    const activeCat = state.categories.find(c => c.id === state.selectedCategoryId);
    catTitle.innerHTML = `<i data-lucide="${activeCat.icon || 'help-circle'}"></i> ${activeCat.name}`;
  } else {
    catTitle.innerHTML = `<i data-lucide="layers"></i> All Orientation FAQs`;
  }
  
  // Fuzzy text search filter
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(f => 
      f.question.toLowerCase().includes(q) || 
      f.answer.toLowerCase().includes(q) ||
      f.category_name.toLowerCase().includes(q)
    );
  }
  
  countBadge.textContent = `${filtered.length} entries`;
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="ask-card" style="background: transparent; border: 1px dashed var(--border-light)">
        <div class="ask-emoji">🔍</div>
        <div class="ask-details">
          <h4>No matching answers found</h4>
          <p>Try searching for different words or ask our seniors directly using the button below!</p>
        </div>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  filtered.forEach(faq => {
    const card = document.createElement('div');
    card.className = "faq-card";
    card.id = `faq-${faq.id}`;
    
    card.innerHTML = `
      <button class="faq-question-panel" onclick="toggleFaqAccordion(${faq.id})" aria-expanded="false" aria-controls="faq-ans-${faq.id}">
        <div>
          <span class="faq-card-category" style="color:${faq.color_scheme}">${faq.category_name}</span>
          <h4>${faq.question}</h4>
        </div>
        <i data-lucide="chevron-down" class="faq-chevron"></i>
      </button>
      <div class="faq-answer-panel" id="faq-ans-${faq.id}">
        <div class="faq-answer-content">
          <p>${faq.answer}</p>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  lucide.createIcons();
}

function toggleFaqAccordion(faqId) {
  const card = document.getElementById(`faq-${faqId}`);
  const panel = document.getElementById(`faq-ans-${faqId}`);
  const btn = card.querySelector('.faq-question-panel');
  
  const isOpen = card.classList.contains('open');
  
  // Close all other accordions to keep viewport clean
  document.querySelectorAll('.faq-card').forEach(otherCard => {
    otherCard.classList.remove('open');
    otherCard.querySelector('.faq-answer-panel').style.maxHeight = null;
    otherCard.querySelector('.faq-question-panel').setAttribute('aria-expanded', 'false');
  });
  
  if (!isOpen) {
    card.classList.add('open');
    panel.style.maxHeight = panel.scrollHeight + "px";
    btn.setAttribute('aria-expanded', 'true');
  }
}

// ----------------------------------------------------
// 5. ANONYMOUS QUESTION SUBMISSION MODAL
// ----------------------------------------------------
function openAskModal() {
  document.getElementById('ask-modal').classList.add('open');
}

function closeAskModal() {
  document.getElementById('ask-modal').classList.remove('open');
  document.getElementById('ask-seniors-form').reset();
}

async function submitQuestion(event) {
  event.preventDefault();
  const text = document.getElementById('freshman-question-input').value;
  
  try {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text })
    });
    
    const data = await res.json();
    if (res.ok) {
      closeAskModal();
      startConfettiShower();
      showToast("Question sent! Seniors are already preparing your answer.", "🎒");
    } else {
      showToast(data.error || "Oops! Could not send question.", "⚠️");
    }
  } catch (err) {
    showToast("Network error. Try again shortly!", "⚠️");
  }
}

// ----------------------------------------------------
// 6. CELEBRATION MESSAGE WALL STREAM
// ----------------------------------------------------
let laneTimers = [];

function initWallView() {
  fetchApprovedMessages();
}

async function fetchApprovedMessages() {
  try {
    const res = await fetch('/api/messages/approved');
    state.messages = await res.json();
    startFloatingBubbles();
  } catch (err) {
    console.error("Error loading approved messages:", err);
  }
}

function startFloatingBubbles() {
  // Clear any existing active interval timers
  laneTimers.forEach(timer => clearInterval(timer));
  laneTimers = [];
  
  // Clear lanes
  document.querySelectorAll('.stream-lane').forEach(lane => lane.innerHTML = '');
  
  if (state.messages.length === 0) return;
  
  // Split messages into pools for each active lane
  const lanes = document.querySelectorAll('.stream-lane');
  const visibleLanesCount = Array.from(lanes).filter(l => getComputedStyle(l).display !== 'none').length;
  
  for (let i = 0; i < visibleLanesCount; i++) {
    const laneIndex = i;
    const laneElement = lanes[laneIndex];
    
    // Periodically release bubbles in this lane
    spawnBubbleInLane(laneElement, laneIndex);
    
    const interval = setInterval(() => {
      spawnBubbleInLane(laneElement, laneIndex);
    }, Math.random() * 4000 + 7000); // Stagger intervals
    
    laneTimers.push(interval);
  }
}

function spawnBubbleInLane(laneElement, laneIndex) {
  // Select random message from the shared pool
  const randomMsg = state.messages[Math.floor(Math.random() * state.messages.length)];
  if (!randomMsg) return;
  
  const bubble = document.createElement('div');
  bubble.className = "msg-bubble";
  bubble.style.background = randomMsg.color_palette;
  
  // Randomize float speed for dynamic layered parallax styling
  const speed = Math.random() * 8 + 12; // between 12s and 20s
  bubble.style.animationDuration = `${speed}s`;
  
  bubble.innerHTML = `
    <div class="bubble-sticker">${randomMsg.sticker || '🎉'}</div>
    <div class="bubble-body">"${randomMsg.message}"</div>
    <div class="bubble-author">- ${randomMsg.nickname}</div>
  `;
  
  // Tap to pause interactive logic
  bubble.onclick = (e) => {
    e.stopPropagation();
    // Toggle animations state
    const isPaused = bubble.style.animationPlayState === 'paused';
    if (!isPaused) {
      bubble.style.animationPlayState = 'paused';
      bubble.style.transform = 'scale(1.1) rotate(2deg)';
      bubble.style.zIndex = '999';
      
      // Open detailed view dialog immediately
      showToast(`"${randomMsg.message}" by ${randomMsg.nickname} (Tap again to float!)`, randomMsg.sticker);
    } else {
      bubble.style.animationPlayState = 'running';
      bubble.style.transform = '';
      bubble.style.zIndex = '';
    }
  };
  
  // Cleanup bubble DOM node once animation ends (offscreen)
  bubble.addEventListener('animationend', () => {
    bubble.remove();
  });
  
  laneElement.appendChild(bubble);
}

// Message submission drawer controls
function openMessageDrawer() {
  document.getElementById('message-drawer').classList.add('open');
  updateCharCounter(document.getElementById('message-content'));
}

function closeMessageDrawer() {
  document.getElementById('message-drawer').classList.remove('open');
  document.getElementById('message-wall-form').reset();
  
  // Reset selected drawer tokens
  state.activeSticker = '🎉';
  state.activeGradient = 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)';
  
  document.querySelectorAll('.sticker-pill').forEach((p, idx) => {
    idx === 0 ? p.classList.add('active') : p.classList.remove('active');
  });
  document.querySelectorAll('.color-pill').forEach((p, idx) => {
    idx === 0 ? p.classList.add('active') : p.classList.remove('active');
  });
}

function updateCharCounter(textarea) {
  const counter = document.getElementById('msg-char-counter');
  counter.textContent = textarea.value.length;
}

function selectSticker(emoji) {
  state.activeSticker = emoji;
  const rack = document.getElementById('sticker-rack');
  rack.querySelectorAll('.sticker-pill').forEach(pill => {
    pill.textContent === emoji ? pill.classList.add('active') : pill.classList.remove('active');
  });
}

function selectGradient(cssValue) {
  state.activeGradient = cssValue;
  const rack = document.getElementById('color-rack');
  rack.querySelectorAll('.color-pill').forEach(pill => {
    pill.style.background === cssValue || pill.getAttribute('style').includes(cssValue) 
      ? pill.classList.add('active') 
      : pill.classList.remove('active');
  });
}

async function submitWallMessage(event) {
  event.preventDefault();
  const nickname = document.getElementById('message-nickname').value || 'Anonymous';
  const msg = document.getElementById('message-content').value;
  
  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        message: msg,
        color_palette: state.activeGradient,
        sticker: state.activeSticker
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      closeMessageDrawer();
      startConfettiShower();
      showToast("Celebration card sent to seniors for quick friendly approval!", "🎈");
    } else {
      showToast(data.error || "Oops! Message submission failed.", "⚠️");
    }
  } catch (err) {
    showToast("Network disconnect. Please try again!", "⚠️");
  }
}

// ----------------------------------------------------
// 7. ADMIN PROTECTED WORKSPACE & VERIFICATION
// ----------------------------------------------------
async function initAdminView() {
  const res = await fetch('/api/admin/status');
  const data = await res.json();
  
  if (data.authorized) {
    showAdminDashboard();
  } else {
    showAdminLockScreen();
  }
}

function showAdminLockScreen() {
  document.getElementById('admin-lock-screen').style.display = 'block';
  document.getElementById('admin-workspace').style.display = 'none';
}

function showAdminDashboard() {
  document.getElementById('admin-lock-screen').style.display = 'none';
  document.getElementById('admin-workspace').style.display = 'grid';
  switchAdminTab(state.activeAdminTab);
}

async function handleAdminAuth(event) {
  if (event) event.preventDefault();
  const passkey = document.getElementById('admin-passkey-input').value;
  
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: passkey })
    });
    const data = await res.json();
    if (res.ok) {
      state.adminKey = passkey;
      showToast("Access granted! Happy welcoming seniors.", "🔑");
      showAdminDashboard();
    } else {
      showToast(data.error || "Incorrect Passkey", "⚠️");
    }
  } catch (err) {
    showToast("Server offline. Verify your local runtime!", "⚠️");
  }
}

function handleAdminLogout() {
  document.cookie = "admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  state.adminKey = null;
  document.getElementById('admin-auth-form').reset();
  showAdminLockScreen();
  showToast("Workspace locked safely.", "🔒");
}

function switchAdminTab(tabName) {
  state.activeAdminTab = tabName;
  
  // Toggle active tab buttons
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabName)) {
      btn.classList.add('active');
    }
  });
  
  // Toggle tab panels
  document.querySelectorAll('.admin-tab-view').forEach(view => {
    view.classList.remove('active');
  });
  document.getElementById(`admin-tab-${tabName}`).classList.add('active');
  
  // Refresh tab content dynamically
  if (tabName === 'questions') {
    fetchAdminIncomingQuestions();
  } else if (tabName === 'moderation') {
    fetchAdminPendingMessages();
  } else if (tabName === 'faqs') {
    fetchAdminFaqManagerList();
  } else if (tabName === 'categories') {
    fetchAdminCategoryManagerList();
  }
}

// Admin Tab 1: Incoming Freshman Questions
async function fetchAdminIncomingQuestions() {
  try {
    const res = await fetch('/api/admin/questions');
    const questions = await res.json();
    
    // Update red notification counter badge
    document.getElementById('badge-incoming-count').textContent = questions.length;
    
    const container = document.getElementById('admin-questions-list');
    container.innerHTML = '';
    
    if (questions.length === 0) {
      container.innerHTML = `<div class="ask-card" style="grid-column: 1/-1"><p>Zero pending questions. You're all caught up, Senior!</p></div>`;
      return;
    }
    
    questions.forEach(q => {
      const card = document.createElement('div');
      card.className = "admin-inbox-card";
      
      const date = new Date(q.created_at).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      card.innerHTML = `
        <div class="inbox-msg">"${q.question_text}"</div>
        <div class="inbox-meta">
          <span>Anonymous Freshman</span>
          <span>${date}</span>
        </div>
        <div class="inbox-actions">
          <button class="btn btn-secondary btn-sm" onclick="convertQuestionToFaq(${q.id}, \`${q.question_text.replace(/'/g, "\\'")}\`)">
            <i data-lucide="check"></i> Convert to FAQ
          </button>
          <button class="btn btn-outline btn-sm btn-icon delete" onclick="deleteIncomingQuestion(${q.id})" aria-label="Dismiss Question">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
    lucide.createIcons();
  } catch (err) {
    showToast("Auth expired. Locked.", "🔒");
    handleAdminLogout();
  }
}

async function deleteIncomingQuestion(id) {
  if (!confirm("Discard this freshman question?")) return;
  
  const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("Question discarded.", "🗑️");
    fetchAdminIncomingQuestions();
  }
}

function convertQuestionToFaq(questionId, questionText) {
  openFaqEditor();
  document.getElementById('faq-editor-question').value = questionText;
  document.getElementById('faq-editor-convert-id').value = questionId;
  document.getElementById('faq-modal-title').textContent = "Convert to FAQ Entry";
}

// Admin Tab 2: Wall Message Moderation
async function fetchAdminPendingMessages() {
  const res = await fetch('/api/admin/messages/pending');
  const messages = await res.json();
  
  // Update moderation badge
  document.getElementById('badge-pending-messages').textContent = messages.length;
  
  const container = document.getElementById('admin-moderation-list');
  container.innerHTML = '';
  
  if (messages.length === 0) {
    container.innerHTML = `<div class="ask-card" style="grid-column: 1/-1"><p>Zero pending greetings. The wall is neat and tidy!</p></div>`;
    return;
  }
  
  messages.forEach(m => {
    const card = document.createElement('div');
    card.className = "admin-mod-card";
    card.style.background = m.color_palette;
    
    card.innerHTML = `
      <div class="mod-sticker">${m.sticker}</div>
      <div class="mod-body">"${m.message}"</div>
      <div class="mod-author">- ${m.nickname}</div>
      <div class="inbox-actions" style="margin-top: 8px">
        <button class="btn btn-secondary btn-sm" onclick="approveWallMessage(${m.id})">
          <i data-lucide="check-circle-2"></i> Approve
        </button>
        <button class="btn btn-outline btn-sm btn-icon delete" onclick="deleteWallMessage(${m.id})" aria-label="Reject message">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

async function approveWallMessage(id) {
  const res = await fetch(`/api/admin/messages/${id}/approve`, { method: 'PUT' });
  if (res.ok) {
    showToast("Message approved! Floats live on the wall now.", "🎉");
    fetchAdminPendingMessages();
  }
}

async function deleteWallMessage(id) {
  if (!confirm("Reject and delete this welcome note?")) return;
  const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("Welcome note rejected.", "🗑️");
    fetchAdminPendingMessages();
  }
}

// Admin Tab 3: FAQ Management
async function fetchAdminFaqManagerList() {
  await fetchCategories();
  await fetchFaqs();
  
  const tbody = document.getElementById('admin-faqs-tbody');
  tbody.innerHTML = '';
  
  state.faqs.forEach(faq => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${faq.question}</strong></td>
      <td><span class="count-badge" style="background:${faq.color_scheme};color:white">${faq.category_name}</span></td>
      <td><code>${faq.priority_score}</code></td>
      <td class="actions-col">
        <button class="btn-icon edit" onclick="openFaqEditor(${faq.id})" aria-label="Edit FAQ"><i data-lucide="edit"></i></button>
        <button class="btn-icon delete" onclick="deleteFaq(${faq.id})" aria-label="Delete FAQ"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function openFaqEditor(editFaqId = null) {
  const modal = document.getElementById('admin-faq-modal');
  modal.classList.add('open');
  
  // Populate category list in selection element
  const select = document.getElementById('faq-editor-category');
  select.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
  
  if (editFaqId) {
    document.getElementById('faq-modal-title').textContent = "Edit FAQ Card";
    const faq = state.faqs.find(f => f.id === editFaqId);
    document.getElementById('faq-editor-id').value = faq.id;
    document.getElementById('faq-editor-question').value = faq.question;
    document.getElementById('faq-editor-category').value = faq.category_id;
    document.getElementById('faq-editor-answer').value = faq.answer;
    document.getElementById('faq-editor-priority').value = faq.priority_score;
  } else {
    document.getElementById('faq-modal-title').textContent = "Create FAQ Card";
    document.getElementById('admin-faq-form').reset();
    document.getElementById('faq-editor-id').value = '';
    document.getElementById('faq-editor-convert-id').value = '';
  }
}

function closeFaqEditor() {
  document.getElementById('admin-faq-modal').classList.remove('open');
}

async function saveFaq(event) {
  event.preventDefault();
  const id = document.getElementById('faq-editor-id').value;
  const convertId = document.getElementById('faq-editor-convert-id').value;
  
  const payload = {
    category_id: parseInt(document.getElementById('faq-editor-category').value),
    question: document.getElementById('faq-editor-question').value,
    answer: document.getElementById('faq-editor-answer').value,
    priority_score: parseInt(document.getElementById('faq-editor-priority').value || 0)
  };
  
  let res;
  if (id) {
    // Update FAQ
    res = await fetch(`/api/admin/faqs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    // Create new FAQ
    if (convertId) payload.convert_question_id = parseInt(convertId);
    res = await fetch('/api/admin/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  if (res.ok) {
    closeFaqEditor();
    showToast("FAQ card saved successfully!", "💾");
    
    // Refresh current view states
    if (convertId) {
      switchAdminTab('questions');
    } else {
      fetchAdminFaqManagerList();
    }
  }
}

async function deleteFaq(id) {
  if (!confirm("Permanently delete this FAQ?")) return;
  const res = await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("FAQ entry deleted.", "🗑️");
    fetchAdminFaqManagerList();
  }
}

// Admin Tab 4: Category Management
async function fetchAdminCategoryManagerList() {
  await fetchCategories();
  
  const tbody = document.getElementById('admin-categories-tbody');
  tbody.innerHTML = '';
  
  state.categories.forEach(cat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${cat.name}</strong></td>
      <td><code>${cat.icon}</code></td>
      <td><span class="count-badge" style="background:${cat.color_scheme};color:white">${cat.color_scheme}</span></td>
      <td class="actions-col">
        <button class="btn-icon edit" onclick="openCategoryEditor(${cat.id})" aria-label="Edit Category"><i data-lucide="edit"></i></button>
        <button class="btn-icon delete" onclick="deleteCategory(${cat.id})" aria-label="Delete Category"><i data-lucide="trash-2"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  lucide.createIcons();
}

function openCategoryEditor(editCatId = null) {
  const modal = document.getElementById('admin-category-modal');
  modal.classList.add('open');
  
  if (editCatId) {
    document.getElementById('category-modal-title').textContent = "Edit Category";
    const cat = state.categories.find(c => c.id === editCatId);
    document.getElementById('category-editor-id').value = cat.id;
    document.getElementById('category-editor-name').value = cat.name;
    document.getElementById('category-editor-icon').value = cat.icon;
    document.getElementById('category-editor-color').value = cat.color_scheme;
  } else {
    document.getElementById('category-modal-title').textContent = "Create Category";
    document.getElementById('admin-category-form').reset();
    document.getElementById('category-editor-id').value = '';
  }
}

function closeCategoryEditor() {
  document.getElementById('admin-category-modal').classList.remove('open');
}

async function saveCategory(event) {
  event.preventDefault();
  const id = document.getElementById('category-editor-id').value;
  
  const payload = {
    name: document.getElementById('category-editor-name').value,
    icon: document.getElementById('category-editor-icon').value,
    color_scheme: document.getElementById('category-editor-color').value
  };
  
  let res;
  if (id) {
    res = await fetch(`/api/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  if (res.ok) {
    closeCategoryEditor();
    showToast("Category configuration saved!", "💾");
    fetchAdminCategoryManagerList();
  }
}

async function deleteCategory(id) {
  if (!confirm("Deleting this category will permanently delete all associated FAQs! Proceed?")) return;
  const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("Category and related FAQs deleted.", "🗑️");
    fetchAdminCategoryManagerList();
  }
}
