#!/usr/bin/env node
/**
 * Auto TTS - Simple TTS player for OpenClaw
 * 
 * Usage: node auto-tts.js "要播放的文本"
 */

import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const execAsync = promisify(exec);

const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";

/**
 * Generate and play TTS using streaming (low latency)
 */
async function playTtsStreaming(text, options = {}) {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || "+0%";
  const volume = options.volume || "+0%";
  
  console.log(`[TTS] Playing: "${text.substring(0, 50)}..."`);
  
  return new Promise((resolve, reject) => {
    // 流式：edge-tts stdout -> mpv stdin
    const ttsProcess = spawn("edge-tts", [
      "--voice", voice,
      "--rate", rate,
      "--volume", volume,
      "--text", text,
      "--write-media", "-"  // 输出到 stdout
    ]);

    // 优化参数，减少延迟
    const playerProcess = spawn("mpv", [
      "-",                     // 从 stdin 读取
      "--no-video",            // 不显示视频
      "--cache=no",            // 禁用缓存，减少延迟
      "--audio-buffer=0.2",    // 音频缓冲区缩小到 0.2 秒
      "--really-quiet",        // 减少不必要的输出
      "--loop=no",             // 不循环
      "--ao=pulse"             // 强制使用 PulseAudio (WSLg)
    ], {
      env: { ...process.env, PULSE_SERVER: "/mnt/wslg/PulseServer" }
    });

    // pipe TTS 输出给播放器
    ttsProcess.stdout.pipe(playerProcess.stdin);

    // 处理错误
    ttsProcess.on("error", (err) => {
      console.error("[TTS] edge-tts error:", err.message);
      playerProcess.kill();
      reject(err);
    });

    playerProcess.on("error", (err) => {
      console.error("[TTS] mpv error:", err.message);
      reject(err);
    });

    // 等待播放完成
    playerProcess.on("close", (code) => {
      ttsProcess.kill();
      console.log(`[TTS] Finished (exit code: ${code})`);
      resolve();
    });
  });
}

/**
 * Generate TTS audio file (fallback for backward compatibility)
 */
async function generateTts(text, options = {}) {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || "+0%";
  const volume = options.volume || "+0%";
  
  const timestamp = Date.now();
  const outputFile = path.join(os.tmpdir(), `openclaw-tts-${timestamp}.mp3`);
  const textFile = path.join(os.tmpdir(), `openclaw-tts-${timestamp}.txt`);
  
  // Write text to file to avoid shell escaping issues
  await fs.writeFile(textFile, text, 'utf-8');
  
  const cmd = `edge-tts --voice "${voice}" --rate "${rate}" --volume "${volume}" --file "${textFile}" --write-media "${outputFile}"`;
  
  console.log(`[TTS] Generating: "${text.substring(0, 30)}..."`);
  
  try {
    await execAsync(cmd, { timeout: 30000 });
    return outputFile;
  } catch (err) {
    console.error("[TTS] Generation failed:", err.message);
    throw err;
  } finally {
    // Clean up text file
    try {
      await fs.unlink(textFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Play audio file (fallback for backward compatibility)
 */
async function playAudio(filePath) {
  try {
    // Use mpv for playback with optimized parameters
    await execAsync(`mpv "${filePath}" --no-video --loop=no --cache=no --audio-buffer=0.2 --really-quiet --ao=pulse`, { 
      timeout: 60000,
      env: { ...process.env, PULSE_SERVER: "/mnt/wslg/PulseServer" }
    });
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
    console.log("Usage: node auto-tts.js [选项] \"要播放的文本\"");
    console.log("       node auto-tts.js --file /path/to/text.txt [选项]");
    console.log("");
    console.log("Options:");
    console.log("  --file <path>   Read text from file instead of command line");
    console.log("  --voice <name>  TTS voice (default: zh-CN-XiaoxiaoNeural)");
    console.log("  --rate <rate>   Speech rate (default: +0%)");
    console.log("  --volume <vol>  Volume (default: +0%)");
    console.log("");
    console.log("Example:");
    console.log('  node auto-tts.js "你好，太爷爷" --voice zh-CN-YunxiNeural');
    console.log('  node auto-tts.js --file /tmp/message.txt --rate "+10%"');
    process.exit(0);
  }

  // Parse arguments
  const options = {};
  let textFile = null;
  const textParts = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--file" && i + 1 < args.length) {
      textFile = args[++i];
    } else if (arg === "--voice" && i + 1 < args.length) {
      options.voice = args[++i];
    } else if (arg === "--rate" && i + 1 < args.length) {
      options.rate = args[++i];
    } else if (arg === "--volume" && i + 1 < args.length) {
      options.volume = args[++i];
    } else if (!arg.startsWith("--")) {
      textParts.push(arg);
    }
  }
  
  let text;
  if (textFile) {
    // Read text from file
    try {
      text = await fs.readFile(textFile, 'utf-8');
    } catch (err) {
      console.error("[TTS] Failed to read text file:", err.message);
      process.exit(1);
    }
  } else {
    text = textParts.join(" ");
  }
  
  if (!text || !text.trim()) {
    console.error("Error: No text provided");
    process.exit(1);
  }

  try {
    // 使用流式播放（低延迟）
    await playTtsStreaming(text, options);
  } catch (err) {
    console.error("[TTS] Error:", err.message);
    process.exit(1);
  }
}

main();
