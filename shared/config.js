/**
 * Shared configuration for portfolio website
 * Used by: build-data.js, admin/server.js, script.js, admin/admin.js
 */

const CONFIG = {
  // Fields that support multiple semicolon-separated values
  multiValueFields: ["client", "contribution", "software", "style"],

  // Available industries for works
  industries: ["Film", "TV", "Games", "Advertising", "Music", "Personal"],

  // Work types
  workTypes: ["image", "video"],

  // Field labels for display
  fieldLabels: {
    client: "Client",
    contribution: "Discipline",
    date: "Year",
    style: "Style",
    software: "Software",
    industry: "Industry",
    type: "Type",
  },

  // Filter fields configuration (for dropdowns and filtering)
  filterFields: [
    { key: "client", label: "Client" },
    { key: "date", label: "Year" },
    { key: "contribution", label: "Discipline" },
    { key: "software", label: "Software" },
    { key: "style", label: "Style" },
  ],

  // Required fields for work creation/validation
  requiredFields: ["title", "date"],

  // Server configuration
  server: {
    port: 3000,
    apiPrefix: "/api",
  },

  // Default meta.json structure
  defaultMeta: {
    title: "",
    type: "image",
    client: "",
    industry: "",
    contribution: "",
    date: "",
    style: "",
    software: "",
    info: "",
    featured: false,
    images: [],
    videoId: "",
  },
};

// Export for Node.js (CommonJS)
if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
}

// Export for browser (window global)
if (typeof window !== "undefined") {
  window.PortfolioConfig = CONFIG;
}
