# Voice Commands Quick Reference Guide

## 🎤 Voice Control Commands

### System Commands

| Command        | Examples                                  | Action                                               |
| -------------- | ----------------------------------------- | ---------------------------------------------------- |
| **Voice On**   | "voice on", "enable voice"                | Enable voice command recognition                     |
| **Voice Off**  | "voice off", "disable voice"              | Disable voice commands (still recognizes "voice on") |
| **Stop Voice** | "stop", "quiet", "shush"                  | Stop TTS playback immediately                        |
| **Repeat**     | "repeat", "repeat that", "say that again" | Replay last spoken message                           |

---

## ♞ Game Mode Commands

| Command           | Examples                              | Action                       |
| ----------------- | ------------------------------------- | ---------------------------- |
| **Voice Chess**   | "voice chess", "play voice chess"     | Start voice-controlled chess |
| **Classic Chess** | "classic chess", "play classic chess" | Start traditional chess      |
| **Show Commands** | "help", "commands", "what can i say"  | Display available commands   |
| **Back**          | "back", "go back", "return"           | Navigate back                |

---

## ⏱️ Time Control Categories

Say the category name to hear all options:

| Category      | Command     | Announcement                         |
| ------------- | ----------- | ------------------------------------ |
| **Bullet**    | "bullet"    | 1+0, 1+1, 2+0, 2+1, 30 seconds       |
| **Blitz**     | "blitz"     | 3+0, 3+2, 4+2, 5+0, 5+3              |
| **Rapid**     | "rapid"     | 10+0, 10+5, 15+0, 15+10, 25+10       |
| **Classical** | "classical" | 60+0, 60+30, 90+30, 120+30, 90/40+30 |

---

## 🕒 Specific Time Control Commands

### Bullet (Fast games - under 3 minutes)

- "bullet 1 plus 0" → 1 minute, no increment
- "bullet 1 plus 1" → 1 minute + 1 second increment
- "bullet 2 plus 0" → 2 minutes, no increment
- "bullet 2 plus 1" → 2 minutes + 1 second increment
- "30 seconds" → 30 seconds, no increment

### Blitz (Fast games - 3-8 minutes)

- "blitz 3 plus 0" → 3 minutes, no increment
- "blitz 3 plus 2" → 3 minutes + 2 second increment
- "blitz 4 plus 2" → 4 minutes + 2 second increment
- "blitz 5 plus 0" → 5 minutes, no increment
- "blitz 5 plus 3" → 5 minutes + 3 second increment

### Rapid (Medium games - 8-25 minutes)

- "rapid 10 plus 0" → 10 minutes, no increment
- "rapid 10 plus 5" → 10 minutes + 5 second increment
- "rapid 15 plus 0" → 15 minutes, no increment
- "rapid 15 plus 10" → 15 minutes + 10 second increment
- "rapid 25 plus 10" → 25 minutes + 10 second increment

### Classical (Slow games - 25+ minutes)

- "classical 60 plus 0" → 1 hour, no increment
- "classical 60 plus 30" → 1 hour + 30 second increment
- "classical 90 plus 30" → 1.5 hours + 30 second increment
- "classical 120 plus 30" → 2 hours + 30 second increment
- "classical 90 by 40 plus 30" → Classical with 40 moves / 90 minutes + 30 seconds

---

## 👥 Opponent Selection

| Command             | Action                       |
| ------------------- | ---------------------------- |
| "random"            | Play against random opponent |
| "play random"       | Play against random opponent |
| "friends"           | Play with friends            |
| "play with friends" | Play with friends            |

---

## 🎮 Voice Game Commands (During Game)

Once in a voice chess game, use these commands:

| Command            | Examples                    | Effect            |
| ------------------ | --------------------------- | ----------------- |
| **Move by Square** | "E4", "E four"              | Play move E4      |
| **Move by Piece**  | "Knight F3", "Knight to F3" | Move knight to F3 |
| **Bishop**         | "Bishop E5", "Bishop to E5" | Move bishop to E5 |
| **Rook**           | "Rook E1", "Rook to E1"     | Move rook to E1   |
| **Queen**          | "Queen D4", "Queen to D4"   | Move queen to D4  |
| **King**           | "King E2", "King to E2"     | Move king to E2   |
| **Pawn**           | "Pawn E5", "Pawn to E5"     | Move pawn to E5   |

### Special Game Commands

- "stop" → Stop TTS and stop listening
- "repeat" → Hear last move announcement again
- "voice off" → Disable voice commands (still recognize "voice on")
- "voice on" → Re-enable voice commands

---

## 📝 Usage Examples

### Example 1: Starting a Voice Game

```
User: "voice chess"
System: "Starting voice chess"
System: "Choose time control. Say bullet, blitz, rapid, or classical"

User: "bullet"
System: "Announces all bullet options"

User: "bullet 1 plus 0"
System: "Bullet one plus zero selected"
```

### Example 2: Managing Voice

```
User: "voice off"
System: "Voice commands disabled"

User: "play chess"
(No response - command ignored)

User: "voice on"
System: "Voice commands enabled"
```

### Example 3: TTS Interruption

```
System: "Welcome to Chess 4 Everyone..."
User: "stop"
(System stops speaking immediately)

User: "repeat"
(System speaks welcome message again)
```

---

## 🌍 Language & Accent Support

- **Primary:** Nepali-Nepal (ne-NP)
- **Secondary:** English-India (en-IN)
- **Quality:** Works best with clear, natural speech
- **Compatibility:** Chrome, Edge, Safari, Firefox (most recent versions)

---

## ⚡ Pro Tips

1. **Speak Naturally** - System works best with natural speech patterns
2. **Use Variations** - Try different phrasings if command doesn't work
   - "E4" vs "E four" vs "Play E4" vs "E4 play"
3. **Wait for Beep** - Some browsers may indicate when listening
4. **Offline Available** - Voice features work without internet
5. **Multiple Accents** - System adapts to various Nepali accents
6. **No Typing Needed** - Completely hands-free chess experience

---

## 🔧 Troubleshooting

| Issue                   | Solution                                  |
| ----------------------- | ----------------------------------------- |
| Commands not recognized | Speak slowly and clearly                  |
| Accent mismatch         | Repeat command with different phrasing    |
| TTS not stopping        | Say "stop" or wait for message to finish  |
| Voice not listening     | Check browser permissions, say "voice on" |
| Commands ignored        | Say "voice on" to re-enable               |
| Duplicate commands      | Wait 600ms before repeating (cooldown)    |

---

## 📱 Browser Support

| Browser | Support | Notes           |
| ------- | ------- | --------------- |
| Chrome  | ✅ Full | Recommended     |
| Edge    | ✅ Full | Recommended     |
| Safari  | ✅ Full | iOS 14.5+       |
| Firefox | ✅ Full | Recent versions |
| Opera   | ✅ Full | Recent versions |

---

## 🚀 Getting Started

1. **Login** to Chess4Everyone
2. **Listen** for welcome message (auto-plays)
3. **Say Command** - Start with "voice chess"
4. **Follow Prompts** - System guides you through selections
5. **Play** - Enjoy voice-controlled chess!

---

Generated: 2025-11-26
Version: 1.0
Status: ✅ Production Ready
