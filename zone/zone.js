/* In That Zone: the shared catalog loader and tile renderer for zone/index.html and zone/play.html.
 * Plain ES2018, no build step, nothing loaded from outside the repo. The catalog is zone/games.json;
 * the zone's display name lives there (zone.name) and nowhere else in these pages. */
(function () {
  'use strict';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }

  // Resolves to the parsed catalog, or rejects with a message the pages show in #err.
  function load() {
    if (typeof fetch !== 'function') return Promise.reject(new Error('this browser has no fetch()'));
    return fetch('games.json', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('games.json returned HTTP ' + r.status);
      return r.text();
    }).then(function (txt) {
      var d;
      try { d = JSON.parse(txt); } catch (e) { throw new Error('games.json is not valid JSON (' + e.message + ')'); }
      if (!d || !d.zone || typeof d.zone.name !== 'string' || !Array.isArray(d.games) || !d.games.length) throw new Error('games.json needs zone.name and a non-empty games list');
      d.games.forEach(function (g) {
        ['id', 'file', 'title', 'shelf', 'tagline'].forEach(function (k) {
          if (typeof g[k] !== 'string' || !g[k]) throw new Error('games.json: the entry ' + (g.id || '(no id)') + ' has no ' + k);
        });
      });
      return d;
    });
  }

  function byId(d, id) {
    for (var i = 0; i < d.games.length; i++) if (d.games[i].id === id) return d.games[i];
    return null;
  }
  function shelfOf(d, id) {
    var list = d.shelves || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return { id: id, name: id };
  }
  // shelves in catalog order, each with its games
  function shelves(d) {
    var order = (d.shelves || []).map(function (s) { return s.id; });
    d.games.forEach(function (g) { if (order.indexOf(g.shelf) < 0) order.push(g.shelf); });
    return order.map(function (id) { return { shelf: shelfOf(d, id), games: d.games.filter(function (g) { return g.shelf === id; }) }; })
      .filter(function (s) { return s.games.length; });
  }

  function tile(g) {
    var a = el('a', { class: 'tile ' + g.shelf, href: 'play.html?g=' + encodeURIComponent(g.id), 'data-tile': g.id });
    a.appendChild(el('span', { class: 'icon', 'aria-hidden': 'true', text: g.icon || '🎮' }));
    a.appendChild(el('span', { class: 'name', text: g.title }));
    a.appendChild(el('span', { class: 'tag', text: g.tagline }));
    var tags = el('span', { class: 'tags' });
    (g.skills || []).forEach(function (s) { tags.appendChild(el('span', { text: s })); });
    a.appendChild(tags);
    a.appendChild(el('span', { class: 'play', text: 'Play' }));
    return a;
  }
  function tiles(list) {
    var grid = el('div', { class: 'tiles' });
    list.forEach(function (g) { grid.appendChild(tile(g)); });
    return grid;
  }

  // The saved best for a game, read from this browser only. null when the key is missing, empty or storage is blocked.
  function readBest(key) {
    if (!key) return null;
    try {
      var v = window.localStorage.getItem(key);
      if (v == null) return null;
      v = String(v).trim();
      return v === '' ? null : v;
    } catch (e) { return null; }
  }

  function showError(node, err) {
    node.textContent = 'Could not load the game list (zone/games.json): ' + ((err && err.message) || String(err));
    node.hidden = false;
  }

  window.Zone = { el: el, load: load, byId: byId, shelfOf: shelfOf, shelves: shelves, tile: tile, tiles: tiles, readBest: readBest, showError: showError };
})();
