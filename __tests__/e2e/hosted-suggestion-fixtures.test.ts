// @vitest-environment node
import {describe, it, expect, vi} from 'vitest';
import {mkdtemp, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {trackProjectImport, finishSuggestionResources} from '../../e2e/fixtures/suggestion-resources';

describe('hosted suggestion fixture preservation', () => {
  it('persists intent before import and the created ID before subsequent setup can fail', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ow2-fixture-'));
    const run = {id: 'a'.repeat(32), dir, hosted: {retain: true}};
    const ledger = path.join(dir, 'owned-resources.jsonl');
    const marker = `ontokit-e2e-run:${run.id}:suggestions:1`;
    const project = await trackProjectImport(run, marker, async () => {
      expect(await readFile(ledger, 'utf8')).toContain('import-intent');
      return {id: 'owned-project'};
    });
    expect(project.id).toBe('owned-project');
    expect(await readFile(ledger, 'utf8')).toContain('owned-project');
    const remove = vi.fn();
    await finishSuggestionResources(run, remove);
    expect(remove).not.toHaveBeenCalled();
  });
  it('retains recovery marker after an ambiguous import failure', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ow2-failed-fixture-'));
    const run = {id: 'b'.repeat(32), dir, hosted: {retain: true}};
    await expect(trackProjectImport(run, 'run-owned-marker', async () => {throw new Error('transport failed');})).rejects.toThrow('transport failed');
    expect(await readFile(path.join(dir, 'owned-resources.jsonl'), 'utf8')).toContain('run-owned-marker');
    const remove = vi.fn();
    await finishSuggestionResources(run, remove);
    expect(remove).not.toHaveBeenCalled();
  });
  it('keeps isolated import and finalizer behavior intact', async () => {
    const create = vi.fn(async () => ({id: 'isolated-project'})), remove = vi.fn(async () => {});
    const run = {id: 'c'.repeat(32), dir: '/unused-isolated-fixture'};
    expect(await trackProjectImport(run, 'isolated', create)).toEqual({id: 'isolated-project'});
    await finishSuggestionResources(run, remove);
    expect(create).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });
});
