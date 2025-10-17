# Aula Login Session Manager - Chrome Extension

## Project Overview

This Chrome browser extension monitors and manages PHPSESSID cookies for Aula.dk, synchronizing them with a backend storage system via REST API.

## Purpose

The extension captures the PHPSESSID cookie value used by www.aula.dk when making API requests, displays it to the user, and allows saving/syncing it with a backend persistence layer.

## Key Features

1. **Automatic Session Detection**: Polls the browser every 5 seconds to detect PHPSESSID cookie
2. **Backend Synchronization**: Retrieves and saves session IDs to configurable REST endpoints
3. **Auto-Update Mode**: Automatically compares and updates backend when session changes
4. **Visual Status Indicator**: Shows if browser and backend sessions match
5. **Manual Control**: Buttons for manual refresh and save operations
6. **Settings Page**: Configure API endpoints and auto-update behavior

## Project Structure

```
AulaLoginBrowserExtension/
├── manifest.json                                    # Chrome Extension Manifest v3
├── src/
│   ├── background/
│   │   └── service-worker-standalone.js            # Background worker (ACTIVE)
│   ├── content/
│   │   └── content-script.js                       # Runs on aula.dk pages
│   ├── popup/
│   │   ├── popup.html                              # Extension popup UI
│   │   ├── popup.css                               # Popup styles
│   │   └── popup-standalone.js                     # Popup logic (ACTIVE)
│   ├── options/
│   │   ├── options.html                            # Settings page UI
│   │   ├── options.css                             # Settings styles
│   │   └── options-standalone.js                   # Settings logic (ACTIVE)
│   └── types/
│       └── index.ts                                 # TypeScript type definitions
├── icons/
│   ├── icon.svg                                     # Source SVG icon
│   └── README.txt                                   # Instructions for creating PNG icons
├── package.json
├── tsconfig.json
└── README.md
```

**Note**: The extension uses standalone JavaScript files (no ES6 module imports) for compatibility with Chrome Extension Manifest v3. TypeScript files in `src/` are kept for reference but are not compiled or used.

## How It Works

### 1. Session Detection

**Background Service Worker** (`service-worker-standalone.js`):
- Polls `chrome.cookies` API every 5 seconds
- Checks for PHPSESSID cookie at `https://www.aula.dk/api` (path-specific)
- Uses triple-fallback approach:
  1. Check `/api` path (where cookie is set)
  2. Check root path (fallback)
  3. Get all `.aula.dk` cookies (guaranteed)
- Saves detected session to `chrome.storage.local`

