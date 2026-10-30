---
name: write-lab-chapter
description: Write, rewrite or review a hands-on lab chapter for Asraf's course repositories so it reads like Microsoft-Power-Automate and AI-for-Workplace-Advanced: a short story, concrete click-by-click steps, one check per section and plain participant language. Use when drafting a new chapter, rewriting one after classroom feedback, or doing a "student read-through" before a pull request.
---

# Write a Lab Chapter

`COURSE-CONVENTIONS.md` sets the format: headings, callouts, the **What should you see?** box, screenshot names and the writing style. This skill covers the part the format can't: how a chapter should *read* so a beginner can follow it without getting lost.

The reference chapters are Microsoft-Power-Automate `04-excel-summary` and AI-for-Workplace-Advanced `04-grounded-research`. When in doubt, open one and copy its rhythm.

Course-specific rules in a course's `CLAUDE.md` or `AGENTS.md` still win over this skill.

## Why chapters drift

Classroom feedback on the Google Workspace Docs labs (October 2026) showed the usual failure: participants "blindly following" steps, unsure which skill was being tested, lost when switching between the notes and the app, and confused by two paste boxes where they expected one. Nothing in the format was wrong. The chapter had been patched by several writers, each adding evidence gates, Why lines and checks, until the steps were tiny and the language read like an audit trail.

So: when a chapter needs more than small fixes, **rewrite it to this pattern in one pass, by one writer**. Don't layer another round of patches on top.

## The shape of a chapter

1. **Story opener.** One short paragraph in the scenario's voice that sets up a real need: "The coordinator wants a readable list of training sessions on demand, without copying cells into an email by hand." Not "In this chapter you will generate an outline, draft from supplied evidence and record unsupported claims."
2. **What gets built, in one line.** Power Automate shows the flow: **Manually trigger a flow > List rows > Select > Create HTML table > Send an email**. For a document, deck or workbook, name the pieces in the order they appear: *purpose statement > procedure > open questions > Authoring Log*. Participants should be able to point at where they are.
3. **Topics before steps.** The concepts (why grounding matters, what a heading style does) go in a short **Topics** section or in two or three sentences at the top of a section. Don't attach a **Why** line to every task.
4. **Sections of three to seven steps.** Each `## N.M` section builds one visible piece. Fewer than three steps usually means the section should merge with its neighbour. More than eight means it should split.
5. **One check per section.** End the section with a single check, ideally a screenshot of the whole result so far ("Check your flow so far. Your screen should look like this."). Use a **What should you see?** box only when there's a figure or finding to compare.
6. **Independent Practice, Troubleshooting, Lesson Summary** as in the conventions.

## Writing the steps

- **One visible action per step.** Click, type, select, paste, open. A participant should know the step is finished because something changed on screen.
- **Name the place every time.** "In **GW - Reporting Procedure - Working**, click at the end of step 8" rather than "below the example". When a step sends people to another window or file, the next step names the window they come back to.
- **Thinking is a task, not a hidden step.** "Compare every instruction with the sources" is not a step a beginner can finish. Write it as a task with a written result:

  > Read Gemini's reply against `project-facts.txt`. Under **AI draft review**, type one line for each problem you find. You should find at least two.

  Put it at the end of the section, after the clicks, and say what they produce.
- **The order follows cause and effect.** Discover a problem before you fix it, test before you repair, build before you check. If a screenshot shows the result of a later step, the order is wrong.
- **Say what each paste replaces.** A replacement block gets a label (**Replacement for procedure step 4**) and a step that says "Select the whole of step 4, then paste over it".
- **One paste per place.** Group lines that land in the same place into one block, and say so ("the heading and both questions are included"). Short labels are typed beside the instruction, not given a Copy box each.
- **Supplied material saves typing, not thinking.** If you supply a reference draft or a completed table, say in one sentence why everyone uses the same one ("so the rest of the lab works the same for everyone") and what the participant still decides.
- **Captions say what to notice,** in one or two sentences, including where the screenshot differs from what the participant will see ("The screenshot has an extra test row, TR-007; yours has six.").

## Participant language

- Write for a beginner in their first hour with the product. Plain verbs, short sentences mixed with longer ones, British spelling.
- Keep the scenario's words, not the review process's. Avoid participant-facing phrases like "preserve the unresolved value", "source-supported no change", "evidence gate", "reasoned decision" or "authoritative". Say what to do: "leave the start date as *not yet agreed*".
- **Trainer and validation material never goes in participant text.** Reference-run notes ("the reference author checked…", "tested natively in the reference run"), validation state, timing pilots and answer keys go in `_trainer/` or the course's status file. A hidden HTML comment is acceptable for the next writer; a visible sentence is not.
- Say which skill is practised in plain words near the top ("You'll practise: asking Gemini for a draft, checking it against a fact sheet, and fixing what it got wrong."), not as a list of abstract competencies.

## Before and after

From a Google Docs lab before the rewrite:

> ### 2.3.2 Keep the fact sheet available
>
> 1. Keep `project-facts.txt` open in another tab so a reviewer can compare commitments.
>
> **Check:** You can open the fact sheet for comparison.

A whole section, a step and a check for something that is a single clause in the step where it's needed. In the reference style it is step 1 of the section that uses it.

From Power Automate 04, a section that works:

> ## 4.5 Build One HTML Table
>
> 1. On the canvas, select the **+** below **Select**, then **Add an action**.
> 2. Search for `Create HTML table` and select it under **Data Operation**.
> 3. Click into **From**, open the lightning bolt, and select **Output** under *Select*.
> 4. Leave everything else as it is. Select already defined the headings.
>
> *The whole list goes in, one table comes out.*
>
> **Checkpoint:** If an Apply to each suddenly wraps this action, you picked a single column instead of the whole Output.

Four actions, each finished when the screen changes, a caption that teaches the idea, and a check that names the likely mistake.

## Student read-through

Run this before opening a pull request for a new or rewritten chapter, and whenever the user asks for a "student run". Read the chapter top to bottom as a beginner with the app open beside it. For every section, answer:

1. Do I know which file, tab or window I'm in?
2. Can I tell when each step is finished?
3. Is there exactly one place to paste each block, and does it say what it replaces?
4. Does the order make sense: do I meet a problem before I'm asked to fix it?
5. Does every screenshot show the state after the step it sits under, and do its red boxes and numbers match those steps?
6. Do labels and names agree everywhere (A in one place is A in the next)?
7. Do I know why I'm doing this section, in the scenario's terms?
8. Is there any trainer, reference-run or validation language I'd see as a participant?
9. Could I finish the section within its share of the estimated time?

Report each problem with its section number and a proposed fix. Fix the chapter only when the user asks you to.

## Working with another writer

If Claude and Codex both work on a course, one writer owns a chapter at a time. Before starting, check for open pull requests touching the same chapter or its screenshot specs, and work from that branch or wait. Note in the pull request which sections changed order or number, because screenshot annotations and cross-references depend on them.
