// Data will be loaded from data.json
let allWorks = [];
let currentFilters = {};
let currentWorkIndex = 0;
let filteredWorks = [];
let modalWorksList = []; // The list of works being navigated in modal (filtered or all)

// Wait for shared modules to load, with fallback
function getUtils() {
  return (
    window.PortfolioUtils || {
      formatMultiValue: (value) => {
        if (!value) return "";
        return value
          .split(";")
          .map((v) => v.trim())
          .filter((v) => v)
          .join(", ");
      },
      getMultiValues: (value) => {
        if (!value) return [];
        return value
          .split(";")
          .map((v) => v.trim())
          .filter((v) => v);
      },
      slugify: (text) => {
        if (!text) return "";
        return text
          .toString()
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^\w\-]+/g, "")
          .replace(/\-\-+/g, "-")
          .replace(/^-+/, "")
          .replace(/-+$/, "");
      },
    }
  );
}

function getConfig() {
  return (
    window.PortfolioConfig || {
      multiValueFields: ["client", "contribution", "software", "style"],
      fieldLabels: {
        client: "Client",
        contribution: "Discipline",
        date: "Year",
        style: "Style",
        software: "Software",
      },
      filterFields: [
        { key: "client", label: "Client" },
        { key: "date", label: "Year" },
        { key: "contribution", label: "Discipline" },
        { key: "software", label: "Software" },
        { key: "style", label: "Style" },
      ],
    }
  );
}

