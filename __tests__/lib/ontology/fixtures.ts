/**
 * Shared Turtle source fixture used across ontology test suites.
 */

export const TURTLE_FIXTURE = `\
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix dc:   <http://purl.org/dc/elements/1.1/> .
@prefix ex:   <http://example.org/ont#> .

ex:Animal a owl:Class ;
    rdfs:label "Animal"@en ;
    rdfs:comment "A living organism"@en .

ex:Dog a owl:Class ;
    rdfs:label "Dog"@en ;
    rdfs:comment "A domesticated canine"@en ;
    rdfs:subClassOf ex:Animal .

ex:hasPart a owl:ObjectProperty ;
    rdfs:label "has part"@en ;
    rdfs:domain ex:Animal ;
    rdfs:range ex:Animal .

ex:hasAge a owl:DatatypeProperty ;
    rdfs:label "has age"@en ;
    rdfs:domain ex:Animal ;
    rdfs:range xsd:integer .

ex:note a owl:AnnotationProperty ;
    rdfs:label "note"@en .

ex:fido a owl:NamedIndividual, ex:Dog ;
    rdfs:label "Fido"@en ;
    rdfs:comment "A specific dog"@en ;
    ex:hasAge "5"^^xsd:integer .
`;

/**
 * Minimal Turtle source with @base declaration.
 */
export const TURTLE_WITH_BASE = `\
@base <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

<Animal> a owl:Class ;
    rdfs:label "Animal"@en .
`;

/**
 * Turtle with PREFIX (SPARQL-style) declarations.
 */
export const TURTLE_SPARQL_PREFIX = `\
PREFIX ex: <http://example.org/ont#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

ex:Cat a owl:Class ;
    rdfs:label "Cat"@en .
`;

/**
 * Turtle with default (empty) prefix.
 */
export const TURTLE_DEFAULT_PREFIX = `\
@prefix : <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

:Bird a owl:Class ;
    rdfs:label "Bird"@en .
`;

/**
 * Turtle with nested blank nodes and multi-value predicates.
 */
export const TURTLE_COMPLEX = `\
@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:Person a owl:Class ;
    rdfs:label "Person"@en, "Persona"@es ;
    rdfs:comment "A human being"@en ;
    rdfs:subClassOf [
        a owl:Restriction ;
        owl:onProperty ex:hasAge ;
        owl:someValuesFrom xsd:integer
    ] .

ex:isPartOf a owl:ObjectProperty, owl:TransitiveProperty ;
    rdfs:label "is part of"@en ;
    owl:inverseOf ex:hasPart .
`;

/**
 * Turtle source with a deprecated property and multiple characteristics.
 */
export const TURTLE_PROPERTY_RICH = `\
@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:hasFriend a owl:ObjectProperty, owl:SymmetricProperty ;
    rdfs:label "has friend"@en ;
    skos:definition "Relates a person to a friend"@en ;
    rdfs:domain ex:Person ;
    rdfs:range ex:Person ;
    rdfs:subPropertyOf ex:knows ;
    owl:inverseOf ex:friendOf ;
    owl:equivalentProperty ex:hasBuddy ;
    owl:propertyDisjointWith ex:hasEnemy ;
    rdfs:seeAlso ex:socialRelation ;
    rdfs:isDefinedBy <http://example.org/ont> ;
    owl:deprecated true .
`;

/**
 * Turtle source with an individual that has multiple types and property assertions.
 */
export const TURTLE_INDIVIDUAL_RICH = `\
@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:john a owl:NamedIndividual, ex:Person, ex:Employee ;
    rdfs:label "John"@en ;
    rdfs:comment "An employee"@en ;
    skos:definition "John Doe"@en ;
    owl:sameAs ex:johnDoe ;
    owl:differentFrom ex:janeDoe ;
    ex:hasAge "30"^^xsd:integer ;
    ex:hasFriend ex:jane ;
    owl:deprecated true ;
    rdfs:seeAlso ex:employees ;
    rdfs:isDefinedBy <http://example.org/ont> .
`;

/**
 * Turtle with long (triple-quoted) strings and comments.
 */
export const TURTLE_LONG_STRINGS = `\
@prefix ex: <http://example.org/ont#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# This is a comment
ex:DocClass a owl:Class ;
    rdfs:label "DocClass"@en ;
    rdfs:comment """A class with a
multi-line comment"""@en .
`;
