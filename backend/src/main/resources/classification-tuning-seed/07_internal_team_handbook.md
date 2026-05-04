# Engineering Team Handbook (Draft)

**Audience:** Engineering staff only  
**Last updated:** February 2025

---

## 1. Development Environment

- Use the standard dev container image; branch naming: `feature/JIRA-123-short-name` or `fix/JIRA-456-description`.
- Run unit tests before pushing. CI runs on every PR.
- Do not commit secrets or local config; use the shared env template.

## 2. Code Review

- Every PR requires at least one approval from a team lead or senior engineer.
- Keep PRs small; prefer multiple small PRs over one large one.
- Address review comments within 2 business days.

## 3. On-Call

- Rotation is published in the team calendar. Primary and secondary on-call must be reachable during their shift.
- Escalation path: L1 → L2 → Engineering Manager. For production incidents, also notify #incidents.

---

*Internal use only. Do not distribute outside Engineering.*
