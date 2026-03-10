import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function FormatsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What are the Ontology Formats?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        RDF is the underlying data model, but there are several serialization formats for writing
        it down. Each has trade-offs in readability, verbosity, and tool support.
      </p>

      <div className="space-y-8">
        {/* RDF Data Model */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            The RDF Data Model
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              The Resource Description Framework (RDF) represents knowledge as a set
              of <strong>triples</strong>: subject &ndash; predicate &ndash; object. Subjects and
              predicates are IRIs; objects can be IRIs or literal values (strings, numbers, dates).
              A collection of triples forms a directed graph.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              The <em>format</em> (or serialization) determines how those triples are written in a
              file. The same graph can be serialized in Turtle, RDF/XML, JSON-LD, or any other RDF
              format &mdash; the information content is identical.
            </p>
          </div>
        </section>

        {/* Turtle */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Turtle
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Turtle (Terse RDF Triple Language) is the most popular human-readable RDF format. It
              supports prefix abbreviations, multi-value shorthand with commas, and multi-predicate
              shorthand with semicolons. OntoKit uses Turtle as its canonical format.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix ex:   <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

ex:Animal a owl:Class ;
    rdfs:label "Animal"@en ;
    rdfs:comment "A living organism that feeds on organic matter."@en .

ex:Dog a owl:Class ;
    rdfs:subClassOf ex:Animal ;
    rdfs:label "Dog"@en .`}</pre>
            </div>
          </div>
        </section>

        {/* RDF/XML */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            RDF/XML
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              The original W3C serialization from 1999. Verbose but widely supported by XML
              toolchains. Harder for humans to read but excellent for machine-to-machine exchange.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:owl="http://www.w3.org/2002/07/owl#">
  <owl:Class rdf:about="http://example.org/Animal">
    <rdfs:label xml:lang="en">Animal</rdfs:label>
  </owl:Class>
  <owl:Class rdf:about="http://example.org/Dog">
    <rdfs:subClassOf rdf:resource="http://example.org/Animal"/>
    <rdfs:label xml:lang="en">Dog</rdfs:label>
  </owl:Class>
</rdf:RDF>`}</pre>
            </div>
          </div>
        </section>

        {/* N-Triples */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            N-Triples
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              A line-based format where each line is exactly one triple with full IRIs (no
              prefixes). Extremely simple to parse and ideal for streaming or bulk loading, but
              very verbose.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`<http://example.org/Animal> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .
<http://example.org/Animal> <http://www.w3.org/2000/01/rdf-schema#label> "Animal"@en .
<http://example.org/Dog> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> .
<http://example.org/Dog> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <http://example.org/Animal> .
<http://example.org/Dog> <http://www.w3.org/2000/01/rdf-schema#label> "Dog"@en .`}</pre>
            </div>
          </div>
        </section>

        {/* JSON-LD */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            JSON-LD
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              JSON-LD embeds RDF data in standard JSON using
              a <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">@context</code> block.
              Popular with web developers because it integrates directly with JavaScript and REST
              APIs. Used by Schema.org for structured data in web pages.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`{
  "@context": {
    "ex": "http://example.org/",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "owl": "http://www.w3.org/2002/07/owl#"
  },
  "@graph": [
    {
      "@id": "ex:Animal",
      "@type": "owl:Class",
      "rdfs:label": { "@value": "Animal", "@language": "en" }
    },
    {
      "@id": "ex:Dog",
      "@type": "owl:Class",
      "rdfs:subClassOf": { "@id": "ex:Animal" },
      "rdfs:label": { "@value": "Dog", "@language": "en" }
    }
  ]
}`}</pre>
            </div>
          </div>
        </section>

        {/* N3 */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Notation3 (N3)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400">
              N3 is a superset of Turtle that adds formulas, variables, and built-in predicates for
              expressing rules. While less common for publishing ontologies, it is used in reasoning
              and logic programming contexts.
            </p>
          </div>
        </section>

        {/* Comparison Table */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Format Comparison
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Format</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Readability</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Verbosity</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Best For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Turtle</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Human authoring, version control</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">RDF/XML</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Legacy tools, XML pipelines</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">N-Triples</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Very high</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Bulk loading, streaming</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">JSON-LD</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Medium</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Medium</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Web APIs, JavaScript apps</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">N3</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Rules, logic programming</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* W3C Specs */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            W3C Specifications
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://www.w3.org/TR/turtle/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  RDF 1.1 Turtle &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/rdf-syntax-grammar/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  RDF/XML Syntax Specification &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/n-triples/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  RDF 1.1 N-Triples &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/json-ld11/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  JSON-LD 1.1 &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TeamSubmission/n3/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Notation3 (N3) &mdash; W3C Team Submission
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="formats" />
    </div>
  );
}
