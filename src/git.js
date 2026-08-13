import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT = 60_000;

export class GitOperationError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = 'GitOperationError';
    this.statusCode = statusCode;
  }
}

function normalizedPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//u, '');
}

function gitEnvironment() {
  return {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'Never'
  };
}

async function runGit(rootDir, args) {
  try {
    return await execFileAsync(
      'git',
      ['-c', `safe.directory=${rootDir}`, '-C', rootDir, ...args],
      {
        cwd: rootDir,
        env: gitEnvironment(),
        windowsHide: true,
        maxBuffer: 1024 * 1024,
        timeout: GIT_TIMEOUT
      }
    );
  } catch (error) {
    const detail = String(error.stderr || error.stdout || '').trim();
    throw new GitOperationError(detail || error.message, 409);
  }
}

export function parseGitStatus(output) {
  const records = String(output || '').split('\0').filter(Boolean);
  const entries = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const code = record.slice(0, 2);
    const filePath = normalizedPath(record.slice(3));
    const paths = [filePath];

    if (code[0] === 'R' || code[0] === 'C') {
      const originalPath = normalizedPath(records[index + 1]);
      if (originalPath) {
        paths.push(originalPath);
        index += 1;
      }
    }

    entries.push({
      code,
      path: filePath,
      paths,
      summary: `${code} ${paths.join(' -> ')}`
    });
  }

  return entries;
}

export function isAllowedPostPath(filePath, postsRoot, excludedDirectories = []) {
  const normalized = normalizedPath(filePath);
  const root = normalizedPath(postsRoot).replace(/\/$/u, '');
  const relative = path.posix.relative(root, normalized);
  const firstPart = relative.split('/')[0]?.toLowerCase();
  const excluded = excludedDirectories.map((directory) => normalizedPath(directory).toLowerCase());

  return Boolean(
    root &&
    relative &&
    !relative.startsWith('../') &&
    !path.posix.isAbsolute(relative) &&
    normalized.toLowerCase().endsWith('.md') &&
    !excluded.includes(firstPart)
  );
}

export function isIgnoredGitPath(filePath, ignoredPaths = []) {
  const normalized = normalizedPath(filePath).toLowerCase().replace(/\/$/u, '');

  return Boolean(
    normalized &&
    ignoredPaths.some((ignoredPath) => {
      const ignored = normalizedPath(ignoredPath).toLowerCase().replace(/\/$/u, '');
      return ignored && (normalized === ignored || normalized.startsWith(`${ignored}/`));
    })
  );
}

function redactRemote(value) {
  return String(value || '').replace(/(https?:\/\/)[^/@\s]+@/iu, '$1<credentials>@');
}

async function resolveGitRoot(rootDir) {
  const result = await runGit(rootDir, ['rev-parse', '--show-toplevel']);
  return path.resolve(result.stdout.trim());
}

export async function getGitStatus({
  rootDir,
  postsDir,
  excludedPostDirectories = [],
  ignoredGitPaths = [],
  enabled = true
}) {
  if (!enabled) {
    return { configured: false, enabled: false, message: 'Git 기능이 비활성화되어 있습니다.' };
  }

  let gitRoot;

  try {
    gitRoot = await resolveGitRoot(rootDir);
  } catch (error) {
    return {
      configured: false,
      enabled: true,
      rootDir,
      message: `JEKYLL_ROOT가 Git 저장소가 아닙니다: ${error.message}`
    };
  }

  const postsRoot = normalizedPath(path.relative(gitRoot, postsDir));
  const [branchResult, remoteResult, statusResult] = await Promise.all([
    runGit(rootDir, ['branch', '--show-current']),
    runGit(rootDir, ['remote', 'get-url', 'origin']).catch(() => ({ stdout: '' })),
    runGit(rootDir, ['status', '--porcelain=v1', '--untracked-files=all', '-z'])
  ]);
  const upstream = await runGit(rootDir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])
    .then((result) => result.stdout.trim())
    .catch(() => '');
  const entries = parseGitStatus(statusResult.stdout).filter((entry) =>
    !entry.paths.some((filePath) => isIgnoredGitPath(filePath, ignoredGitPaths))
  );
  const allPathsAllowed = entries.length > 0 && entries.every((entry) =>
    entry.paths.every((filePath) => isAllowedPostPath(filePath, postsRoot, excludedPostDirectories))
  );

  return {
    configured: true,
    enabled: true,
    rootDir: gitRoot,
    postsRoot,
    branch: branchResult.stdout.trim(),
    remote: redactRemote(remoteResult.stdout.trim()),
    upstream,
    entries,
    canCommit: allPathsAllowed,
    canPush: Boolean(upstream && entries.length === 0),
    message: entries.length
      ? allPathsAllowed
        ? '현재 변경사항은 게시글 파일만 포함합니다.'
        : '게시글 외 변경사항이 있어 안전을 위해 커밋을 막았습니다.'
      : '커밋할 게시글 변경사항이 없습니다.'
  };
}

export async function commitPosts({
  rootDir,
  postsDir,
  excludedPostDirectories = [],
  ignoredGitPaths = [],
  message,
  enabled = true
}) {
  const commitMessage = String(message || '').replace(/\s+/gu, ' ').trim();

  if (!commitMessage) throw new GitOperationError('커밋 메시지를 입력하세요.', 400);
  if (commitMessage.length > 200) throw new GitOperationError('커밋 메시지는 200자 이내로 입력하세요.', 400);

  const status = await getGitStatus({ rootDir, postsDir, excludedPostDirectories, ignoredGitPaths, enabled });
  if (!status.configured) throw new GitOperationError(status.message, 400);
  if (!status.canCommit) throw new GitOperationError(status.message, 409);

  const paths = [...new Set(status.entries.flatMap((entry) => entry.paths))];
  await runGit(rootDir, ['add', '--', ...paths]);
  await runGit(rootDir, ['commit', '-m', commitMessage, '--', ...paths]);

  return {
    message: '커밋이 완료되었습니다.',
    output: '커밋 완료',
    status: await getGitStatus({ rootDir, postsDir, excludedPostDirectories, ignoredGitPaths, enabled })
  };
}

export async function pushRepository({
  rootDir,
  postsDir,
  excludedPostDirectories = [],
  ignoredGitPaths = [],
  enabled = true
}) {
  const status = await getGitStatus({ rootDir, postsDir, excludedPostDirectories, ignoredGitPaths, enabled });
  if (!status.configured) throw new GitOperationError(status.message, 400);
  if (!status.upstream) throw new GitOperationError('현재 브랜치에 upstream이 설정되어 있지 않습니다.', 409);
  if (!status.canPush) throw new GitOperationError(status.message, 409);

  const result = await runGit(rootDir, ['push']);

  return {
    message: 'Push가 완료되었습니다.',
    output: String(result.stdout || result.stderr || '').trim(),
    status: await getGitStatus({ rootDir, postsDir, excludedPostDirectories, ignoredGitPaths, enabled })
  };
}
