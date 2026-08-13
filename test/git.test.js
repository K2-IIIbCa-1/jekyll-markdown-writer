import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedPostPath, isIgnoredGitPath, parseGitStatus } from '../src/git.js';

test('parses porcelain status records and rename paths', () => {
  const entries = parseGitStatus(' M _posts/article.md\0R  _posts/new.md\0_posts/old.md\0?? _posts/image.md\0');

  assert.deepEqual(entries.map(({ code, path, paths }) => ({ code, path, paths })), [
    { code: ' M', path: '_posts/article.md', paths: ['_posts/article.md'] },
    { code: 'R ', path: '_posts/new.md', paths: ['_posts/new.md', '_posts/old.md'] },
    { code: '??', path: '_posts/image.md', paths: ['_posts/image.md'] }
  ]);
});

test('allows only Markdown files below the posts directory', () => {
  assert.equal(isAllowedPostPath('_posts/2026-08-14-post.md', '_posts'), true);
  assert.equal(isAllowedPostPath('_posts/nested/post.md', '_posts'), true);
  assert.equal(isAllowedPostPath('tools/blog-writer/public/index.html', '_posts'), false);
  assert.equal(isAllowedPostPath('_posts/post.txt', '_posts'), false);
  assert.equal(isAllowedPostPath('_posts/demo/post.md', '_posts', ['demo', 'preset']), false);
  assert.equal(isAllowedPostPath('_posts/preset/_preset.md', '_posts', ['demo', 'preset']), false);
});

test('ignores the editor submodule without ignoring neighboring paths', () => {
  assert.equal(isIgnoredGitPath('tools/blog-writer', ['tools/blog-writer']), true);
  assert.equal(isIgnoredGitPath('tools/blog-writer/public/index.html', ['tools/blog-writer']), true);
  assert.equal(isIgnoredGitPath('tools/blog-writer-old', ['tools/blog-writer']), false);
  assert.equal(isIgnoredGitPath('_posts/article.md', ['tools/blog-writer']), false);
});
