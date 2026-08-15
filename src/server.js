import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import {
  parseFrontMatter,
  extractDescriptionSource,
  safePostName,
  safeDraftName,
  safeFileName,
  safeSubpath,
  setFrontMatterValue,
  slugify,
  timestamp,
  validateContent
} from './core.js';
import { generateDescription } from './ai.js';
import { commitPosts, getGitStatus, pushRepository } from './git.js';
import { objectExists, uploadObject } from './r2.js';

const toolDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(path.resolve(toolDir, '../..'), toolDir);
const rootDir = config.rootDir;
const editorGitPath = path.relative(rootDir, toolDir);
let previewProcess;

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.3g2': 'video/3gpp2',
  '.3gp': 'video/3gpp',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogv': 'video/ogg',
  '.webm': 'video/webm'
};

function json(response, status, value) {
  const body = JSON.stringify(value);

  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  response.end(body);
}

function error(response, status, message) {
  json(response, status, { error: message });
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);

  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function draftPath(name) {
  const safeName = safeDraftName(name);
  const filePath = path.resolve(config.draftsDir, safeName);

  if (!isWithin(path.resolve(config.draftsDir), filePath)) {
    throw new Error('잘못된 초안 경로입니다.');
  }

  return filePath;
}

function postPath(name) {
  const safeName = safePostName(name, config.excludedPostDirectories);
  const filePath = path.resolve(config.postsDir, safeName);

  if (!isWithin(path.resolve(config.postsDir), filePath)) {
    throw new Error('잘못된 글 경로입니다.');
  }

  return filePath;
}

async function readJson(request, limit = 32 * 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > limit) throw new Error('요청 크기가 너무 큽니다.');

    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function writeAtomic(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;

  await fsp.writeFile(temporaryPath, content, 'utf8');
  await fsp.rename(temporaryPath, filePath);
}

function listValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function yamlString(value) {
  return JSON.stringify(String(value || '').trim());
}

function yamlList(value) {
  return JSON.stringify(listValue(value));
}

function makeDraftContent({ title, description, categories, tags, postId, mediaSubpath }) {
  const cleanDescription = String(description || '').replace(/\s+/g, ' ').trim();

  return `---
title: ${yamlString(title)}
description: >-
  ${cleanDescription || '초안 설명을 입력하세요.'}
post_id: ${postId}
categories: ${yamlList(categories)}
tags: ${yamlList(tags)}
toc: ${config.defaultToc}
comments: ${config.defaultComments}
media_subpath: /${mediaSubpath}
---

## 개요

내용을 작성하세요.
`;
}

async function postIdTaken(postId) {
  for (const directory of [config.draftsDir, config.postsDir]) {
    if (!fs.existsSync(directory)) continue;

    const entries = await fsp.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;

      const content = await fsp.readFile(path.join(directory, entry.name), 'utf8');
      if (parseFrontMatter(content).values.post_id === postId) return true;
    }
  }

  return false;
}

async function uniquePostId(candidate) {
  if (!(await postIdTaken(candidate))) return candidate;

  for (let index = 1; index < 1000; index += 1) {
    const next = `${candidate}_${String(index).padStart(2, '0')}`;

    if (!(await postIdTaken(next))) return next;
  }

  throw new Error('같은 초에 생성된 글이 너무 많습니다.');
}

function uniqueDraftName(directory, postId, title) {
  const titleSlug = slugify(title) || 'post';
  const base = `${postId}-${titleSlug}`;
  let candidate = `${base}.md`;
  let index = 1;

  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${base}-${String(index).padStart(2, '0')}.md`;
    index += 1;
  }

  return candidate;
}

function uniquePostName(directory, date, title, postId) {
  const titleSlug = slugify(title) || postId;
  const base = `${date}-${titleSlug}`;
  let candidate = `${base}.md`;
  let index = 1;

  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${base}-${String(index).padStart(2, '0')}.md`;
    index += 1;
  }

  return candidate;
}

