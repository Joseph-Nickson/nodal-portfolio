// Shared modules (loaded via shared/utils.js and shared/config.js)
const utils = () => window.PortfolioUtils;
const config = () => window.PortfolioConfig;

// Category definitions for landing page
const CATEGORIES = [
  { id: "Film;TV", title: "Film / TV" },
  { id: "Games", title: "Games" },
  { id: "Personal", title: "Illustration" },
  { id: "Music", title: "Music" }
];

// Organized state
const state = {
  works: { all: [], filtered: [] },
  filters: {},
  modal: { list: [], index: 0 },
  landing: { index: 0 },
  category: { current: null, works: [], index: 0 },
  carousel: { translate: 0, positions: [], center: 0 },
  ui: { isExpanded: false, isTransitioning: false }
};

// Helper: Get image src and caption (supports both string and object formats)
function getImageData(img) {
  return utils().normalizeImageEntry(img);
}

function hasImageContent(work) {
  if (work.content && work.content.length > 0) {
    return work.content.some(c => c.type === "image");
  }
  return work.images && work.images.length > 0;
}

function getPrimaryImageSrc(work) {
  const primary = utils().getPrimaryMedia(work);
  return primary.type === "image" ? primary.src : "";
}

// Helper: Build meta item HTML for work details (unified for modal and carousel)
function buildMetaItem(label, key, value) {
  const values = utils().getMultiValues(value);
  if (values.length === 0) return "";
  const valueSpans = values.map((v) => {
    const escaped = v.replace(/"/g, '&quot;');
    return `<span class="meta-value" data-filter-key="${key}" data-filter-value="${escaped}">${v}</span>`;
  }).join("");
  return `<div class="meta-item"><span class="meta-label">${label}</span>${valueSpans}</div>`;
}

// Helper: Attach filter click handlers to meta values within a container
function attachFilterHandlers(container) {
  container.querySelectorAll(".meta-value, .filter-value").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      addFilter(el.dataset.filterKey, el.dataset.filterValue);
    });
  });
}

// Helper: Build all meta HTML for a work
function buildMetaHTML(work, config) {
  return buildMetaItem(config.fieldLabels.client, "client", work.client) +
    buildMetaItem(config.fieldLabels.contribution, "contribution", work.contribution) +
    buildMetaItem(config.fieldLabels.date, "date", work.date) +
    buildMetaItem(config.fieldLabels.style, "style", work.style) +
    buildMetaItem(config.fieldLabels.software, "software", work.software);
}

// Helper: Collapse details panel with animation (reusable)
function collapseDetailsPanel(immediate = false) {
  const detailsPanel = document.getElementById("workDetailsPanel");
  const scrollHint = document.getElementById("scrollHintOverlay");
  if (!detailsPanel || detailsPanel.classList.contains("hidden")) return;

  detailsPanel.classList.add("collapsing");
  state.ui.isExpanded = false;

  const hidePanel = () => {
    detailsPanel.classList.add("hidden");
    detailsPanel.classList.remove("collapsing");
    if (scrollHint) scrollHint.classList.remove("hidden");
  };

  if (immediate) {
    hidePanel();
  } else {
    setTimeout(hidePanel, 300);
  }
}

// Helper: Find work by slug
function findWorkBySlug(slug) {
  return state.works.all.findIndex((work) => utils().slugify(work.title) === slug);
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

  if (params.has("work")) {
    const index = findWorkBySlug(params.get("work"));
    if (index !== -1) return { type: "work", index };
  }

  const filters = {};
  config().filterFields.forEach(({ key }) => {
    if (params.has(key)) filters[key] = params.get(key);
  });

  return { type: "section", section: window.location.hash.slice(1) || "portfolio", filters };
}

// Apply state from URL on load
function applyURLState() {
  const urlState = parseURL();

  if (urlState.type === "work") {
    // Opening from URL navigates through all works
    state.modal.list = state.works.all;
    setTimeout(() => openModal(urlState.index), 100);
  } else {
    if (Object.keys(urlState.filters).length > 0) {
      state.filters = urlState.filters;
      applyFilters();
    }
    if (urlState.section) {
      switchSection(urlState.section);
    }
  }
}

