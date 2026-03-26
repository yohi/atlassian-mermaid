# Atlantean Mermaid (Bitbucket & Confluence)

Renders Mermaid diagram blocks in Bitbucket pull request descriptions/comments and Confluence pages.

## Features
- **Bitbucket Support:** Detects code blocks with `mermaid` language or keywords in PR descriptions, comments, and READMEs.
- **Confluence Support:** Detects Code Block macros in Confluence Cloud.
- **Dynamic Rendering:** Automatically re-renders diagrams when the page content changes (via MutationObserver).
- **Code Toggle:** Provides a button to toggle between the rendered diagram and the original Mermaid source code.
- **Instant Hide:** Hides raw code blocks immediately upon detection to ensure a smooth user experience.

## Installation (Local Development)
1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right.
4. Click "Load unpacked" and select the root directory of this repository.

## Project Structure
- `manifest.json`: Extension configuration and permissions.
- `content-script.js`: Core logic for detection, extraction, and rendering.
- `styles.css`: Styles for loaders, error badges, and toggle buttons.
- `vendor/`: Includes `mermaid.min.js` (Mermaid library).
- `icons/`: Extension icons.

## Credits
This extension is based on an existing Bitbucket Mermaid extension, reverse-engineered and enhanced to support Confluence.
- Mermaid library: [https://mermaid.js.org/](https://mermaid.js.org/)
