---
name: record-decision
description: Write a decision record in docs/decisions/ for a choice made in this conversation — the situation, the options considered, what was chosen and what it costs — so it is understood 100 days from now. Use after the user and Claude settle a design question, reject an obvious approach, or leave a product question open. Also use when the user says "record this", "note why we did this", or "write an ADR".
argument-hint: <short title of the decision>
---

# Record a decision: $ARGUMENTS

<!--
WHAT THIS FILE IS: a skill — a procedure Claude follows in the SAME conversation.
WHY IT EXISTS: Claude forgets everything when a chat ends, and the reasons behind a choice live only in the
  chat. Writing the note while the context is fresh is cheap; reconstructing it later is not.
HOW TO RUN IT: `/record-decision closed loans are not overdue`. Claude also proposes it itself at the end of
  `/ship` when a change involved a real choice.
THE POINT OF THE RECORD: code shows WHAT; a record shows WHY and WHAT WAS REJECTED.
-->

Read `docs/decisions/README.md` (when to write one, the rules) and `docs/decisions/TEMPLATE.md` first.

## Steps

1. **Is it worth a record?** Yes if a reasonable person could have chosen otherwise, it cost debate, a live test overturned the obvious design, a rule looks like a bug until explained, or a question is deliberately left open. If it is a routine fix, say so and stop — the commit message covers it.
2. **Gather the facts from this conversation and the code, not from guesses.** What was observed (quote the symptom with real numbers), which options were really discussed, who decided. For anything about current behaviour, open the code and confirm. If the user never said why, ask rather than invent a reason.
3. **Number it:** `ls docs/decisions/` and take the next free `NNNN`. File name: `NNNN-short-kebab-title.md`. Use today's date in `YYYY-MM-DD`.
4. **Write it from the template**, half a page at most: Situation, Options considered (include the ones rejected and why), Decision, Consequences (what it makes easy, what it costs, what to check if it looks wrong), Where it shows up (links to code, tests, SQL, feature page).
5. **Status:** `Accepted`, or `Open` if the user has not answered yet (list the options and who has to decide). If it reverses an earlier record, set the old one to `Superseded by NNNN` — never delete or rewrite it.
6. **Link both ways:** add a row to the index in `docs/decisions/README.md`; link the record from the rule file in `.claude/rules/` and the feature page in `docs/features/` it explains.
7. **Say what you wrote** in two lines, and name any fact you could not verify.
