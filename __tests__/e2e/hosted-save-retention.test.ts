// @vitest-environment node
import {it, expect, vi} from 'vitest';
import {mkdtemp, readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type {Page} from '@playwright/test';
const {ready} = vi.hoisted(() => ({ready: {fill: async () => {}, press: async () => {}, click: async () => {}}}));

// UI readiness is a precondition; response status and the retained file use real assertions.
vi.mock('@playwright/test', async () => {
  const {expect: check} = await import('vitest');
  const test = {extend: () => test};
  return {test, expect: (value: unknown) => value === ready
    ? {toHaveCount: async () => {}, toBeEnabled: async () => {}}
    : check(value)};
});
import {saveExistingLabel} from '../../e2e/fixtures/suggestions';
import {recordResource} from '../../scripts/e2e/hosted-resources.mjs';

it('retains an observed session before a failed save status assertion', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ow2-save-'));
  const run = {id: 'a'.repeat(32), dir, hosted: true};
  const response = {status: () => 500, url: () => 'https://api.example.test/api/v1/projects/project/suggestions/sessions/observed-session/save'};
  const page = {
    getByPlaceholder: () => ready,
    getByRole: () => ({getByRole: () => ready}),
    waitForResponse: async () => response,
  };
  await expect(saveExistingLabel(page as unknown as Page, 'https://api.example.test', 'project', 'label', false, undefined,
    sessionId => recordResource(run, {event: 'suggestion-session', projectId: 'project', sessionId}))).rejects.toThrow();
  const ledger = await readFile(path.join(dir, 'owned-resources.jsonl'), 'utf8');
  expect(JSON.parse(ledger)).toMatchObject({event: 'suggestion-session', projectId: 'project', sessionId: 'observed-session'});
});
