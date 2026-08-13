import assert from 'node:assert/strict';
import test from 'node:test';
import { insertFootnote, isInsideFencedCode, toggleDelimited, toggleHtmlClass, updateFrontMatter } from '../src/formatting.js';

function applyChanges(source, changes) {
  return [...changes].reverse().reduce(
    (value, change) => `${value.slice(0, change.from)}${change.insert}${value.slice(change.to)}`,
    source
  );
}

test('toggles markdown delimiters around a selection', () => {
  const source = 'hello world';
  const wrapped = toggleDelimited(source, 6, 11, '**', '**');

  assert.equal(wrapped.insert, '**world**');
  assert.equal(wrapped.selectionFrom, 8);
  assert.equal(wrapped.selectionTo, 13);

  const unwrapped = toggleDelimited('hello **world**', 8, 13, '**', '**');
  assert.equal(unwrapped.insert, 'world');
  assert.equal(unwrapped.from, 6);
  assert.equal(unwrapped.to, 15);
});

test('toggles a safe HTML color class and replaces a different class', () => {
  const wrapped = toggleHtmlClass('hello world', 6, 11, { tag: 'span', className: 'text-accent' });
  assert.equal(wrapped.insert, '<span class="text-accent">world</span>');

  const accented = 'hello <span class="text-accent">world</span>';
  const accentedFrom = accented.indexOf('world');
  const accentedTo = accentedFrom + 'world'.length;
  const replaced = toggleHtmlClass(accented, accentedFrom, accentedTo, { tag: 'span', className: 'text-info' });
  assert.equal(replaced.insert, '<span class="text-info">world</span>');

  const info = 'hello <span class="text-info">world</span>';
  const infoFrom = info.indexOf('world');
  const infoTo = infoFrom + 'world'.length;
  const unwrapped = toggleHtmlClass(info, infoFrom, infoTo, { tag: 'span', className: 'text-info' });
  assert.equal(unwrapped.insert, 'world');
});

test('does not format fenced code', () => {
  const source = '```js\nconst value = true;\n```';
  assert.equal(isInsideFencedCode(source, source.indexOf('value')), true);
  assert.equal(toggleDelimited(source, source.indexOf('value'), source.indexOf('value') + 5, '**', '**'), null);
  assert.equal(toggleHtmlClass(source, source.indexOf('value'), source.indexOf('value') + 5, { tag: 'span', className: 'text-accent' }), null);
});

test('inserts a unique footnote reference and definition', () => {
  const source = 'Text[^fn-1].\n\n[^fn-1]: Existing note\n';
  const result = insertFootnote(source, 4, 4);

  assert.equal(result.label, 'fn-2');
  assert.equal(applyChanges(source, result.changes), 'Text[^fn-2][^fn-1].\n\n[^fn-1]: Existing note\n\n[^fn-2]: ');
  assert.equal(result.selection, source.length + '[^fn-2]'.length + '\n[^fn-2]: '.length);
});

test('replaces selected text and leaves the cursor at the new definition', () => {
  const source = 'Text to replace.';
  const result = insertFootnote(source, 5, 15);

  assert.equal(applyChanges(source, result.changes), 'Text [^fn-1].\n\n[^fn-1]: ');
  assert.equal(result.selection, 'Text [^fn-1].\n\n[^fn-1]: '.length);
});

test('does not insert a footnote inside fenced code', () => {
  const source = '```md\ntext\n```';
  const position = source.indexOf('text');

  assert.equal(insertFootnote(source, position, position), null);
});

test('updates front matter values without changing the body', () => {
  const source = '---\ntitle: Test\ntags: [old]\n---\n\nBody\n';
  const result = updateFrontMatter(source, {
    description: 'A short note',
    tags: ['markdown', 'jekyll'],
    comments: false
  });

  assert.match(result, /description: "A short note"/u);
  assert.match(result, /tags: \["markdown", "jekyll"\]/u);
  assert.match(result, /comments: false/u);
  assert.match(result, /---\n\nBody\n$/u);
});

test('replaces folded front matter values without leaving continuation lines', () => {
  const source = '---\ndescription: >-\n  Old first line\n  old second line\ntags: [old]\n---\n\nBody\n';
  const result = updateFrontMatter(source, { description: 'New description' });

  assert.equal(result, '---\ndescription: "New description"\ntags: [old]\n---\n\nBody\n');
});

test('updates preview image fields while preserving other nested options', () => {
  const source = '---\nimage:\n  path: old.png\n  alt: Old cover\n  lqip: old-lqip.png\n---\n\nBody\n';
  const result = updateFrontMatter(source, {
    image: { path: 'new.png', alt: 'New cover', no_bg: true }
  });

  assert.equal(result, '---\nimage:\n  path: "new.png"\n  alt: "New cover"\n  lqip: old-lqip.png\n  no_bg: true\n---\n\nBody\n');
});

test('adds nested preview image fields when image is absent', () => {
  const source = '---\ntitle: Test\n---\n\nBody\n';
  const result = updateFrontMatter(source, { image: { path: 'cover.png', alt: 'Cover' } });

  assert.equal(result, '---\ntitle: Test\nimage:\n  path: "cover.png"\n  alt: "Cover"\n---\n\nBody\n');
});
