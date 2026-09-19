// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let directory: string;
let outputPath: string;
let post: typeof import('@/app/api/sitemap/route')['POST'];
let fetcher: ReturnType<typeof vi.fn>;
const request = (body: unknown) => new NextRequest('http://localhost/api/sitemap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'ontokit-sitemap-test-')); outputPath = join(directory, 'sitemap.xml');
  vi.stubEnv('SITEMAP_OUTPUT_PATH', outputPath); vi.stubEnv('SITE_URL', 'https://ontology.example.invalid');
  vi.stubEnv('REVALIDATION_SECRET', 'synthetic-revalidation-secret'); vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.invalid');
  fetcher = vi.fn(async () => Response.json({ items: [{ id: 'public-project', updated_at: '2026-09-18' }] }));
  vi.stubGlobal('fetch', fetcher); vi.resetModules(); post = (await import('@/app/api/sitemap/route')).POST;
});
afterEach(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); await rm(directory, { recursive: true, force: true }); });
const authorized = (body: Record<string, unknown>) => request({ secret: 'synthetic-revalidation-secret', ...body });

describe('sitemap route through real Next requests, generator and temporary filesystem', () => {
  it('regenerates public routes and backend project URLs into a real XML file', async () => {
    const response = await post(authorized({ action: 'regenerate' }));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ ok: true, action: 'regenerate' });
    const xml = await readFile(outputPath, 'utf8');
    expect(xml).toContain('<loc>https://ontology.example.invalid/docs</loc>');
    expect(xml).toContain('<loc>https://ontology.example.invalid/projects/public-project</loc>');
    expect(xml).toContain('<lastmod>2026-09-18</lastmod>');
    expect(xml).not.toContain('[id]'); expect(xml).not.toContain('<loc>https://ontology.example.invalid/auth/');
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('https://api.example.invalid/api/v1/projects?filter=public&limit=100&skip=0');
  });

  it('replaces duplicate URLs and removes only the exact escaped URL', async () => {
    await post(authorized({ action: 'regenerate' }));
    const target = '/projects/model.v2+(draft)';
    await post(authorized({ action: 'add', url: target, lastmod: '2026-09-17' }));
    await post(authorized({ action: 'add', url: target, lastmod: '2026-09-19' }));
    let xml = await readFile(outputPath, 'utf8');
    expect(xml.split(`<loc>https://ontology.example.invalid${target}</loc>`)).toHaveLength(2);
    expect(xml).not.toContain('2026-09-17'); expect(xml).toContain('2026-09-19');
    const response = await post(authorized({ action: 'remove', url: target }));
    expect(await response.json()).toEqual({ ok: true, action: 'remove', url: target });
    xml = await readFile(outputPath, 'utf8'); expect(xml).not.toContain(target); expect(xml).toContain('/projects/public-project');
  });

  it.each(['add', 'remove'])('rejects %s without a URL and preserves the existing file', async action => {
    await writeFile(outputPath, 'unchanged fixture');
    const response = await post(authorized({ action })); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: `url is required for ${action} action` });
    expect(await readFile(outputPath, 'utf8')).toBe('unchanged fixture'); expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unauthorized changes before any file or HTTP activity', async () => {
    await writeFile(outputPath, 'unchanged fixture');
    const response = await post(request({ secret: 'wrong-synthetic-secret', action: 'regenerate' }));
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(await readFile(outputPath, 'utf8')).toBe('unchanged fixture'); expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails closed when revalidation is unconfigured', async () => {
    vi.stubEnv('REVALIDATION_SECRET', ''); vi.resetModules(); post = (await import('@/app/api/sitemap/route')).POST;
    const response = await post(request({ secret: '', action: 'regenerate' })); expect(response.status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects unknown actions without generating output', async () => {
    const response = await post(authorized({ action: 'replace' })); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid action. Use add, remove, or regenerate.' }); expect(fetcher).not.toHaveBeenCalled();
  });

  it('regenerates a missing file when adding and safely ignores removal from a missing file', async () => {
    expect((await post(authorized({ action: 'remove', url: '/projects/gone' }))).status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await post(authorized({ action: 'add', url: '/projects/public-project' }))).status).toBe(200);
    expect(await readFile(outputPath, 'utf8')).toContain('/projects/public-project'); expect(fetcher).toHaveBeenCalledOnce();
  });

  it('still writes discovered static pages when the backend is unavailable', async () => {
    fetcher.mockRejectedValue(new Error('Offline fixture'));
    expect((await post(authorized({ action: 'regenerate' }))).status).toBe(200);
    const xml = await readFile(outputPath, 'utf8'); expect(xml).toContain('<loc>https://ontology.example.invalid/docs</loc>'); expect(xml).not.toContain('/projects/public-project');
  });
});
