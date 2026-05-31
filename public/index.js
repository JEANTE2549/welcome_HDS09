// ==========================================================================
// HDS-09 Freshman Orientation Hub JS Controller
// ==========================================================================

// Global Reactive States
const state = {
  categories: [],
  faqs: [],
  messages: [],
  selectedCategoryId: null,
  activeSticker: '🎉',
  activeGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  isConfettiActive: false
};

// ----------------------------------------------------
// 1. CONFETTI ENGINE (Pure JavaScript Canvas Particles)
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
// 2. TOAST NOTIFICATION UTILITIES
// ----------------------------------------------------
function showToast(message, emoji = '✨') {
  const toast = document.getElementById('global-toast');
  if (!toast) return;
  toast.querySelector('.toast-icon').textContent = emoji;
  toast.querySelector('.toast-message').textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// ----------------------------------------------------
// 3. FAQ VIEW & INTERACTIVE FUZZY SEARCH
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
  if (!track) return;
  track.innerHTML = '';
  
  // All topics selector
  const allBtn = document.createElement('button');
  allBtn.className = `category-btn ${state.selectedCategoryId === null ? 'active' : ''}`;
  allBtn.setAttribute('role', 'tab');
  allBtn.innerHTML = `<i data-lucide="layers" style="color:var(--color-primary)"></i> หัวข้อทั้งหมด`;
  allBtn.onclick = () => {
    state.selectedCategoryId = null;
    updateCategoryActiveStates();
    renderFaqList();
  };
  track.appendChild(allBtn);
  
  // Custom seeded categories
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `category-btn ${state.selectedCategoryId === cat.id ? 'active' : ''}`;
    btn.setAttribute('role', 'tab');
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
  if (!track) return;
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
  if (!container) return;
  container.innerHTML = `<span class="tag-title">ลองค้นหาด่วน:</span>`;
  
  const tags = ["#ชุดนิสิต", "#การเดินทาง", "#เอกสารสำคัญ", "#โรงอาหาร", "#วิชาเลือก"];
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

// Bind search listeners
const searchInput = document.getElementById('faq-search');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    triggerSearch(e.target.value);
  });
}

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
  if (!container) return;
  container.innerHTML = '';
  
  let filtered = state.faqs;
  
  if (state.selectedCategoryId !== null) {
    filtered = filtered.filter(f => f.category_id === state.selectedCategoryId);
    const activeCat = state.categories.find(c => c.id === state.selectedCategoryId);
    if (catTitle && activeCat) {
      catTitle.innerHTML = `<i data-lucide="${activeCat.icon || 'help-circle'}"></i> ${activeCat.name}`;
    }
  } else {
    if (catTitle) {
      catTitle.innerHTML = `<i data-lucide="layers"></i> คู่มือคำถามพบบ่อยทั้งหมด`;
    }
  }
  
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(f => 
      f.question.toLowerCase().includes(q) || 
      f.answer.toLowerCase().includes(q) ||
      f.category_name.toLowerCase().includes(q)
    );
  }
  
  if (countBadge) countBadge.textContent = `${filtered.length} คำถาม`;
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="ask-card" style="background: transparent; border: 1px dashed var(--border-light)">
        <div class="ask-emoji">🔍</div>
        <div class="ask-details">
          <h4>ไม่พบข้อมูลคู่มือที่คุณค้นหา</h4>
          <p>ลองเปลี่ยนคีย์เวิร์ด หรือพิมพ์ส่งคำถามไปถามพี่ ๆ โดยตรงได้เลยครับ!</p>
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
// 4. ANONYMOUS QUESTION SUBMISSION MODAL
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
      showToast("ส่งคำถามเรียบร้อยแล้ว! พี่ ๆ กำลังเตรียมคำตอบให้อยู่นะครับ", "🎒");
    } else {
      showToast(data.error || "อุ๊ย! ส่งคำถามไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", "⚠️");
    }
  } catch (err) {
    showToast("ระบบขัดข้องทางเครือข่าย กรุณาลองใหม่ในอีกสักครู่!", "⚠️");
  }
}

// ----------------------------------------------------
// 5. PLAYFUL CELEBRATION MESSAGE WALL (3-Lane Float engine)
// ----------------------------------------------------
let laneTimers = [];

