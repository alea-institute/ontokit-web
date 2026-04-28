import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function SyntaxPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What is an Ontology Syntax?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        While formats determine how RDF triples are serialized, <em>ontology syntaxes</em> are{" "}
        purpose-built notations for expressing OWL axioms and class expressions.
      </p>

      <div className="space-y-8">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Why Multiple Syntaxes?
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-slate-600 dark:text-slate-400">
              OWL is a logical language with complex expressions like &ldquo;the class of things{" "}
              that have at least 3 wheels and are made by a European manufacturer.&rdquo; Different{" "}
              communities need different notations: logicians prefer Description Logic notation,{" "}
              ontology editors often use Manchester Syntax, and web developers prefer Turtle/RDF.{" "}
              All these syntaxes express the same OWL semantics.
            </p>
          </div>
        </section>

        {/* Manchester Syntax */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Manchester Syntax
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Designed for readability by ontology authors. Uses English-like keywords
              (<code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">some</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">only</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">and</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">or</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">min</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">max</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">exactly</code>){" "}
              and is widely used in tools like Prot&eacute;g&eacute;.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`Class: Pizza
    SubClassOf:
        hasBase some PizzaBase,
        hasTopping some PizzaTopping
    DisjointWith:
        Pasta

Class: MargheritaPizza
    SubClassOf:
        Pizza,
        hasTopping only (MozzarellaTopping or TomatoTopping),
        hasTopping some MozzarellaTopping,
        hasTopping some TomatoTopping`}</pre>
            </div>
          </div>
        </section>

        {/* Functional Syntax */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            OWL Functional Syntax
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              The normative syntax in the OWL 2 specification. Uses nested function-call notation{" "}
              that maps directly to the OWL 2 structural specification. Precise but less readable.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`SubClassOf(
    :Pizza
    ObjectIntersectionOf(
        ObjectSomeValuesFrom(:hasBase :PizzaBase)
        ObjectSomeValuesFrom(:hasTopping :PizzaTopping)
    )
)

DisjointClasses(:Pizza :Pasta)

SubClassOf(
    :MargheritaPizza
    ObjectIntersectionOf(
        :Pizza
        ObjectAllValuesFrom(:hasTopping
            ObjectUnionOf(:MozzarellaTopping :TomatoTopping))
        ObjectSomeValuesFrom(:hasTopping :MozzarellaTopping)
        ObjectSomeValuesFrom(:hasTopping :TomatoTopping)
    )
)`}</pre>
            </div>
          </div>
        </section>

        {/* OWL/XML */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            OWL/XML
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              An XML serialization that mirrors the OWL 2 structural specification element by{" "}
              element. Useful when XML tooling is required but very verbose.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`<SubClassOf>
  <Class IRI="#Pizza"/>
  <ObjectIntersectionOf>
    <ObjectSomeValuesFrom>
      <ObjectProperty IRI="#hasBase"/>
      <Class IRI="#PizzaBase"/>
    </ObjectSomeValuesFrom>
    <ObjectSomeValuesFrom>
      <ObjectProperty IRI="#hasTopping"/>
      <Class IRI="#PizzaTopping"/>
    </ObjectSomeValuesFrom>
  </ObjectIntersectionOf>
</SubClassOf>`}</pre>
            </div>
          </div>
        </section>

        {/* Turtle/RDF for OWL */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Turtle for OWL
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              OWL axioms can also be expressed in Turtle using the OWL RDF mapping. This is the{" "}
              format OntoKit uses internally. Complex class expressions use blank nodes and{" "}
              RDF collections.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`ex:Pizza a owl:Class ;
    rdfs:subClassOf [
        a owl:Restriction ;
        owl:onProperty ex:hasBase ;
        owl:someValuesFrom ex:PizzaBase
    ] , [
        a owl:Restriction ;
        owl:onProperty ex:hasTopping ;
        owl:someValuesFrom ex:PizzaTopping
    ] .

ex:Pizza owl:disjointWith ex:Pasta .`}</pre>
            </div>
          </div>
        </section>

        {/* Description Logic */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Description Logic Notation
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              The mathematical notation used in academic papers. OWL 2 DL corresponds to the{" "}
              Description Logic SROIQ(D). Compact but requires familiarity with logical symbols.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`Pizza ⊑ ∃hasBase.PizzaBase ⊓ ∃hasTopping.PizzaTopping
Pizza ⊑ ¬Pasta

MargheritaPizza ⊑ Pizza
    ⊓ ∀hasTopping.(MozzarellaTopping ⊔ TomatoTopping)
    ⊓ ∃hasTopping.MozzarellaTopping
    ⊓ ∃hasTopping.TomatoTopping`}</pre>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Syntax Comparison
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Syntax</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Audience</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Readability</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Tool Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Manchester</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Ontology authors</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Prot&eacute;g&eacute;, OWL API</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Functional</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Spec writers</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Medium</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">OWL API, parsers</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">OWL/XML</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">XML pipelines</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">XML tools, OWL API</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">Turtle/RDF</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Web developers</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Medium&ndash;High</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">RDFLib, Jena, OntoKit</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">DL Notation</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Researchers</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Low (specialized)</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Papers, textbooks</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* W3C References */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            W3C References
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://www.w3.org/TR/owl2-manchester-syntax/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  OWL 2 Manchester Syntax &mdash; W3C Note
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/owl2-syntax/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  OWL 2 Structural Specification and Functional-Style Syntax &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/owl2-xml-serialization/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  OWL 2 XML Serialization &mdash; W3C Recommendation
                </a>
              </li>
              <li>
                <a href="https://www.w3.org/TR/owl2-mapping-to-rdf/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  OWL 2 Mapping to RDF Graphs &mdash; W3C Recommendation
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="syntax" />
    </div>
  );
}
