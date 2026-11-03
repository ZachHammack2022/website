# Zach Hammack

A plain HTML home page.

Pressing **Get in touch** turns every word, link and bullet into a rigid body, and the page collapses into a heap at the bottom of the screen. The pieces can be dragged and thrown, and **space** flips gravity. There's no undo; refresh the page.

How it works: `collapse.js` wraps each word in an inline-block `<span>`. CSS transforms don't affect layout, so every piece keeps its original slot. A [Matter.js](https://brm.io/matter-js/) body is simulated for each piece and drawn as a translate/rotate away from that slot.

## Files

```
index.html               the page
style.css                almost nothing; browser defaults are the design
collapse.js              the collapse
vendor/matter.min.js     Matter.js 0.19.0 (MIT), vendored so there's no CDN
```

## Run it

There's no build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. It also works as-is on GitHub Pages.
