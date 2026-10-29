# How SHE file drafting works

**Flow:** intake form -> payment -> draft generated from a template -> professional reviews, edits and signs -> PDF stored privately.

## Templates are data
Templates live in the `she_templates` table, one active version per project type. If a project type has no template of its own, the general template (project type `T00`) is used. Edit a template by inserting a new row with a new `version` and setting the old one `is_active = false`; files keep the version they were drafted from (`she_files.template_version`).

## Template syntax
The template is plain text:

| Syntax | Meaning |
|---|---|
| `## 1. TITLE` | Section heading. `### x` is a sub-heading. |
| `\| a \| b \|` rows (+ `\|---\|---\|`) | Table (first row is the header). `- item` is a bullet. |
| `{{project_name}}` | Merge field filled from the intake. Missing values become `[CONSULTANT TO COMPLETE: ... not provided]`. Fields: `file_number project_name project_address project_type_label contractor_name cidb_number client_name site_agent start_date end_date duration_days worker_count project_value subcontractors`. |
| `{{AI: instruction}}` | A block written by Claude. Only this instruction and the project facts are sent. |
| `{{AI+activities: instruction}}` | Same, and the answer must mention every declared high-risk activity. |
| `[CONSULTANT TO COMPLETE: what]` | Short answer the professional types in. Never touched by the AI. |
| `[CONSULTANT TO INSERT: what]` | Longer content the professional writes or pastes. |
| `[CONSULTANT TO VERIFY: what]` | A fact the professional must confirm. |

Placeholders may not contain `]`. Every placeholder must be resolved before a file can be signed.

## Older templates
Templates written before this engine (project types T01 to T10 in your database) use `[CONTRACTOR TO PROVIDE: project_name]` for merge fields and `SECTION n - TITLE` lines for headings. The engine reads these as they are: merge fields are filled, headings become sections, and the file's line endings are cleaned. They contain no `{{AI: ...}}` blocks, so drafts from them have no AI-written text until blocks are added. A project type without its own active template uses the general template (T00).

## What protects the document
- Fixed template text and all `[CONSULTANT TO ...]` placeholders are never sent to the AI and cannot be changed by it.
- Contractor-typed text is stripped of brackets/braces so it cannot fake placeholders or markers.
- Each AI block is checked: no template syntax, no stray brackets, no law/regulation/standard numbers, long enough, mentions every declared activity when required. A failing block is retried once with the reasons, then replaced by a `[CONSULTANT TO INSERT]` placeholder.
- AI-written text is shown in purple in the reviewer, and each section must be ticked "Reviewed" before signing.

## Operations
- Drafting needs `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in Vercel. Set a monthly spend limit in the Anthropic console.
- The draft route can run for up to a minute or more; Vercel Hobby limits functions to 60 s, Pro allows up to 300 s.
- A file gets at most 5 draft attempts. Failures and per-block results are in `she_files.draft_report`.
- Tests: `npx tsx scripts/test-template-engine.ts`, `npx tsx scripts/test-ai-client.ts`, `npx tsx scripts/test-pdf.ts`.
