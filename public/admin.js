// ==========================================================================
// Seniors Workspace Dashboard JS Controller | welcome_HDS09
// ==========================================================================

const state = {
  categories: [],
  faqs: [],
  activeTab: 'questions',
  adminKey: null
};

// ----------------------------------------------------
// 1. DYNAMIC TOAST ALERTS
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
// 2. AUTHORIZATION SESSIONS
// ----------------------------------------------------
async function checkAuthOnStartup() {
  try {
    const res = await fetch('/api/admin/status');
    const data = await res.json();
    if (data.authorized) {
      showAdminDashboard();
    } else {
      showAdminLockScreen();
    }
  } catch (err) {
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
  switchAdminTab(state.activeTab);
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
      showToast("ปลดล็อคห้องทำงานแอดมินสำเร็จ! ยินดีต้อนรับครับพี่ ๆ", "🔑");
      showAdminDashboard();
    } else {
      showToast(data.error || "รหัสผ่านไม่ถูกต้อง!", "⚠️");
    }
  } catch (err) {
    showToast("เซิร์ฟเวอร์หลังบ้านขัดข้อง ตรวจสอบการรันระบบสำเร็จนะ!", "⚠️");
  }
}

function handleAdminLogout() {
  document.cookie = "admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  state.adminKey = null;
  document.getElementById('admin-auth-form').reset();
  showAdminLockScreen();
  showToast("ล็อคสิทธิ์แดชบอร์ดและออกจากระบบเรียบร้อยแล้วครับ", "🔒");
}

