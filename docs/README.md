# BookingOS Documentation

This directory is the shared documentation entrypoint for product, design, engineering, operations and AI collaboration.

## Single Source of Truth
- Approved documents are authoritative.
- Chat history is context, not a standalone specification.
- Conflicts between documents, code and deployed behavior must be reported before implementation.
- Behavior changes must update relevant documentation and verification evidence.

## Directory Guide
- [Foundation](./00_foundation/README.md)
- [Product](./01_product/README.md)
- [Design](./02_design/README.md)
- [Modules](./03_modules/README.md)
- [Engineering](./04_engineering/README.md)
- [Decisions](./05_decisions/README.md)
- [Sprints](./06_sprints/README.md)
- [Releases](./07_releases/README.md)
- [Templates](./templates/README.md)
- [Master Index](./MASTER_INDEX.md)
- [AI Start Here](./AI_START_HERE.md)

## Role Entrances
- Product Owner: Foundation -> Product -> Decisions
- Engineer: AI_START_HERE -> Engineering -> Module -> PRD -> ADR
- Designer: Foundation -> Product -> Design -> Module UX
- AI Agent: AI_START_HERE -> Product -> Engineering -> Module -> PRD -> ADR

## Document Status
- Draft: working content
- Review: awaiting owner review
- Approved: current source of truth
- Deprecated: superseded but retained
- Archived: historical and inactive

## Adding or Updating Documents
1. Start from the relevant template.
2. State purpose, scope, owner, status and date.
3. Link related documents instead of duplicating rules.
4. Record decisions and verification evidence.
5. Documentation alone must not change product or technical behavior.
