import { GuidePrevNext } from "@/components/docs/GuidePrevNext";

export default function PropertiesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
        What are Properties?
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-8">
        Properties are the verbs of an ontology &mdash; they describe how individuals relate{" "}
        to each other and what attributes they carry. RDF defines a single base type and OWL{" "}
        layers a richer typology on top, with axioms for characteristics (functional,{" "}
        transitive, &hellip;) and relationships between properties (sub-property,{" "}
        equivalence, disjointness).
      </p>

      <div className="space-y-8">
        {/* rdf:Property */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            The Base: <code className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded text-xl">rdf:Property</code>
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Every predicate that connects a subject to an object in an RDF triple is, at{" "}
              minimum, an <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdf:Property</code>.{" "}
              The W3C RDF specification doesn&apos;t distinguish between &ldquo;properties that{" "}
              point to other resources&rdquo; and &ldquo;properties that hold literal{" "}
              values&rdquo; &mdash; it&apos;s just one flat type. RDFS adds{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:domain</code> and{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:range</code>{" "}
              to constrain what classes a property can apply to and what kind of values it{" "}
              accepts, but the typology stops there.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:hasMember a rdf:Property ;
    rdfs:domain ex:Group ;
    rdfs:range  ex:Person .`}</pre>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-sm">
              For most modelling tasks the OWL property kinds (below) are a better fit, since{" "}
              they let reasoners distinguish references from literal values and enforce the{" "}
              difference automatically.
            </p>
          </div>
        </section>

        {/* OWL Object Property */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <code className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded text-xl">owl:ObjectProperty</code>
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Connects an individual to <em>another individual</em> &mdash; the range is always{" "}
              another resource (an IRI or blank node), never a literal. Use object properties{" "}
              for relationships between things: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasParent</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">memberOf</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">locatedIn</code>.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix owl:  <http://www.w3.org/2002/07/owl#> .

ex:hasParent a owl:ObjectProperty ;
    rdfs:domain ex:Person ;
    rdfs:range  ex:Person .

ex:Alice ex:hasParent ex:Bob .   # both must be IRIs / individuals`}</pre>
            </div>
          </div>
        </section>

        {/* OWL Datatype Property */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <code className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded text-xl">owl:DatatypeProperty</code>
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Connects an individual to a <em>literal value</em> typed by an XSD or{" "}
              RDF datatype: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">xsd:string</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">xsd:integer</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">xsd:date</code>, etc.{" "}
              Use datatype properties for raw attributes:{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasAge</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasName</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">birthDate</code>.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:hasAge a owl:DatatypeProperty ;
    rdfs:domain ex:Person ;
    rdfs:range  xsd:nonNegativeInteger .

ex:Alice ex:hasAge "34"^^xsd:nonNegativeInteger .`}</pre>
            </div>
          </div>
        </section>

        {/* OWL Annotation Property */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            <code className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded text-xl">owl:AnnotationProperty</code>
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Carries metadata about an entity rather than asserting a logical relationship.{" "}
              Annotation properties are <strong>invisible to OWL reasoners</strong> &mdash; they{" "}
              don&apos;t participate in inference, but they&apos;re what people read in the UI.{" "}
              Common examples: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:label</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:comment</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">skos:prefLabel</code>,{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">dcterms:creator</code>.
            </p>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
              <pre>{`ex:hasMaintainer a owl:AnnotationProperty ;
    rdfs:label "Has maintainer"@en .

ex:MyOntology ex:hasMaintainer "Jane Doe" .  # not used in inference`}</pre>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mt-3 text-sm">
              Rule of thumb: if a value should drive logical conclusions (membership, equivalence,{" "}
              consistency checking), it belongs on an object or datatype property. If it&apos;s{" "}
              for humans &mdash; labels, comments, dates, authorship &mdash; use an annotation{" "}
              property.
            </p>
          </div>
        </section>

        {/* Property Characteristics */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Characteristic Axioms
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            OWL lets you mark a property with axioms that constrain how it behaves &mdash; a{" "}
            reasoner uses these to derive new triples or detect contradictions. In OWL 2 DL{" "}
            these characteristics apply to object properties; the only one also permitted on{" "}
            datatype properties is <code className="font-mono text-xs">owl:FunctionalProperty</code>.
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Axiom</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Meaning</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Example</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:FunctionalProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Each subject has at most one value</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">hasFather</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:InverseFunctionalProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Each value identifies at most one subject (only on object properties)</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">hasPassport</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:TransitiveProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">If a P b and b P c, then a P c</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">isAncestorOf</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:SymmetricProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">If a P b, then b P a</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">hasSibling</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:AsymmetricProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">If a P b, then b P a is false</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">hasParent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:ReflexiveProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Every individual P itself</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">knows</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:IrreflexiveProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">No individual P itself</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">isParentOf</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mt-4">
            <pre>{`ex:isAncestorOf a owl:ObjectProperty , owl:TransitiveProperty , owl:IrreflexiveProperty .

# From  Alice -isAncestorOf-> Bob  and  Bob -isAncestorOf-> Carol
# A reasoner derives  Alice -isAncestorOf-> Carol`}</pre>
          </div>
        </section>

        {/* Property Relationships */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Relationships Between Properties
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Properties can also relate to <em>each other</em>, not just to instances. These{" "}
            axioms let you organise properties into hierarchies, declare alignments, or rule{" "}
            out impossible combinations.
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Axiom</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-slate-900 dark:text-white">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">rdfs:subPropertyOf</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    Every triple using the sub-property also entails one using the super-property.{" "}
                    E.g. <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasMother</code>{" "}
                    <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:subPropertyOf</code>{" "}
                    <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasParent</code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:equivalentProperty</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    Two properties always carry the same triples in both directions &mdash;{" "}
                    a reasoner can substitute one for the other freely.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:inverseOf</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    Reverses subject and object. If a <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasParent</code> b,{" "}
                    then b <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasChild</code> a.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:propertyDisjointWith</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    Two properties cannot share any pair of values. Used for mutually-exclusive{" "}
                    relations &mdash; e.g. <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasSpouse</code> vs{" "}
                    <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasParent</code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:AllDisjointProperties</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    The n-ary form: declare three or more properties pairwise-disjoint in one axiom.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-white">owl:propertyChainAxiom</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    Derive a property by chaining others. E.g.{" "}
                    <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasGrandparent ≡ hasParent ∘ hasParent</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mt-4">
            <pre>{`ex:hasParent owl:inverseOf ex:hasChild .

ex:hasSpouse owl:propertyDisjointWith ex:hasParent ;
             a owl:SymmetricProperty .

ex:hasGrandparent owl:propertyChainAxiom ( ex:hasParent ex:hasParent ) .`}</pre>
          </div>
        </section>

        {/* Domain and Range */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Domain and Range
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:domain</code> declares{" "}
              what class a subject must belong to in order to be a valid subject of the property;{" "}
              <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:range</code> does{" "}
              the same for the object.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              In OWL these are <strong>not validation constraints</strong> &mdash; they&apos;re{" "}
              entailments. Asserting <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">hasParent rdfs:domain Person</code>{" "}
              and then writing <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">ex:Spot ex:hasParent ex:Rex</code> doesn&apos;t{" "}
              raise an error; it lets a reasoner conclude that Spot <em>is</em> a Person.{" "}
              Use SHACL or domain-specific lint rules if you want classical &ldquo;wrong type&rdquo;{" "}
              validation.
            </p>
          </div>
        </section>

        {/* Choosing the Right Kind */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            Choosing the Right Kind
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 text-sm">
              <li>
                Will the value be a <strong>reference to another individual</strong> in your{" "}
                ontology? &rarr; <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">owl:ObjectProperty</code>.
              </li>
              <li>
                Will the value be a <strong>literal</strong> (number, string, date, &hellip;)? &rarr;{" "}
                <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">owl:DatatypeProperty</code>.
              </li>
              <li>
                Is the value <strong>metadata for humans</strong>, not for the reasoner? &rarr;{" "}
                <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">owl:AnnotationProperty</code>.
              </li>
              <li>
                Are you <strong>not committing to OWL</strong> at all (e.g. plain RDFS)? &rarr;{" "}
                <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdf:Property</code> works,{" "}
                but you lose reasoner support for the distinctions above.
              </li>
            </ul>
          </div>
        </section>

        {/* References */}
        <section>
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
            References
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <ul className="space-y-3 text-sm">
              <li>
                <a href="https://www.w3.org/TR/rdf12-schema/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  RDF 1.2 Schema
                </a>{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; the base <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdf:Property</code>,
                  {" "}<code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:domain</code>,
                  {" "}<code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:range</code>,
                  {" "}<code className="bg-slate-200 dark:bg-slate-600 px-1 rounded-sm text-xs">rdfs:subPropertyOf</code>.
                </span>
              </li>
              <li>
                <a href="https://www.w3.org/TR/owl2-syntax/#Object_Properties" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  OWL 2 Structural Specification &mdash; Properties
                </a>{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; canonical reference for object / datatype / annotation properties{" "}
                  and all the characteristic and relationship axioms.
                </span>
              </li>
              <li>
                <a href="https://www.w3.org/TR/owl2-primer/#Object_Properties" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  OWL 2 Primer &mdash; Properties
                </a>{" "}
                <span className="text-slate-600 dark:text-slate-400">
                  {" "}&mdash; gentler tutorial introduction with worked examples.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <GuidePrevNext currentSlug="properties" />
    </div>
  );
}
