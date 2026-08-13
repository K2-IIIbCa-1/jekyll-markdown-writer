import { createMarkdownEditor } from './editor.bundle.js';

const state = {
  draft: null,
  kind: 'draft',
  drafts: [],
  posts: [],
  dirty: false
};

let markdownEditor;
const LINE_WRAPPING_STORAGE_KEY = 'jekyll-writer.line-wrapping';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json();

  if (!response.ok) throw new Error(body.error || body.errors?.join('\n') || `요청 실패: ${response.status}`);

  return body;
}

function showMessages({ errors = [], warnings = [], changes = [] } = {}) {
  const container = $('#messages');
  container.replaceChildren();

  [...changes.map((message) => ({ type: 'success', message })), ...warnings.map((message) => ({ type: 'warning', message })), ...errors.map((message) => ({ type: 'error', message }))].forEach(({ type, message }) => {
    const element = document.createElement('div');
    element.className = `message ${type}`;
    element.textContent = message;
    container.append(element);
  });
}

function setSaveState(message, dirty = state.dirty) {
  $('#save-state').textContent = message;
  state.dirty = dirty;
}

function updateWordCount() {
  const content = markdownEditor?.getValue().trim() || '';
  const count = content ? content.split(/\s+/u).length : 0;
  $('#word-count').textContent = `${count} words`;
}

