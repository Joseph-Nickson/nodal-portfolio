// Data will be loaded from data.json
let allWorks = [];
let currentFilters = {};
let currentWorkIndex = 0;
let filteredWorks = [];

// Helper: Format semicolon-separated values for display
function formatMultiValue(value) {
  if (!value) return "";
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v)
    .join(", ");
}

// Helper: Get array from semicolon-separated value
function getMultiValues(value) {
  if (!value) return [];
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v);
}

// Helper: Create URL-friendly slug from title
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

// Helper: Find work by slug
function findWorkBySlug(slug) {
  return allWorks.findIndex((work) => slugify(work.title) === slug);
}

// Update URL without reload
function updateURL(params = {}) {
  const url = new URL(window.location);
  url.search = "";
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  window.history.pushState({}, "", url);
}

// Parse URL parameters
function parseURL() {
  const params = new URLSearchParams(window.location.search);
  const filters = {};
  if (params.has("client")) filters.client = params.get("client");
  if (params.has("contribution"))
    filters.contribution = params.get("contribution");
  if (params.has("date")) filters.date = params.get("date");
  if (params.has("style")) filters.style = params.get("style");

  // Check for work parameter
  if (params.has("work")) {
    const slug = params.get("work");
    const index = findWorkBySlug(slug);
    if (index !== -1) {
      return { type: "work", index };
    }
  }

  const hash = window.location.hash.slice(1);
  const section = hash || "portfolio";
  return { type: "section", section, filters };
}

// Apply state from URL on load
function applyURLState() {
  const state = parseURL();

  if (state.type === "work") {
    setTimeout(() => openModal(state.index), 100);
  } else {
    if (Object.keys(state.filters).length > 0) {
      currentFilters = state.filters;
      applyFilters();
    }
    if (state.section) {
      switchSection(state.section);
    }
  }
}

// Load data on page load
// Populate filter dropdown with unique values
function populateFilterDropdown() {
  const select = document.getElementById("filterSelect");
  if (!select) return;

  // Fields that support multiple semicolon-separated values
  const multiValueFields = ["client", "contribution", "software", "style"];

  const filterFields = [
    { key: "client", label: "Client" },
    { key: "date", label: "Year" },
    { key: "contribution", label: "Discipline" },
    { key: "software", label: "Software" },
    { key: "style", label: "Style" },
  ];

  select.innerHTML = '<option value="">Filter by...</option>';

  filterFields.forEach((field) => {
    let values;
    if (multiValueFields.includes(field.key)) {
      // Extract individual values from semicolon-separated strings
      values = [
        ...new Set(allWorks.flatMap((w) => getMultiValues(w[field.key]))),
      ].sort();
    } else {
      values = [
        ...new Set(allWorks.map((w) => w[field.key]).filter((v) => v)),
      ].sort();
    }

    if (values.length > 0) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = field.label;
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = `${field.key}:${value}`;
        option.textContent = value;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    }
  });
}

