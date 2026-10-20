// BAIF rehearsal pins: upstream commits, hashes and the classes the rehearsal drives.
// Pure data with no import.meta, so Playwright's CommonJS loader can import it through
// scripts/e2e/evidence.mjs.
import { DEFAULT_BASE } from '../ctt/turtle.mjs';

export const UPSTREAM = Object.freeze({
  folio: Object.freeze({
    file: 'FOLIO.owl', mimeType: 'application/rdf+xml', license: 'CC-BY-4.0',
    repository: 'alea-institute/FOLIO', commit: 'a8f0d29f8ee78e3bf358ffa5f69edba74c076240', path: 'FOLIO.owl',
    sha256: '44657b4ed844f5f9c9c48869184606b4fc671471a8263d79d241de87809fa239',
  }),
  catholic: Object.freeze({
    file: 'ontology-semantic-canon.ttl', mimeType: 'text/turtle', license: 'Apache-2.0',
    repository: 'CatholicOS/ontology-semantic-canon', commit: '935bc5ac8acbe005ab1ba7cd8dfe920d81302890', path: 'sources/ontology-semantic-canon.ttl',
    sha256: '58d55f92863e21cb26078f43b254818e69c4f591df2aa33fc25730bd869dcc27',
  }),
});
/**
 * The classes the rehearsal edits and inspects. Each must exist in its pinned input;
 * `prepareSources` checks that, so a FOLIO or Catholic release that drops one fails
 * here rather than in the browser.
 */
// `marker` is how each class's subject appears in its source text.
export const TARGETS = Object.freeze({
  // The edit aligns the label with the class's own definition ("…developed by the Catholic Church…").
  folio: Object.freeze({source: 'folio', iri: 'https://folio.openlegalstandard.org/RCgMu5ynvcgBz5w6ozBAgRO', marker: 'rdf:about="https://folio.openlegalstandard.org/RCgMu5ynvcgBz5w6ozBAgRO"', label: 'Canon Law', edited: 'Canon Law (Catholic Church)'}),
  // "Apostolic See" is the canonical synonym (CIC can. 361); the class already lists it as an altLabel.
  catholic: Object.freeze({source: 'catholicCtt', iri: 'https://ontology.catholicos.catholic/R260045C217a98CBd28916cc', marker: '<R260045C217a98CBd28916cc> a owl:Class', label: 'Holy See', edited: 'Holy See (Apostolic See)'}),
  cttRoot: Object.freeze({source: 'catholicCtt', iri: `${DEFAULT_BASE}Term`, marker: 'ctt:Term a owl:Class', label: 'CTT term'}),
  cttFalseFriends: Object.freeze({source: 'catholicCtt', iri: `${DEFAULT_BASE}FalseFriend`, marker: 'ctt:FalseFriend a owl:Class', label: 'CTT false friend'}),
  // A false friend: the Magisterium mostly means diplomatic letters of credence.
  cttTerm: Object.freeze({source: 'catholicCtt', iri: `${DEFAULT_BASE}term/credence`, marker: `<${DEFAULT_BASE}term/credence> a owl:Class`, label: 'credence'}),
});

