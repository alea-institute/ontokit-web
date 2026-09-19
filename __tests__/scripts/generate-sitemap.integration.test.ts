// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let directory: string;
let output: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ontokit-sitemap-cli-'));
  output = join(directory, 'sitemap.xml');
  vi.stubEnv('SITEMAP_OUTPUT_PATH', output);
  vi.stubEnv('SITE_URL', 'https://ontology.example.invalid');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.invalid');
  vi.resetModules();
});
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules();
  await rm(directory, { recursive: true, force: true });
});

describe('sitemap command through the real generator and filesystem', () => {
  it.each([false, true])('writes public static routes when the backend is unavailable: %s', async unavailable => {
    const fetcher = vi.fn(async () => {
      if (unavailable) throw new TypeError('Backend unavailable');
      return Response.json({ items: [{ id: 'fixture-project', updated_at: '2026-09-19' }] });
    });
    vi.stubGlobal('fetch', fetcher);
    const logged = vi.spyOn(console, 'log');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await import('../../scripts/generate-sitemap');
    await vi.waitFor(() => expect(logged).toHaveBeenCalledWith(`Sitemap written to ${output}`));
    const xml = await readFile(output, 'utf8');
    expect(xml).toContain('<loc>https://ontology.example.invalid/docs</loc>');
    expect(xml).not.toContain('[id]');
    expect(xml).not.toContain('<loc>https://ontology.example.invalid/settings</loc>');
    if (unavailable) expect(xml).not.toContain('fixture-project');
    else expect(xml).toContain('<loc>https://ontology.example.invalid/projects/fixture-project</loc>');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.example.invalid/api/v1/projects?filter=public&limit=100&skip=0');
    expect(exit).not.toHaveBeenCalled();
  });

  it('reports filesystem failure and requests a nonzero exit without claiming success', async () => {
    output = join(directory, 'missing', 'sitemap.xml');
    vi.stubEnv('SITEMAP_OUTPUT_PATH', output);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ items: [] })));
    const logged = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await import('../../scripts/generate-sitemap');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledExactlyOnceWith(1));
    expect(error).toHaveBeenCalledWith('Failed to generate sitemap:', expect.objectContaining({ code: 'ENOENT' }));
    expect(logged).not.toHaveBeenCalledWith(`Sitemap written to ${output}`);
    await expect(readFile(output, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
