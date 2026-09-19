const PROJECT_COMPLETION_PROMPT = `/goal Take this project from its real current state to the closest possible verified 100%. First understand it, ask me only about material decisions the repository cannot answer, measure actual completion, expose every gap, plan the remaining work, then execute it. Replace production mocks, stubs and placeholders with real implementations and verify everything end to end. Do not stop at analysis or planning: PLAN → BUILD → TEST → AUDIT → FIX → REPEAT.

1. UNDERSTAND THE PROJECT
Inspect the repository: requirements, plans, source, frontend/backend, data, APIs, auth, integrations, AI/contracts, infrastructure, tests, deployment and configuration. Trace real implementations; never infer behavior from file or function names. Answer discoverable questions yourself.

2. RESOLVE ONLY MATERIAL AMBIGUITIES
Ask only when an unresolved choice materially changes the product. Work dependency-first from problem and users through core flow, UX, data, services, security, deployment and launch. Give the repository evidence, recommendation and alternatives. Once safe to execute, start work.

3. DEFINE AND MEASURE 100%
Derive a project-specific checklist for every claimed feature, flow, service, data operation, permission, integration, infrastructure, test, deployment and submission requirement. Verify each item. Search for TODO, FIXME, mocks, stubs, fakes, placeholders, hardcoding and unimplemented work; inspect relevant hits. Record an evidence-based initial percentage and every gap with evidence, impact, severity and fix.

4. PLAN THE REMAINING WORK
Create or update PLAN.md. Convert gaps into dependency-ordered phases and concrete tasks with objectives, acceptance criteria and verification. Mark tasks DONE, IN PROGRESS, NOT STARTED or BLOCKED. Identify the critical path.

5. EXECUTE EVERYTHING POSSIBLE
Implement every unblocked task continuously: implement → test → verify → fix → update PLAN.md → continue. Wire complete flows through UI, validation, backend, persistence, integrations, errors and retries. Use real configured services and data; never fake success or credentials. If a dependency is missing, verify it, finish independent work, mark only that boundary blocked and collect the exact user action required.

6. VERIFY QUALITY
Run applicable build, typecheck, lint, unit, integration and end-to-end tests. Exercise the real UI. Verify persistence, authorization, APIs, failure states, security, responsiveness, accessibility, deployment and submission. A feature is done only when observed behavior meets its acceptance criteria.

7. RE-AUDIT UNTIL CLEAN
Repeat the checklist, searches, tests and real flows. Add new gaps to PLAN.md, execute and verify them. Continue AUDIT → GAP → PLAN → BUILD → VERIFY until no independently solvable P0/P1 gap remains.

8. FINAL REPORT
Report INITIAL and FINAL COMPLETION using the same criteria, completed work, verified commands/flows, remaining gaps, one USER_ACTION_REQUIRED list and the next phase. Never claim 100% without evidence.

Hard rules: explore before asking; recommend answers; test behavior, not file existence; fix root causes; no production mocks or fake success; never expose secrets or invent credentials; a missing dependency blocks only its dependent work; keep PLAN.md synchronized; pause only before real spending, irreversible/mainnet actions or material external consequences requiring approval. Start now.`;

function cleanPromptText(value) {
  const normalized = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');

  if (/^PROJECT COMPLETION(?:\n|$)/.test(normalized.trimStart())) return PROJECT_COMPLETION_PROMPT;

  const withoutFences = normalized
    .split('\n')
    .filter((line) => !/^\s*```(?:[a-z0-9_-]+)?\s*$/i.test(line))
    .join('\n');

  const goalMatch = /(^|\n)\/goal\b/i.exec(withoutFences);
  const prompt = goalMatch
    ? withoutFences.slice(goalMatch.index + goalMatch[1].length)
    : withoutFences.replace(/^\s*#{1,6}\s+[^\n]+\n+/, '');

  return prompt.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = { cleanPromptText };
