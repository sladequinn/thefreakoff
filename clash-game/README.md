# THE FREAKOFF: SHADOW WARS

Clownbot and Ninjabot armies flood the streets while the two real figureheads tear the city apart to settle who actually runs it.

A 2.5D arcade beat 'em up and 1v1 versus fighter built in TypeScript on a plain Canvas 2D renderer. Every sprite, background, sound effect, voice grunt and music track is generated procedurally at runtime; there are no image or audio assets.

- **Slade, the Magick Ninja**: fast arcane zoner with a ninjato, smoke teleports and sigil eruptions.
- **Freckles, Sad Clowngirl**: a black-and-white harlequin with a belled hood, one black and one white twin-tail, a laced corset, striped stockings and spiked knuckles, fighting with four-hit strings, armored tackles and seismic slams.
- **White Lie, the Platinum Kingpin** (versus only): a three-hundred-pound rap mogul in a white suit with a gold chain and a cane. Slow and heavily armored; backhands, cane hooks, wall-bouncing belly bumps, an elbow drop and the two-ring Mic Drop shockwave.
- **Fiddle Jay, the Rosin Fist** (versus only): a fiddle virtuoso and karate master. Whips his bow like a blade, chains snap kicks and spinning hook kicks, slides and dive-kicks, and plays the Hellfire Hoedown, a sonic riff that launches everyone around him.

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

- **Story Mode**: six stages, each with its own look and music: The Outskirts, Pier 9 Harbor, The Core Facility, Neon Skyline, The Iron Foundry and The Sanctuary. Playing as Freckles you fight Ninjabots and then Slade. Playing as Slade you fight Clownbots and then Freckles. The Harbor and Foundry end with a Warden mid-boss (SHOGUN-X or FOREMAN MK-II). You start with three lives and earn an extra one after stages 3 and 5. Each cleared stage restores some health.
- **Versus: 1P vs 2P**: local head-to-head from the full four-fighter roster, best of three rounds with a 99-second timer. Combo damage scales down the longer a combo runs.
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

### Phones and tablets

On touch devices an on-screen pad appears automatically. A floating joystick follows your thumb on the left half of the screen. Push it fully sideways to run. The ATK, JMP and SPL buttons sit on the right, and pause, mute and fullscreen buttons are in the corner. Landscape gives the biggest view. In portrait the game sits above the controls. Local 1P vs 2P needs a keyboard or gamepad for Player 2. To test on a phone from a remote dev box, serve the production build and tunnel it: `npm run build && npx vite preview` (port 47322), then `cloudflared tunnel --protocol http2 --url http://127.0.0.1:47322`. The bundled build loads in a handful of requests, which holds up far better over a tunnel than the dev server's per-module requests. The `.trycloudflare.com` and `.loca.lt` hosts are already allowed in `vite.config.ts`.

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
  ai/         Ninjabot, Clownbot and boss/CPU controllers
  rendering/  stage painter, procedural skeletal sprites, HUD
  scenes/     title, character select, story, versus, results
```

- **Pixel look**: the world is painted into a 480x270 buffer, reduced to an 8-level-per-channel palette with 4x4 ordered (Bayer) dithering, and scaled up with nearest-neighbour. Fighters, projectiles and particles go through a separate sprite pass (`rendering/Pixelize.ts`): colours snap to flat palette levels, partial alpha becomes a Bayer mesh (the 16-bit way to fake transparency, used for trails, fades and glows) and every solid pixel touching empty space becomes a dark outline, so the vector-drawn rigs come out as outlined cel sprites. Portraits run through the same pass. The camera snaps to whole world pixels. The HUD is drawn on top at 960x540 in pixel fonts (Press Start 2P snapped to its 8px grid, plus VT323, bundled via Fontsource), and the browser scales the whole frame with `image-rendering: pixelated`.
- **Projection**: `screenX = x - cam.x`, `screenY = z - y - cam.y`. Entities are sorted by `z` before drawing, and shadows are drawn at `(screenX, z - cam.y)`.
- **Hit test**: X overlap, Y overlap, and `|dz| <= zRange` (default 14). Hits trigger 4 to 6 frames of hitstop and a camera shake in the direction of the hit.
- **Fighter states**: IDLE, WALK, RUN, PREJUMP, JUMP, LAND, ATTACK, HURT, KNOCKDOWN, WAKEUP, plus BLOCK, SUBSTITUTE, DEAD, INTRO and VICTORY.
- Moves are data-driven (`MoveData`): hit windows, motion keys, invulnerability windows, armor, HP cost and timed effect events.
