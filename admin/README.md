# Portfolio Admin Tool

A local web interface for managing your portfolio works.

## Features

- View all works in a searchable table
- Add new works with file upload
- Edit existing work metadata
- Delete works
- Filter by year, type, or search
- Build & deploy with one click
- Real-time preview

## Setup

### 1. Install Dependencies

```bash
cd admin
npm install express cors multer
```

Or use the startup script which installs automatically.

### 2. Start the Server

```bash
./start.sh
```

Or manually:

```bash
node server.js
```

### 3. Open Admin Interface

Open your browser to:
```
http://localhost:3001/admin
```

Or simply open `admin/index.html` in your browser (server must be running).

## Usage

### Adding a New Work

1. Click "+ Add New Work"
2. Fill in the form:
   - **Title**: Display name
   - **Year**: 4-digit year (creates folder: works/YEAR/title/)
   - **Client**: Client or studio name
   - **Contribution**: Your role (Environment TD, Matte Painting, etc.)
   - **Style**: Art style/category
   - **Type**: Image or Video
   - **Image File**: Upload your work image
   - **Featured**: Check to show in Portfolio section

3. Click "Save Work"

### For YouTube Videos

1. Select Type: "Video"
2. Enter YouTube Video ID (from URL: `youtube.com/watch?v=VIDEO_ID`)
3. Upload a thumbnail image
4. Save

### Editing Works

1. Click "Edit" button on any work
2. Modify fields as needed
3. Optionally upload new image
4. Save

### Deleting Works

1. Click "Delete" button
2. Confirm deletion
3. The entire project folder will be removed

### Building Data

After making changes:

1. Click "Build & Deploy" button
2. This runs `build-data.js` and generates `data.json`
3. Refresh your main portfolio site to see changes

## File Structure

```
admin/
├── index.html       # Admin interface
├── admin.css        # Styling
├── admin.js         # Frontend logic
├── server.js        # Backend API
├── start.sh         # Startup script
└── README.md        # This file
```

## API Endpoints

The server runs on port 3001 and provides:

- `GET /works` - List all works
- `POST /works` - Add new work (with file upload)
- `PUT /works/:id` - Update work
- `DELETE /works/:id` - Delete work
- `POST /build` - Run build-data.js

## Tips

1. **Search**: Use the search box to filter by title, client, or contribution
2. **Filters**: Use dropdowns to filter by year or type
3. **Consistent naming**: Use consistent contribution names for better organization
4. **Image size**: Optimize images before uploading (aim for <2MB)
5. **Build often**: Click "Build & Deploy" after each change to update data.json

## Troubleshooting

**Server won't start:**
- Check if Node.js is installed: `node --version`
- Install dependencies: `npm install express cors multer`
- Check if port 3001 is available

**Can't see works:**
- Make sure works are in `works/YEAR/project-name/` structure
- Check that each project has `meta.json` and an image file
- Click "Build & Deploy" to regenerate data.json

**Changes not showing:**
- Click "Build & Deploy" in admin interface
- Refresh your main portfolio site
- Clear browser cache if needed

## Security Note

This admin tool is meant for LOCAL USE ONLY. It has no authentication and should never be exposed to the internet or deployed publicly.
