const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const WORKS_DIR = path.join(__dirname, '..', 'works');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/tmp'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();
}

function scanAllWorks() {
    const works = [];
    let id = 1;

    if (!fs.existsSync(WORKS_DIR)) return works;

    const topLevel = fs.readdirSync(WORKS_DIR)
        .filter(item => {
            const itemPath = path.join(WORKS_DIR, item);
            return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
        });

    topLevel.forEach(folder => {
        const folderPath = path.join(WORKS_DIR, folder);
        const isYearFolder = /^\d{4}$/.test(folder);
        
        const subItems = fs.readdirSync(folderPath)
            .filter(item => {
                const itemPath = path.join(folderPath, item);
                return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
            });

        subItems.forEach(projectFolder => {
            const projectPath = path.join(folderPath, projectFolder);
            const metaPath = path.join(projectPath, 'meta.json');

            if (fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    const yearMatch = projectFolder.match(/^(\d{4})\s*-\s*/);
                    const year = isYearFolder ? folder : (yearMatch ? yearMatch[1] : meta.date || '2024');

                    works.push({
                        id: id++,
                        ...meta,
                        year,
                        folder: projectFolder,
                        parentFolder: folder,
                        path: path.relative(path.join(__dirname, '..'), projectPath)
                    });
                } catch (error) {
                    console.error('Error reading', metaPath, error.message);
                }
            }
        });
    });

    return works;
}
