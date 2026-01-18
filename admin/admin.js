// Admin Interface for Works Management
// Uses unified server at root (port 3000)

// API base URL - always relative since admin is served by the same server
const API_BASE_URL = "/api";

// CSRF token storage
let csrfToken = null;

// State Management
let works = [];
let currentWork = null;
let isEditMode = false;
let currentImages = []; // Array of {src, caption} objects for existing images
let pendingFiles = []; // Array of {file, caption} objects for new uploads
let allImages = []; // Combined array for display
let editingCaptionIndex = null; // Track which image caption is being edited

// DOM Elements
const elements = {
  worksBody: document.getElementById("worksBody"),
  searchInput: document.getElementById("searchInput"),
  yearFilter: document.getElementById("yearFilter"),
  industryFilter: document.getElementById("industryFilter"),
  typeFilter: document.getElementById("typeFilter"),
  addWorkBtn: document.getElementById("addWorkBtn"),
  buildBtn: document.getElementById("buildBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  totalWorksEl: document.getElementById("totalWorks"),
  featuredWorksEl: document.getElementById("featuredWorks"),
  lastBuildEl: document.getElementById("lastBuild"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  workForm: document.getElementById("workForm"),
  videoIdGroup: document.getElementById("videoIdGroup"),
  imagesGrid: document.getElementById("imagesGrid"),
  buildStatus: document.getElementById("buildStatus"),
};

// Drag and drop state
let draggedElement = null;
let draggedIndex = null;

// Get utilities (with fallback)
function getUtils() {
  return (
    window.PortfolioUtils || {
      escapeHtml: (text) => {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      },
    }
  );
}

// Get config (with fallback)
function getConfig() {
  return (
    window.PortfolioConfig || {
      industries: ["Film", "TV", "Games", "Advertising", "Music", "Personal"],
      workTypes: ["image", "video"],
    }
  );
}

// Fetch CSRF token
async function fetchCsrfToken() {
  try {
    const response = await fetch(`${API_BASE_URL}/csrf-token`);
    const data = await response.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (error) {
    console.error("Failed to fetch CSRF token:", error);
    return null;
  }
}

// API wrapper with error handling and CSRF
async function apiRequest(url, options = {}) {
  try {
    // Add CSRF token for mutating requests
    if (["POST", "PUT", "DELETE"].includes(options.method)) {
      if (!csrfToken) {
        await fetchCsrfToken();
      }
      options.headers = {
        ...options.headers,
        "X-CSRF-Token": csrfToken,
      };
    }

    const response = await fetch(`${API_BASE_URL}${url}`, options);

    // Refresh CSRF token if invalid
    if (response.status === 403) {
      await fetchCsrfToken();
      options.headers["X-CSRF-Token"] = csrfToken;
      const retryResponse = await fetch(`${API_BASE_URL}${url}`, options);
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Request failed: ${retryResponse.status}`,
        );
      }
      return await retryResponse.json();
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Request failed: ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${url}]:`, error);
    throw error;
  }
}

// Show status message
function showStatus(message, type = "info") {
  elements.buildStatus.textContent = message;
  elements.buildStatus.className = `build-status ${type}`;
  elements.buildStatus.style.display = "block";

  if (type !== "info") {
    setTimeout(() => {
      elements.buildStatus.style.display = "none";
    }, 5000);
  }
}

// Render image preview HTML
function renderImagePreview(
  imageSrc,
  alt = "",
  size = { width: 60, height: 40 },
) {
  const { escapeHtml } = getUtils();
  if (!imageSrc) {
    return `<div style="width: ${size.width}px; height: ${size.height}px; background: #3a3a40; border-radius: 4px;"></div>`;
  }

  return `<img src="${imageSrc}" alt="${escapeHtml(alt)}"
           style="width: ${size.width}px; height: ${size.height}px; object-fit: cover; border-radius: 4px;">`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  // Fetch CSRF token first
  await fetchCsrfToken();

  initializeEventListeners();
  initializeCaptionModal();
  loadWorks();
  loadLastBuildTime();
});

// Event Listeners
function initializeEventListeners() {
  elements.addWorkBtn.addEventListener("click", openAddModal);
  elements.buildBtn.addEventListener("click", handleBuild);
  elements.cancelBtn.addEventListener("click", closeModal);
  elements.workForm.addEventListener("submit", handleFormSubmit);
  elements.searchInput.addEventListener("input", filterWorks);
  elements.yearFilter.addEventListener("change", filterWorks);
  elements.industryFilter.addEventListener("change", filterWorks);
  elements.typeFilter.addEventListener("change", filterWorks);

  const typeSelect = elements.workForm.querySelector('[name="type"]');
  typeSelect.addEventListener("change", toggleVideoIdField);

  // Close modal on outside click - auto save
  let mouseDownTarget = null;
  elements.modal.addEventListener("mousedown", (e) => {
    mouseDownTarget = e.target;
  });
  elements.modal.addEventListener("click", (e) => {
    if (e.target === elements.modal && mouseDownTarget === elements.modal) {
      saveAndCloseModal();
    }
    mouseDownTarget = null;
  });

  elements.modal
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);

  initializeDragAndDrop();
}

// Load last build time from localStorage
function loadLastBuildTime() {
  const lastBuild = localStorage.getItem("lastBuildTime");
  if (lastBuild) {
    elements.lastBuildEl.textContent = new Date(lastBuild).toLocaleString();
  }
}

// Save last build time to localStorage
function saveLastBuildTime() {
  const now = new Date().toISOString();
  localStorage.setItem("lastBuildTime", now);
  elements.lastBuildEl.textContent = new Date(now).toLocaleString();
}

// Image Management
function buildAllImages() {
  allImages = [];
  currentImages.forEach((imgData) => {
    allImages.push({ type: "existing", src: imgData.src, caption: imgData.caption || "" });
  });
  pendingFiles.forEach((pendingData) => {
    allImages.push({
      type: "pending",
      src: URL.createObjectURL(pendingData.file),
      file: pendingData.file,
      caption: pendingData.caption || ""
    });
  });
}

function renderImagesGrid() {
  buildAllImages();

  let html = "";

  allImages.forEach((img, index) => {
    const hasCaptionClass = img.caption ? "has-caption" : "";
    html += `
      <div class="image-preview-item" draggable="true" data-index="${index}">
        <img src="${img.src}" alt="Image ${index + 1}">
        <button class="caption-btn ${hasCaptionClass}" data-index="${index}" type="button" title="Edit caption">✎</button>
        <button class="remove-image" data-index="${index}" type="button">×</button>
        <div class="image-order">${index + 1}</div>
      </div>
    `;
  });

  html += `
    <label class="add-image-btn">
      +
      <input type="file" accept="image/*" multiple id="imageFileInput">
    </label>
  `;

  elements.imagesGrid.innerHTML = html;

  const fileInput = document.getElementById("imageFileInput");
  fileInput.addEventListener("change", handleFileSelect);
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  // Wrap each file in an object with caption
  const newPendingFiles = files.map(file => ({ file, caption: "" }));
  pendingFiles = [...pendingFiles, ...newPendingFiles];
  renderImagesGrid();
}

// Caption editing
function openCaptionEditor(index) {
  editingCaptionIndex = index;
  const img = allImages[index];
  const captionText = document.getElementById("captionText");
  const captionModal = document.getElementById("captionModal");

  captionText.value = img.caption || "";
  captionModal.classList.add("active");
  captionText.focus();
}

function closeCaptionEditor() {
  editingCaptionIndex = null;
  document.getElementById("captionModal").classList.remove("active");
  document.getElementById("captionText").value = "";
}

function saveCaptionEditor() {
  if (editingCaptionIndex === null) return;

  const caption = document.getElementById("captionText").value.trim();
  const img = allImages[editingCaptionIndex];

  if (img.type === "existing") {
    // Find and update in currentImages
    const existingIndex = currentImages.findIndex(ci => ci.src === img.src);
    if (existingIndex > -1) {
      currentImages[existingIndex].caption = caption;
    }
  } else {
    // Find and update in pendingFiles
    const pendingIndex = pendingFiles.findIndex(pf => pf.file === img.file);
    if (pendingIndex > -1) {
      pendingFiles[pendingIndex].caption = caption;
    }
  }

  closeCaptionEditor();
  renderImagesGrid();
}

function removeImage(index) {
  const img = allImages[index];
  if (img.type === "existing") {
    const existingIndex = currentImages.findIndex(ci => ci.src === img.src);
    if (existingIndex > -1) currentImages.splice(existingIndex, 1);
  } else {
    const pendingIndex = pendingFiles.findIndex(pf => pf.file === img.file);
    if (pendingIndex > -1) pendingFiles.splice(pendingIndex, 1);
  }
  renderImagesGrid();
}

function reorderImages(fromIndex, toIndex) {
  const [moved] = allImages.splice(fromIndex, 1);
  allImages.splice(toIndex, 0, moved);

  currentImages = [];
  pendingFiles = [];
  allImages.forEach((img) => {
    if (img.type === "existing") {
      currentImages.push({ src: img.src, caption: img.caption || "" });
    } else {
      pendingFiles.push({ file: img.file, caption: img.caption || "" });
    }
  });

  renderImagesGrid();
}

// Drag and Drop
function initializeDragAndDrop() {
  elements.imagesGrid.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".image-preview-item");
    if (item) {
      draggedElement = item;
      draggedIndex = parseInt(item.dataset.index);
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedIndex);
    }
  });

  elements.imagesGrid.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  elements.imagesGrid.addEventListener("dragenter", (e) => {
    e.preventDefault();
    const item = e.target.closest(".image-preview-item");
    if (item && item !== draggedElement) {
      item.style.opacity = "0.5";
    }
  });

  elements.imagesGrid.addEventListener("dragleave", (e) => {
    const item = e.target.closest(".image-preview-item");
    if (item) {
      item.style.opacity = "";
    }
  });

  elements.imagesGrid.addEventListener("drop", (e) => {
    e.preventDefault();
    const item = e.target.closest(".image-preview-item");
    if (item && draggedIndex !== null) {
      const dropIndex = parseInt(item.dataset.index);
      if (draggedIndex !== dropIndex) {
        reorderImages(draggedIndex, dropIndex);
      }
    }
  });

  elements.imagesGrid.addEventListener("dragend", (e) => {
    const items = elements.imagesGrid.querySelectorAll(".image-preview-item");
    items.forEach((item) => {
      item.classList.remove("dragging");
      item.style.opacity = "";
    });
    draggedElement = null;
    draggedIndex = null;
  });

  elements.imagesGrid.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-image")) {
      const index = parseInt(e.target.dataset.index);
      removeImage(index);
    }
    if (e.target.classList.contains("caption-btn")) {
      const index = parseInt(e.target.dataset.index);
      openCaptionEditor(index);
    }
  });
}

