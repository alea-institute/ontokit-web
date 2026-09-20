import { describe, expect, it } from 'vitest';
import { extractIndividualDetail } from '@/lib/ontology/entityDetailExtractors';
import { updateIndividualInTurtle } from '@/lib/ontology/turtleIndividualUpdater';
import { parseBlockTriples } from '@/lib/ontology/turtleBlockParser';
import { parseExistingTurtleBlock } from '@/lib/ontology/turtleUtils';

const iri = (name: string) => `https://example.test/${name}`;
const source = `@prefix ex: <https://example.test/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
ex:age a owl:DatatypeProperty .
ex:enabled a owl:DatatypeProperty .
ex:note a owl:AnnotationProperty .
ex:Person a owl:NamedIndividual ;
  ex:age "42"^^xsd:integer ;
  ex:enabled true ;
  ex:note "Keep note" ;
  ex:unknown "Keep unknown" .
`;

describe('individual property declarations through extract, write and reparse', () => {
  it('classifies explicitly declared data properties without treating unknown literals as data', () => {
    const detail = extractIndividualDetail(source, iri('Person'))!;
    expect(detail.dataPropertyAssertions).toEqual([
      expect.objectContaining({ propertyIri: iri('age'), value: '42', datatype: 'http://www.w3.org/2001/XMLSchema#integer' }),
      expect.objectContaining({ propertyIri: iri('enabled'), value: 'true', datatype: 'http://www.w3.org/2001/XMLSchema#boolean' }),
    ]);
    expect(detail.annotations.map(item => item.property_iri)).toEqual([iri('note'), iri('unknown')]);
  });

  it('removes declared data assertions through the real writer while retaining annotations and declarations', () => {
    const detail = extractIndividualDetail(source, iri('Person'))!;
    const updated = updateIndividualInTurtle(source, iri('Person'), { ...detail, dataPropertyAssertions: [] });
    expect(parseBlockTriples(updated, iri('Person'))?.some(triple => [iri('age'), iri('enabled')].includes(triple.predicate))).toBe(false);
    expect(extractIndividualDetail(updated, iri('Person'))?.annotations).toEqual(detail.annotations);
    expect(parseBlockTriples(updated, iri('age'))).toEqual(parseBlockTriples(source, iri('age')));
  });
});

it.each([
  ['42', 'integer'], ['-0.5', 'decimal'], ['1.2e3', 'double'],
])('preserves the datatype of bare %s through extraction and writing', (value, datatype) => {
  const input = source.replace('"42"^^xsd:integer', value);
  const parsed = extractIndividualDetail(input, iri('Person'))!;
  expect(parsed.dataPropertyAssertions[0]).toMatchObject({ value, datatype: `http://www.w3.org/2001/XMLSchema#${datatype}` });
  const updated = updateIndividualInTurtle(input, iri('Person'), parsed);
  expect(extractIndividualDetail(updated, iri('Person'))?.dataPropertyAssertions).toEqual(parsed.dataPropertyAssertions);
});

it('finds a numeric prefixed subject without matching an earlier reference to it', () => {
  const input = '@prefix ex: <https://example.test/> .\nex:Other ex:ref ex:43 .\nex:43 ex:note "numeric subject" .';
  expect(parseBlockTriples(input, iri('43'))).toEqual([{ predicate: iri('note'), object: { type: 'literal', value: 'numeric subject' } }]);
});

it.each(['Person', 'Foo.Bar', 'Foo..Bar', 'Café', '東京', 'part:one'].flatMap(name => [' .', ' .# retained comment'].map(terminator => [name, terminator])))('finds and updates %s following terminator %s', (name, terminator) => {
  const input = `@prefix ex: <https://example.test/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
ex:Other a owl:NamedIndividual${terminator}
ex:${name} a owl:NamedIndividual ; ex:note "Original" .
`;
  const parsed = extractIndividualDetail(input, iri(name));
  expect(parsed?.annotations).toEqual([{ property_iri: iri('note'), values: [{ value: 'Original', lang: '' }] }]);
  const output = updateIndividualInTurtle(input, iri(name), { ...parsed!, annotations: [{ property_iri: iri('note'), values: [{ value: 'Updated', lang: '' }] }] });
  expect(output).toContain(`ex:Other a owl:NamedIndividual${terminator}`);
  expect(extractIndividualDetail(output, iri(name))?.annotations).toEqual([{ property_iri: iri('note'), values: [{ value: 'Updated', lang: '' }] }]);
});

it.each(['Foo.Bar', 'Café'])('never replaces %s in another namespace or an object-only occurrence', name => {
  const input = `@prefix ex: <https://example.test/> .
@prefix other: <https://other.test/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
other:${name} a owl:NamedIndividual .# unrelated subject
ex:Ref ex:target
# object starts on its own line
ex:${name} .
`;
  expect(extractIndividualDetail(input, iri(name))).toBeNull();
  const unrelated = extractIndividualDetail(input, `https://other.test/${name}`)!;
  expect(() => updateIndividualInTurtle(input, iri(name), unrelated)).toThrow('Could not find individual');
});

it('parses dotted predicates and objects without absorbing a comment-adjacent terminator', () => {
  const input = '@prefix ex: <https://example.test/> .\nex:Subject ex:has.value ex:Foo.Bar.# retained comment';
  expect(parseBlockTriples(input, iri('Subject'))).toEqual([{ predicate: iri('has.value'), object: { type: 'iri', value: iri('Foo.Bar') } }]);
});

it.each(['Foo.Bar', 'Café', '東京'])('preserves the complete %s subject when splitting its existing predicates', name => {
  expect(parseExistingTurtleBlock(`ex:${name} ex:note "Keep" ; ex:target ex:Other .`)).toEqual({
    subject: `ex:${name}`,
    predicateObjects: [{ predicate: 'ex:note', text: 'ex:note "Keep"' }, { predicate: 'ex:target', text: 'ex:target ex:Other' }],
  });
});
