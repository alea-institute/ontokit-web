import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function VocabulariesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What is an Ontology Vocabulary?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Vocabularies are shared sets of terms (classes and properties) that ontologies reuse to
        describe common concepts. Using well-known vocabularies makes your data interoperable with
        the rest of the Semantic Web.
      </p>

      <div className="space-y-8">
        {/* RDFS */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            RDFS (RDF Schema)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              The foundational vocabulary for defining classes and properties in RDF.
              Provides <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:Class</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:subClassOf</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:label</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:comment</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:domain</code>, and
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">rdfs:range</code>.
              Almost every ontology uses RDFS terms.
            </p>
            <p className="text-sm">
              <a href="https://www.w3.org/TR/rdf-schema/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                W3C RDF Schema Specification
              </a>
            </p>
          </div>
        </section>

        {/* Dublin Core */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Dublin Core (DC / DCTerms)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              A set of 15 core metadata elements (title, creator, date, subject, etc.) widely used
              in libraries, digital repositories, and ontology metadata.
              The <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">dcterms:</code> namespace
              provides refined versions with formal ranges and domains.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix dcterms: <http://purl.org/dc/terms/> .

<http://example.org/my-ontology>
    dcterms:title "My Ontology"@en ;
    dcterms:creator "Jane Doe" ;
    dcterms:license <https://creativecommons.org/licenses/by/4.0/> .`}</pre>
            </div>
            <p className="text-sm mt-3">
              <a href="https://www.dublincore.org/specifications/dublin-core/dcmi-terms/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                DCMI Metadata Terms
              </a>
            </p>
          </div>
        </section>

        {/* SKOS */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            SKOS (Simple Knowledge Organization System)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Designed for thesauri, classification schemes, and controlled vocabularies. Key
              terms include
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">skos:Concept</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">skos:broader</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">skos:narrower</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">skos:prefLabel</code>, and
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">skos:altLabel</code>.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix skos: <http://www.w3.org/2004/02/skos/core#> .

ex:Animals a skos:Concept ;
    skos:prefLabel "Animals"@en ;
    skos:narrower ex:Mammals , ex:Birds .

ex:Mammals a skos:Concept ;
    skos:prefLabel "Mammals"@en ;
    skos:broader ex:Animals .`}</pre>
            </div>
            <p className="text-sm mt-3">
              <a href="https://www.w3.org/TR/skos-reference/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                W3C SKOS Reference
              </a>
            </p>
          </div>
        </section>

        {/* FOAF */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            FOAF (Friend of a Friend)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Describes people, their activities, and their relationships. Commonly used terms
              include
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">foaf:Person</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">foaf:name</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">foaf:knows</code>, and
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">foaf:homepage</code>.
            </p>
            <p className="text-sm">
              <a href="http://xmlns.com/foaf/spec/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                FOAF Vocabulary Specification
              </a>
            </p>
          </div>
        </section>

        {/* Schema.org */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Schema.org
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              A collaborative vocabulary backed by Google, Microsoft, Yahoo, and Yandex. It defines
              types for everyday things: products, events, organizations, recipes, reviews, and more.
              Used extensively in web pages for structured data and rich search results.
            </p>
            <p className="text-sm">
              <a href="https://schema.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                Schema.org
              </a>
            </p>
          </div>
        </section>

        {/* OWL */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            OWL (Web Ontology Language)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              OWL itself provides vocabulary terms for formal ontology
              modeling: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:Class</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:ObjectProperty</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:DatatypeProperty</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:Restriction</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:equivalentClass</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">owl:disjointWith</code>, and
              many more.
            </p>
            <p className="text-sm">
              <a href="https://www.w3.org/TR/owl2-overview/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                OWL 2 Web Ontology Language Overview &mdash; W3C
              </a>
            </p>
          </div>
        </section>

        {/* PROV */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            PROV (Provenance)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Captures the provenance of data &mdash; who created it, when, from what sources, and
              through which processes. Key
              types: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">prov:Entity</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">prov:Activity</code>,
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-xs">prov:Agent</code>.
            </p>
            <p className="text-sm">
              <a href="https://www.w3.org/TR/prov-o/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                PROV-O: The PROV Ontology &mdash; W3C Recommendation
              </a>
            </p>
          </div>
        </section>

        {/* Other Notable */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Other Notable Vocabularies
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
              <li><strong>DCAT</strong> &mdash; Data Catalog Vocabulary for publishing dataset metadata</li>
              <li><strong>VANN</strong> &mdash; Vocabulary for annotating vocabulary descriptions</li>
              <li><strong>VOID</strong> &mdash; Vocabulary of Interlinked Datasets for describing RDF datasets</li>
              <li><strong>SSN / SOSA</strong> &mdash; Semantic Sensor Network / Sensor, Observation, Sample, and Actuator</li>
              <li><strong>GeoSPARQL</strong> &mdash; Geographic information represented in RDF</li>
              <li><strong>Time Ontology</strong> &mdash; W3C ontology for temporal concepts and relations</li>
            </ul>
          </div>
        </section>

        {/* Summary Table */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Vocabulary Summary
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Vocabulary</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Prefix</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">RDFS</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">rdfs:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Classes, properties, labels</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Dublin Core</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">dcterms:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Metadata (title, creator, date)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">SKOS</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">skos:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Thesauri, concept schemes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">FOAF</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">foaf:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">People and social networks</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Schema.org</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">schema:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Web structured data</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">OWL</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">owl:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Formal ontology modeling</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">PROV</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">prov:</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Data provenance tracking</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Finding Vocabularies */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Finding Vocabularies
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Before creating your own terms, check whether a suitable vocabulary already exists:
            </p>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="https://lov.linkeddata.es/dataset/lov/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  Linked Open Vocabularies (LOV)
                </a>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; A curated catalog of reusable RDF vocabularies with search and usage statistics.
                </span>
              </li>
              <li>
                <a href="https://prefix.cc/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  prefix.cc
                </a>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; A community-maintained registry for looking up namespace prefixes and their IRIs.
                </span>
              </li>
              <li>
                <a href="https://bartoc.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  BARTOC
                </a>
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; Basel Register of Thesauri, Ontologies & Classifications.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="vocabularies" />
    </div>
  );
}