// Initialize caption modal event listeners
function initializeCaptionModal() {
  document.getElementById("captionCancel").addEventListener("click", closeCaptionEditor);
  document.getElementById("captionSave").addEventListener("click", saveCaptionEditor);

  // Close on background click
  document.getElementById("captionModal").addEventListener("click", (e) => {
    if (e.target.id === "captionModal") {
      closeCaptionEditor();
    }
  });

  // Save on Enter (with Ctrl/Cmd), close on Escape
  document.getElementById("captionText").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCaptionEditor();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      saveCaptionEditor();
    }
  });
}

// Load Works from API
async function loadWorks() {
  try {
    showStatus("Loading works...", "info");
    works = await apiRequest("/works");
    populateFilters();
    renderWorks(works);
    updateStats();
    showStatus("", "success");
  } catch (error) {
    showStatus(`Error loading works: ${error.message}`, "error");
  }
}

// Render Works Table
function renderWorks(worksToRender) {
  const { escapeHtml } = getUtils();

  if (!worksToRender || worksToRender.length === 0) {
    elements.worksBody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No works found</td></tr>';
    return;
  }

  // Reverse order so newest works appear first
  const reversedWorks = [...worksToRender].reverse();

  elements.worksBody.innerHTML = reversedWorks
    .map((work) => {
      let previewSrc = null;
      if (work.images && work.images.length > 0) {
        // When served from unified server, use absolute path
        previewSrc = `/${work.images[0]}`;
      } else if (work.type === "video" && work.thumbnail) {
        previewSrc = work.thumbnail;
      }

      const previewImg = renderImagePreview(previewSrc, work.title);
      const featuredClass = work.featured ? "active" : "";

      return `
        <tr data-work-id="${work.id}">
          <td>${previewImg}</td>
          <td class="editable" data-field="title">${escapeHtml(work.title)}</td>
          <td class="editable" data-field="date">${escapeHtml(work.date)}</td>
          <td class="editable" data-field="client">${escapeHtml(work.client || "-")}</td>
          <td class="editable" data-field="industry">${escapeHtml(work.industry || "-")}</td>
          <td class="editable" data-field="contribution">${escapeHtml(work.contribution || "-")}</td>
          <td><span class="featured-checkbox ${featuredClass}" data-work-id="${work.id}" onclick="toggleFeatured('${work.id}')">⭐</span></td>
          <td>
            <button class="btn btn-small btn-edit" onclick="openEditModal('${work.id}')">Edit</button>
            <button class="btn btn-small btn-duplicate" onclick="handleDuplicate('${work.id}')">Duplicate</button>
            <button class="btn btn-small btn-delete" onclick="handleDelete('${work.id}')">Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Populate Filter Dropdowns
function populateFilters() {
  const { escapeHtml } = getUtils();
  const years = [...new Set(works.map((w) => w.date).filter(Boolean))]
    .sort()
    .reverse();
  const industries = [
    ...new Set(works.map((w) => w.industry).filter(Boolean)),
  ].sort();

  elements.yearFilter.innerHTML =
    '<option value="">All Years</option>' +
    years.map((year) => `<option value="${year}">${year}</option>`).join("");

  elements.industryFilter.innerHTML =
    '<option value="">All Industries</option>' +
    industries
      .map(
        (industry) =>
          `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`,
      )
      .join("");
}

// Filter Works
function filterWorks() {
  renderWorks(getFilteredWorks());
}

// Update Stats
function updateStats() {
  elements.totalWorksEl.textContent = works.length;
  elements.featuredWorksEl.textContent = works.filter((w) => w.featured).length;
}

// Toggle Featured Status
async function toggleFeatured(workId) {
  const work = works.find((w) => w.id === workId);
  if (!work) return;

  const newFeatured = !work.featured;

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    const formData = new FormData();
    formData.set("title", work.title);
    formData.set("date", work.date);
    formData.set("featured", newFeatured ? "true" : "false");

    const response = await fetch(`${API_BASE_URL}/works/${workId}`, {
      method: "PUT",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to update featured status");
    }

    work.featured = newFeatured;
    renderWorks(getFilteredWorks());
    updateStats();
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  }
}

function getFilteredWorks() {
  const searchText = elements.searchInput.value.toLowerCase();
  const yearValue = elements.yearFilter.value;
  const industryValue = elements.industryFilter.value;
  const typeValue = elements.typeFilter.value;

  return works.filter((work) => {
    const matchesSearch =
      !searchText ||
      work.title.toLowerCase().includes(searchText) ||
      (work.client && work.client.toLowerCase().includes(searchText)) ||
      (work.contribution &&
        work.contribution.toLowerCase().includes(searchText)) ||
      (work.info && work.info.toLowerCase().includes(searchText));

    const matchesYear = !yearValue || work.date === yearValue;
    const matchesIndustry = !industryValue || work.industry === industryValue;
    const matchesType = !typeValue || work.type === typeValue;

    return matchesSearch && matchesYear && matchesIndustry && matchesType;
  });
}

// Modal Functions
function openAddModal() {
  currentImages = [];
  pendingFiles = [];
  isEditMode = false;
  currentWork = null;
  elements.modalTitle.textContent = "Add New Work";
  elements.workForm.reset();
  renderImagesGrid();
  toggleVideoIdField();
  elements.modal.style.display = "flex";
}

function openEditModal(workId) {
  isEditMode = true;
  currentWork = works.find((w) => w.id === workId);

  if (!currentWork) {
    showStatus("Work not found", "error");
    return;
  }

  elements.modalTitle.textContent = "Edit Work";
  populateForm(currentWork);
  toggleVideoIdField();
  elements.modal.style.display = "flex";
}

function closeModal() {
  elements.modal.style.display = "none";
  elements.workForm.reset();
  elements.imagesGrid.innerHTML = "";
  currentWork = null;
  isEditMode = false;
  currentImages = [];
  pendingFiles = [];
  allImages = [];
}

async function saveAndCloseModal() {
  const title = elements.workForm.querySelector('[name="title"]').value;
  const date = elements.workForm.querySelector('[name="date"]').value;

  if (title && date) {
    await handleFormSubmit(new Event("submit"));
  } else {
    closeModal();
  }
}

// Populate Form with Work Data
function populateForm(work) {
  elements.workForm.querySelector('[name="workId"]').value = work.id;
  elements.workForm.querySelector('[name="title"]').value = work.title || "";
  elements.workForm.querySelector('[name="date"]').value = work.date || "";
  elements.workForm.querySelector('[name="client"]').value = work.client || "";
  elements.workForm.querySelector('[name="industry"]').value =
    work.industry || "";
  elements.workForm.querySelector('[name="contribution"]').value =
    work.contribution || "";
  elements.workForm.querySelector('[name="style"]').value = work.style || "";
  elements.workForm.querySelector('[name="software"]').value =
    work.software || "";
  elements.workForm.querySelector('[name="info"]').value = work.info || "";
  elements.workForm.querySelector('[name="type"]').value = work.type || "image";
  elements.workForm.querySelector('[name="videoId"]').value =
    work.videoId || "";

  // Use absolute paths from unified server
  // Handle both string and object formats for images
  if (work.images && work.images.length > 0) {
    currentImages = work.images.map((img) => {
      if (typeof img === 'string') {
        return { src: `/${img}`, caption: "" };
      }
      return { src: `/${img.src}`, caption: img.caption || "" };
    });
  } else {
    currentImages = [];
  }
  pendingFiles = [];
  renderImagesGrid();
}

// Toggle Video ID Field
function toggleVideoIdField() {
  const typeSelect = elements.workForm.querySelector('[name="type"]');
  elements.videoIdGroup.style.display =
    typeSelect.value === "video" ? "block" : "none";
}

// Handle Form Submit
async function handleFormSubmit(event) {
  event.preventDefault();

  if (elements.workForm.dataset.submitting === "true") return;
  elements.workForm.dataset.submitting = "true";

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    const formData = new FormData(elements.workForm);
    formData.delete("images");

    // Send existing images with captions as JSON
    const existingImagesData = currentImages.map(img => ({
      src: img.src.replace(/^\//, ''), // Remove leading slash
      caption: img.caption || ""
    }));
    formData.append("existingImages", JSON.stringify(existingImagesData));

    // Send pending files
    pendingFiles.forEach((pendingData) => {
      formData.append("images", pendingData.file);
    });

    // Send captions for pending files as JSON array
    const pendingCaptions = pendingFiles.map(pf => pf.caption || "");
    formData.append("pendingCaptions", JSON.stringify(pendingCaptions));

    let url = "/works";
    let method = "POST";

    if (isEditMode && currentWork) {
      url = `/works/${currentWork.id}`;
      method = "PUT";
      showStatus("Updating work...", "info");
    } else {
      showStatus("Creating work...", "info");
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: method,
      headers: {
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save work");
    }

    showStatus(
      isEditMode ? "Work updated successfully!" : "Work created successfully!",
      "success",
    );
    closeModal();
    await loadWorks();
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  } finally {
    elements.workForm.dataset.submitting = "false";
  }
}

// Handle Delete
async function handleDelete(workId) {
  const work = works.find((w) => w.id === workId);
  if (!work) return;

  if (!confirm(`Delete "${work.title}"? This cannot be undone.`)) {
    return;
  }

  try {
    showStatus("Deleting work...", "info");
    await apiRequest(`/works/${workId}`, { method: "DELETE" });
    showStatus("Work deleted successfully!", "success");
    await loadWorks();
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  }
}

// Handle Build
async function handleBuild() {
  try {
    elements.buildBtn.disabled = true;
    elements.buildBtn.textContent = "Building...";
    showStatus("Build started...", "info");

    const result = await apiRequest("/build", { method: "POST" });

    showStatus(result.message || "Build completed successfully!", "success");
    saveLastBuildTime();
  } catch (error) {
    showStatus(`Build error: ${error.message}`, "error");
  } finally {
    elements.buildBtn.disabled = false;
    elements.buildBtn.textContent = "⚙ Build & Deploy";
  }
}

// Handle Duplicate
async function handleDuplicate(workId) {
  const work = works.find((w) => w.id === workId);
  if (!work) return;

  try {
    // Ensure we have a CSRF token
    if (!csrfToken) {
      await fetchCsrfToken();
    }

    showStatus("Duplicating work...", "info");

    const formData = new FormData();
    formData.set("title", `${work.title} (Copy)`);
    formData.set("date", work.date || "");
    formData.set("client", work.client || "");
    formData.set("industry", work.industry || "");
    formData.set("contribution", work.contribution || "");
    formData.set("style", work.style || "");
    formData.set("software", work.software || "");
    formData.set("info", work.info || "");
    formData.set("type", work.type || "image");
    formData.set("videoId", work.videoId || "");
    formData.set("featured", "false");

    const response = await fetch(`${API_BASE_URL}/works`, {
      method: "POST",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to duplicate work");
    }

    showStatus("Work duplicated successfully!", "success");
    await loadWorks();
  } catch (error) {
    showStatus(`Error: ${error.message}`, "error");
  }
}

// Export to global scope for inline onclick handlers
window.openEditModal = openEditModal;
window.handleDelete = handleDelete;
window.handleDuplicate = handleDuplicate;
window.toggleFeatured = toggleFeatured;
