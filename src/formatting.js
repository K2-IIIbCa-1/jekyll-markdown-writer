const CLASS_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const TAG_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/u;

function change(from, to, insert, selectionFrom, selectionTo) {
  return {
    from,
    to,
    insert,
    selectionFrom,
    selectionTo
  };
}

export function isInsideFencedCode(source, position) {
  let fence = null;

  for (const line of source.slice(0, position).split('\n')) {
    const match = line.match(/^\s*(`{3,}|~{3,})/u);
    if (!match) continue;

    const marker = match[1][0];
    const length = match[1].length;
    if (!fence) {
      fence = { marker, length };
    } else if (fence.marker === marker && length >= fence.length) {
      fence = null;
    }
  }

  return Boolean(fence);
}

function isRangeInsideFencedCode(source, from, to) {
  return isInsideFencedCode(source, from) || isInsideFencedCode(source, Math.max(from, to - 1));
}

export function toggleDelimited(source, from, to, prefix, suffix, placeholder = 'text') {
  if (isRangeInsideFencedCode(source, from, to)) return null;

  const selected = source.slice(from, to);
  const before = source.slice(Math.max(0, from - prefix.length), from);
  const after = source.slice(to, to + suffix.length);

  if (before === prefix && after === suffix) {
    const start = from - prefix.length;
    return change(start, to + suffix.length, selected, start, start + selected.length);
  }

  if (selected.length >= prefix.length + suffix.length && selected.startsWith(prefix) && selected.endsWith(suffix)) {
    const inner = selected.slice(prefix.length, -suffix.length);
    return change(from, to, inner, from, from + inner.length);
  }

  const value = selected || placeholder;
  const insert = `${prefix}${value}${suffix}`;
  const selectionFrom = from + prefix.length;
  return change(from, to, insert, selectionFrom, selectionFrom + value.length);
}

export function toggleHtmlClass(source, from, to, { tag, className, placeholder = 'text' }) {
  if (isRangeInsideFencedCode(source, from, to)) return null;

  if (!TAG_NAME_PATTERN.test(tag) || !CLASS_NAME_PATTERN.test(className)) {
    throw new Error('Invalid inline formatting name');
  }

  const selected = source.slice(from, to);
  const open = `<${tag} class="${className}">`;
  const close = `</${tag}>`;
  const classPattern = '([A-Za-z][A-Za-z0-9_-]*)';
  const beforePattern = new RegExp(`<${tag} class="${classPattern}">$`, 'u');
  const afterPattern = new RegExp(`^${close}`, 'u');
  const beforeMatch = source.slice(0, from).match(beforePattern);
  const afterMatch = source.slice(to).match(afterPattern);

  if (beforeMatch && afterMatch) {
    const start = from - beforeMatch[0].length;
    const end = to + close.length;

    if (beforeMatch[1] === className) {
      return change(start, end, selected, start, start + selected.length);
    }

    const insert = `${open}${selected}${close}`;
    const selectionFrom = start + open.length;
    return change(start, end, insert, selectionFrom, selectionFrom + selected.length);
  }

  const selectedPattern = new RegExp(`^<${tag} class="${classPattern}">([\\s\\S]*)</${tag}>$`, 'u');
  const selectedMatch = selected.match(selectedPattern);

  if (selectedMatch) {
    const inner = selectedMatch[2];

    if (selectedMatch[1] === className) {
      return change(from, to, inner, from, from + inner.length);
    }

    const insert = `${open}${inner}${close}`;
    const selectionFrom = from + open.length;
    return change(from, to, insert, selectionFrom, selectionFrom + inner.length);
  }

  const value = selected || placeholder;
  const insert = `${open}${value}${close}`;
  const selectionFrom = from + open.length;
  return change(from, to, insert, selectionFrom, selectionFrom + value.length);
}

export function insertFootnote(source, from, to) {
  if (isRangeInsideFencedCode(source, from, to)) return null;

  const labels = new Set([...source.matchAll(/\[\^([^\]\s]+)\]/gu)].map((match) => match[1]));
  let index = 1;
  let label = `fn-${index}`;

  while (labels.has(label)) {
    index += 1;
    label = `fn-${index}`;
  }

  const reference = `[^${label}]`;
  const definition = source.endsWith('\n\n')
    ? `[^${label}]: `
    : source.endsWith('\n')
      ? `\n[^${label}]: `
      : `\n\n[^${label}]: `;
  const changes = [
    { from, to, insert: reference },
    { from: source.length, to: source.length, insert: definition }
  ];

  return {
    label,
    changes: to === source.length
      ? [{ from, to, insert: `${reference}${definition}` }]
      : changes,
    selection: source.length - (to - from) + reference.length + definition.length
  };
}

function formatFrontMatterValue(value) {
  if (Array.isArray(value)) return `[${value.map((item) => JSON.stringify(String(item))).join(', ')}]`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return JSON.stringify(String(value ?? ''));
}

function appendFrontMatterField(lines, key, value) {
  if (value === null) return;

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    lines.push(`${key}:`);
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      lines.push(`  ${nestedKey}: ${formatFrontMatterValue(nestedValue)}`);
    }
    return;
  }

  lines.push(`${key}: ${formatFrontMatterValue(value)}`);
}

export function updateFrontMatter(source, updates) {
  const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/u);
  const pending = new Map(Object.entries(updates));
  const nextLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^([A-Za-z_][\w-]*):\s*(.*)$/u);
    const key = field?.[1];

    if (!key || !pending.has(key)) {
      nextLines.push(lines[index]);
      continue;
    }

    const value = pending.get(key);
    pending.delete(key);

    if (value === null) {
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) index += 1;
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = new Map(Object.entries(value));
      nextLines.push(`${key}:`);

      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        const nestedField = lines[index].match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/u);
        if (!nestedField || !nested.has(nestedField[1])) {
          nextLines.push(lines[index]);
          continue;
        }

        nextLines.push(`  ${nestedField[1]}: ${formatFrontMatterValue(nested.get(nestedField[1]))}`);
        nested.delete(nestedField[1]);
      }

      for (const [nestedKey, nestedValue] of nested) appendFrontMatterField(nextLines, `  ${nestedKey}`, nestedValue);
      continue;
    }

    nextLines.push(`${key}: ${formatFrontMatterValue(value)}`);

    if (/^[>|][-+]?$/u.test(field[2].trim())) {
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) index += 1;
    }
  }

  for (const [key, value] of pending) appendFrontMatterField(nextLines, key, value);

  return `---\n${nextLines.join('\n')}\n---\n${String(source).slice(match[0].length)}`;
}

const MEDIA_TAB_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/u;
const MEDIA_TAB_TYPES = new Set(['image', 'video', 'audio']);

function yamlString(value) {
  return JSON.stringify(String(value ?? '').trim());
}

function unquoteYamlString(value) {
  const trimmed = String(value || '').trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed.replace(/^['"]|['"]$/gu, '');
}

function mediaTabGroupLines(group) {
  const groupId = String(group?.id || '').trim();
  const tabs = Array.isArray(group?.tabs) ? group.tabs : [];

  if (!MEDIA_TAB_ID_PATTERN.test(groupId)) return { error: '미디어 탭 그룹 ID는 영문/숫자/_/-로 입력하세요.' };
  if (!tabs.length) return { error: '미디어 탭을 하나 이상 추가하세요.' };

  const normalizedTabs = [];
  const tabIds = new Set();

  for (const tab of tabs) {
    const id = String(tab?.id || '').trim();
    const type = String(tab?.type || '').trim().toLowerCase();
    const src = String(tab?.src || '').trim();

    if (!MEDIA_TAB_ID_PATTERN.test(id)) return { error: '각 탭의 ID는 영문/숫자/_/-로 입력하세요.' };
    if (tabIds.has(id.toLowerCase())) return { error: `탭 ID가 중복됩니다: ${id}` };
    if (!MEDIA_TAB_TYPES.has(type)) return { error: `지원하지 않는 미디어 유형입니다: ${type || '(없음)'}` };
    if (!src) return { error: `탭의 미디어 URL을 입력하세요: ${id}` };

    tabIds.add(id.toLowerCase());
    normalizedTabs.push({ ...tab, id, type, src });
  }

  const requestedDefault = String(group.default || '').trim();
  const defaultTab = normalizedTabs.find((tab) => tab.id === requestedDefault)?.id || normalizedTabs[0].id;
  const lines = [
    `  - id: ${yamlString(groupId)}`,
    `    default: ${yamlString(defaultTab)}`,
    '    tabs:'
  ];

  normalizedTabs.forEach((tab) => {
    lines.push(`      - id: ${yamlString(tab.id)}`);
    lines.push(`        type: ${yamlString(tab.type)}`);
    if (tab.label) lines.push(`        label: ${yamlString(tab.label)}`);
    lines.push(`        src: ${yamlString(tab.src)}`);
    if (tab.alt) lines.push(`        alt: ${yamlString(tab.alt)}`);
    if (tab.caption) lines.push(`        caption: ${yamlString(tab.caption)}`);
    if (tab.poster && tab.type === 'video') lines.push(`        poster: ${yamlString(tab.poster)}`);
    if (tab.video_type && tab.type === 'video') lines.push(`        video_type: ${yamlString(tab.video_type)}`);
    if (tab.audio_type && tab.type === 'audio') lines.push(`        audio_type: ${yamlString(tab.audio_type)}`);
  });

  return { groupId, lines };
}

export function insertMediaTabGroup(source, group) {
  const match = String(source).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!match) return { content: null, error: 'Front matter를 찾을 수 없습니다.' };

  const generated = mediaTabGroupLines(group);
  if (generated.error) return { content: null, error: generated.error };

  const lines = match[1].split(/\r?\n/u);
  const groupIndex = lines.findIndex((line) => /^media_tab_groups:\s*$/u.test(line));
  const inlineGroupIndex = lines.findIndex((line) => /^media_tab_groups:\s+\S/u.test(line));

  if (inlineGroupIndex >= 0) {
    return { content: null, error: '기존 media_tab_groups가 인라인 형식이라 자동으로 추가할 수 없습니다.' };
  }

  let insertAt;

  if (groupIndex < 0) {
    insertAt = lines.length;
    while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt -= 1;
    lines.splice(insertAt, 0, 'media_tab_groups:', ...generated.lines);
  } else {
    insertAt = groupIndex + 1;
    let groupItemIndent = null;

    while (insertAt < lines.length && /^\s+/.test(lines[insertAt])) {
      const item = lines[insertAt].match(/^(\s*)-\s+id:\s*(.+)$/u);
      if (item && groupItemIndent === null) groupItemIndent = item[1].length;
      if (item && item[1].length === groupItemIndent && unquoteYamlString(item[2]) === generated.groupId) {
        return { content: null, error: `이미 존재하는 미디어 탭 그룹입니다: ${generated.groupId}` };
      }
      insertAt += 1;
    }

    lines.splice(insertAt, 0, ...generated.lines);
  }

  return {
    content: `---\n${lines.join('\n')}\n---\n${String(source).slice(match[0].length)}`,
    error: ''
  };
}