// Populate filter dropdown with unique values
function populateFilterDropdown() {
  const select = document.getElementById("filterSelect");
  if (!select) return;

  const cfg = config();
  const { getMultiValues } = utils();

  select.innerHTML = '<option value="">Filter by...</option>';

  cfg.filterFields.forEach((field) => {
    const values = cfg.multiValueFields.includes(field.key)
      ? [...new Set(state.works.all.flatMap((w) => getMultiValues(w[field.key])))].sort()
      : [...new Set(state.works.all.map((w) => w[field.key]).filter(Boolean))].sort();

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
    state.works.all = await response.json();
    state.works.filtered = [...state.works.all];
    renderTable();
    initializeCategoryLanding();
    populateFilterDropdown();
    applyURLState();
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

// Format multi-value field as clickable filter bubbles
function formatAsFilterBubbles(value, filterKey) {
  const values = utils().getMultiValues(value);
  if (values.length === 0) return "";
  return values
    .map((v) => `<span class="filter-value" data-filter-key="${filterKey}" data-filter-value="${v.replace(/"/g, '&quot;')}">${v}</span>`)
    .join(" ");
}

// Render the main table
function renderTable() {
  const table = document.getElementById("worksTable");
  if (!table) return;

  // Add table header for desktop list view
  table.innerHTML = `
    <div class="table-header">
      <span>Title</span>
      <span>Client</span>
      <span>Role</span>
      <span>Software</span>
      <span>Year</span>
    </div>
  `;

  state.works.filtered.forEach((work, filteredIndex) => {
    const row = document.createElement("div");
    row.className = "index-card";

    const primaryMedia = utils().getPrimaryMedia(work);
    let thumbnailSrc = "";
    if (primaryMedia.type === "image") {
      thumbnailSrc = primaryMedia.src;
    } else if (primaryMedia.type === "video") {
      thumbnailSrc = primaryMedia.thumbnail;
    }

    row.innerHTML = `
      <div class="index-card-image">
        ${thumbnailSrc ? `<img src="${thumbnailSrc}" alt="${work.title}">` : '<div class="no-image"></div>'}
      </div>
      <div class="index-card-content">
        <h3 class="index-card-title">${work.title}</h3>
        <div class="index-card-meta">
          <div class="index-card-row"><span class="index-card-label">Client:</span> <span class="index-card-value">${work.client ? formatAsFilterBubbles(work.client, "client") : '—'}</span></div>
          <div class="index-card-row"><span class="index-card-label">Role:</span> <span class="index-card-value">${work.contribution ? formatAsFilterBubbles(work.contribution, "contribution") : '—'}</span></div>
          <div class="index-card-row"><span class="index-card-label">Software:</span> <span class="index-card-value">${work.software ? formatAsFilterBubbles(work.software, "software") : '—'}</span></div>
          <div class="index-card-row"><span class="index-card-label">Year:</span> <span class="index-card-value">${work.date ? formatAsFilterBubbles(work.date, "date") : '—'}</span></div>
        </div>
        <div class="index-card-footer">See more</div>
      </div>
    `;

    // Click row to open modal (filter bubbles handled separately)
    row.addEventListener("click", (e) => {
      if (!e.target.classList.contains("filter-value")) {
        openModal(filteredIndex, true);
      }
    });

    // Attach filter handlers to bubbles
    attachFilterHandlers(row);

    table.appendChild(row);
  });
}

// Build category tiles with random work thumbnails
function buildCategoryTiles() {
  const track = document.getElementById("categoryTrack");

  track.innerHTML = CATEGORIES.map((cat, index) => {
    // Find a random featured work from this category that has an image
    const categoryIds = cat.id.split(";");
    const categoryWorks = state.works.all.filter(w => {
      if (!w.featured || !categoryIds.some(c => w.industry === c)) return false;
      return hasImageContent(w);
    });

    let bgStyle = "";
    if (categoryWorks.length > 0) {
      const randomWork = categoryWorks[Math.floor(Math.random() * categoryWorks.length)];
      const imgSrc = getPrimaryImageSrc(randomWork);

      if (imgSrc) {
        bgStyle = `background-image: url('${imgSrc}'); background-size: cover; background-position: center;`;
      }
    }

    return `
      <div class="category-slide ${index === 0 ? 'active' : ''}" data-index="${index}" data-category="${cat.id}" data-title="${cat.title}">
        <div class="category-slide-inner" style="${bgStyle}">
          <span class="category-title">${cat.title}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Landing carousel - simple slide navigation
function initializeLandingCarousel() {
  const track = document.getElementById("categoryTrack");
  const hintOverlay = document.getElementById("categoryHintOverlay");

  buildCategoryTiles();

  const slides = track.querySelectorAll(".category-slide");

  // Set initial position
  requestAnimationFrame(() => updateLandingPosition(false));

  // Click on slides - adjacent to navigate, active to open
  slides.forEach(slide => {
    slide.addEventListener('click', () => {
      const index = parseInt(slide.dataset.index, 10);
      if (index !== state.landing.index) {
        goToLandingSlide(index);
      } else {
        openCategory(slide.dataset.category, slide.dataset.title);
      }
    });
  });

  // Hint overlay - open current category
  hintOverlay.addEventListener('click', () => {
    const activeSlide = slides[state.landing.index];
    openCategory(activeSlide.dataset.category, activeSlide.dataset.title);
  });

  // Simple wheel - just prev/next on scroll
  const landing = document.getElementById("categoryLanding");
  let wheelCooldown = false;

  landing.addEventListener("wheel", (e) => {
    if (wheelCooldown) return;

    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 20) return;

    e.preventDefault();
    wheelCooldown = true;

    if (delta > 0) {
      goToLandingSlide(state.landing.index + 1);
    } else {
      goToLandingSlide(state.landing.index - 1);
    }

    setTimeout(() => { wheelCooldown = false; }, 300);
  }, { passive: false });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (landing.classList.contains("hidden")) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goToLandingSlide(state.landing.index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goToLandingSlide(state.landing.index + 1);
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      const activeSlide = slides[state.landing.index];
      openCategory(activeSlide.dataset.category, activeSlide.dataset.title);
    }
  });

  // Resize handler
  window.addEventListener("resize", () => {
    if (!landing.classList.contains("hidden")) {
      updateLandingPosition();
    }
  });
}

function updateLandingPosition(animate = true) {
  const track = document.getElementById("categoryTrack");
  const slides = track.querySelectorAll(".category-slide");
  const containerWidth = track.parentElement.offsetWidth;

  const activeSlide = slides[state.landing.index];
  const offset = containerWidth / 2 - activeSlide.offsetLeft - activeSlide.offsetWidth / 2;

  if (!animate) track.style.transition = 'none';
  track.style.transform = `translateX(${offset}px)`;
  if (!animate) requestAnimationFrame(() => track.style.transition = '');

  slides.forEach((slide, i) => slide.classList.toggle('active', i === state.landing.index));
}

function goToLandingSlide(index) {
  const slides = document.getElementById("categoryTrack").querySelectorAll(".category-slide");
  if (index < 0 || index >= slides.length) return;
  state.landing.index = index;
  updateLandingPosition();
}

// Initialize category landing page with carousel navigation
function initializeCategoryLanding() {
  const loader = document.getElementById("portfolioLoader");
  loader.classList.add("hidden");

  // Initialize landing carousel
  initializeLandingCarousel();

  // Category view event handlers
  document.getElementById("categoryHeaderArea").addEventListener("click", closeCategory);
  document.getElementById("scrollHintOverlay").addEventListener("click", expandWorkDetails);

  // Work carousel drag-to-scroll
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentTranslate = 0;
  let prevTranslate = 0;
  let dragDirection = null; // 'horizontal', 'vertical', or null

  const carousel = document.getElementById("workCarousel");
  const track = document.getElementById("carouselTrack");

  function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
  }

  function getPositionY(e) {
    return e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
  }

  function dragStart(e) {
    // Don't start drag on iframe (YouTube)
    if (e.target.tagName === 'IFRAME') return;

    isDragging = true;
    dragDirection = null;
    startX = getPositionX(e);
    startY = getPositionY(e);
    prevTranslate = state.carousel.translate;
    currentTranslate = prevTranslate;
  }

  function drag(e) {
    if (!isDragging) return;

    const currentX = getPositionX(e);
    const currentY = getPositionY(e);
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    // Always track horizontal movement for threshold calculation
    currentTranslate = prevTranslate + diffX;

    // Determine drag direction on first significant movement
    if (!dragDirection && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
      if (Math.abs(diffX) > Math.abs(diffY)) {
        dragDirection = 'horizontal';
        track.classList.add('dragging');

        // Collapse details panel when starting horizontal drag
        if (state.ui.isExpanded && !state.ui.isTransitioning) {
          state.ui.isTransitioning = true;
          collapseDetailsPanel();
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => { state.ui.isTransitioning = false; }, 300);
        }
      } else {
        dragDirection = 'vertical';
      }
    }

    if (dragDirection === 'horizontal') {
      e.preventDefault();
      track.style.transform = `translateX(${currentTranslate}px)`;
    }
    // Vertical drag - don't prevent default, let natural scroll happen if expanded
  }

  function dragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove('dragging');

    // Calculate total movement from start
    const movedX = currentTranslate - prevTranslate;

    // Handle vertical drag
    if (dragDirection === 'vertical') {
      const endY = getPositionY(e);
      const diffY = endY - startY;
      const verticalThreshold = 50;
      if (diffY > verticalThreshold && !state.ui.isExpanded) {
        expandWorkDetails();
      } else if (diffY < -verticalThreshold && state.ui.isExpanded) {
        collapseWorkDetails();
      }
      dragDirection = null;
      return;
    }

    // Handle horizontal drag - 30px threshold for slide change
    if (Math.abs(movedX) > 30) {
      if (movedX > 0 && state.category.index > 0) {
        state.category.index--;
      } else if (movedX < 0 && state.category.index < state.category.works.length - 1) {
        state.category.index++;
      }
    }

    goToSlide(state.category.index);
    dragDirection = null;
  }

  // Mouse events - use window for move/up to handle dragging outside element
  track.addEventListener('mousedown', dragStart);
  window.addEventListener('mousemove', drag);
  window.addEventListener('mouseup', dragEnd);

  // Touch events
  track.addEventListener('touchstart', dragStart, { passive: true });
  track.addEventListener('touchmove', drag, { passive: false });
  track.addEventListener('touchend', dragEnd);

  // Prevent native drag on images
  track.addEventListener('dragstart', (e) => e.preventDefault());

  // Wheel/trackpad - simple snap-to-nearest approach
  const categoryView = document.getElementById("categoryView");
  let wheelTimeout = null;
  let verticalCooldown = false;
  let accumulatedDeltaY = 0;
  let lastWheelTime = 0;

  categoryView.addEventListener("wheel", (e) => {
    // If expanded, allow normal scrolling for vertical
    if (state.ui.isExpanded && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      return;
    }

    e.preventDefault();
    const now = Date.now();

    // Horizontal scroll
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5) {
      if (wheelTimeout) clearTimeout(wheelTimeout);
      if (state.ui.isExpanded) collapseDetailsPanel();

      track.classList.add('dragging');
      const newOffset = state.carousel.translate - e.deltaX;
      track.style.transform = `translateX(${newOffset}px)`;
      state.carousel.translate = newOffset;

      // Snap to nearest slide after scrolling stops
      wheelTimeout = setTimeout(() => {
        track.classList.remove('dragging');
        const viewportCenter = state.carousel.center || carousel.offsetWidth / 2;

        let nearestIndex = 0;
        let minDistance = Infinity;
        state.carousel.positions.forEach((pos, i) => {
          const slideVisualCenter = pos + state.carousel.translate;
          const distance = Math.abs(slideVisualCenter - viewportCenter);
          if (distance < minDistance) {
            minDistance = distance;
            nearestIndex = i;
          }
        });

        state.category.index = nearestIndex;
        goToSlide(state.category.index);
      }, 80);
      return;
    }

    // Vertical scroll
    if (!state.ui.isExpanded && !verticalCooldown) {
      if (now - lastWheelTime > 300) accumulatedDeltaY = 0;
      lastWheelTime = now;
      accumulatedDeltaY += e.deltaY;

      if (accumulatedDeltaY > 50) {
        verticalCooldown = true;
        expandWorkDetails();
        accumulatedDeltaY = 0;
        setTimeout(() => { verticalCooldown = false; }, 700);
        return;
      }

      if (accumulatedDeltaY < -50) {
        verticalCooldown = true;
        closeCategory();
        accumulatedDeltaY = 0;
        setTimeout(() => { verticalCooldown = false; }, 700);
      }
    }
  }, { passive: false });

  // Window resize - recalculate carousel position to prevent drift
  window.addEventListener("resize", () => {
    const categoryView = document.getElementById("categoryView");
    if (!categoryView.classList.contains("hidden") && state.category.works.length > 0) {
      updateCarouselPosition();
    }
  });

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    const categoryView = document.getElementById("categoryView");
    if (!categoryView.classList.contains("hidden")) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (state.ui.isExpanded) collapseWorkDetails();
        goToSlide(state.category.index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (state.ui.isExpanded) collapseWorkDetails();
        goToSlide(state.category.index + 1);
      } else if (e.key === "ArrowDown" && !state.ui.isExpanded) {
        e.preventDefault();
        expandWorkDetails();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.ui.isExpanded) collapseWorkDetails();
        else closeCategory();
      } else if (e.key === "Escape") {
        if (state.ui.isExpanded) collapseWorkDetails();
        else closeCategory();
      }
    }
  });
}

// Open a category view with sliding carousel
function openCategory(category, displayName) {
  state.category.current = category;
  const landing = document.getElementById("categoryLanding");
  const view = document.getElementById("categoryView");
  const heading = document.getElementById("categoryHeading");
  const loader = document.getElementById("portfolioLoader");
  const track = document.getElementById("carouselTrack");

  loader.classList.remove("hidden");

  // Filter works by industry (category can be semicolon-separated for multiple)
  const categories = category.split(";");
  state.category.works = state.works.all.filter(work => {
    return work.featured && categories.some(cat => work.industry === cat);
  });

  heading.textContent = displayName;

  // Reset state
  state.category.index = 0;
  state.ui.isExpanded = false;
  state.carousel = { translate: 0, positions: [], center: 0 };

  // Build slides
  track.innerHTML = state.category.works.map((work, index) => {
    let mediaHTML;

    // Prefer image when available, otherwise show video
    const primaryMedia = utils().getPrimaryMedia(work);
    if (primaryMedia.type === "image") {
      mediaHTML = `<img src="${primaryMedia.src}" alt="${work.title}">`;
    } else if (primaryMedia.type === "video") {
      mediaHTML = `
        <div class="video-container">
          <iframe src="https://www.youtube.com/embed/${primaryMedia.videoId}" allowfullscreen></iframe>
          <div class="video-swipe-overlay"></div>
        </div>
      `;
    } else {
      mediaHTML = `<div class="no-media"></div>`;
    }

    return `
      <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="carousel-slide-inner">
          ${mediaHTML}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers for adjacent slides
  track.querySelectorAll('.carousel-slide').forEach(slide => {
    slide.addEventListener('click', (e) => {
      const index = parseInt(slide.dataset.index, 10);
      if (index !== state.category.index) {
        e.preventDefault();
        e.stopPropagation();
        goToSlide(index);
      }
    });
  });

  // Preload first image then show
  if (state.category.works.length > 0) {
    const firstWork = state.category.works[0];
    const primaryMedia = utils().getPrimaryMedia(firstWork);
    const displayImage = primaryMedia.type === "image" ? primaryMedia.src : (primaryMedia.thumbnail || "");

    const img = new Image();
    img.onload = img.onerror = () => {
      // Reset scroll position before showing to prevent jump
      window.scrollTo(0, 0);
      track.classList.add("preparing");
      landing.classList.add("hidden");
      view.classList.remove("hidden");
      loader.classList.add("hidden");
      // Wait for layout to complete before positioning (no animation on initial load)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateCarouselPosition(false);
          requestAnimationFrame(() => {
            track.classList.remove("preparing");
          });
        });
      });
    };
    img.src = displayImage;
  } else {
    track.classList.add("preparing");
    landing.classList.add("hidden");
    view.classList.remove("hidden");
    loader.classList.add("hidden");
    requestAnimationFrame(() => {
      updateCarouselPosition(false);
      requestAnimationFrame(() => {
        track.classList.remove("preparing");
      });
    });
  }
}

// Update carousel track position (uses pixels for drag compatibility)
function updateCarouselPosition(animate = true) {
  const carousel = document.getElementById("workCarousel");
  const track = document.getElementById("carouselTrack");
  const slides = track.querySelectorAll('.carousel-slide');
  const carouselWidth = carousel.offsetWidth;

  const activeSlide = slides[state.category.index];
  const targetSlideCenter = activeSlide ? activeSlide.offsetLeft + activeSlide.offsetWidth / 2 : 0;
  const offset = carouselWidth / 2 - targetSlideCenter;

  if (!animate) track.classList.add('dragging');
  track.style.transform = `translateX(${offset}px)`;
  if (!animate) {
    requestAnimationFrame(() => track.classList.remove('dragging'));
  }

  // Store values for drag/snap calculations
  state.carousel.translate = offset;
  state.carousel.positions = Array.from(slides).map(s => s.offsetLeft + s.offsetWidth / 2);
  state.carousel.center = carouselWidth / 2;

  // Update active class
  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === state.category.index);
  });

  collapseDetailsPanel();
}