function previewPath(values, draftName) {
  const titleSlug = slugify(values.title);
  const fileSlug = slugify(path.basename(draftName, '.md'));
  const slug = titleSlug || fileSlug || values.post_id;

  return `${config.postUrlPrefix}/${encodeURIComponent(slug)}/`;
}

async function listDrafts() {
  await fsp.mkdir(config.draftsDir, { recursive: true });
  const entries = await fsp.readdir(config.draftsDir, { withFileTypes: true });
  const drafts = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;

    const filePath = path.join(config.draftsDir, entry.name);
    const [content, stats] = await Promise.all([
      fsp.readFile(filePath, 'utf8'),
      fsp.stat(filePath)
    ]);
    const parsed = parseFrontMatter(content);

    drafts.push({
      name: entry.name,
      title: parsed.values.title || entry.name,
      postId: parsed.values.post_id || '',
      updatedAt: stats.mtime.toISOString(),
      previewPath: previewPath(parsed.values, entry.name)
    });
  }

  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getDraft(name) {
  const filePath = draftPath(name);
  const content = await fsp.readFile(filePath, 'utf8');
  const parsed = parseFrontMatter(content);

  return {
    name,
    content,
    values: parsed.values,
    previewPath: previewPath(parsed.values, name)
  };
}

async function listPosts() {
  const posts = [];

  async function visit(directory, relativeDirectory = '') {
    if (!fs.existsSync(directory)) return;

    const entries = await fsp.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const relativeName = path.posix.join(relativeDirectory, entry.name);
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!config.excludedPostDirectories.includes(entry.name.toLowerCase())) await visit(filePath, relativeName);
        continue;
      }

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;

      const [content, stats] = await Promise.all([
        fsp.readFile(filePath, 'utf8'),
        fsp.stat(filePath)
      ]);
      const parsed = parseFrontMatter(content);

      posts.push({
        name: relativeName,
        title: parsed.values.title || entry.name,
        postId: parsed.values.post_id || '',
        updatedAt: stats.mtime.toISOString(),
        previewPath: previewPath(parsed.values, entry.name)
      });
    }
  }

  await visit(config.postsDir);
  return posts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getPost(name) {
  const filePath = postPath(name);
  const content = await fsp.readFile(filePath, 'utf8');
  const parsed = parseFrontMatter(content);

  return {
    name,
    content,
    values: parsed.values,
    previewPath: previewPath(parsed.values, name)
  };
}

async function handleCreateDraft(request, response) {
  const body = await readJson(request, 64 * 1024);
  const title = String(body.title || '').trim();

  if (!title) return error(response, 400, '제목을 입력하세요.');

  await fsp.mkdir(config.draftsDir, { recursive: true });
  const baseTimestamp = timestamp();
  const postId = await uniquePostId(baseTimestamp.postId);
  const mediaSubpath = `${config.mediaDirectory}/${postId}`;
  const name = uniqueDraftName(config.draftsDir, postId, title);
  const content = makeDraftContent({
    title,
    description: body.description,
    categories: body.categories,
    tags: body.tags,
    postId,
    mediaSubpath
  });

  await writeAtomic(path.join(config.draftsDir, name), content);

  json(response, 201, {
    draft: {
      name,
      content,
      values: parseFrontMatter(content).values,
      previewPath: previewPath(parseFrontMatter(content).values, name)
    }
  });
}

async function handleDeleteDraft(name, response) {
  const filePath = draftPath(name);

  try {
    await fsp.unlink(filePath);
  } catch (unlinkError) {
    if (unlinkError.code === 'ENOENT') return error(response, 404, 'Draft file was not found.');
    throw unlinkError;
  }

  json(response, 200, { name, message: 'Draft deleted.' });
}

