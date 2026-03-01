# Asteroid Shooter - Technical Summary

## Overview
A feature-rich 2D space shooter game built in Python with Pygame, featuring a full game loop with main menu, ship hangar with an in-game credits economy, multiple meteor types with physics-based collisions, a shield and damage system, persistent save data, and a 3D perspective-projected starfield rendered in real time for menu backgrounds.

## Project Type
Game Development | 2D Game Application | Interactive Graphics

## Tech Stack

### Languages
- **Python**: Entire game logic, rendering pipeline, and state management (~1,200 lines in a single-module architecture)

### Frameworks & Libraries
- **Pygame**: Core game engine handling rendering, sprite management, pixel-perfect collision detection, audio playback, event handling, and display management
- **JSON (stdlib)**: Persistent save/load system for player progression data
- **math (stdlib)**: Trigonometric calculations for 3D perspective projection of starfield

### Databases & Storage
- **JSON file-based persistence**: Stores player credits, unlocked ships, and last-selected ship across sessions with corruption-safe loading and automatic fallback defaults

### Cloud & DevOps
- **Git/GitHub**: Version-controlled repository with `.gitignore` and MIT License

### APIs & Integrations
- N/A (standalone desktop application)

## Architecture Highlights
- **Object-Oriented Sprite System**: 8 distinct sprite classes (`Ship`, `Laser`, `Meteor`, `Stone_Meteor`, `Shield`, `DamageOverlay`, `ShieldPowerUp`, `Star`) leveraging Pygame's `sprite.Sprite` inheritance for update/draw cycles and group-based collision detection
- **State Machine Game Flow**: 5 discrete game screens (Main Menu → Ship Selection → Gameplay → Retry/Game Over → Credits) with proper transitions, music crossfading, and event isolation per screen
- **Delta-Time Physics**: Frame-rate-independent movement using `dt = clock.tick() / 1000` applied to all entity velocities, ensuring consistent gameplay across hardware
- **3D Perspective Projection on 2D Canvas**: Real-time starfield simulation projecting up to 5,000 3D-positioned meteor sprites onto a 2D plane with depth-based scaling and rotation, used for menu and game-over screen backgrounds
- **Pixel-Perfect Collision Detection**: Uses `pygame.mask` for mask-based collision between all interacting entities instead of bounding-box approximation
- **Data-Driven Ship System**: Ships defined as dictionaries with `id`, `name`, `image`, and `price` fields, enabling easy extensibility; 11 total ships (1 default + 10 unlockable)

## Key Features Implemented
1. **Ship Hangar & Selection Screen**: Grid-based UI displaying 11 ships with hover animations (scale + slide), lock/unlock state visualization, purchase confirmation dialogs, and double-click-to-launch interaction pattern
2. **In-Game Credits Economy**: Players earn 1 credit per 10 seconds survived; credits persist across sessions and are spent to unlock ships at 25 credits each, with error handling for insufficient funds
3. **Dual Meteor System with Physics**: Regular meteors (destructible, 6 visual variants, random size scaling 0.5x–2.5x) and stone meteors (indestructible, 6 variants, 1x–2.5x scaling) with inter-meteor elastic collision response including direction reversal, size-based randomness, and overlap nudging
4. **Shield Power-Up System**: 10% drop chance from destroyed regular meteors; collectible shield pickup that falls downward; right-click activation with 10-second duration; absorbs one hit from regular meteors but stone meteors destroy shield AND deal damage
5. **Progressive Damage System**: 4-hit-point health system with 3 progressive visual damage overlays composited on top of the player ship sprite, culminating in a crash sound and game-over transition
6. **3D Starfield Background Engine**: Custom `Star`/`Starfield`/`App` classes simulating a 3D-to-2D projected meteor field with configurable star counts (1,500 for menus, 5,000 for game-over), variable velocities, XY rotation, and alpha blending
7. **Full Audio System**: 10+ sound effects (laser, shield up/down, zap, explosion, damage, crash, hover, click) and 2 background music tracks with per-screen volume management and looping
8. **Persistent Save System**: JSON-based save file with load validation, corruption recovery (falls back to defaults), and automatic saving on credit earn, ship purchase, and ship selection
9. **Dynamic Menu UI**: Brush-stroke hover effects on buttons, interactive credits screen with mouse-position-based image switching, and version display (V1.9.2)
10. **Retry Dialog with Ship Choice**: Post-game-over dialog offering to replay with last ship or return to hangar, rendered with semi-transparent overlay and styled buttons

