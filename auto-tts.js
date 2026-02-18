#!/usr/bin/env node
/**
 * Auto TTS - Simple TTS player for OpenClaw
 * 
 * Usage: node auto-tts.js "要播放的文本"
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const execAsync = promisify(exec);

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

/**
 * Generate TTS audio file
 */
async function generateTts(text, options = {}) {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || "+0%";
  const volume = options.volume || "+0%";
  
  const outputFile = path.join(os.tmpdir(), `openclaw-tts-${Date.now()}.mp3`);
  
  const escapedText = text.replace(/"/g, '\\"');
  const cmd = `edge-tts --voice "${voice}" --rate "${rate}" --volume "${volume}" --text "${escapedText}" --write-media "${outputFile}"`;
  
  console.log(`[TTS] Generating: "${text.substring(0, 30)}..."`);
  
  try {
    await execAsync(cmd, { timeout: 30000 });
    return outputFile;
  } catch (err) {
    console.error("[TTS] Generation failed:", err.message);
    throw err;
  }
}

/**
 * Play audio file
 */
async function playAudio(filePath) {
  try {
    // Use mpv for playback
    await execAsync(`mpv "${filePath}" --no-video --loop=no`, { timeout: 60000 });
    console.log("[TTS] Playback complete");
  } catch (err) {
    console.error("[TTS] Playback failed:", err.message);
    throw err;
  } finally {
    // Clean up
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Auto TTS for OpenClaw");
    console.log("");
    console.log("Usage: node auto-tts.js \"要播放的文本\" [选项]");
    console.log("");
    console.log("Options:");
    console.log("  --voice <name>  TTS voice (default: zh-CN-XiaoxiaoNeural)");
    console.log("  --rate <rate>   Speech rate (default: +0%)");
    console.log("  --volume <vol>  Volume (default: +0%)");
    console.log("");
    console.log("Example:");
    console.log('  node auto-tts.js "你好，太爷爷" --voice zh-CN-YunxiNeural');
    process.exit(0);
  }

  // Parse arguments
  const options = {};
  const textParts = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--voice" && i + 1 < args.length) {
      options.voice = args[++i];
    } else if (arg === "--rate" && i + 1 < args.length) {
      options.rate = args[++i];
    } else if (arg === "--volume" && i + 1 < args.length) {
      options.volume = args[++i];
    } else if (!arg.startsWith("--")) {
      textParts.push(arg);
    }
  }
  
  const text = textParts.join(" ");
  
  if (!text) {
    console.error("Error: No text provided");
    process.exit(1);
  }

  try {
    const audioFile = await generateTts(text, options);
    await playAudio(audioFile);
  } catch (err) {
    console.error("[TTS] Error:", err.message);
    process.exit(1);
  }
}

main();
