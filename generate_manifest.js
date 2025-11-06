const fs = require("fs");
const path = require("path");

const worksDir = "./works";
const categories = ["client", "personal", "tools", "info"];
const imageExtensions = /\.(jpg|jpeg|png|gif)$/i;
const videoExtensions = /\.(mp4|mov)$/i;
const audioExtensions = /\.(mp3|wav)$/i;

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
    /youtube\.com\/embed\/([^?&\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Parse .txt file to check if it contains a YouTube link
 */
function parseVideoFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8").trim();
    const youtubeId = extractYouTubeId(content);

    if (youtubeId) {
      return {
        type: "youtube",
        videoId: youtubeId,
        url: content,
      };
    }
  } catch (error) {
    console.warn(`Could not read ${filePath}:`, error.message);
  }
  return null;
}

const manifest = {};

categories.forEach((category) => {
  const categoryPath = path.join(worksDir, category);
  if (fs.existsSync(categoryPath)) {
    const items = [];
    const entries = fs.readdirSync(categoryPath, { withFileTypes: true });

    entries.forEach((entry) => {
      const entryPath = path.join(categoryPath, entry.name);

      if (entry.isDirectory()) {
        // Folder-based work
        const allFiles = fs.readdirSync(entryPath);

        // Collect image/video files
        const images = allFiles
          .filter(
            (file) =>
              imageExtensions.test(file) ||
              videoExtensions.test(file) ||
              audioExtensions.test(file),
          )
          .sort()
          .map((file) => {
            const filePath = `works/${category}/${entry.name}/${file}`;
            const txtPath = `works/${category}/${entry.name}/${file.replace(/\.[^/.]+$/, ".txt")}`;
            return {
              type: "image",
              filename: file,
              path: filePath,
              infoPath: fs.existsSync(txtPath.replace("works/", "./works/"))
                ? txtPath
                : null,
            };
          });

        // Collect YouTube video .txt files
        const videoFiles = allFiles
          .filter((file) => file.endsWith(".txt"))
          .map((file) => {
            const txtFilePath = path.join(entryPath, file);
            const videoData = parseVideoFile(txtFilePath);

            if (videoData) {
              return {
                type: "youtube",
                filename: file,
                videoId: videoData.videoId,
                url: videoData.url,
                infoPath: null, // YouTube videos use their title from YouTube
              };
            }
            return null;
          })
          .filter((item) => item !== null);

        // Combine images and videos
        const allMedia = [...images, ...videoFiles];

        if (allMedia.length > 0) {
          const folderTxtPath = `works/${category}/${entry.name}.txt`;

          // Use first image as thumbnail, or a placeholder for video-only folders
          let thumbnail = null;
          if (images.length > 0) {
            thumbnail = images[0].path;
          } else if (videoFiles.length > 0) {
            // Use YouTube thumbnail
            thumbnail = `https://img.youtube.com/vi/${videoFiles[0].videoId}/mqdefault.jpg`;
          }

          items.push({
            type: "folder",
            foldername: entry.name,
            title: entry.name.replace(/[-_]/g, " "),
            infoPath: fs.existsSync(folderTxtPath.replace("works/", "./works/"))
              ? folderTxtPath
              : null,
            images: allMedia,
            thumbnail: thumbnail,
          });
        }
      } else if (
        imageExtensions.test(entry.name) ||
        videoExtensions.test(entry.name) ||
        audioExtensions.test(entry.name)
      ) {
        // Single file work
        const filePath = `works/${category}/${entry.name}`;
        const txtPath = `works/${category}/${entry.name.replace(/\.[^/.]+$/, ".txt")}`;
        items.push({
          type: "image",
          filename: entry.name,
          path: filePath,
          title: entry.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          infoPath: fs.existsSync(txtPath.replace("works/", "./works/"))
            ? txtPath
            : null,
          thumbnail: filePath,
        });
      }
    });

    manifest[category] = items;
  } else {
    manifest[category] = [];
  }
});

fs.writeFileSync("works_manifest.json", JSON.stringify(manifest, null, 2));
console.log("Manifest generated successfully!");
