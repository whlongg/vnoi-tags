const PAGE_SIZE = 50;
const GROUP_NAMES = {
  graph_theory: "Lý thuyết Đồ thị",
  data_structure: "Cấu trúc dữ liệu",
  string: "Xử lý xâu",
  dp: "Quy Hoạch Động",
  other: "Kĩ năng khác",
  geometry: "Hình học",
  math: "Toán học",
  flow: "Luồng & Cặp ghép",
  greedy: "Tham lam",
  game_theory: "Lý thuyết trò chơi",
  brute_force: "Duyệt",
  sqrt: "Chia căn (Sqrt Decomposition)",
};

const fold = (value = "") => value.normalize("NFC").toLocaleLowerCase("vi");

export function normalizeCatalog(data) {
  const groups = Object.entries(GROUP_NAMES).map(([code, name]) => ({ code, name, tags: [] }));
  const groupByCode = new Map(groups.map((group) => [group.code, group]));
  const seenTags = new Set();
  const problems = Object.entries(data).map(([code, problem]) => {
    const tags = problem.tags.map((tag) => {
      const group = groupByCode.get(tag.group);
      if (!group) throw new Error(`Unknown tag group: ${tag.group}`);
      if (!seenTags.has(tag.code)) {
        group.tags.push({ code: tag.code, name: tag.name });
        seenTags.add(tag.code);
      }
      return tag.code;
    });
    return { code, name: problem.name, url: problem.link, judge: problem.judge, tags };
  });
  groups.forEach((group) => group.tags.sort((a, b) => a.name.localeCompare(b.name, "vi")));
  return { groups, problems };
}

export function normalizeFilters(params) {
  const page = Number.parseInt(params.get("page") || "1", 10);
  return {
    search: (params.get("search") || "").trim(),
    tag: params.get("tag_id") || "",
    judges: params.getAll("judge").filter(Boolean),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function filterProblems(problems, filters) {
  const query = fold(filters.search);
  const judges = new Set(filters.judges || []);
  return problems.filter((problem) =>
    (!query || fold(problem.code).includes(query) || fold(problem.name).includes(query)) &&
    (!filters.tag || problem.tags.includes(filters.tag)) &&
    (!judges.size || judges.has(problem.judge))
  );
}

export function getPage(items, requestedPage, pageSize = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage || 1), pages);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pages, total: items.length };
}

export function pickRandom(items, random = Math.random) {
  return items.length ? items[Math.floor(random() * items.length)] : null;
}

function paginationItems(page, pages) {
  const visible = new Set([1, pages, page - 1, page, page + 1]);
  const result = [];
  let previous = 0;
  [...visible].filter((value) => value > 0 && value <= pages).sort((a, b) => a - b).forEach((value) => {
    if (value - previous > 1) result.push("…");
    result.push(value);
    previous = value;
  });
  return result;
}

function start(catalog) {
  const form = document.querySelector("#filters");
  const search = document.querySelector("#search");
  const judge = document.querySelector("#judge");
  const tagGroups = document.querySelector("#tag-groups");
  const rows = document.querySelector("#problem-rows");
  const pagination = document.querySelector("#pagination");
  const count = document.querySelector("#result-count");
  const randomButton = document.querySelector("#random");
  const status = document.querySelector("#status");
  const tagNames = new Map(catalog.groups.flatMap((group) => group.tags.map((tag) => [tag.code, tag.name])));
  let filters = normalizeFilters(new URLSearchParams(location.search));

  [...new Set(catalog.problems.map(({ judge: value }) => value).filter(Boolean))].sort().forEach((value) => {
    judge.add(new Option(value, value, false, filters.judges.includes(value)));
  });

  search.value = filters.search;
  catalog.groups.forEach((group, index) => {
    const details = document.createElement("details");
    details.open = index === 0 || group.tags.some(({ code }) => code === filters.tag);
    const summary = document.createElement("summary");
    summary.textContent = group.name;
    details.append(summary);
    const list = document.createElement("div");
    list.className = "tag-list";
    group.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tag.name;
      button.dataset.tag = tag.code;
      button.classList.toggle("selected", tag.code === filters.tag);
      list.append(button);
    });
    details.append(list);
    tagGroups.append(details);
  });

  function updateUrl() {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.tag) params.set("tag_id", filters.tag);
    filters.judges.forEach((value) => params.append("judge", value));
    if (filters.page > 1) params.set("page", String(filters.page));
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
  }

  function render() {
    const filtered = filterProblems(catalog.problems, filters);
    const result = getPage(filtered, filters.page);
    filters.page = result.page;
    rows.replaceChildren(...result.items.map((problem) => {
      const row = document.createElement("tr");
      const code = document.createElement("td");
      code.className = "problem-code";
      const codeLink = document.createElement("a");
      codeLink.href = problem.url;
      codeLink.target = "_blank";
      codeLink.rel = "noopener noreferrer";
      codeLink.textContent = problem.code;
      code.append(codeLink);
      const name = document.createElement("td");
      const nameLink = codeLink.cloneNode();
      nameLink.textContent = problem.name;
      name.append(nameLink);
      const tags = document.createElement("span");
      tags.className = "row-tags";
      tags.textContent = problem.tags.map((tag) => tagNames.get(tag) || tag).join(", ");
      name.append(tags);
      const oj = document.createElement("td");
      oj.textContent = problem.judge || "—";
      row.append(code, name, oj);
      return row;
    }));
    count.textContent = `${result.total.toLocaleString("vi-VN")} bài`;
    status.textContent = result.total ? "" : "Không tìm thấy bài phù hợp.";
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "page-arrow";
    previous.textContent = "←";
    previous.ariaLabel = "Trang trước";
    previous.disabled = result.page === 1;
    previous.addEventListener("click", () => {
      filters.page -= 1;
      updateUrl();
      render();
      scrollTo(0, 0);
    });
    const pageButtons = paginationItems(result.page, result.pages).map((item) => {
      if (item === "…") {
        const span = document.createElement("span");
        span.textContent = item;
        return span;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item;
      button.disabled = item === result.page;
      button.addEventListener("click", () => { filters.page = item; updateUrl(); render(); scrollTo(0, 0); });
      return button;
    });
    const next = document.createElement("button");
    next.type = "button";
    next.className = "page-arrow";
    next.textContent = "→";
    next.ariaLabel = "Trang sau";
    next.disabled = result.page === result.pages;
    next.addEventListener("click", () => {
      filters.page += 1;
      updateUrl();
      render();
      scrollTo(0, 0);
    });
    pagination.replaceChildren(previous, ...pageButtons, next);
    document.querySelectorAll("[data-tag]").forEach((button) => button.classList.toggle("selected", button.dataset.tag === filters.tag));
    updateUrl();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    filters = { ...filters, search: search.value.trim(), judges: [...judge.selectedOptions].map(({ value }) => value), page: 1 };
    render();
  });
  tagGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (!button) return;
    filters = { ...filters, tag: filters.tag === button.dataset.tag ? "" : button.dataset.tag, page: 1 };
    render();
  });
  document.querySelector("#clear").addEventListener("click", () => { location.href = location.pathname; });
  randomButton.addEventListener("click", () => {
    const problem = pickRandom(filterProblems(catalog.problems, filters));
    if (problem) window.open(problem.url, "_blank", "noopener");
  });
  render();
}

if (typeof document !== "undefined") {
  fetch("./data.json")
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(normalizeCatalog)
    .then(start)
    .catch(() => {
      document.querySelector("#status").textContent = "Không tải được dữ liệu. Vui lòng thử lại sau.";
    });
}