function getStoredLineWrapping() {
  try {
    return localStorage.getItem(LINE_WRAPPING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function storeLineWrapping(enabled) {
  try {
    localStorage.setItem(LINE_WRAPPING_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage restrictions; the editor still changes for this session.
  }
}

function renderEntryList(selector, entries, emptyText, kind) {
  const list = $(selector);
  list.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'muted small';
    empty.textContent = emptyText;
    list.append(empty);
    return;
  }

  entries.forEach((draft) => {
    const button = document.createElement('button');
    const title = document.createElement('span');
    const meta = document.createElement('span');

    button.className = `draft-item${state.kind === kind && state.draft?.name === draft.name ? ' active' : ''}`;
    button.type = 'button';
    title.className = 'draft-item-title';
    title.textContent = draft.title;
    meta.className = 'draft-item-meta';
    meta.textContent = draft.postId || draft.name;
    button.append(title, meta);
    button.addEventListener('click', () => openEntry(kind, draft.name));
    list.append(button);
  });
}

function renderDraftList() {
  renderEntryList('#draft-list', state.drafts, '아직 초안이 없습니다.', 'draft');
  renderEntryList('#post-list', state.posts, '아직 발행된 글이 없습니다.', 'post');
}

function renderEditor() {
  const hasDraft = Boolean(state.draft);

  $('#empty-state').classList.toggle('hidden', hasDraft);
  $('#editor-view').classList.toggle('hidden', !hasDraft);

  if (!hasDraft) return;

  $('#draft-id').textContent = state.draft.values.post_id || state.draft.name;
  $('#draft-title').textContent = state.draft.values.title || state.draft.name;
  markdownEditor.setValue(state.draft.content);
  $('#publish-draft').classList.toggle('hidden', state.kind !== 'draft');
  $('#save-draft').textContent = state.kind === 'post' ? 'Save changes' : 'Save';
  updateWordCount();
  setSaveState('저장됨', false);
  renderDraftList();
}

async function refreshEntries() {
  const [draftBody, postBody] = await Promise.all([api('/api/drafts'), api('/api/posts')]);
  state.drafts = draftBody.drafts;
  state.posts = postBody.posts;
  renderDraftList();
}

async function openEntry(kind, name) {
  if (state.dirty && !window.confirm('저장되지 않은 변경사항이 있습니다. 이동할까요?')) return;

  state.kind = kind;
  state.draft = await api(`/api/${kind}s/${encodeURIComponent(name)}`);
  renderEditor();
}

function openNewDraftDialog() {
  $('#new-draft-form').reset();
  $('#new-draft-dialog').showModal();
  $('#new-title').focus();
}

async function createDraft(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = await api('/api/drafts', {
    method: 'POST',
    body: JSON.stringify({
      title: form.get('title'),
      description: form.get('description'),
      categories: form.get('categories'),
      tags: form.get('tags')
    })
  });

  $('#new-draft-dialog').close();
  state.kind = 'draft';
  state.draft = result.draft;
  await refreshEntries();
  renderEditor();
}

async function saveEntry({ quiet = false } = {}) {
  if (!state.draft) return;

  const result = await api(`/api/${state.kind}s/${encodeURIComponent(state.draft.name)}/save`, {
    method: 'POST',
    body: JSON.stringify({ content: markdownEditor.getValue() })
  });

  state.draft = result[state.kind];
  $('#draft-title').textContent = state.draft.values.title || state.draft.name;
  showMessages(result);
  setSaveState('저장됨', false);
  updateWordCount();
  await refreshEntries();

  if (!quiet && result.changes?.length) window.alert(result.changes.join('\n'));
}

async function validateEntry() {
  if (!state.draft) return;

  const result = await api(`/api/${state.kind}s/${encodeURIComponent(state.draft.name)}/validate`, {
    method: 'POST',
    body: JSON.stringify({ content: markdownEditor.getValue() })
  });

  showMessages(result);
  setSaveState(result.valid ? '검사 통과' : '검사 실패', state.dirty);
}

async function publishDraft() {
  if (!state.draft || state.kind !== 'draft') return;
  if (!window.confirm('이 초안을 발행하고 _posts로 이동할까요?')) return;

  const result = await api(`/api/drafts/${encodeURIComponent(state.draft.name)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ content: markdownEditor.getValue() })
  });

  state.draft = null;
  await refreshEntries();
  renderEditor();
  window.alert(`발행되었습니다.\n${result.postName}`);
}

const SNIPPETS = {
  heading: '## 제목\n\n내용을 입력하세요.\n',
  code: '```text\n코드를 입력하세요.\n```\n',
  mermaid: '```mermaid\nflowchart LR\n  A[시작] --> B[내용]\n```\n',
  prompt: '> 내용을 입력하세요.\n{: .prompt-tip }\n',
  image: '![이미지 설명](image.png){: w="1200" h="800" }\n',
  imageNormal: '![이미지 설명](image.png){: .normal }\n',
  imageLeft: '![이미지 설명](image.png){: .w-50 .left }\n',
  imageRight: '![이미지 설명](image.png){: .w-50 .right }\n',
  table: '| 항목 | 내용 |\n| --- | --- |\n| 예시 | 입력 |\n',
  quote: '> 인용문을 입력하세요.\n',
  math: '$$\n수식을 입력하세요.\n$$\n'
};

const IMAGE_ALIGNMENTS = {
  default: '',
  normal: '{: .normal }',
  left: '{: .w-50 .left }',
  right: '{: .w-50 .right }'
};

function insertText(value) {
  markdownEditor.insertText(value);
}

async function uploadImages(event) {
  if (!state.draft) return;

  for (const file of event.target.files) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    try {
      const result = await api(`/api/${state.kind}s/${encodeURIComponent(state.draft.name)}/upload`, {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, data })
      });
      if (result.content) {
        state.draft.content = result.content;
        markdownEditor.setValue(result.content);
      }
      insertText(`${result.markdown}${IMAGE_ALIGNMENTS[$('#image-align').value] || ''}\n`);
      showMessages({ changes: [`업로드 완료: ${result.key}`] });
    } catch (uploadError) {
      showMessages({ errors: [uploadError.message] });
    }
  }

  event.target.value = '';
}

async function togglePreview() {
  const status = await api('/api/preview/status');
  const next = status.running ? await api('/api/preview/stop', { method: 'POST' }) : await api('/api/preview/start', { method: 'POST' });

  renderPreviewState(next);
}

function renderPreviewState(status) {
  $('#preview-toggle').textContent = `Preview: ${status.running ? 'running' : 'stopped'}`;
  $('#preview-toggle').classList.toggle('button-primary', status.running);
  $('#preview-toggle').classList.toggle('button-quiet', !status.running);
  $('#preview-link').href = status.url;
}

async function init() {
  const [config, preview] = await Promise.all([api('/api/config'), api('/api/preview/status')]);
  document.title = `${config.appName} — ${config.siteName}`;
  $('#app-title').textContent = config.appName;
  $('#r2-status').textContent = config.r2Configured ? `R2: ${config.r2PublicBaseUrl}` : 'R2: not configured';
  $('#r2-status').classList.toggle('ready', config.r2Configured);
  $('#r2-status').classList.toggle('error', !config.r2Configured);
  $('#image-upload').disabled = !config.r2Configured;
  $('#upload-image-control').title = config.r2Configured ? 'Upload image' : 'Configure R2 to upload images';
  $('#upload-image-control').classList.toggle('disabled', !config.r2Configured);
  renderPreviewState(preview);
  await refreshEntries();
}

const lineWrapping = getStoredLineWrapping();

markdownEditor = createMarkdownEditor({
  parent: $('#content'),
  wrapLines: lineWrapping,
  onChange: () => {
    setSaveState('변경됨', true);
    updateWordCount();
  },
  onSave: () => saveEntry().catch((error) => showMessages({ errors: [error.message] }))
});

$('#line-wrapping').checked = lineWrapping;
$('#line-wrapping').addEventListener('change', (event) => {
  const enabled = event.target.checked;
  markdownEditor.setLineWrapping(enabled);
  storeLineWrapping(enabled);
});

$('#new-draft').addEventListener('click', openNewDraftDialog);
$('#new-draft-empty').addEventListener('click', openNewDraftDialog);
$('#close-dialog').addEventListener('click', () => $('#new-draft-dialog').close());
$('#cancel-dialog').addEventListener('click', () => $('#new-draft-dialog').close());
$('#new-draft-form').addEventListener('submit', (event) => {
  if (event.submitter?.id === 'create-draft') createDraft(event).catch((error) => showMessages({ errors: [error.message] }));
});
$('#save-draft').addEventListener('click', () => saveEntry().catch((error) => showMessages({ errors: [error.message] })));
$('#validate-draft').addEventListener('click', () => validateEntry().catch((error) => showMessages({ errors: [error.message] })));
$('#publish-draft').addEventListener('click', () => publishDraft().catch((error) => showMessages({ errors: [error.message] })));
$('#preview-toggle').addEventListener('click', () => togglePreview().catch((error) => showMessages({ errors: [error.message] })));
$('#image-upload').addEventListener('change', (event) => uploadImages(event));
$$('.snippet-button[data-snippet]').forEach((button) => button.addEventListener('click', () => insertText(SNIPPETS[button.dataset.snippet])));

init().catch((error) => showMessages({ errors: [error.message] }));
