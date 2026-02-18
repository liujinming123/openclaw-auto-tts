/**
 * Auto TTS Hook Handler
 *
 * Plays TTS audio when agent sends messages back to user.
 * Self-contained - no external imports needed.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);

const HOOK_KEY = "auto-tts";
const HOOK_SCRIPT = `${process.env.HOME}/.openclaw/hooks/auto-tts/auto-tts.js`;
const CONFIG_FILE = `${process.env.HOME}/.openclaw/hooks/auto-tts/config.json`;

/**
 * Read hook config from JSON file
 */
async function readConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    // Default config
    return { enabled: true };
  }
}

/**
 * Main hook handler
 */
const autoTtsHook = async (event) => {
  // Check if this is a session event with message content
  if (event.type !== "session") {
    return;
  }

  // Only process message-related events
  const validActions = ["message", "send", "reply", "response"];
  if (!validActions.includes(event.action)) {
    return;
  }

  // Get the message text from context
  const context = event.context || {};
  const messageText = context.text;
  
  if (!messageText || typeof messageText !== "string" || messageText.trim().length === 0) {
    return;
  }

  // Skip very long messages (TTS would take too long)
  if (messageText.length > 500) {
    console.log("[auto-tts] Message too long, skipping TTS");
    return;
  }

  try {
    // Read hook config
    const config = await readConfig();
    
    if (!config.enabled) {
      return;
    }

    // Build command
    const voice = config.voice ? `--voice "${config.voice}"` : "";
    const rate = config.rate ? `--rate "${config.rate}"` : "";
    const volume = config.volume ? `--volume "${config.volume}"` : "";
    
    const escapedText = messageText.replace(/"/g, '\\"');
    const cmd = `node "${HOOK_SCRIPT}" "${escapedText}" ${voice} ${rate} ${volume}`;
    
    console.log(`[auto-tts] Playing: "${messageText.substring(0, 50)}..."`);
    
    // Run TTS in background (non-blocking)
    execAsync(cmd, { timeout: 90000 }).catch(err => {
      console.error("[auto-tts] Failed:", err.message);
    });
    
  } catch (err) {
    // Silent failure - TTS is optional
    console.debug("[auto-tts] Error:", err.message || String(err));
  }
};

export default autoTtsHook;
