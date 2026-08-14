---
name: public-person-lookup
description: "Find public profiles for a named person with citations."
version: 0.1.0
author: Artemis (curator), Artemis Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  artemis:
    tags: [Research, OSINT, GitHub, Social, People, Citations]
    category: research
    related_skills: [grounded-citations]
  artemis:
    tags: [Research, OSINT, GitHub, Social, People, Citations]
    related_skills: [grounded-citations]
---

# Public Person Lookup

Locate **public** profiles (GitHub, LinkedIn, Instagram, X, personal sites) for a named person and report only what sources support. Pair with `grounded-citations` for numbered sources. Does not cover doxxing private data, credential guessing, or paywalled stalking.

## When to Use

- User asks who someone is, or to find them on GitHub / social networks
- Need to disambiguate homonyms or surname spelling variants
- Web search is thin or blocked; developer footprint may still be on GitHub

Don't use for: private contact discovery, non-public scraping behind login (stop and ask), or inventing profiles when search returns nothing.

## Prerequisites

- `gh` authenticated for GitHub Search API (user search works without code-search scope)
- `grounded-citations` / `scripts/sources.py` for cite-as-you-go answers
- Optional: browser with user-approved remote debugging when LinkedIn/Instagram need a real session

## How to Run

```bash
# Exact surname, then first+last, then name-in-fullname
gh api -X GET 'search/users?q=SURNAME&per_page=20' --jq '.total_count as $t | "total=\($t)", (.items[]? | "\(.login)\t\(.html_url)")'
gh api -X GET 'search/users?q=First+Last&per_page=20' --jq '.total_count as $t | "total=\($t)", (.items[]? | "\(.login)\t\(.html_url)")'
gh api -X GET 'search/users?q=First+Last+in:fullname&per_page=20' --jq '.items[]? | "\(.login)\t\(.html_url)"'

# Confirm match
gh api users/LOGIN --jq '{login,name,bio,company,location,blog,twitter_username,html_url,public_repos,created_at}'
gh api users/LOGIN/social_accounts
gh api 'users/LOGIN/repos?per_page=100&sort=updated' --jq '.[] | "\(.name)\t\(.description // "")\t\(.homepage // "")"'
```

Register every confirmed URL with `sources.py add` before drafting. See `references/gh-person-search.md`.

## Procedure

1. **Normalize the name.** Keep the user's spelling; also prepare common variants (e.g. Slavic/BR surnames: `...ovski` / `...owski` / `...oski`, `v`/`w`). Done when you have a short OR-list of queries.
2. **GitHub first for tech-adjacent people.** Run surname, `First+Last`, and `First+Last+in:fullname`. Inspect `name` on candidates. Done when you either have a login whose display name matches, or documented zero hits for exact spelling.
3. **Enrich the GitHub hit.** Pull profile, `social_accounts`, repos, homepage fields, raw README/HTML for mailto/instagram/linkedin. Infer affiliation only from repo text (course codes, org names). Done when affiliation claims have a repo or profile field behind them.
4. **Probe other networks carefully.** Prefer indexed public pages and profile URLs found on GitHub. LinkedIn guest/dir pages often redirect to authwall via curl; say so and offer browser after the user enables remote debugging. Do not invent `/in/...` URLs.
5. **Disambiguate hard.** Separate exact-spelling matches from near-homonyms (different middle name, city, career). Never merge them. Done when the answer labels which person is which.
6. **Cite and close gaps.** Register sources, cite inline, render Sources. Explicitly list networks with no public hit. Done when every load-bearing claim has a ledger id or an honest "not found".

## Pitfalls

- **Training-data guess before API.** Model recall of "famous" homonyms can steal the answer; always verify with live GitHub/search before asserting the match.
- **Citing an unverified LinkedIn URL.** Authwalled HTML is not evidence of a profile. Only cite URLs you actually resolved or that appear on a fetched page.
- **Treating similar surnames as the same person.** Different vowel/consonant (Domborovski vs Dombrowski) is a different candidate until proven otherwise.
- **Assuming empty bio means no identity.** Repo names and descriptions often carry school/org (e.g. Biopark course repos).
- **Dead homepage fields.** Vercel/GitHub Pages URLs in repo metadata may 404; report offline, still cite the repo.
- **Windows + MSYS path to `sources.py`.** Prefer an absolute `C:/Users/<user>/AppData/Local/artemis/skills/research/grounded-citations/scripts/sources.py` (forward slashes) over `$HOME/AppData/...` when `python` mis-resolves the path. Keep titles free of unescaped `()` in one-liners that break bash parsing.

## Verification

- [ ] Exact-spelling GitHub search was run (not only a guessed profile)
- [ ] Display `name` on the chosen login matches the query (or mismatch is explained)
- [ ] Homonyms listed separately
- [ ] Every profile/affiliation claim cited via `grounded-citations` ledger
- [ ] Networks with no public evidence marked not found (not omitted)
