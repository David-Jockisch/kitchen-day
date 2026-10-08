# Kitchen Day
An offline, phone-friendly daily planner for school kitchen work. No build tools, subscriptions, database server, or accounts required.

## GitHub Pages setup
1. Put these files in the repository root on `main`.
2. Repository **Settings → Pages → Deploy from a branch → main → / (root) → Save**.
3. Open the HTTPS Pages URL in Safari, then **Share → Add to Home Screen**. Open once online and allow initial offline installation to finish.

## Using the planner
- Opens to today. Use arrows or the date picker to plan ahead.
- Add dated tasks with **Do on** and optional **Needed for**. Example: do October 5, needed October 6. October 5 shows the work; October 6 shows its completion in prep status.
- Both views update the same task. Unfinished earlier dated tasks remain available in an expandable section.
- Repeating routines have selected weekdays and a start date. Each date has independent completion. Editing versions a routine from the chosen date forward; past days retain old wording. Changing from an earlier date replaces later scheduled versions. Stopping a routine preserves earlier history.
- Settings can skip routines for a date, export/restore backups, request persistent storage, and remove completed history older than a year. Old routine checks removed by cleanup will appear unchecked if you revisit those dates.
- Starter weekday routines: turn on lights, unlock refrigerators/freezers, check and record temperatures. Edit these to fit your process.

## Data and limits
IndexedDB stores everything in this browser on this device. Different devices, browsers, and website origins do not share data. No task data is uploaded. Clearing website data, eviction, or losing the phone can lose data. Export backups regularly to Files/iCloud Drive. Restore replaces current records and validates the backup. No scheduled notification alerts in v1.

The initial service worker caches the app for offline use. For future code updates increment CACHE in sw.js; close all open app windows and reopen after the updated worker installs. User records are separate from cached app files.

## Development
Run `python3 -m http.server 8000` in this directory and open localhost:8000. Run model tests with `node --test tests/model.test.mjs`. Static relative URLs support GitHub Pages project subpaths. No external fonts, scripts, or analytics.
