import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeContent,
  parseFrontMatter,
  extractDescriptionSource,
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

test('auto-enables Liquid for theme media includes', () => {
  const result = normalizeContent('---\ntitle: Test\n---\n\n{% include embed/video.html src="video.mp4" %}\n');

  assert.match(result.content, /render_with_liquid: true/);
  assert.equal(result.changes.length, 1);
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

test('reads nested preview image front matter', () => {
  const parsed = parseFrontMatter('---\nimage:\n  path: https://img.example/cover.png\n  alt: Cover image\n  no_bg: true\n---\n');

  assert.deepEqual(parsed.values.image, {
    path: 'https://img.example/cover.png',
    alt: 'Cover image',
    no_bg: true
  });
});

test('warns when Liquid syntax is disabled in front matter', () => {
  const result = validateContent('---\ntitle: Test\nrender_with_liquid: false\n---\n\n{% include embed/youtube.html id="video" %}\n');

  assert.ok(result.warnings.includes('Liquid syntax is present while render_with_liquid is false.'));
});

test('extracts readable description source without code or Liquid blocks', () => {
  const source = '---\ntitle: Test\n---\n\n본문 문장입니다.\n\n```js\nconst secret = true;\n```\n\n{% include embed/video.html src="video.mp4" %}\n\n![설명](cover.png)\n';

  assert.equal(extractDescriptionSource(source), '본문 문장입니다.\n\n설명');
});