**Content Script** (`content-script.js`):
- Runs on all `*.aula.dk` pages
- Attempts to read `document.cookie` (won't work if HttpOnly)
- Sends detected sessions to background worker
- Monitors for changes every 2 seconds

### 2. Cookie Path Specificity

The PHPSESSID cookie has these properties:
- **Path**: `/api` (only included in requests to `/api/*` endpoints)
- **HttpOnly**: `true` (cannot be read by `document.cookie`)
- **Domain**: `.aula.dk`

The extension uses `chrome.cookies.get()` with the correct path to detect it.

### 3. Backend Communication

**API Endpoints**:

**GET Endpoint** (Retrieve stored session):
```
URL: <configured-retrieve-endpoint>
Response: {
  "Id": "string",
  "sessionId": "string",
  "created": "ISO 8601 date string",
  "lastUpdated": "ISO 8601 date string",
  "ttl": number
}
```

**POST Endpoint** (Save session):
```
URL: <configured-save-endpoint>
Request Body: {
  "sessionId": "string"
}
Response: {
  "Id": "string",
  "sessionId": "string",
  "created": "ISO 8601 date string",
  "lastUpdated": "ISO 8601 date string",
  "ttl": number
}
```

### 4. Auto-Update Logic

When enabled, the background worker:
1. Detects current browser PHPSESSID
2. Fetches stored session from backend
3. Compares values
4. If different, saves current session to backend
5. Updates local cache

### 5. User Interface

**Popup** (`popup.html`):
- Current Browser Session: Displays PHPSESSID from browser
- Stored Backend Session: Displays PHPSESSID from backend
- Created: Timestamp when session was first created
- Last Updated: Timestamp of last backend update
- TTL: Time-to-live in seconds
- Status Indicator: Visual match/mismatch indicator
- Buttons: Refresh, Save to Backend, Settings

**Settings Page** (`options.html`):
- Auto-Update Toggle: Enable/disable automatic synchronization
- Retrieve Endpoint: URL for GET request
- Save Endpoint: URL for POST request
- Test Connection: Verify retrieve endpoint works
- Save Settings: Persist configuration

## Configuration Settings

Stored in `chrome.storage.sync`:

```javascript
{
  autoUpdate: boolean,           // Auto-sync with backend
  retrieveEndpoint: string,      // GET endpoint URL
  saveEndpoint: string,          // POST endpoint URL
  authHeaderName: string,        // Custom HTTP header name (default: 'X-aulasession-authenticate')
  authHeaderValue: string        // Value for authentication header
}
```

### Authentication

The extension supports custom HTTP header authentication for securing backend API communication. Configure a header name and value in the Settings page:

- **Header Name** (default: `X-aulasession-authenticate`): The HTTP header name to send with each request
- **Header Value**: The authentication token or secret value

If `authHeaderName` is empty or blank, no authentication header is sent with requests. This allows flexible configuration:
- **No authentication**: Leave header name blank
- **Custom authentication**: Set both header name and value

The authentication header is included in all GET and POST requests to the configured endpoints. Header values are stored securely in `chrome.storage.sync` which is encrypted by Chrome.

## Storage

**chrome.storage.local** (ephemeral, cleared on logout):
- `currentSessionId`: Current browser PHPSESSID
- `storedSession`: Cached backend session object
- `lastChecked`: Last poll timestamp

**chrome.storage.sync** (synced across devices):
- `aulaConfig`: Extension configuration

## Permissions Required

```json
{
  "permissions": [
    "storage",      // Save config and cache
    "cookies",      // Read PHPSESSID cookie
    "webRequest",   // Monitor API requests (legacy)
    "activeTab"     // Interact with active tab
  ],
  "host_permissions": [
    "*://*.aula.dk/*"  // Access aula.dk domain
  ]
}
```

## Message Types

Communication between popup, content script, and background worker:

```javascript
{
  GET_CURRENT_SESSION,   // Popup → Background: Get browser session
  GET_STORED_SESSION,    // Popup → Background: Fetch from backend
  SAVE_SESSION,          // Popup → Background: Save to backend
  UPDATE_CONFIG,         // Options → Background: Update settings
  GET_CONFIG,            // Popup/Options → Background: Get settings
  SESSION_DETECTED       // Content → Background: Session found in page
}
```

## Installation

1. **Clone repository**:
   ```bash
   git clone <repository-url>
   cd AulaLoginBrowserExtension
   ```

2. **Install dependencies** (optional, for development):
   ```bash
   npm install
   ```

3. **Load extension**:
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `AulaLoginBrowserExtension` folder

4. **Configure**:
   - Click extension icon → Settings
   - Enter API endpoints
   - Enable auto-update if desired
   - Test connection

## Usage

1. **Navigate to www.aula.dk** and log in
2. **Extension automatically detects** PHPSESSID within 5 seconds
3. **Click extension icon** to view:
   - Current session ID
   - Backend stored session ID
   - Status (match/mismatch)
4. **Manually save** via "Save to Backend" button
5. **Auto-sync** if enabled in settings

## Technical Details

### Why Standalone JavaScript?

Chrome Extension Manifest v3 service workers have issues with ES6 module imports. The extension uses standalone JavaScript files with all dependencies inlined to ensure:
- Reliable loading without import errors
- Immediate execution without module resolution
- Better debugging with visible console logs

### Session Detection Strategy

1. **Primary**: Background polling with `chrome.cookies.get()` every 5 seconds
   - Works for HttpOnly cookies
   - Path-aware (checks `/api` path)
   - Most reliable method

2. **Secondary**: Content script reading `document.cookie`
   - Only works for non-HttpOnly cookies
   - Provides immediate detection on page load
   - Sends to background via messaging

3. **Fallback**: Direct API check when popup opens
   - Ensures popup always has latest value
   - Falls back to cached storage if API unavailable

### Architecture Flow

```
┌─────────────────────────────────────────────────────────┐
│ www.aula.dk Page                                         │
│ ┌─────────────────┐                                      │
│ │ Content Script  │──────────────┐                       │
│ │ (optional)      │              │ SESSION_DETECTED      │
│ └─────────────────┘              │                       │
└──────────────────────────────────┼───────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│ Background Service Worker                                │
│ ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│ │ Polling      │  │ Message      │  │ Storage         │ │
│ │ (every 5s)   │  │ Handler      │  │ Manager         │ │
│ │              │  │              │  │                 │ │
│ │ chrome.      │  │ GET/POST to  │  │ chrome.storage  │ │
│ │ cookies.get()│  │ Backend API  │  │ .local/.sync    │ │
│ └──────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────────────────────────────────────┘
                           │
                           │ Messages
                           ▼
┌──────────────────────────────────────────────────────────┐
│ Popup / Options                                          │
│ ┌──────────────────────────────────────────────────┐    │
│ │ Display: Current Session, Stored Session         │    │
│ │ Actions: Refresh, Save, Settings                 │    │
│ │ Config:  Endpoints, Auto-update                  │    │
│ └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Session not detected
- Ensure you're logged into www.aula.dk
- Check service worker console (`chrome://extensions/` → "service worker")
- Should see: `✓ Session poll found PHPSESSID: <value>`
- If not found, run: `chrome.cookies.get({url: 'https://www.aula.dk/api', name: 'PHPSESSID'}, console.log)`

### Backend sync fails
- Verify endpoints are correct in settings
- Check CORS configuration on backend
- Use "Test Connection" button
- Check service worker console for error messages

### No console logs
- Extension may not be loaded properly
- Reload extension: `chrome://extensions/` → Reload icon
- Check for errors on extensions page
- Service worker should show startup messages

## Files Reference

**Active (Used by Extension)**:
- `src/background/service-worker-standalone.js` - Background worker
- `src/popup/popup-standalone.js` - Popup logic
- `src/options/options-standalone.js` - Settings logic
- `src/content/content-script.js` - Content script
- `manifest.json` - Extension manifest

**Reference Only**:
- `src/background/service-worker.ts` - TypeScript source (not compiled)
- `src/popup/popup.ts` - TypeScript source (not compiled)
- `src/options/options.ts` - TypeScript source (not compiled)
- `src/types/index.ts` - Type definitions
- `src/services/*.ts` - Service modules (not used)

## Development Notes

- Extension does NOT use TypeScript compilation
- All active scripts are plain JavaScript
- No build step required (npm build is optional)
- Changes to `.js` files require extension reload
- Service worker console shows all polling activity
- Popup console (right-click → Inspect) shows UI activity

## Security Considerations

- PHPSESSID is session-sensitive data
- Only use HTTPS endpoints
- Backend should have proper authentication
- Extension storage is encrypted by Chrome
- Session IDs are never sent to third parties
- Content script has limited page access

## Console Logging Policy

The extension uses minimal console logging to avoid pollution. Here's the logging policy:

### Content Script (`content-script.js`)
**KEEP**:
- Script loaded/initialized messages (useful for debugging)
- Found PHPSESSID in document.cookie (indicates if cookie becomes non-HttpOnly)
- Critical errors (chrome.runtime.lastError)

**REMOVED** (to avoid noise):
- "PHPSESSID not found in cookies" - HttpOnly cookie will never be found in document.cookie
- "No session ID to send" - Redundant information
- "Session ID changed" messages - Unlikely to occur since HttpOnly
- "Popup requested session" - Too verbose

### Background Service Worker (`service-worker-standalone.js`)
**KEEP**:
- Service worker startup/initialization messages
- `✓ Session poll found PHPSESSID: <value>` - Indicates successful detection
- `✓ Received session from content script` - Shows content script communication
- Auto-update activity logs (when session differs and update occurs)
- All error logs (console.error)

**REMOVED** (to avoid noise):
- `✗ Session poll: PHPSESSID not found` - Noisy when logged out
- "Saving session ID to storage" / "Session ID saved successfully" - Too verbose
- "Fetching stored session from" / "Received stored session" - Too verbose
- "Posting session to" / "Session saved to backend" - Too verbose
- "Received message" / "Sending response" - Too verbose
- "Getting current session" / "Getting config" - Too verbose per message handler
- "Checking if session needs update" - Too verbose
- "Session IDs match, no update needed" - Only log when update actually occurs

### Popup (`popup-standalone.js`)
**KEEP**:
- All error logs (console.error)

**REMOVED** (to avoid noise):
- "Settings button clicked" - Debug log from troubleshooting
- "DOM loaded, initializing popup" - Too verbose
- "Initializing popup" / "Popup initialized successfully" - Too verbose
- "Requesting current session from background" - Too verbose
- "Response from background" - Too verbose
- "Current session ID set to" - Too verbose
- "Retrieve endpoint not configured" - Silently handled

### Rationale
- Errors are always logged (critical for debugging)
- Success events that occur frequently (polling, message passing) are suppressed
- Important state changes (session found, auto-update) are logged
- Startup/initialization messages are kept for debugging extension load issues

## License

MIT
