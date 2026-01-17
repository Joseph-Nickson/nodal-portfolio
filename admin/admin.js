// Admin Interface for Works Management
const API_BASE_URL = "http://localhost:3001/api";

// State Management
let works = [];
let currentWork = null;
let isEditMode = false;
let currentImages = [];

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

// Track pending new files
let pendingFiles = [];

// Utility Functions
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// API wrapper with error handling
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, options);

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
  if (!imageSrc) {
    return `<div style="width: ${size.width}px; height: ${size.height}px; background: #3a3a40; border-radius: 4px;"></div>`;
  }

  return `<img src="${imageSrc}" alt="${escapeHtml(alt)}"
                 style="width: ${size.width}px; height: ${size.height}px; object-fit: cover; border-radius: 4px;">`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
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

  // Type selector to show/hide video ID field
  const typeSelect = elements.workForm.querySelector('[name="type"]');
  typeSelect.addEventListener("change", toggleVideoIdField);

  // Close modal on outside click - auto save (only if mousedown started on modal backdrop)
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

  // X button just closes without saving
  elements.modal
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);

  // Initialize drag and drop for image reordering
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
// Unified image list for ordering (combines existing + pending)
let allImages = []; // { type: 'existing'|'pending', src: string, file?: File }

function buildAllImages() {
  allImages = [];
  currentImages.forEach((src) => {
    allImages.push({ type: "existing", src });
  });
  pendingFiles.forEach((file) => {
    allImages.push({ type: "pending", src: URL.createObjectURL(file), file });
  });
}

function renderImagesGrid() {
  buildAllImages();

  let html = "";

  // Render all images in order
  allImages.forEach((img, index) => {
    html += `
      <div class="image-preview-item" draggable="true" data-index="${index}">
        <img src="${img.src}" alt="Image ${index + 1}">
        <button class="remove-image" data-index="${index}" type="button">×</button>
        <div class="image-order">${index + 1}</div>
      </div>
    `;
  });

  // Add the + button
  html += `
    <label class="add-image-btn">
      +
      <input type="file" accept="image/*" multiple id="imageFileInput">
    </label>
  `;

  elements.imagesGrid.innerHTML = html;

  // Add event listener for file input
  const fileInput = document.getElementById("imageFileInput");
  fileInput.addEventListener("change", handleFileSelect);
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  pendingFiles = [...pendingFiles, ...files];
  renderImagesGrid();
}

function removeImage(index) {
  const img = allImages[index];
  if (img.type === "existing") {
    const existingIndex = currentImages.indexOf(img.src);
    if (existingIndex > -1) currentImages.splice(existingIndex, 1);
  } else {
    const pendingIndex = pendingFiles.indexOf(img.file);
    if (pendingIndex > -1) pendingFiles.splice(pendingIndex, 1);
  }
  renderImagesGrid();
}

function reorderImages(fromIndex, toIndex) {
  // Move in allImages
  const [moved] = allImages.splice(fromIndex, 1);
  allImages.splice(toIndex, 0, moved);

  // Rebuild currentImages and pendingFiles from allImages order
  currentImages = [];
  pendingFiles = [];
  allImages.forEach((img) => {
    if (img.type === "existing") {
      currentImages.push(img.src);
    } else {
      pendingFiles.push(img.file);
    }
  });

  renderImagesGrid();
}

// Drag and Drop for image reordering
let draggedElement = null;
let draggedIndex = null;

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

  // Handle remove button clicks
  elements.imagesGrid.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-image")) {
      const index = parseInt(e.target.dataset.index);
      removeImage(index);
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
  if (!worksToRender || worksToRender.length === 0) {
    elements.worksBody.innerHTML =
      '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No works found</td></tr>';
    return;
  }

  elements.worksBody.innerHTML = worksToRender
    .map((work) => {
      // Fix thumbnail display - get correct path
      let previewSrc = null;
      if (work.images && work.images.length > 0) {
        // Images array contains paths like "works/2024/slug/image.jpg"
        // Use relative path from admin directory
        previewSrc = `../${work.images[0]}`;
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
    const formData = new FormData();
    formData.set("title", work.title);
    formData.set("date", work.date);
    formData.set("featured", newFeatured ? "true" : "false");

    const response = await fetch(`${API_BASE_URL}/works/${workId}`, {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to update featured status");
    }

    // Update local state
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

// Save and close modal (triggered by clicking outside)
async function saveAndCloseModal() {
  // Check if form has required fields filled
  const title = elements.workForm.querySelector('[name="title"]').value;
  const date = elements.workForm.querySelector('[name="date"]').value;

  if (title && date) {
    // Submit the form programmatically
    await handleFormSubmit(new Event("submit"));
  } else {
    // If required fields missing, just close
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

  // Show existing images with correct paths
  if (work.images && work.images.length > 0) {
    currentImages = work.images.map((img) => `../${img}`);
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

  // Prevent double-submit
  if (elements.workForm.dataset.submitting === "true") return;
  elements.workForm.dataset.submitting = "true";

  try {
    const formData = new FormData(elements.workForm);

    // Remove the file input field (we handle files separately)
    formData.delete("images");

    // Add pending files
    pendingFiles.forEach((file) => {
      formData.append("images", file);
    });

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
