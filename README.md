# Universal Queue

A Chrome extension and web application for managing your watch queue across multiple streaming services.

## Features

- Add movies and TV episodes to your queue from various streaming services
- Drag and drop reordering of your watchlist
- Automatic detection of video completion
- Smart queue management across different streaming platforms

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Build the Chrome extension:
```bash
npm run build:extension
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory

## Project Structure

- `/src` - Source code
  - `/common` - Shared code between extension and web app
  - `/extension` - Chrome extension specific code
  - `/web` - React web application code
- `/public` - Static assets
- `/scripts` - Build and utility scripts 