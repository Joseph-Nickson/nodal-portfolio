/**
 * Unified Express server for portfolio website
 * Serves both the main portfolio and admin interface
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const crypto = require("crypto");
const { exec } = require("child_process");
const { promisify } = require("util");

const { slugify } = require("./shared/utils");
const { scanAllWorksAsync } = require("./shared/scanner");
const CONFIG = require("./shared/config");

const execAsync = promisify(exec);
const app = express();
const PORT = CONFIG.server.port;

// Paths
const rootPath = __dirname;
const worksBasePath = path.join(rootPath, "works");
const adminPath = path.join(rootPath, "admin");

// CSRF token storage (in production, use redis or database)
const csrfTokens = new Map();
const CSRF_TOKEN_EXPIRY = 3600000; // 1 hour

// Works cache
let worksCache = null;
let worksCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

// Middleware
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "/tmp");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// CSRF middleware
function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(token, Date.now());
  return token;
}

function validateCsrfToken(token) {
  if (!token || !csrfTokens.has(token)) {
    return false;
  }
  const timestamp = csrfTokens.get(token);
  if (Date.now() - timestamp > CSRF_TOKEN_EXPIRY) {
    csrfTokens.delete(token);
    return false;
  }
  return true;
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, timestamp] of csrfTokens.entries()) {
    if (now - timestamp > CSRF_TOKEN_EXPIRY) {
      csrfTokens.delete(token);
    }
  }
}, 300000); // Every 5 minutes

// CSRF protection middleware for mutating requests
function csrfProtection(req, res, next) {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    const token = req.headers["x-csrf-token"];
    if (!validateCsrfToken(token)) {
      return res.status(403).json({ error: "Invalid or missing CSRF token" });
    }
  }
  next();
}

// Helper functions
function getProjectPath(year, slug) {
  return path.join(worksBasePath, year, slug);
}

function validateProjectPath(projectPath, excludePath = null) {
  if (fsSync.existsSync(projectPath) && projectPath !== excludePath) {
    throw new Error("A project with this title already exists for this year");
  }
}

function parseFeatured(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === "true" || value === "on" || value === true;
}

async function processImageUploads(files, destinationPath, startIndex = 0) {
  const images = [];

  if (!files || files.length === 0) return images;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = path.extname(file.originalname);
    const imageIndex = startIndex + i;
    const imageName =
      imageIndex === 0 ? `image${ext}` : `image${imageIndex + 1}${ext}`;
    const destPath = path.join(destinationPath, imageName);

    await fs.copyFile(file.path, destPath);
    await fs.unlink(file.path);

    images.push(imageName);
  }

  return images;
}

async function cleanupTempFiles(files) {
  if (!files) return;

  for (const file of files) {
    try {
      await fs.unlink(file.path);
    } catch (err) {
      // Ignore unlink errors
    }
  }
}

function buildMetaData(data, existingMeta = {}) {
  const meta = {
    title: data.title || existingMeta.title || "",
    type: data.type || existingMeta.type || "image",
    client: data.client || existingMeta.client || "",
    industry: data.industry || existingMeta.industry || "",
    contribution: data.contribution || existingMeta.contribution || "",
    date: data.date || existingMeta.date || "",
    style: data.style || existingMeta.style || "",
    software: data.software || existingMeta.software || "",
    info: data.info || existingMeta.info || "",
    featured: parseFeatured(data.featured, existingMeta.featured),
    images: data.images || existingMeta.images || [],
  };

  if (meta.type === "video" && data.videoId) {
    meta.videoId = data.videoId;
  } else if (meta.type !== "video") {
    delete meta.videoId;
  }

  return meta;
}

// Cached works fetching
async function getWorks(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && worksCache && now - worksCacheTime < CACHE_TTL) {
    return worksCache;
  }

  worksCache = await scanAllWorksAsync(worksBasePath);
  worksCacheTime = now;
  return worksCache;
}

function invalidateCache() {
  worksCache = null;
  worksCacheTime = 0;
}

// ==================== API Routes ====================

// GET CSRF token
app.get("/api/csrf-token", (req, res) => {
  const token = generateCsrfToken();
  res.json({ token });
});

// GET /api/works - Return all works (cached)
app.get("/api/works", async (req, res) => {
  try {
    const works = await getWorks();
    res.json(works);
  } catch (err) {
    console.error("Error fetching works:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch works", message: err.message });
  }
});

// POST /api/works - Create new work (CSRF protected)
app.post(
  "/api/works",
  csrfProtection,
  upload.array("images", 20),
  async (req, res) => {
    try {
      const {
        title,
        date,
        client,
        industry,
        contribution,
        style,
        software,
        info,
        type,
        videoId,
        featured,
      } = req.body;

      if (!title || !date) {
        return res.status(400).json({ error: "Title and date are required" });
      }

      const slug = slugify(title);
      const year = date.substring(0, 4);
      const projectPath = getProjectPath(year, slug);

      validateProjectPath(projectPath);

      await fs.mkdir(projectPath, { recursive: true });
      console.log(`Created directory: ${projectPath}`);

      const images = await processImageUploads(req.files, projectPath);
      console.log(`Saved ${images.length} images`);

      const meta = buildMetaData({
        title,
        client,
        industry,
        contribution,
        date,
        style,
        software,
        info,
        type,
        videoId,
        featured,
        images,
      });

      const metaPath = path.join(projectPath, "meta.json");
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      console.log(`Created meta.json at ${metaPath}`);

      invalidateCache();

      res.json({
        success: true,
        message: "Work created successfully",
        id: `${year}-${slug}`,
        path: projectPath,
      });
    } catch (err) {
      console.error("Error creating work:", err);
      await cleanupTempFiles(req.files);
      res
        .status(500)
        .json({ error: "Failed to create work", message: err.message });
    }
  },
);

// PUT /api/works/:id - Update existing work (CSRF protected)
app.put(
  "/api/works/:id",
  csrfProtection,
  upload.array("images", 20),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        date,
        client,
        industry,
        contribution,
        style,
        software,
        info,
        type,
        videoId,
        featured,
      } = req.body;

      const works = await getWorks();
      const work = works.find((w) => w.id === id);

      if (!work) {
        return res.status(404).json({ error: "Work not found" });
      }

      const oldPath = work.path;
      let newPath = oldPath;

      if (title && date) {
        const newSlug = slugify(title);
        const newYear = date.substring(0, 4);
        const newProjectPath = getProjectPath(newYear, newSlug);

        if (newProjectPath !== oldPath) {
          validateProjectPath(newProjectPath, oldPath);
          await fs.mkdir(path.dirname(newProjectPath), { recursive: true });
          await fs.rename(oldPath, newProjectPath);
          console.log(`Renamed folder from ${oldPath} to ${newProjectPath}`);
          newPath = newProjectPath;
        }
      }

      const metaPath = path.join(newPath, "meta.json");
      let existingMeta = {};

      try {
        const metaContent = await fs.readFile(metaPath, "utf8");
        existingMeta = JSON.parse(metaContent);
      } catch (err) {
        console.log("No existing meta.json found, creating new one");
      }

      let images = existingMeta.images || [];
      const newImages = await processImageUploads(
        req.files,
        newPath,
        images.length,
      );
      images = [...images, ...newImages];

      const meta = buildMetaData(
        {
          title,
          client,
          industry,
          contribution,
          date,
          style,
          software,
          info,
          type,
          videoId,
          featured,
          images,
        },
        existingMeta,
      );

      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      console.log(`Updated meta.json at ${metaPath}`);

      invalidateCache();

      res.json({
        success: true,
        message: "Work updated successfully",
        path: newPath,
      });
    } catch (err) {
      console.error("Error updating work:", err);
      await cleanupTempFiles(req.files);
      res
        .status(500)
        .json({ error: "Failed to update work", message: err.message });
    }
  },
);

// DELETE /api/works/:id - Delete work (CSRF protected)
app.delete("/api/works/:id", csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;

    const works = await getWorks();
    const work = works.find((w) => w.id === id);

    if (!work) {
      return res.status(404).json({ error: "Work not found" });
    }

    await fs.rm(work.path, { recursive: true, force: true });
    console.log(`Deleted folder: ${work.path}`);

    invalidateCache();

    res.json({
      success: true,
      message: "Work deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting work:", err);
    res
      .status(500)
      .json({ error: "Failed to delete work", message: err.message });
  }
});

// POST /api/build - Run build script (CSRF protected)
app.post("/api/build", csrfProtection, async (req, res) => {
  try {
    const buildScriptPath = path.join(rootPath, "build-data.js");

    console.log("Running build script...");
    const { stdout, stderr } = await execAsync(`node "${buildScriptPath}"`, {
      cwd: rootPath,
    });

    invalidateCache();
    const works = await getWorks(true);

    console.log("Build completed successfully");
    console.log("stdout:", stdout);
    if (stderr) {
      console.log("stderr:", stderr);
    }

    res.json({
      success: true,
      message: "Build completed successfully",
      workCount: works.length,
      stdout: stdout,
      stderr: stderr,
    });
  } catch (err) {
    console.error("Error running build:", err);
    res.status(500).json({
      error: "Build failed",
      message: err.message,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
    });
  }
});

// ==================== Static Files ====================

// Serve shared modules for browser
app.use("/shared", express.static(path.join(rootPath, "shared")));

// Serve admin interface at /admin
app.use("/admin", express.static(adminPath));

// Serve works directory
app.use("/works", express.static(worksBasePath));

// Serve main portfolio (root)
app.use(
  express.static(rootPath, {
    index: "index.html",
    extensions: ["html"],
  }),
);

// Fallback to index.html for SPA-style routing (Express 5 syntax)
app.get("/{*path}", (req, res) => {
  // Don't serve index.html for API routes or static files
  if (req.path.startsWith("/api/") || req.path.includes(".")) {
    return res.status(404).send("Not found");
  }
  res.sendFile(path.join(rootPath, "index.html"));
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`Portfolio server running on http://localhost:${PORT}`);
  console.log(`Admin interface: http://localhost:${PORT}/admin`);
  console.log(`Works directory: ${worksBasePath}`);
});
