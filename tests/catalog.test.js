import assert from "node:assert/strict";
import test from "node:test";

import { filterProblems, getPage, normalizeFilters, pickRandom } from "../app.js";

const problems = [
  { code: "AC_1", name: "Đường đi ngắn nhất", judge: "Atcoder", tags: ["graph", "dijkstra"] },
  { code: "CF_2", name: "Cây khung nhỏ nhất", judge: "Codeforces", tags: ["graph", "mst"] },
  { code: "VNOJ_3", name: "Xâu đối xứng", judge: "VNOJ", tags: ["string"] },
];

test("normalizes shareable filters", () => {
  const params = new URLSearchParams("search=%20%C4%90%C6%B0%E1%BB%9Dng%20&tag_id=graph&judge=Atcoder&judge=Codeforces&page=0");
  assert.deepEqual(normalizeFilters(params), {
    search: "Đường",
    tag: "graph",
    judges: ["Atcoder", "Codeforces"],
    page: 1,
  });
});

test("combines text, tag, and judge filters", () => {
  const result = filterProblems(problems, {
    search: "đường",
    tag: "graph",
    judges: ["Atcoder", "Codeforces"],
  });
  assert.deepEqual(result.map(({ code }) => code), ["AC_1"]);
});

test("searches problem codes without case sensitivity", () => {
  assert.deepEqual(filterProblems(problems, { search: "cf_2" }).map(({ code }) => code), ["CF_2"]);
});

test("paginates and clamps invalid pages", () => {
  assert.deepEqual(getPage(problems, 2, 2), { items: [problems[2]], page: 2, pages: 2, total: 3 });
  assert.equal(getPage(problems, 99, 2).page, 2);
});

test("random selection stays inside the filtered collection", () => {
  assert.equal(pickRandom([problems[1]], () => 0.99), problems[1]);
  assert.equal(pickRandom([], () => 0), null);
});
