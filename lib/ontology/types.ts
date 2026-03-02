/**
 * Type definitions for OWL ontology elements
 */

export interface LocalizedString {
  value: string;
  lang: string;
}

export interface OWLEntity {
  iri: string;
  labels: LocalizedString[];
  comments: LocalizedString[];
  deprecated: boolean;
}

export interface OWLClass extends OWLEntity {
  parentIris: string[];
  equivalentIris: string[];
  disjointIris: string[];
  childCount: number;
  instanceCount: number;
  isDefined: boolean;
  sourceOntology?: string;
}

export type PropertyType = "object" | "data" | "annotation";

export interface OWLProperty extends OWLEntity {
  propertyType: PropertyType;
  domainIris: string[];
  rangeIris: string[];
  parentIris: string[];

  // Object property characteristics
  isFunctional: boolean;
  isInverseFunctional: boolean;
  isTransitive: boolean;
  isSymmetric: boolean;
  isAsymmetric: boolean;
  isReflexive: boolean;
  isIrreflexive: boolean;

  inverseOf?: string;
  usageCount: number;
  sourceOntology?: string;
}

export interface OWLIndividual extends OWLEntity {
  typeIris: string[];
  sameAs: string[];
  differentFrom: string[];
}

export interface OWLAnnotation {
  property: string;
  value: string | LocalizedString;
  datatype?: string;
}

export interface OWLOntology {
  id: string;
  iri: string;
  versionIri?: string;
  title: string;
  description?: string;
  prefix: string;
  imports: string[];
  annotations: OWLAnnotation[];
  createdAt: string;
  updatedAt: string;
  classCount: number;
  propertyCount: number;
  individualCount: number;
}

// Tree representation for hierarchical display
export interface ClassTreeNode {
  iri: string;
  label: string;
  children: ClassTreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
}

// Shared tree node type used by all entity tabs (Classes, Properties, Individuals)
export interface EntityTreeNode {
  iri: string;
  label: string;
  children: EntityTreeNode[];
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  entityType?: "class" | "property" | "individual";
  isGroupHeader?: boolean;
  deprecated?: boolean;
  isSearchMatch?: boolean;
}

/**
 * Convert ClassTreeNode[] to EntityTreeNode[] for the shared tree renderer.
 */
export function classTreeNodesToEntityNodes(
  nodes: ClassTreeNode[],
): EntityTreeNode[] {
  return nodes.map((node) => ({
    iri: node.iri,
    label: node.label,
    children: classTreeNodesToEntityNodes(node.children),
    isExpanded: node.isExpanded,
    isLoading: node.isLoading,
    hasChildren: node.hasChildren,
    entityType: "class" as const,
  }));
}

// For Manchester syntax support
export interface ClassExpression {
  type:
    | "class"
    | "intersection"
    | "union"
    | "complement"
    | "restriction"
    | "enumeration";
  classIri?: string;
  operands?: ClassExpression[];
  property?: string;
  restrictionType?: "some" | "only" | "value" | "min" | "max" | "exactly";
  filler?: ClassExpression | string;
  cardinality?: number;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}
