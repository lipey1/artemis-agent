# GitHub person search recipes

Live `gh` Search API patterns that worked for public person lookup (user search does not need code-search scope).

## Query ladder

1. Surname only: `q=Domborovski` — catches rare exact spellings even when login != name.
2. First + last: `q=Marcos+Domborovski` — often zero if the display name has a middle initial.
3. Name in profile field: `q=Marcos+Domborovski+in:fullname` — strongest identity check.
4. Login substring (noisy): `q=Domborovski+in:login` — many unrelated accounts; use only to expand candidates.
5. Spelling variants in parallel: `Domborovski` / `Dombrowski` / `Dombroski` (and `v`/`w`). Treat each as its own candidate set.

## Confirm a candidate

```bash
gh api users/LOGIN --jq '{login,name,bio,company,location,blog,twitter_username,html_url,public_repos,created_at}'
gh api users/LOGIN/social_accounts   # often []
gh api users/LOGIN/following --jq '.[].login'
gh api 'users/LOGIN/repos?per_page=100&sort=updated' --jq '.[] | "\(.name)\t\(.language)//-\t\(.homepage // "")\t\(.description // "")"'
gh api repos/LOGIN/REPO --jq '{default_branch,homepage,description,html_url}'
gh api "repos/LOGIN/REPO/git/trees/BRANCH?recursive=1" --jq '.tree[] | select(.path|test("html$|README"; "i")) | .path'
```

Affiliation signals when `bio` is null: course/org prefixes in repo names (`bpk-`, `Portfolio-ADS`), descriptions mentioning a school, homepage deploys.

## Social follow-ups from GitHub only

- Prefer links already on the profile (`blog`, `twitter_username`, `social_accounts`) or inside repo HTML/README.
- Do not fabricate LinkedIn slugs. Guest LinkedIn HTML via curl commonly returns authwall/999; report blocked and escalate to browser only after the user allows remote debugging.
- Register confirmed profile + key repo URLs in the grounded-citations ledger before writing the answer.
