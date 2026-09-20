const $ = (selector) => document.querySelector(selector);
let prompts = []; let editingId = null;
const tones = ['violet', 'cyan', 'amber', 'rose', 'indigo', 'lime'];
function promptTone(id = '') { return tones[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length]; }
function relativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
function createCard(prompt, isRecent) {
  const el = document.createElement('article');
  el.className = `card tone-${promptTone(prompt.id)}`;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `Copy ${prompt.title}`);
  el.innerHTML = `<div class="card-title"><h2>${escapeHtml(prompt.title)}</h2>${isRecent ? '<span class="recent-badge">Recent</span>' : ''}</div><p>${escapeHtml(prompt.body)}</p><footer><small><i aria-hidden="true"></i>${escapeHtml(prompt.source || 'Manual')}</small>${isRecent ? `<time datetime="${new Date(prompt.lastCopiedAt).toISOString()}">${relativeTime(prompt.lastCopiedAt)}</time>` : ''}</footer>`;
  const copy = async () => { await window.promptclip.copy(prompt); };
  el.onclick = copy;
  el.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copy(); } };
  el.oncontextmenu = (event) => { event.preventDefault(); window.promptclip.menu(prompt); };
  return el;
}
function addGroup(label, items, isRecent) {
  if (!items.length) return;
  const heading = document.createElement('div');
  heading.className = 'section-label';
  heading.innerHTML = `<span>${label}</span><b>${items.length}</b>`;
  $('#list').append(heading);
  items.forEach((prompt) => $('#list').append(createCard(prompt, isRecent)));
}
function render() {
  const q = $('#search').value.trim().toLowerCase();
  const matches = prompts.filter((prompt) => `${prompt.title} ${prompt.body}`.toLowerCase().includes(q));
  $('#list').innerHTML = '';
  if (q) { addGroup('Search results', matches, false); return; }
  const recent = matches.filter((prompt) => prompt.lastCopiedAt).slice(0, 5);
  const recentIds = new Set(recent.map((prompt) => prompt.id));
  addGroup('Recently copied', recent, true);
  addGroup(recent.length ? 'All prompts' : 'Prompts', matches.filter((prompt) => !recentIds.has(prompt.id)), false);
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function openEditor(prompt = {}) { editingId = prompt.id || null; $('#title').value = prompt.title || ''; $('#body').value = prompt.body || ''; $('#editor').hidden = false; $('#title').focus(); }
function closeEditor() { $('#editor').hidden = true; editingId = null; }
$('#search').oninput = render; $('#add').onclick = () => openEditor(); $('#cancel').onclick = closeEditor;
$('#import').onclick = async () => { const result = await window.promptclip.importNotes(); $('#status').textContent = result.error || (result.fallback ? `Loaded ${result.count} bundled Apple Notes prompts.` : `Imported ${result.count} Apple Notes.`); };
$('#editor').onsubmit = async (event) => { event.preventDefault(); await window.promptclip.save({ id: editingId, title: $('#title').value, body: $('#body').value }); closeEditor(); };
document.addEventListener('contextmenu', (event) => { if (event.target.closest('.card')) return; event.preventDefault(); window.promptclip.pickerMenu(); });
window.promptclip.onPrompts((value) => { prompts = value; render(); }); window.promptclip.onEdit(openEditor); window.promptclip.onNew(() => openEditor()); window.promptclip.onDeleteRequest((id) => { if (confirm('Delete this prompt?')) window.promptclip.remove(id); }); window.promptclip.onNotesImported((result) => { $('#status').textContent = result.error || `Imported ${result.count} Apple Notes.`; });
window.promptclip.list().then((value) => { prompts = value; render(); });
