# CLASH: ARCANE & IRON

A 2.5D arcade beat 'em up and 1v1 versus fighter built in TypeScript on a plain Canvas 2D renderer. Every sprite, background, sound effect, voice grunt and music track is generated procedurally at runtime; there are no image or audio assets.

- **Slade, the Magick Ninja**: fast arcane zoner with a ninjato, smoke teleports and sigil eruptions.
- **Freckles, the Street Brawler**: armored infighter with brass-knuckle strings, tackles and seismic slams.

## Run it

```bash
cd clash-game
npm install
npm run dev        # http://localhost:47321
```

Other scripts:

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run build`     | Type-check and build to `dist/`       |
| `npm run preview`   | Serve the production build            |
| `npm run typecheck` | `tsc --noEmit` only                   |

Click or press any key once to enable sound (browsers block audio until then).

## Modes

- **Story Mode**: three stages. Playing as Freckles you fight Ninjabots and then Slade. Playing as Slade you fight Frecklebots and then Freckles. You get three lives, and each cleared stage restores some health.
- **Versus: 1P vs 2P**: local head-to-head, best of three rounds with a 99-second timer. Combo damage scales down the longer a combo runs.
- **Versus: 1P vs CPU**: pick your fighter, then pick the CPU's. The CPU blocks, punishes and uses specials.

## Controls

| Action         | Player 1            | Player 2          | Gamepad                  |
| -------------- | ------------------- | ----------------- | ------------------------ |
| Move           | W A S D             | Arrow keys        | D-pad / left stick       |
| Dash / run     | Double-tap A / D    | Double-tap ← / →  | Double-tap left / right  |
| Jump           | K / Space           | Numpad 2 / `.`    | A (south)                |
| Attack         | J                   | Numpad 1 / `,`    | X (west)                 |
| Special        | U, or J + K         | Numpad 4 / L      | Y (north) / triggers     |
| Block (versus) | Hold away           | Hold away         | Hold away                |
| Pause          | Esc / P             |                   | Start                    |

Contextual moves: attack while running for a dash attack (Shadow Step / Bull Charge), attack in the air for an air attack (Tengu Dive / Comet Hammer). Specials cost 8% of your current HP.

Press `` ` `` (backtick) to toggle the debug overlay: red hitboxes, green hurtboxes, blue z-depth planes, FPS and state info. Press `M` to mute.

## Architecture

```
src/
  config/     tuning constants and key bindings
  core/       fixed 60 Hz loop, camera, input, Web Audio synth, scene manager
  physics/    shared types and 3-axis (X, Y, Z-depth) collision
  entities/   Fighter state machine, Player, Enemy, Boss, projectiles, particles
  characters/ Slade and Freckles frame data
  ai/         Ninjabot, Frecklebot and boss/CPU controllers
  rendering/  stage painter, procedural skeletal sprites, HUD
  scenes/     title, character select, story, versus, results
```

- **Projection**: `screenX = x - cam.x`, `screenY = z - y - cam.y`. Entities are sorted by `z` before drawing, and shadows are drawn at `(screenX, z - cam.y)`.
- **Hit test**: X overlap, Y overlap, and `|dz| <= zRange` (default 14). Hits trigger 4 to 6 frames of hitstop and a camera shake in the direction of the hit.
- **Fighter states**: IDLE, WALK, RUN, PREJUMP, JUMP, LAND, ATTACK, HURT, KNOCKDOWN, WAKEUP, plus BLOCK, SUBSTITUTE, DEAD, INTRO and VICTORY.
- Moves are data-driven (`MoveData`): hit windows, motion keys, invulnerability windows, armor, HP cost and timed effect events.
