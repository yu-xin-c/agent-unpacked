import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("keeps all five architecture routes and forty lessons", () => {
  for (const route of ["dsh", "pi", "nanobot", "claude", "openclaw"]) {
    assert.match(page, new RegExp(`\\b${route}: \\{`));
  }

  const lessonIds = page.match(/id:\s*"[NDPCO]\d{2}"/g) ?? [];
  assert.equal(lessonIds.length, 40);
});

test("gives every lesson at least four real source anchors", () => {
  const evidenceAnchors = page.match(/\{\s*file:\s*"[^"]+",\s*symbol:\s*"[^"]+",[^}]*?note:/g) ?? [];
  assert.ok(evidenceAnchors.length >= 160, `expected at least 160 evidence anchors, found ${evidenceAnchors.length}`);
  assert.match(page, /链接固定在提交/);
});

test("gives all forty lessons their own failure drill and review question", () => {
  const drillBlock = page.match(/const lessonDrills:[\s\S]+?\n};\n\nconst systemDesignGems/);
  assert.ok(drillBlock, "lessonDrills block is missing");
  const drillIds = drillBlock[0].match(/^\s{2}[NDPCO]\d{2}: \{/gm) ?? [];
  assert.equal(drillIds.length, 40);
  for (const field of ["drill.failureTrigger", "drill.failureSymptom", "drill.debugPath", "drill.experiment", "drill.deliverable", "drill.reviewQuestion"]) {
    assert.match(page, new RegExp(field.replace(".", "\\.")));
  }
  assert.doesNotMatch(page, /它约束这一层只拥有自己的状态和转换/);
});

test("teaches from an Agent architecture learner perspective", () => {
  for (const section of [
    "值得单独设计",
    "控制权怎样移动",
    "追下去",
    "被破坏",
    "用一次失败检验",
    "适用到哪里",
  ]) {
    assert.match(page, new RegExp(section));
  }

  for (const repeatedJargon of ["三副“源码眼镜”", "ARCHITECTURE PRESSURE", "HANDS-ON LAB", "ACCEPTANCE CRITERIA"]) {
    assert.doesNotMatch(page, new RegExp(repeatedJargon));
  }
});

test("uses prose for arguments and reserves containers for useful interactions", () => {
  for (const proseClass of ["editorial-intro", "evidence-list", "trace-story", "invariant-prose", "failure-story"]) {
    assert.match(page, new RegExp(`className="${proseClass}`));
  }

  for (const removedTemplate of ["lesson-depth-contract", "essay-cards", "evidence-grid", "trace-audit", "invariant-grid", "failure-lab", "experiment-brief"]) {
    assert.doesNotMatch(page, new RegExp(`className="${removedTemplate}`));
  }
});

test("unpacks signature designs separately for every system", () => {
  const gems = page.match(/\{ name: "[^"]+", ordinary:/g) ?? [];
  assert.equal(gems.length, 20);

  for (const field of ["常规做法", "它的选择", "架构收益", "代价 / 边界"]) {
    assert.match(page, new RegExp(field));
  }
});

test("lets learners collapse and restore the course sidebar", () => {
  assert.match(page, /agent-unpacked-sidebar-collapsed/);
  assert.match(page, /aria-expanded=\{!sidebarCollapsed\}/);
  assert.match(page, /aria-controls="course-sidebar-content"/);
  assert.match(page, /展开课程侧边栏/);
  assert.match(page, /收起课程侧边栏/);
});
