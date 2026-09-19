import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeneratedEntityPersistenceQueue, GeneratedEntitySaveError, persistGeneratedEntity } from '@/lib/editor/generatedEntityPersistence';
import { parseBlockTriples } from '@/lib/ontology/turtleBlockParser';
import { jsonResponse } from '../../fixtures/llm-hook-harness';

const ns = 'http://example.org/';
const source = '@prefix ex: <http://example.org/> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\nex:Parent a owl:Class .\n';
const options = { mode: 'direct' as const, projectId: 'project', branch: 'main', accessToken: 'token', ontologyPrefix: 'ex', ontologyNamespace: ns, entity: { iri: ns + 'Child', label: 'Child', parentIri: ns + 'Parent', entityType: 'class' as const } };
function server(initial = source) {
  let content = initial; let revision = 1; let reject = false;
  const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      if (reject) return jsonResponse({ detail: 'Write denied' }, 403);
      const body = JSON.parse(String(init.body));
      expect(body.base_revision).toBe(`r${revision}`);
      content = body.content; revision++;
      return jsonResponse({ success: true, commit_hash: `r${revision}`, branch: 'main', commit_message: body.commit_message });
    }
    return jsonResponse({ content, revision: `r${revision}`, project_id: 'project', version: 'main', filename: 'ontology.ttl' });
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, deny: () => { reject = true; }, content: () => content };
}
afterEach(() => vi.unstubAllGlobals());

describe('generated entity authoritative persistence', () => {
  it('serializes two real read-append-save transactions without losing either entity', async () => {
    const backend = server(); const queue = createGeneratedEntityPersistenceQueue();
    const second = { ...options, entity: { ...options.entity, iri: ns + 'Sibling', label: 'Sibling' } };
    const results = await Promise.all([queue.run('project/main', () => persistGeneratedEntity(options)), queue.run('project/main', () => persistGeneratedEntity(second))]);
    expect(results.map(result => result.revision)).toEqual(['r2', 'r3']);
    expect(parseBlockTriples(backend.content(), ns + 'Child')).toContainEqual({ predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf', object: { type: 'iri', value: ns + 'Parent' } });
    expect(parseBlockTriples(backend.content(), ns + 'Sibling')).not.toBeNull();
    expect(backend.fetcher).toHaveBeenCalledTimes(4);
  });

  it('treats an authoritative entity as an idempotent retry and preserves the committed revision', async () => {
    const { fetcher } = server();
    const first = await persistGeneratedEntity(options);
    const retry = await persistGeneratedEntity(options);
    expect(retry).toEqual(first);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
  });

  it('carries a parseable generated draft when the HTTP save is denied', async () => {
    const backend = server(); backend.deny();
    const error = await persistGeneratedEntity(options).catch(error => error);
    expect(error).toBeInstanceOf(GeneratedEntitySaveError);
    expect(parseBlockTriples(error.draftContent, ns + 'Child')).not.toBeNull();
    expect(error.cause.status).toBe(403);
    expect(backend.content()).toBe(source);
  });

  it('rejects an empty authoritative ontology without issuing a write', async () => {
    const { fetcher } = server(' \n\t');
    await expect(persistGeneratedEntity(options)).rejects.toThrow('ontology source is empty');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { branch: undefined, accessToken: 'token', message: 'no target branch' },
    { branch: 'main', accessToken: undefined, message: 'sign in' },
  ])('validates direct-save requirements before fetching ($message)', async ({ message, ...override }) => {
    const { fetcher } = server();
    await expect(persistGeneratedEntity({ ...options, ...override })).rejects.toThrow(message);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['authenticated-suggestion', 'anonymous-suggestion'] as const)('rejects a missing %s session before reading source', async mode => {
    const { fetcher } = server();
    await expect(persistGeneratedEntity({ ...options, mode })).rejects.toThrow('suggestion session is unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects session start failure before reading a branch', async () => {
    const { fetcher } = server();
    await expect(persistGeneratedEntity({ ...options, mode: 'anonymous-suggestion', anonymousSession: { startSession: async () => null, saveToSession: async () => true } })).rejects.toThrow('no target branch');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not read an authenticated proposal without credentials', async () => {
    const { fetcher } = server();
    await expect(persistGeneratedEntity({ ...options, mode: 'authenticated-suggestion', accessToken: undefined, suggestionSession: { startSession: async () => 'suggestion/one', saveToSession: async () => true } })).rejects.toThrow('sign in');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
