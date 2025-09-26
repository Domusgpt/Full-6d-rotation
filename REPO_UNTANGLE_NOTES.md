# Untangling Local Changes Safely

If you need to recover from a failed merge or experimental branch work without
risking the state of `main`, follow this workflow. It preserves every commit you
have made while letting you restack clean changes on top of the latest upstream
history.

1. **Save current work**
   ```bash
   git status
   git commit -am "WIP"   # only if you have staged edits you want to keep
   ```
   You can also create a safety tag so the current commit is easy to find:
   ```bash
   git tag backup/<date>-<initials>
   ```

2. **Fetch the authoritative history**
   ```bash
   git fetch origin
   ```

3. **Create a new branch from upstream main**
   ```bash
   git switch --create rebuild-from-main origin/main
   ```
   This gives you a clean starting point that matches the canonical repo.

4. **Cherry-pick the commits you want to keep**
   Use `git log backup/<tag>...` to list your saved commits, then cherry-pick the
   ones that belong in the new history:
   ```bash
   git cherry-pick <commit_sha>
   ```
   Resolve conflicts as they appear. Keeping the cherry-picks small makes this
   step much easier.

5. **Replace the old branch (optional)**
   Once you are confident in the rebuilt branch you can move the branch pointer:
   ```bash
   git branch -f work
   git switch work
   ```
   or push the fresh branch to a new remote ref and open a pull request.

6. **Clean up backups after verification**
   When the new branch is merged (or you are certain you no longer need the
   backup tag) you can remove it:
   ```bash
   git tag -d backup/<date>-<initials>
   ```

These steps avoid force-resetting shared branches and keep the original
historical commits accessible should you need to revisit them.
