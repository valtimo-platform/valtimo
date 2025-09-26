#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const FRONTEND_REMOTE_URL = 'git@github.com:valtimo-platform/valtimo-frontend-libraries.git';
const BACKEND_REMOTE_URL = 'git@github.com:valtimo-platform/valtimo-backend-libraries.git';
const FRONTEND_NAMESPACE = 'frontend';
const BACKEND_NAMESPACE = 'backend';
const MAIN_BRANCH = 'next-minor';
const PRE_BOOTSTRAP_TAG = 'pre-bootstrap-monorepo';
const POST_BOOTSTRAP_TAG = 'post-bootstrap-monorepo';
const TMP_PREFIX = 'valtimo-monorepo-';
const GIT_ENV = { ...process.env, GIT_MERGE_AUTOEDIT: 'no' };

function runGit(args, options = {}) {
  const { capture = false, allowFailure = false, quiet = false, env = GIT_ENV, input } = options;
  if (!quiet) {
    console.log(`> git ${args.join(' ')}`);
  }
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    env,
    input,
    stdio: [
      input !== undefined ? 'pipe' : 'inherit',
      capture ? 'pipe' : 'inherit',
      'pipe',
    ],
  });
  if (result.status !== 0) {
    if (allowFailure) {
      return {
        ok: false,
        stdout: capture ? (result.stdout || '').trim() : '',
        stderr: (result.stderr || '').trim(),
        code: result.status,
      };
    }
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(`Command failed (git ${args.join(' ')}): ${message}`);
  }
  return {
    ok: true,
    stdout: capture ? (result.stdout || '').trim() : '',
  };
}

function runGitInDir(directory, args, options = {}) {
  return runGit(['-C', directory, ...args], options);
}

function ensureInsideGitRepository() {
  const result = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true, quiet: true });
  if (result.stdout !== 'true') {
    throw new Error('This script must be run from inside a Git repository.');
  }
}

function ensureCleanWorkingTree() {
  const status = runGit(['status', '--porcelain'], { capture: true, quiet: true });
  if (status.stdout.length > 0) {
    throw new Error('Working tree must be clean before running this script.');
  }
}

function ensureGitFilterRepoAvailable() {
  const result = runGit(['filter-repo', '--version'], { capture: true, quiet: true, allowFailure: true });
  if (!result.ok) {
    throw new Error('git filter-repo is required. Install it first: https://github.com/newren/git-filter-repo');
  }
}

function createPrefixedBareMirror(remoteUrl, prefix) {
  const baseDir = mkdtempSync(path.join(tmpdir(), TMP_PREFIX));
  const bareDir = path.join(baseDir, 'repo.git');
  runGit(['clone', '--bare', remoteUrl, bareDir]);
  runGitInDir(bareDir, ['filter-repo', '--force', `--to-subdirectory-filter=${prefix}`], {
    env: { ...GIT_ENV, FILTER_REPO_SAFETY: 'override' },
  });
  return { baseDir, bareDir };
}

