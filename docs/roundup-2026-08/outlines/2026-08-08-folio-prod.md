# **2026-08-08 OntoKit on FOLIO PROD**

/ce-ideation Our goal is to update ontokit,  performing all of the planned tasks, and building out additional features that we've been wanting to do for a while.

1. UPDATING FOLIO PROD. For FOLIO, the current PROD — [https://ontokit.openlegalstandard.org/](https://ontokit.openlegalstandard.org/) — is not in sync with upstream CatholicOS version.   
   1. Might not even be in sync with our ALEA and FOLIO version.    
   2. Please investigate the status of PROD, and let's keep that up to date, going forward.   
   3. For the FOLIO implementation, The standing rule should be that DEV is just a waypoint, and if everything looks good in DEV, then we should push to PROD automatically. Programmatically.  
2. PLANNED CHANGES.   
   1. Several months ago, Fr. John and I spent about 5 hours thinking through UI and UX  
   2. As a result, we’d planned a whole bunch of changes  
   3. Those planned changes should be in my repos and/or branches and/or work trees somewhere.   
   4. I'd like to get as much of that work done as possible, pushing it to FOLIO PROD to test.  
3. FULL PRODUCTION ENVIRONMENT: I'd also like to  set up Ontokit in a full production environment.  
   1. CURRENT STATE: when someone makes a change, it doesn't really go through the process of actually submitting it to the GitHub repo. It’s just fake. I don't know where the changes are actually going. Have they gone into the database? If so, we should probably clean those up, since I've been giving demos, and adding gibberish to the database.  
   2. FUTURE STATE:   
      1. FULL WIRING TO GITHUB:  
         1. When an Ontokit user provides substantive changes, those changes go through the entire pipeline, including the database, and then to GitHub  
         2.  that will require that we fully test all of the personas and all of the user flows — to ensure that everything works properly  
         3. We want to run on production in FOLIO first, to ensure that it works  
         4. After we have all the Kinks worked out, then we will  determine the best way to push those Upstream to Catholic OS (Fr. John). As much as possible, we'd like to have atomic changes, perhaps wrapped up into larger bundles (molecules), so that Father John has an easier time doing PRs.  
      2. TESTING   
         1. There should be a testing process (e.g., maybe testing environment? Staging process?) where we can test changes on before  any of those changes actually goes live — and messes with the actual live ontology in the GitHub repo  
         2. I wonder if this includes a “Demo Mode” where I can show off the features of the tool, adding dummy data and throw away changes, without actually making changes to the live database.  
         3. The user should be able to easily toggle between demo mode and live mode  
4. REBASING?  we may have drifted on this branch in a way that we would have to rebase To align with the Upstream CatholicOS version.  Please do that analysis and see if we have to do any rebases or other ways to get the fork aligned with upstream. And whether we should do that before we do all of the work above.

OVERALL: There are probably many improvements to this brainstorming plan. And I'm not using the right GitHub terms. So please improve my suggestions  
