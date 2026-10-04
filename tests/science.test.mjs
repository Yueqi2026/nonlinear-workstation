import assert from "node:assert/strict";
import test from "node:test";
import { CD8_V1, fitBoth, parseCsv, preview, T } from "../lib/science/cd8.ts";
import { REF, basins, referenceMatchCount, trajectory } from "../lib/science/yeast.ts";

test("CD8T preview is deterministic and preserves the baseline grid", () => {
  const first = preview(CD8_V1);
  const second = preview(CD8_V1);
  assert.deepEqual(first, second);
  assert.equal(first.m0.y.length, T.length);
  assert.equal(first.m1.y.length, T.length);
  assert.ok(first.m0.error >= 0);
});

test("CD8T CSV parser normalizes fractional observations", () => {
  const parsed = parseCsv("time,value\n0,0.03\n4,0.09\n8,0.27", CD8_V1);
  assert.equal(parsed.data[0], 3);
  assert.equal(parsed.data[1], 9);
  assert.match(parsed.note, /换算为百分比/);
});

test("CD8T fit uses a real deterministic search result", () => {
  const result = fitBoth(CD8_V1);
  assert.equal(result.m0.starts, 1200);
  assert.equal(result.m1.starts, 2600);
  assert.ok(result.m0.y.some((value) => value !== result.m1.y[0]));
});

test("yeast boolean executor reports its comparison with the reference sequence", () => {
  assert.equal(referenceMatchCount(false), 11);
  assert.equal(referenceMatchCount(true), 1);
  assert.equal(trajectory(true).length, REF.length);
});

test("yeast basin enumeration covers all 2048 initial states", () => {
  const rows = basins(false);
  assert.equal(rows.reduce((sum, row) => sum + row.basin, 0), 2048);
  assert.ok(rows.some((row) => row.cycle === 1));
});
