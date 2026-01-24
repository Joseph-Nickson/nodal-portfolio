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

// Content system - unified array of content items
// Types: { type: "image", src: "path", caption: "" }
//        { type: "text", text: "content" }
//        { type: "video", videoId: "youtube-id" }
let contentItems = [];
let pendingImageFiles = []; // Files waiting to be uploaded
let editingContentIndex = null;
let editingContentMode = null; // 'text', 'caption', or 'new-text'

// DOM Elements
const elements = {
  worksBody: document.getElementById("worksBody"),
  searchInput: document.getElementById("searchInput"),
  yearFilter: document.getElementById("yearFilter"),
  industryFilter: document.getElementById("industryFilter"),
  addWorkBtn: document.getElementById("addWorkBtn"),
  buildBtn: document.getElementById("buildBtn"),
  cancelBtn: document.getElementById("cancelBtn"),
  totalWorksEl: document.getElementById("totalWorks"),
  featuredWorksEl: document.getElementById("featuredWorks"),
  lastBuildEl: document.getElementById("lastBuild"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  workForm: document.getElementById("workForm"),
  contentGrid: document.getElementById("contentGrid"),
  buildStatus: document.getElementById("buildStatus"),
};

// Drag and drop state
let draggedElement = null;
let draggedIndex = null;

// Shared modules (loaded via shared/utils.js and shared/config.js)
const getUtils = () => window.PortfolioUtils;
const getConfig = () => window.PortfolioConfig;

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

    if (response.status === 403) {
      await fetchCsrfToken();
      options.headers["X-CSRF-Token"] = csrfToken;
      const retryResponse = await fetch(`${API_BASE_URL}${url}`, options);
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed: ${retryResponse.status}`);
      }
      return await retryResponse.json();
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
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
function renderImagePreview(imageSrc, alt = "", size = { width: 60, height: 40 }) {
  const { escapeHtml } = getUtils();
  if (!imageSrc) {
    return `<div style="width: ${size.width}px; height: ${size.height}px; background: #3a3a40; border-radius: 4px;"></div>`;
  }
  return `<img src="${imageSrc}" alt="${escapeHtml(alt)}" style="width: ${size.width}px; height: ${size.height}px; object-fit: cover; border-radius: 4px;">`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  await fetchCsrfToken();
  initializeEventListeners();
  initializeContentEditModal();
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

  elements.modal.querySelector(".modal-close").addEventListener("click", closeModal);

  // Content buttons
  document.getElementById("imageFileInput").addEventListener("change", handleImageFileSelect);
  document.getElementById("addTextBtn").addEventListener("click", () => openContentEditor(null, 'new-text'));

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

// Content Management
function renderContentGrid() {
  let html = "";

  contentItems.forEach((item, index) => {
    if (item.type === "image") {
      const hasCaptionClass = item.caption ? "has-caption" : "";
      html += `
        <div class="content-item content-image" draggable="true" data-index="${index}">
          <img src="${item.src}" alt="Image ${index + 1}">
          <button class="caption-btn ${hasCaptionClass}" data-index="${index}" type="button" title="Edit caption">✎</button>
          <button class="remove-content" data-index="${index}" type="button">×</button>
          <div class="content-order">${index + 1}</div>
        </div>
      `;
    } else if (item.type === "text") {
      const preview = item.text.length > 50 ? item.text.substring(0, 50) + "..." : item.text;
      html += `
        <div class="content-item content-text" draggable="true" data-index="${index}">
          <div class="text-preview">${getUtils().escapeHtml(preview)}</div>
          <button class="edit-btn" data-index="${index}" type="button" title="Edit text">✎</button>
          <button class="remove-content" data-index="${index}" type="button">×</button>
          <div class="content-order">${index + 1}</div>
        </div>
      `;
    } else if (item.type === "video") {
      html += `
        <div class="content-item content-video" draggable="true" data-index="${index}">
          <img src="https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg" alt="Video thumbnail">
          <div class="video-badge">▶ YouTube</div>
          <button class="edit-btn" data-index="${index}" type="button" title="Edit video">✎</button>
          <button class="remove-content" data-index="${index}" type="button">×</button>
          <div class="content-order">${index + 1}</div>
        </div>
      `;
    }
  });

  elements.contentGrid.innerHTML = html;
}

function normalizePreviewSrc(src) {
  if (!src) return null;
  if (/^https?:\/\//.test(src) || src.startsWith("/")) return src;
  return `/${src}`;
}

function handleImageFileSelect(event) {
  const files = Array.from(event.target.files);

  files.forEach(file => {
    const src = URL.createObjectURL(file);
    contentItems.push({
      type: "image",
      src: src,
      caption: "",
      _pendingFile: file // Mark as pending upload
    });
  });

  renderContentGrid();
  event.target.value = ""; // Reset input
}

function removeContent(index) {
  contentItems.splice(index, 1);
  renderContentGrid();
}

function reorderContent(fromIndex, toIndex) {
  const [moved] = contentItems.splice(fromIndex, 1);
  contentItems.splice(toIndex, 0, moved);
  renderContentGrid();
}

// Content Edit Modal
function openContentEditor(index, mode) {
  editingContentIndex = index;
  editingContentMode = mode;

  const modal = document.getElementById("contentEditModal");
  const title = document.getElementById("contentEditTitle");
  const textarea = document.getElementById("contentEditText");
  const hint = document.getElementById("contentEditHint");

  if (mode === 'caption') {
    title.textContent = "Image Caption";
    hint.style.display = "none";
    textarea.placeholder = "Add a caption for this image...";
    textarea.value = contentItems[index].caption || "";
  } else if (mode === 'text' || mode === 'new-text') {
    title.textContent = "Text Content";
    hint.style.display = "block";
    textarea.placeholder = "Enter text or paste a YouTube URL...";
    textarea.value = mode === 'new-text' ? "" : (contentItems[index].text || "");
  } else if (mode === 'video') {
    title.textContent = "YouTube Video";
    hint.style.display = "block";
    textarea.placeholder = "Enter YouTube URL or video ID...";
    textarea.value = contentItems[index].videoId || "";
  }

  modal.classList.add("active");
  textarea.focus();
}

function closeContentEditor() {
  editingContentIndex = null;
  editingContentMode = null;
  document.getElementById("contentEditModal").classList.remove("active");
  document.getElementById("contentEditText").value = "";
}

function saveContentEditor() {
  const text = document.getElementById("contentEditText").value.trim();

  if (editingContentMode === 'caption') {
    contentItems[editingContentIndex].caption = text;
  } else if (editingContentMode === 'new-text') {
    if (text) {
      const videoId = getUtils().extractYouTubeId(text);
      if (videoId) {
        contentItems.push({ type: "video", videoId: videoId });
      } else {
        contentItems.push({ type: "text", text: text });
      }
    }
  } else if (editingContentMode === 'text') {
    const videoId = getUtils().extractYouTubeId(text);
    if (videoId) {
      // Convert text to video
      contentItems[editingContentIndex] = { type: "video", videoId: videoId };
    } else {
      contentItems[editingContentIndex].text = text;
    }
  } else if (editingContentMode === 'video') {
    const videoId = getUtils().extractYouTubeId(text);
    if (videoId) {
      contentItems[editingContentIndex].videoId = videoId;
    } else if (text) {
      // Convert to text if not a valid YouTube URL
      contentItems[editingContentIndex] = { type: "text", text: text };
    }
  }

  closeContentEditor();
  renderContentGrid();
}

function initializeContentEditModal() {
  document.getElementById("contentEditCancel").addEventListener("click", closeContentEditor);
  document.getElementById("contentEditSave").addEventListener("click", saveContentEditor);

  document.getElementById("contentEditModal").addEventListener("click", (e) => {
    if (e.target.id === "contentEditModal") {
      closeContentEditor();
    }
  });

  document.getElementById("contentEditText").addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeContentEditor();
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      saveContentEditor();
    }
  });
}

// Drag and Drop
function initializeDragAndDrop() {
  elements.contentGrid.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".content-item");
    if (item) {
      draggedElement = item;
      draggedIndex = parseInt(item.dataset.index);
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedIndex);
    }
  });

  elements.contentGrid.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });

  elements.contentGrid.addEventListener("dragenter", (e) => {
    e.preventDefault();
    const item = e.target.closest(".content-item");
    if (item && item !== draggedElement) {
      item.style.opacity = "0.5";
    }
  });

  elements.contentGrid.addEventListener("dragleave", (e) => {
    const item = e.target.closest(".content-item");
    if (item) {
      item.style.opacity = "";
    }
  });

  elements.contentGrid.addEventListener("drop", (e) => {
    e.preventDefault();
    const item = e.target.closest(".content-item");
    if (item && draggedIndex !== null) {
      const dropIndex = parseInt(item.dataset.index);
      if (draggedIndex !== dropIndex) {
        reorderContent(draggedIndex, dropIndex);
      }
    }
  });

  elements.contentGrid.addEventListener("dragend", (e) => {
    const items = elements.contentGrid.querySelectorAll(".content-item");
    items.forEach((item) => {
      item.classList.remove("dragging");
      item.style.opacity = "";
    });
    draggedElement = null;
    draggedIndex = null;
  });

  elements.contentGrid.addEventListener("click", (e) => {
    const index = parseInt(e.target.dataset.index);

    if (e.target.classList.contains("remove-content")) {
      removeContent(index);
    } else if (e.target.classList.contains("caption-btn")) {
      openContentEditor(index, 'caption');
    } else if (e.target.classList.contains("edit-btn")) {
      const item = contentItems[index];
      openContentEditor(index, item.type);
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
    elements.worksBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No works found</td></tr>';
    return;
  }

  const reversedWorks = [...worksToRender].reverse();

  elements.worksBody.innerHTML = reversedWorks.map((work) => {
    const primaryMedia = getUtils().getPrimaryMedia(work);
    let previewSrc = null;
    if (primaryMedia.type === "image") {
      previewSrc = normalizePreviewSrc(primaryMedia.src);
    } else if (primaryMedia.type === "video") {
      previewSrc = primaryMedia.thumbnail;
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
  }).join("");
}

// Populate Filter Dropdowns
function populateFilters() {
  const { escapeHtml } = getUtils();
  const years = [...new Set(works.map((w) => w.date).filter(Boolean))].sort().reverse();
  const industries = [...new Set(works.map((w) => w.industry).filter(Boolean))].sort();

  elements.yearFilter.innerHTML =
    '<option value="">All Years</option>' +
    years.map((year) => `<option value="${year}">${year}</option>`).join("");

  elements.industryFilter.innerHTML =
    '<option value="">All Industries</option>' +
    industries.map((industry) => `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`).join("");
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
    if (!csrfToken) await fetchCsrfToken();

    const formData = new FormData();
    formData.set("title", work.title);
    formData.set("date", work.date);
    formData.set("featured", newFeatured ? "true" : "false");

    const response = await fetch(`${API_BASE_URL}/works/${workId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: formData,
    });

    if (!response.ok) throw new Error("Failed to update featured status");

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

  return works.filter((work) => {
    const matchesSearch =
      !searchText ||
      work.title.toLowerCase().includes(searchText) ||
      (work.client && work.client.toLowerCase().includes(searchText)) ||
      (work.contribution && work.contribution.toLowerCase().includes(searchText)) ||
      (work.info && work.info.toLowerCase().includes(searchText));

    const matchesYear = !yearValue || work.date === yearValue;
    const matchesIndustry = !industryValue || work.industry === industryValue;

    return matchesSearch && matchesYear && matchesIndustry;
  });
}