async function handleSaveDraft(name, request, response) {
  const body = await readJson(request);
  const content = String(body.content || '');
  const validation = validateContent(content, { draft: true });
  const nextContent = validation.content || content;

  await writeAtomic(draftPath(name), nextContent);

  json(response, 200, {
    ...validation,
    content: nextContent,
    draft: await getDraft(name)
  });
}

async function handleSavePost(name, request, response) {
  const body = await readJson(request);
  const content = String(body.content || '');
  const validation = validateContent(content, { draft: false });
  const nextContent = validation.content || content;

  if (!validation.valid) return json(response, 422, validation);

  await writeAtomic(postPath(name), nextContent);

  json(response, 200, {
    ...validation,
    content: nextContent,
    post: await getPost(name)
  });
}

async function handleValidatePost(name, request, response) {
  const body = await readJson(request);
  const content = body.content === undefined ? (await getPost(name)).content : String(body.content);

  json(response, 200, validateContent(content, { draft: false }));
}

async function handleValidateDraft(name, request, response) {
  const body = await readJson(request);
  const content = body.content === undefined ? (await getDraft(name)).content : String(body.content);

  json(response, 200, validateContent(content, { draft: true }));
}

async function nextObjectKey(configured, baseKey) {
  if (!(await objectExists(configured, baseKey))) return baseKey;

  const extension = path.extname(baseKey);
  const stem = baseKey.slice(0, -extension.length);

  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${stem}-${String(index).padStart(2, '0')}${extension}`;

    if (!(await objectExists(configured, candidate))) return candidate;
  }

  throw new Error('같은 이름의 R2 이미지가 너무 많습니다.');
}

async function handleUpload(kind, name, request, response) {
  if (!config.r2Configured) return error(response, 503, 'R2 이미지 업로드가 설정되지 않았습니다.');

  const body = await readJson(request);
  const entry = kind === 'post' ? await getPost(name) : await getDraft(name);
  const subpath = safeSubpath(entry.values.media_subpath, config.mediaDirectory);
  const fileName = safeFileName(body.fileName, 'image');
  const extensionContentType = MIME_TYPES[path.extname(fileName).toLowerCase()];
  const contentType = String(extensionContentType || body.contentType || '');
  const mediaType = contentType.startsWith('video/') ? 'video' : contentType.startsWith('image/') ? 'image' : '';

  if (!mediaType) {
    return error(response, 400, '이미지 또는 영상 파일만 업로드할 수 있습니다.');
  }

  if (typeof body.data !== 'string' || !body.data) {
    return error(response, 400, '업로드할 파일 데이터가 없습니다.');
  }

  const base64 = body.data.replace(/^data:[^;]+;base64,/, '');
  const file = Buffer.from(base64, 'base64');

  if (!file.length || file.length > 20 * 1024 * 1024) {
    return error(response, 400, '파일 크기는 20MB 이하이어야 합니다.');
  }

  const baseKey = `${subpath}/${fileName}`;
  const key = await nextObjectKey(config.r2, baseKey);
  const uploaded = await uploadObject(config.r2, { key, body: file, contentType });
  const relativeSource = path.basename(key);
  const markdown = mediaType === 'video'
    ? `{% include embed/video.html src="${relativeSource}" %}`
    : `![${path.basename(fileName, path.extname(fileName))}](${relativeSource})`;

  json(response, 201, {
    ...uploaded,
    mediaType,
    markdown
  });
}

async function handleAiDescription(request, response) {
  const body = await readJson(request);
  const content = String(body.content || '');
  const parsed = parseFrontMatter(content);
  const source = extractDescriptionSource(content);

  if (!source) return error(response, 400, '본문에서 설명을 만들 수 있는 텍스트를 찾지 못했습니다.');

  const description = await generateDescription({
    provider: String(body.provider || config.aiProvider),
    apiKey: String(body.apiKey || config.aiApiKey),
    model: String(body.model || config.aiModel),
    endpoint: String(body.endpoint || config.aiEndpoint),
    title: String(body.title || parsed.values.title || '').slice(0, 240),
    source
  });

  return json(response, 200, { description });
}

async function handleGitCommit(request, response) {
  const body = await readJson(request, 16 * 1024);
  return json(response, 200, await commitPosts({
    rootDir,
    postsDir: config.postsDir,
    excludedPostDirectories: config.excludedPostDirectories,
    ignoredGitPaths: [editorGitPath],
    message: body.message,
    enabled: config.gitEnabled
  }));
}

async function handleGitPush(response) {
  return json(response, 200, await pushRepository({
    rootDir,
    postsDir: config.postsDir,
    excludedPostDirectories: config.excludedPostDirectories,
    ignoredGitPaths: [editorGitPath],
    enabled: config.gitEnabled
  }));
}

async function handlePublishDraft(name, request, response) {
  const body = await readJson(request);
  const draft = await getDraft(name);
  let content = body.content === undefined ? draft.content : String(body.content);
  const validation = validateContent(content, { draft: true });

  if (!validation.valid) return json(response, 422, validation);

  content = validation.content || content;
  const now = timestamp();
  content = setFrontMatterValue(content, 'date', now.frontMatterDate);
  let values = parseFrontMatter(content).values;
  const postId = values.post_id || now.postId;
  content = setFrontMatterValue(content, 'post_id', postId);
  content = setFrontMatterValue(content, 'media_subpath', values.media_subpath || `/${config.mediaDirectory}/${postId}`);
  values = parseFrontMatter(content).values;
  const postName = uniquePostName(config.postsDir, now.date, values.title, postId);
  const postPath = path.join(config.postsDir, postName);

  await fsp.mkdir(config.postsDir, { recursive: true });
  await writeAtomic(postPath, content);
  await fsp.unlink(draftPath(name));

  json(response, 201, {
    postName,
    content,
    url: `${config.postUrlPrefix}/${encodeURIComponent(slugify(values.title) || path.basename(postName, '.md'))}/`
  });
}

function previewState() {
  return {
    running: Boolean(previewProcess && !previewProcess.killed),
    pid: previewProcess?.pid || null,
    url: config.jekyllUrl
  };
}

function startPreview() {
  if (previewProcess && !previewProcess.killed) return previewState();

  previewProcess = spawn(
    config.jekyllCommand,
    ['exec', 'jekyll', 'serve', '--drafts', '--livereload', '--host', '127.0.0.1', '--port', String(config.jekyllPort)],
    { cwd: rootDir, shell: process.platform === 'win32', windowsHide: true, stdio: 'ignore' }
  );
  previewProcess.on('exit', () => {
    previewProcess = undefined;
  });

  return previewState();
}

function stopPreview() {
  if (previewProcess && !previewProcess.killed) previewProcess.kill();
  previewProcess = undefined;

  return previewState();
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));

  if (url.pathname === '/api/config' && request.method === 'GET') {
    return json(response, 200, {
      appName: config.appName,
      siteName: config.siteName,
      jekyllUrl: config.jekyllUrl,
      aiConfigured: config.aiConfigured,
      aiProvider: config.aiProvider,
      aiModel: config.aiModel,
      aiEndpoint: config.aiEndpoint,
      r2Configured: config.r2Configured,
      r2PublicBaseUrl: config.r2.publicBaseUrl
    });
  }

  if (url.pathname === '/api/ai/description' && request.method === 'POST') {
    return handleAiDescription(request, response);
  }

  if (url.pathname === '/api/git/status' && request.method === 'GET') {
    return json(response, 200, await getGitStatus({
      rootDir,
      postsDir: config.postsDir,
      excludedPostDirectories: config.excludedPostDirectories,
      ignoredGitPaths: [editorGitPath],
      enabled: config.gitEnabled
    }));
  }

  if (url.pathname === '/api/git/commit' && request.method === 'POST') {
    return handleGitCommit(request, response);
  }

  if (url.pathname === '/api/git/push' && request.method === 'POST') {
    return handleGitPush(response);
  }

  if (url.pathname === '/api/drafts' && request.method === 'GET') {
    return json(response, 200, { drafts: await listDrafts() });
  }

  if (url.pathname === '/api/drafts' && request.method === 'POST') {
    return handleCreateDraft(request, response);
  }

  if (url.pathname === '/api/posts' && request.method === 'GET') {
    return json(response, 200, { posts: await listPosts() });
  }

  if (url.pathname === '/api/preview/status' && request.method === 'GET') {
    return json(response, 200, previewState());
  }

  if (url.pathname === '/api/preview/start' && request.method === 'POST') {
    return json(response, 200, startPreview());
  }

  if (url.pathname === '/api/preview/stop' && request.method === 'POST') {
    return json(response, 200, stopPreview());
  }

  if (parts[0] === 'api' && parts[1] === 'drafts' && parts[2]) {
    const name = parts[2];

    if (parts.length === 3 && request.method === 'DELETE') return handleDeleteDraft(name, response);
    if (parts.length === 3 && request.method === 'GET') return json(response, 200, await getDraft(name));
    if (parts.length === 4 && parts[3] === 'save' && request.method === 'POST') {
      return handleSaveDraft(name, request, response);
    }
    if (parts.length === 4 && parts[3] === 'validate' && request.method === 'POST') {
      return handleValidateDraft(name, request, response);
    }
    if (parts.length === 4 && parts[3] === 'upload' && request.method === 'POST') {
      return handleUpload('draft', name, request, response);
    }
    if (parts.length === 4 && parts[3] === 'publish' && request.method === 'POST') {
      return handlePublishDraft(name, request, response);
    }
  }

  if (parts[0] === 'api' && parts[1] === 'posts' && parts.length >= 3) {
    const action = parts.at(-1);
    const name = action === 'save' || action === 'validate' || action === 'upload'
      ? parts.slice(2, -1).join('/')
      : parts.slice(2).join('/');

    if (config.excludedPostDirectories.includes(name.split('/')[0]?.toLowerCase())) {
      return error(response, 403, '이 디렉터리의 글은 수정할 수 없습니다.');
    }

    if (parts.length >= 3 && action !== 'save' && action !== 'validate' && action !== 'upload' && request.method === 'GET') {
      return json(response, 200, await getPost(name));
    }
    if (parts.length >= 4 && action === 'save' && request.method === 'POST') {
      return handleSavePost(name, request, response);
    }
    if (parts.length >= 4 && action === 'validate' && request.method === 'POST') {
      return handleValidatePost(name, request, response);
    }
    if (parts.length >= 4 && action === 'upload' && request.method === 'POST') {
      return handleUpload('post', name, request, response);
    }
  }

  return serveStatic(url.pathname, response);
}

async function serveStatic(requestPath, response) {
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const filePath = path.resolve(config.publicDir, relativePath);

  if (!isWithin(path.resolve(config.publicDir), filePath) && filePath !== path.resolve(config.publicDir, 'index.html')) {
    return error(response, 403, '잘못된 파일 경로입니다.');
  }

  try {
    const body = await fsp.readFile(filePath);
    const contentType = {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8'
    }[path.extname(filePath)] || 'application/octet-stream';

    response.writeHead(200, { 'content-type': contentType, 'content-length': body.length });
    response.end(body);
  } catch {
    error(response, 404, '파일을 찾을 수 없습니다.');
  }
}

const server = http.createServer((request, response) => {
  route(request, response).catch((requestError) => {
    console.error(requestError);
    error(response, requestError.statusCode || 500, requestError.message || '처리 중 오류가 발생했습니다.');
  });
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`${config.appName}: http://127.0.0.1:${config.port}`);
});

function shutdown() {
  stopPreview();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
