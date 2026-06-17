# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
---

## Project Overview

This is a **turn-based card game** (卡牌游戏) project. The game design is documented in `docs/卡牌游戏原型.md`. Currently, no implementation code exists—this is a design-first project.

## Game Design Summary

### Core Mechanics
- **3 Card Types**: Character cards, Energy cards (1-3 energy + wild), Special cards
- **Turn Structure**: 3 phases per turn (energy placement → skill action → mark resolution)
- **Blood War Mode**: Activates after turn 20 (all players take 20 penetration damage)
- **Victory**: Last player with HP > 0 wins

### Key Concepts
- **Marks (印记)**: Buffs/debuffs affecting HP, damage, draw, action order
- **Shield**: Blocks damage but not penetration
- **Penetration**: Ignores shield, deals direct HP damage

### Character Types
1. 平衡 (Balance) - 100 HP
2. 防御 (Defense) - 135 HP
3. 进攻 (Offense) - 80 HP
4. 强化 (Buffer) - 110 HP
5. 先手 (First) - 90 HP
6. 持久 (Sustain) - 115 HP
7. 弱化 (Debuffer) - 80 HP
8. 反击 (Counter) - 105 HP
9. 连击 (Combo) - 90 HP

## Implementation Notes

When implementing this game:
- Use Python or a suitable game framework
- Consider CLI or GUI implementation based on user direction
- Reference `docs/卡牌游戏原型.md` for complete card statistics and rules
- The game has complex state management (marks, shields, turn phases, hand/deck/discard tracking)

## Running Python Code

When you need to run Python code, **always use this exact format** (do not modify):

**General Python** (aola-project):
```bash
Bash(cd D:/Vscode_project_py/New_Card_Game && "C:\ProgramData\anaconda3\envs\aola-project\python.exe" -c "
your code
")
```

**GPU-accelerated Python** (pytorch_gpu — PyTorch 2.7 + CUDA 12.6 + Numba CUDA):
```bash
Bash(cd D:/Vscode_project_py/New_Card_Game && "C:\ProgramData\anaconda3\envs\pytorch_gpu\python.exe" -c "
your code
")
```

Use `pytorch_gpu` for v2.1.0+ GPU-accelerated statistical analysis (Bootstrap, matrix ops).
Use `aola-project` for general-purpose Python (no GPU acceleration needed).
```