async function loadData() {
  try {
    const response = await fetch("data.json");
    allWorks = await response.json();
    filteredWorks = [...allWorks];
    renderTable();
    renderPortfolio();
    populateFilterDropdown();
    applyURLState();
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// Render the main table
function renderTable() {
  const table = document.getElementById("worksTable");
  if (!table) return;

  table.innerHTML = "";

  filteredWorks.forEach((work) => {
    const row = document.createElement("div");
    row.className = "table-row";
    const globalIndex = allWorks.indexOf(work);
    row.onclick = () => openModal(globalIndex);

    row.innerHTML = `
            <div class="col-year">${work.date}</div>
            <div class="col-client">${formatMultiValue(work.client)}</div>
            <div class="col-project">${work.title}</div>
            <div class="col-contribution">${formatMultiValue(work.contribution)}</div>
            <div class="col-software">${formatMultiValue(work.software)}</div>
            <div class="col-style">${formatMultiValue(work.style)}</div>
        `;

    table.appendChild(row);
  });
}

// Render portfolio section
function renderPortfolio() {
  const grid = document.getElementById("portfolioGrid");
  grid.innerHTML = "";

  const portfolioWorks = allWorks.filter((work) => work.featured);

  portfolioWorks.forEach((work) => {
    const item = document.createElement("div");
    item.className = "grid-item";
    const globalIndex = allWorks.indexOf(work);
    item.onclick = () => openModal(globalIndex);

    if (work.type === "video") {
      item.innerHTML = `
                <img src="${work.thumbnail}" alt="${work.title}">
                <div class="video-indicator"></div>
            `;
    } else {
      item.innerHTML = `<img src="${work.image}" alt="${work.title}">`;
    }

    grid.appendChild(item);
  });
}

// Open modal with work details
function openModal(index) {
  currentWorkIndex = index;
  const work = allWorks[index];
  const modal = document.getElementById("modal");
  const modalMedia = document.getElementById("modalMedia");
  const modalTitle = document.getElementById("modalTitle");
  const modalTags = document.getElementById("modalTags");

  modalTitle.textContent = work.title;

  // Update URL with work slug
  const slug = slugify(work.title);
  updateURL({ work: slug });

  if (work.type === "video") {
    modalMedia.innerHTML = `<iframe src="https://www.youtube.com/embed/${work.videoId}" allowfullscreen></iframe>`;
  } else {
    modalMedia.innerHTML = `<img src="${work.image}" alt="${work.title}">`;
  }

  // Build tags, splitting multi-value fields into separate clickable tags
  const buildTags = (label, key, value) => {
    const values = getMultiValues(value);
    if (values.length === 0) return "";
    return values
      .map(
        (v) =>
          `<div class="modal-tag" onclick="addFilter('${key}', '${v.replace(/'/g, "\\'")}')">
            <span class="modal-tag-label">${label}</span>${v}
          </div>`,
      )
      .join("");
  };

  modalTags.innerHTML =
    buildTags("Client", "client", work.client) +
    buildTags("Discipline", "contribution", work.contribution) +
    `<div class="modal-tag" onclick="addFilter('date', '${work.date}')">
        <span class="modal-tag-label">Year</span>${work.date}
    </div>` +
    buildTags("Style", "style", work.style);

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

// Close modal
function closeModal() {
  const modal = document.getElementById("modal");
  modal.classList.remove("active");
  document.body.style.overflow = "";
  updateURL(currentFilters);
}

// Navigate to previous work
function prevWork() {
  currentWorkIndex = (currentWorkIndex - 1 + allWorks.length) % allWorks.length;
  openModal(currentWorkIndex);
}

// Navigate to next work
function nextWork() {
  currentWorkIndex = (currentWorkIndex + 1) % allWorks.length;
  openModal(currentWorkIndex);
}

// Add filter
function addFilter(type, value) {
  currentFilters[type] = value;
  closeModal();
  applyFilters();
  switchSection("index");
  updateURL(currentFilters);
}

// Apply filters to works
function applyFilters() {
  const multiValueFields = ["client", "contribution", "software", "style"];

  filteredWorks = allWorks.filter((work) => {
    return Object.entries(currentFilters).every(([key, value]) => {
      if (multiValueFields.includes(key)) {
        // Check if the filter value is one of the semicolon-separated values
        const workValues = getMultiValues(work[key]);
        return workValues.includes(value);
      }
      return work[key] === value;
    });
  });

  renderTable();
  renderActiveFilters();
}

// Render active filter tags
function renderActiveFilters() {
  const container = document.getElementById("activeFilters");
  container.innerHTML = "";

  Object.entries(currentFilters).forEach(([key, value]) => {
    const tag = document.createElement("div");
    tag.className = "filter-tag";

    const labelMap = {
      client: "Client",
      contribution: "Discipline",
      date: "Year",
      style: "Style",
    };

    tag.innerHTML = `
            ${labelMap[key] || key}: ${value}
            <span class="remove">×</span>
        `;
    tag.onclick = () => removeFilter(key);
    container.appendChild(tag);
  });
}

// Remove a specific filter
function removeFilter(type) {
  delete currentFilters[type];
  applyFilters();
  updateURL(currentFilters);
}

// Clear all filters
function clearAllFilters() {
  currentFilters = {};
  applyFilters();
  updateURL();
}

// Switch between sections
function switchSection(sectionId) {
  document.querySelectorAll(".section").forEach((section) => {
    section.classList.remove("active");
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
  });

  document.getElementById(sectionId).classList.add("active");
  const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
  if (targetLink) targetLink.classList.add("active");
  window.location.hash = sectionId;
  window.scrollTo(0, 0);
}

// Go to random work
function goToRandom() {
  const randomIndex = Math.floor(Math.random() * allWorks.length);
  openModal(randomIndex);
}

// Handle browser back/forward
window.addEventListener("popstate", () => {
  applyURLState();
});

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      switchSection(section);
    });
  });

  document.querySelector(".modal-close").addEventListener("click", closeModal);
  document.getElementById("modalPrev").addEventListener("click", prevWork);
  document.getElementById("modalNext").addEventListener("click", nextWork);

  document.getElementById("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modal");
    if (modal.classList.contains("active")) {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") prevWork();
      if (e.key === "ArrowRight") nextWork();
    }
  });

  document.getElementById("randomBtn").addEventListener("click", goToRandom);
  document
    .getElementById("clearFilters")
    .addEventListener("click", clearAllFilters);

  document.getElementById("filterSelect").addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      const [key, filterValue] = value.split(":");
      addFilter(key, filterValue);
      e.target.value = "";
    }
  });
});