// Go to specific slide
function goToSlide(index) {
  if (index < 0 || index >= state.category.works.length) return;
  state.category.index = index;
  updateCarouselPosition();
}

// Expand work details (Y-axis navigation down)
function expandWorkDetails() {
  if (state.ui.isExpanded || state.ui.isTransitioning) return;

  const work = state.category.works[state.category.index];
  if (!work) return;

  state.ui.isTransitioning = true;

  const detailsPanel = document.getElementById("workDetailsPanel");
  const details = document.getElementById("workDetails");
  const gallery = document.getElementById("workGallery");
  const scrollHint = document.getElementById("scrollHintOverlay");

  // Match details panel width to current artwork
  const track = document.getElementById("carouselTrack");
  const activeSlideInner = track.querySelector('.carousel-slide.active .carousel-slide-inner');
  if (activeSlideInner) {
    const img = activeSlideInner.querySelector('img');
    const video = activeSlideInner.querySelector('.video-container');
    const artworkWidth = img ? img.offsetWidth : (video ? video.offsetWidth : activeSlideInner.offsetWidth);
    detailsPanel.style.width = artworkWidth + 'px';
    detailsPanel.style.maxWidth = 'none';
  }

  const metaHTML = buildMetaHTML(work, config());

  // Get description from content or legacy info field
  let descriptionText = "";
  if (work.content && work.content.length > 0) {
    const textContent = work.content.find(c => c.type === "text");
    if (textContent) descriptionText = textContent.text;
  } else if (work.info?.trim()) {
    descriptionText = work.info;
  }
  const descriptionHTML = descriptionText ? `<p class="modal-description">${descriptionText}</p>` : "";

  details.innerHTML = `
    <h3>${work.title}</h3>
    ${descriptionHTML}
    <div class="modal-meta">${metaHTML}</div>
  `;

  // Render gallery from content or legacy images
  gallery.innerHTML = "";

  if (work.content && work.content.length > 0) {
    // New content format - skip first media item (shown in carousel) and first text (in details)
    let skippedFirstMedia = false;
    let skippedFirstText = false;
    work.content.forEach((item, index) => {
      if (item.type === "image") {
        if (!skippedFirstMedia) {
          skippedFirstMedia = true;
          return;
        }
        const galleryItem = document.createElement("div");
        galleryItem.className = "work-gallery-item";
        galleryItem.innerHTML = `
          <img src="${item.src}" alt="${work.title} - Image ${index + 1}">
          ${item.caption ? `<div class="work-gallery-caption">${item.caption}</div>` : ""}
        `;
        gallery.appendChild(galleryItem);
      } else if (item.type === "video") {
        if (!skippedFirstMedia) {
          skippedFirstMedia = true;
          return;
        }
        const galleryItem = document.createElement("div");
        galleryItem.className = "work-gallery-item work-gallery-video";
        galleryItem.innerHTML = `
          <iframe src="https://www.youtube.com/embed/${item.videoId}" allowfullscreen></iframe>
        `;
        gallery.appendChild(galleryItem);
      } else if (item.type === "text") {
        if (!skippedFirstText) {
          skippedFirstText = true;
          return;
        }
        const galleryItem = document.createElement("div");
        galleryItem.className = "work-gallery-item work-gallery-text";
        galleryItem.innerHTML = `<p>${item.text}</p>`;
        gallery.appendChild(galleryItem);
      }
    });
  } else {
    // Legacy format
    const images = work.images?.slice(1) || [];
    images.forEach((img, index) => {
      const imgData = getImageData(img);
      const item = document.createElement("div");
      item.className = "work-gallery-item";
      item.innerHTML = `
        <img src="${imgData.src}" alt="${work.title} - Image ${index + 2}">
        ${imgData.caption ? `<div class="work-gallery-caption">${imgData.caption}</div>` : ""}
      `;
      gallery.appendChild(item);
    });
  }

  attachFilterHandlers(details);

  scrollHint.classList.add("hidden");
  detailsPanel.classList.remove("hidden");
  state.ui.isExpanded = true;

  detailsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { state.ui.isTransitioning = false; }, 400);
}

