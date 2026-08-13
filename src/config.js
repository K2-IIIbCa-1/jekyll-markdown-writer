import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);

    if (!match || match[1] in process.env) continue;

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

export function loadConfig(defaultRootDir, toolDir = path.join(defaultRootDir, 'tools', 'blog-writer')) {
  loadDotEnv(path.join(defaultRootDir, '.env'));
  loadDotEnv(path.join(toolDir, '.env'));

  const configuredRoot = String(process.env.JEKYLL_ROOT || '').trim();
  const rootDir = configuredRoot
    ? path.resolve(path.isAbsolute(configuredRoot) ? configuredRoot : path.join(toolDir, configuredRoot))
    : defaultRootDir;

  loadDotEnv(path.join(rootDir, '.env'));

  const jurisdiction = process.env.R2_JURISDICTION || 'default';
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const endpointByJurisdiction = {
    default: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '',
    eu: accountId ? `https://${accountId}.eu.r2.cloudflarestorage.com` : '',
    fedramp: accountId ? `https://${accountId}.fedramp.r2.cloudflarestorage.com` : ''
  };
  const configuredEndpoint = (process.env.R2_ENDPOINT || '').trim();
  const endpoint = configuredEndpoint && configuredEndpoint.toLowerCase() !== 'auto'
    ? configuredEndpoint
    : endpointByJurisdiction[jurisdiction] || '';
  const jekyllPort = Number(process.env.JEKYLL_PORT || 4000);
  const excludedDirectories = process.env.JEKYLL_WRITER_EXCLUDED_DIRECTORIES ?? 'demo,preset';
  const excludedPostDirectories = excludedDirectories
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return {
    rootDir,
    draftsDir: path.resolve(rootDir, process.env.JEKYLL_DRAFTS_DIRECTORY || '_drafts'),
    postsDir: path.resolve(rootDir, process.env.JEKYLL_POSTS_DIRECTORY || '_posts'),
    publicDir: path.join(toolDir, 'public'),
    port: Number(process.env.BLOG_WRITER_PORT || 4170),
    appName: process.env.JEKYLL_WRITER_NAME || 'Jekyll Writer',
    siteName: process.env.JEKYLL_SITE_NAME || 'Jekyll Blog',
    jekyllCommand: process.env.JEKYLL_COMMAND || (process.platform === 'win32' ? 'bundle.bat' : 'bundle'),
    jekyllPort,
    jekyllUrl: process.env.JEKYLL_PREVIEW_URL || `http://127.0.0.1:${jekyllPort}`,
    excludedPostDirectories,
    mediaDirectory: (process.env.JEKYLL_MEDIA_DIRECTORY || 'images').replace(/^\/+|\/+$/g, '') || 'images',
    postUrlPrefix: `/${(process.env.JEKYLL_POST_URL_PREFIX || '/posts').replace(/^\/+|\/+$/g, '') || 'posts'}`,
    defaultToc: process.env.JEKYLL_DEFAULT_TOC !== 'false',
    defaultComments: process.env.JEKYLL_DEFAULT_COMMENTS !== 'false',
    r2Configured: Boolean(accountId && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && endpoint && process.env.R2_PUBLIC_BASE_URL),
    r2: {
      accountId,
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      bucket: process.env.R2_BUCKET || '',
      jurisdiction,
      region: process.env.R2_REGION || 'auto',
      endpoint,
      publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '')
    }
  };
}
