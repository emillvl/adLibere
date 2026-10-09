# Publishing a GitHub release

Release assets are distributed through https://github.com/emillvl/adLibere/releases. This procedure does not deploy a website or submit to a browser store.

1. Start from a clean checkout and inspect `git status`, the branch, remote history, existing tags and `gh release list`. Confirm `origin` is `https://github.com/emillvl/adLibere.git`. Preserve unrelated local work; do not force-push. Fetch before deciding whether to fast-forward or use a branch/PR.
2. Set the repository-local Git identity and verify authentication:

   ```sh
   git config user.name "Emil Valiyev"
   git config user.email "contact@emilvaliyev.com"
   gh auth status
   ```

3. Keep `package.json` and the source manifest version aligned. Do not bump an unpublished version merely to create a release. `tools/build.mjs` writes the package version into the production manifest, which determines the asset name. Review snapshot attribution and update dated compatibility findings when applicable.
4. Run `npm run build`, `npm test`, and `npm run release:package`. Run `npm run test:browser` and the Edge smoke test if compatible browsers are available. Report browser tests as skipped when they cannot run; do not infer runtime validation from static tests. A browser test loads a temporary copy, keeping caches out of `dist/`.
5. Run packaging twice with identical inputs and compare hashes when checking reproducibility. Independently extract the candidate and use `node tools/validate.mjs <folder>`. The packaging command already performs independent extraction and byte comparison.
6. Review `git diff`, stage only relevant source/docs/tests, commit with descriptive messages, and push without rewriting history. Verify `git rev-parse HEAD` against `git ls-remote origin refs/heads/<branch>`. If a protected branch prevents pushing, publish a dedicated branch and PR instead; do not bypass protections or publish unreconciled source as a main-branch release.
7. Determine `X.Y.Z` from `dist/manifest.json`. Check both local/remote `vX.Y.Z` and the matching GitHub Release. If either exists, inspect its commit and assets. Do not move/delete an existing tag or replace published assets. If the existing artifacts cannot be safely reused, report the conflict and stop.
8. After the verified release commit is on GitHub, create and push an annotated tag, then publish:

   ```sh
   git tag -a vX.Y.Z <verified-commit> -m "adLibere X.Y.Z production release"
   git push origin vX.Y.Z
   gh release create vX.Y.Z release/adLibere-vX.Y.Z.zip release/adLibere-vX.Y.Z.zip.sha256 --verify-tag --title "adLibere X.Y.Z" --notes-file <release-notes.md>
   ```

   Substitute actual values; these placeholders are not executable release commands. Use a notes file to preserve exact multiline text. Include changes, tested browsers, limitations, checksum instructions, and Chrome/Edge manual installation/update steps. GitHub's matching Source code archives provide the filter snapshots and conversion tools for the derived GPL filter data.
9. Confirm the release is published (not draft), the annotated tag peels to the intended commit, both assets are listed, and downloaded release assets match the local ZIP/checksum bytes. Record the direct release URL, commit, archive size and SHA-256.

Never commit `dist/`, `release/`, browser caches, release ZIPs or checksum files. `npm run release:package` adds no npm dependencies; extraction uses Windows PowerShell/.NET or the operating system's `unzip`. It fails if the independent extractor is unavailable.
