import { createMarkdownEditor } from './editor.bundle.js';
import { renderIcons } from './icons.js';

const state = {
  draft: null,
  kind: 'draft',
  drafts: [],
  posts: [],
  dirty: false,
  ai: {
    provider: 'openai',
    model: '',
    endpoint: '',
    apiKey: '',
    rememberApiKey: false
  },
  aiConfigured: false
};

let markdownEditor;
let imageUploadAlignment = 'default';
const LINE_WRAPPING_STORAGE_KEY = 'jekyll-writer.line-wrapping';
const AI_SETTINGS_STORAGE_KEY = 'jekyll-writer.ai-settings';
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

function renderGitStatus(status) {
  const panel = $('#git-panel');
  const details = $('#git-details');
  const summary = $('#git-summary');
  const commit = $('#git-commit');
  const push = $('#git-push');

  panel.classList.remove('hidden');
  summary.textContent = status.configured ? `${status.branch || 'detached'} · ${status.remote || 'no origin'}` : 'not configured';
  details.textContent = status.configured
    ? `${status.message}\n${status.entries.length ? status.entries.map((entry) => entry.summary).join('\n') : 'working tree clean'}`
    : status.message;
  commit.disabled = !status.canCommit;
  push.disabled = !status.canPush;
}

async function refreshGitStatus({ show = true } = {}) {
  const status = await api('/api/git/status');
  if (show) renderGitStatus(status);
  return status;
}

