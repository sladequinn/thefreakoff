# THE FREAKOFF: SHADOW WARS

Clownbot and Ninjabot armies flood the streets while four figureheads tear the city apart to settle who actually runs it.

A 2.5D arcade beat 'em up and versus fighter built in TypeScript on a plain Canvas 2D renderer. Every sprite, background, sound effect, voice line and music track is generated procedurally at runtime; there are no image or audio assets.

- **Slade, the Magick Ninja**: fast arcane zoner with a ninjato, smoke teleports and sigil eruptions.
- **Freckles, Sad Clowngirl**: a black-and-white harlequin with a belled hood, one black and one white twin-tail, a laced corset, striped stockings and spiked knuckles, fighting with four-hit strings, armored tackles and seismic slams.
- **White Lie, the Platinum Kingpin**: a three-hundred-pound rap mogul in a white overshirt over a black tee, fitted cap, black glasses, short dark beard, gold chains and a wired handheld mic. Slow and heavily armored; backhands, mic-fisted hooks, wall-bouncing belly bumps, an elbow drop, the two-ring Mic Drop shockwave and Hostile Takeover, an unblockable command grab that hoists you overhead and slams you.
- **Fiddle Jay, the Rosin Fist**: a fiddle virtuoso and karate master. Whips his bow like a blade, chains snap kicks and spinning hook kicks, slides and dive-kicks, plucks a travelling Devil's Trill note and plays the Hellfire Hoedown, a bowed arpeggio that launches everyone around him.
- **Batman, No Relation**: a tall, skinny, legally distinct caped vigilante. Long reach, floaty jumps, a glide kick that launches, a tripping Cape Slide, a thrown not-a-rang that curves after its target (Away + attack) and Rising Cowl, an invulnerable HP-cost uppercut.
- **Righteous, the Street Bishop**: a cassock-and-mitre preacher with a crozier. Long reach taps and a launching High Mass sweep, a processional charge, a falling-grace dive and Absolution, an invulnerable radial blessing that costs 8% HP.

Every fighter has an unlockable alt costume, two spoken catch-phrase taunts and a boss-shadow palette.

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

- **Story Mode**: six campaigns, one per fighter, across six stages that each have their own look, music and ambience: The Outskirts, Pier 9 Harbor, The Core Facility, Neon Skyline, The Iron Foundry and The Sanctuary. Slade cuts through Clownbots to reach Freckles; Freckles fights Ninjabots to reach Slade; White Lie's "Hostile Takeover" and Fiddle Jay's "The Devil's Contract" run through mixed bot crews and end with each other; Batman's "No Relation" route ends at Slade's gate; Righteous's "The Tithe" ends at White Lie. The Harbor and Foundry end with a Warden mid-boss (SHOGUN-X or FOREMAN MK-II). You start with three lives and earn an extra one after stages 3 and 5. Each cleared stage restores some health.
- **Versus: 1P vs 2P**: local head-to-head from the full roster, best of three rounds with a 99-second timer, on any of six stages or random. Combo damage scales down the longer a combo runs.
- **Versus: 1P vs CPU**: pick your fighter, then the CPU's, then the stage and CPU level (Easy to Nightmare). The CPU blocks, punishes, uses specials, command grabs and projectiles.
- **Tag Team: 2 vs 2**: each side picks a point fighter and a partner. One 150-second round; tag with `I` (P2: Numpad 5 / `;`, pad LB / RB, touch TAG) while standing to walk your fighter off and leap the partner in. Tags recharge over five seconds; the benched fighter slowly recovers up to 30% of the health they left with. When a point fighter is KO'd the partner relays in; a team loses when both are down. Choose human or CPU opposition on the opener screen; the CPU tags out on its own when it is hurt and has a fresh partner.
- **Arcade Ladder**: fight all four fighters in a random order at rising difficulty, touring the stages from your chosen start, then face a shadow version of your own character in the Sanctuary with an aura and extra health. Three continues, a score that rewards health, perfects and speed, per-character high scores.
- **Training**: infinite health, hitbox overlay, startup / active / recovery frame data and frame advantage on hit and block, combo damage, and a dummy that can stand, block everything, fight back, or record and replay your inputs. All options live in the pause menu.

Results screens offer rematch, next stage, character / team select and title. Wins unlock alt costumes (toggle with up / down on the roster), best combos and arcade high scores are saved in `localStorage`, and the pause menu holds music, sound, rumble and exit options.

## Controls

| Action         | Player 1            | Player 2          | Gamepad                  |
| -------------- | ------------------- | ----------------- | ------------------------ |
| Move           | W A S D             | Arrow keys        | D-pad / left stick       |
| Dash / run     | Double-tap A / D    | Double-tap ← / →  | Double-tap left / right  |
| Jump           | K / Space           | Numpad 2 / `.`    | A (south)                |
| Attack         | J                   | Numpad 1 / `,`    | X (west)                 |
| Block / parry  | H / Left Shift      | Numpad 0 / `/`    | B (east) / LT            |
| Special        | U                   | Numpad 4 / L      | Y (north) / RT           |
| Tag (tag team) | I                   | Numpad 5 / `;`    | LB / RB                  |
| Pause          | Esc / P             |                   | Start                    |

