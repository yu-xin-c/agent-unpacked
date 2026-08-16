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

test("gives every lesson at least two real source anchors", () => {
  const evidenceAnchors = page.match(/\{\s*file:\s*"[^"]+",\s*symbol:\s*"[^"]+",[^}]*?note:/g) ?? [];
  assert.ok(evidenceAnchors.length >= 80, `expected at least 80 evidence anchors, found ${evidenceAnchors.length}`);
  assert.match(page, /固定提交、精确到行/);
});

test("teaches from an Agent architecture learner perspective", () => {
  for (const section of [
    "架构导读",
    "逐节点调用链审计",
    "设计不变量",
    "失败路径",
    "35 分钟动手实验",
    "架构评审题",
  ]) {
    assert.match(page, new RegExp(section));
  }

  assert.match(page, /状态归谁、控制权如何转移、边界怎样替换、失败在哪里收口/);
});

test("unpacks signature designs separately for every system", () => {
  const gems = page.match(/\{ name: "[^"]+", ordinary:/g) ?? [];
  assert.equal(gems.length, 20);

  for (const field of ["常规做法", "它的选择", "架构收益", "代价 / 边界"]) {
    assert.match(page, new RegExp(field));
  }
});
