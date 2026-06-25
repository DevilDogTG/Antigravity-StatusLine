#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Starting Antigravity Status Line setup...');

// 1. Resolve absolute path of statusline.js
const statuslinePath = path.resolve(__dirname, 'statusline.js');
if (!fs.existsSync(statuslinePath)) {
  console.error(`Error: Could not find statusline.js at ${statuslinePath}`);
  process.exit(1);
}

// 2. Locate the Antigravity settings directory & file
const homeDir = os.homedir();
const settingsDir = path.join(homeDir, '.gemini', 'antigravity-cli');
const settingsPath = path.join(settingsDir, 'settings.json');
const backupPath = path.join(settingsDir, 'settings.json.bak');

try {
  // Ensure the settings directory exists
  if (!fs.existsSync(settingsDir)) {
    console.log(`Creating settings directory: ${settingsDir}`);
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  let config = {};

  // Check if settings.json exists
  if (fs.existsSync(settingsPath)) {
    console.log(`Found existing settings at ${settingsPath}`);
    const fileContent = fs.readFileSync(settingsPath, 'utf8').trim();
    
    // Backup the existing file
    fs.writeFileSync(backupPath, fileContent, 'utf8');
    console.log(`Backup created at ${backupPath}`);

    if (fileContent) {
      try {
        config = JSON.parse(fileContent);
      } catch (parseErr) {
        console.warn('Warning: Could not parse existing settings.json. Starting with a fresh config.');
      }
    }
  } else {
    console.log(`No existing settings file found. Creating a new one at ${settingsPath}`);
  }

  // 3. Update the statusLine configuration
  const isWindows = os.platform() === 'win32';
  // On Windows, executing a .js file directly triggers the default file association (e.g. editor).
  // We prefix the command with 'node' to execute it correctly.
  const command = isWindows ? `node ${statuslinePath}` : statuslinePath;

  // Read optional custom refresh interval from command line argument, default to 60 seconds
  let refreshInterval = 60;
  if (process.argv[2]) {
    const val = parseInt(process.argv[2], 10);
    if (!isNaN(val) && val > 0) {
      refreshInterval = val;
    }
  }

  config.statusLine = {
    type: 'command',
    command: command,
    enabled: true,
    refreshInterval: refreshInterval
  };

  // Write the updated configuration back
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`✓ settings.json updated successfully with refreshInterval: ${refreshInterval}s.`);

  // 4. Handle executable permissions on Unix-like systems
  if (!isWindows) {
    try {
      fs.chmodSync(statuslinePath, '755');
      console.log('✓ Made statusline.js executable (chmod +x).');
    } catch (chmodErr) {
      console.warn(`Warning: Failed to set executable permissions on statusline.js. You may need to run 'chmod +x ${statuslinePath}' manually.`);
    }
  }

  console.log('\nSetup completed successfully! 🎉');
  console.log('To activate or reload the status line, run `/statusline on` in the Antigravity CLI, or restart your session.');

} catch (err) {
  console.error('An error occurred during setup:', err.message);
  process.exit(1);
}