## Technical Complexity Indicators
- **Codebase Scale**: Medium — ~1,200 lines of Python, 8 sprite classes, 5 game screens, 60+ asset files (images, fonts, audio)
- **Integration Complexity**: Self-contained desktop application with file I/O for persistence
- **Data Complexity**: 11 ship entities with unlock/economy state, 12 meteor image variants, 3 damage overlay stages, multiple sprite groups managing independent entity lifecycles
- **Testing**: No automated tests (typical for game projects; tested via interactive play)
- **CI/CD**: None configured

## Quantifiable Metrics (Estimated)
- **Game Entities**: 8 sprite classes managing independent update/draw lifecycles across 7 sprite groups
- **Asset Count**: 60+ assets including 22 meteor sprites, 11 ship sprites, 3 damage overlays, 10+ audio files, 3 custom fonts
- **Starfield Rendering**: Up to 5,000 simultaneously projected 3D star objects with per-frame depth sorting and scaling
- **Resolution**: Native 1920×1080 full-screen rendering at 60 FPS target
- **Ship Economy**: 11 ships, 25-credit unlock price, 1 credit per 10 seconds survived — balanced progression system
- **Collision Systems**: 4 distinct collision interactions (laser↔meteor, laser↔stone, ship↔meteor, ship↔stone) using pixel-perfect mask detection

## Resume-Ready Bullet Points
> These are draft bullet points optimized for ATS and impact. Use as starting points.

- Developed a 2D space shooter game in Python using Pygame, implementing 8 sprite classes, pixel-perfect mask-based collision detection, and delta-time physics for frame-rate-independent gameplay at 1920×1080 resolution
- Engineered a real-time 3D perspective projection starfield rendering up to 5,000 simulated objects with depth-based scaling and rotation on a 2D canvas using trigonometric projection formulas
- Built a ship hangar economy system with JSON-based persistent save data, supporting 11 unlockable ships, an in-game credits currency, purchase confirmation dialogs, and corruption-safe data loading with automatic fallback
- Implemented a dual-meteor physics system with elastic collision response between entities, size-based collision randomness, and direction reversal — handling regular (destructible) and stone (indestructible) meteor types across 12 visual variants
- Designed a multi-screen game state machine with 5 distinct screens (menu, ship selection, gameplay, game-over, credits), per-screen audio management, and interactive UI elements including hover animations, double-click detection, and semi-transparent dialog overlays

## Keywords for ATS
Python, Pygame, Game Development, Object-Oriented Programming, Sprite Management, Collision Detection, Pixel-Perfect Collision, Mask-Based Collision, 2D Game, Physics Simulation, Elastic Collision, Delta-Time, Frame-Rate Independence, 3D Perspective Projection, Starfield Rendering, JSON Persistence, Save/Load System, Game State Machine, UI/UX Design, Audio Management, Sound Effects, Event-Driven Programming, Custom Timer Events, Asset Management, Real-Time Rendering, Game Loop, Power-Up System, Damage System, In-Game Economy, Data-Driven Design, Git, MIT License

## Notes for Resume Tailoring
- **Best suited for roles involving**: Game development, Python development, graphics programming, interactive application development, desktop application engineering
- **Strongest demonstration of**: Object-oriented design with inheritance hierarchies, real-time rendering and physics simulation, building complete interactive applications with persistent state
- **Potential talking points for interviews**:
  - The 3D-to-2D perspective projection math used for the starfield background — translating Wikipedia's projection formulas into a real-time rendering system
  - Design decisions around the dual meteor collision system (elastic response, size-based randomness, overlap nudging) and how it creates emergent gameplay behavior
  - The corruption-safe save system with validation and automatic fallback — a pattern applicable to any production system handling persistent data
  - Trade-offs of single-file architecture vs. multi-module design for a game of this scope
