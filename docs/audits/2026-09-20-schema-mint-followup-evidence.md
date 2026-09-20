# B14 schema taxonomy follow-up evidence

Read-only research during D05; no implementation or new accepted requirement.

Current suggestion_service.py declaration set omits owl:DeprecatedClass, owl:DeprecatedProperty and rdfs:ContainerMembershipProperty; mint structural exclusions contain them. Thus a newly named subject typed only with one of these evades the class/property/individual mint detection. This predates D04 and remains explicit follow-up.

Primary references:
- https://www.w3.org/TR/owl-guide/ : deprecation classes designate existing classes/properties; usage is intentionally advisory. Guide §6 discusses these types.
- https://www.w3.org/TR/rdf-schema/ : rdfs:ContainerMembershipProperty is a subclass of rdf:Property. rdfs:Datatype is a subclass of rdfs:Class, another item currently structurally excluded that needs policy reconciliation before claiming exhaustive schema coverage.

Next bounded planning should distinguish mint eligibility from duplicate-check/cap billing classification. D04/D05 deliberately preserve submission declaration types; expanding that shared set could change billing and caps. Use a mint-specific schema set if product policy confirms the taxonomy rather than silently changing shared classification. Preserve existing-subject identity edits, anonymous restrictions and all four save entry points.