// Modal Functions
function openAddModal() {
  contentItems = [];
  isEditMode = false;
  currentWork = null;
  elements.modalTitle.textContent = "Add New Work";
  elements.workForm.reset();
  renderContentGrid();
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
  elements.modal.style.display = "flex";
}

function closeModal() {
  elements.modal.style.display = "none";
  elements.workForm.reset();
  elements.contentGrid.innerHTML = "";
  currentWork = null;
  isEditMode = false;
  contentItems = [];
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
  elements.workForm.querySelector('[name="industry"]').value = work.industry || "";
  elements.workForm.querySelector('[name="contribution"]').value = work.contribution || "";
  elements.workForm.querySelector('[name="style"]').value = work.style || "";
  elements.workForm.querySelector('[name="software"]').value = work.software || "";

  // Build content items from work data
  contentItems = [];

  // New content format
  if (work.content && work.content.length > 0) {
    work.content.forEach(item => {
      if (item.type === "image") {
        contentItems.push({
          type: "image",
          src: `/${item.src}`,
          caption: item.caption || "",
          _existingSrc: item.src // Track original path for saving
        });
      } else if (item.type === "text") {
        contentItems.push({ type: "text", text: item.text });
      } else if (item.type === "video") {
        contentItems.push({ type: "video", videoId: item.videoId });
      }
    });
  }
  // Legacy format migration
  else {
    // Add video first if it's a video type
    if (work.type === "video" && work.videoId) {
      contentItems.push({ type: "video", videoId: work.videoId });
    }

    // Add images
    if (work.images && work.images.length > 0) {
      work.images.forEach(img => {
        const src = typeof img === 'string' ? img : img.src;
        const caption = typeof img === 'object' ? img.caption : "";
        contentItems.push({
          type: "image",
          src: `/${src}`,
          caption: caption || "",
          _existingSrc: src
        });
      });
    }

    // Add info as text block
    if (work.info && work.info.trim()) {
      contentItems.push({ type: "text", text: work.info });
    }
  }

  renderContentGrid();
}