const DEFAULT_SENIOR_MESSAGES = [];

async function initWallView() {
  await fetchApprovedMessages();
}

async function fetchApprovedMessages() {
  try {
    const res = await fetch('/api/messages/approved');
    state.messages = await res.json();
    startFloatingBubbles();
  } catch (err) {
    console.error("Error loading approved messages:", err);
    startFloatingBubbles();
  }
}

let activeTimeouts = [];

function stopFloatingBubbles() {
  laneTimers.forEach(timer => clearInterval(timer));
  laneTimers = [];
  activeTimeouts.forEach(t => clearTimeout(t));
  activeTimeouts = [];
  document.querySelectorAll('.stream-lane').forEach(lane => {
    lane.innerHTML = '';
  });
}

function startFloatingBubbles() {
  stopFloatingBubbles();
  
  const lanes = document.querySelectorAll('.stream-lane');
  const visibleLanes = Array.from(lanes).filter(l => getComputedStyle(l).display !== 'none');
  const visibleLanesCount = visibleLanes.length;
  
  if (visibleLanesCount === 0) return;
  
  // Combine custom approved messages with the senior backup pool
  const pool = [...DEFAULT_SENIOR_MESSAGES, ...state.messages];
  if (pool.length === 0) return;
  
  // 1. INSTANTLY populate lanes at staggered heights so the viewport is alive immediately.
  // We place 2 bubbles per lane to guarantee the board feels active and warm from the start.
  const bubblesPerLane = 2;
  for (let i = 0; i < visibleLanesCount * bubblesPerLane; i++) {
    const laneIndex = i % visibleLanesCount;
    const laneElement = visibleLanes[laneIndex];
    // Stagger heights vertically: e.g. some near top (15-45%), some near middle (45-80%)
    const initialTop = i < visibleLanesCount ? Math.random() * 30 + 15 : Math.random() * 35 + 45;
    spawnBubbleInLane(laneElement, laneIndex, pool, initialTop);
  }
}

function spawnBubbleInLane(laneElement, laneIndex, pool, initialTop = null) {
  const randomMsg = pool[Math.floor(Math.random() * pool.length)];
  if (!randomMsg) return;
  
  const bubble = document.createElement('div');
  bubble.className = "msg-bubble";
  bubble.style.background = randomMsg.color_palette;
  
  const speed = Math.random() * 8 + 12; // 12s - 20s drift durations
  bubble.style.animationDuration = `${speed}s`;
  
  // Stagger horizontal alignment within its lane
  const horizontalOffset = Math.random() * 10 - 5;
  bubble.style.left = `calc(5% + ${horizontalOffset}px)`;
  
  bubble.innerHTML = `
    <div class="bubble-sticker">${randomMsg.sticker || '🎉'}</div>
    <div class="bubble-body">"${randomMsg.message}"</div>
    <div class="bubble-author">- ${randomMsg.nickname}</div>
  `;
  
  if (initialTop !== null) {
    const progress = (100 - initialTop) / 100;
    const delay = -(speed * progress);
    bubble.style.animationDelay = `${delay}s`;
  }
  
  bubble.onclick = (e) => {
    e.stopPropagation();
    const isPaused = bubble.style.animationPlayState === 'paused';
    if (!isPaused) {
      bubble.style.animationPlayState = 'paused';
      bubble.style.transform = 'scale(1.06) rotate(1deg)';
      bubble.style.zIndex = '999';
      showToast(`"${randomMsg.message}" โดย ${randomMsg.nickname} (คลิกอีกครั้งเพื่อให้ลอยต่อ!)`, randomMsg.sticker);
    } else {
      bubble.style.animationPlayState = 'running';
      bubble.style.transform = '';
      bubble.style.zIndex = '';
    }
  };
  
  bubble.addEventListener('animationend', () => {
    bubble.remove();
    
    // Self-sustaining infinite loop trigger:
    // When a message reaches the top, schedule the next one to spawn from the bottom of this lane!
    const nextSpawnDelay = Math.random() * 2000 + 1000; // 1s - 3s delay to keep spacing natural
    const t = setTimeout(() => {
      if (laneElement.isConnected) {
        // Re-read pool in case new messages are approved in real-time
        const currentPool = [...DEFAULT_SENIOR_MESSAGES, ...state.messages];
        spawnBubbleInLane(laneElement, laneIndex, currentPool);
      }
    }, nextSpawnDelay);
    activeTimeouts.push(t);
  });
  
  laneElement.appendChild(bubble);
}

