@AGENTS.md

# Standing completion rule

After completing ANY task or set of changes — without exception and without being asked — always run these four steps in order:

1. `git add .`
2. `git commit -m "<descriptive message>"` (follow the existing commit style)
3. `git push origin main`
4. `curl -d "Done" ntfy.sh/SWFLDB-andrew`

This must happen at the end of every prompt, even if the task was a single-line edit.
