/**
 * Auto TTS Hook Handler
 *
 * Plays TTS audio when agent sends messages back to user.
 * Self-contained - no external imports needed.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

console.log('[auto-tts] Handler loaded at:', new Date().toISOString());

const execAsync = promisify(exec);

const HOOK_KEY = "auto-tts";
const HOOK_SCRIPT = `${process.env.HOME}/.openclaw/workspace/hooks/auto-tts/auto-tts.js`;
const CONFIG_FILE = `${process.env.HOME}/.openclaw/workspace/hooks/auto-tts/config.json`;

/**
 * Remove emojis from text for TTS (simplified)
 */
function stripEmojis(text: string): string {
  // Match all common emojis including sleeping face 💤
  return text.replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/gu, '').trim();
}

/**
 * Remove asterisks from text for TTS
 */
function stripAsterisks(text: string): string {
  return text.replace(/\*/g, '').trim();
}

/**
 * Read hook config from JSON file
 */
async function readConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { enabled: true };
  }
}

/**
 * Main hook handler
 */
const autoTtsHook = async (event) => {
  console.log('[auto-tts] Hook triggered! type:', event.type, 'action:', event.action);
  
  if (event.type !== "message" || event.action !== "send") {
    return;
  }

  const context = event.context || {};
  let messageText = context.text;
  
  console.log('[auto-tts] Original text:', messageText);
  
  if (!messageText || typeof messageText !== "string" || messageText.trim().length === 0) {
    return;
  }

  // Strip emojis and asterisks for TTS
  messageText = stripEmojis(messageText);
  messageText = stripAsterisks(messageText);
  console.log('[auto-tts] Text for TTS:', messageText);

  if (!messageText || messageText.length === 0) {
    return;
  }

  if (messageText.length > 500) {
    console.log("[auto-tts] Message too long, skipping TTS");
    return;
  }

  try {
    const config = await readConfig();
    
    if (!config.enabled) {
      return;
    }

    const voice = config.voice ? `--voice "${config.voice}"` : "";
    const rate = config.rate ? `--rate "${config.rate}"` : "";
    const volume = config.volume ? `--volume "${config.volume}"` : "";
    
    // Write text to temp file to avoid shell escaping issues
    const tmpFile = `${process.env.HOME}/.openclaw/workspace/hooks/auto-tts/.tts-text-${Date.now()}.txt`;
    await fs.writeFile(tmpFile, messageText, 'utf-8');
    
    const cmd = `node "${HOOK_SCRIPT}" --file "${tmpFile}" ${voice} ${rate} ${volume}`;
    
    console.log(`[auto-tts] Playing: "${messageText.substring(0, 50)}..."`);
    
    execAsync(cmd, { timeout: 90000 })
      .then(() => fs.unlink(tmpFile).catch(() => {}))
      .catch(err => {
        console.error("[auto-tts] Failed:", err.message);
        fs.unlink(tmpFile).catch(() => {});
      });
    
  } catch (err) {
    console.debug("[auto-tts] Error:", err.message || String(err));
  }
};

export default autoTtsHook;
