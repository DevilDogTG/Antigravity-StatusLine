#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// ANSI Color Helpers
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const BRIGHT_RED = '\x1b[91m';
const BRIGHT_GREEN = '\x1b[92m';
const BRIGHT_YELLOW = '\x1b[93m';
const BRIGHT_CYAN = '\x1b[96m';

function colorize(text, color, isBold = false) {
  return `${isBold ? BOLD : ''}${color}${text}${RESET}`;
}

function formatTokens(count) {
  if (count === undefined || count === null) return '0';
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

function formatSeconds(seconds) {
  if (seconds === undefined || seconds === null) return '';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d${remainingHours}h`;
}

function getGitStatus(cwd) {
  try {
    // try git branch --show-current first (works on empty repos)
    let branch = execSync('git branch --show-current', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 150
    }).toString().trim();
    
    if (!branch) {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 150
      }).toString().trim();
    }
    
    if (!branch) return null;
    
    // Check dirty status and file counts
    const status = execSync('git status --porcelain', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 150
    }).toString().trim();
    
    let staged = 0;
    let unstaged = 0;
    let untracked = 0;
    
    if (status) {
      const lines = status.split('\n');
      for (const line of lines) {
        if (line.length < 3) continue;
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        
        if (indexStatus === '?' && workTreeStatus === '?') {
          untracked++;
        } else {
          if (indexStatus !== ' ' && indexStatus !== '?') {
            staged++;
          }
          if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
            unstaged++;
          }
        }
      }
    }
    
    return {
      branch,
      staged,
      unstaged,
      untracked,
      isDirty: (staged + unstaged + untracked) > 0
    };
  } catch (err) {
    return null;
  }
}

function getAgyPid() {
  let curPid = process.pid;
  for (let i = 0; i < 5; i++) {
    try {
      const ppid = parseInt(execSync(`ps -o ppid= -p ${curPid}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10);
      if (!ppid || isNaN(ppid)) break;
      const cmd = execSync(`ps -o cmd= -p ${ppid}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (cmd.includes('agy')) {
        return ppid;
      }
      curPid = ppid;
    } catch (err) {
      break;
    }
  }
  return null;
}

function getBackgroundTasks(agyPid) {
  if (!agyPid) return [];
  try {
    const stdout = execSync(`ps -o pid,cmd --ppid ${agyPid} --no-headers`, {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    if (!stdout) return [];
    
    const lines = stdout.split('\n');
    const tasks = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const pid = parts[0];
      const cmd = parts.slice(1).join(' ');
      
      // Filter out statusline, ps, grep, and standard wrappers
      if (cmd.includes('statusline.js') || 
          cmd.includes('ps -o pid,cmd') || 
          cmd.includes('ps -fu') || 
          cmd.includes('grep') ||
          cmd.includes('bash -c ps') ||
          cmd.includes('test_ppid.js') ||
          cmd.includes('test_stdin.js')) {
        continue;
      }
      
      let cleanCmd = cmd;
      if (cmd.startsWith('/bin/sh -c') || cmd.startsWith('sh -c')) {
        const match = cmd.match(/-c\s+["']?(.*?)["']?$/);
        if (match && match[1]) {
          cleanCmd = match[1];
        }
      }
      
      // Shorten the command
      if (cleanCmd.length > 25) {
        cleanCmd = cleanCmd.substring(0, 22) + '...';
      }
      
      tasks.push(`${cleanCmd} (PID ${pid})`);
    }
    return tasks;
  } catch (err) {
    return [];
  }
}

function main() {
  let input = '';
  try {
    input = fs.readFileSync(0, 'utf-8');
  } catch (e) {
    // Ignore and proceed
  }

  if (!input) {
    console.log(colorize('● OFFLINE', GRAY, true));
    return;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    console.log(colorize('● STATE ERROR', BRIGHT_RED, true));
    return;
  }

  const {
    cwd,
    model,
    context_window,
    quota,
    agent_state,
    terminal_width = 120
  } = data;

  const separator = colorize(' │ ', GRAY);

  // === LINE 1: status, model, git status (working directory) ===
  const line1Parts = [];
  
  // State
  let stateStr = '';
  if (agent_state === 'working') {
    stateStr = colorize('● WORKING', BRIGHT_YELLOW, true);
  } else if (agent_state === 'idle') {
    stateStr = colorize('● IDLE', BRIGHT_GREEN, true);
  } else {
    stateStr = colorize(`● ${agent_state.toUpperCase()}`, BRIGHT_CYAN, true);
  }
  line1Parts.push(stateStr);

  // Model
  if (model && model.display_name) {
    let modelName = model.display_name
      .replace(/\s*\(medium\)/i, '')
      .replace(/\s*\(large\)/i, '')
      .replace(/\s*\(flash\)/i, ' Flash')
      .replace(/\s*\(pro\)/i, ' Pro');
    line1Parts.push(colorize(modelName, BRIGHT_CYAN, true));
  }

  // Git Status
  if (cwd) {
    const gitInfo = getGitStatus(cwd);
    if (gitInfo) {
      let gitStr = `⌥ ${gitInfo.branch}`;
      if (gitInfo.isDirty) {
        const changes = [];
        if (gitInfo.staged > 0) {
          changes.push(colorize(`+${gitInfo.staged}`, BRIGHT_GREEN));
        }
        if (gitInfo.unstaged > 0) {
          changes.push(colorize(`~${gitInfo.unstaged}`, BRIGHT_YELLOW));
        }
        if (gitInfo.untracked > 0) {
          changes.push(colorize(`?${gitInfo.untracked}`, GRAY));
        }
        gitStr += ` [${changes.join(' ')}]`;
        line1Parts.push(colorize(gitStr, BRIGHT_YELLOW, true));
      } else {
        line1Parts.push(colorize(gitStr, BRIGHT_GREEN, true));
      }
    }
  }

  // Working Directory (CWD)
  if (cwd) {
    let displayCwd = cwd.replace('/home/devildogtg', '~');
    // Shorten if extremely long
    if (displayCwd.length > 50 && terminal_width < 120) {
      displayCwd = displayCwd.substring(0, 20) + '...' + displayCwd.substring(displayCwd.length - 25);
    }
    line1Parts.push(colorize(`Cwd: ${displayCwd}`, GRAY));
  }

  const line1 = line1Parts.join(separator);

  // === LINE 2: context and quota ===
  const line2Parts = [];
  
  // Context
  if (context_window) {
    const percentage = context_window.used_percentage || 0;
    let barColor = BRIGHT_GREEN;
    if (percentage >= 80) barColor = BRIGHT_RED;
    else if (percentage >= 50) barColor = BRIGHT_YELLOW;

    const barLength = terminal_width > 120 ? 10 : 5;
    const filledLength = Math.round((percentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    const barStr = `[${colorize(filledBar, barColor)}${colorize(emptyBar, GRAY)}] `;
    line2Parts.push(`Ctx: ${barStr}${colorize(percentage.toFixed(1) + '%', barColor, percentage >= 80)}`);
  }

  // Quota
  if (quota) {
    const quotaParts = [];
    const keysToCheck = ['gemini-5h', 'gemini-weekly', '3p-5h', '3p-weekly'];
    
    keysToCheck.forEach(key => {
      const q = quota[key];
      if (q) {
        const frac = q.remaining_fraction;
        if (frac === 1 && terminal_width < 130 && key.includes('3p')) return;
        
        let qColor = BRIGHT_GREEN;
        if (frac <= 0.2) qColor = BRIGHT_RED;
        else if (frac <= 0.5) qColor = BRIGHT_YELLOW;
        
        const shortKey = key.replace('gemini-', '').replace('3p-', '3p:').replace('weekly', 'Wk');
        let val = `${shortKey}:${colorize(Math.round(frac * 100) + '%', qColor)}`;
        
        if (frac < 1.0 && q.reset_in_seconds) {
          val += `(${formatSeconds(q.reset_in_seconds)})`;
        }
        quotaParts.push(val);
      }
    });

    if (quotaParts.length > 0) {
      line2Parts.push(`Quota: ${quotaParts.join(' ')}`);
    }
  }

  const line2 = line2Parts.join(separator);

  // === LINE 3: token info ===
  const line3Parts = [];
  
  // Current Step
  if (context_window && context_window.current_usage) {
    const cur = context_window.current_usage;
    const inTokens = formatTokens(cur.input_tokens);
    const outTokens = formatTokens(cur.output_tokens);
    const cachedRead = formatTokens(cur.cache_read_input_tokens || 0);
    const cachedCreated = formatTokens(cur.cache_creation_input_tokens || 0);

    let cacheInfo = '';
    if ((cur.cache_read_input_tokens || 0) > 0 || (cur.cache_creation_input_tokens || 0) > 0) {
      const cParts = [];
      if ((cur.cache_read_input_tokens || 0) > 0) cParts.push(`💾${cachedRead}`);
      if ((cur.cache_creation_input_tokens || 0) > 0) cParts.push(`🆕${cachedCreated}`);
      cacheInfo = ` (${cParts.join('+')})`;
    }

    line3Parts.push(`Step: 📥${inTokens} 📤${outTokens}${cacheInfo}`);
  }

  // Total Session
  if (context_window) {
    const totalIn = formatTokens(context_window.total_input_tokens);
    const totalOut = formatTokens(context_window.total_output_tokens);
    line3Parts.push(`Total: 📥${totalIn} 📤${totalOut}`);
  }

  const line3 = line3Parts.join(separator);

  // === LINE 4: Background tasks ===
  const agyPid = getAgyPid();
  const bgTasks = getBackgroundTasks(agyPid);
  let line4 = '';
  
  if (bgTasks.length > 0) {
    line4 = `${colorize('Background Tasks:', BRIGHT_YELLOW)} ${bgTasks.join(', ')}`;
  } else {
    line4 = `${colorize('Background Tasks:', GRAY)} none`;
  }

  // Print all 4 lines
  console.log(`${line1}\n${line2}\n${line3}\n${line4}`);
}

main();
