import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(repositoryRoot, "..", "source-audit");
const pagePath = join(repositoryRoot, "app", "page.tsx");
const pageSource = readFileSync(pagePath, "utf8");
const sourceFile = ts.createSourceFile(pagePath, pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const routes = {
  dsh: {
    lessonVariable: "dshLessons",
    lessonPrefix: "D",
    repository: "dsh",
    revision: "47f943859bef60e4160492346772ded9b24f765a",
  },
  pi: {
    lessonVariable: "piLessons",
    lessonPrefix: "P",
    repository: "pi-mono",
    revision: "d3ab2af969d64997338253c9151190aa1bc33580",
  },
  nanobot: {
    lessonVariable: "nanobotLessons",
    lessonPrefix: "N",
    repository: "nanobot",
    revision: "c27b1f14c3695da233a7733a478d66ef6d6943d4",
  },
  claude: {
    lessonVariable: "claudeLessons",
    lessonPrefix: "C",
    repository: "claude-code",
    revision: "3bb6b5746238c418138eb96d57765d79012edd96",
  },
  openclaw: {
    lessonVariable: "openclawLessons",
    lessonPrefix: "O",
    repository: "openclaw-local",
    revision: "0a6a1d94192b5ffe3532df0195ac383f53b4b772",
  },
};

function unwrap(node) {
  if (
    ts.isAsExpression(node)
    || ts.isSatisfiesExpression(node)
    || ts.isParenthesizedExpression(node)
    || ts.isTypeAssertionExpression(node)
  ) return unwrap(node.expression);
  return node;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  throw new Error(`Unsupported property name: ${node.getText(sourceFile)}`);
}

function evaluate(node) {
  node = unwrap(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate);
  if (ts.isObjectLiteralExpression(node)) {
    const value = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Unsupported object member: ${property.getText(sourceFile)}`);
      }
      value[propertyName(property.name)] = evaluate(property.initializer);
    }
    return value;
  }
  throw new Error(`Unsupported static value: ${node.getText(sourceFile).slice(0, 120)}`);
}

function readVariable(name) {
  let found;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) found = declaration.initializer;
    }
  });
  assert.ok(found, `missing ${name} in app/page.tsx`);
  return evaluate(found);
}

function gitHead(repositoryPath) {
  return execFileSync("git", ["-C", repositoryPath, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function assertSubstantive(value, minimum, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length >= minimum, `${label} is too short (${value.trim().length} < ${minimum})`);
}

const lessonDetails = readVariable("lessonDetails");
const lessonDrills = readVariable("lessonDrills");
const auditedLessonIds = new Set();
const drillFailureTriggers = new Set();
const drillExperiments = new Set();
const drillQuestions = new Set();
let evidenceCount = 0;
let traceCount = 0;

for (const [route, config] of Object.entries(routes)) {
  const repositoryPath = join(sourceRoot, config.repository);
  assert.ok(existsSync(repositoryPath), `${route}: missing local source repository ${repositoryPath}`);
  assert.equal(gitHead(repositoryPath), config.revision, `${route}: local source revision drifted`);

  const lessons = readVariable(config.lessonVariable);
  assert.equal(lessons.length, 8, `${route}: expected 8 lessons`);

  for (const [index, lesson] of lessons.entries()) {
    const expectedId = `${config.lessonPrefix}${String(index + 1).padStart(2, "0")}`;
    assert.equal(lesson.id, expectedId, `${route}: lesson order or id drifted`);
    assert.ok(!auditedLessonIds.has(lesson.id), `${lesson.id}: duplicate lesson id`);
    auditedLessonIds.add(lesson.id);

    assertSubstantive(lesson.why, 70, `${lesson.id}.why`);
    assertSubstantive(lesson.model, 25, `${lesson.id}.model`);
    assertSubstantive(lesson.takeaway, 30, `${lesson.id}.takeaway`);
    assert.ok(Array.isArray(lesson.flow) && lesson.flow.length >= 5, `${lesson.id}: flow needs at least five stages`);
    assert.ok(Array.isArray(lesson.points) && lesson.points.length >= 3, `${lesson.id}: needs three design invariants`);

    const detail = lessonDetails[lesson.id];
    assert.ok(detail, `${lesson.id}: missing lessonDetails entry`);
    assertSubstantive(detail.architecture, 120, `${lesson.id}.architecture`);
    assert.ok(Array.isArray(detail.evidence) && detail.evidence.length >= 4, `${lesson.id}: needs at least four source anchors`);
    assert.ok(Array.isArray(detail.trace) && detail.trace.length >= 4, `${lesson.id}: needs at least four audited trace stages`);

    const drill = lessonDrills[lesson.id];
    assert.ok(drill, `${lesson.id}: missing lesson-specific failure and lab drill`);
    assertSubstantive(drill.failureTrigger, 35, `${lesson.id}.drill.failureTrigger`);
    assertSubstantive(drill.failureSymptom, 35, `${lesson.id}.drill.failureSymptom`);
    assertSubstantive(drill.debugPath, 30, `${lesson.id}.drill.debugPath`);
    assertSubstantive(drill.experiment, 35, `${lesson.id}.drill.experiment`);
    assertSubstantive(drill.deliverable, 20, `${lesson.id}.drill.deliverable`);
    assertSubstantive(drill.reviewQuestion, 15, `${lesson.id}.drill.reviewQuestion`);
    assertSubstantive(drill.reviewAnswer, 35, `${lesson.id}.drill.reviewAnswer`);
    assert.ok(!drillFailureTriggers.has(drill.failureTrigger), `${lesson.id}: duplicated failure trigger`);
    assert.ok(!drillExperiments.has(drill.experiment), `${lesson.id}: duplicated experiment`);
    assert.ok(!drillQuestions.has(drill.reviewQuestion), `${lesson.id}: duplicated review question`);
    drillFailureTriggers.add(drill.failureTrigger);
    drillExperiments.add(drill.experiment);
    drillQuestions.add(drill.reviewQuestion);

    for (const [evidenceIndex, evidence] of detail.evidence.entries()) {
      const label = `${lesson.id}.evidence[${evidenceIndex}]`;
      assert.ok(["代码事实", "测试证据", "架构推断"].includes(evidence.kind), `${label}: missing evidence kind`);
      assertSubstantive(evidence.symbol, 3, `${label}.symbol`);
      assertSubstantive(evidence.note, 38, `${label}.note`);
      assert.ok(Number.isInteger(evidence.lineStart) && evidence.lineStart > 0, `${label}: invalid lineStart`);
      assert.ok(Number.isInteger(evidence.lineEnd) && evidence.lineEnd >= evidence.lineStart, `${label}: invalid lineEnd`);

      const sourcePath = join(repositoryPath, evidence.file);
      assert.ok(existsSync(sourcePath), `${label}: source file does not exist: ${evidence.file}`);
      const lineCount = readFileSync(sourcePath, "utf8").split(/\r?\n/).length;
      assert.ok(evidence.lineEnd <= lineCount, `${label}: L${evidence.lineEnd} exceeds ${evidence.file} (${lineCount} lines)`);
      evidenceCount += 1;
    }

    for (const [traceIndex, trace] of detail.trace.entries()) {
      const label = `${lesson.id}.trace[${traceIndex}]`;
      assertSubstantive(trace.name, 2, `${label}.name`);
      assertSubstantive(trace.input, 6, `${label}.input`);
      assertSubstantive(trace.responsibility, 15, `${label}.responsibility`);
      assertSubstantive(trace.output, 5, `${label}.output`);
      assertSubstantive(trace.anchor, 5, `${label}.anchor`);
      traceCount += 1;
    }
  }
}

assert.equal(auditedLessonIds.size, 40, "expected exactly 40 audited lessons");
assert.deepEqual(new Set(Object.keys(lessonDetails)), auditedLessonIds, "lessonDetails contains missing or orphan lesson ids");
assert.deepEqual(new Set(Object.keys(lessonDrills)), auditedLessonIds, "lessonDrills contains missing or orphan lesson ids");

console.log(`source evidence audit passed: ${auditedLessonIds.size} lessons, ${evidenceCount} anchors, ${traceCount} trace stages`);
