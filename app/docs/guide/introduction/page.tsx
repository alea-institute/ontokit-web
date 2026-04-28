import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function IntroductionPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What is an Ontology?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        An introduction to ontologies in computer science and the Semantic Web.
      </p>

      <div className="space-y-8">
        {/* Definition */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Definition
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              In philosophy, an ontology is the study of what exists &mdash; the nature of being and{" "}
              the categories of reality. In computer science and the Semantic Web, the term has been{" "}
              borrowed to mean something more specific: a <strong>formal, explicit specification of{" "}
              a shared conceptualization</strong>.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Put simply, an ontology is a structured way to describe the concepts in a domain (such{" "}
              as medicine, law, or cultural heritage) and the relationships between them. Unlike a{" "}
              simple glossary or database schema, an ontology uses logic-based formalisms that allow{" "}
              machines to reason about the data automatically.
            </p>
          </div>
        </section>

        {/* Why Ontologies Matter */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Why Ontologies Matter
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 space-y-3">
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
              <li>
                <strong>Interoperability:</strong> Ontologies provide a common vocabulary so that{" "}
                different systems, organizations, and datasets can share and integrate data without{" "}
                ambiguity.
              </li>
              <li>
                <strong>Reasoning:</strong> Because ontologies are logic-based, reasoners can infer{" "}
                new facts that were not explicitly stated &mdash; for example, deducing that a{" "}
                &ldquo;Penguin&rdquo; is a &ldquo;Bird&rdquo; even if only the subclass chain is{" "}
                defined.
              </li>
              <li>
                <strong>Knowledge reuse:</strong> Well-designed ontologies can be shared and extended{" "}
                across projects, preventing each team from reinventing the same domain model.
              </li>
              <li>
                <strong>Data validation:</strong> Ontologies define constraints (e.g., a person must{" "}
                have exactly one birth date) that can be used to validate data quality.
              </li>
            </ul>
          </div>
        </section>

        {/* Real-World Use Cases */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Real-World Use Cases
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Biomedical Sciences
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                The Gene Ontology (GO) and SNOMED CT organize biological processes and clinical{" "}
                terminology used by researchers and hospitals worldwide.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Cultural Heritage
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                CIDOC-CRM models museum artifacts, historical events, and provenance so that{" "}
                collections across institutions can be linked together.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                E-Commerce
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Schema.org provides structured product data that search engines use to display rich{" "}
                snippets and power product comparisons.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Libraries & Publishing
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Dublin Core and BIBFRAME describe publications and library holdings, enabling{" "}
                cross-catalog search and linked open data.
              </p>
            </div>
          </div>
        </section>

        {/* The Semantic Web Stack */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            The Semantic Web Stack
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Ontologies sit at the heart of the W3C Semantic Web architecture, often visualized as{" "}
              a layered &ldquo;cake&rdquo;:
            </p>
          </div>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mt-4">
            <pre>{`  ┌───────────────────────┐
  │    Trust / Proof      │
  ├───────────────────────┤
  │    Rules (SWRL)       │
  ├───────────────────────┤
  │  Ontologies (OWL)     │  ← you are here
  ├───────────────────────┤
  │  Vocabularies (RDFS)  │
  ├───────────────────────┤
  │  Data Model (RDF)     │
  ├───────────────────────┤
  │  Identifiers (URIs)   │
  ├───────────────────────┤
  │  Syntax (XML / JSON)  │
  └───────────────────────┘`}</pre>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-3">
            Each layer builds on those below it. RDF provides the basic data model of triples (subject,{" "}
            predicate, object). RDFS adds vocabulary constructs like classes and properties. OWL adds{" "}
            formal logic for richer ontology modeling.
          </p>
        </section>

        {/* Key Terms */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Key Terms Glossary
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Term</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Class</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">A category or type of thing (e.g., Person, Animal, Disease).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Property</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">A relationship between entities (e.g., hasParent) or between an entity and a value (e.g., hasAge).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Individual</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">A specific instance of a class (e.g., &ldquo;Albert Einstein&rdquo; is an individual of class Person).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">IRI</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Internationalized Resource Identifier &mdash; the globally unique name for any resource in an ontology.</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Triple</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">The atomic unit of RDF data: subject &ndash; predicate &ndash; object (e.g., &ldquo;Einstein &ndash; bornIn &ndash; Germany&rdquo;).</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Reasoner</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Software that infers new knowledge from the axioms and assertions in an ontology.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="introduction" />
    </div>
  );
}
