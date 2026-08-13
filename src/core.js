import path from 'node:path';

export const SEOUL_TIME_ZONE = 'Asia/Seoul';

function formatDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value])
  );
}

export function timestamp(date = new Date()) {
  const parts = formatDateParts(date);
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const clock = `${parts.hour}:${parts.minute}:${parts.second}`;

  return {
    date: day,
    clock,
    postId: `${day}_${parts.hour}${parts.minute}${parts.second}`,
    frontMatterDate: `${day} ${clock} +0900`
  };
}

export function slugify(value) {
  const slug = String(value)
    .normalize('NFKC')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return slug;
}

export function safeFileName(value, fallback = 'image') {
  const original = path.basename(String(value || ''));
  const extension = path.extname(original).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = slugify(path.basename(original, path.extname(original))) || fallback;

  return `${base}${extension}`;
}

function parseScalar(value) {
  const trimmed = value.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === '~') return null;

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return trimmed.replace(/^['"]|['"]$/g, '');
}

export function parseFrontMatter(content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

  if (!match) {
    return { valid: false, values: {}, header: '', body: String(content), start: 0, end: 0 };
  }

  const values = {};
  const lines = match[1].split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);

    if (!field) continue;

    const rawValue = field[2].trim();

    if (!rawValue && index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
      const nested = {};

      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        const nestedField = lines[index].match(/^\s+([A-Za-z_][\w-]*):\s*(.*)$/);
        if (nestedField) nested[nestedField[1]] = parseScalar(nestedField[2]);
      }

      values[field[1]] = nested;
      continue;
    }

    if (/^[>|][-+]?$/.test(rawValue)) {
      const continuation = [];

      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        continuation.push(lines[index].trim());
      }

      values[field[1]] = continuation.join(' ');
      continue;
    }

    values[field[1]] = parseScalar(rawValue);
  }

  return {
    valid: true,
    values,
    header: match[1],
    body: String(content).slice(match[0].length),
    start: 0,
    end: match[0].length
  };
}

function formatYamlValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

export function setFrontMatterValue(content, key, value) {
  const parsed = parseFrontMatter(content);

  if (!parsed.valid) return content;

  const lines = parsed.header.split(/\r?\n/);
  const fieldLine = `${key}: ${formatYamlValue(value)}`;
  const fieldIndex = lines.findIndex((line) => line.startsWith(`${key}:`));

  if (fieldIndex >= 0) {
    lines[fieldIndex] = fieldLine;
  } else {
    lines.push(fieldLine);
  }

  return `---\n${lines.join('\n')}\n---\n${parsed.body}`;
}

export function normalizeContent(content) {
  let normalized = String(content);
  const parsed = parseFrontMatter(normalized);
  const warnings = [];
  const changes = [];

  if (!parsed.valid) {
    return { content: normalized, warnings, changes };
  }

  const requirements = [
    { key: 'mermaid', pattern: /(^|\n)```mermaid\b/i, label: 'Mermaid', value: true },
    { key: 'math', pattern: /\$\$|\\begin\{(?:equation|align|gather)/, label: 'MathJax', value: true },
    { key: 'render_with_liquid', pattern: /\{%\s*include\s+embed\//u, label: 'Liquid', value: true }
  ];

  requirements.forEach(({ key, pattern, label, value }) => {
    if (!pattern.test(normalized)) return;

    if (parsed.values[key] === undefined) {
      normalized = setFrontMatterValue(normalized, key, value);
      changes.push(`${label} 옵션을 자동으로 활성화했습니다.`);
    } else if (parsed.values[key] === false) {
      if (key === 'render_with_liquid') {
        warnings.push('Liquid syntax is present while render_with_liquid is false.');
        return;
      }
      warnings.push(`${label} 문법이 있지만 ${key}: false로 설정되어 있습니다.`);
    }
  });

  return { content: normalized, warnings, changes };
}

export function validateContent(content, { draft = true } = {}) {
  const parsed = parseFrontMatter(content);
  const errors = [];
  const warnings = [];

  if (!parsed.valid) {
    errors.push('YAML front matter가 없거나 시작/종료 구분선이 잘못되었습니다.');
    return { valid: false, errors, warnings, values: {} };
  }

  if (!parsed.values.title) errors.push('title이 비어 있습니다.');
  if (!draft && !parsed.values.date) errors.push('발행 글에는 date가 필요합니다.');
  if (!parsed.values.post_id) warnings.push('post_id가 없습니다. 작성 도구로 생성한 글이 아닐 수 있습니다.');
  if (!parsed.values.media_subpath) warnings.push('media_subpath가 없어 이미지 자동 경로를 사용할 수 없습니다.');
  if (!Array.isArray(parsed.values.categories)) warnings.push('categories는 배열 형식을 권장합니다.');
  if (!Array.isArray(parsed.values.tags)) warnings.push('tags는 배열 형식을 권장합니다.');
  if (/!\[\s*\]\(/.test(content)) warnings.push('alt가 비어 있는 이미지가 있습니다.');

  let inFence = false;
  String(content).split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!inFence && trimmed.startsWith('```')) {
      if (trimmed === '```') warnings.push('언어가 지정되지 않은 코드 블록이 있습니다.');
      inFence = true;
    } else if (inFence && trimmed === '```') {
      inFence = false;
    }
  });

  if (inFence) errors.push('닫히지 않은 코드 블록이 있습니다.');

  const normalized = normalizeContent(content);

  return {
    valid: errors.length === 0,
    errors,
    warnings: [...warnings, ...normalized.warnings],
    changes: normalized.changes,
    values: parsed.values,
    content: normalized.content
  };
}

export function safeDraftName(name) {
  const value = path.basename(String(name || ''));

  if (!value || value !== name || !value.toLowerCase().endsWith('.md')) {
    throw new Error('유효하지 않은 초안 파일명입니다.');
  }

  return value;
}

export function safePostName(name, excludedDirectories = ['demo', 'preset']) {
  const value = String(name || '').replace(/\\/g, '/');
  const normalized = path.posix.normalize(value);
  const parts = value.split('/');

  if (
    !value ||
    value !== normalized ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    path.posix.isAbsolute(normalized) ||
    !normalized.toLowerCase().endsWith('.md') ||
    parts.some((part) => !part || part === '.' || part === '..') ||
    excludedDirectories.map((directory) => directory.toLowerCase()).includes(parts[0]?.toLowerCase())
  ) {
    throw new Error('수정할 수 없는 글 경로입니다.');
  }

  return normalized;
}

export function safeSubpath(value, mediaDirectory = 'images') {
  const subpath = String(value || '').replace(/^\/+|\/+$/g, '');
  const root = String(mediaDirectory || 'images').replace(/^\/+|\/+$/g, '') || 'images';

  if (!subpath || subpath.includes('..') || !subpath.startsWith(`${root}/`)) {
    throw new Error(`media_subpath는 ${root}/ 아래 경로여야 합니다.`);
  }

  return subpath;
}