async function commitGit() {
  const status = await refreshGitStatus();
  if (!status.canCommit) return;

  const message = window.prompt('커밋 메시지를 입력하세요.', 'feat(post): publish article');
  if (!message?.trim()) return;

  const result = await api('/api/git/commit', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
  renderGitStatus(result.status);
  showMessages({ changes: [result.message] });
}

async function pushGit() {
  const status = await refreshGitStatus();
  if (!status.canPush) return;
  if (!window.confirm(`현재 브랜치 ${status.branch || '(detached)'}를 origin으로 Push할까요?`)) return;

  const result = await api('/api/git/push', { method: 'POST' });
  renderGitStatus(result.status);
  showMessages({ changes: [result.message] });
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

function readAiSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function saveAiSettings() {
  const settings = {
    provider: $('#ai-provider').value,
    model: $('#ai-model').value.trim(),
    endpoint: $('#ai-endpoint').value.trim(),
    rememberApiKey: $('#ai-remember-key').checked
  };

  state.ai = {
    ...settings,
    apiKey: $('#ai-api-key').value
  };

  try {
    const stored = settings.rememberApiKey && state.ai.apiKey
      ? { ...settings, apiKey: state.ai.apiKey }
      : settings;
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage restrictions; the current editor session still works.
  }
}

function initializeAiSettings(config) {
  const stored = readAiSettings();
  const rememberApiKey = stored.rememberApiKey === true;

  state.aiConfigured = config.aiConfigured === true;
  state.ai = {
    provider: stored.provider || config.aiProvider || 'openai',
    model: stored.model || config.aiModel || '',
    endpoint: stored.endpoint || config.aiEndpoint || '',
    apiKey: rememberApiKey ? String(stored.apiKey || '') : '',
    rememberApiKey
  };

  $('#ai-provider').value = state.ai.provider;
  $('#ai-model').value = state.ai.model;
  $('#ai-endpoint').value = state.ai.endpoint;
  $('#ai-api-key').value = state.ai.apiKey;
  $('#ai-remember-key').checked = state.ai.rememberApiKey;
  $('#ai-env-status').textContent = state.aiConfigured
    ? 'API key from .env will be used when this field is blank.'
    : 'No AI_API_KEY found in .env. Enter a key or configure one before generating.';
  $('#ai-description-status').textContent = '';
  $('#ai-description-status').className = 'muted small';
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
    const row = document.createElement('div');
    const button = document.createElement('button');
    const title = document.createElement('span');
    const meta = document.createElement('span');

    const active = state.kind === kind && state.draft?.name === draft.name;
    row.className = `draft-item-row${kind === 'draft' ? ' has-delete' : ''}${active ? ' active' : ''}`;
    button.className = 'draft-item';
    button.type = 'button';
    title.className = 'draft-item-title';
    title.textContent = draft.title;
    meta.className = 'draft-item-meta';
    meta.textContent = draft.postId || draft.name;
    button.append(title, meta);
    button.addEventListener('click', () => openEntry(kind, draft.name));
    row.append(button);

    if (kind === 'draft') {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'icon-button draft-delete';
      deleteButton.type = 'button';
      deleteButton.title = 'Delete draft';
      deleteButton.setAttribute('aria-label', `Delete draft: ${draft.title}`);
      deleteButton.append(createIcon('trash'));
      deleteButton.addEventListener('click', () => deleteDraft(draft.name, draft.title).catch((error) => showMessages({ errors: [error.message] })));
      row.append(deleteButton);
    }

    list.append(row);
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
  setSidebarOpen(false);
  state.draft = await api(`/api/${kind}s/${encodeURIComponent(name)}`);
  renderEditor();
}

async function deleteDraft(name, title) {
  const isCurrent = state.kind === 'draft' && state.draft?.name === name;
  const warning = isCurrent && state.dirty
    ? '\n\n저장되지 않은 변경사항도 함께 사라집니다.'
    : '';

  if (!window.confirm(`"${title}" 초안을 삭제할까요?${warning}`)) return;

  await api(`/api/drafts/${encodeURIComponent(name)}`, { method: 'DELETE' });

  if (isCurrent) {
    state.draft = null;
    state.dirty = false;
    renderEditor();
  }

  await refreshEntries();
  showMessages({ changes: ['Draft deleted.'] });
}

function openNewDraftDialog() {
  setSidebarOpen(false);
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

const MARKUP_FORMATS = {
  bold: { prefix: '**', suffix: '**' },
  italic: { prefix: '*', suffix: '*' },
  strike: { prefix: '~~', suffix: '~~' }
};

function closePalettes() {
  $$('.palette-menu').forEach((menu) => {
    menu.hidden = true;
    menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
}

function togglePalette(button) {
  const menu = document.getElementById(button.getAttribute('aria-controls'));
  const shouldOpen = menu.hidden;
  closePalettes();
  menu.hidden = !shouldOpen;
  button.setAttribute('aria-expanded', String(shouldOpen));
}

function insertPrompt(type) {
  const prompt = SNIPPETS.prompt.replace('prompt-tip', `prompt-${type}`);
  insertText(prompt);
  closePalettes();
}

function applyFormatting(formatter) {
  if (!formatter()) {
    showMessages({ warnings: ['Formatting is unavailable inside fenced code blocks.'] });
  }
}

function quoteLiquid(value) {
  return JSON.stringify(String(value ?? '').trim());
}

function openDialog(id) {
  const dialog = $(`#${id}`);
  if (!dialog.open) dialog.showModal();
}

function insertCodeBlock(event) {
  if (event.submitter?.id !== 'insert-code') return;

  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const language = String(form.get('language') || 'plaintext').trim().replace(/[^A-Za-z0-9_+#.-]/gu, '') || 'plaintext';
  const file = String(form.get('file') || '').trim();
  const attributes = [];

  if (file) attributes.push(`file=${quoteLiquid(file)}`);
  if (form.get('noLineNumbers') === 'on') attributes.push('.nolineno');

  const suffix = attributes.length ? `{: ${attributes.join(' ')} }\n` : '';
  insertText(`\`\`\`${language}\n코드를 입력하세요.\n\`\`\`\n${suffix}`);
  $('#code-dialog').close();
}

function youtubeId(source) {
  const value = String(source || '').trim();
  if (/^[A-Za-z0-9_-]{6,}$/u.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || '';
    }
  } catch {
    return '';
  }

  return '';
}

function updateMediaDialog() {
  const type = $('#media-type').value;
  $('#media-source').placeholder = type === 'youtube'
    ? 'https://youtu.be/VIDEO_ID'
    : type === 'audio'
      ? 'https://example.com/audio.mp3'
      : 'https://example.com/video.mp4';
  $('#media-title-label').classList.toggle('hidden', type === 'youtube');
  $('#media-title').classList.toggle('hidden', type === 'youtube');
  $('#video-options').classList.toggle('hidden', type !== 'video');
}

function insertMedia(event) {
  if (event.submitter?.id !== 'insert-media') return;

  event.preventDefault();
  const type = $('#media-type').value;
  const source = $('#media-source').value.trim();
  const title = $('#media-title').value.trim();
  if (!source) return;

  if (type === 'youtube') {
    const id = youtubeId(source);
    if (!id) {
      showMessages({ warnings: ['YouTube URL 또는 영상 ID를 확인하세요.'] });
      return;
    }
    insertText(`{% include embed/youtube.html id=${quoteLiquid(id)} %}\n`);
  } else if (type === 'audio') {
    insertText(`{% include embed/audio.html src=${quoteLiquid(source)}${title ? ` title=${quoteLiquid(title)}` : ''} %}\n`);
  } else {
    const options = ['autoplay', 'loop', 'muted']
      .filter((name) => $(`#media-${name}`).checked)
      .map((name) => `${name}=true`)
      .join(' ');
    insertText(`{% include embed/video.html src=${quoteLiquid(source)}${title ? ` title=${quoteLiquid(title)}` : ''}${options ? ` ${options}` : ''} %}\n`);
  }

  if (parseFrontMatterForEditor().render_with_liquid === false) {
    showMessages({ warnings: ['Liquid 렌더링이 꺼져 있어 이 미디어가 미리보기에서 표시되지 않을 수 있습니다. Post settings에서 활성화하세요.'] });
  }

  $('#media-dialog').close();
}

function parseFrontMatterForEditor() {
  const match = markdownEditor.getValue().match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  const values = { ...(state.draft?.values || {}) };
  if (!match) return values;

  const lines = match[1].split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/u);
    if (!field) continue;
    const value = field[2].trim();
    if (!value && index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
      const nested = {};
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        const nestedField = lines[index].match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/u);
        if (!nestedField) continue;
        const nestedValue = nestedField[2].trim();
        nested[nestedField[1]] = nestedValue === 'true'
          ? true
          : nestedValue === 'false'
            ? false
            : nestedValue.replace(/^['"]|['"]$/gu, '');
      }
      values[field[1]] = nested;
      continue;
    }
    if (/^[>|][-+]?$/u.test(value)) {
      const continuation = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        continuation.push(lines[index].trim());
      }
      values[field[1]] = continuation.join(' ');
      continue;
    }
    if (value === 'true' || value === 'false') values[field[1]] = value === 'true';
    else if (value.startsWith('[') && value.endsWith(']')) values[field[1]] = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/gu, '')).filter(Boolean);
    else values[field[1]] = value.replace(/^['"]|['"]$/gu, '');
  }

  return values;
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function openFrontMatterDialog() {
  if (!state.draft) return;
  const values = parseFrontMatterForEditor();
  const image = values.image && typeof values.image === 'object'
    ? values.image
    : { path: typeof values.image === 'string' ? values.image : '' };
  $('#front-description').value = values.description || '';
  $('#front-categories').value = Array.isArray(values.categories) ? values.categories.join(', ') : values.categories || '';
  $('#front-tags').value = Array.isArray(values.tags) ? values.tags.join(', ') : values.tags || '';
  $('#front-image-path').value = image.path || '';
  $('#front-image-alt').value = image.alt || '';
  $('#front-image-no-bg').checked = image.no_bg === true;
  $('#ai-provider').value = state.ai.provider;
  $('#ai-model').value = state.ai.model;
  $('#ai-endpoint').value = state.ai.endpoint;
  $('#ai-api-key').value = state.ai.apiKey;
  $('#ai-remember-key').checked = state.ai.rememberApiKey;
  $('#front-pin').checked = values.pin === true;
  $('#front-toc').checked = values.toc !== false;
  $('#front-comments').checked = values.comments !== false;
  $('#front-math').checked = values.math === true;
  $('#front-mermaid').checked = values.mermaid === true;
  $('#front-liquid').checked = values.render_with_liquid === false;
  updateAiProviderFields();
  openDialog('front-matter-dialog');
}

function updateAiProviderFields() {
  const compatible = $('#ai-provider').value === 'compatible';
  $('#ai-endpoint-label').classList.toggle('hidden', !compatible);
  $('#ai-endpoint').classList.toggle('hidden', !compatible);
}

function setAiDescriptionStatus(message, type = '') {
  const status = $('#ai-description-status');
  status.textContent = message;
  status.className = `muted small ai-description-status${type ? ` ${type}` : ''}`;
}

async function generateDescription() {
  if (!state.draft) return;

  const button = $('#generate-description');
  button.disabled = true;
  button.textContent = 'Generating...';
  setAiDescriptionStatus('Generating...');

  try {
    const result = await api('/api/ai/description', {
      method: 'POST',
      body: JSON.stringify({
        provider: $('#ai-provider').value,
        apiKey: $('#ai-api-key').value,
        model: $('#ai-model').value,
        endpoint: $('#ai-endpoint').value,
        content: markdownEditor.getValue()
      })
    });
    $('#front-description').value = result.description;
    setAiDescriptionStatus('Description generated. Review it before applying.', 'success');
    showMessages({ changes: ['Description generated. Review it before applying.'] });
  } catch (error) {
    setAiDescriptionStatus(error.message, 'error');
    showMessages({ errors: [error.message] });
  } finally {
    button.disabled = false;
    button.textContent = 'Auto generate';
    saveAiSettings();
  }
}

function applyFrontMatter(event) {
  if (event.submitter?.id !== 'save-front-matter') return;

  event.preventDefault();
  const imagePath = $('#front-image-path').value.trim();
  const updates = {
    description: $('#front-description').value.trim(),
    categories: splitList($('#front-categories').value),
    tags: splitList($('#front-tags').value),
    image: imagePath
      ? { path: imagePath, alt: $('#front-image-alt').value.trim(), no_bg: $('#front-image-no-bg').checked }
      : null,
    pin: $('#front-pin').checked,
    toc: $('#front-toc').checked,
    comments: $('#front-comments').checked,
    math: $('#front-math').checked,
    mermaid: $('#front-mermaid').checked,
    render_with_liquid: !$('#front-liquid').checked
  };

  if (!markdownEditor.updateFrontMatter(updates)) {
    showMessages({ errors: ['Front matter를 찾을 수 없습니다.'] });
    return;
  }
  if (updates.render_with_liquid === false && /\{%\s*include\s+embed\//iu.test(markdownEditor.getValue())) {
    showMessages({ warnings: ['Liquid 렌더링을 끄면 미디어 임베드도 표시되지 않습니다.'] });
  }
  saveAiSettings();
  $('#front-matter-dialog').close();
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
      const alignment = result.mediaType === 'image'
        ? IMAGE_ALIGNMENTS[imageUploadAlignment] || ''
        : '';
      insertText(`${result.markdown}${alignment}\n`);
      showMessages({ changes: [`업로드 완료: ${result.key}`] });
    } catch (uploadError) {
      showMessages({ errors: [uploadError.message] });
    }
  }

  event.target.value = '';
}

async function uploadPreviewImage(event) {
  if (!state.draft || !event.target.files[0]) return;

  const file = event.target.files[0];
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await api(`/api/${state.kind}s/${encodeURIComponent(state.draft.name)}/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileName: file.name, contentType: file.type, data })
    });
    $('#front-image-path').value = result.url;
    showMessages({ changes: [`Preview image uploaded: ${result.key}`] });
  } catch (uploadError) {
    showMessages({ errors: [uploadError.message] });
  } finally {
    event.target.value = '';
  }
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
  $('#upload-image-control').title = config.r2Configured ? 'Upload image or video' : 'Configure R2 to upload media';
  $('#upload-image-control').classList.toggle('disabled', !config.r2Configured);
  $('#front-image-upload-control').title = config.r2Configured ? 'Upload preview image' : 'Configure R2 to upload preview images';
  $('#front-image-upload-control').classList.toggle('disabled', !config.r2Configured);
  $('#front-image-upload').disabled = !config.r2Configured;
  initializeAiSettings(config);
  try {
    await refreshGitStatus();
  } catch (error) {
    showMessages({ warnings: [`Git 상태를 읽을 수 없습니다: ${error.message}`] });
  }
  renderPreviewState(preview);
  await refreshEntries();
}

const lineWrapping = getStoredLineWrapping();

function setSidebarOpen(open) {
  document.body.classList.toggle('sidebar-open', open);
  $('#sidebar-toggle').setAttribute('aria-expanded', String(open));
}

function createIcon(name) {
  const container = document.createElement('span');
  const iconTarget = document.createElement('span');

  iconTarget.dataset.icon = name;
  container.append(iconTarget);
  renderIcons(container);
  return iconTarget.firstElementChild || iconTarget;
}

markdownEditor = createMarkdownEditor({
  parent: $('#content'),
  wrapLines: lineWrapping,
  onChange: () => {
    setSaveState('변경됨', true);
    updateWordCount();
  },
  onSave: () => saveEntry({ quiet: true }).catch((error) => showMessages({ errors: [error.message] }))
});

$('#line-wrapping').checked = lineWrapping;
$('#line-wrapping').addEventListener('change', (event) => {
  const enabled = event.target.checked;
  markdownEditor.setLineWrapping(enabled);
  storeLineWrapping(enabled);
});

$('#sidebar-toggle').addEventListener('click', () => {
  setSidebarOpen(!document.body.classList.contains('sidebar-open'));
});
$('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));

$('#new-draft').addEventListener('click', openNewDraftDialog);
$('#new-draft-empty').addEventListener('click', openNewDraftDialog);
$('#close-dialog').addEventListener('click', () => $('#new-draft-dialog').close());
$('#cancel-dialog').addEventListener('click', () => $('#new-draft-dialog').close());
$('#new-draft-form').addEventListener('submit', (event) => {
  if (event.submitter?.id === 'create-draft') createDraft(event).catch((error) => showMessages({ errors: [error.message] }));
});
$('#code-form').addEventListener('submit', insertCodeBlock);
$('#media-form').addEventListener('submit', insertMedia);
$('#front-matter-form').addEventListener('submit', applyFrontMatter);
$('#ai-provider').addEventListener('change', () => {
  updateAiProviderFields();
  saveAiSettings();
});
$('#ai-model').addEventListener('input', saveAiSettings);
$('#ai-endpoint').addEventListener('input', saveAiSettings);
$('#ai-api-key').addEventListener('input', () => {
  if ($('#ai-remember-key').checked) saveAiSettings();
});
$('#ai-remember-key').addEventListener('change', () => {
  saveAiSettings();
});
$('#generate-description').addEventListener('click', () => generateDescription());
$('#media-type').addEventListener('change', updateMediaDialog);
$$('[data-action="code-block"]').forEach((button) => button.addEventListener('click', () => {
  $('#code-form').reset();
  $('#code-language').value = 'plaintext';
  openDialog('code-dialog');
}));
$$('[data-action="media"]').forEach((button) => button.addEventListener('click', () => {
  $('#media-form').reset();
  updateMediaDialog();
  openDialog('media-dialog');
}));
$$('[data-action="front-matter"]').forEach((button) => button.addEventListener('click', openFrontMatterDialog));
$('#save-draft').addEventListener('click', () => saveEntry().catch((error) => showMessages({ errors: [error.message] })));
$('#validate-draft').addEventListener('click', () => validateEntry().catch((error) => showMessages({ errors: [error.message] })));
$('#publish-draft').addEventListener('click', () => publishDraft().catch((error) => showMessages({ errors: [error.message] })));
$('#preview-toggle').addEventListener('click', () => togglePreview().catch((error) => showMessages({ errors: [error.message] })));
$('#git-status').addEventListener('click', () => refreshGitStatus().catch((error) => showMessages({ errors: [error.message] })));
$('#git-commit').addEventListener('click', () => commitGit().catch((error) => showMessages({ errors: [error.message] })));
$('#git-push').addEventListener('click', () => pushGit().catch((error) => showMessages({ errors: [error.message] })));
$('#image-upload').addEventListener('change', (event) => uploadImages(event));
$('#front-image-upload').addEventListener('change', (event) => uploadPreviewImage(event));
$$('.snippet-button[data-snippet]').forEach((button) => button.addEventListener('click', () => insertText(SNIPPETS[button.dataset.snippet])));
$$('[data-action="footnote"]').forEach((button) => button.addEventListener('click', () => {
  if (!markdownEditor.insertFootnote()) {
    showMessages({ warnings: ['Footnotes are unavailable inside fenced code blocks.'] });
  }
}));
$$('.image-align-button').forEach((button) => button.addEventListener('click', () => {
  imageUploadAlignment = button.dataset.imageAlign;
  $$('.image-align-button').forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
}));
$$('.format-button[data-format]').forEach((button) => button.addEventListener('click', () => {
  applyFormatting(() => markdownEditor.toggleDelimited(MARKUP_FORMATS[button.dataset.format]));
}));
$$('.palette-toggle').forEach((button) => button.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePalette(button);
}));
$$('.palette-swatch').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.promptType) {
    insertPrompt(button.dataset.promptType);
    return;
  }

  applyFormatting(() => markdownEditor.toggleHtmlClass({ tag: button.dataset.tag, className: button.dataset.className }));
  closePalettes();
}));
document.addEventListener('click', (event) => {
  if (!event.target.closest('.palette-control')) closePalettes();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePalettes();
});

renderIcons();
init().catch((error) => showMessages({ errors: [error.message] }));
