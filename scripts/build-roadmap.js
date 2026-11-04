#!/usr/bin/env node
// Generates ROADMAP.md from docs/roadmap.js so the Markdown and the interactive page never drift.
// Usage: node scripts/build-roadmap.js
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const R = require(path.join(root, "docs", "roadmap.js"));

const link = (l) => `[${l.label}](${l.href.startsWith("repo:") ? l.href.slice(5) : l.href})`;
const tags = (t) =>
  (t.yield === "high" ? " **[high yield]**" : "") + (t.yield === "low" ? " _[concept only]_" : "");

const out = [];
out.push("<!-- Generated from docs/roadmap.js by scripts/build-roadmap.js. Edit the source, not this file. -->");
out.push("# CKAD Roadmap");
out.push("");
out.push(`> **Prefer clicking boxes?** The [interactive version](${R.site}) tracks your progress, schedules the weeks from your exam date and gates your go/no-go. To tick boxes here instead, fork the repo and edit this file, or paste it into a GitHub issue.`);
out.push("");
out.push(`Exam: Kubernetes ${R.exam.kubernetes} · ${R.exam.duration} · ${R.exam.tasks} · pass mark ${R.exam.passScore} · ${R.exam.price}.`);
out.push("");
out.push("| Domain | Weight |");
out.push("|---|---|");
R.domains.forEach((d) => out.push(`| ${d.name} | ${d.weight}% |`));
out.push("");
out.push("## Daily rules");
out.push("");
R.rules.forEach((r, i) => out.push(`${i + 1}. ${r}`));
out.push("");

R.weeks.forEach((w) => {
  out.push(`## ${w.title}`);
  out.push("");
  if (w.domain) out.push(`_Domain: ${w.domain}_`), out.push("");
  out.push(`**Goal:** ${w.goal}`);
  out.push("");
  w.tasks.forEach((t) => {
    const links = (t.links || []).map(link).join(" · ");
    out.push(`- [ ] **${t.type}** ${t.text}${tags(t)}${links ? " — " + links : ""}`);
  });
  out.push("");
});

out.push("## Readiness gates");
out.push("");
out.push("Book or keep your date only when every gate is green.");
out.push("");
R.gates.forEach((g) => out.push(`- [ ] ${g.text}`));
out.push("");

fs.writeFileSync(path.join(root, "ROADMAP.md"), out.join("\n"));

// Guard against duplicate ids: progress is stored by id in the reader's browser.
const ids = R.weeks.flatMap((w) => w.tasks.map((t) => t.id)).concat(R.gates.map((g) => g.id));
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) {
  console.error("Duplicate task ids: " + dupes.join(", "));
  process.exit(1);
}
console.log(`ROADMAP.md written: ${R.weeks.length} weeks, ${ids.length - R.gates.length} tasks, ${R.gates.length} gates.`);