// Handle Form Submit
async function handleFormSubmit(event) {
  event.preventDefault();

  if (elements.workForm.dataset.submitting === "true") return;
  elements.workForm.dataset.submitting = "true";

  try {
    if (!csrfToken) await fetchCsrfToken();

    const formData = new FormData(elements.workForm);

    // Build content array for submission
    const contentData = [];
    const pendingImages = [];

    contentItems.forEach((item, index) => {
      if (item.type === "image") {
        if (item._pendingFile) {
          // New upload - will be processed server-side
          pendingImages.push({
            index: contentData.length,
            file: item._pendingFile,
            caption: item.caption || ""
          });
          contentData.push({ type: "image", _pending: true, caption: item.caption || "" });
        } else {
          // Existing image
          contentData.push({
            type: "image",
            src: item._existingSrc || item.src.replace(/^\//, ''),
            caption: item.caption || ""
          });
        }
      } else if (item.type === "text") {
        contentData.push({ type: "text", text: item.text });
      } else if (item.type === "video") {
        contentData.push({ type: "video", videoId: item.videoId });
      }
    });

    formData.append("content", JSON.stringify(contentData));

    // Add pending image files
    pendingImages.forEach(img => {
      formData.append("images", img.file);
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
      headers: { "X-CSRF-Token": csrfToken },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save work");
    }

    showStatus(isEditMode ? "Work updated successfully!" : "Work created successfully!", "success");
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

  if (!confirm(`Delete "${work.title}"? This cannot be undone.`)) return;

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
    if (!csrfToken) await fetchCsrfToken();

    showStatus("Duplicating work...", "info");

    const formData = new FormData();
    formData.set("title", `${work.title} (Copy)`);
    formData.set("date", work.date || "");
    formData.set("client", work.client || "");
    formData.set("industry", work.industry || "");
    formData.set("contribution", work.contribution || "");
    formData.set("style", work.style || "");
    formData.set("software", work.software || "");
    formData.set("featured", "false");
    formData.set("content", JSON.stringify([]));

    const response = await fetch(`${API_BASE_URL}/works`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
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