// Collapse work details (Y-axis navigation up)
function collapseWorkDetails() {
  if (!state.ui.isExpanded || state.ui.isTransitioning) return;
  state.ui.isTransitioning = true;
  collapseDetailsPanel();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => { state.ui.isTransitioning = false; }, 500);
}

// Close category view and return to landing
function closeCategory() {
  state.category = { current: null, works: [], index: 0 };
  state.ui = { isExpanded: false, isTransitioning: false };
  state.carousel = { translate: 0, positions: [], center: 0 };

  const track = document.getElementById("carouselTrack");
  track.style.transform = 'translateX(0)';

  document.getElementById("categoryView").classList.add("hidden");
  document.getElementById("categoryLanding").classList.remove("hidden");
}

// Build modal content from work's content array
function buildModalContent(work) {
  const content = work.content || [];
  const metaHTML = buildMetaHTML(work, config());
  let cards = [];
  let textItems = [];
  let isFirstMedia = true;

  // Collect all text items and media items separately
  for (const item of content) {
    if (item.type === "text") {
      textItems.push(item.text);
    } else if (item.type === "image") {
      const imgSrc = typeof item.src === 'string' ? item.src : item.src?.src || '';
      if (isFirstMedia) {
        cards.push(`
          <div class="modal-card modal-card-media">
            <div class="modal-media">
              <img src="${imgSrc}" alt="${work.title}">
            </div>
            ${item.caption ? `<div class="image-caption">${item.caption}</div>` : ""}
          </div>
        `);
        isFirstMedia = false;
      } else {
        cards.push(`
          <div class="modal-card modal-card-image">
            <img src="${imgSrc}" alt="${work.title}">
            ${item.caption ? `<div class="image-caption">${item.caption}</div>` : ""}
          </div>
        `);
      }
    } else if (item.type === "video") {
      if (isFirstMedia) {
        cards.push(`
          <div class="modal-card modal-card-media">
            <div class="modal-media">
              <iframe src="https://www.youtube.com/embed/${item.videoId}" allowfullscreen></iframe>
            </div>
          </div>
        `);
        isFirstMedia = false;
      } else {
        cards.push(`
          <div class="modal-card modal-card-video">
            <iframe src="https://www.youtube.com/embed/${item.videoId}" allowfullscreen></iframe>
          </div>
        `);
      }
    }
  }

  // Build details card with first text as description
  const firstText = textItems.shift() || "";
  const detailsCard = `
    <div class="modal-card modal-card-details">
      <h3>${work.title}</h3>
      ${firstText ? `<p class="modal-description">${firstText}</p>` : ""}
      <div class="modal-meta">${metaHTML}</div>
    </div>
  `;

  // Insert details card after first media
  if (cards.length > 0) {
    cards.splice(1, 0, detailsCard);
  } else {
    cards.push(detailsCard);
  }

  // Add remaining text items as separate cards
  for (const text of textItems) {
    cards.push(`
      <div class="modal-card modal-card-text">
        <p>${text}</p>
      </div>
    `);
  }

  return cards.join('');
}

