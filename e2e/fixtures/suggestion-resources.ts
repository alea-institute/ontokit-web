import {recordResource} from '../../scripts/e2e/hosted-suggestions.mjs';

type FixtureRun = {id: string; dir: string; hosted?: {retain: boolean}};

/** A marker survives even if the import succeeds remotely but its response is lost. */
export async function trackProjectImport<T extends {id: string}>(run: FixtureRun, marker: string, create: () => Promise<T>): Promise<T> {
  await recordResource(run, {event: 'import-intent', marker});
  const project = await create();
  await recordResource(run, {event: 'project-created', marker, id: project.id});
  return project;
}

/** Hosted data and authentication files remain private until separately backed up. */
export async function finishSuggestionResources(run: FixtureRun, isolatedCleanup: () => Promise<void>) {
  if (!run.hosted) await isolatedCleanup();
}
