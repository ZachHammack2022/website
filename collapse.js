/*
 * A plain HTML page until you press the button. Then every word, link and
 * element becomes a rigid body and the page collapses into a heap you can
 * throw around. Space flips gravity. There is no undo; refresh the page.
 *
 * How: each word is wrapped in an inline-block <span class="atom">. Transforms
 * don't affect layout, so every atom keeps its original slot; we simulate a
 * physics body per atom and render it as translate/rotate away from that slot.
 */
(function () {
  'use strict';

  var Engine = Matter.Engine;
  var Bodies = Matter.Bodies;
  var Body = Matter.Body;
  var Composite = Matter.Composite;
  var Mouse = Matter.Mouse;
  var MouseConstraint = Matter.MouseConstraint;

  /** Elements that fall as one piece instead of word by word. */
  var WHOLE = 'a, button, hr, table, img, .whole';
  /** Never touched. */
  var SKIP = 'script, style';

  var trigger = document.getElementById('get-in-touch');
  var atoms = [];
  var engine, walls;
  var fallen = false;

  trigger.addEventListener('click', function (e) {
    if (fallen) return;
    fallen = true;
    // Keyboard presses report (0, 0); fall back to the button's centre.
    var r = trigger.getBoundingClientRect();
    var x = e.clientX || r.left + r.width / 2;
    var y = e.clientY || r.top + r.height / 2;
    collapse(x, y);
  });

  // ---------------------------------------------------------------- atoms

  /** List markers aren't elements, so swap them for real bullets that can fall. */
  function realizeBullets() {
    document.querySelectorAll('ul > li').forEach(function (li) {
      var bullet = document.createElement('span');
      bullet.className = 'whole bullet';
      bullet.textContent = '•';
      li.insertBefore(bullet, li.firstChild);
      li.classList.add('bulleted');
    });
  }

  function atomize(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === Node.TEXT_NODE) {
        splitWords(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.matches(SKIP)) return;
        if (child.matches(WHOLE)) {
          child.classList.add('atom');
          atoms.push({ el: child });
        } else {
          atomize(child);
        }
      }
    });
  }

  function splitWords(textNode) {
    var parts = textNode.textContent.split(/(\s+)/);
    if (parts.length === 1 && !parts[0].trim()) return;
    var frag = document.createDocumentFragment();
    parts.forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        var span = document.createElement('span');
        span.className = 'atom';
        span.textContent = part;
        frag.appendChild(span);
        atoms.push({ el: span });
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  }

  // ---------------------------------------------------------------- collapse

  function collapse(originX, originY) {
    realizeBullets();
    atomize(document.body);

    // Measure everything in its resting place, in viewport coordinates.
    var vh = window.innerHeight;
    atoms.forEach(function (a) {
      var r = a.el.getBoundingClientRect();
      a.w = r.width;
      a.h = r.height;
      a.ox = r.left + r.width / 2;
      a.oy = r.top + r.height / 2;
    });

    document.documentElement.classList.add('collapsed');

    engine = Engine.create();
    buildWalls();

    var maxDist = Math.hypot(window.innerWidth, vh);
    atoms.forEach(function (a) {
      if (a.w < 1 || a.h < 1) return;

      // Anything off-screen gets dropped in from above instead.
      var y = a.oy;
      if (y > vh + a.h || y < -a.h) y = -a.h - Math.random() * vh;

      var body = Bodies.rectangle(a.ox, y, a.w, a.h, {
        restitution: 0.2,
        friction: 0.5,
        frictionAir: 0.012,
        density: 0.002,
        chamfer: { radius: Math.min(3, a.h / 4, a.w / 4) },
      });
      // Hold everything in place, then let go in a wave spreading from the click.
      Body.setStatic(body, true);
      a.releaseAt = (Math.hypot(a.ox - originX, a.oy - originY) / maxDist) * 900 + Math.random() * 120;
      a.body = body;
      Composite.add(engine.world, body);
    });

    var grabLayer = document.createElement('div');
    grabLayer.id = 'grab-layer';
    document.body.appendChild(grabLayer);
    Composite.add(
      engine.world,
      MouseConstraint.create(engine, {
        mouse: Mouse.create(grabLayer),
        constraint: { stiffness: 0.2, render: { visible: false } },
      }),
    );

    window.addEventListener('resize', buildWalls);
    window.addEventListener('keydown', onKey);

    var start = performance.now();
    var last = start;
    requestAnimationFrame(function tick(now) {
      var elapsed = now - start;
      atoms.forEach(function (a) {
        if (a.body && a.body.isStatic && elapsed >= a.releaseAt) {
          Body.setStatic(a.body, false);
          Body.setAngularVelocity(a.body, (Math.random() - 0.5) * 0.08);
        }
      });
      Engine.update(engine, Math.min(1000 / 30, now - last));
      last = now;
      render();
      requestAnimationFrame(tick);
    });
  }

  function render() {
    for (var i = 0; i < atoms.length; i++) {
      var a = atoms[i];
      if (!a.body) continue;
      var p = a.body.position;
      a.el.style.transform =
        'translate(' + (p.x - a.ox).toFixed(1) + 'px,' + (p.y - a.oy).toFixed(1) + 'px) ' +
        'rotate(' + a.body.angle.toFixed(3) + 'rad)';
    }
  }

  function buildWalls() {
    if (walls) Composite.remove(engine.world, walls);
    var w = window.innerWidth;
    var h = window.innerHeight;
    var t = 200; // thick, so fast pieces don't tunnel through
    var opts = { isStatic: true, friction: 0.8 };
    var up = engine.gravity.y < 0;
    walls = [
      Bodies.rectangle(w / 2, h + t / 2, w + 2 * t, t, opts), // floor
      Bodies.rectangle(-t / 2, h / 2 - 2000, t, h + 4000, opts), // left
      Bodies.rectangle(w + t / 2, h / 2 - 2000, t, h + 4000, opts), // right
      Bodies.rectangle(w / 2, up ? -t / 2 : -4000, w + 2 * t, t, opts), // ceiling
    ];
    Composite.add(engine.world, walls);
  }

  function onKey(e) {
    if (e.key !== ' ' && e.code !== 'Space') return;
    e.preventDefault();
    engine.gravity.y = -engine.gravity.y;
    // Upside down, the ceiling comes down to the top of the screen.
    Body.setPosition(walls[3], {
      x: window.innerWidth / 2,
      y: engine.gravity.y < 0 ? -100 : -4000,
    });
  }
})();
