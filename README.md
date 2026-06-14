# Antigravity CLI Custom Status Line

A beautiful, custom status line extension for the **Antigravity CLI** that provides real-time tracking of token usage, API quotas, context window capacity, active AI model, and Git branch details.

---

## Preview

When active, your terminal status line will look like this:

```ansi
● WORKING │ Gemini 3.5 Flash │ ⌥ main [?4] │ Cwd: ~/repository/DevDogs/Antigravity-StatusLine
Ctx: [█░░░░░░░░░] 6.6% │ Quota: 5h:100% Wk:100%
Step: 📥2.9k 📤156 (💾65.1k) │ Total: 📥69.4k 📤28k
Background Tasks: none
```

---

## Key Features

1. **Active AI Model Display**: Displays a clean representation of the currently selected model (e.g., `Gemini 3.5 Flash` or `Gemini 1.5 Pro`).
2. **Interactive Agent State Indicator**: Displays a colored dot (`●`) representing the current state of the agent:
   - `● WORKING` in bright yellow/orange when running tools or processing.
   - `● IDLE` in bright green when waiting for user input.
3. **Current Git Branch**: Detects if your workspace is in a Git repository and displays the current branch name (e.g. `⌥ main`), keeping you aware of your code context.
4. **Context Window Progress Bar & Percentage**: Shows what percentage of the model's context window is consumed, with an adaptive visual progress bar that changes color (green ➔ yellow ➔ red) as it approaches limits.
5. **Token Usage (Current Step)**:
   - 📥 **Input tokens**
   - 📤 **Output tokens**
   - 💾 **Cached tokens read** (if any, represented as `(💾<count>)`)
   - 🆕 **Cached tokens created** (if any, represented as `(🆕<count>)`)
6. **Cumulative Session Token Usage**: Tracks the total input and output tokens consumed across the entire active conversation.
7. **Quota Limit & Reset Monitoring**:
   - Tracks standard and third-party limits (e.g., `5h` and weekly `Wk` quotas).
   - Color-coded warnings (green ➔ yellow ➔ red) when quotas run low.
   - Dynamic countdown timer indicating time remaining until the next reset window (e.g., `5h:80%(2h15m)`).
8. **Responsive Layout**: Detects the terminal width and automatically hides less critical components (like cumulative totals or progress bars) if the terminal is resized smaller.

---

## Installation & Configuration

1. **Ensure Node.js is installed** (v18+ recommended).
2. **Clone the repository** to a persistent location on your machine.
3. **Run the installation script**:
   ```bash
   npm run setup
   ```
   This script is cross-platform (works on both Windows and Linux/macOS) and will:
   - Detect and backup your existing `settings.json` file.
   - Configure the `statusLine` command path automatically to point to your clone of `statusline.js`.
   - Make `statusline.js` executable (on Unix-like systems).
4. **Reload**: If the Antigravity CLI is already running, type `/statusline on` to activate, or restart the CLI session.

---

## Development & Testing

You can simulate how the status line renders by piping a captured state JSON file into the script:

```bash
npm run test
# Or:
cat stdin_capture.json | ./statusline.js
```
