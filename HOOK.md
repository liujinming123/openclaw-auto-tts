---
name: auto-tts
description: "Automatically play TTS audio when agent sends messages back to user"
homepage: https://github.com/liujinming123/openclaw-voice-tts
metadata:
  {
    "openclaw":
      {
        "emoji": "🔊",
        "events": ["message:send"],
        "install": [{ "id": "auto-tts", "kind": "workspace", "label": "Auto TTS Hook" }],
      },
  }
---

# Auto TTS Hook

Automatically converts agent text responses to speech and plays them locally using Edge TTS.

## What It Does

When the OpenClaw agent sends a message back to the user:

1. **Captures the message** - Listens for outbound messages from the agent
2. **Generates speech** - Uses Edge TTS to convert text to audio
3. **Plays locally** - Uses mpv player to play audio on the local machine

## Requirements

- **Edge TTS** - `npm install -g edge-tts`
- **mpv player** - For audio playback (`sudo apt install mpv`)
- **voice-tts plugin** - Should be installed in `~/.openclaw/plugins/voice-tts/`

## Configuration

Configuration is stored in `~/.openclaw/hooks/auto-tts/config.json`:

```json
{
  "enabled": true,
  "voice": "zh-CN-XiaoxiaoNeural",
  "rate": "+0%",
  "volume": "+0%"
}
```

### Optional Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable/disable the hook |
| `voice` | `zh-CN-XiaoxiaoNeural` | TTS voice to use |
| `rate` | `+0%` | Speech rate (+/-%) |
| `volume` | `+0%` | Volume level (+/-%) |

## Available Voices

Chinese voices:
- `zh-CN-XiaoxiaoNeural` - Female (default)
- `zh-CN-YunxiNeural` - Male
- `zh-CN-YunyangNeural` - Male
- `zh-CN-XiaoyouNeural` - Young female

English voices:
- `en-US-JennyNeural` - Female
- `en-US-GuyNeural` - Male
- `en-GB-SoniaNeural` - Female

## How It Works

1. The hook listens for `session` events with message content
2. When a message is detected, it extracts the text
3. Calls `edge-tts` CLI to generate an MP3 file
4. Plays the MP3 using `mpv` player
5. Cleans up the temporary audio file after playback

## Limitations

- **Long messages** - Messages over 500 characters are skipped (TTS would be too long)
- **No streaming** - Waits for full TTS generation before playing
- **Local playback only** - Audio plays on the machine running OpenClaw
- **Not for rich content** - Only plays plain text, ignores images/files

## Troubleshooting

### TTS not playing

1. Check if edge-tts is installed:
   ```bash
   edge-tts --help
   ```

2. Check if mpv is available:
   ```bash
   which mpv
   ```

3. Enable debug logging:
   ```bash
   # Set environment variable
   export DEBUG=auto-tts
   ```

### Permission errors

Ensure the user running OpenClaw has permission to:
- Write to `/tmp`
- Execute `mpv` and `edge-tts`

## Disabling

To disable this hook, edit `~/.openclaw/hooks/auto-tts/config.json`:

```json
{
  "enabled": false
}
```

## See Also

- [voice-asr plugin](https://github.com/liujinming123/openclaw-voice-asr) - Speech recognition for voice input
- [voice-tts plugin](https://github.com/liujinming123/openclaw-voice-tts) - TTS synthesis utilities
