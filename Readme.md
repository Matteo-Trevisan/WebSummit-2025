# WebSummit 2025 - Interactive Event Timeline

This project provides an interactive and user-friendly timeline for all official events at WebSummit 2025. Built to offer a clearer, more organized view of the conference schedule, it allows attendees to easily browse, filter, and explore talks, masterclasses, and meetups.

**[➡️ View the Live Demo Here]()**

---

## ✨ Features

*   **Interactive Timeline:** Easily pan and zoom through the entire 3-day conference schedule.
*   **Grouped by Location:** Events are neatly organized by their stage or physical location, with a logical sorting order (e.g., Centre Stage first).
*   **Filter by Track:** Instantly highlight all events belonging to a specific track (like "SaaS Summit", "AI Summit", etc.) using the dropdown menu.
*   **Detailed Event Modal:** Click on any event to see its full description, exact times, and a list of speakers.
*   **Speaker & Location Links:** Directly link to official speaker profiles and venue maps on the WebSummit website.
*   **Live Indicator:** A red line shows you the current time, so you can see what's happening *now*.
*   **Responsive Design:** Fully functional on both desktop and mobile browsers.

## 🛠️ Tech Stack

*   **Frontend:** HTML5, JavaScript (ES6+)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Timeline Visualization:** [vis.js Timeline](https://visjs.github.io/vis-timeline/docs/timeline/)
*   **Date/Time Handling:** [Day.js](https://day.js.org/)

## ⚙️ How It Works

The application is a single-page app that runs entirely in the browser.

1.  On page load, it fetches the complete event schedule from the `websummit_schedule.json` file.
2.  The JSON data is processed, parsed, and formatted into `items` (events) and `groups` (locations) compatible with vis.js.
3.  The vis.js library then renders the interactive timeline.
4.  All filtering and event detail displays are handled client-side with JavaScript.

## 🚀 How to Use

No build step is required. Simply open the `index.html` file in your web browser. For the best experience (to avoid potential CORS issues with `fetch`), it's recommended to use a simple local web server.

If you have Python installed:
```bash
# From the /website directory
python3 -m http.server
```
Then navigate to `http://localhost:8000` in your browser.