// @vitest-environment node
import { spawn } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let directory: string;
let environment: NodeJS.ProcessEnv;
const repository = resolve(__dirname, '../..');
function run(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done, reject) => {
    const child = spawn(command, args, { cwd: directory, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); process.stderr.write(chunk); });
    child.on('error', reject);
    child.on('close', code => done({ code, stdout, stderr }));
  });
}
async function git(...args: string[]) {
  const result = await run('git', args);
  expect(result.code, JSON.stringify(result)).toBe(0);
  return result.stdout.trim();
}
async function seed(version: string) {
  await writeFile(join(directory, 'package.json'), `${JSON.stringify({ name: 'fixture-package', version, private: true }, null, 2)}\n`);
  await git('add', 'package.json', 'scripts');
  await git('commit', '-m', 'fixture baseline');
}
const version = async () => JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).version;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ontokit-version-script-'));
  // Use only local tooling; disable external Git configuration, hooks, signing,
  // npm user configuration and networking in this disposable repository.
  environment = {
    PATH: process.env.PATH, NODE_ENV: "test",
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Test fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Test fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    npm_config_userconfig: join(directory, 'npm-user-config'), npm_config_globalconfig: join(directory, 'npm-global-config'),
    npm_config_cache: join(directory, 'npm-cache'), npm_config_offline: 'true', npm_config_update_notifier: 'false',
  };
  await writeFile(join(directory, 'npm-user-config'), '');
  await writeFile(join(directory, 'npm-global-config'), '');
  await mkdir(join(directory, 'scripts'));
  for (const name of ['set-version.mjs', 'prepare-release.mjs']) await copyFile(join(repository, 'scripts', name), join(directory, 'scripts', name));
  await git('init', '-b', 'test/coverage-20260919');
  await git('config', 'core.hooksPath', '/dev/null');
  await git('config', 'commit.gpgsign', 'false');
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

describe('version commands in disposable Git repositories', () => {
  it.each([
    { script: 'set-version.mjs', args: ['0.5.0'] },
    { script: 'prepare-release.mjs', args: [] },
  ])('$script leaves unrelated staged changes out of its commit', async ({ script, args }) => {
    await seed('0.4.0-dev');
    await writeFile(join(directory, 'unrelated.txt'), 'user work\n');
    await git('add', 'unrelated.txt');
    const stagedBlob = await git('rev-parse', ':unrelated.txt');

    const result = await run(process.execPath, [`scripts/${script}`, ...args]);

    expect(result.code, JSON.stringify(result)).toBe(0);
    expect(await git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).toBe('package.json');
    expect(await git('diff', '--cached', '--name-only')).toBe('unrelated.txt');
    expect(await git('rev-parse', ':unrelated.txt')).toBe(stagedBlob);
    expect(await readFile(join(directory, 'unrelated.txt'), 'utf8')).toBe('user work\n');
  });

  it('sets a development version and commits the actual package change', async () => {
    await seed('0.3.0');
    const result = await run(process.execPath, ['scripts/set-version.mjs', '0.4.0']);
    expect(result.code, JSON.stringify(result)).toBe(0);
    expect(await version()).toBe('0.4.0-dev');
    expect(await git('log', '-1', '--format=%s')).toBe('chore: setting version to 0.4.0-dev');
    expect(await git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).toBe('package.json');
    expect(await git('diff', '--name-only')).toBe('');
  });

  it.each([{ args: [] }, { args: ['1.2'] }, { args: ['1.2.3-dev'] }, { args: ['not-a-version'] }])('rejects invalid development arguments $args without changing the package or history', async ({ args }) => {
    await seed('0.3.0'); const before = await git('rev-parse', 'HEAD');
    const result = await run(process.execPath, ['scripts/set-version.mjs', ...args]);
    expect(result.code).toBe(1);
    expect(await version()).toBe('0.3.0');
    expect(await git('rev-parse', 'HEAD')).toBe(before);
    expect(await git('diff', '--name-only')).toBe('');
  });

  it.each(['0.4.0-dev', '0.4.0-rc'])('prepares %s and records the release without tagging or pushing', async current => {
    await seed(current);
    const result = await run(process.execPath, ['scripts/prepare-release.mjs']);
    expect(result.code, JSON.stringify(result)).toBe(0);
    expect(await version()).toBe('0.4.0');
    expect(await git('log', '-1', '--format=%s')).toBe('chore: releasing 0.4.0');
    expect(await git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).toBe('package.json');
    expect(await git('tag', '--list')).toBe('');
    expect(await git('remote')).toBe('');
  });

  it.each([
    { script: 'set-version.mjs', args: ['0.4.0'] },
    { script: 'prepare-release.mjs', args: [] },
  ])('fails $script without committing when the package cannot be parsed', async ({ script, args }) => {
    await seed('0.4.0-dev'); const before = await git('rev-parse', 'HEAD');
    const invalidPackage = '{"version":';
    await writeFile(join(directory, 'package.json'), invalidPackage);
    const result = await run(process.execPath, [`scripts/${script}`, ...args]);
    expect(result.code).not.toBe(0);
    expect(await readFile(join(directory, 'package.json'), 'utf8')).toBe(invalidPackage);
    expect(await git('rev-parse', 'HEAD')).toBe(before);
    expect(await git('diff', '--name-only')).toBe('package.json');
  });

  it('refuses an already released version without changing the package or history', async () => {
    await seed('0.4.0'); const before = await git('rev-parse', 'HEAD');
    const result = await run(process.execPath, ['scripts/prepare-release.mjs']);
    expect(result.code).toBe(1);
    expect(await version()).toBe('0.4.0');
    expect(await git('rev-parse', 'HEAD')).toBe(before);
  });

});
