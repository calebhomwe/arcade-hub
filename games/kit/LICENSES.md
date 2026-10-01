# kit/ (fxkit.js, artkit.js, metakit.js) and the games built on it

Games using it: flappy-flight, dino-dash, knife-hit, brick-breaker, snake.

- **Art**: none of it is a downloaded asset. Skies, mountains, foliage, ground, pipes, cacti, logs, bricks, fruit, birds, dinos, knives and snakes are drawn in code with Canvas 2D gradients and seeded noise, so there is nothing to license and nothing to fetch.
- **Fonts**: Nunito (variable) is loaded from `games/assets/fonts/nunito.woff2`, SIL Open Font License 1.1, see `games/assets/fonts/LICENSE.txt`. Headings use the system serif stack (Iowan Old Style, Palatino, New York, Georgia), which is never bundled.
- **Sound**: the games call `ArcadeSDK.sfx(name)`, the arcade's shared kit (`assets/sfx/`, made with ElevenLabs sound generation on a plan that includes a commercial licence). Nothing extra is bundled.
- **Ideas, not assets**: the unlock loop (coins buy cosmetics at a fixed price, no chance boxes), the medal ladder, daily goals and weekly stamps follow `docs/playbook/PROGRESSION.md`.
