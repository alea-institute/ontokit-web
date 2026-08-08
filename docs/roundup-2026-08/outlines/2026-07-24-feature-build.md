# **2026-07-24 Ontokit-web and Ontokit-api Feature Build**

For many months,  this project has been planned, but it's been put on hold because Father John D’Orazio has been (rightfully) distracted by other projects. So we've decided that I'll build on the FOLIO side, creating a bunch of PRs that will eventually be pushed back Upstream to the CatholicOS repo, which he will review and except back into the Upstream repo.

So please go through the entire repository of both ontokit-web and ontokit-api, doing the following:

1.  find all of the documentation for all of the planning and unfinished work that we hadn't yet finished  
   1.  for example, Father John and I had a lengthy GSD session on these days:  
      1. 1 APR 2026, WED	7:30 – 8:30am	Catholic PR Party\!  
      2. 3 APR 2026, FRI	8 – 9am	PR Party \#2\!  
      3. 6 APR 2026, MON	8 – 9am	PR Party \#3\!  
      4. 7 APR 2026, TUE	10 – 11am	PR Party \#4  
      5. 12 APR 2026, SUN	10 – 11am	PR Party \#5  
      6. 25 APR 2026, SAT	8 – 9am	PR Party\!  
      7. 2 MAY 2026, SAT	7 – 8am	PR Party\!  
   2.  during one or more of those PR parties, we created GSD files — which became the plans for future work  
   3. Could you try to find all of those plans, and decide which would be the better choice:  
      1.  run all of the plans on the “native” harness (e.g., if it’s GSD, run on GSd; if it’s CE, run on CE)  
      2. Convert the plans from GSD to my new favorite harness CE  
      3. Whichever you think is the better plan, please do that.  
2.  I also want to consider the following new features  
   1. Database vs. GitHub Repo:  
      1. Current State:   
         1.  the user has to login with their GitHub repo username  
            1.  that causes friction, since many lay people don't have GitHub usernames, so the account creation and login process is friction that I'd like to avoid  
         2.  after the user logs in with their GitHub username, If the user has sufficient privileges, they are able to suggest edits  
         3. Those edits go on to become   
            1. … Database entries  
            2. … then commits  
            3. … Then pull requests  
         4. …which will be accepted after N days (user configurable)  
      2. Future state:  
         1. Explorer the possibility of the user being able to log in using Zitadel  
            1. … Or maybe simply Google login or another SSO method  
         2. Then after the user suggests edits:  
            1. the system then writes everything to the database (which is current behavior)  
            2. … Then instead of entering a commit with that username’s account to GitHub, the system instead uses a “built for purpose”  GitHub username (e.g., catholicos\_commits) to submit the user’s changes — complete with  metadata related to the username, the person's identity, the then-current credentials, Etc.  
         3.  this would avoid the necessity of the end user creating a github repo  
            1.  and it might also create consistency in the commits and pull requests to the remote repo  
         4. WRINKLE:   
            1.  I seem to remember maybe we have a local GitHub repository  — so the user wouldn't have to create a remote GitHub repository username — and if that's true, How does that affect your analysis?

Please help me brainstorm the best way to achieve this goal.

And again, please go through all of the repositories planning documents and other indications of things that we wanted to build — but we were sidelined since May. I'd like to make significant progress on this project.

