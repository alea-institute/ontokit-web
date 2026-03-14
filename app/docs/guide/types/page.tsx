import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function TypesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What are the Types of Ontologies?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Ontologies range from simple word lists to rich logical theories. Understanding the spectrum
        helps you choose the right level of formality for your project.
      </p>

      <div className="space-y-8">
        {/* Lightweight vs Heavyweight */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Lightweight vs Heavyweight
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            <p className="text-slate-600 dark:text-slate-400">
              Ontologies are often placed on a spectrum of expressiveness:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2">
              <li>
                <strong>Lightweight ontologies</strong> capture basic hierarchies and associations
                without complex logical axioms. They are easier to build and maintain but offer
                limited reasoning.
              </li>
              <li>
                <strong>Heavyweight ontologies</strong> add rich axioms &mdash; cardinality
                constraints, property restrictions, disjointness, equivalence &mdash; enabling
                automated classification and consistency checking.
              </li>
            </ul>
          </div>
        </section>

        {/* Taxonomy */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Taxonomies
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              A taxonomy is a hierarchical classification &mdash; a tree of &ldquo;is-a&rdquo;
              relationships. Think of the Linnaean biological classification (Kingdom &rarr; Phylum
              &rarr; Class &rarr; &hellip; &rarr; Species) or a website&rsquo;s category navigation.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Taxonomies are the simplest form of ontology. They organize concepts into parent/child
              relationships but do not define properties or constraints.
            </p>
          </div>
        </section>

        {/* Thesauri */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Thesauri & Controlled Vocabularies
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              A step beyond taxonomies, thesauri add relationships like &ldquo;broader
              term&rdquo;, &ldquo;narrower term&rdquo;, and &ldquo;related term&rdquo;. They also
              record preferred labels, alternative labels, and scope notes. SKOS (Simple Knowledge
              Organization System) is the W3C standard for publishing thesauri on the web.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Examples include the Library of Congress Subject Headings (LCSH), the Getty Art &
              Architecture Thesaurus (AAT), and UNESCO Thesaurus.
            </p>
          </div>
        </section>

        {/* Formal Ontologies */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Formal Ontologies (OWL)
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Formal ontologies use the Web Ontology Language (OWL) to express rich logical axioms.
              OWL is grounded in Description Logics and supports class restrictions, cardinality
              constraints, property characteristics (transitive, symmetric, functional), and
              equivalence/disjointness declarations.
            </p>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              This is the level of formality that OntoKit targets &mdash; editing and curating
              OWL ontologies with full expressiveness.
            </p>
          </div>
        </section>

        {/* Domain vs Upper-Level */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Domain vs Upper-Level Ontologies
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Domain Ontologies
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Focused on a specific subject area: biomedicine, finance, geography, etc. They
                define the classes and properties relevant to that domain. Examples: Gene Ontology,
                FIBO (Financial Industry Business Ontology), GeoNames.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Upper-Level Ontologies
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Provide very general categories (object, event, quality, role) that span all
                domains. Domain ontologies can align to an upper ontology for cross-domain
                interoperability. Examples: BFO (Basic Formal Ontology), DOLCE, SUMO.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Comparison
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Expressiveness</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Reasoning</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Taxonomy</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Subsumption only</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Linnaean classification</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Thesaurus</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low&ndash;Medium</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Broader/narrower traversal</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Getty AAT, LCSH</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">OWL Ontology</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Full DL reasoning</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Gene Ontology, SNOMED CT</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Upper Ontology</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Cross-domain alignment</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">BFO, DOLCE, SUMO</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="types" />
    </div>
  );
}
