export interface GuideChapter {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
}

export const guideChapters: GuideChapter[] = [
  {
    slug: "introduction",
    title: "What is an Ontology?",
    shortTitle: "Introduction",
    description:
      "Learn what ontologies are, why they matter, and how they power the Semantic Web.",
  },
  {
    slug: "types",
    title: "What are the Types of Ontologies?",
    shortTitle: "Types",
    description:
      "Explore the spectrum from lightweight taxonomies to heavyweight formal ontologies.",
  },
  {
    slug: "formats",
    title: "What are the Ontology Formats?",
    shortTitle: "Formats",
    description:
      "Understand RDF serialization formats like Turtle, RDF/XML, JSON-LD, and more.",
  },
  {
    slug: "syntax",
    title: "What is an Ontology Syntax?",
    shortTitle: "Syntax",
    description:
      "Compare Manchester Syntax, Functional Syntax, OWL/XML, and Turtle for expressing OWL.",
  },
  {
    slug: "vocabularies",
    title: "What is an Ontology Vocabulary?",
    shortTitle: "Vocabularies",
    description:
      "Discover standard vocabularies like RDFS, Dublin Core, SKOS, FOAF, and Schema.org.",
  },
  {
    slug: "properties",
    title: "What are Properties?",
    shortTitle: "Properties",
    description:
      "From the base rdf:Property to OWL's three property kinds, characteristic axioms (functional, transitive, …), and disjointness.",
  },
];

export function getAdjacentChapters(currentSlug: string) {
  const index = guideChapters.findIndex((c) => c.slug === currentSlug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? guideChapters[index - 1] : null,
    next: index < guideChapters.length - 1 ? guideChapters[index + 1] : null,
  };
}
