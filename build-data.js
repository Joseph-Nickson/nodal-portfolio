const fs = require("fs");
const path = require("path");

const worksDir = path.join(__dirname, "works");
const outputFile = path.join(__dirname, "data.json");

// Utility Functions
function extractYouTubeId(url) {
  if (!url) return "";
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Already just an ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function getYouTubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function getImagesFromProject(
  projectPath,
  metaImages,
  parentFolder,
  folderName,
) {
  const images = [];

  if (!metaImages || !Array.isArray(metaImages)) {
    return images;
  }

  for (const img of metaImages) {
    const imgPath = path.join(projectPath, img);
    if (fs.existsSync(imgPath)) {
      images.push(`works/${parentFolder}/${folderName}/${img}`);
    }
  }

  return images;
}

function scanProjectsInDirectory(parentPath, parentName, isYearFolder) {
  const projects = [];

  try {
    const folders = fs.readdirSync(parentPath, { withFileTypes: true });

    for (const folder of folders) {
      if (!folder.isDirectory() || folder.name.startsWith(".")) continue;

      const projectPath = path.join(parentPath, folder.name);
      const metaPath = path.join(projectPath, "meta.json");

      if (fs.existsSync(metaPath)) {
        projects.push({
          path: projectPath,
          metaPath: metaPath,
          structure: isYearFolder ? "new" : "old",
          folderName: folder.name,
          parentFolder: parentName,
        });
      }
    }
  } catch (err) {
    console.error(`Error scanning directory ${parentPath}:`, err.message);
  }

  return projects;
}

function getAllProjects() {
  const projects = [];

  if (!fs.existsSync(worksDir)) {
    console.error(`Works directory not found: ${worksDir}`);
    return projects;
  }

  try {
    const entries = fs.readdirSync(worksDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const entryPath = path.join(worksDir, entry.name);
      const isYearFolder = /^\d{4}$/.test(entry.name);

      const entryProjects = scanProjectsInDirectory(
        entryPath,
        entry.name,
        isYearFolder,
      );
      projects.push(...entryProjects);
    }
  } catch (err) {
    console.error("Error reading works directory:", err.message);
  }

  return projects;
}

function buildProjectData(project) {
  try {
    const metaContent = fs.readFileSync(project.metaPath, "utf8");
    const meta = JSON.parse(metaContent);

    const data = {
      id: meta.id || "",
      title: meta.title || "",
      type: meta.type || "",
      client: meta.client || "",
      industry: meta.industry || "",
      contribution: meta.contribution || "",
      date: meta.date || "",
      style: meta.style || "",
      software: meta.software || "",
      info: meta.info || "",
      featured: meta.featured || false,
    };

    if (meta.type === "video") {
      // Support full YouTube URL in either video or videoId field
      const videoId =
        extractYouTubeId(meta.videoId) || extractYouTubeId(meta.video);
      data.videoId = videoId;

      // Get images for thumbnail
      const images = getImagesFromProject(
        project.path,
        meta.images,
        project.parentFolder,
        project.folderName,
      );

      if (images.length > 0) {
        data.thumbnail = images[0];
      } else if (videoId) {
        data.thumbnail = getYouTubeThumbnail(videoId);
      } else {
        data.thumbnail = "";
      }
    } else if (meta.type === "image") {
      const images = getImagesFromProject(
        project.path,
        meta.images,
        project.parentFolder,
        project.folderName,
      );

      data.image = images.length > 0 ? images[0] : "";
      data.images = images;
    }

    return data;
  } catch (error) {
    console.error(
      `Error processing project at ${project.path}:`,
      error.message,
    );
    return null;
  }
}

function main() {
  console.log("Scanning for projects...");

  const projects = getAllProjects();
  console.log(`Found ${projects.length} projects`);

  const allData = projects
    .map(buildProjectData)
    .filter((data) => data !== null);

  // Sort by date (newest first)
  allData.sort((a, b) => {
    const dateA = new Date(a.date || 0);
    const dateB = new Date(b.date || 0);
    return dateB - dateA;
  });

  fs.writeFileSync(outputFile, JSON.stringify(allData, null, 2), "utf8");
  console.log(`\nData written to ${outputFile}`);
  console.log(`Total projects: ${allData.length}`);
}

main();