function cleanupTempDir(baseDir) {
  try {
    rmSync(baseDir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Failed to clean up ${baseDir}: ${error.message}`);
  }
}

function importRemote(remoteUrl, prefix, namespace) {
  const { baseDir, bareDir } = createPrefixedBareMirror(remoteUrl, prefix);
  try {
    runGit([
      'fetch',
      bareDir,
      '--prune',
      `+refs/heads/*:refs/monorepo/${namespace}/heads/*`,
      `+refs/tags/*:refs/monorepo/${namespace}/tags/*`,
    ]);
  } finally {
    cleanupTempDir(baseDir);
  }
}

function branchExists(name) {
  const ref = runGit(['show-ref', '--verify', `refs/heads/${name}`], {
    allowFailure: true,
    quiet: true,
    capture: true,
  });
  return ref.ok;
}

function ensureInitialMainBranch() {
  if (branchExists(MAIN_BRANCH)) {
    throw new Error(`Branch ${MAIN_BRANCH} already exists. Aborting to avoid overwriting existing work.`);
  }
  const hasHead = runGit(['rev-parse', '--verify', 'HEAD'], { allowFailure: true, quiet: true });
  if (!hasHead.ok) {
    runGit(['checkout', '--orphan', MAIN_BRANCH]);
    runGit(['commit', '--allow-empty', '-m', 'chore: bootstrap monorepo']);
  } else {
    runGit(['checkout', '-b', MAIN_BRANCH]);
  }
}

function forceTag(name, target = 'HEAD', message) {
  const tagMessage = message || `Monorepo snapshot ${name}`;
  runGit(['tag', '-f', '-a', name, '-m', tagMessage, target]);
}

function resolveCommit(ref, description) {
  const result = runGit(['rev-parse', `${ref}^{commit}`], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  if (!result.ok) {
    throw new Error(`Unable to resolve ${description ?? ref} (${ref}) to a commit.`);
  }
  return result.stdout;
}

function parseLsTreeLine(line) {
  const [meta, pathSpec] = line.split('\t');
  if (!meta || !pathSpec) {
    throw new Error(`Unexpected ls-tree output: ${line}`);
  }
  const [mode, type, hash] = meta.split(' ');
  return { mode, type, hash, path: pathSpec.trim() };
}

function getDirectoryTreeHash(ref, dir, description) {
  const result = runGit(['ls-tree', ref, dir], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  if (!result.ok || result.stdout.length === 0) {
    throw new Error(`${description ?? ref} does not contain ${dir}/.`);
  }
  const entry = parseLsTreeLine(result.stdout.split('\n')[0]);
  if (entry.type !== 'tree') {
    throw new Error(`${description ?? ref} path ${dir} is not a tree.`);
  }
  return entry.hash;
}

function listTreeEntries(ref) {
  const result = runGit(['ls-tree', ref], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  if (!result.ok) {
    throw new Error(`Unable to list tree for ${ref}.`);
  }
  const entries = new Map();
  if (!result.stdout) {
    return entries;
  }
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const entry = parseLsTreeLine(trimmed);
    entries.set(entry.path, entry);
  }
  return entries;
}

function cloneTreeEntries(baseEntries) {
  const entries = new Map();
  for (const [pathSpec, entry] of baseEntries.entries()) {
    entries.set(pathSpec, { ...entry });
  }
  return entries;
}

function createTreeFromEntries(entries) {
  const lines = [];
  for (const entry of entries.values()) {
    if (!entry.hash) continue;
    lines.push(`${entry.mode} ${entry.type} ${entry.hash}\t${entry.path}`);
  }
  lines.sort((a, b) => {
    const pathA = a.split('\t')[1];
    const pathB = b.split('\t')[1];
    return pathA.localeCompare(pathB);
  });
  const input = lines.join('\n') + (lines.length ? '\n' : '');
  const tree = runGit(['mktree'], {
    capture: true,
    quiet: true,
    input,
  });
  if (!tree.ok || !tree.stdout) {
    throw new Error('Failed to construct combined tree.');
  }
  return tree.stdout;
}

function namespaceRef(namespace, type, name) {
  return `refs/monorepo/${namespace}/${type}/${name}`;
}

function ensureNamespaceRefExists(ref, description) {
  const exists = runGit(['show-ref', '--verify', ref], { allowFailure: true, quiet: true });
  if (!exists.ok) {
    throw new Error(`${description} (${ref}) does not exist in the source repository.`);
  }
}

function getNamespaceBranchSet(namespace) {
  const refBase = `refs/monorepo/${namespace}/heads`;
  const list = runGit(['for-each-ref', '--format=%(refname:strip=4)', refBase], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  if (!list.ok || list.stdout.length === 0) {
    return new Set();
  }
  const branches = new Set();
  for (const line of list.stdout.split('\n')) {
    const name = line.trim();
    if (name) {
      branches.add(name);
    }
  }
  return branches;
}

function getNamespaceTagMap(namespace) {
  const refBase = `refs/monorepo/${namespace}/tags`;
  const list = runGit(['for-each-ref', '--format=%(refname:strip=4)', refBase], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  const tags = new Map();
  if (!list.ok || list.stdout.length === 0) {
    return tags;
  }
  for (const line of list.stdout.split('\n')) {
    const name = line.trim();
    if (name) {
      tags.set(name, namespaceRef(namespace, 'tags', name));
    }
  }
  return tags;
}

function pathExistsInRef(ref, pathSpec) {
  const result = runGit(['ls-tree', ref, pathSpec], {
    capture: true,
    quiet: true,
    allowFailure: true,
  });
  return result.ok && result.stdout.length > 0;
}

function mergeAbsorb(ref, message, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Error('mergeAbsorb requires at least one path to materialise.');
  }
  const mergeArgs = ['merge', '--allow-unrelated-histories', '-s', 'ours', '--no-commit', ref];
  let mergeInProgress = false;
  try {
    runGit(mergeArgs);
    mergeInProgress = true;
    for (const pathSpec of paths) {
      if (pathExistsInRef(ref, pathSpec)) {
        runGit(['restore', '--source', ref, '--staged', '--worktree', '--', pathSpec]);
      } else {
        runGit(['rm', '-r', '--ignore-unmatch', pathSpec]);
      }
    }
    runGit(['commit', '--allow-empty', '-m', message]);
    mergeInProgress = false;
  } catch (error) {
    if (mergeInProgress) {
      runGit(['merge', '--abort'], { allowFailure: true, quiet: true });
    }
    throw error;
  }
}

function syncBranches(frontendBranches, backendBranches) {
  const branchNames = new Set([...frontendBranches, ...backendBranches]);
  branchNames.delete(MAIN_BRANCH);
  for (const branch of branchNames) {
    if (branchExists(branch)) {
      console.log(`Branch ${branch} already exists locally, skipping.`);
      continue;
    }
    runGit(['checkout', '-b', branch, MAIN_BRANCH]);
    if (frontendBranches.has(branch)) {
      mergeAbsorb(
        namespaceRef(FRONTEND_NAMESPACE, 'heads', branch),
        `Merge frontend ${branch} into ${branch}`,
        ['frontend']
      );
    }
    if (backendBranches.has(branch)) {
      mergeAbsorb(
        namespaceRef(BACKEND_NAMESPACE, 'heads', branch),
        `Merge backend ${branch} into ${branch}`,
        ['backend']
      );
    }
    runGit(['checkout', MAIN_BRANCH]);
  }
}

function computeTagPlan(frontendTags, backendTags) {
  const planByBase = new Map();
  for (const [name, ref] of frontendTags.entries()) {
    if (!planByBase.has(name)) {
      planByBase.set(name, { base: name });
    }
    planByBase.get(name).frontend = { name, ref };
  }
  for (const [name, ref] of backendTags.entries()) {
    const base = name.endsWith('.RELEASE') ? name.slice(0, -'.RELEASE'.length) : name;
    if (!planByBase.has(base)) {
      planByBase.set(base, { base });
    }
    planByBase.get(base).backend = { name, ref };
  }
  const plan = [];
  for (const entry of planByBase.values()) {
    const tagNames = [];
    const obsoleteTags = [];
    if (entry.frontend && entry.backend) {
      tagNames.push(entry.base);
      if (entry.frontend.name !== entry.base) {
        obsoleteTags.push(entry.frontend.name);
      }
      if (entry.backend.name !== entry.base) {
        obsoleteTags.push(entry.backend.name);
      }
    } else if (entry.frontend) {
      tagNames.push(entry.frontend.name);
    } else if (entry.backend) {
      const canonicalName = entry.backend.name.endsWith('.RELEASE')
        ? entry.base
        : entry.backend.name;
      tagNames.push(canonicalName);
      if (entry.backend.name !== canonicalName) {
        obsoleteTags.push(entry.backend.name);
      }
    }
    if (tagNames.length === 0) {
      continue;
    }
    plan.push({
      tagNames,
      frontend: entry.frontend || null,
      backend: entry.backend || null,
      obsoleteTags,
    });
  }
  return plan;
}

function syncTag(planEntry, context) {
  const {
    baseEntries,
    frontendMainCommit,
    backendMainCommit,
  } = context;

  const entries = cloneTreeEntries(baseEntries);

  const frontendSourceCommit = planEntry.frontend
    ? resolveCommit(planEntry.frontend.ref, `frontend tag ${planEntry.frontend.name}`)
    : frontendMainCommit;
  const backendSourceCommit = planEntry.backend
    ? resolveCommit(planEntry.backend.ref, `backend tag ${planEntry.backend.name}`)
    : backendMainCommit;

  const frontendTreeHash = getDirectoryTreeHash(
    frontendSourceCommit,
    'frontend',
    planEntry.frontend ? `frontend tag ${planEntry.frontend.name}` : `frontend ${MAIN_BRANCH}`,
  );
  const backendTreeHash = getDirectoryTreeHash(
    backendSourceCommit,
    'backend',
    planEntry.backend ? `backend tag ${planEntry.backend.name}` : `backend ${MAIN_BRANCH}`,
  );

  entries.set('frontend', {
    mode: '040000',
    type: 'tree',
    hash: frontendTreeHash,
    path: 'frontend',
  });
  entries.set('backend', {
    mode: '040000',
    type: 'tree',
    hash: backendTreeHash,
    path: 'backend',
  });

  const treeHash = createTreeFromEntries(entries);

  const parents = [];
  const addParent = (hash) => {
    if (!hash) return;
    if (!parents.includes(hash)) {
      parents.push(hash);
    }
  };
  if (planEntry.frontend) {
    addParent(frontendSourceCommit);
  } else {
    addParent(frontendMainCommit);
  }
  if (planEntry.backend) {
    addParent(backendSourceCommit);
  } else {
    addParent(backendMainCommit);
  }

  const descriptionParts = [];
  if (planEntry.frontend) {
    descriptionParts.push(`frontend ${planEntry.frontend.name}`);
  } else {
    descriptionParts.push(`frontend ${MAIN_BRANCH}`);
  }
  if (planEntry.backend) {
    descriptionParts.push(`backend ${planEntry.backend.name}`);
  } else {
    descriptionParts.push(`backend ${MAIN_BRANCH}`);
  }

  const description = descriptionParts.join(' + ');
  const commitArgs = ['commit-tree', treeHash];
  for (const parent of parents) {
    commitArgs.push('-p', parent);
  }
  commitArgs.push('-m', `Merge tag snapshot: ${description}`);
  const commitResult = runGit(commitArgs, { capture: true, quiet: true });
  if (!commitResult.ok || !commitResult.stdout) {
    throw new Error(`Failed to create tag commit for ${planEntry.tagNames[0]}`);
  }
  const commit = commitResult.stdout;
  for (const tagName of planEntry.tagNames) {
    forceTag(tagName, commit, `Monorepo snapshot ${tagName}: ${description}`);
  }
  if (Array.isArray(planEntry.obsoleteTags)) {
    for (const obsolete of planEntry.obsoleteTags) {
      if (!obsolete || planEntry.tagNames.includes(obsolete)) {
        continue;
      }
      runGit(['tag', '-d', obsolete], { allowFailure: true, quiet: true });
    }
  }
}

function syncTags(frontendTags, backendTags) {
  const plan = computeTagPlan(frontendTags, backendTags);
  if (plan.length === 0) {
    return;
  }
  const monorepoMainCommit = resolveCommit(MAIN_BRANCH, 'monorepo main branch');
  const baseEntries = listTreeEntries(monorepoMainCommit);
  const frontendMainCommit = resolveCommit(
    namespaceRef(FRONTEND_NAMESPACE, 'heads', MAIN_BRANCH),
    'frontend main branch',
  );
  const backendMainCommit = resolveCommit(
    namespaceRef(BACKEND_NAMESPACE, 'heads', MAIN_BRANCH),
    'backend main branch',
  );
  const context = {
    baseEntries,
    frontendMainCommit,
    backendMainCommit,
  };
  for (const entry of plan) {
    syncTag(entry, context);
  }
}

function addSourceRemote(name, url) {
  const remotes = runGit(['remote'], { capture: true, quiet: true }).stdout.split('\n').filter(Boolean);
  if (remotes.includes(name)) {
    return;
  }
  runGit(['remote', 'add', name, url]);
}

function main() {
  ensureInsideGitRepository();
  ensureCleanWorkingTree();
  ensureGitFilterRepoAvailable();
  importRemote(FRONTEND_REMOTE_URL, 'frontend', FRONTEND_NAMESPACE);
  importRemote(BACKEND_REMOTE_URL, 'backend', BACKEND_NAMESPACE);
  const frontendMainRef = namespaceRef(FRONTEND_NAMESPACE, 'heads', MAIN_BRANCH);
  const backendMainRef = namespaceRef(BACKEND_NAMESPACE, 'heads', MAIN_BRANCH);
  ensureNamespaceRefExists(frontendMainRef, 'Frontend main branch');
  ensureNamespaceRefExists(backendMainRef, 'Backend main branch');
  ensureInitialMainBranch();
  forceTag(PRE_BOOTSTRAP_TAG, 'HEAD', 'Monorepo snapshot pre-bootstrap state');
  mergeAbsorb(frontendMainRef, `Merge frontend ${MAIN_BRANCH} into ${MAIN_BRANCH}`, ['frontend']);
  mergeAbsorb(backendMainRef, `Merge backend ${MAIN_BRANCH} into ${MAIN_BRANCH}`, ['backend']);
  forceTag(POST_BOOTSTRAP_TAG, 'HEAD', 'Monorepo snapshot post-bootstrap state');
  const frontendBranches = getNamespaceBranchSet(FRONTEND_NAMESPACE);
  const backendBranches = getNamespaceBranchSet(BACKEND_NAMESPACE);
  syncBranches(frontendBranches, backendBranches);
  const frontendTags = getNamespaceTagMap(FRONTEND_NAMESPACE);
  const backendTags = getNamespaceTagMap(BACKEND_NAMESPACE);
  syncTags(frontendTags, backendTags);
  runGit(['checkout', MAIN_BRANCH]);
  addSourceRemote('frontend', FRONTEND_REMOTE_URL);
  addSourceRemote('backend', BACKEND_REMOTE_URL);
  console.log('Monorepo creation finished.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
