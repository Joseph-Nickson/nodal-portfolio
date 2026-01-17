const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
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

// Base works directory
const worksBasePath = path.join(__dirname, "../works");

// Utility Functions
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

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

function extractYouTubeId(url) {
  if (!url) return "";
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function getYouTubeThumbnail(videoId) {
  if (!videoId) return "";
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function buildMetaData(data, existingMeta = {}) {
  const meta = {
    title: data.title || existingMeta.title || "",
    type: data.type || existingMeta.type || "",
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

  // Handle videoId for video type
  if (meta.type === "video" && data.videoId) {
    meta.videoId = data.videoId;
  } else if (meta.type !== "video" && existingMeta.videoId) {
    delete meta.videoId;
  }

  return meta;
}

// Scan all works from both new and legacy structures
async function scanAllWorks() {
  const works = [];

  try {
    const entries = await fs.readdir(worksBasePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(worksBasePath, entry.name);

      // Check if this is a year folder (new structure)
      if (/^\d{4}$/.test(entry.name)) {
        const year = entry.name;
        const projectFolders = await fs.readdir(entryPath, {
          withFileTypes: true,
        });

        for (const projectFolder of projectFolders) {
          if (!projectFolder.isDirectory()) continue;

          const metaPath = path.join(
            entryPath,
            projectFolder.name,
            "meta.json",
          );

          if (fsSync.existsSync(metaPath)) {
            try {
              const metaContent = await fs.readFile(metaPath, "utf8");
              const meta = JSON.parse(metaContent);

              // Convert image filenames to full paths
              const images =
                meta.images && Array.isArray(meta.images)
                  ? meta.images.map(
                      (img) => `works/${year}/${projectFolder.name}/${img}`,
                    )
                  : [];

              // Remove images from meta to avoid override
              const { images: _, ...metaWithoutImages } = meta;

              // Generate thumbnail for videos
              let thumbnail = "";
              if (meta.type === "video" && meta.videoId) {
                const videoId = extractYouTubeId(meta.videoId);
                thumbnail = getYouTubeThumbnail(videoId);
              }

              works.push({
                ...metaWithoutImages,
                images: images, // Add full image paths
                thumbnail: thumbnail,
                id: `${year}-${projectFolder.name}`,
                year: year,
                folder: projectFolder.name,
                parentFolder: year,
                path: path.join(entryPath, projectFolder.name),
              });
            } catch (err) {
              console.error(
                `Error reading meta.json in ${metaPath}:`,
                err.message,
              );
            }
          }
        }
      }
      // Check if this is a client folder (legacy structure)
      else {
        const clientName = entry.name;
        const projectFolders = await fs.readdir(entryPath, {
          withFileTypes: true,
        });

        for (const projectFolder of projectFolders) {
          if (!projectFolder.isDirectory()) continue;

          const metaPath = path.join(
            entryPath,
            projectFolder.name,
            "meta.json",
          );

          if (fsSync.existsSync(metaPath)) {
            try {
              const metaContent = await fs.readFile(metaPath, "utf8");
              const meta = JSON.parse(metaContent);

              // Extract year from folder name (e.g., "2024 - Project Name")
              const yearMatch = projectFolder.name.match(/^(\d{4})/);
              const year = yearMatch ? yearMatch[1] : "unknown";

              // Convert image filenames to full paths
              const images =
                meta.images && Array.isArray(meta.images)
                  ? meta.images.map(
                      (img) =>
                        `works/${clientName}/${projectFolder.name}/${img}`,
                    )
                  : [];

              // Remove images from meta to avoid override
              const { images: _, ...metaWithoutImages } = meta;

              works.push({
                ...metaWithoutImages,
                images: images, // Add full image paths
                id: `${clientName}-${projectFolder.name}`,
                year: year,
                folder: projectFolder.name,
                parentFolder: clientName,
                path: path.join(entryPath, projectFolder.name),
              });
            } catch (err) {
              console.error(
                `Error reading meta.json in ${metaPath}:`,
                err.message,
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Error scanning works:", err.message);
  }

  return works;
}

// GET /api/works - Return all works
app.get("/api/works", async (req, res) => {
  try {
    const works = await scanAllWorks();
    res.json(works);
  } catch (err) {
    console.error("Error fetching works:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch works", message: err.message });
  }
});

// POST /api/works - Create new work
app.post("/api/works", upload.array("images", 20), async (req, res) => {
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

    // Create slug and paths
    const slug = slugify(title);
    const year = date.substring(0, 4);
    const projectPath = getProjectPath(year, slug);

    // Validate path
    validateProjectPath(projectPath);

    // Create directory
    await fs.mkdir(projectPath, { recursive: true });
    console.log(`Created directory: ${projectPath}`);

    // Handle file uploads
    const images = await processImageUploads(req.files, projectPath);
    console.log(`Saved ${images.length} images`);

    // Create meta.json
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
});

// PUT /api/works/:id - Update existing work
app.put("/api/works/:id", upload.array("images", 20), async (req, res) => {
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

    // Find the work
    const works = await scanAllWorks();
    const work = works.find((w) => w.id === id);

    if (!work) {
      return res.status(404).json({ error: "Work not found" });
    }

    const oldPath = work.path;
    let newPath = oldPath;

    // Check if we need to rename the folder
    if (title && date) {
      const newSlug = slugify(title);
      const newYear = date.substring(0, 4);
      const newProjectPath = getProjectPath(newYear, newSlug);

      // Only rename if path changed
      if (newProjectPath !== oldPath) {
        validateProjectPath(newProjectPath, oldPath);

        // Create parent directory if needed
        await fs.mkdir(path.dirname(newProjectPath), { recursive: true });

        // Move the folder
        await fs.rename(oldPath, newProjectPath);
        console.log(`Renamed folder from ${oldPath} to ${newProjectPath}`);
        newPath = newProjectPath;
      }
    }

    // Read existing meta.json
    const metaPath = path.join(newPath, "meta.json");
    let existingMeta = {};

    try {
      const metaContent = await fs.readFile(metaPath, "utf8");
      existingMeta = JSON.parse(metaContent);
    } catch (err) {
      console.log("No existing meta.json found, creating new one");
    }

    // Handle new file uploads
    let images = existingMeta.images || [];
    const newImages = await processImageUploads(
      req.files,
      newPath,
      images.length,
    );
    images = [...images, ...newImages];

    console.log(`Total images: ${images.length}`);

    // Update meta.json
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
});

// DELETE /api/works/:id - Delete work
app.delete("/api/works/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the work
    const works = await scanAllWorks();
    const work = works.find((w) => w.id === id);

    if (!work) {
      return res.status(404).json({ error: "Work not found" });
    }

    // Delete the entire project folder
    await fs.rm(work.path, { recursive: true, force: true });
    console.log(`Deleted folder: ${work.path}`);

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

// POST /api/build - Run build script
app.post("/api/build", async (req, res) => {
  try {
    const buildScriptPath = path.join(__dirname, "../build-data.js");

    console.log("Running build script...");
    const { stdout, stderr } = await execAsync(`node "${buildScriptPath}"`, {
      cwd: path.dirname(buildScriptPath),
    });

    // Count works
    const works = await scanAllWorks();
    const workCount = works.length;

    console.log("Build completed successfully");
    console.log("stdout:", stdout);
    if (stderr) {
      console.log("stderr:", stderr);
    }

    res.json({
      success: true,
      message: "Build completed successfully",
      workCount: workCount,
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

// Static files AFTER all API routes
app.use(express.static(__dirname));
app.use("/works", express.static(path.join(__dirname, "../works")));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Works directory: ${worksBasePath}`);
});
