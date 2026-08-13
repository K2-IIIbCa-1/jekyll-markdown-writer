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
