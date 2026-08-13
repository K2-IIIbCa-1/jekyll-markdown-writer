import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeContent,
  parseFrontMatter,
  safeFileName,
  safePostName,
  safeSubpath,
  slugify,
  timestamp,
  validateContent
} from '../src/core.js';

test('formats a stable Seoul timestamp for post IDs', () => {
  const value = timestamp(new Date('2026-08-13T15:04:05.000Z'));

  assert.equal(value.date, '2026-08-14');
  assert.equal(value.postId, '2026-08-14_000405');
  assert.equal(value.frontMatterDate, '2026-08-14 00:04:05 +0900');
});

test('slugifies ASCII titles and safely normalizes image names', () => {
  assert.equal(slugify('Compact CLI Blog!'), 'compact-cli-blog');
  assert.equal(slugify('새 글 작성'), '새-글-작성');
  assert.equal(safeFileName('../My Screenshot.PNG'), 'my-screenshot.png');
});

test('auto-enables required front matter options', () => {
  const source = '---\ntitle: Test\n---\n\n```mermaid\nflowchart LR\n```\n\n$$x$$\n';
  const result = normalizeContent(source);

  assert.match(result.content, /mermaid: true/);
  assert.match(result.content, /math: true/);
  assert.equal(result.changes.length, 2);
});

test('reports invalid front matter and unclosed fences', () => {
  const result = validateContent('---\ntitle: Test\n---\n\n```js\nconst x = 1;\n', { draft: true });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('닫히지 않은')));
});

test('accepts only image media subpaths', () => {
  assert.equal(safeSubpath('/images/2026-08-13_000001'), 'images/2026-08-13_000001');
  assert.throws(() => safeSubpath('../secrets'), /images\/ 아래/);
  assert.equal(parseFrontMatter('not front matter').valid, false);
});

test('accepts editable post paths but excludes demo archives', () => {
  assert.equal(safePostName('2026-08-13-my-post.md'), '2026-08-13-my-post.md');
  assert.equal(safePostName('nested/my-post.md'), 'nested/my-post.md');
  assert.throws(() => safePostName('demo/example.md'), /수정할 수 없는/);
  assert.throws(() => safePostName('archive/example.md', ['archive']), /수정할 수 없는/);
  assert.throws(() => safePostName('../outside.md'), /수정할 수 없는/);
});

test('supports a custom media directory', () => {
  assert.equal(safeSubpath('/assets/images/post-1', 'assets/images'), 'assets/images/post-1');
  assert.throws(() => safeSubpath('/images/post-1', 'assets/images'), /assets\/images/);
});

test('reads folded YAML descriptions without mistaking the marker for content', () => {
  const parsed = parseFrontMatter('---\ndescription: >-\n  First line\n  second line\ntags: [one]\n---\n');

  assert.equal(parsed.values.description, 'First line second line');
  assert.deepEqual(parsed.values.tags, ['one']);
});