// Helper: Find work by slug
function findWorkBySlug(slug) {
  const { slugify } = getUtils();
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
    // Opening from URL navigates through all works
    modalWorksList = allWorks;
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

// Populate filter dropdown with unique values
function populateFilterDropdown() {
  const select = document.getElementById("filterSelect");
  if (!select) return;

  const config = getConfig();
  const { getMultiValues } = getUtils();

  select.innerHTML = '<option value="">Filter by...</option>';

  config.filterFields.forEach((field) => {
    let values;
    if (config.multiValueFields.includes(field.key)) {
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

// Load data on page load
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

// Format multi-value field as clickable filter bubbles
function formatAsFilterBubbles(value, filterKey) {
  const { getMultiValues } = getUtils();
  const values = getMultiValues(value);
  if (values.length === 0) return "";
  return values
    .map(
      (v) =>
        `<span class="filter-value" data-filter-key="${filterKey}" data-filter-value="${v.replace(/"/g, '&quot;')}">${v}</span>`,
    )
    .join(" ");
}

// Render the main table
function renderTable() {
  const table = document.getElementById("worksTable");
  if (!table) return;

  table.innerHTML = "";

  filteredWorks.forEach((work, filteredIndex) => {
    const row = document.createElement("div");
    row.className = "table-row";

    row.innerHTML = `
      <div class="col-year">${work.date}</div>
      <div class="col-client">${formatAsFilterBubbles(work.client, "client")}</div>
      <div class="col-project">${work.title}</div>
      <div class="col-contribution">${formatAsFilterBubbles(work.contribution, "contribution")}</div>
      <div class="col-software">${formatAsFilterBubbles(work.software, "software")}</div>
      <div class="col-style">${formatAsFilterBubbles(work.style, "style")}</div>
    `;

    // Add click handler for the row, but not for filter bubbles
    // Use filteredIndex and flag to navigate through filtered works
    row.addEventListener("click", (e) => {
      if (!e.target.classList.contains("filter-value")) {
        openModal(filteredIndex, true);
      }
    });

    // Add click handlers for filter bubbles
    row.querySelectorAll(".filter-value").forEach((bubble) => {
      bubble.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = bubble.dataset.filterKey;
        const value = bubble.dataset.filterValue;
        addFilter(key, value);
      });
    });

    table.appendChild(row);
  });
}

// Render portfolio section
// Helper to get image src (handles both string and object formats)
function getImageSrc(img) {
  if (typeof img === 'string') return img;
  return img.src || '';
}

function renderPortfolio() {
  const grid = document.getElementById("portfolioGrid");
  grid.innerHTML = "";

  const portfolioWorks = allWorks.filter((work) => work.featured);
  const { getMultiValues } = getUtils();
  const config = getConfig();

  portfolioWorks.forEach((work, portfolioIndex) => {
    const item = document.createElement("div");
    item.className = "grid-item";

    // Use images array (standardized), handle object format
    const firstImage = work.images && work.images.length > 0 ? work.images[0] : null;
    const displayImage = firstImage ? getImageSrc(firstImage) : (work.thumbnail || "");

    // Build meta tags for hover panel
    const buildMetaTags = (key, value) => {
      const values = getMultiValues(value);
      if (values.length === 0) return "";
      return values.map((v) => `<span class="tile-tag">${v}</span>`).join("");
    };

    const metaTags = [
      buildMetaTags("client", work.client),
      buildMetaTags("contribution", work.contribution),
      `<span class="tile-tag">${work.date}</span>`,
      buildMetaTags("style", work.style),
    ].filter(Boolean).join("");

    if (work.type === "video") {
      item.innerHTML = `
        <div class="tile-image">
          <img src="${work.thumbnail || displayImage}" alt="${work.title}">
          <div class="video-indicator"></div>
        </div>
        <div class="tile-info">
          <h4>${work.title}</h4>
          <div class="tile-tags">${metaTags}</div>
        </div>
      `;
    } else {
      item.innerHTML = `
        <div class="tile-image">
          <img src="${displayImage}" alt="${work.title}">
        </div>
        <div class="tile-info">
          <h4>${work.title}</h4>
          <div class="tile-tags">${metaTags}</div>
        </div>
      `;
    }

    // Navigate through featured works only when opened from portfolio
    item.addEventListener("click", () => {
      modalWorksList = portfolioWorks;
      openModal(portfolioIndex);
    });
    grid.appendChild(item);
  });
}

// Open modal with work details
// If fromFilteredList is true, navigation will use filteredWorks
function openModal(index, fromFilteredList = false) {
  // Determine which list to use for navigation
  if (fromFilteredList && Object.keys(currentFilters).length > 0) {
    modalWorksList = filteredWorks;
    currentWorkIndex = index;
  } else if (modalWorksList.length === 0 || !fromFilteredList) {
    // Default to allWorks if no list set or explicitly not from filtered
    modalWorksList = allWorks;
    currentWorkIndex = index;
  }

  const work = modalWorksList[currentWorkIndex];
  if (!work) return;

  const modal = document.getElementById("modal");
  const container = document.getElementById("modalScrollContainer");

  const { slugify, getMultiValues } = getUtils();
  const config = getConfig();

  // Update URL with work slug
  const slug = slugify(work.title);
  updateURL({ work: slug });

  // Build meta tags HTML
  const buildMetaItem = (label, key, value) => {
    const values = getMultiValues(value);
    if (values.length === 0) return "";
    const valueSpans = values
      .map((v) => `<span class="meta-value" onclick="addFilter('${key}', '${v.replace(/'/g, "\\'")}')">${v}</span>`)
      .join("");
    return `<div class="meta-item"><span class="meta-label">${label}</span>${valueSpans}</div>`;
  };

  const metaHTML =
    buildMetaItem(config.fieldLabels.client, "client", work.client) +
    buildMetaItem(config.fieldLabels.contribution, "contribution", work.contribution) +
    `<div class="meta-item"><span class="meta-label">${config.fieldLabels.date}</span><span class="meta-value" onclick="addFilter('date', '${work.date}')">${work.date}</span></div>` +
    buildMetaItem(config.fieldLabels.style, "style", work.style) +
    buildMetaItem(config.fieldLabels.software, "software", work.software);

  // Build description HTML
  const descriptionHTML = work.info && work.info.trim()
    ? `<p class="modal-description">${work.info}</p>`
    : "";

  // Helper to get image src and caption (supports both string and object formats)
  const getImageData = (img) => {
    if (typeof img === 'string') {
      return { src: img, caption: null };
    }
    return { src: img.src, caption: img.caption || null };
  };

  let contentHTML = "";

  if (work.type === "video") {
    // Video: single media card + details
    contentHTML = `
      <div class="modal-card modal-card-media">
        <div class="modal-media">
          <iframe src="https://www.youtube.com/embed/${work.videoId}" allowfullscreen></iframe>
        </div>
      </div>
      <div class="modal-card modal-card-details">
        <h3>${work.title}</h3>
        ${descriptionHTML}
        <div class="modal-meta">${metaHTML}</div>
      </div>
    `;
  } else {
    // Image work: first image card
    const images = work.images && work.images.length > 0 ? work.images : [];
    const firstImg = images[0] ? getImageData(images[0]) : { src: "", caption: null };

    contentHTML = `
      <div class="modal-card modal-card-media">
        <div class="modal-media">
          <img src="${firstImg.src}" alt="${work.title}">
        </div>
        ${firstImg.caption ? `<div class="image-caption">${firstImg.caption}</div>` : ""}
      </div>
      <div class="modal-card modal-card-details">
        <h3>${work.title}</h3>
        ${descriptionHTML}
        <div class="modal-meta">${metaHTML}</div>
      </div>
    `;

    // Add additional image cards (starting from index 1)
    if (images.length > 1) {
      for (let i = 1; i < images.length; i++) {
        const imgData = getImageData(images[i]);
        contentHTML += `
          <div class="modal-card modal-card-image">
            <img src="${imgData.src}" alt="${work.title} - Image ${i + 1}">
            ${imgData.caption ? `<div class="image-caption">${imgData.caption}</div>` : ""}
          </div>
        `;
      }
    }
  }

  container.innerHTML = contentHTML;

  modal.classList.add("active");
  document.body.style.overflow = "hidden";

  // Scroll modal to top
  modal.scrollTop = 0;
}

// Close modal
function closeModal() {
  const modal = document.getElementById("modal");
  const container = document.getElementById("modalScrollContainer");

  // Stop any playing video by clearing the iframe
  const iframe = container.querySelector("iframe");
  if (iframe) {
    iframe.src = "";
  }

  modal.classList.remove("active");
  document.body.style.overflow = "";
  updateURL(currentFilters);
}

// Navigate to previous work
function prevWork() {
  if (modalWorksList.length === 0) modalWorksList = allWorks;
  currentWorkIndex = (currentWorkIndex - 1 + modalWorksList.length) % modalWorksList.length;
  openModal(currentWorkIndex);
}

// Navigate to next work
function nextWork() {
  if (modalWorksList.length === 0) modalWorksList = allWorks;
  currentWorkIndex = (currentWorkIndex + 1) % modalWorksList.length;
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
  const config = getConfig();
  const { getMultiValues } = getUtils();

  filteredWorks = allWorks.filter((work) => {
    return Object.entries(currentFilters).every(([key, value]) => {
      if (config.multiValueFields.includes(key)) {
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
  const config = getConfig();
  container.innerHTML = "";

  Object.entries(currentFilters).forEach(([key, value]) => {
    const tag = document.createElement("div");
    tag.className = "filter-tag";

    tag.innerHTML = `
      ${config.fieldLabels[key] || key}: ${value}
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

  // Update hash without scrolling
  history.replaceState(null, null, `#${sectionId}`);
  window.scrollTo(0, 0);
}

// Go to random work
function goToRandom() {
  modalWorksList = allWorks;
  const randomIndex = Math.floor(Math.random() * allWorks.length);
  openModal(randomIndex);
}

// Showreel functionality
const SHOWREEL_VIDEO_ID = "xutmhyLQKxk";

function openShowreel() {
  const modal = document.getElementById("showreelModal");
  const iframe = modal.querySelector("iframe");
  iframe.src = `https://www.youtube.com/embed/${SHOWREEL_VIDEO_ID}?autoplay=1`;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeShowreel() {
  const modal = document.getElementById("showreelModal");
  const iframe = modal.querySelector("iframe");
  iframe.src = "";
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// Handle browser back/forward
window.addEventListener("popstate", () => {
  applyURLState();
});

// Show admin link only when running locally
function showAdminLinkIfLocal() {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const adminLink = document.getElementById("adminLink");
    if (adminLink) {
      adminLink.style.display = "";
    }
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  showAdminLinkIfLocal();

  document.querySelectorAll(".nav-link[data-section]").forEach((link) => {
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

  // Showreel event listeners
  document.getElementById("showreelLink").addEventListener("click", (e) => {
    e.preventDefault();
    openShowreel();
  });

  document.getElementById("showreelClose").addEventListener("click", closeShowreel);

  document.getElementById("showreelModal").addEventListener("click", (e) => {
    if (e.target.id === "showreelModal") {
      closeShowreel();
    }
  });

  // Update keydown to handle showreel modal too
  document.addEventListener("keydown", (e) => {
    const showreelModal = document.getElementById("showreelModal");
    if (showreelModal.classList.contains("active")) {
      if (e.key === "Escape") closeShowreel();
    }
  });
});
