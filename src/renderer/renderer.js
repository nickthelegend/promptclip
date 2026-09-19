const $ = (selector) => document.querySelector(selector);
let prompts = []; let editingId = null;
function render() { const q = $('#search').value.toLowerCase(); $('#list').innerHTML = ''; prompts.filter(p => `${p.title} ${p.body}`.toLowerCase().includes(q)).forEach(prompt => { const el = document.createElement('article'); el.className = 'card'; el.innerHTML = `<h2>${escapeHtml(prompt.title)}</h2><p>${escapeHtml(prompt.body)}</p><small>${prompt.source || 'Manual'}</small>`; el.onclick = async () => { await window.promptclip.copy(prompt.body); }; el.oncontextmenu = (event) => { event.preventDefault(); window.promptclip.menu(prompt); }; $('#list').append(el); }); }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function openEditor(prompt = {}) { editingId = prompt.id || null; $('#title').value = prompt.title || ''; $('#body').value = prompt.body || ''; $('#editor').hidden = false; $('#title').focus(); }
function closeEditor() { $('#editor').hidden = true; editingId = null; }
$('#search').oninput = render; $('#add').onclick = () => openEditor(); $('#cancel').onclick = closeEditor;
$('#editor').onsubmit = async (event) => { event.preventDefault(); await window.promptclip.save({ id: editingId, title: $('#title').value, body: $('#body').value }); closeEditor(); };
document.addEventListener('contextmenu', (event) => { if (event.target.closest('.card')) return; event.preventDefault(); window.promptclip.pickerMenu(); });
window.promptclip.onPrompts((value) => { prompts = value; render(); }); window.promptclip.onEdit(openEditor); window.promptclip.onNew(() => openEditor()); window.promptclip.onDeleteRequest((id) => { if (confirm('Delete this prompt?')) window.promptclip.remove(id); }); window.promptclip.onNotesImported((result) => { $('#status').textContent = result.error || `Imported ${result.count} Apple Notes.`; });
window.promptclip.list().then((value) => { prompts = value; render(); });
