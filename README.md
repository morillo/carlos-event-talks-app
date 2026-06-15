# BigQuery Release Notes Hub 🚀

An interactive web application designed to track, filter, search, and share Google BigQuery release notes. The application aggregates updates from the official Google Cloud feed, parses grouped daily summaries into discrete, categorized cards (e.g., Features, Resolved Issues, Deprecations), caches feed content to improve performance, and provides a custom composer for sharing updates on X (formerly Twitter).

---

## ✨ Features

- **Granular Parsing**: Splices daily-grouped RSS entries into standalone, card-based release notes categorized by type.
- **Local Caching**: Implements a 5-minute server-side in-memory cache to prevent redundant HTTP requests to Google Cloud servers.
- **Smart Force-Refresh**: Includes a manual refresh feature that bypasses the cache to fetch real-time updates directly from Google.
- **Dynamic Client-Side Filters**:
  - Filter notes instantly by category type (*Feature*, *Deprecation*, *Resolved*, *Changed*, *Other*).
  - Search title, type, and content details in real-time with input debouncing.
  - Sort results chronologically (Newest First vs. Oldest First).
- **Tweet Composer & Real-Time Preview**:
  - Select single or multiple updates to draft sharing content.
  - Generates X-compliant tweets with customizable inclusions for hashtags and source links.
  - Enforces character limit (280-char) and uses smart text truncation.
  - Visualizes layouts in a live mock-preview of the post on X.
- **Copy to Clipboard**: Quick copying of release details formatted as markdown-compatible plain text.

---

## 📁 Directory Structure

```text
bq-releases-notes/
├── app.py                  # Flask server application (feed parser & JSON API)
├── requirements.txt        # Python package dependencies
├── templates/
│   └── index.html          # Main SPA frontend layout structure
└── static/
    ├── css/
    │   └── style.css       # Premium visual styling (dark mode, glassmorphism, animations)
    └── js/
        └── main.js         # Frontend controller (state management, API handler, filtering)
```

---

## 🛠️ Installation & Setup

Follow these steps to run the application locally on your machine:

### Prerequisites
- Python 3.8 or higher

### 1. Clone & Navigate
Navigate to the project directory:
```bash
cd bq-releases-notes
```

### 2. Set Up Virtual Environment
Create and activate a virtual environment:
```bash
# On macOS/Linux
python3 -m venv .venv
source .venv/bin/activate

# On Windows
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install Dependencies
Install the required packages using pip:
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```
By default, the application will be hosted locally at: [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## ⚙️ Technical Details

### Backend Feed Parsing
The server [app.py](file:///Users/carlosmorillo/Documents/agy-cli-projects/bq-releases-notes/app.py) downloads the feed and uses Python's `xml.etree.ElementTree` parser to extract entries. Because Google packs multiple updates under a single day's date, a regular expression pattern is run against the HTML content:
```python
pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=(?:<h3>|$))', re.DOTALL | re.IGNORECASE)
```
This segments the entry into separate items, each associated with its respective type heading (e.g. `Feature`, `Resolved`).

### Frontend Controller
The UI in [main.js](file:///Users/carlosmorillo/Documents/agy-cli-projects/bq-releases-notes/static/js/main.js) maintains a centralized `state` object. Filtering and sorting actions are applied directly to the in-memory array rather than issuing new network requests, resulting in instant responsiveness.

---

## 🛡️ License
Distributed under the MIT License. See the project repository for details.