// Drawer message submissions
function openMessageDrawer() {
  document.getElementById('message-drawer').classList.add('open');
  updateCharCounter(document.getElementById('message-content'));
}

function closeMessageDrawer() {
  document.getElementById('message-drawer').classList.remove('open');
  document.getElementById('message-wall-form').reset();
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
  if (counter) counter.textContent = textarea.value.length;
}

function selectSticker(emoji) {
  state.activeSticker = emoji;
  const rack = document.getElementById('sticker-rack');
  if (rack) {
    rack.querySelectorAll('.sticker-pill').forEach(pill => {
      pill.textContent === emoji ? pill.classList.add('active') : pill.classList.remove('active');
    });
  }
}

function selectGradient(cssValue) {
  state.activeGradient = cssValue;
  const rack = document.getElementById('color-rack');
  if (rack) {
    rack.querySelectorAll('.color-pill').forEach(pill => {
      pill.style.background === cssValue || pill.getAttribute('style').includes(cssValue) 
        ? pill.classList.add('active') 
        : pill.classList.remove('active');
    });
  }
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
      showToast("ส่งการ์ดต้อนรับแล้ว! กำลังลอยชิมลางบนจอของคุณ และส่งไปให้พี่ ๆ อนุมัติขึ้นจอใหญ่แล้วครับ", "🎈");
      
      const localBubbleObj = {
        nickname: nickname,
        message: msg,
        color_palette: state.activeGradient,
        sticker: state.activeSticker
      };
      
      const lanes = document.querySelectorAll('.stream-lane');
      const visibleLanes = Array.from(lanes).filter(l => getComputedStyle(l).display !== 'none');
      if (visibleLanes.length > 0) {
        const randomLaneIdx = Math.floor(Math.random() * visibleLanes.length);
        const laneElement = visibleLanes[randomLaneIdx];
        
        spawnBubbleInLane(laneElement, randomLaneIdx, [localBubbleObj]);
        state.messages.push(localBubbleObj);
      }
    } else {
      showToast(data.error || "อุ๊ย! ส่งการ์ดต้อนรับไม่สำเร็จ", "⚠️");
    }
  } catch (err) {
    showToast("อินเทอร์เน็ตหลุด กรุณาเชื่อมต่อใหม่และลองอีกครั้ง!", "⚠️");
  }
}

// ----------------------------------------------------
// 6. SECURE SENIORS PANEL VERIFICATION GATE
// ----------------------------------------------------
async function accessSeniorsPanel(event) {
  if (event) event.preventDefault();
  
  const enteredPasskey = prompt("🔒 ป้อนรหัสผ่าน Seniors Passcode เพื่อเข้าจัดการบอร์ด:");
  if (!enteredPasskey) return; // User cancelled
  
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: enteredPasskey })
    });
    const data = await res.json();
    if (res.ok) {
      showToast("รหัสผ่านถูกต้อง! กำลังนำคุณเข้าสู่พื้นที่ทำงานของพี่ ๆ...", "🔑");
      setTimeout(() => {
        window.location.href = `/admin?key=${encodeURIComponent(enteredPasskey)}`;
      }, 800);
    } else {
      showToast(data.error || "รหัสผ่านไม่ถูกต้อง! ลองใหม่อีกครั้งน้า", "⚠️");
    }
  } catch (err) {
    showToast("เซิร์ฟเวอร์ออฟไลน์ชั่วคราว ลองใหม่อีกทีนะ!", "⚠️");
  }
}

// ----------------------------------------------------
// 7. INITIALIZATION LOOPS
// ----------------------------------------------------
async function initDashboardView() {
  await fetchCategories();
  await fetchFaqs();
  await fetchApprovedMessages(); // Auto starts 3-lane floating loops
  renderFaqCategories();
  renderFaqList();
  renderQuickTags();
}

window.addEventListener('DOMContentLoaded', () => {
  initDashboardView();
  lucide.createIcons();
});
