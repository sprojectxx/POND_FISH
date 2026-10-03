# PondFish — Git Continuous Commit and Push Rules

## 1. MANDATORY COMMIT AND PUSH ON EVERY CHANGE
For EVERY modification, task, phase, architecture update, foundation change, or code implementation:
1. All modified and created project files must immediately be staged using `git add`.
2. A descriptive commit message must be written following the documented format (`type(scope): description`) referencing document sources.
3. The commit must immediately be pushed to the remote repository on the `main` branch:
   ```bash
   git push origin main
   ```
4. Never leave completed changes uncommitted or unpushed at the end of a turn or workflow step.

## 2. STRICT SECURITY AND CREDENTIAL SANITIZATION
Before staging or committing:
1. Verify that `.gitignore` strictly protects sensitive files (`.env`, `.env*.local`, credentials, secrets, tokens, private keys, service account JSON files, local uploads).
2. Run `git status` to verify that no secret or environmental credential file is staged.
3. Never bypass or force-add (`git add -f`) ignored credential files.

## 3. CONTINUOUS REMOTE SYNCHRONIZATION
- The remote repository `origin/main` at `https://github.com/sprojectxx/POND_FISH.git` must at all times reflect the latest state of the local codebase.
- No work is considered complete until it is committed and pushed.
