# CTT taxonomy import

CTT (Taxonomy Working Group, CTT:AI, prepared for BAIF in Rome on 2026-11-05/06) measures how
250 words are used across 24 communities. It publishes no export or API yet. Every verdict on
the site is labelled **uncalibrated**: no verdict has been checked against human judgment.

OntoKit imports CTT into the Catholic OS ontology in three steps:

1. **Source → snapshot.** A source produces a `ctt-snapshot/v1` JSON document. Today the only
   source is the public pages (`scripts/ctt/pages.mjs`). When the Working Group publishes a
   structured export, that export replaces the scrape through `--export`, and nothing
   downstream changes.
2. **Snapshot → OWL module.** `scripts/ctt/turtle.mjs` writes a Turtle module.
3. **Module → Catholic ontology.** The module is appended to the Catholic OS Turtle. The
   merge refuses to rebind a prefix the host already uses.

```sh
# Live site → module, snapshot and merged Catholic ontology
NODE_USE_ENV_PROXY=1 node scripts/ctt/import.mjs \
  --out ctt.ttl --snapshot-out ctt-snapshot.json \
  --merge-into ontology-semantic-canon.ttl --merged-out catholic-os-ctt.ttl

# Saved pages (index.html, vocabulary.html, findings.html) or a structured export
node scripts/ctt/import.mjs --html-dir ./pages --out ctt.ttl
node scripts/ctt/import.mjs --export ctt-snapshot.json --out ctt.ttl

# Options: --base <IRI> (namespace, default below), --omit-quotes (drop quotations)
```

## What the page source reads

The page source reads only what the public pages already show:

| Page | Fields |
|---|---|
| `/vocabulary/` | Every word, its sense count or verdict tag, its false-friend pair count, the 24-community legend (code, name, group) and the build stamp |
| `/` (home) | Core words: community count, use count, and the senses named by their top substitutes (with part of speech where given) |
| `/findings/` | Each false friend: its senses, the community pair with the largest difference, and the published quotations with attribution |

The site publishes only counts, labels, and quotations of at most twelve words on either side
of the word, and so does the import. The parser keys on accessible names (`aria-label`) and
stable classes. It **fails closed** in three cases:

- The totals the page states (all words, communities, core words, false friends) disagree
  with what the parser read.
- A tag is unfamiliar.
- The "Uncalibrated" banner is gone. A person should decide what that change means; the
  scrape never upgrades calibration on its own.

## `ctt-snapshot/v1`

`scripts/ctt/snapshot.mjs` (`validateSnapshot`) enforces this contract. It drops unknown keys,
and it rejects anything else outside the shape below, including quotations over the published
length.

```jsonc
{
  "schema": "ctt-snapshot/v1",
  "source": {
    "kind": "html-pages" | "structured-export",
    "site": "https://ctt.jaces.com/",
    "build": {"date": "2026-10-19", "commit": "f66099a"},   // optional fields
    "retrievedAt": "2026-10-20T19:07:05.916Z"
  },
  "calibration": "uncalibrated" | "calibrated",
  "communities": [{"code": "MAG", "label": "Magisterium", "group": "Theology"}],
  "terms": [{
    "slug": "credence",                 // lower-case; the site's anchor is #t-<slug>
    "label": "credence",
    "verdict": "one-sense" | "multi-sense" | "false-friend" | "no-verdict",
    "senseCount": 2,                    // null exactly when verdict is no-verdict
    "communityCount": null, "useCount": null,   // optional counts
    "core": false,
    "senses": [{"partOfSpeech": "noun", "substitutes": ["weight", "validity", "support"]}],
    "falseFriend": {"pairCount": 4, "strongestPair": ["Alignment research community (Alignment Forum)", "Magisterium"]},
    "examples": [{"quote": "…", "community": "Magisterium", "work": "Title, 1997"}]
  }]
}
```

An export can carry richer data later, such as per-pair verdicts or per-community counts.
Extend the schema with a `v2` and a writer change at that point; do not overload `v1` fields.

## The OWL module

The module uses the `ctt:` namespace, `https://ontology.catholicos.catholic/ctt/` by default.
It declares no `owl:Ontology`, so the Catholic OS header stays in charge.

| Resource | Shape |
|---|---|
| `ctt:Term` | Root class "CTT term". It carries the calibration status, the site build and `dcterms:source` |
| `ctt:FalseFriend`, `ctt:CoreWord` | Subclasses of `ctt:Term` |
| `ctt:term/<slug>` | One `owl:Class` per word, under its most specific CTT class. Carries `rdfs:label` and `skos:prefLabel`, `ctt:verdict`, `ctt:calibrationStatus`, counts, one `ctt:senseSubstitutes` per sense, false-friend pair data, `skos:example` quotations with attribution, and `rdfs:seeAlso` to its vocabulary entry |
| `ctt:community/<CODE>` | `owl:NamedIndividual` of `ctt:Community`, with a code and a group |

Regenerate the module; do not edit it by hand. The 2026-10-20 import produced 250 terms
(201 one-sense, 30 multi-sense, 13 no-verdict, 6 false friends), 24 communities and 8 core
words. Merged with Catholic OS commit `935bc5a`, it yields 15,228 classes, which rdflib parses.