// Open modal with work details
function openModal(index, fromFilteredList = false) {
  // Determine which list to use for navigation
  if (fromFilteredList && Object.keys(state.filters).length > 0) {
    state.modal.list = state.works.filtered;
  } else if (state.modal.list.length === 0 || !fromFilteredList) {
    state.modal.list = state.works.all;
  }
  state.modal.index = index;

  const work = state.modal.list[state.modal.index];
  if (!work) return;

  const modal = document.getElementById("modal");
  const container = document.getElementById("modalScrollContainer");

  updateURL({ work: utils().slugify(work.title) });

  // Use new content format if available, fallback to legacy
  let contentHTML;
  if (work.content && work.content.length > 0) {
    contentHTML = buildModalContent(work);
  } else {
    // Legacy format fallback
    const metaHTML = buildMetaHTML(work, config());
    const descriptionHTML = work.info?.trim() ? `<p class="modal-description">${work.info}</p>` : "";

    if (work.type === "video") {
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
      const images = work.images || [];
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
  attachFilterHandlers(container);

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  modal.scrollTop = 0;
}

// Close modal
function closeModal() {
  const modal = document.getElementById("modal");
  const container = document.getElementById("modalScrollContainer");

  // Stop any playing video
  const iframe = container.querySelector("iframe");
  if (iframe) iframe.src = "";

  modal.classList.remove("active");
  document.body.style.overflow = "";
  updateURL(state.filters);
}

// Navigate to previous/next work
function prevWork() {
  if (state.modal.list.length === 0) state.modal.list = state.works.all;
  state.modal.index = (state.modal.index - 1 + state.modal.list.length) % state.modal.list.length;
  openModal(state.modal.index);
}

function nextWork() {
  if (state.modal.list.length === 0) state.modal.list = state.works.all;
  state.modal.index = (state.modal.index + 1) % state.modal.list.length;
  openModal(state.modal.index);
}

// Add filter
function addFilter(type, value) {
  state.filters[type] = value;
  closeModal();
  applyFilters();
  switchSection("index");
  updateURL(state.filters);
}

// Apply filters to works
function applyFilters() {
  const cfg = config();
  const { getMultiValues } = utils();

  state.works.filtered = state.works.all.filter((work) =>
    Object.entries(state.filters).every(([key, value]) =>
      cfg.multiValueFields.includes(key)
        ? getMultiValues(work[key]).includes(value)
        : work[key] === value
    )
  );

  renderTable();
  renderActiveFilters();
}

// Render active filter tags
function renderActiveFilters() {
  const container = document.getElementById("activeFilters");
  const labels = config().fieldLabels;
  container.innerHTML = "";

  Object.entries(state.filters).forEach(([key, value]) => {
    const tag = document.createElement("div");
    tag.className = "filter-tag";
    tag.innerHTML = `${labels[key] || key}: ${value} <span class="remove">×</span>`;
    tag.onclick = () => removeFilter(key);
    container.appendChild(tag);
  });
}

// Remove a specific filter
function removeFilter(type) {
  delete state.filters[type];
  applyFilters();
  updateURL(state.filters);
}

// Clear all filters
function clearAllFilters() {
  state.filters = {};
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
window.addEventListener("popstate", applyURLState);

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // Show admin link only when running locally
  if (["localhost", "127.0.0.1"].includes(location.hostname)) {
    document.getElementById("adminLink").style.display = "";
  }

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

  document.getElementById("clearFilters").addEventListener("click", clearAllFilters);

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

  // Consolidated keydown handler for modals
  document.addEventListener("keydown", (e) => {
    const modal = document.getElementById("modal");
    const showreelModal = document.getElementById("showreelModal");
    if (modal.classList.contains("active")) {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") prevWork();
      if (e.key === "ArrowRight") nextWork();
    } else if (showreelModal.classList.contains("active")) {
      if (e.key === "Escape") closeShowreel();
    }
  });
});