// ----------------------------------------------------
// 3. TAB CONTROLLER
// ----------------------------------------------------
function switchAdminTab(tabName) {
  state.activeTab = tabName;
  
  // Toggle sidebar active styling
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeBtn = document.getElementById(`tab-${tabName}-btn`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Toggle panels
  document.querySelectorAll('.admin-tab-view').forEach(view => {
    view.classList.remove('active');
  });
  
  const activePanel = document.getElementById(`admin-tab-${tabName}`);
  if (activePanel) activePanel.classList.add('active');
  
  // Refresh content dynamically
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

// ----------------------------------------------------
// 4. DATA LOADER UTILITIES
// ----------------------------------------------------
async function fetchCategories() {
  const res = await fetch('/api/categories');
  state.categories = await res.json();
}

async function fetchFaqs() {
  const res = await fetch('/api/faqs');
  state.faqs = await res.json();
}

// ----------------------------------------------------
// TAB 1: INBOX FRESHMAN QUESTIONS
// ----------------------------------------------------
async function fetchAdminIncomingQuestions() {
  try {
    const res = await fetch('/api/admin/questions');
    const questions = await res.json();
    
    // Check if session has timed out
    if (res.status === 401) {
      handleAdminLogout();
      return;
    }
    
    document.getElementById('badge-incoming-count').textContent = questions.length;
    const container = document.getElementById('admin-questions-list');
    container.innerHTML = '';
    
    if (questions.length === 0) {
      container.innerHTML = `<div class="ask-card" style="grid-column: 1/-1"><p>ขณะนี้ยังไม่มีคำถามคงค้างเลย พี่ ๆ เคลียร์หมดจดแล้ว เก่งมากครับ!</p></div>`;
      return;
    }
    
    questions.forEach(q => {
      const card = document.createElement('div');
      card.className = "admin-inbox-card";
      const date = new Date(q.created_at).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' });
      
      card.innerHTML = `
        <div class="inbox-msg">"${q.question_text}"</div>
        <div class="inbox-meta">
          <span>น้องใหม่ผู้ไม่ประสงค์ออกนาม</span>
          <span>${date}</span>
        </div>
        <div class="inbox-actions">
          <button class="btn btn-secondary btn-sm" onclick="convertQuestionToFaq(${q.id}, \`${q.question_text.replace(/'/g, "\\'")}\`)">
            <i data-lucide="check"></i> เขียนคำตอบขึ้น FAQ
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
    console.error("Fetch questions failed", err);
  }
}

async function deleteIncomingQuestion(id) {
  if (!confirm("ต้องการละทิ้งและลบคำถามของน้องใหม่รายการนี้ใช่หรือไม่?")) return;
  const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("ลบคำถามของน้องเรียบร้อยแล้วครับ", "🗑️");
    fetchAdminIncomingQuestions();
  }
}

async function convertQuestionToFaq(questionId, questionText) {
  await openFaqEditor();
  document.getElementById('faq-editor-question').value = questionText;
  document.getElementById('faq-editor-convert-id').value = questionId;
  document.getElementById('faq-modal-title').textContent = "เขียนคำตอบเพื่อสร้าง FAQ";
}

// ----------------------------------------------------
// TAB 2: LIVE MESSAGE WALL MODERATION
// ----------------------------------------------------
async function fetchAdminPendingMessages() {
  try {
    // 1. Fetch pending welcome notes
    const res = await fetch('/api/admin/messages/pending');
    const messages = await res.json();
    
    document.getElementById('badge-pending-messages').textContent = messages.length;
    const container = document.getElementById('admin-moderation-list');
    container.innerHTML = '';
    
    if (messages.length === 0) {
      container.innerHTML = `<div class="ask-card" style="grid-column: 1/-1; background: transparent; border: 1px dashed var(--border-light);"><p>ไม่มีข้อความต้อนรับค้างตรวจเลย บอร์ดสะอาดเรียบร้อย!</p></div>`;
    } else {
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
              <i data-lucide="check-circle-2"></i> อนุมัติให้ขึ้นบอร์ด
            </button>
            <button class="btn btn-outline btn-sm btn-icon delete" onclick="deleteWallMessage(${m.id})" aria-label="Reject message">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    }

    // 2. Fetch active approved welcome notes
    const resApproved = await fetch('/api/messages/approved');
    const approvedMessages = await resApproved.json();
    
    const approvedContainer = document.getElementById('admin-approved-list');
    if (approvedContainer) {
      approvedContainer.innerHTML = '';
      if (approvedMessages.length === 0) {
        approvedContainer.innerHTML = `<div class="ask-card" style="grid-column: 1/-1; background: transparent; border: 1px dashed var(--border-light);"><p>ขณะนี้ยังไม่มีโน้ตข้อความเปิดแสดงอยู่บนหน้าบอร์ดเลย</p></div>`;
      } else {
        approvedMessages.forEach(m => {
          const card = document.createElement('div');
          card.className = "admin-mod-card";
          card.style.background = m.color_palette;
          
          card.innerHTML = `
            <div class="mod-sticker">${m.sticker}</div>
            <div class="mod-body">"${m.message}"</div>
            <div class="mod-author">- ${m.nickname}</div>
            <div class="inbox-actions" style="margin-top: 12px;">
              <button class="btn btn-outline btn-sm delete" style="color: var(--color-danger); border-color: rgba(255, 75, 75, 0.3); background: rgba(255, 75, 75, 0.05); width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;" onclick="deleteApprovedWallMessage(${m.id})">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i> สั่งถอดถอนข้อความลง
              </button>
            </div>
          `;
          approvedContainer.appendChild(card);
        });
      }
    }

    lucide.createIcons();
  } catch (err) {
    console.error("Moderation fetch failed", err);
  }
}

async function approveWallMessage(id) {
  const res = await fetch(`/api/admin/messages/${id}/approve`, { method: 'PUT' });
  if (res.ok) {
    showToast("อนุมัติการ์ดต้อนรับแล้ว! กำลังลอยเด่นบนบอร์ดของน้อง ๆ หน้าเว็บแล้วครับ", "🎉");
    fetchAdminPendingMessages();
  }
}

async function deleteWallMessage(id) {
  if (!confirm("ต้องการปฏิเสธการอนุมัติและลบโน้ตต้อนรับใบนี้ทิ้งใช่หรือไม่?")) return;
  const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("ปฏิเสธ/ลบการ์ดต้อนรับเสร็จเรียบร้อย", "🗑️");
    fetchAdminPendingMessages();
  }
}

async function deleteApprovedWallMessage(id) {
  if (!confirm("ยืนยันที่จะถอดถอนและลบการ์ดอวยพรใบนี้ออกจากหน้าบอร์ดทันทีใช่หรือไม่?")) return;
  const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("ถอดถอนข้อความต้อนรับออกจากหน้าบอร์ดสำเร็จแล้ว", "🗑️");
    fetchAdminPendingMessages();
  }
}

// ----------------------------------------------------
// TAB 3: FAQ MANAGEMENT CRUD
// ----------------------------------------------------
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

async function openFaqEditor(editFaqId = null) {
  // Ensure categories are fetched before building the dropdown select options
  if (state.categories.length === 0) {
    await fetchCategories();
  }

  const modal = document.getElementById('admin-faq-modal');
  modal.classList.add('open');
  
  const select = document.getElementById('faq-editor-category');
  select.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
  
  if (editFaqId) {
    document.getElementById('faq-modal-title').textContent = "แก้ไขการ์ดคำถาม-คำตอบ (FAQ)";
    const faq = state.faqs.find(f => f.id === editFaqId);
    document.getElementById('faq-editor-id').value = faq.id;
    document.getElementById('faq-editor-question').value = faq.question;
    document.getElementById('faq-editor-category').value = faq.category_id;
    document.getElementById('faq-editor-answer').value = faq.answer;
    document.getElementById('faq-editor-priority').value = faq.priority_score;
  } else {
    document.getElementById('faq-modal-title').textContent = "สร้างคู่มือ FAQ ใหม่";
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
    res = await fetch(`/api/admin/faqs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    if (convertId) payload.convert_question_id = parseInt(convertId);
    res = await fetch('/api/admin/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  if (res.ok) {
    closeFaqEditor();
    showToast("บันทึกข้อมูลการ์ด FAQ สำเร็จเรียบร้อย!", "💾");
    
    if (convertId) {
      switchAdminTab('questions');
    } else {
      fetchAdminFaqManagerList();
    }
  }
}

async function deleteFaq(id) {
  if (!confirm("ต้องการลบคำถามคู่มือ FAQ รายการนี้เป็นการถาวรใช่หรือไม่?")) return;
  const res = await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("ลบการ์ด FAQ เรียบร้อยแล้ว", "🗑️");
    fetchAdminFaqManagerList();
  }
}

// ----------------------------------------------------
// TAB 4: CATEGORY CONFIG CRUD
// ----------------------------------------------------
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
    document.getElementById('category-modal-title').textContent = "แก้ไขหมวดหมู่ข้อมูล";
    const cat = state.categories.find(c => c.id === editCatId);
    document.getElementById('category-editor-id').value = cat.id;
    document.getElementById('category-editor-name').value = cat.name;
    document.getElementById('category-editor-icon').value = cat.icon;
    document.getElementById('category-editor-color').value = cat.color_scheme;
  } else {
    document.getElementById('category-modal-title').textContent = "สร้างหมวดหมู่ข้อมูลใหม่";
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
    showToast("บันทึกหมวดหมู่ข้อมูลใหม่เรียบร้อย!", "💾");
    fetchAdminCategoryManagerList();
  }
}

async function deleteCategory(id) {
  if (!confirm("แจ้งเตือนสำคัญ: การลบหมวดหมู่นี้ จะเป็นการลบคำถาม FAQ ทั้งหมดที่อยู่ภายใต้หมวดหมู่นี้ด้วย! ยืนยันการลบใช่ไหม?")) return;
  const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast("ลบหมวดหมู่และคำถาม FAQ ทั้งหมดภายใต้กลุ่มนี้แล้ว", "🗑️");
    fetchAdminCategoryManagerList();
  }
}

// ----------------------------------------------------
// STARTUP ENGINE BINDINGS
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  checkAuthOnStartup();
  
  // Support administrative magic links auto logins
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get('key');
  if (key) {
    document.getElementById('admin-passkey-input').value = key;
    handleAdminAuth(null);
  }
  lucide.createIcons();
});
