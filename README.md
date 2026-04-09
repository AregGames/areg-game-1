# Pixel Bot Brawler

A small 2D pixel arena game built with Vite and TypeScript. You control one fighter in a free-for-all survival arena against bots, hazards, pickups, and helper summons.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- `1` to `5`: switch between unlocked weapons
- `P` or `Esc`: pause / resume

## Goal

- Survive as long as possible
- Eliminate enemies to increase your score
- Unlock stronger weapons as your score increases
- Use pickups and helpers to stay alive longer

## Core Rules

- You fight enemy bots in a top-down arena.
- Enemies may be melee or ranged.
- Enemies target the nearest valid target, which can be you or one of your helpers.
- When a fighter dies, it respawns after a short delay.
- Spawn logic avoids placing fighters directly on top of active units when possible.

## Weapon Progression

Your score unlocks stronger weapons:

- `0` kills: Pistol
- `5` kills: Shotgun
- `10` kills: SMG
- `15` kills: Rifle
- `20` kills: Bazooka

Rules:

- You can manually switch between unlocked weapons with keys `1` to `5`.
- Player shots have a base `2%` crit chance.
- Critical hits deal `2x` damage and apply a small knockback.
- Bazooka shots explode near targets and deal blast-radius damage.

## Pickups

### Medkit

- Only one medkit can exist on the map at a time.
- Touching it restores health.

### Blue Star

- A blue star grants one random result on touch:
- `25%` chance: increase crit chance by `1%`
- `25%` chance: increase damage by `20%`
- `25%` chance: increase max HP by `20%`
- `25%` chance: no bonus

### Red Star

- A red star summons one helper on touch.
- `50%` chance: red helper
- `50%` chance: green helper

## Helpers

You can have at most `2` helpers active at once.

### Red Helper

- Has red eyes
- Has `1000 HP`
- Attacks enemies, not you
- Shoots more slowly than the player

### Green Helper

- Has green eyes
- Has `1000 HP`
- Follows you
- Shoots green healing projectiles at you
- Each healing projectile restores `5 HP` if it touches you

## Hazards

### Lightning

- Lightning strikes appear with a warning line first
- A bolt then hits from the top of the screen
- If you are close to the strike line when it lands, you take damage

## Pause

- Press `P` or `Esc` to pause the game
- While paused, movement, AI, bullets, hazards, and pickups stop updating

## Tech

- Vite
- TypeScript
- HTML canvas
