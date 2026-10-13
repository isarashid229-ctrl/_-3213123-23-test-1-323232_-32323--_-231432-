# AI Quest – AI Learning Portal

An interactive, gamified website that teaches high school students (grades 9–12) how AI works, how to use AI tools well, and how to use AI ethically.

**Features:** 3 modules (AI Foundations, AI Tools & Techniques, Ethical AI Use), 12 interactive lessons with hands-on activities, module quizzes, XP & levels, 11 badges, day streaks, progress dashboard, glossary, printable certificate, light/dark theme, mobile-friendly and keyboard accessible.

**Arcade Mode (`#/arcade`):** a Learn → Earn → Play loop. Every 2 correct answers (48 adaptive questions, with review of missed concepts) unlock a 30-second mini-game: Star Catcher, Stack Tower, Snake Garden, Sky Hopper, Color Pop, Block Drop. Includes unlockable games and themes, combos, personal bests, achievements, sound toggle, keyboard and touch controls.

Plain HTML/CSS/JavaScript with no build step and no external dependencies. Progress is saved in the browser's `localStorage`.

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.

## Deploy on GitHub Pages
1. Push these files to a repository (keep `index.html` at the repo root).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Your site appears at `https://<username>.github.io/<repo>/`.

## Edit content
- Lessons, quizzes and glossary: `js/data.js`
- Interactive activities: `js/widgets.js`
- Arcade questions: `js/questions.js` · mini-games and engine: `js/games.js` · arcade loop/unlocks: `js/arcade.js` · styles: `css/arcade.css`
- Layout, routing, XP and badges: `js/app.js`
- Look and feel: `css/styles.css`