Contextual moves: attack while running for a dash attack, attack in the air for an air attack, hold toward the opponent and press special for White Lie's command grab, hold away and attack for Fiddle Jay's travelling note or Batman's not-a-rang. Specials cost 8% of your current HP; command grabs are free. Gamepads rumble on hits, knockdowns and KOs.

Blocking works in every mode and is a held button, not a stick direction, so retreating never raises your guard by accident. A guard only covers the front; in story mode a fresh block press turns you toward the nearest thug. Blocked hits do 12% chip damage. Press block within six frames of impact and you parry instead: no chip, you are free three frames later and the attacker is frozen for an extra twelve, which is enough to land a full punish. Hard versus CPUs can parry too; story bosses only block.

Inputs are buffered for ten frames through recovery, landing lag, blockstun and hitstop, so a jump or attack pressed a moment early comes out on the first free frame. Pressing attack during the three pre-jump frames (or on the same frame as jump) fires the air attack the instant you leave the ground.

### Phones and tablets

On touch devices an on-screen pad appears automatically. A floating joystick follows your thumb on the left half of the screen. Push it fully sideways to run. The right-thumb cluster fans out around ATK: JMP sits up-right so jump-into-air-attack is one thumb roll, BLK is a holdable pad to the left, SPL is furthest up, and a TAG button joins above-right in tag team. The pause, mute and fullscreen buttons stay in the top-right corner, well clear of the cluster. Landscape gives the biggest view. In portrait the game sits above the controls. Local 1P vs 2P and two-player tag need a keyboard or gamepad for Player 2. To test on a phone from a remote dev box, serve the production build and tunnel it: `npm run build && npx vite preview` (port 47322), then `cloudflared tunnel --protocol http2 --url http://127.0.0.1:47322`. The bundled build loads in a handful of requests, which holds up far better over a tunnel than the dev server's per-module requests. The `.trycloudflare.com` and `.loca.lt` hosts are already allowed in `vite.config.ts`.

Press `` ` `` (backtick) to toggle the debug overlay: red hitboxes, green hurtboxes, blue z-depth planes, FPS and state info. Press `M` to mute.

## Architecture

```
src/
  config/     tuning constants, key bindings, stages, story routes, arcade ladder
  core/       fixed 60 Hz loop, camera, input + touch pad, Web Audio synth, save data, scene manager
  physics/    shared types and 3-axis (X, Y, Z-depth) collision
  entities/   Fighter state machine, Player, Enemy, Boss, projectiles, particles
  characters/ frame data for Slade, Freckles, White Lie, Fiddle Jay, Batman and Righteous
  ai/         Ninjabot, Clownbot and boss/CPU controllers
  rendering/  stage painter, procedural skeletal sprites, HUD
  scenes/     title, character select, story, versus / arcade, tag team, training, results
```

- **Pixel look**: the world is painted into a 480x270 buffer, reduced to an 8-level-per-channel palette with 4x4 ordered (Bayer) dithering, and scaled up with nearest-neighbour. Fighters, projectiles and particles go through a separate sprite pass (`rendering/Pixelize.ts`): colours snap to flat palette levels, partial alpha becomes a Bayer mesh (the 16-bit way to fake transparency, used for trails, fades and glows) and every solid pixel touching empty space becomes a dark outline, so the vector-drawn rigs come out as outlined cel sprites. Portraits run through the same pass. The camera snaps to whole world pixels. The HUD is drawn on top at 960x540 in pixel fonts (Press Start 2P snapped to its 8px grid, plus VT323, bundled via Fontsource), and the browser scales the whole frame with `image-rendering: pixelated`.
- **Projection**: `screenX = x - cam.x`, `screenY = z - y - cam.y`. Entities are sorted by `z` before drawing, and shadows are drawn at `(screenX, z - cam.y)`.
- **Hit test**: X overlap, Y overlap, and `|dz| <= zRange` (default 14). Hits trigger 4 to 6 frames of hitstop and a camera shake in the direction of the hit.
- **Fighter states**: IDLE, WALK, RUN, PREJUMP, JUMP, LAND, ATTACK, HURT, KNOCKDOWN, WAKEUP, plus BLOCK, SUBSTITUTE, DEAD, INTRO and VICTORY.
- Moves are data-driven (`MoveData`): hit windows, motion keys, invulnerability windows, armor, HP cost, grab holds and timed effect events.
- **Audio**: every sound is synthesised in `core/AudioEngine.ts`. Voices use a formant synth driven by phoneme steps, so taunts like "Shadow step!", "Platinum.", "I'm... Batman." or "Amen." are spoken, not sampled. Fiddle Jay's riffs are a bowed-string model (sawtooth through body resonances with vibrato). Each stage has a looping ambient bed (wind and crickets, surf and gulls, machine hum, traffic and sirens, furnace roar, chimes) on its own bus.
- **Modes** share one simulation: `scenes/Scene.ts` holds the `CombatScene` base (update order, hit resolution, hitstop, projectiles, particles, pause menu, debug overlay) and the story, versus, tag and training scenes only add their rules and HUD on top.
