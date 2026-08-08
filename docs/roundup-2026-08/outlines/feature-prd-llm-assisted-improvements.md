# **FEATURE: Users’ Improvements, Aided by LLM suggestions**

I want to implement this user story:

*  the user wants to either   
  * suggest a new class or property  
  *  augment and existing property with annotations such as   
    * synonyms (`altLabel`)  
    * examples   
    * Notes  
*  so  so the user sees a UX affordance (that we can discuss)  to improve the existing ontology  
*  as soon as the user   
  * chooses the affordances  
  * To ADD a new class:  
    * As a Child  
    * As a Sibling  
  * To EDIT the current Class or Property  
    * Filling out the annotations  
* For both of those:  
  * The  system will have an LLM component (cloud or local) that will provide options that are helpful to the user:  
    * E.g.,  suggest  potential additions (e.g., children, siblings)  
    * E.g., suggest potential annotations (e.g., synonyms, examples, translations, additional parents)  
    * E.g., other things that we’ll think through together  
  * The system will also look through the **existing** ontology  —     
    * to ensure that suggestions don’t duplicate existing classes or properties  
    * to create edges (relationships) between the nodes (classes and properties)  
    * To suggest new unique classes  
    * To suggest helpful edges  
  * The system will be able to choose from all or any of these tools, as they are helpful to you:  
    * Generative FOLIO might be the most helpful.   
    * https://github.com/alea-institute/generative-folio  
    * FOLIO-python (see repo on this machine)  
    * FOLIO-api  
    * FOLIO owl file  
* the system will make it as easy as possible to be able to iterate through the ontology,  improving that ontology with annotations.  
*  But ultimately, the ontology’s  Integrity is the most important  
  * we shouldn't have duplicate classes or properties  
  *  and we don't want AI slop  that is unhelpful  
*  rather, the ultimate goal is for our users,  who are subject matter experts,  to be able to provide a well-curated ontology for each of their domains.   
*  so please balance these two goals:  
  * ease of improving the ontology  
  * Discipline to ensure that the improvements are non-duplicative and helpful

 Because the users will be able to suggest improvements rapidly,  the system should be smart enough to incorporate and cluster all of a user's sessions into a commit structure  That will be easiest for admins to review and if helpful,  except.   so if a user submits 100 changes,  there shouldn't be 100 commits.   at the same time, if the user submits 1,000 suggestions,  putting all 1,000 of those into a single commitment might also be unwieldy.  It might be better to Cluster them on a particular Ontological Branch or topic.  I don't know the right answer here. Please help us think through this together.

 For this development project,  I'd like to create this as a feature branch,  which will probably be deployed both on the FOLIO side and on the Catholic OS side.  but I'll be testing and iterating on the FOLIO side.  But eventually, I will submit it as an issue to the Catholic OS side, for discussion.

 this is a major  feature. It will take a lot of planning and thinking.

 Please ask me all the questions you have. We need to ensure that this is done correctly.

