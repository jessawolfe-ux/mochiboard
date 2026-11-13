// Mochiboard: the canvas. Cards live in "world" coordinates; the view is a pan (x, y) and a zoom (z).
(() => {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), world = $('world'), cardsEl = $('cards'), wires = $('wires'), grid = $('grid');
  // ---------- on Windows and Linux: ⌘K reads Ctrl+K, ⇧⌘G reads Ctrl+Shift+G (the keys themselves already take Ctrl), and the app's own words say PC, not Mac ----------
  // the browser version on a Windows or Linux computer counts too (an iPhone or iPad keeps ⌘)
  const OS = MB.platform !== 'web' ? MB.platform : /Win/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent) ? 'windows' : /Linux|X11|CrOS/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? 'linux' : 'mac';
  if (OS === 'windows' || OS === 'linux') {
    const MOD = { '⌃': 'Ctrl', '⌘': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' }, ORDER = ['Ctrl', 'Alt', 'Shift'];
    const winKeys = t => t.replace(/([⌃⌥⇧⌘]+)(\s?)([^\s⌃⌥⇧⌘]?)/g, (m, mods, sp, key) => {
      const ms = ORDER.filter(o => [...mods].some(c => MOD[c] === o));
      return ms.join('+') + (key === '-' ? '-' : key ? (sp ? ' ' : '+') + (key === '↩' ? 'Enter' : key.toUpperCase()) : '');   // ⌘-click reads Ctrl-click
    }).replace(/Ctrl\+(\S)\s*\/\s*ctrl/i, 'Ctrl+$1');   // "⌘/ctrl" said twice
    const PC = OS === 'windows' ? 'PC' : 'computer';
    const WORDS = [[/\b(this|your|a|my) Mac’s\b/g, `$1 ${PC}’s`], [/\b(this|your|a|my) Mac\b/g, `$1 ${PC}`], [/\bShow in Finder\b/g, 'Show in File Explorer'], [/\bFinder\b/g, 'File Explorer'], [/\bTerminal\b/g, OS === 'windows' ? 'PowerShell' : 'a terminal']];
    const MACWORDS = /Mac|Finder|Terminal/;
    const theirs = n => n.parentElement?.closest('#cards, .docview, .msg.me, [contenteditable="true"], input, textarea');   // never touch what people wrote
    const winWords = t => WORDS.reduce((x, [re, to]) => x.replace(re, to), t);
    const sayPC = n => { if (!MACWORDS.test(n.nodeValue) || theirs(n)) return; const v = winWords(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };   // only write when it changes, or the watcher below would loop
    const ATTRS = ['title', 'data-tip', 'aria-label', 'placeholder'];
    const fix = n => {
      if (n.nodeType === 3) { if (/[⌃⌥⇧⌘]/.test(n.nodeValue)) n.nodeValue = winKeys(n.nodeValue); sayPC(n); return; }
      if (n.nodeType !== 1) return;
      ATTRS.forEach(a => { const v = n.getAttribute(a); if (v && /[⌃⌥⇧⌘]/.test(v)) n.setAttribute(a, winKeys(v)); });
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let t; while ((t = w.nextNode())) { if (/[⌃⌥⇧⌘]/.test(t.nodeValue)) t.nodeValue = winKeys(t.nodeValue); sayPC(t); }
      n.querySelectorAll?.(ATTRS.map(a => `[${a}]`).join(',')).forEach(e => ATTRS.forEach(a => { const v = e.getAttribute(a); if (v && /[⌃⌥⇧⌘]/.test(v)) e.setAttribute(a, winKeys(v)); }));
    };
    fix(document.body);
    new MutationObserver(ms => ms.forEach(m => { if (m.type === 'characterData') fix(m.target); else if (m.type === 'attributes') fix(m.target); else m.addedNodes.forEach(fix); }))
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  const COLORS = { white: '#ffffff', pink: '#ffe0ec', butter: '#fff5c8', mint: '#dcf5e7', lilac: '#eadfff', sky: '#dcedff', peach: '#ffe9d6' };
  const COLOR_NAMES = Object.keys(COLORS);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const tilt = () => +(Math.random() * 4 - 2).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let board = null, view = { x: 0, y: 0, z: 1 }, sel = new Set(), editing = null, space = false, focusSet = null;

  // ---------- boards ----------
  const TEMPLATES = {
    'Dream it': () => ({ cards: (window.STARTER_DREAM || []).map(c => ({ ...JSON.parse(JSON.stringify(c)), id: uid() })), tray: [], view: { x: 360, y: 150, z: 1 } }),
    'Moodboard': () => ({ cards: [
      card('title', { x: 0, y: -40, text: 'Moodboard' }),
      card('note', { x: 0, y: 60, text: 'The feeling in three words:', color: 'butter' }),
      card('note', { x: 250, y: 60, text: 'References I love (drop images here)', color: 'pink' }),
      card('note', { x: 500, y: 60, text: 'Colors (pull them from an image ✦)', color: 'mint' }),
      card('swatch', { x: 0, y: 260, hex: '#ff9ec4', label: 'blush' }), card('swatch', { x: 130, y: 260, hex: '#fff5c8', label: 'butter' }), card('swatch', { x: 260, y: 260, hex: '#7ad3a3', label: 'mint' }),
      card('todo', { x: 500, y: 240, text: 'next', items: [{ t: 'Find 10 references', done: false }, { t: 'Pick a type pairing', done: false }, { t: 'Share with the team', done: false }] }),
    ], tray: [] }),
    'App plan': () => ({ cards: [
      card('title', { x: 0, y: -40, text: 'App plan' }),
      card('note', { x: 0, y: 60, text: 'Who is it for?', color: 'sky' }), card('note', { x: 250, y: 60, text: 'What problem does it solve?', color: 'pink' }),
      card('note', { x: 500, y: 60, text: 'The one thing it does best', color: 'butter' }),
      card('todo', { x: 0, y: 260, text: 'screens', items: [{ t: 'Onboarding', done: false }, { t: 'Home', done: false }, { t: 'Settings', done: false }] }),
      card('note', { x: 280, y: 260, text: 'Competitors + what they miss', color: 'lilac' }),
    ], tray: [] }),
    'Brain dump': () => ({ cards: [card('title', { x: 0, y: -40, text: 'Brain dump' }), card('note', { x: 0, y: 60, text: 'Dump everything in Unsorted with ⌘K, then ask Mochi to sort it ✦', color: 'butter' })],
      tray: ['call the printer', 'idea: animated logo', 'that font from the cafe menu', 'reply to Sam', 'moodboard for spring'].map(t => card('note', { text: t })) }),
  };
  function card(type, o = {}) {
    const size = { note: [220, 140], title: [320, 50], image: [260, 220], link: [260, 210], todo: [240, 180], swatch: [120, 150], coll: [288, 200], doc: [240, 52], canvas: [260, 180], shape: [160, 160], stamp: [56, 56], audio: [290, 150], video: [360, 246], ink: [10, 10], frame: [393, 852], box: [160, 100], text: [220, 24], icon: [28, 28], font: [300, 210], table: [360, 60], file: [230, 214], folder: [460, 380] }[type] || [220, 140];
    return Object.assign({ id: uid(), type, x: 0, y: 0, w: size[0], h: size[1], r: type === 'title' ? 0 : tilt(), color: 'white' }, o);
  }
  function newBoard(name = 'Untitled board', tpl) {
    const b = { id: uid(), name, color: COLOR_NAMES[1 + Math.floor(Math.random() * 6)], cards: [], links: [], tray: [], styles: { colors: [], text: [] }, view: { x: 160, y: 140, z: 1 } };
    if (tpl) { const t = TEMPLATES[tpl](); b.cards = t.cards; b.tray = t.tray; b.name = tpl; if (t.view) b.view = t.view; }
    return b;
  }
  // ---------- the library: projects hold folders, folders hold boards ----------
  // stored as one small file: { projects: [{id, name, color, open}], folders: [{id, name, project, open}] }
  let projects = [], folders = [], boardList = [];
  const saveLib = () => MB.saveFolders({ projects, folders });
  const byName = (arr, name) => arr.find(x => x.name.trim().toLowerCase() === String(name || '').trim().toLowerCase());
  const findFolder = name => byName(folders, name);
  function makeProject(name) { const p = byName(projects, name) || { id: uid(), name: String(name).trim() || 'New project', color: COLOR_NAMES[1 + projects.length % 6], open: true }; if (!projects.includes(p)) projects.push(p); return p; }
  function makeFolder(name, projectId = null) { const f = findFolder(name) || { id: uid(), name: String(name).trim() || 'New folder', project: projectId, open: true }; if (!folders.includes(f)) folders.push(f); return f; }
  // canvases (boards inside boards) live under their parent board, not loose in a folder
  const topLevel = b => !b.parent || !boardList.some(x => x.id === b.parent);
  const boardsIn = fid => boardList.filter(b => b.folder === fid && topLevel(b));
  // folders can live inside other folders: f.parent is the folder it sits in (its project comes along with it)
  const hasParent = f => !!f.parent && folders.some(x => x.id === f.parent);
  const subFolders = fid => folders.filter(f => f.parent === fid);
  const foldersIn = pid => folders.filter(f => !hasParent(f) && (f.project || null) === pid && (pid === null || projects.some(p => p.id === pid)));
  const looseFolders = () => folders.filter(f => !hasParent(f) && (!f.project || !projects.some(p => p.id === f.project)));
  const folderChain = f => { const out = []; let x = f; while (x && out.length < 30) { out.unshift(x); x = folders.find(y => y.id === x.parent); } return out; };   // outermost first
  const holdsBoard = f => !!board && (boardsIn(f.id).some(b => b.id === board.id) || subFolders(f.id).some(holdsBoard));
  const boardsUnder = f => boardsIn(f.id).length + subFolders(f.id).reduce((n, x) => n + boardsUnder(x), 0);
  const setProject = (f, pid) => { f.project = pid; subFolders(f.id).forEach(x => setProject(x, pid)); };
  // move a folder into another folder, a project, or out to the top level (never into itself)
  function putFolder(fid, into, projectId = null) {
    const x = folders.find(y => y.id === fid); if (!x || (into && folderChain(into).includes(x))) return false;
    if (into) { x.parent = into.id; setProject(x, into.project || null); into.open = true; } else { delete x.parent; setProject(x, projectId); }
    return true;
  }
  const looseBoards = () => boardList.filter(b => (!b.folder || !folders.some(f => f.id === b.folder)) && topLevel(b));
  const tint = c => COLORS[c] && c !== 'white' ? `var(--${c === 'pink' ? 'pink' : c + '-deep'})` : 'var(--pink)';
  // colors for filing: boards, folders and projects each carry one, picked from the dots in the left box (or the right-click menu)
  const FILE_COLORS = ['pink', 'butter', 'mint', 'lilac', 'sky', 'peach'];
  const DEEP = { pink: '#f27aa8', butter: '#f3d96a', mint: '#7ad3a3', lilac: '#b89bff', sky: '#8cc1ff', peach: '#ffb48a' };
  const ficBg = c => DEEP[c] ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 17 14'%3E%3Cpath d='M1.5 3A1.6 1.6 0 0 1 3.1 1.4h3.3c.5 0 .9.2 1.2.6l.9 1.1h5.4a1.6 1.6 0 0 1 1.6 1.6v6.8a1.6 1.6 0 0 1-1.6 1.6H3.1a1.6 1.6 0 0 1-1.6-1.6z' fill='%23${DEEP[c].slice(1)}' stroke='%23494848' stroke-width='1.3' stroke-linejoin='round'/%3E%3C/svg%3E")` : '';
  const colorDots = (kind, cur) => `<div class="rm-colors">${kind === 'folder' ? `<button data-fc="" class="${cur ? '' : 'on'}" title="No color" aria-label="No color"><i class="none"></i></button>` : ''}${FILE_COLORS.map(c => `<button data-fc="${c}" class="${c === cur ? 'on' : ''}" title="${c}" aria-label="${c}"><i style="background:${tint(c)}"></i></button>`).join('')}</div>`;
  async function setFileColor(kind, obj, c) {
    if (kind === 'board') { if (board && board.id === obj.id) { board.color = c; save(); } else { const b = await MB.load(obj.id); if (!b) return; b.color = c; await MB.save(b); } }
    else { const live = [...projects, ...folders].find(x => x.id === obj.id) || obj; if (c) live.color = c; else delete live.color; await saveLib(); }
    await refreshBoards();
  }
  // click a row's little dot (or folder icon): just the colors
  function colorPop(e, kind, obj) {
    e.preventDefault(); e.stopPropagation(); $('rowMenu')?.remove();
    const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu color-pop'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 8 + 'px';
    m.innerHTML = `<div class="dm-h">Color</div>${colorDots(kind, obj.color)}`; document.body.appendChild(m); fitMenu(m);
    m.onclick = ev => { const b = ev.target.closest('[data-fc]'); if (!b) return; m.remove(); setFileColor(kind, obj, b.dataset.fc); };
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true));
  }
  // any right-click menu or color pop: keep it inside the window, and Esc closes just the menu (before Home or the board hear it)
  function fitMenu(m) { const r = m.getBoundingClientRect(); if (r.right > innerWidth - 10) m.style.left = Math.max(10, innerWidth - r.width - 10) + 'px'; if (r.bottom > innerHeight - 10) m.style.top = Math.max(10, innerHeight - r.height - 10) + 'px'; }
  addEventListener('keydown', e => { if (e.key !== 'Escape' || !$('rowMenu')) return; $('rowMenu').remove(); $('rowSub')?.remove(); e.preventDefault(); e.stopImmediatePropagation(); }, true);
  const shownProjects = () => projects.filter(p => !p.archived);   // archived projects stay on disk, out of the lists, until restored
  // moving a board into a folder (or out of one). A canvas that lived inside another board comes out on its own.
  async function moveBoard(id, folderId) {
    await unhook(id);
    if (board && board.id === id) { board.folder = folderId; delete board.parent; await MB.save(board); renderCrumbsSoon(); return; }
    const b = await MB.load(id); if (!b) return; b.folder = folderId; delete b.parent; await MB.save(b);
  }
  // ---------- canvases can go anywhere: inside another board (as a canvas card there), into a folder, or out on their own ----------
  const insideOf = (id, maybeAncestor) => { let b = boardList.find(x => x.id === id), n = 0; while (b && b.parent && n++ < 40) { if (b.parent === maybeAncestor) return true; b = boardList.find(x => x.id === b.parent); } return false; };
  async function editBoard(id, fn) {
    if (board && board.id === id) { fn(board); renderAll(); save(); return board; }
    const b = await MB.load(id); if (!b) return null; fn(b); await MB.save(b); return b;
  }
  // take a canvas's card off the board it sat inside
  async function unhook(id) {
    const kid = boardList.find(x => x.id === id) || (board && board.id === id ? board : null), p = kid && kid.parent; if (!p) return;
    await editBoard(p, pb => { const gone = new Set(pb.cards.filter(c => c.type === 'canvas' && c.board === id).map(c => c.id)); pb.cards = pb.cards.filter(c => !gone.has(c.id)); pb.links = (pb.links || []).filter(l => !gone.has(l.a) && !gone.has(l.b)); });
  }
  // put a board inside another one, as a canvas card (at a spot, or to the right of what's there)
  async function nestBoard(id, intoId, at) {
    if (id === intoId || insideOf(intoId, id)) { chirp("A board can't go inside itself ✦", 2500); return false; }
    const kid = boardList.find(x => x.id === id) || (board && board.id === id ? board : null); if (!kid || kid.parent === intoId) return false;
    const into = board && board.id === intoId ? board : await MB.load(intoId); if (!into) return false;
    await unhook(id);
    await editBoard(id, b => { b.parent = intoId; b.folder = into.folder || null; });
    await editBoard(intoId, pb => { const x = at ? at.x : pb.cards.length ? Math.max(...pb.cards.map(c => c.x + c.w)) + 60 : 0, y = at ? at.y : pb.cards.length ? Math.min(...pb.cards.map(c => c.y)) : 0; pb.cards.push(card('canvas', { x, y, text: kid.name, board: id })); });
    chirp(`Moved “${kid.name}” inside “${into.name}” ✦`, 3000); return true;
  }
  const renderCrumbsSoon = () => setTimeout(() => typeof renderCrumbs === 'function' && renderCrumbs(), 50);
  async function loadLib() {
    const [list, lib] = await Promise.all([MB.list(), MB.folders().catch(() => null)]);
    boardList = list;
    if (Array.isArray(lib)) { projects = []; folders = lib; }   // folders saved before projects existed
    else { projects = (lib && lib.projects) || []; folders = (lib && lib.folders) || []; }
  }
  // drag and drop between rows and tiles: boards go into folders, folders go into projects
  const dropZone = (el, kind, onDrop) => {
    el.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes('mb/' + kind)) return; e.preventDefault(); e.stopPropagation(); el.classList.add('drop'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('drop'); });
    el.addEventListener('drop', async e => { const id = e.dataTransfer.getData('mb/' + kind); if (!id) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('drop'); await onDrop(id); await saveLib(); refreshBoards(); });
  };
  const draggable = (el, kind, id) => { el.draggable = true; el.ondragstart = e => { e.stopPropagation(); e.dataTransfer.setData('mb/' + kind, id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); }; el.ondragend = () => el.classList.remove('dragging'); };
  function inlineRename(el, obj, after) {
    el.contentEditable = 'true'; el.focus(); getSelection().selectAllChildren(el);
    el.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } if (ev.key === 'Escape') { el.textContent = obj.name; el.blur(); } ev.stopPropagation(); };
    el.onblur = async () => { el.contentEditable = 'false'; const v = el.textContent.trim();
      // the list may have reloaded while you typed, so rename the current copy (found by id), not the one we started with
      const liveObj = [...projects, ...folders].find(x => x.id === obj.id) || obj; if (v) { liveObj.name = v; obj.name = v; }
      await (after ? after(v) : saveLib()); renamingNow = false; refreshBoards(); };
  }
  async function newBoardIn(folderId) { const b = newBoard(); b.folder = folderId; await MB.save(b); closeHome(); await openBoard(b.id); $('boardName').focus(); $('boardName').select(); }

  // ---------- right-click in the left box: duplicate or delete a board, folder or project ----------
  // copying a board also copies the canvases inside it, so the copy doesn't share them
  async function copyBoard(id, into = {}) {
    const b = await MB.load(id); if (!b) return null;
    const c = JSON.parse(JSON.stringify(b)); c.id = uid(); Object.assign(c, into);
    for (const k of c.cards) if (k.type === 'canvas' && k.board) { const kid = await copyBoard(k.board, { parent: c.id, folder: c.folder || null }); if (kid) k.board = kid.id; }
    await MB.save(c); return c;
  }
  async function dropBoard(id) { for (const k of boardList.filter(x => x.parent === id)) await dropBoard(k.id); await MB.remove(id); }
  async function duplicate(kind, obj) {
    if (kind === 'board') { const c = await copyBoard(obj.id, { name: obj.name + ' copy' }); await refreshBoards(); if (c) chirp(`Made “${c.name}” ✦`, 3500); return; }
    // copy a folder, the folders inside it and all their boards
    const copyFolder = async (f0, name, project, parent) => { const f = { id: uid(), name, project, open: true }; if (parent) f.parent = parent; folders.push(f); await saveLib();
      for (const b of boardsIn(f0.id)) await copyBoard(b.id, { folder: f.id });
      for (const x of subFolders(f0.id)) await copyFolder(x, x.name, project, f.id); };
    if (kind === 'folder') await copyFolder(obj, obj.name + ' copy', obj.project || null, obj.parent || null);
    if (kind === 'project') { const p = { id: uid(), name: obj.name + ' copy', color: obj.color, open: true }; projects.push(p); await saveLib();
      for (const f0 of foldersIn(obj.id)) await copyFolder(f0, f0.name, p.id, null); }
    await refreshBoards(); chirp(`Made “${obj.name} copy” ✦`, 3500);
  }
  async function destroy(kind, obj) {
    const all = f => [f, ...subFolders(f.id).flatMap(all)];   // a folder and every folder inside it
    const gone = kind === 'folder' ? all(obj) : kind === 'project' ? foldersIn(obj.id).flatMap(all) : [];
    const ids = kind === 'board' ? [obj.id] : gone.flatMap(f => boardsIn(f.id).map(b => b.id));
    for (const id of ids) await dropBoard(id);
    folders = folders.filter(f => !gone.includes(f));
    if (kind === 'project') projects = projects.filter(p => p !== obj);
    await saveLib(); await refreshBoards();
    if (board && ids.includes(board.id)) { let list = await MB.list(); if (!list.length) { const b = newBoard('My first board'); await MB.save(b); list = await MB.list(); } await openBoard(list[0].id); }
  }
  // Move to…: a little map of projects and folders; pick where it goes
  function moveMenu(m, kind, obj) {
    const here = kind === 'board' ? obj.folder || null : obj.parent ? 'f:' + obj.parent : obj.project || null, row = (id, label, depth, icon) =>
      `<button class="mv-row${id === here ? ' here' : ''}" data-to="${id ?? ''}" style="padding-left:${12 + depth * 16}px">${icon}<span>${esc(label)}</span>${id === here ? '<em>here</em>' : ''}</button>`;
    const FIC = '<i class="fic"></i>', PIC = c => `<i class="pic" style="background:${tint(c)}"></i>`;
    let h = `<div class="mv-head">Move “${esc(obj.name)}” to…</div><div class="mv-list">`;
    const tree = (f, d) => { if (kind === 'folder' && f.id === obj.id) return; h += row(kind === 'board' ? f.id : 'f:' + f.id, f.name, d, FIC); subFolders(f.id).forEach(x => tree(x, d + 1)); };
    if (kind === 'board') {
      shownProjects().forEach(p => { h += `<div class="mv-group" style="padding-left:12px">${PIC(p.color)}<span>${esc(p.name)}</span></div>`; foldersIn(p.id).forEach(f => tree(f, 1)); if (!foldersIn(p.id).length) h += '<div class="mv-none">no folders yet</div>'; });
      looseFolders().forEach(f => tree(f, 0));
      h += row(null, 'Not in a folder', 0, '<i class="mv-dot"></i>');
    } else {
      shownProjects().forEach(p => { h += row(p.id, p.name, 0, PIC(p.color)); foldersIn(p.id).forEach(f => tree(f, 1)); });
      looseFolders().forEach(f => tree(f, 0));
      h += row(null, 'Not in a project', 0, '<i class="mv-dot"></i>');
    }
    m.innerHTML = h + '</div>'; m.classList.add('mv');
    const r = m.getBoundingClientRect(); if (r.bottom > innerHeight - 10) m.style.top = Math.max(10, innerHeight - r.height - 10) + 'px';
    m.onclick = async ev => { const b = ev.target.closest('[data-to]'); if (!b) return; const to = b.dataset.to || null; m.remove(); if (to === here && !(kind === 'board' && obj.parent)) return;
      if (kind === 'board') { await moveBoard(obj.id, to); const f = folders.find(x => x.id === to); if (f) { f.open = true; const p = projects.find(x => x.id === f.project); if (p) p.open = true; } }
      else if (to && to.startsWith('f:')) { const into = folders.find(x => x.id === to.slice(2)); if (!putFolder(obj.id, into)) return chirp("A folder can't go inside itself ✦", 2500); }
      else { putFolder(obj.id, null, to); const p = projects.find(x => x.id === to); if (p) p.open = true; }
      await saveLib(); await refreshBoards(); const dest = folders.find(x => x.id === to || 'f:' + x.id === to) || projects.find(x => x.id === to); chirp(`Moved “${obj.name}” ${dest ? 'to “' + dest.name + '”' : kind === 'board' ? 'out of its folder' : 'out of its project'} ✦`, 3500); };
  }
  async function renameBoard(b, v) { if (!v) return; if (board && board.id === b.id) { board.name = v; $('boardName').value = v; save(); } else { const bb = await MB.load(b.id); if (bb) { bb.name = v; await MB.save(bb); } } }
  function rowMenu(e, kind, obj, nameEl) {
    e.preventDefault(); e.stopPropagation(); $('rowMenu')?.remove();
    const n = kind === 'board' ? 1 + boardList.filter(x => x.parent === obj.id).length : kind === 'folder' ? boardsUnder(obj) : foldersIn(obj.id).reduce((t, f) => t + boardsUnder(f), 0);
    const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    m.innerHTML = `${nameEl ? '<button data-m="ren">Rename</button>' : ''}${kind !== 'project' ? '<button data-m="move">Move to…</button>' : ''}${kind === 'board' && obj.parent ? '<button data-m="out">Make it its own board</button>' : ''}<button data-m="dup">Duplicate</button>${kind === 'project' ? `<button data-m="arch">${obj.archived ? 'Restore from archive' : 'Archive'}</button>` : ''}<span class="rm-sep"></span><div class="dm-h">Color</div>${colorDots(kind, obj.color)}<span class="rm-sep"></span><button data-m="del" class="danger">Delete</button>`;
    document.body.appendChild(m); fitMenu(m);
    m.onclick = async ev => {
      const col = ev.target.closest('[data-fc]'); if (col) { m.remove(); return setFileColor(kind, obj, col.dataset.fc); }
      const a = ev.target.closest('[data-m]')?.dataset.m; if (!a) return;
      if (a === 'arch') { m.remove(); return archiveProject(obj, !obj.archived); }
      if (a === 'ren') { m.remove(); return inlineRename(nameEl, obj, kind === 'board' ? v => renameBoard(obj, v) : undefined); }
      if (a === 'dup') { m.remove(); return duplicate(kind, obj); }
      if (a === 'move') return moveMenu(m, kind, obj);
      if (a === 'out') { m.remove(); const pb = boardList.find(x => x.id === obj.parent); await moveBoard(obj.id, pb ? pb.folder || null : null); await refreshBoards(); return chirp(`“${obj.name}” is its own board now ✦`, 3000); }
      if (a === 'del') { // ask first: deleting can't be undone
        const what = kind === 'board' ? (n > 1 ? `and the ${n - 1} canvas${n > 2 ? 'es' : ''} inside it` : '') : n ? `and the ${n} board${n === 1 ? '' : 's'} inside it` : '';
        m.innerHTML = `<p>Delete “${esc(obj.name)}” ${what}? This can't be undone.</p><div><button data-m="yes" class="danger solid">Delete</button><button data-m="no">Cancel</button></div>`; return; }
      if (a === 'yes') { m.remove(); return destroy(kind, obj); }
      if (a === 'no') m.remove();
    };
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true));
  }

  // the little row buttons use the same line icons as the toolbar
  const FB = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const FBTN = { add: FB('<path d="M10 4.5v11M4.5 10h11"/>'), ren: FB('<path d="M13.5 3.5l3 3L8 15l-4 1 1-4z"/><path d="M11.5 5.5l3 3"/>'), del: FB('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>') };
  // the left box: a small tree (projects ▸ folders ▸ boards)
  function boardRow(b) {
    const r = document.createElement('div'); r.className = 'board-row' + (board && b.id === board.id ? ' on' : '');
    r.innerHTML = `<i style="background:${tint(b.color)}"></i><span></span>`; r.querySelector('span').textContent = b.name;
    // one click opens the board; a double-click renames it right here (so wait a beat to tell them apart)
    let tap = 0; const name = r.querySelector('span');
    r.onclick = () => { if (name.isContentEditable) return; clearTimeout(tap); tap = setTimeout(() => { closeHome(); openBoard(b.id); }, 230); };
    r.ondblclick = e => { e.stopPropagation(); clearTimeout(tap); inlineRename(name, b, v => renameBoard(b, v)); };
    const pen = document.createElement('button'); pen.className = 'f-btn'; pen.title = 'Rename'; pen.innerHTML = FBTN.ren; r.appendChild(pen);
    pen.onclick = e => { e.stopPropagation(); clearTimeout(tap); inlineRename(name, b, v => renameBoard(b, v)); };
    const dot = r.querySelector('i'); dot.title = 'Color'; dot.onclick = e => { clearTimeout(tap); colorPop(e, 'board', b); };
    draggable(r, 'board', b.id); dropZone(r, 'board', id => nestBoard(id, b.id)); r.oncontextmenu = e => rowMenu(e, 'board', b, name);
    const kids = boardList.filter(x => x.parent === b.id); if (!kids.length) return r;
    const frag = document.createDocumentFragment(), sub = document.createElement('div'); sub.className = 'sub-boards';
    kids.forEach(k => sub.appendChild(boardRow(k))); frag.appendChild(r); frag.appendChild(sub); return frag;
  }
  function treeNode(obj, kind, count, kids, btns) {
    const wrap = document.createElement('div'); wrap.className = 'node ' + kind + (obj.open ? ' open' : '');
    wrap.innerHTML = `<div class="node-head"><span class="chev">▶</span><span class="${kind === 'project' ? 'pic' : 'fic'}"></span><span class="fname"></span><small>${count}</small>${btns.map(([a, t, s]) => `<button class="f-btn" data-a="${a}" title="${t}">${FBTN[a] || s}</button>`).join('')}</div><div class="node-body"></div>`;
    const ic = wrap.querySelector('.pic, .fic'); ic.title = 'Color'; ic.onclick = e => colorPop(e, kind, obj);
    if (kind === 'project') ic.style.background = tint(obj.color); else if (obj.color) ic.style.backgroundImage = ficBg(obj.color);
    const name = wrap.querySelector('.fname'), body = wrap.querySelector('.node-body'); name.textContent = obj.name;
    kids.forEach(k => body.appendChild(k));
    if (!kids.length) body.innerHTML = `<div class="folder-empty">${kind === 'project' ? 'No folders yet' : 'Drag boards in here'}</div>`;
    name.ondblclick = e => { e.stopPropagation(); inlineRename(name, obj); };
    return { wrap, name };
  }
  function folderNode(f) {
    const inside = boardsIn(f.id), subs = subFolders(f.id); if (holdsBoard(f)) f.open = true;
    const { wrap, name } = treeNode(f, 'folder', inside.length + subs.length, [...subs.map(folderNode), ...inside.map(boardRow)], [['add', 'New board in this folder', '+'], ['ren', 'Rename', '✎']]);
    wrap.querySelector('.node-head').onclick = async e => {
      const a = e.target.closest('.f-btn')?.dataset.a;
      if (a === 'add') return newBoardIn(f.id);
      if (a === 'ren') return inlineRename(name, f);
      if (a === 'del') { for (const b of inside) await moveBoard(b.id, null); subs.forEach(x => { x.parent = f.parent; if (!x.parent) delete x.parent; }); folders = folders.filter(x => x !== f); await saveLib(); return refreshBoards(); }
      if (name.isContentEditable) return;
      f.open = !f.open; wrap.classList.toggle('open', f.open); saveLib();
    };
    draggable(wrap.querySelector('.node-head'), 'folder', f.id); wrap.querySelector('.node-head').oncontextmenu = e => rowMenu(e, 'folder', f, name);
    dropZone(wrap.querySelector('.node-head'), 'board', id => moveBoard(id, f.id).then(() => { f.open = true; }));
    dropZone(wrap.querySelector('.node-head'), 'folder', id => { if (!putFolder(id, f)) chirp("A folder can't go inside itself ✦", 2500); });
    return wrap;
  }
  function projectNode(p) {
    const fs = foldersIn(p.id); if (fs.some(holdsBoard)) p.open = true;
    const { wrap, name } = treeNode(p, 'project', fs.length, fs.map(folderNode), [['add', 'New folder in this project', '+'], ['ren', 'Rename', '✎']]);
    wrap.querySelector('.node-head').onclick = async e => {
      const a = e.target.closest('.f-btn')?.dataset.a;
      if (a === 'add') { const f = makeFolder(uniqueName(folders, 'New folder'), p.id); p.open = true; await saveLib(); await refreshBoards(); return renameNewest('.node.folder', f); }
      if (a === 'ren') return inlineRename(name, p);
      if (a === 'del') { fs.forEach(f => f.project = null); projects = projects.filter(x => x !== p); await saveLib(); return refreshBoards(); }
      if (name.isContentEditable) return;
      p.open = !p.open; wrap.classList.toggle('open', p.open); saveLib();
    };
    wrap.querySelector('.node-head').oncontextmenu = e => rowMenu(e, 'project', p, name);
    dropZone(wrap.querySelector('.node-head'), 'folder', id => { putFolder(id, null, p.id); p.open = true; });
    return wrap;
  }
  // ---------- connected folders: folders on this computer that someone picked in the folder picker. Nothing else is ever looked at,
  // and disconnecting only forgets the folder (the files never move). Listed under "On your Mac" in the left box and in Settings → General ----------
  let connected = [];
  const CFIC = '<svg class="cfic" viewBox="0 0 20 16" aria-hidden="true"><path d="M1.5 3.2A1.6 1.6 0 0 1 3.1 1.6h3.3c.5 0 .9.2 1.2.6l.9 1.1h5.4a1.6 1.6 0 0 1 1.6 1.6v6.6a1.6 1.6 0 0 1-1.6 1.6H3.1a1.6 1.6 0 0 1-1.6-1.6z"/><circle cx="15" cy="11" r="4.2"/><path d="M13.6 12.4l2.8-2.8M13 10.8l-.5.5a1 1 0 0 0 1.4 1.4l.5-.5M16.9 11.2l.5-.5a1 1 0 0 0-1.4-1.4l-.5.5"/></svg>';
  // the left box asks often (after every save); the folder counts underneath (a whole home folder for "All my files") are re-read at most every 20 s
  let connectedAt = 0;
  async function connectedFresh() { if (Date.now() - connectedAt < 20000) return connected; connectedAt = Date.now(); return loadConnected(); }
  async function loadConnected() { try { connected = (await MB.connected()) || []; } catch (e) { connected = []; } return connected; }
  const cfCount = f => f.missing ? 'Can’t find it' : f.count === 1 ? '1 thing' : `${f.count} things`;
  async function connectFolder() {
    try {
      const r = await MB.connectFolder(); connected = r.folders || []; renderConnected();
      connectedSaid(r.added); return r.added || [];
    } catch (e) { say(e.message, 5000); return []; }
  }
  async function connectPaths(paths) { try { const r = await MB.connectPaths(paths); connected = r.folders || []; renderConnected(); connectedSaid(r.added); return r.added || []; } catch (e) { say(e.message, 5000); return []; } }
  // the left box takes folders too: drop one from Finder on it to connect it (no card on the board)
  function connectDropZone(el) {
    el.addEventListener('dragover', e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); el.classList.add('cf-drop'); });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('cf-drop'); });
    el.addEventListener('drop', async e => { if (![...(e.dataTransfer?.types || [])].includes('Files')) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('cf-drop');
      const paths = window.__dropPaths || []; window.__dropPaths = null; if (!paths.length) return;
      let info = {}; try { info = (await MB.fileInfo(paths)) || {}; } catch (e2) {} const dirs = paths.filter(p => info[p]?.dir);
      if (!dirs.length) return say('Drop a folder here to connect it. Files go on the board ✦', 5000); connectPaths(dirs); });
  }
  const connectedSaid = added => { if (!added?.length) return;
    say(added.length === 1 ? `${added[0] === 'All my files' ? 'All your files are' : `“${added[0]}” is`} connected ✦ Find ${added[0] === 'All my files' ? 'them' : 'it'} under On your Mac, in the left box.` : `${added.length} folders are connected ✦ They’re under On your Mac, in the left box.`, 5000); };
  // "All my files" is a lot to hand over, so it always asks once first (in Settings → General → Your files)
  function askAllFiles() { $('gearBtn').click(); setTab('general'); $('cfAsk').hidden = false; setTimeout(() => $('cfAsk').scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }
  async function connectAll() { $('cfAsk').hidden = true; try { const r = await MB.connectAll(); connected = r.folders || []; renderConnected(); connectedSaid(r.added); } catch (e) { say(e.message, 5000); } }
  async function disconnectFolder(f) { connected = (await MB.disconnectFolder(f.id)) || []; renderConnected(); chirp(`Disconnected “${f.name}”. Your files are right where they were ✦`, 4000); }
  async function openConnected(f) { try { await MB.revealConnected(f.id); } catch (e) { say(e.message, 5000); await loadConnected(); renderConnected(); } }
  function connectedMenu(e, f) {
    e.preventDefault(); e.stopPropagation(); $('rowMenu')?.remove();
    const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    m.innerHTML = `${f.missing || !board ? '' : '<button data-m="board">Show on the board</button>'}${f.missing ? '' : '<button data-m="open">Show in Finder</button>'}<button data-m="add">Connect another folder</button>${connected.some(x => x.all) ? '' : '<button data-m="all">Connect all my files…</button>'}<span class="rm-sep"></span><button data-m="off" class="danger">Disconnect</button>`;
    document.body.appendChild(m); fitMenu(m);
    m.onclick = ev => { const a = ev.target.closest('[data-m]')?.dataset.m; if (!a) return; m.remove();
      if (a === 'board') putFolderCard(f, centerWorld()); if (a === 'open') openConnected(f); if (a === 'add') connectFolder(); if (a === 'all') askAllFiles(); if (a === 'off') disconnectFolder(f); };
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true));
  }
  // the left box: a quiet "On your Mac" group, or one small link to connect the first folder
  function connectedSide() {
    const sec = document.createElement('div'); sec.className = 'cf-side'; sec.id = 'cfSide'; if (MB.native) connectDropZone(sec);
    if (!connected.length) { sec.innerHTML = '<button class="arch-link cf-first" title="Or drag a folder here from Finder">+ Connect a folder from your Mac</button>'; sec.firstChild.onclick = connectFolder; return sec; }
    sec.innerHTML = `<div class="cf-label"><span class="label">On your Mac</span><button class="f-btn" title="Connect a folder">${FBTN.add}</button></div>`;
    sec.querySelector('.f-btn').onclick = connectFolder;
    connected.forEach(f => {
      const r = document.createElement('div'); r.className = 'node-head cf-row' + (f.missing ? ' missing' : ''); r.title = f.missing ? `I can’t find this folder (${f.path}). Was it moved or renamed?` : `${f.all ? 'Everything in your home folder' : f.path}\nClick to open it in Finder, or drag it onto the board to see inside`;
      r.innerHTML = `${CFIC}<span class="fname"></span><small>${f.missing ? '?' : f.count}</small>`; r.querySelector('.fname').textContent = f.name;
      r.onclick = () => openConnected(f); r.oncontextmenu = e => connectedMenu(e, f);
      if (!f.missing) { r.draggable = true; r.ondragstart = ev => { ev.dataTransfer.setData('mb/cfolder', f.id); ev.dataTransfer.effectAllowed = 'copy'; }; }   // drag it onto the board to see inside
      sec.appendChild(r);
    });
    return sec;
  }
  // Settings → General → Your files
  function renderConnected() {
    const side = $('cfSide'); if (side) side.replaceWith(connectedSide());
    const list = $('cfList'); if (!list) return;
    $('cfAllRow').hidden = connected.some(f => f.all); if ($('cfAllRow').hidden) $('cfAsk').hidden = true;
    list.innerHTML = ''; list.hidden = !connected.length;
    connected.forEach(f => {
      const r = document.createElement('div'); r.className = 'cf-item' + (f.missing ? ' missing' : '');
      r.innerHTML = `${CFIC}<div class="cf-text"><b></b><small></small></div><div class="set-btns">${f.missing ? '' : '<button class="set-btn" data-a="open">Show in Finder</button>'}<button class="set-btn" data-a="off">Disconnect</button></div>`;
      r.querySelector('b').textContent = f.name; r.querySelector('small').textContent = `${f.all ? 'Everything in your home folder' : f.path} · ${cfCount(f)}${f.missing ? '. Was it moved or renamed?' : ''}`;
      r.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'open') openConnected(f); if (a === 'off') disconnectFolder(f); };
      list.appendChild(r);
    });
  }
  // ---------- file cards and folder cards: things on this computer, shown live on the board. Read-only: the board shows and opens files, it never changes them.
  // A file card points at one file (dropped in from Finder, picked, or dragged out of a folder card). A folder card shows a connected folder's contents and keeps up as they change ----------
  const FDATA = new Map(), FINFO = new Map(), THUMBS = new Map();   // folder listings (by card), file details (by path), previews (by path + when it last changed)
  const FINDER = MB.platform === 'windows' ? 'File Explorer' : 'Finder';
  const pathSep = p => /\\/.test(p) && !/\//.test(p) ? '\\' : '/';
  const joinP = (a, b) => b ? String(a).replace(/[\\/]+$/, '') + pathSep(a) + b : a;
  const baseName = p => String(p || '').split(/[\\/]/).filter(Boolean).pop() || String(p || '');
  const extOfP = p => { const n = baseName(p), i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
  const parentP = p => String(p).replace(/[\\/][^\\/]*[\\/]?$/, '') || p;
  const dirOf = c => joinP(c.path, c.sub || '');
  const fsize = n => !n ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB` : `${(n / 1073741824).toFixed(1)} GB`;
  const fago = t => { if (!t) return ''; const d = (Date.now() / 1000 - t) / 86400; return d < 1 / 24 ? 'edited just now' : d < 1 ? `edited ${Math.round(d * 24)}h ago` : d < 2 ? 'edited yesterday' : d < 30 ? `edited ${Math.round(d)} days ago` : 'edited ' + new Date(t * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d > 300 ? { year: 'numeric' } : {}) }); };
  const FKIND = { pdf: 'PDF', jpg: 'JPEG', jpeg: 'JPEG', md: 'Markdown', txt: 'Text', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel', ppt: 'PowerPoint', pptx: 'PowerPoint', key: 'Keynote', fig: 'Figma', psd: 'Photoshop', ai: 'Illustrator', mov: 'Movie', mp4: 'Video', mp3: 'Audio', m4a: 'Audio', wav: 'Audio', zip: 'Zip', csv: 'CSV' };
  // a little colored tag for the kind of file, so a wall of files still reads at a glance
  const FGROUP = [[/^(pdf|docx?|pages|txt|md|rtf|odt)$/, '#ffc8a6'], [/^(png|jpe?g|gif|webp|heic|svg|tiff?|bmp)$/, '#a8e6c3'], [/^(fig|sketch|psd|ai|xd|afdesign|indd)$/, '#cdb8ff'],
    [/^(xlsx?|numbers|csv|tsv)$/, '#b9ecd0'], [/^(mov|mp4|m4v|webm|mp3|m4a|wav|aiff?)$/, '#aed3ff'], [/^(key|pptx?)$/, '#f8e08a'], [/^(js|ts|jsx|tsx|py|swift|rs|html?|css|json|sh)$/, '#f6e7a8']];
  const fTint = ext => (FGROUP.find(g => g[0].test(ext || '')) || [0, '#e4dfe7'])[1];
  const fBadge = ext => `<i class="fl-badge" style="--fb:${fTint(ext)}">${esc((ext || 'file').slice(0, 4).toUpperCase())}</i>`;
  const FOLDIC = '<svg class="fo-dir" viewBox="0 0 40 32" aria-hidden="true"><path d="M3 7.5A3.5 3.5 0 0 1 6.5 4h8.3c.9 0 1.7.4 2.3 1.1L19.5 8H33.5A3.5 3.5 0 0 1 37 11.5v13A3.5 3.5 0 0 1 33.5 28h-27A3.5 3.5 0 0 1 3 24.5z"/><path d="M3 12h34"/></svg>';
  const fileLine = c => { const inf = FINFO.get(c.path) || {}; return [c.kind && c.kind.length < 22 ? c.kind : FKIND[c.ext] || (c.ext ? c.ext.toUpperCase() : 'File'), fsize(inf.size ?? c.size), fago(inf.mod ?? c.mod)].filter(Boolean).join(' · '); };
  function fileInner(c) {
    const inf = FINFO.get(c.path), gone = inf && !inf.exists, th = inf && THUMBS.get(c.path + '|' + (inf.mod || 0));
    return `<div class="fl-thumb${th?.icon ? ' icon' : /^(png|jpe?g|gif|webp|heic|tiff?|bmp|svg|mov|mp4|m4v)$/.test(c.ext || '') ? ' fl-pic' : ''}${gone ? ' gone' : ''}">${gone ? `<b>I can’t find this file</b><span>Was it moved or renamed?</span><button class="fl-find" data-act="fl-find">Find it…</button>` : th?.src ? `<img src="${th.src}" alt="" draggable="false">` : fBadge(c.ext)}</div>`
      + (isWeb(c) && !gone && MB.native ? `<button class="fl-play" data-act="fl-play" title="Play it on localhost">▶ Play</button>` : '')
      + `<div class="fl-meta"><b>${esc(c.name || baseName(c.path))}</b><span>${esc(gone ? baseName(parentP(c.path)) : isWeb(c) && c.served ? c.served.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' · ' + fileLine(c).split(' · ').slice(1).join(' · ') : fileLine(c))}</span></div>`;
  }
  function folderInner(c) {
    const d = FDATA.get(c.id), sep = pathSep(c.path), crumbs = [c.name || baseName(c.path), ...(c.sub ? c.sub.split(/[\\/]/) : [])], ready = d && d.items;
    const head = `<div class="fo-head">${c.sub ? '<button class="fo-up" data-act="fo-up" title="Back" aria-label="Back"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg></button>' : CFIC}`
      + `<span class="fo-path">${crumbs.map((n, i) => `<span class="${i === crumbs.length - 1 ? 'here' : 'up'}"${i < crumbs.length - 1 ? ` data-act="fo-crumb" data-i="${i}"` : ''}>${esc(n)}</span>`).join('<i>›</i>')}</span>`
      + `<small>${ready && !d.missing && !d.err ? (d.total === 1 ? '1 thing' : `${d.total} things`) : ''}</small></div>`;
    if (!ready) return head + '<div class="fo-msg"><span>Looking…</span></div>';
    if (d.err) return head + `<div class="fo-msg"><b>${esc(d.err)}</b><button class="fl-find" data-act="fo-connect">Connect a folder…</button></div>`;
    if (d.missing) return head + `<div class="fo-msg"><b>I can’t find this folder</b><span>Was it moved or renamed?</span></div>`;
    if (!d.items.length) return head + '<div class="fo-msg"><span>Nothing in here yet</span></div>';
    void sep;
    return head + `<div class="fo-list">${d.items.map((it, i) => { const th = !it.dir && THUMBS.get(it.path + '|' + (it.mod || 0));
      return `<div class="fo-item${it.dir ? ' dir' : ''}" data-act="fo-item" data-i="${i}" title="${esc(it.name)}${it.dir ? '' : '\n' + [FKIND[it.ext] || (it.ext || 'file').toUpperCase(), fsize(it.size)].filter(Boolean).join(' · ')}"><div class="fo-th${th?.icon ? ' icon' : ''}"${it.dir || th ? '' : ` data-th="${i}"`}>${it.dir ? FOLDIC : th?.src ? `<img src="${th.src}" alt="" draggable="false">` : fBadge(it.ext)}</div><span>${esc(it.name)}</span></div>`; }).join('')}`
      + `${d.total > d.items.length ? `<div class="fo-more">+ ${d.total - d.items.length} more in ${FINDER}</div>` : ''}</div>`;
  }
  // previews come from the computer itself (Quick Look on a Mac), a few at a time, and are kept only in memory so boards stay small
  const thumbQ = [], thumbWait = new Map(); let thumbBusy = 0;
  function thumbFor(path, mod, size) {
    const k = path + '|' + (mod || 0); if (THUMBS.has(k)) return Promise.resolve(THUMBS.get(k)); if (thumbWait.has(k)) return thumbWait.get(k);
    if (MB.platform !== 'mac' || !MB.native) return Promise.resolve(null);
    const pr = new Promise(res => { thumbQ.push(async () => { let t = null; try { t = await MB.fileThumb(path, size); } catch (e) {} THUMBS.set(k, t); thumbWait.delete(k); res(t); }); pumpThumbs(); });
    thumbWait.set(k, pr); return pr;
  }
  function pumpThumbs() { while (thumbBusy < 4 && thumbQ.length) { const job = thumbQ.shift(); thumbBusy++; job().finally(() => { thumbBusy--; pumpThumbs(); }); } }
  function thumbsIn(c, el) {
    const d = FDATA.get(c.id); if (!d?.items) return;
    [...el.querySelectorAll('.fo-th[data-th]')].slice(0, 160).forEach(slot => { const it = d.items[+slot.dataset.th]; if (!it) return; slot.removeAttribute('data-th');
      thumbFor(it.path, it.mod, 120).then(t => { if (!t?.src || !slot.isConnected) return; slot.classList.toggle('icon', !!t.icon); slot.innerHTML = `<img src="${t.src}" alt="" draggable="false">`; }); });
  }
  function hydrateFiles(c, el) {
    if (c.type === 'folder') { const d = FDATA.get(c.id); if (!d || d.dir !== dirOf(c)) loadFolder(c); else thumbsIn(c, el); return; }
    const inf = FINFO.get(c.path); if (!inf) return void refreshInfo([c.path]);
    if (inf.exists) thumbFor(c.path, inf.mod, 220).then(t => { if (t?.src && el.isConnected && !el.querySelector('.fl-thumb img')) renderCard(c); });
  }
  async function loadFolder(c) {
    const dir = dirOf(c), old = FDATA.get(c.id); if (old?.loading && old.dir === dir) return;
    FDATA.set(c.id, old && old.dir === dir ? { ...old, loading: true } : { dir, loading: true });
    let r; try { r = { dir, ...(await MB.listFolder(dir)) }; } catch (e) { r = { dir, err: e.message, items: [] }; }
    const sig = x => x && JSON.stringify([x.err, x.missing, x.total, (x.items || []).map(i => [i.name, i.mod, i.size])]);
    if (dirOf(c) !== dir) return;   // they moved on to another folder while this one loaded
    FDATA.set(c.id, r); if (board && byId(c.id) && sig(r) !== sig(old)) renderCard(c);
  }
  async function refreshInfo(paths) {
    paths = [...new Set(paths)].filter(Boolean); if (!paths.length || !board) return; let r = {}; try { r = (await MB.fileInfo(paths)) || {}; } catch (e) {}
    let dirty = false;
    for (const p of paths) {
      const inf = r[p] || { exists: false }, old = FINFO.get(p); FINFO.set(p, inf);
      board.cards.filter(c => c.type === 'file' && c.path === p).forEach(c => {
        if (inf.exists && (c.size !== inf.size || c.mod !== inf.mod || (inf.kind && c.kind !== inf.kind))) { c.size = inf.size; c.mod = inf.mod; if (inf.kind) c.kind = inf.kind; dirty = true; }
        if (!old || old.exists !== inf.exists || old.mod !== inf.mod) renderCard(c);
      });
    }
    if (dirty) { clearTimeout(saveT); saveT = setTimeout(async () => { if (board) { board.view = view; await MB.save(board); } }, 600); }   // just the details, no undo step
  }
  // live: the app watches the folders on the board and says when something in them changes (Windows looks again every few seconds instead)
  function watchedPaths() { const s = new Set(); (board?.cards || []).forEach(c => { if (c.type === 'folder' && c.path) s.add(dirOf(c)); if (c.type === 'file' && c.path) s.add(parentP(c.path)); }); return [...s]; }
  let watchT = 0; function watchSoon() { if (!MB.native) return; clearTimeout(watchT); watchT = setTimeout(() => MB.watchPaths(watchedPaths()).catch(() => {}), 250); }
  window.__pathsChanged = paths => { if (!board) return; const set = new Set(paths);
    board.cards.forEach(c => { if (c.type === 'folder' && set.has(dirOf(c))) loadFolder(c); });
    refreshInfo(board.cards.filter(c => c.type === 'file' && set.has(parentP(c.path))).map(c => c.path)); };
  function refreshAllFiles() { if (!board || !MB.native) return; board.cards.forEach(c => { if (c.type === 'folder') loadFolder(c); }); refreshInfo(board.cards.filter(c => c.type === 'file').map(c => c.path)); }
  addEventListener('focus', refreshAllFiles);
  if (MB.native && MB.platform !== 'mac') setInterval(() => { if (document.visibilityState === 'visible' && board?.cards.some(c => c.type === 'file' || c.type === 'folder')) refreshAllFiles(); }, 6000);
  // making them
  const fileCard = (path, x, y) => card('file', { path, name: baseName(path), ext: extOfP(path), x, y });
  const rootName = path => connected.find(f => f.abs === path)?.name;
  const folderCard = (path, x, y, name) => card('folder', { path, name: name || rootName(path) || baseName(path), x, y, r: 0 });
  function putFiles(list, at) {   // list: [{path, dir}]
    if (!board || !list.length) return; remember(); const made = [];
    // a few files land side by side in tidy rows (four across), starting where they were dropped
    const cs = list.map(it => it.dir ? folderCard(it.path, 0, 0) : fileCard(it.path, 0, 0)), cols = Math.min(4, cs.length), gap = 26;
    const rowW = cs.slice(0, cols).reduce((a, c) => a + c.w, 0) + gap * (cols - 1); let x = at.x - (cs.length > 1 ? rowW / 2 : cs[0].w / 2), y = at.y - cs[0].h / 2, rowH = 0;
    cs.forEach((c, i) => { if (i && i % cols === 0) { x = at.x - rowW / 2; y += rowH + gap; rowH = 0; } c.x = Math.round(x); c.y = Math.round(y); x += c.w + gap; rowH = Math.max(rowH, c.h); addCard(c); made.push(c.id); });
    selectOnly(made); watchSoon();
  }
  function putFolderCard(f, at) { if (!board || f.missing) return; const c = folderCard(f.abs, 0, 0, f.name); c.x = at.x - c.w / 2; c.y = at.y - c.h / 2; remember(); addCard(c); selectOnly([c.id]); watchSoon(); }
  async function pickPut(at, folders = false) {
    let ps = []; try { ps = await MB.pickFiles({ folders }); } catch (e) { return say(e.message, 5000); } if (!ps?.length) return;
    if (folders) { const inside = ps.filter(p => connected.some(f => !f.missing && (p === f.abs || p.startsWith(f.abs.replace(/[\\/]+$/, '') + pathSep(f.abs)))));
      if (inside.length < ps.length) say(`To show a folder on the board, connect it first (Settings → General → Your files). Then it stays live ✦`, 7000);
      return putFiles(inside.map(path => ({ path, dir: true })), at); }
    putFiles(ps.map(path => ({ path, dir: false })), at);
  }
  // files dropped in from Finder: the app passes along where they really are; pictures and videos still come in as pictures and videos
  async function dropFiles(files, at) {
    const paths = window.__dropPaths || []; window.__dropPaths = null;
    const found = files.map(f => paths.find(p => baseName(p) === f.name)).filter(Boolean);
    if (!found.length) return say(MB.native ? 'Drop files from your computer here, or right-click the board → Put a file here…' : 'Files from your computer can go on boards in the Mac and Windows apps ✦', 6000);
    let info = {}; try { info = (await MB.fileInfo(found)) || {}; } catch (e) {}
    // a folder dragged in connects by itself: dragging it here is the same as picking it in the folder picker
    const outside = found.filter(p => info[p]?.dir && !inConnected(p)); if (outside.length) await connectPaths(outside);
    found.forEach(p => FINFO.set(p, info[p] || { exists: true }));
    putFiles(found.map(p => ({ path: p, dir: !!info[p]?.dir })), at);
  }
  // web pages and games (.html): Mochiboard runs their folder on localhost and opens them in the browser, no Terminal needed. Same folder, same address every time
  const isWeb = c => /^html?$/.test(c.ext || extOfP(c.path));
  const SERVED = new Map();
  async function webURL(c) { const u = await MB.serveFile(c.path, c.root || ''); SERVED.set(c.path, u); return u; }
  // Play only ever shares folders they connected; a page somewhere else gets a one-tap Connect, then plays
  function needsConnect(c, then) {
    if (inConnected(c.path)) return false; const folder = parentP(c.path);
    say(`To play it, Mochiboard needs to see “${baseName(folder)}”. It only shares it with this Mac, and only while Mochiboard is open ✦`, 0,
      [{ label: `Connect “${baseName(folder)}” ✦`, run: async () => { await connectPaths([folder]); if (inConnected(c.path)) then(c); } }, { label: 'Not now', ghost: true, run: () => {} }]);
    return true;
  }
  async function playFile(c) {
    if (needsConnect(c, playFile)) return;
    try { const u = await webURL(c); await MB.openURL(u); const card = c.id && byId(c.id); if (card && !card.served) { card.served = u.replace(/\/[^/]*$/, '/'); renderCard(card); save(); } }   // an item inside a folder card isn't a card of its own
    catch (e) { say(e.message, 5000); if (c.id) refreshInfo([c.path]); }
  }
  async function copyWebURL(c) { if (needsConnect(c, copyWebURL)) return; try { const u = await webURL(c); await navigator.clipboard.writeText(u); chirp(`Copied ${u} ✦ It works while Mochiboard is open.`, 5000); } catch (e) { say(e.message, 5000); } }
  async function openFileCard(c) { if (isWeb(c) && MB.native) return playFile(c); try { await MB.openFile(c.path); } catch (e) { say(e.message, 5000); refreshInfo([c.path]); } }
  async function findFile(c) {
    let ps = []; try { ps = await MB.pickFiles({ start: parentP(c.path) }); } catch (e) { return; } if (!ps?.[0]) return;
    remember(); c.path = ps[0]; c.name = baseName(ps[0]); c.ext = extOfP(ps[0]); delete c.kind; FINFO.delete(c.path); renderCard(c); save(); watchSoon();
  }
  const goSub = (c, sub) => { c.sub = sub; renderCard(c); save(); watchSoon(); };
  let foDragged = 0;
  function fileAct(c, act, e, el) {
    if (act === 'fl-find') return findFile(c);
    if (act === 'fl-play') return playFile(c);
    if (act === 'fo-connect') return connectFolder();
    const parts = (c.sub || '').split(/[\\/]/).filter(Boolean), sep = pathSep(c.path);
    if (act === 'fo-up') return goSub(c, parts.slice(0, -1).join(sep));
    if (act === 'fo-crumb') return goSub(c, parts.slice(0, +e.target.closest('[data-i]').dataset.i).join(sep));
    if (act !== 'fo-item' || Date.now() - foDragged < 350) return;
    const it = e.target.closest('.fo-item'), item = FDATA.get(c.id)?.items?.[+it.dataset.i]; if (!item) return;
    if (!sel.has(c.id)) selectOnly([c.id]);
    const now = Date.now(), again = fileAct.last === item.path && now - fileAct.t < 450; fileAct.last = again ? null : item.path; fileAct.t = now;
    el.querySelectorAll('.fo-item.on').forEach(x => x.classList.remove('on')); el.querySelector(`.fo-item[data-i="${it.dataset.i}"]`)?.classList.add('on');
    if (!again) return;
    if (item.dir) goSub(c, [...parts, item.name].join(sep)); else if (/^html?$/.test(item.ext) && MB.native) playFile({ path: item.path, ext: item.ext, root: c.path }); else MB.openFile(item.path).catch(err => say(err.message, 5000));
  }
  // drag a file (or folder) out of a folder card onto the board: it becomes its own card
  function foDragStart(e) {
    const it = e.target.closest('.fo-item'); if (!it || e.button !== 0) return; const el = it.closest('.card'), c = byId(el?.dataset.id), item = c && FDATA.get(c.id)?.items?.[+it.dataset.i]; if (!item) return;
    const sx = e.clientX, sy = e.clientY; let ghost = null;
    const move = ev => { if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      if (!ghost) { ghost = document.createElement('div'); ghost.className = 'fo-ghost'; ghost.innerHTML = it.innerHTML; document.body.appendChild(ghost); }
      ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
    const up = ev => { removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); if (!ghost) return; ghost.remove(); foDragged = Date.now();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!over || !stage.contains(over) || over.closest(`[data-id="${c.id}"], .tools, .tray, .side, .top, .mochi, .dock, .selbar`)) return;
      const w = toWorld(ev.clientX, ev.clientY); if (!item.dir) FINFO.set(item.path, { exists: true, size: item.size, mod: item.mod });
      putFiles([{ path: item.path, dir: item.dir }], w); };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  }
  function fileMenu(cs) {
    if (cs.length !== 1 || !['file', 'folder'].includes(cs[0].type)) return []; const c = cs[0], f = c.type === 'folder';
    return [
      { label: f ? `Open in ${FINDER}` : isWeb(c) ? '▶ Play on localhost' : 'Open', run: () => f ? MB.openFile(dirOf(c)).catch(e => say(e.message, 5000)) : openFileCard(c) },
      ...(!f && isWeb(c) ? [{ label: 'Copy the localhost link', run: () => copyWebURL(c) }, { label: 'Open the file itself', run: () => MB.openFile(c.path).catch(e => say(e.message, 5000)) }] : []),
      ...(!f ? [{ label: `Show in ${FINDER}`, run: () => MB.revealFile(c.path).catch(e => say(e.message, 5000)) }, { label: 'Point it at another file…', run: () => findFile(c) }] : []),
      ...(f && c.sub ? [{ label: `Back to “${esc(c.name)}”`, run: () => goSub(c, '') }] : []),
      ...(settings.ai ? [{ label: '✦ Ask Mochi about this', run: () => askAbout(c) }] : []), '-'];
  }
  const inConnected = p => connected.some(f => !f.missing && (p === f.abs || String(p).startsWith(String(f.abs).replace(/[\\/]+$/, '') + pathSep(f.abs))));
  // ---------- Mochi changes settings: she gets the list of what can change (read from the Settings window itself, so it never goes stale),
  // and changes go through the same switches a person would click. Every change comes with an Undo ----------
  function settingsCatalog() {
    const label = el => { const r = el.closest('.set-row, label, section'); return [r?.querySelector('b')?.textContent.trim(), r?.querySelector('small')?.textContent.trim()].filter(Boolean).join(': ').slice(0, 150); };
    const seen = new Set(), out = [];
    document.querySelectorAll('[data-set]').forEach(t => { const k = t.dataset.set; if (seen.has(k) || (t.closest('.native-only') && !MB.native)) return; seen.add(k); out.push({ key: k, what: label(t), now: !!settings[k], values: 'true | false' }); });
    document.querySelectorAll('[data-seg]').forEach(g => { const k = g.dataset.seg; if (seen.has(k)) return; seen.add(k); out.push({ key: k, what: label(g), now: settings[k], values: [...g.querySelectorAll('[data-v]')].map(b => `${b.dataset.v} (${b.textContent.trim()})`).join(' | ') }); });
    out.push({ key: 'mochi', what: 'Mochi’s color', now: settings.mochi, values: Object.keys(MOCHI_COLORS).join(' | ') },
      { key: 'noteColor', what: 'Color of new notes', now: settings.noteColor, values: ['random', ...COLOR_NAMES].join(' | ') },
      { key: 'mochiName', what: 'Mochi’s name ("" goes back to Mochi)', now: settings.mochiName || '', values: 'a short name' },
      { key: 'name', what: 'The person’s own name (it rides along on their cursor)', now: settings.name || '', values: 'a short name' },
      { key: 'cursor', what: 'Their cursor color', now: settings.cursor, values: '#rrggbb' });
    return out;
  }
  function changeSettings(obj) {
    const cat = new Map(settingsCatalog().map(x => [x.key, x])), done = [], before = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const c = cat.get(k); if (!c || settings[k] === v) continue; const was = settings[k];
      const t = document.querySelector(`[data-set="${k}"]`), seg = document.querySelector(`[data-seg="${k}"] [data-v="${CSS.escape(String(v))}"]`);
      if (t) { t.checked = v === true || v === 'true'; t.dispatchEvent(new Event('change')); }
      else if (seg) seg.click();
      else if (k === 'mochi' && MOCHI_COLORS[v]) { settings.mochi = v; applySettings(); hopMochi(); }
      else if (k === 'noteColor' && (v === 'random' || COLOR_NAMES.includes(v))) { settings.noteColor = v; applySettings(); }
      else if (k === 'mochiName' || k === 'name') { settings[k] = String(v || '').trim().slice(0, 24); applySettings(); if (k === 'name' && $('setName')) $('setName').value = settings.name; }
      else if (k === 'cursor' && /^#[0-9a-f]{6}$/i.test(v)) { settings.cursor = v; applySettings(); }
      else continue;
      before[k] = was; done.push(c.what.split(':')[0]);
    }
    return { done, before };
  }
  // "connect all my folders": always one clear yes first, because it's everything in their home folder
  // only a plain "connect all my folders" skips Claude; anything about boards or projects ("add all my folders to Design") goes to her as usual
  const ALL_FILES = /\b(connect|hook up|give (you|mochi|mochiboard) access to|let (you|mochi|mochiboard) (see|read|into))\b.{0,20}\b(all|every|everything)\b.{0,15}\b(of )?(my )?(files|folders|stuff|computer|mac)\b|\b(connect|access) (to )?everything\b/i;
  const NOT_ALL_FILES = /\b(projects?|boards?|cards?|notes?|together|into|onto|inside|sections?|groups?|sidebar|left box)\b/i;
  function offerAllFiles() {
    if (connected.some(f => f.all)) return say('All your files are already connected ✦ Find them under On your Mac in the left box.', 7000);
    say('That lets Mochiboard see every file in your home folder: Desktop, Documents, Downloads and the rest. It only looks when you use it, never changes anything, and I only read files when you ask. Connect everything?', 0,
      [{ label: 'Yes, connect all my folders ✦', run: () => connectAll() }, { label: 'Not now', ghost: true, run: () => {} }]);
  }
  const acts0 = r => !!r.confirm;
  // a real design ask names a screen-ish thing; "start a checklist" or "style these notes" doesn't count
  const DESIGN_ASK = /\b(screens?|menus?|hud|mock ?ups?|wireframes?|splash|lobby|landing page|home ?page|redesign|restyle (my|the|our) (game|app|site)|(design|make|build|draw|mock) (me )?(a |an |the |my |our |some )?([\w-]+ ){0,2}(ui|layout|page|interface|screen|menu))\b/i;
  let pendingShots = null, lookedOnce = false, lastShots = [], checking = false;
  // she checks her work like a designer would: photograph the screens she just built, put them next to the real game, and fix what's off (once)
  async function checkWork(frames, q) {
    if (!MB.native || !frames.length || checking) return; checking = true;
    await new Promise(r => setTimeout(r, 1600));   // their art finishes loading
    const keep = { ...view }, keepSel = [...sel], built = [];
    selectOnly([]); document.body.classList.add('mochi-snap');
    try {
      for (const f of frames.slice(0, 3)) {
        const sr = stage.getBoundingClientRect(), z = Math.min(1, (sr.width - 80) / f.w, (sr.height - 80) / f.h);
        view = { x: sr.width / 2 - (f.x + f.w / 2) * z, y: sr.height / 2 - (f.y + f.h / 2) * z, z }; applyView();
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))));
        const el = cardsEl.querySelector(`[data-id="${f.id}"]`); if (!el) continue; const b = el.getBoundingClientRect();
        try { built.push({ of: `the screen you built: “${f.name}” (frame id ${f.id})`, size: 'built', path: await MB.snapRect({ x: b.left, y: b.top, w: b.width, h: b.height, name: f.name }) }); } catch (e) {}
      }
    } finally { document.body.classList.remove('mochi-snap'); view = keep; applyView(); selectOnly(keepSel); }
    if (!built.length) { checking = false; return; }
    pendingShots = [...lastShots, ...built]; lookedOnce = true;
    await ask(`CHECK YOUR WORK: compare your screens (${frames.map(f => `"${f.name}" id ${f.id}`).join(', ')}) with their real game and fix what doesn't match. The original request was: ${q}`, false, true, 'Let me check it against your game and tidy it up…');
    lookedOnce = false; checking = false;
  }
  // a fixed screen replaces the old one in the same spot (with its note)
  function replaceScreen(o) {
    const f = byId(o.id); if (!f || f.type !== 'frame') return null; const x = f.x, y = f.y;
    const gone = new Set([f.id, ...board.cards.filter(c => c.onFrame === f.id).map(c => c.id), ...board.cards.filter(c => c.type === 'note' && c.x === f.x && Math.abs(c.y - (f.y + f.h + 28)) < 6).map(c => c.id)]);
    board.cards = board.cards.filter(c => !gone.has(c.id)); gone.forEach(id => cardsEl.querySelector(`[data-id="${id}"]`)?.remove());
    board.links.forEach(l => { if (l.a === f.id || l.b === f.id) l._dead = true; }); board.links = board.links.filter(l => !l._dead);
    const { f: nf, made } = buildScreen(o, x, y); return { nf, made };
  }
  // their real art, from their files, into wireframe image spots and picture cards
  async function fillFileArt(cs) {
    for (const c of cs) { if (c.fileVideo) { const path = c.fileVideo; delete c.fileVideo;
        try { const r = await MB.videoURL(path); c.video = r.url; c.art = r.from || path; delete c.src; delete c.img; c.nobg = true; c.fill = 'transparent'; } catch (e) { c.img = baseName(path); say(e.message, 5000); } renderCard(c); continue; }
      if (!c.fileSrc) continue; const path = c.fileSrc; delete c.fileSrc;
      try { const r = await MB.readImage(path); c.src = r.src; c.art = path; delete c.img; if (c.type === 'image' && r.w && r.h) { c.h = Math.round(c.w * r.h / r.w) + (c.noframe ? 0 : 16); } renderCard(c); } catch (e) { c.img = c.img || baseName(path); renderCard(c); } }
    save();
  }
  async function connectForMochi(q) {
    if (settings.mochiFiles === false) { settings.mochiFiles = true; applySettings(); document.querySelectorAll('[data-set="mochiFiles"]').forEach(t => t.checked = true); if (connected.length) return ask(q, false, true); }
    const added = await connectFolder(); if (added.length) ask(q, false, true);
  }
  function askAbout(c) {
    const p = c.type === 'folder' ? dirOf(c) : c.path;
    const folder = c.type === 'folder' ? p : parentP(p);
    if (settings.mochiFiles === false) return say('I can read this once you let me see your folders ✦', 0, [{ label: 'Let Mochi read my folders ✦', run: () => { settings.mochiFiles = true; applySettings(); document.querySelectorAll('[data-set="mochiFiles"]').forEach(t => t.checked = true); askAbout(c); } }, { label: 'Not now', ghost: true, run: () => {} }]);
    if (!inConnected(p)) return say(`I need to see “${baseName(folder)}” first. One tap and I can read it ✦`, 0, [{ label: `Connect “${baseName(folder)}” ✦`, run: async () => { const a = await connectPaths([folder]); if (a.length || inConnected(p)) askAbout(c); } }, { label: 'Not now', ghost: true, run: () => {} }]);
    selectOnly([c.id]); mochiOpen(true); const i = $('mcInput'); i.value = c.type === 'folder' ? 'What’s in this folder? Sum it up in a few notes' : 'Sum up this file in a few notes'; i.focus(); i.select();
  }
  const uniqueName = (arr, base) => { let n = base, k = 2; while (byName(arr, n)) n = base + ' ' + k++; return n; };
  function renameNewest(sel, obj) { const el = [...document.querySelectorAll(`#boards ${sel}`)].find(n => n.querySelector('.fname').textContent === obj.name); if (el) inlineRename(el.querySelector('.fname'), obj); }
  let renamingNow = false;
  async function refreshBoards() {
    if (document.querySelector('#boards [contenteditable="true"], .home [contenteditable="true"]')) { renamingNow = true; return; }   // don't redraw under someone typing a name
    const gen = refreshBoards.gen = (refreshBoards.gen || 0) + 1;   // only the newest refresh draws
    // everything it needs is fetched first, then the list is drawn in one go, so two refreshes close together can't both add their parts
    await Promise.all([loadLib(), MB.native ? connectedFresh() : null]); if (gen !== refreshBoards.gen) return;
    const el = $('boards'); el.innerHTML = '';
    // inside a project (on Home or on one of its boards) the left box shows just that project; in All projects it shows everything
    const sf = homeAt ? (homeAt.level === 'folder' ? folders.find(x => x.id === homeAt.id) : null) : folders.find(x => x.id === board?.folder);
    const sp = homeAt?.level === 'project' ? projects.find(x => x.id === homeAt.id) : sf && projects.find(x => x.id === sf.project);
    const scoped = homeAt?.level !== 'all' && (sp || sf);
    $('treeLabel').textContent = scoped ? 'In this project' : 'Everything';
    if (scoped) { if (sp) { sp.open = true; el.appendChild(projectNode(sp)); } else { const top = folderChain(sf)[0]; top.open = true; el.appendChild(folderNode(top)); } if (MB.native) el.appendChild(connectedSide()); $('homeBtn').classList.add('out'); renderCrumbs(); if (homeAt) renderHome(); return; }
    $('homeBtn').classList.remove('out');
    shownProjects().forEach(p => el.appendChild(projectNode(p)));
    looseFolders().forEach(f => el.appendChild(folderNode(f)));
    const loose = document.createElement('div'); loose.className = 'loose-zone';
    looseBoards().forEach(b => loose.appendChild(boardRow(b)));
    el.appendChild(loose);
    dropZone(loose, 'board', id => moveBoard(id, null));
    dropZone(el, 'folder', id => putFolder(id, null, null));
    if (MB.native) el.appendChild(connectedSide());
    const nArch = projects.length - shownProjects().length;
    if (nArch) { const a = document.createElement('button'); a.className = 'arch-link'; a.textContent = `Archived · ${nArch}`; a.title = 'Projects you archived: open one or restore it'; a.onclick = () => openHome('archived'); el.appendChild(a); }
    renderCrumbs(); if (homeAt) renderHome();
  }

  // a board added from outside the app (Claude Code, a copied file): show it right away, and say where it went if it isn't in view
  window.__boardsChanged = async () => {
    const before = new Set(boardList.map(b => b.id)); await refreshBoards();
    const here = where().p, fresh = boardList.filter(b => !before.has(b.id));
    for (const b of fresh) { const f = folders.find(x => x.id === b.folder), p = f && projects.find(x => x.id === f.project);
      if (p && here && p.id === here.id) say(`“${b.name}” just showed up in this project ✦`);
      else say(`“${b.name}” just showed up. You'll find it in ${p ? `your “${p.name}” project` : f ? `the “${f.name}” folder` : 'All projects'}.`); }
  };
  addEventListener('focus', () => { if (board && !document.querySelector('[contenteditable="true"]')) window.__boardsChanged(); });   // and check again whenever you come back to the app

  // ---------- archive: a project leaves the lists but keeps every folder and board; Home → Archived brings it back ----------
  async function archiveProject(p, on) {
    const live = projects.find(x => x.id === p.id) || p; if (on) live.archived = true; else delete live.archived;
    await saveLib(); await refreshBoards();
    if (on && homeAt?.level === 'project' && homeAt.id === live.id) openHome('all');
    chirp(on ? `Archived “${live.name}”. It's under Archived whenever you want it back ✦` : `“${live.name}” is back in your projects ✦`, 4000);
  }
  // ---------- home: zoom out to see every project, then a project's folders, then a folder's boards ----------
  let homeAt = null;   // null = closed, { level: 'all' } | { level: 'project', id } | { level: 'folder', id }
  const where = () => { const f = folders.find(x => x.id === board?.folder), p = f && projects.find(x => x.id === f.project); return { f, p }; };
  function renderCrumbs() {
    if (!board) return; const { f, p } = where(), el = $('crumbs');
    const chainF = f ? folderChain(f) : [];
    el.innerHTML = (p ? `<button data-go="project:${p.id}"></button>` : '') + chainF.map((x, i) => `${p || i ? '<i>/</i>' : ''}<button data-go="folder:${x.id}"></button>`).join('');
    const btns = [...el.querySelectorAll('button')]; if (p) { btns[0].textContent = p.name; btns[0].title = p.name; } chainF.forEach((x, i) => { const bt = btns[i + (p ? 1 : 0)]; bt.textContent = x.name; bt.title = x.name; });
    // inside a canvas: the boards it lives in, so you can climb back out
    const chain = []; let up = board.parent; while (up && chain.length < 4) { const pb = boardList.find(x => x.id === up); if (!pb) break; chain.unshift(pb); up = pb.parent; }
    chain.forEach(pb => { el.insertAdjacentHTML('beforeend', `${el.children.length ? '<i>/</i>' : ''}<button data-board="${pb.id}"></button>`); const bt = el.lastElementChild; bt.textContent = pb.name; bt.title = 'Back to ' + pb.name; });
  }
  $('crumbs').onclick = async e => { const pb = e.target.closest('[data-board]')?.dataset.board; if (pb) { board.view = view; await MB.save(board); return openBoard(pb); } const g = e.target.closest('[data-go]')?.dataset.go; if (g) openHome(g); };
  $('homeBtn').onclick = () => openHome('all');
  $('brand').onclick = () => openHome('all');
  $('homeBack').onclick = () => { if (!homeAt) return; const f = homeAt.level === 'folder' && folders.find(x => x.id === homeAt.id); const pa = homeAt.level === 'project' && projects.find(p => p.id === homeAt.id)?.archived; openHome(pa ? 'archived' : f && hasParent(f) ? 'folder:' + f.parent : f && f.project && projects.some(p => p.id === f.project) ? 'project:' + f.project : 'all'); };
  function openHome(go = 'all') { const [level, id] = go.split(':'); homeAt = { level, id }; $('home').classList.add('on'); stage.classList.add('at-home'); stopPlacing(); refreshBoards(); }
  function closeHome() { if (!homeAt) return; homeAt = null; $('home').classList.remove('on'); stage.classList.remove('at-home'); refreshBoards(); }
  const miniCache = new Map();
  async function mini(id) {
    // a tiny map of the board: every card as a little colored block
    if (!miniCache.has(id)) miniCache.set(id, MB.load(id).then(b => {
      const cs = (b && b.cards) || []; if (!cs.length) return '';
      const x0 = Math.min(...cs.map(c => c.x)), y0 = Math.min(...cs.map(c => c.y)), x1 = Math.max(...cs.map(c => c.x + c.w)), y1 = Math.max(...cs.map(c => c.y + c.h));
      const fill = c => c.type === 'swatch' ? c.hex : c.type === 'image' ? '#d9cfe0' : c.type === 'title' ? 'transparent' : (COLORS[c.color] || '#fff');
      return `<svg viewBox="${x0 - 40} ${y0 - 40} ${x1 - x0 + 80} ${y1 - y0 + 80}" preserveAspectRatio="xMidYMid meet">` + cs.map(c => c.type === 'title'
        ? `<rect x="${c.x}" y="${c.y + c.h * .25}" width="${Math.min(c.w, 260)}" height="${c.h * .5}" rx="8" fill="#494848" opacity=".75"/>`
        : `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="14" fill="${fill(c)}" stroke="rgba(120,80,120,.12)" stroke-width="3" transform="rotate(${c.r || 0} ${c.x + c.w / 2} ${c.y + c.h / 2})"/>`).join('') + '</svg>';
    }));
    return miniCache.get(id);
  }
  function tile(kind, obj, sub, onOpen, btns = []) {
    const t = document.createElement('div'); t.className = 'tile ' + kind; t.style.rotate = (((obj.id.charCodeAt(0) + obj.id.charCodeAt(1)) % 5) - 2) * .6 + 'deg';
    t.innerHTML = `<div class="tile-art"></div><div class="tile-meta"><b></b><small>${sub}</small>${btns.map(([a, tt, s]) => `<button class="f-btn" data-a="${a}" title="${tt}">${FBTN[a] || s}</button>`).join('')}</div>`;
    t.querySelector('.tile-meta b').textContent = obj.name;
    t.onclick = e => { if (e.target.closest('.f-btn') || t.querySelector('.tile-meta b').isContentEditable) return; onOpen(); };
    return t;
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function renderHome() {
    const { level, id } = homeAt, grid = $('homeGrid'), crumbs = $('homeCrumbs'); grid.innerHTML = ''; miniCache.clear();
    const p = level === 'project' ? projects.find(x => x.id === id) : level === 'folder' ? projects.find(x => x.id === folders.find(f => f.id === id)?.project) : null;
    const f = level === 'folder' ? folders.find(x => x.id === id) : null;
    if ((level === 'project' && !p) || (level === 'folder' && !f)) { homeAt = { level: 'all' }; return renderHome(); }
    const chainF = f ? folderChain(f) : [];
    crumbs.innerHTML = `<button data-go="all">All projects</button>` + (level === 'archived' || p?.archived ? '<i>/</i><button data-go="archived">Archived</button>' : '') + (p ? `<i>/</i><button data-go="project:${p.id}"></button>` : '') + chainF.map(x => `<i>/</i><button data-go="folder:${x.id}"></button>`).join('');
    const cb = [...crumbs.querySelectorAll('button:not([data-go="archived"])')]; if (p) cb[1].textContent = p.name; chainF.forEach((x, i) => cb[i + (p ? 2 : 1)].textContent = x.name);
    $('home').classList.toggle('deep', level !== 'all');
    $('homeTitle').textContent = f ? f.name : p ? p.name : level === 'archived' ? 'Archived projects' : 'Your projects';
    $('homeSub').textContent = level === 'archived' ? 'Out of your lists, kept safe. Open one to look inside, or restore it.' : f ? [subFolders(f.id).length ? plural(subFolders(f.id).length, 'folder') : '', plural(boardsIn(f.id).length, 'board')].filter(Boolean).join(' · ') : p ? plural(foldersIn(p.id).length, 'folder') : 'Every project, with its folders and boards inside.';
    const add = (label, run) => { const a = document.createElement('button'); a.className = 'tile add'; a.innerHTML = `<span>+</span>${label}`; a.onclick = run; grid.appendChild(a); };
    const del = async (arr, obj, fix) => { fix(); if (arr === 'p') projects = projects.filter(x => x !== obj); else folders = folders.filter(x => x !== obj); await saveLib(); refreshBoards(); };
    const projectTile = pp => {
      const fs = foldersIn(pp.id), nb = fs.reduce((n, x) => n + boardsUnder(x), 0);
      const t = tile('project', pp, `${plural(fs.length, 'folder')} · ${plural(nb, 'board')}`, () => openHome('project:' + pp.id), [['ren', 'Rename', '✎']]);
      if (pp.archived) { t.classList.add('archived'); const rb = document.createElement('button'); rb.className = 'restore-btn'; rb.textContent = 'Restore'; rb.onclick = e => { e.stopPropagation(); archiveProject(pp, false); }; t.appendChild(rb); }
      const art = t.querySelector('.tile-art'), chips = `<div class="chips">${fs.slice(0, 3).map(x => `<span class="mf"><i></i>${esc(x.name)}</span>`).join('')}</div>`;
      const first = fs.map(x => boardsIn(x.id)[0]).find(Boolean);
      if (pp.cover) { art.classList.add('cover'); art.style.background = `url('${pp.cover}')`; art.innerHTML = chips; }
      else if (first) { art.classList.add('peekboard'); art.innerHTML = chips; mini(first.id).then(svg => { if (svg) art.insertAdjacentHTML('afterbegin', svg); else { art.classList.remove('peekboard'); art.style.background = COLORS[pp.color] || COLORS.pink; } }); }
      else { art.style.background = COLORS[pp.color] || COLORS.pink; art.innerHTML = fs.length ? chips : '<em>empty project</em>'; }
      const cb = document.createElement('button'); cb.className = 'cover-btn'; cb.textContent = 'Cover'; t.appendChild(cb);
      cb.onclick = e => { e.stopPropagation(); t.querySelector('.cover-menu')?.remove(); const m = document.createElement('div'); m.className = 'cover-menu';
        m.innerHTML = `<button data-c="pick">Choose an image…</button><button data-c="board">Use the first board</button>`; t.appendChild(m);
        m.onclick = ev => { ev.stopPropagation(); const c = ev.target.closest('[data-c]')?.dataset.c; m.remove();
          if (c === 'pick') { coverFor = pp; $('coverPick').value = ''; $('coverPick').click(); }
          if (c === 'board') { delete pp.cover; saveLib().then(refreshBoards); } };
        setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true)); };
      t.querySelector('[data-a="ren"]').onclick = () => inlineRename(t.querySelector('.tile-meta b'), pp); t.oncontextmenu = e => rowMenu(e, 'project', pp, t.querySelector('.tile-meta b'));
      dropZone(t, 'folder', fid => putFolder(fid, null, pp.id));
      return t;
    };
    const folderTile = ff => {
      const bs = boardsIn(ff.id), ns = subFolders(ff.id).length, t = tile('folder', ff, [ns ? plural(ns, 'folder') : '', plural(bs.length, 'board')].filter(Boolean).join(' · '), () => openHome('folder:' + ff.id), [['ren', 'Rename', '✎']]);
      if (DEEP[ff.color]) t.style.setProperty('--fcol', COLORS[ff.color]);
      const art = t.querySelector('.tile-art'); art.innerHTML = '<div class="back"></div><div class="tab"></div><div class="peek"></div><div class="front"><span class="face"><b></b><i></i><b></b></span></div>';
      const shown = bs.slice(0, 3); art.querySelector('.peek').style.setProperty('--mid', (shown.length - 1) / 2);
      shown.forEach(async (b, i) => { const d = document.createElement('div'); d.className = 'paper'; d.style.setProperty('--i', i); d.style.zIndex = i === Math.floor((shown.length - 1) / 2) ? 3 : 1; d.innerHTML = await mini(b.id); art.querySelector('.peek').appendChild(d); });
      t.querySelector('[data-a="ren"]').onclick = () => inlineRename(t.querySelector('.tile-meta b'), ff); t.oncontextmenu = e => rowMenu(e, 'folder', ff, t.querySelector('.tile-meta b'));
      draggable(t, 'folder', ff.id); dropZone(t, 'board', bid => moveBoard(bid, ff.id)); dropZone(t, 'folder', fid => { if (fid !== ff.id && !putFolder(fid, ff)) chirp("A folder can't go inside itself ✦", 2500); });
      return t;
    };
    const boardTile = b => {
      const t = tile('board', b, b.updated ? 'edited ' + ago(b.updated) : '', () => { closeHome(); openBoard(b.id); }, [['ren', 'Rename', '✎']]);
      t.querySelector('[data-a="ren"]').onclick = () => inlineRename(t.querySelector('.tile-meta b'), b, v => renameBoard(b, v));
      mini(b.id).then(svg => t.querySelector('.tile-art').innerHTML = svg || '<em>empty board</em>');
      draggable(t, 'board', b.id); dropZone(t, 'board', id => nestBoard(id, b.id)); t.oncontextmenu = e => rowMenu(e, 'board', b, t.querySelector('.tile-meta b')); return t;
    };
    const section = label => { const h = document.createElement('div'); h.className = 'home-sec'; h.textContent = label; grid.appendChild(h); };
    if (level === 'archived') {
      const arch = projects.filter(x => x.archived); arch.forEach(pp => grid.appendChild(projectTile(pp)));
      if (!arch.length) grid.insertAdjacentHTML('beforeend', '<p class="home-empty">Nothing archived. Right-click a project → Archive to tuck it away.</p>');
    } else if (level === 'all') {
      shownProjects().forEach(pp => grid.appendChild(projectTile(pp)));
      add('New project', async () => { const pp = makeProject(uniqueName(projects, 'New project')); await saveLib(); await refreshBoards(); const t = [...grid.querySelectorAll('.tile.project')].pop(); inlineRename(t.querySelector('.tile-meta b'), pp); });
      if (looseFolders().length) { section('Folders not in a project · drag onto a project to file'); looseFolders().forEach(ff => grid.appendChild(folderTile(ff))); }
      if (looseBoards().length) { section('Boards not in a folder'); looseBoards().forEach(b => grid.appendChild(boardTile(b))); }
      const nArch = projects.filter(x => x.archived).length;
      if (nArch) { const a = document.createElement('button'); a.className = 'home-arch'; a.innerHTML = `Archived <b>${nArch}</b>`; a.onclick = () => openHome('archived'); grid.appendChild(a); }
    } else if (level === 'project') {
      foldersIn(p.id).forEach(ff => grid.appendChild(folderTile(ff)));
      add('New folder', async () => { const ff = makeFolder(uniqueName(folders, 'New folder'), p.id); await saveLib(); await refreshBoards(); const t = [...grid.querySelectorAll('.tile.folder')].pop(); inlineRename(t.querySelector('.tile-meta b'), ff); });
      if (looseBoards().length) { section('Boards not in a folder · drag onto a folder to file'); looseBoards().forEach(b => grid.appendChild(boardTile(b))); }
    } else {
      subFolders(f.id).forEach(ff => grid.appendChild(folderTile(ff)));
      boardsIn(f.id).forEach(b => grid.appendChild(boardTile(b)));
      add('New board', () => newBoardIn(f.id));
      add('New folder', async () => { const ff = makeFolder(uniqueName(folders, 'New folder'), f.project || null); ff.parent = f.id; await saveLib(); await refreshBoards(); const t = [...grid.querySelectorAll('.tile.folder')].pop(); if (t) inlineRename(t.querySelector('.tile-meta b'), ff); });
    }
  }
  const ago = t => { const s = (Date.now() / 1000 - t), m = s / 60, h = m / 60, d = h / 24; return s < 90 ? 'just now' : m < 60 ? Math.round(m) + 'm ago' : h < 24 ? Math.round(h) + 'h ago' : Math.round(d) + 'd ago'; };
  $('homeCrumbs').onclick = e => { const g = e.target.closest('[data-go]')?.dataset.go; if (g) openHome(g); };
  $('homeClose').onclick = closeHome;
  // a project's cover image: shrunk to a tidy size and saved with the library
  let coverFor = null;
  $('coverPick').onchange = () => { const file = $('coverPick').files[0], p = coverFor; if (!file || !p) return;
    const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 720 / im.width), cv = document.createElement('canvas'); cv.width = im.width * k; cv.height = im.height * k;
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); p.cover = cv.toDataURL('image/jpeg', .86); saveLib().then(refreshBoards); }; im.src = rd.result; }; rd.readAsDataURL(file); };

  // a board's saved looks live together in board.styles: colors (from color cards) and text (from Save text style)
  // boards from before 1.9 kept them loose as board.palette and board.textStyles: move them in
  function normStyles(b) { const s = b.styles || {};
    b.styles = { ...s, colors: s.colors || b.palette || [], text: s.text || b.textStyles || [] }; delete b.palette; delete b.textStyles; }
  async function openBoard(id) {
    // an edit still waiting to save belongs to the board you're leaving: save it first
    if (saveT && board) { clearTimeout(saveT); saveT = 0; board.view = view; await MB.save(board); }
    const b = await MB.load(id); if (!b) return;
    miniCache.clear(); board = b; if (chatOpen()) setTimeout(renderChat, 0); normStyles(board); setTimeout(resetHistory, 0); view = Object.assign({ x: 160, y: 140, z: 1 }, b.view); sel.clear(); editing = null; focusSet = null; closeColor(); renderPalette();
    board.cards.forEach(c => { if (c.type === 'audio' && c.rec) { c.rec = false; c.paused = false; if (!c.src) c.txNote = 'This recording got interrupted. Tap Replace to record again.'; } });
    board.cards.forEach(c => { if (c.type === 'canvas' && c.board) { const kb = boardList.find(x => x.id === c.board); if (kb && kb.name !== c.text) c.text = kb.name; } });
    $('boardName').value = board.name; renderAll(); refreshBoards(); try { localStorage.setItem('mochiboard:last', id); } catch (e) {}
  }
  let saveT = 0;
  // ---------- undo / redo: a snapshot of the board after each change settles ----------
  let past = [], future = [], restoring = false, snapT = 0;
  const stateOf = () => JSON.stringify({ cards: board.cards, links: board.links, tray: board.tray, styles: board.styles });
  let afterTravel = false;   // right after an undo/redo, nothing you did has changed the board yet
  // a title that isn't fixed sizes itself to its words, so its w/h are measurements, not something you did
  const sansTitleSize = st => { try { const o = JSON.parse(st); (o.cards || []).forEach(c => { if (c.type === 'title' && !c.fixedW) { delete c.w; delete c.h; } }); return JSON.stringify(o); } catch (e) { return st; } };
  function remember() { if (restoring || !board) return; const st = stateOf();
    if (afterTravel && past.length && sansTitleSize(st) === sansTitleSize(past[past.length - 1])) { past[past.length - 1] = st; return; }   // only the board settling after an undo: not a new step
    afterTravel = false; if (past[past.length - 1] !== st) { past.push(st); if (past.length > 80) past.shift(); future = []; } }
  function resetHistory() { past = board ? [stateOf()] : []; future = []; }
  function travel(dir) {
    clearTimeout(snapT); remember();   // catch the very latest change first (just a title re-measuring after the last undo isn't one: see remember)
    const from = dir < 0 ? past : future, to = dir < 0 ? future : past;
    if (dir < 0 ? past.length < 2 : !future.length) return say(dir < 0 ? 'Nothing left to undo' : 'Nothing to redo', 1800);
    if (dir < 0) future.push(past.pop()); else past.push(future.pop());
    const st = JSON.parse(past[past.length - 1]); restoring = true;
    Object.assign(board, st); sel.clear(); selWire = null; selWires.clear(); endEdit(); renderAll(); renderPalette(); save(); restoring = false; afterTravel = true;
  }
  // every card keeps real numbers for its place and size (a bad one would break saving)
  function cleanNumbers() { board.cards.forEach(c => { ['x', 'y'].forEach(k => { if (!Number.isFinite(c[k])) c[k] = 0; }); ['w', 'h'].forEach(k => { if (!Number.isFinite(c[k]) || c[k] <= 0) c[k] = k === 'w' ? 200 : 100; }); ['r', 'rot'].forEach(k => { if (c[k] != null && !Number.isFinite(c[k])) c[k] = 0; }); }); }
  function save() {
    if (!drag && board) { layoutAll(); cleanNumbers(); }
    if (!restoring) { clearTimeout(snapT); snapT = setTimeout(remember, 350); }
    layersSoon(); $('saved').textContent = 'saving…'; clearTimeout(saveT);
    saveT = setTimeout(async () => { board.view = view; await MB.save(board); $('saved').textContent = 'saved'; refreshBoards(); }, 400);
  }

  // after Mochi works: glide to what she made (unless it's already in view) and let it glow for a moment
  function showWhatMochiMade(cs) {
    cs = [...new Set(cs)].filter(c => board.cards.includes(c)); if (!cs.length) return;
    const r = stage.getBoundingClientRect(), L = 270, ch = chatOpen() && $('mChat').getBoundingClientRect(), R = ch && ch.width ? Math.max(260, Math.min(r.right - ch.left + 30, r.width - L - 520)) : 260, a = toWorld(r.left + L, r.top + 60), b = toWorld(r.right - R, r.bottom - 110);
    const inView = cs.every(c => c.x >= a.x && c.y >= a.y && c.x + c.w <= b.x && c.y + c.h <= b.y) && view.z > .45;
    if (!inView) fit(cs, 140, 1);
    const glow = cs.filter(c => !WF.includes(c.type) || c.type === 'frame' || !c.onFrame);   // whole screens glow, not every word on them
    setTimeout(() => glow.forEach(c => { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return; el.classList.remove('just-made'); void el.offsetWidth; el.classList.add('just-made'); setTimeout(() => el.classList.remove('just-made'), 1900); }), inView ? 0 : 450);
  }

  // ---------- the grid's shape: plain dots, or a tiny repeating shape in the dot color ----------
  const GRID_SHAPES = {
    dot: ['Dots', '<circle cx="13" cy="13" r="1.6"/>'],
    cross: ['Crosses', '<rect x="9.6" y="12.25" width="6.8" height="1.5" rx=".75"/><rect x="12.25" y="9.6" width="1.5" height="6.8" rx=".75"/>'],
    x: ['X marks', '<g transform="rotate(45 13 13)"><rect x="9.8" y="12.3" width="6.4" height="1.4" rx=".7"/><rect x="12.3" y="9.8" width="1.4" height="6.4" rx=".7"/></g>'],
    heart: ['Hearts', '<path d="M13 16.2c-.2 0-.4-.1-.5-.2-1.4-1.2-3.2-2.6-3.2-4.3 0-1.1.8-2 1.9-2 .8 0 1.4.4 1.8 1 .4-.6 1-1 1.8-1 1.1 0 1.9.9 1.9 2 0 1.7-1.8 3.1-3.2 4.3-.1.1-.3.2-.5.2z"/>'],
    tri: ['Triangles', '<path d="M13 10.3l3 5.2h-6z" stroke-linejoin="round"/>'],
    square: ['Squares', '<rect x="10.9" y="10.9" width="4.2" height="4.2" rx=".9"/>'],
    sparkle: ['Sparkles', '<path d="M13 9.4c.3 1.9 1.7 3.3 3.6 3.6-1.9.3-3.3 1.7-3.6 3.6-.3-1.9-1.7-3.3-3.6-3.6 1.9-.3 3.3-1.7 3.6-3.6z"/>'],
  };
  const gridMask = k => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26" fill="#000">${(GRID_SHAPES[k] || GRID_SHAPES.dot)[1]}</svg>`)}")`;
  function applyGridShape() {
    const k = GRID_SHAPES[settings.gridShape] ? settings.gridShape : 'dot', on = k !== 'dot';
    grid.classList.toggle('shaped', on); if (on) grid.style.setProperty('--gm', gridMask(k)); else grid.style.removeProperty('--gm');
    const box = $('gridShapes'); if (!box) return;
    if (!box.children.length) { box.innerHTML = Object.entries(GRID_SHAPES).map(([id, [name]]) => `<button type="button" data-gshape="${id}" title="${name}" aria-label="${name}"><i style="--gm:${gridMask(id).replace(/"/g, '&quot;')}"></i></button>`).join('');
      box.onclick = e => { const b = e.target.closest('[data-gshape]'); if (!b) return; settings.gridShape = b.dataset.gshape; if (!settings.grid) settings.grid = true; applySettings(); }; }
    box.querySelectorAll('[data-gshape]').forEach(b => b.classList.toggle('on', b.dataset.gshape === k));
    applyView();
  }

  // ---------- crisp zoom: once you stop zooming, the board uses real CSS zoom so every word is laid out at the size you see ----------
  // In WebKit, measuring something inside a CSS-zoomed box reports it divided by the zoom; this puts the zoom back,
  // so every place that measures cards (selection, the resize corner, the selection bar, drop targets) keeps working unchanged.
  const _rect = Element.prototype.getBoundingClientRect;
  const zoomShrinks = (() => { const o = document.createElement('div'), i = document.createElement('div'); o.style.cssText = 'position:absolute;left:-9999px;top:0;zoom:2'; i.style.cssText = 'width:100px;height:10px'; o.appendChild(i); document.body.appendChild(o); const w = _rect.call(i).width; o.remove(); return w > 0 && w < 150; })();   // Chrome already reports the zoomed size
  if (zoomShrinks) Element.prototype.getBoundingClientRect = function () {
    const r = _rect.call(this), z = +world.style.zoom || 1;
    if (z === 1 || this === world || !world.contains(this)) return r;
    return new DOMRect(r.x * z, r.y * z, r.width * z, r.height * z);
  };

  // ---------- view ----------
  let movingT = 0;
  function applyView() {
    // section names grow as you zoom out, so a zoomed-out board reads like a big wall of labeled areas
    world.style.setProperty('--secz', Math.min(4, Math.max(1, 1 / view.z)).toFixed(3));
    // while zooming or panning, a fast scale; once you stop, real zoom, so text and everything else is laid out again at the new size (crisp, even with
    // Spotify players or videos on the board, which otherwise make Safari stretch an old picture of the board)
    if (world.style.zoom && Math.abs(view.z - +world.style.zoom) < 1e-6) world.style.transform = `translate(${view.x / view.z}px, ${view.y / view.z}px)`;
    else { world.style.zoom = ''; world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`; }
    if (typeof rhEl !== 'undefined') rhEl.style.setProperty('--iz', (1 / view.z).toFixed(4));
    cardsEl.querySelectorAll('.card.table').forEach(t => t.style.setProperty('--iz', (1 / view.z).toFixed(4)));   // the table's + buttons too (only tables, for the same reason)   // the resize corner stays the same size on screen at any zoom (set on it alone: on the whole board, Safari restyled every card each zoom step)
    stage.classList.toggle('far', view.z < .55); stage.classList.add('moving'); clearTimeout(movingT); movingT = setTimeout(() => { stage.classList.remove('moving');
      // real zoom only where it's needed: a Spotify player or video on the board makes Safari stretch an old picture of the board, so lay it out fresh there.
      // Boards without them are already crisp with the fast scale, and skipping the re-layout keeps them snappier.
      cardsEl.querySelectorAll('.card.tsk-on').forEach(el => { const c = byId(el.dataset.id); if (c) textStrokeSVG(c, el); });   // dashed / dotted letters re-measured at the new zoom
      if (view.z > 1.02) {   // only zoomed in: shrinking a picture never blurs it
        world.style.zoom = view.z; world.style.transform = `translate(${view.x / view.z}px, ${view.y / view.z}px)`; requestAnimationFrame(() => cardsEl.querySelectorAll('.card.tsk-on').forEach(el => { const c = byId(el.dataset.id); if (c) textStrokeSVG(c, el); })); } }, 450);   // a short pause in a pinch isn't the end of it, so wait a little before redrawing everything sharp
    let s = 26 * view.z; while (s < 20) s *= 2; while (s > 40) s /= 2;   // dots keep their size; zooming out skips every other dot instead of crowding them
    grid.style.backgroundSize = `${s}px ${s}px`; grid.style.backgroundPosition = `${view.x}px ${view.y}px`;
    if (grid.classList.contains('shaped')) { grid.style.webkitMaskSize = grid.style.maskSize = `${s}px ${s}px`; grid.style.webkitMaskPosition = grid.style.maskPosition = `${view.x}px ${view.y}px`; }
    $('zoom').textContent = Math.round(view.z * 100) + '%';
  }
  // ---------- the resize corner lives on its own layer above every card (like Figma), so a neighbor that overlaps can never hide it ----------
  const rh = document.createElement('div'); var rhEl = rh; rh.id = 'rh'; rh.setAttribute('aria-label', 'Resize'); world.appendChild(rh);
  let rhFor = null;
  const realBox = k => { const el = k.type === 'title' ? cardsEl.querySelector(`[data-id="${k.id}"]`) : null; return { w: el?.offsetWidth || k.w, h: el?.offsetHeight || k.h }; };   // titles size themselves to their words
  const mrot = document.createElement('div'); mrot.id = 'mrot'; mrot.title = 'Drag to turn them together (Shift: 15° steps)'; world.appendChild(mrot);
  const ROT_FIXED = ['frame', 'coll', 'ink'];   // these stay upright (they only move around the turn); a section turns, once someone turns it
  // the turn dot is a handle attached to what you selected: on top when it's straight, and it turns with it (and stays there after) like a real handle
  let mrotKeep = null;   // a group you turned: { key, anchor } (the dot stays on the piece that was on top)
  const selKey = cs => cs.map(k => k.id).sort().join();
  const midOf = cs => { const ms = cs.map(k => { const b = realBox(k); return [k.x + b.w / 2, k.y + b.h / 2]; }); return { x: ms.reduce((n, m) => n + m[0], 0) / ms.length, y: ms.reduce((n, m) => n + m[1], 0) / ms.length }; };
  const tiltOf = k => (k.rot || 0) + (document.body.classList.contains('neat') || ROT_FIXED.includes(k.type) || (k.type === 'stamp' && !k.tilted) || (k.type === 'section' && !k.turned) ? 0 : (k.r || 0));
  // which piece carries the dot: one thing is itself; for several, the one on top (and it keeps the dot after you turn them)
  function anchorOf(cs) { if (cs.length === 1) return cs[0]; const kept = mrotKeep && mrotKeep.key === selKey(cs) && cs.find(k => k.id === mrotKeep.anchor); if (kept) return kept;
    return cs.reduce((best, k) => { const b = realBox(k), y = k.y + b.h / 2 - b.h / 2 * Math.cos(tiltOf(k) * Math.PI / 180); return !best || y < best.y ? { k, y } : best; }, null).k; }
  function placeDot(x, y, ang) { mrot.style.left = x + 'px'; mrot.style.top = y + 'px'; mrot.style.rotate = (ang || 0) + 'deg'; mrot.style.setProperty('--iz', (1 / view.z).toFixed(4)); }
  function syncMrot() { const ids = board ? [...sel] : []; const cs = ids.map(byId).filter(k => k && !k.locked);
    const turnable = cs.length > 1 || (cs.length === 1 && !ROT_FIXED.includes(cs[0].type));
    const on = turnable && !drawOn && !editing && !cropping && !(drag && ['move', 'gresize', 'resize'].includes(drag.mode)) && !vec;
    mrot.classList.toggle('on', !!on); if (!on) return;
    if (drag && drag.mode === 'mrotate' && drag.dot0) { const t = (drag.cur || 0) * Math.PI / 180, dx = drag.dot0.x - drag.cx, dy = drag.dot0.y - drag.cy;   // held by the cursor, going round with the turn
      return placeDot(drag.cx + dx * Math.cos(t) - dy * Math.sin(t), drag.cy + dx * Math.sin(t) + dy * Math.cos(t), drag.ang0 + (drag.cur || 0)); }
    const k = anchorOf(cs), b = realBox(k), d = tiltOf(k), t = d * Math.PI / 180;   // the top piece's own top middle, turned with it
    placeDot(k.x + b.w / 2 + (b.h / 2) * Math.sin(t), k.y + b.h / 2 - (b.h / 2) * Math.cos(t), d);
  }
  function syncRH() {
    syncMrot();
    const ids = board ? [...sel] : [], c = ids.length === 1 ? byId(ids[0]) : null;
    const ok = c && !['ink'].includes(c.type) && editing !== c.id && !drawOn && !(drag && drag.mode === 'move') && !cropping;
    // a whole group selected (a button, an input…): one corner for the group
    const g = !c && ids.length > 1 && byId(ids[0])?.group, grp = g && ids.every(i => byId(i)?.group === g) && !drawOn && !(drag && drag.mode === 'move');
    if (grp) { const cs = ids.map(byId); rhFor = 'g:' + g; rh.classList.add('on'); rh.style.left = Math.max(...cs.map(k => k.x + k.w)) + 'px'; rh.style.top = Math.max(...cs.map(k => k.y + (k.type === 'title' ? (cardsEl.querySelector(`[data-id="${k.id}"]`)?.offsetHeight || k.h) : k.h))) + 'px'; requestAnimationFrame(syncRH); return; }
    const multi = !c && !grp && ids.length > 1 && !drawOn && !(drag && drag.mode === 'move') && !cropping && !editing;
    if (multi) { const cs = ids.map(byId).filter(k => k && !k.locked && k.type !== 'ink'); if (cs.length > 1) { const R = realBox; rhFor = 'm'; rh.classList.add('on');
      const rs_ = cs.map(k => cardsEl.querySelector(`[data-id="${k.id}"]`)?.getBoundingClientRect()).filter(r => r && r.width);   // the real bottom-right of what you see (turned things included)
      const pt = rs_.length ? toWorld(Math.max(...rs_.map(r => r.right)), Math.max(...rs_.map(r => r.bottom))) : { x: Math.max(...cs.map(k => k.x + R(k).w)), y: Math.max(...cs.map(k => k.y + R(k).h)) };
      rh.style.left = pt.x + 'px'; rh.style.top = pt.y + 'px'; requestAnimationFrame(syncRH); return; } }
    rhFor = ok ? c.id : null; rh.classList.toggle('on', !!ok);
    if (ok) { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); const h = c.type === 'title' && el ? el.offsetHeight : c.h;
      // a title's real width (its saved width lags a moment after the text, size or font changes, which left the corner floating off to the side)
      const w = c.type === 'title' && el && el.offsetWidth ? el.offsetWidth : c.w; if (c.type === 'title' && !c.fixedW && Math.abs(w - c.w) > 1) c.w = w;
      // follow the card's own turn (tilt, or a wireframe's rotation) so the corner sits exactly on it
      const deg = (c.rot || 0) + (document.body.classList.contains('neat') ? 0 : (c.r || 0)), a = deg * Math.PI / 180, cx = c.x + w / 2, cy = c.y + h / 2, dx = w / 2, dy = h / 2;
      rh.style.left = (cx + dx * Math.cos(a) - dy * Math.sin(a)) + 'px'; rh.style.top = (cy + dx * Math.sin(a) + dy * Math.cos(a)) + 'px'; }
    requestAnimationFrame(syncRH);
  }
  requestAnimationFrame(syncRH);   // starts after the rest of the app is set up
  const toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.z, y: (cy - r.top - view.y) / view.z }; };
  // a trackpad sends several scroll/pinch steps per frame: do the math for each one, but draw only once per frame
  let viewRaf = 0;
  const viewSoon = () => { if (!viewRaf) viewRaf = requestAnimationFrame(() => { viewRaf = 0; applyView(); }); };
  function zoomAt(cx, cy, z, soon) {
    const r = stage.getBoundingClientRect(), p = toWorld(cx, cy); view.z = clamp(z, .15, 3);
    view.x = cx - r.left - p.x * view.z; view.y = cy - r.top - p.y * view.z; soon ? viewSoon() : applyView();
  }
  function fit(cards, pad = 120, maxZ = 1.4) {
    if (!cards.length) return; const r = stage.getBoundingClientRect();
    const x0 = Math.min(...cards.map(c => c.x)), y0 = Math.min(...cards.map(c => c.y)), x1 = Math.max(...cards.map(c => c.x + c.w)), y1 = Math.max(...cards.map(c => c.y + c.h));
    const ph = document.body.classList.contains('phone'), L = ph ? 0 : 270, ch = !ph && chatOpen() && $('mChat').getBoundingClientRect(), R = ph ? 0 : ch && ch.width ? Math.max(260, Math.min(r.right - ch.left + 30, r.width - L - 520)) : 260;   // a phone has no side panels to leave room for   // the open space between the left boxes and the tray (or Mochi's chat, when it's open)
    view.z = clamp(Math.min((r.width - L - R - pad) / (x1 - x0), (r.height - pad * 2) / (y1 - y0)), .2, maxZ);
    view.x = L + (r.width - L - R - (x1 - x0) * view.z) / 2 - x0 * view.z; view.y = (r.height - (ph ? 90 : 0) - (y1 - y0) * view.z) / 2 - y0 * view.z + (ph ? 20 : 0);
    world.style.transition = 'transform .5s cubic-bezier(.2,.8,.3,1)'; applyView(); setTimeout(() => world.style.transition = '', 520);
  }

  // ---------- rendering ----------
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function inner(c) {
    switch (c.type) {
      case 'note': return `${c.mochi ? `<div class="nm-head"><img class="nmochi" src="stamps/mochi-wave.png" alt=""><div class="nname">${esc(c.name || '')}</div></div>` : c.name !== undefined ? `<div class="nname">${esc(c.name)}</div>` : ''}<div class="text">${esc(c.text)}</div>`;
      case 'doc': return `<div class="pill">${CIC.doc}<span class="text">${esc(c.text)}</span></div>`;
      case 'canvas': return `<div class="cv-head">${CIC.canvas}<span class="text">${esc(c.text)}</span></div><div class="cv-prev"><em>empty canvas</em></div>`;
      case 'shape': return shapeSVG(c) + `<div class="text">${esc(c.text || '')}</div>`;
      case 'stamp': return `<div class="st">${c.src ? `<img src="${esc(c.src)}" alt="">` : pxSrc(c.emoji || '⭐') ? `<img src="${pxSrc(c.emoji || '⭐')}" alt="">` : `<span>${esc(c.emoji || '⭐')}</span>`}</div>`;
      case 'spotify': return `<div class="sp-head"><svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="11" fill="#1ed760"/><path d="M6.6 9.4c3.6-1.1 7.8-.8 11 1M7.2 12.6c3-.9 6.3-.6 9 .9M7.8 15.6c2.4-.6 4.9-.4 7 .8" stroke="#121212" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg><span>${esc(c.title || 'Spotify')}</span></div>`
        + `<div class="sp-wrap">${c.image ? `<img class="sp-art" src="${esc(c.image)}" alt="">` : ''}<iframe class="sp-frame" data-src="${esc(spEmbed(c))}" src="${esc(spEmbed(c))}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="${esc(c.title || 'Spotify')}"></iframe><div class="sp-shield" title="Click to select, then play"></div></div>`;
      case 'video': {
        if (c.src) return `<div class="vd-stage"><video class="vd-v"></video><button class="vd-play" data-act="vd-play" aria-label="Play">${PLAY}</button></div><div class="vd-bar"><button class="vd-pp" data-act="vd-play" aria-label="Play or pause">${PLAY}</button><div class="vd-prog" data-act="vd-seek"><i></i></div><span class="vd-time">${fmtT(c.dur || 0)}</span><button class="vd-mute${c.muted ? ' off' : ''}" data-act="vd-mute" aria-label="Sound">${SPK}</button><button class="vd-txb${c.text ? ' on' : ''}" data-act="vd-tx" aria-label="Write it out" data-tip="Write it out"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="2.5" y="4" width="15" height="12" rx="2.5"/><path d="M5.5 9h3M10.5 9h4M5.5 12.5h6M13.5 12.5h1"/></svg></button></div>`
          + (c.txShown ? `<div class="vd-txt"><div class="vd-txt-body${c.text ? '' : ' wait'}">${esc(c.text || c.txNote || 'Mochi is writing it out…')}</div>${c.text ? `<div class="vd-txt-acts">${settings.ai && haveClaude !== false ? '<button data-act="vd-notes">✦ Turn into notes</button>' : ''}<button data-act="vd-copy">Copy</button></div>` : c.needTx ? '<div class="vd-txt-acts"><button data-act="vd-tx">✦ Write it out</button></div>' : ''}</div>` : '');
        if (c.saving) return `<div class="vd-stage"><div class="vd-msg"><b>Saving your video…</b><span>${Math.round((c.pct || 0) * 100)}%</span></div></div><div class="vd-bar"><span class="vd-title">${esc(c.title || 'Video')}</span></div>`;
        return `<div class="vd-stage live"><video class="vd-live"></video>${c.camErr ? `<div class="vd-msg"><b>${esc(c.camErr)}</b></div>` : c.camRest ? `<button class="vd-msg vd-wake" data-act="vd-wake"><b>Your camera is resting</b><span>Click to turn it on</span></button>` : ''}${c.count ? `<div class="vd-count">${c.count}</div>` : ''}${c.rec && !c.count ? `<div class="vd-recdot"><i></i><span class="vd-rtime">0:00</span></div>` : ''}${!c.rec && !c.camErr && cams.get(c.id) ? `<button class="vd-dev" data-act="vd-dev"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="10.5" height="9" rx="2.2"/><path d="M13 9l4.5-2.6v7.2L13 11"/></svg><span>${esc(devName(cams.get(c.id).stream.getVideoTracks()[0], 'Camera'))}</span><i>▾</i></button>` : ''}${!c.rec && !c.camErr && cams.get(c.id) ? `<div class="vd-look"><button class="${settings.camFlip === false ? '' : 'on'}" data-act="vd-flip" data-tip="Flip" aria-label="Flip the camera"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v14"/><path d="M7.5 5.5L3 14h4.5zM12.5 5.5L17 14h-4.5z"/></svg></button></div>` : ''}${!c.rec && !c.camErr ? `<div class="vd-shape"><button data-act="vd-wide" class="${c.vert ? '' : 'on'}"><i class="w"></i>Wide</button><button data-act="vd-tall" class="${c.vert ? 'on' : ''}"><i class="t"></i>Phone</button></div>` : ''}</div>`
          + `<div class="vd-bar">${c.rec ? `<button class="vd-stop" data-act="vd-stop"><i></i>Stop</button>` : `<button class="vd-start" data-act="vd-start"><span class="au-rec"></span>${c.vert ? 'Record' : 'Start recording'}</button><button class="vd-file" data-act="vd-file" title="Use a video file">${c.vert ? '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13.5v1.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-1.5M10 3.5v9M6.5 7L10 3.5 13.5 7"/></svg>' : 'Use a video file'}</button>`}</div>`;
      }
      case 'audio': return c.ready && !c.rec && !c.src ? `<div class="au-top"><span class="au-mic">${MIC}</span><span class="text">${esc(c.title || 'Voice memo')}</span></div><button class="au-start" data-act="au-start"><span class="au-rec"></span>Start recording</button><button class="au-dev" data-act="au-dev">${MIC}<span>${esc(devName(warm?.getAudioTracks?.()[0], 'Microphone'))}</span><i>▾</i></button>`
        : c.rec ? `<div class="au-top"><span class="au-dot${c.count || c.starting ? ' wait' : ''}"></span><b>${c.count === 'connecting' ? 'Mochi is connecting to voice…' : c.count ? 'Start talking in…' : c.starting ? 'Starting…' : c.paused ? 'Paused' : 'Recording…'}</b><span class="au-time">0:00</span></div>${c.count || c.starting ? `<div class="au-count${typeof c.count === 'string' ? ' soft' : ''}">${c.count === 'connecting' ? '<i></i><i></i><i></i>' : c.count || ''}</div>` : '<canvas class="au-live" width="520" height="68"></canvas>'}<div class="au-acts"><button data-act="au-pause">${c.paused ? 'Resume' : 'Pause'}</button><button data-act="au-stop" class="solid">Stop</button></div>`
        : `<div class="au-top"><span class="text">${esc(c.title || 'Voice memo')}</span></div><div class="au-row"><button class="au-play" data-act="au-play">${PLAY}</button><div class="au-wave" data-act="au-seek">${(c.wave || Array(40).fill(.2)).map(v => `<i style="height:${Math.max(8, v * 100)}%"></i>`).join('')}</div><span class="au-time">${fmtT(c.dur || 0)}</span></div>`
          + `<div class="au-tx${c.text ? '' : ' wait'}">${c.text ? esc(c.text) : esc(c.txNote || 'Mochi is writing it out…')}</div><div class="au-acts"><button data-act="au-replace">Replace</button>${c.text ? '<button data-act="au-notes">✦ Turn into notes</button>' : c.needTx ? '<button data-act="au-tx">✦ Write it out</button>' : ''}</div>`;
      case 'path': return `<svg class="pth" viewBox="0 0 ${c.ow} ${c.oh}" preserveAspectRatio="none"><path d="${pathD(c.pts, c.closed, c.radius || 0, c.ow / Math.max(1, c.w))}" fill="${c.closed && c.fill ? c.fill : 'none'}" stroke="${c.stroke && c.sw > 0 ? c.stroke : 'none'}" stroke-width="${c.sw || 0}" stroke-linecap="round" stroke-linejoin="round"${skStyle(c) === 'dash' ? ` stroke-dasharray="${c.dl ?? 8} ${c.dg ?? 6}"` : skStyle(c) === 'dot' ? ` stroke-dasharray="0 ${(c.dg ?? 6) + (c.sw || 0)}"` : ''} vector-effect="non-scaling-stroke"/>${pathEnds(c)}</svg>`;
      case 'ink': return `<svg viewBox="0 0 ${c.ow} ${c.oh}" preserveAspectRatio="none">${inkPath(c.pts, c.pen, c.size, c.ink, true)}</svg>`;
      case 'frame': return `<div class="fr-body"></div><div class="fr-name">${esc(c.name || 'Screen')}</div>`;
      case 'section': return `<div class="sec-glass"></div><div class="sec-name"><span class="text">${esc(c.text || 'Section')}</span></div>`;
      case 'box': if (c.video) return `<div class="bx"><video class="bx-img bx-vid" data-v="${esc(c.video)}" autoplay muted loop playsinline style="${frameStyle(c)}"></video></div>`;   // a looping animation from their files (an animated logo, a character)
        return `<div class="bx">${c.src ? `<img class="bx-img" src="${c.src}" alt="" draggable="false" style="${frameStyle(c)}">` : ''}</div>${c.src ? `<img class="bx-ghost" src="${c.src}" alt="" draggable="false" style="${frameStyle(c)}"><button class="bx-fr" title="Adjust the crop">⤢ Crop</button><button class="chip" data-act="colors">pull colors ✦</button>` : ''}${c.img && !c.src ? `<div class="bx-ph"><img class="bx-art" src="stamps/ph/${phScene(c)}.png" alt=""><span class="bx-l">${esc(c.img)}</span></div>` : ''}`;
      case 'font': { const f = esc(c.font || 'DM Sans'); useFont(c.font); return `<div class="fs-aa" style="font-family:'${f}', system-ui">Aa</div><div class="fs-meta"><b>${f}</b><span class="fs-src">${onMac(c.font) ? 'On your Mac' : 'Google Fonts'}</span></div><div class="fs-sample text" style="font-family:'${f}', system-ui">${esc(c.text || 'The quick brown fox jumps over the lazy dog')}</div>`; }
      case 'icon': return `<span class="mi">${esc(c.name || 'star')}</span>`;
      case 'text': return `<div class="text tx">${esc(c.text || '')}</div>`;
      case 'coll': return `<div class="coll-head"><span class="text">${esc(c.text)}</span></div><div class="coll-frame"></div>${(c.kids || []).length ? '' : '<div class="coll-empty">Drop cards here</div>'}`;
      case 'title': return `<div class="text">${esc(c.text)}</div>`;
      case 'file': return fileInner(c);
      case 'folder': return folderInner(c);
      case 'table': { const rows = c.rows?.length ? c.rows : [['']], hd = c.head !== false;   // a table: rows of cells, the first row is the header unless you turn it off
        return `<table class="tb${hd ? ' has-head' : ''}"><tbody>${rows.map((r, i) => `<tr>${r.map((v, j) => { const tg = i === 0 && hd ? 'th' : 'td'; return `<${tg} data-r="${i}" data-c="${j}">${esc(v)}</${tg}>`; }).join('')}</tr>`).join('')}</tbody></table>`
          + `<button class="tb-add tb-addr" data-act="tb-row" title="Add a row" aria-label="Add a row">+</button><button class="tb-add tb-addc" data-act="tb-col" title="Add a column" aria-label="Add a column">+</button>`; }
      case 'image': {
        // a crop shows a window onto the picture: the picture is scaled up and shifted so only the kept part shows
        const k = !c.cropEdit && c.crop, st = k ? `position:absolute;width:${100 / k.w}%;height:${100 / k.h}%;left:${-k.x / k.w * 100}%;top:${-k.y / k.h * 100}%;object-fit:fill;border-radius:0` : '';
        const ui = c.cropEdit && cropping ? `<div class="crop-ui"><div class="crop-box" style="left:${cropping.box.x * 100}%;top:${cropping.box.y * 100}%;width:${cropping.box.w * 100}%;height:${cropping.box.h * 100}%">${['nw', 'ne', 'sw', 'se'].map(h => `<i data-h="${h}"></i>`).join('')}</div></div>` : '';
        return `<div class="imgwrap"><img class="bx-img" src="${esc(c.src)}" alt="" draggable="false" style="${st || imgFrameStyle(c)}"><img class="bx-ghost" src="${esc(c.src)}" alt="" draggable="false" style="${st || imgFrameStyle(c)}">${ui}</div>${c.cropEdit ? '' : '<button class="chip" data-act="colors">pull colors ✦</button><button class="bx-fr" title="Adjust the crop">⤢ Crop</button>'}`; }
      case 'link': return !c.url ? `<div class="link-in${c.loading ? ' loading' : ''}">${CIC.link}<input placeholder="Add a link…" value="${esc(c.draft || '')}" spellcheck="false"></div>`
        : `<div class="thumb" style="${c.image ? `background-image:url('${esc(c.image)}')` : ''}"></div><div class="meta"><i class="fav" style="background-image:url('https://www.google.com/s2/favicons?sz=64&domain=${esc(host(c.url))}')"></i><div><b>${esc(c.title || c.url)}</b><span>${esc(c.desc || host(c.url))}</span></div></div>`;
      case 'todo': return `<div class="head">${esc(c.text)}</div><ul>${(c.items || []).map((it, i) => `<li class="${it.done ? 'done' : ''}" data-i="${i}"><input type="checkbox" ${it.done ? 'checked' : ''}><span>${esc(it.t)}</span><button class="li-x" data-act="item-x" title="Remove" aria-label="Remove this item"><svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></li>`).join('')}</ul><button class="add-item" data-act="item">+ add</button>`;
      case 'swatch': return `<div class="chipcol"></div><div class="hex">${c.hideName ? '' : `<b>${esc(c.label || c.hex.toUpperCase())}</b>`}${c.hideHex ? '' : `<span>${esc(c.hex.toUpperCase())}</span>`}</div>`;
    }
    return '';
  }
  // which cards can be tilted by hand: everything except the things that hold other things (sections, screens, collections) and wireframe pieces (they rotate their own way)
  const TILTS = c => !['section', 'frame', 'coll', 'ink', 'box', 'text', 'icon', 'folder'].includes(c.type);   // (the wireframe list WF isn't set up yet when the first cards draw)
  const SIZED_T = ['note', 'todo', 'title', 'shape', 'coll', 'table'];
  // strokes: boxes and screens get a border (solid or dashed); titles, wireframe text and icons get an outline around the letters
  const STROKABLE = ['box', 'frame', 'title', 'text', 'icon', 'path', 'shape', 'image'], STROKE_TEXT = ['title', 'text', 'icon'];
  const canStroke = c => STROKABLE.includes(c.type) && !(c.type === 'shape' && (c.shape === 'line' || c.shape === 'bool')) && !(c.type === 'image' && isMasked(c));
  // boxes and screens: the line is drawn (an SVG rect) so it can be solid, dashed or dotted with your own dash length and gap, like Figma
  const skStyle = c => c.sdash === true ? 'dash' : c.sdash || 'solid';
  // dashed or dotted letters: the browser can only outline text solid, so the words are redrawn as an SVG on top (line by line, same font),
  // with the real text underneath kept for editing. While you edit, the real text shows normally
  function textStrokeSVG(c, el) {
    el.querySelector(':scope > .tsk')?.remove(); el.classList.remove('tsk-on');
    return;   // paused: dashed/dotted letters couldn't stay lined up in Safari; text outlines are solid for now
    if (!['title', 'text'].includes(c.type) || !(c.stroke && c.sw > 0) || skStyle(c) === 'solid') return;
    const t = el.querySelector(c.type === 'title' ? '.text' : '.tx'); if (!t || !t.textContent.trim()) return;
    // measured on the real text itself (its real line breaks and letter spots), held straight for a moment, and converted by the board zoom, which is always known exactly
    el.classList.add('tsk-measure'); void el.offsetWidth;
    const z = view.z || 1, er = el.getBoundingClientRect(), lines = [], rg = document.createRange(), walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) for (let i = 0; i < node.length; i++) { if (!node.data[i].trim()) continue; rg.setStart(node, i); rg.setEnd(node, i + 1); const r = rg.getClientRects()[0]; if (!r) continue;
      const top = (r.top - er.top) / z, x = (r.left - er.left) / z, L = lines.find(l => Math.abs(l.top - top) < r.height / z * .5) || (lines.push({ top, ch: [] }), lines[lines.length - 1]);
      let ch = node.data[i]; if (c.tcase === 'upper') ch = ch.toUpperCase(); else if (c.tcase === 'lower') ch = ch.toLowerCase(); else if (c.tcase === 'title' && (i === 0 || /\s/.test(node.data[i - 1]))) ch = ch.toUpperCase();
      L.ch.push({ c: ch, x }); }
    el.classList.remove('tsk-measure');
    // the font itself, read unzoomed (Safari reports zoomed sizes inside a zoomed board), from a plain copy of the text's style
    const host = textStrokeSVG.host || (textStrokeSVG.host = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tsk-host' })));
    const cl = el.cloneNode(true); cl.querySelector(':scope > .tsk')?.remove(); host.appendChild(cl);
    const g = getComputedStyle(cl.querySelector(c.type === 'title' ? '.text' : '.tx')), cs = { color: g.color, fontFamily: g.fontFamily, fontSize: g.fontSize, fontWeight: g.fontWeight, fontStyle: g.fontStyle }; cl.remove();
    const st = skStyle(c), fillC = (c.type === 'title' ? c.tc : c.color) === 'none' ? 'none' : cs.color, w = c.sw;
    const mc = (textStrokeSVG.cv ||= document.createElement('canvas').getContext('2d')); mc.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const asc = mc.measureText('Hg').fontBoundingBoxAscent || parseFloat(cs.fontSize) * .8;
    const dash = st === 'dash' ? `${c.dl ?? 8} ${c.dg ?? 6}` : `0 ${(c.dg ?? 6) + w * 2}`, ff = cs.fontFamily.replace(/"/g, "'");
    el.insertAdjacentHTML('beforeend', `<svg class="tsk" aria-hidden="true">${lines.filter(l => l.ch.length).map(l => `<text x="${l.ch.map(q => q.x.toFixed(1)).join(' ')}" y="${(l.top + asc).toFixed(1)}" style="font-family:${ff};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};letter-spacing:0;font-kerning:none" fill="${fillC}" stroke="${c.stroke}" stroke-width="${w * 2}" stroke-dasharray="${dash}" stroke-linecap="${st === 'dot' ? 'round' : 'butt'}" stroke-linejoin="round" paint-order="stroke fill">${esc(l.ch.map(q => q.c).join(''))}</text>`).join('')}</svg>`);
    el.classList.add('tsk-on');
  }
  const tskSoon = (c, el) => requestAnimationFrame(() => { if (el.isConnected) textStrokeSVG(c, el); });
  const tskRO = new ResizeObserver(es => es.forEach(e => { const el = e.target, c = byId(el.dataset.id); if (c && !el.classList.contains('editing')) textStrokeSVG(c, el); }));
  function applyStroke(c, el) {
    if (['title', 'text'].includes(c.type)) { if (c.stroke && c.sw > 0 && skStyle(c) !== 'solid') { tskSoon(c, el); tskRO.observe(el); } else { el.querySelector(':scope > .tsk')?.remove(); el.classList.remove('tsk-on'); tskRO.unobserve(el); } }
    if (c.type === 'title') { const t = el.querySelector('.text'); if (t) t.style.color = c.tc && c.tc !== 'none' ? c.tc : ''; }   // a title's own text color (applied after its text is drawn)
    if (!canStroke(c)) return; const on = !!(c.stroke && c.sw > 0);
    el.classList.toggle('has-stroke', on);
    if (on) { el.style.setProperty('--sk', c.stroke); el.style.setProperty('--skw', c.sw + 'px'); } else { el.style.removeProperty('--sk'); el.style.removeProperty('--skw'); }
    if (c.type !== 'box' && c.type !== 'frame') return;
    let svg = el.querySelector(':scope > .sk-svg'); if (!on) { svg?.remove(); return; }
    if (!svg) { el.insertAdjacentHTML('beforeend', '<svg class="sk-svg" aria-hidden="true"><rect x="0" y="0" width="100%" height="100%"/></svg>'); svg = el.querySelector(':scope > .sk-svg'); }
    const st = skStyle(c), w = c.sw, r = Math.max(0, (c.type === 'frame' ? c.radius ?? 0 : c.radius || 0) - w / 2), rect = svg.firstChild;
    rect.setAttribute('rx', r); rect.setAttribute('ry', r); rect.setAttribute('stroke', c.stroke); rect.setAttribute('stroke-width', w);
    rect.setAttribute('stroke-dasharray', st === 'dash' ? `${c.dl ?? 8} ${c.dg ?? 6}` : st === 'dot' ? `0 ${(c.dg ?? 6) + w}` : 'none');
    rect.setAttribute('stroke-linecap', st === 'dot' ? 'round' : c.cap === 'round' ? 'round' : 'butt');
  }
  const titleW = c => c.type === 'title' && !c.fixedW ? 'max-content' : c.w + 'px';
  function renderCard(c, pop) {
    let el = cardsEl.querySelector(`[data-id="${c.id}"]`);
    if (!el) { el = document.createElement('div'); el.dataset.id = c.id; cardsEl.appendChild(el); if (pop) el.classList.add('pop'); }
    el.className = `card ${c.type}` + (sel.has(c.id) ? ' sel' : '') + (focusSet && !focusSet.has(c.id) ? ' dim' : '') + (pop ? ' pop' : '');
    Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: titleW(c), height: c.type === 'title' ? 'auto' : c.h + 'px' });
    if (c.type === 'table') el.style.setProperty('--iz', (1 / view.z).toFixed(4));
    el.classList.toggle('ly-off', !!c.hidden); el.classList.toggle('ly-lock', !!c.locked); el.classList.toggle('fixedw', !!c.fixedW); applyStroke(c, el); shadowVars(c, el);
    if (c.type === 'title' || c.type === 'text') el.classList.toggle('no-fill', (c.type === 'title' ? c.tc : c.color) === 'none'); if (SIZED_T.includes(c.type)) { el.style.setProperty('--ta', c.align || (c.type === 'shape' ? 'center' : 'left'));
      el.style.setProperty('--tt', { upper: 'uppercase', lower: 'lowercase', title: 'capitalize' }[c.tcase] || 'none');   // Case: how the words show (what you typed stays as typed)
      if (c.lh != null) el.style.setProperty('--lh', c.lh); else el.style.removeProperty('--lh'); el.classList.toggle('has-lh', c.lh != null);
      if (c.ls != null) el.style.setProperty('--ls', c.ls / 100 + 'em'); else el.style.removeProperty('--ls'); el.classList.toggle('has-ls', c.ls != null); }
    if (c.type === 'title') requestAnimationFrame(() => { if (!el.isConnected) return; if (!c.fixedW && el.offsetWidth) c.w = el.offsetWidth; if (el.offsetHeight) c.h = el.offsetHeight; });
    el.style.setProperty('--tilt', ((c.type === 'stamp' && !c.tilted) || (c.type === 'section' && !c.turned) ? 0 : c.r) + 'deg'); el.style.setProperty('--fill', COLORS[c.color] || '#fff'); el.classList.add('c-' + (COLORS[c.color] && c.color !== 'white' ? c.color : 'white'));
    if (c.type === 'swatch') el.style.setProperty('--hex', c.hex);
    el.style.setProperty('--fs', fsMul(c));
    el.classList.toggle('has-font', !!c.font && SIZED.includes(c.type)); if (c.font && SIZED.includes(c.type)) { el.style.setProperty('--cf', `"${String(c.font).replace(/"/g, '')}"`); useFont(c.font); } else el.style.removeProperty('--cf');
    ['bold', 'italic', 'under', 'strike'].forEach(k => { el.classList.toggle('t-' + k, c[k] === true); el.classList.toggle('t-no' + k, c[k] === false); });
    if (c.type === 'doc') el.classList.toggle('has-body', !!(c.body || '').trim());
    if (c.type === 'audio') { el.classList.toggle('paused', !!c.paused); if (!c.rec) requestAnimationFrame(() => fitAudio(c, el)); }
    if (c.type === 'stamp') { el.style.setProperty('--sz', c.w + 'px'); if (c.mv) el.classList.add('mv-' + c.mv); }
    if (c.type === 'link') el.classList.toggle('compact', !c.url || !c.image);
    if (c.type === 'link') el.classList.toggle('shot', !!c.shot);
    if (c.type === 'canvas' && c.board) mini(c.board).then(svg => { const p = el.querySelector('.cv-prev'); if (p && svg) p.innerHTML = svg; });
    if (c.type === 'link' && !c.url) setTimeout(() => wireLinkInput(c), 0);
    if (c.type === 'coll') { const t = COLL[c.color] || COLL.pink; el.style.setProperty('--chead', t[0]); el.style.setProperty('--cframe', t[1]); el.classList.toggle('nohead', c.head === false); el.style.height = c.h + 'px'; }
    else if (parentOf(c.id)) el.classList.add('inside');
    if (c.type === 'spotify') { const fr = el.querySelector('.sp-frame'); if (fr && fr.dataset.src === spEmbed(c)) { const t = el.querySelector('.sp-head span'); if (t) t.textContent = c.title || 'Spotify'; const tg = el.querySelector(':scope > .tag'); if (tg) tg.textContent = c.tagText || ''; if (!!tg === !!c.tagText) return el; } }
    el.innerHTML = `<div class="frame"></div><div class="body">${inner(c)}</div>${c.tagText ? `<div class="tag">${esc(c.tagText)}</div>` : ''}<div class="knob"></div><div class="handle"></div>${TILTS(c) ? '<i class="rot-h" title="Drag to tilt"></i>' : ''}`;
    el.classList.toggle('kitc', !!c.kit); el.classList.toggle('lane', !!c.lane); el.classList.toggle('nobg', !!c.nobg); el.classList.toggle('noframe', !!c.noframe);
    if (c.type === 'video') setupVideo(c, el); if (c.type === 'file' || c.type === 'folder') hydrateFiles(c, el); if (c.type === 'box' && c.video) { const v = el.querySelector('video.bx-vid'); if (v) MB.mediaURL(c.video).then(u => { if (v.getAttribute('src') !== u) v.src = u; v.play?.().catch(() => {}); }); } maskVars(c, el); el.style.setProperty('--cw', Math.max(1, c.w) + 'px'); el.classList.toggle('tiny', c.w < 140 || c.h < 90);
    if (el.classList.contains('masked')) el.querySelectorAll('.chip, .bx-fr').forEach(ch => el.appendChild(ch));   // the chips live outside the mask's clip, so Crop stays clickable
    if (WF.includes(c.type)) styleWF(c, el);   // after the insides exist
    else applyStroke(c, el);
    if (c.type === 'image') el.style.setProperty('--img-r', (c.radius ?? 12) + 'px');
    return el;
  }
  // a card on a screen always sits above its screen in the stack (older boards could have them the other way round, which didn't show while screens were pinned to the back)
  function keepOnScreens() { const at = new Map(board.cards.map((c, i) => [c.id, i])); if (!board.cards.some(c => c.onFrame && at.has(c.onFrame) && at.get(c.id) < at.get(c.onFrame))) return;
    const kids = new Map(); board.cards.forEach(c => { if (c.onFrame && at.has(c.onFrame) && at.get(c.id) < at.get(c.onFrame)) { if (!kids.has(c.onFrame)) kids.set(c.onFrame, []); kids.get(c.onFrame).push(c); } });
    const moving = new Set([...kids.values()].flat()), out = []; board.cards.forEach(c => { if (moving.has(c)) return; out.push(c); (kids.get(c.id) || []).forEach(k => out.push(k)); }); board.cards = out; }
  function renderAll() { keepOnScreens(); wireLayers(); layersSoon(); applyColors(); cardsEl.innerHTML = ''; board.cards.filter(c => c.type === 'coll').forEach(c => renderCard(c)); board.cards.filter(c => c.type !== 'coll').forEach(c => renderCard(c)); layoutAll(); renderWires(); renderTray(); applyView(); watchSoon(); }

  // ---------- round 2 pieces: icons, shapes, link hosts ----------
  const CI = d => `<svg class="cic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const CIC = {
    doc: CI('<path d="M5.5 2.5h6l3.5 3.5v10.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5"/>'),
    canvas: CI([5, 10, 15].map(y => [5, 10, 15].map(x => `<circle cx="${x}" cy="${y}" r="1.1" fill="currentColor" stroke="none"/>`).join('')).join('')),
    link: CI('<path d="M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-.9.9"/><path d="M11.5 8.5a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l.9-.9"/>'),
  };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  // "jessa.art", "mochiboard.app/updates" or a full address: all read as links, and the https:// is added when it's missing
  const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|psd|ai|fig|sketch|pdf|zip|mov|mp4|m4a|mp3|wav|txt|md|csv|json|js|css|html?|swift|py|docx?|xlsx?|pptx?|key|numbers|pages|dmg|exe)$/i;
  const asLink = t => { t = t.trim(); if (/\s/.test(t)) return ''; if (/^https?:\/\/\S+$/i.test(t)) return t; if (FILE_EXT.test(t) && !/\//.test(t)) return ''; return /^([\w-]+\.)+[a-z]{2,}(:\d+)?([\/?#]\S*)?$/i.test(t) ? 'https://' + t : ''; };
  const SHAPE_FILL = { gray: '#e4dfe7', pink: '#ffb8d2', butter: '#f8e08a', mint: '#a8e6c3', sky: '#aed3ff', lilac: '#cdb8ff', peach: '#ffc8a6', ink: '#494848' };
  // a line can be wavy, zigzag or loopy: waves = how tight, round = sharp → soft (or the loop size), wobble = hand-drawn looseness. Drawn in the 0–100 box
  function squigPath(c) {
    const n = Math.max(.5, c.waves ?? 6), r = (c.round ?? 60) / 100, wob = (c.wobble ?? 0) / 100, A = 46, st = c.squig;
    let seed = [...String(c.id || 'x')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const p1 = rnd() * 6.28, p2 = rnd() * 6.28, p3 = rnd() * 6.28;
    const wobAmp = u => 1 + wob * .55 * (Math.sin(6.28 * .37 * u + p1) * .6 + Math.sin(6.28 * .83 * u + p2) * .4), drift = u => wob * A * .22 * Math.sin(6.28 * .21 * u + p3);
    const pts = [], N = Math.ceil(4 * n) * 14;
    for (let i = 0; i <= N; i++) { const t = i / N, u = n * t; let x, y;
      if (st === 'loopy') { const k = 1 + r * 1.8, th = 6.28318 * u; x = (th - k * Math.sin(th)) / (6.28318 * n) * 100; y = 50 - A * .8 * Math.cos(th) * wobAmp(u) + drift(u); }
      else { const sn = Math.sin(6.28318 * u), tri = 2 / Math.PI * Math.asin(sn), mix = r; x = t * 100; y = 50 - A * (tri * (1 - mix) + sn * mix) * wobAmp(u) + drift(u); }
      pts.push(x.toFixed(2) + ' ' + y.toFixed(2)); }
    return 'M' + pts.join(' L');
  }
  function shapeSVG(c) {
    const named = SHAPE_FILL[c.fill || 'gray'], f = c.fill === 'none' ? 'none' : named ? `var(--sh-${c.fill || 'gray'})` : c.fill, sk = c.stroke && c.sw > 0 && c.shape !== 'line';
    const P = sk ? { stroke: c.stroke, 'stroke-width': c.sw, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', ...(skStyle(c) === 'dash' ? { 'stroke-dasharray': `${c.dl ?? 8} ${c.dg ?? 6}` } : skStyle(c) === 'dot' ? { 'stroke-dasharray': `0 ${(c.dg ?? 6) + c.sw}`, 'stroke-linecap': 'round' } : {}), style: `fill:${f}` } : { stroke: 'none', style: `fill:${f}` };
    const attrs = o => Object.entries(o).map(([k, v]) => `${k}="${v}"`).join(' ');
    const body = (c.shape === 'bool' ? { bool: boolSVG(c, f) } : {
      rect: `<rect x="0" y="0" width="100" height="100" rx="${c.radius != null ? Math.min(50, c.radius * 100 / Math.max(1, c.w || 160)) : 10}" ry="${c.radius != null ? Math.min(50, c.radius * 100 / Math.max(1, c.h || 160)) : 10}" ${attrs(P)}/>`,
      circle: `<ellipse cx="50" cy="50" rx="50" ry="50" ${attrs(P)}/>`,
      tri: `<path d="${c.radius ? roundedD([{ x: 50, y: 2 }, { x: 98, y: 98 }, { x: 2, y: 98 }], true, c.radius * 100 / Math.max(1, Math.min(c.w || 160, c.h || 160))) : 'M50 2 L98 98 L2 98 Z'}" stroke-linejoin="round" ${attrs(P)}/>`,
      star: `<path d="${c.radius ? roundedD([[50, 3], [62, 36], [97, 37], [69, 58], [79, 93], [50, 72], [21, 93], [31, 58], [3, 37], [38, 36]].map(([x, y]) => ({ x, y })), true, c.radius * 100 / Math.max(1, Math.min(c.w || 160, c.h || 160))) : 'M50 3 L62 36 L97 37 L69 58 L79 93 L50 72 L21 93 L31 58 L3 37 L38 36 Z'}" ${attrs(P)}/>`,
      // diagram shapes: their curves and slants stay the same size however wide or tall the shape is
      diamond: `<path d="M50 1 L99 50 L50 99 L1 50 Z" stroke-linejoin="round" ${attrs(P)}/>`,
      pill: (() => { const W = c.w || 160, H = c.h || 64, r = Math.min(W, H) / 2; return `<rect x="0" y="0" width="100" height="100" rx="${r * 100 / W}" ry="${r * 100 / H}" ${attrs(P)}/>`; })(),
      io: (() => { const s = Math.min(25, 20 * 100 / (c.w || 180)); return `<path d="M${s} 0 H100 L${100 - s} 100 H0 Z" stroke-linejoin="round" ${attrs(P)}/>`; })(),
      doc: `<path d="M0 0 H100 V84 C78 72 62 102 34 95 C20 91 9 86 0 90 Z" ${attrs(P)}/>`,
      db: (() => { const e = Math.min(18, 12 * 100 / (c.h || 116)); return `<path d="M0 ${e} A50 ${e} 0 0 1 100 ${e} V${100 - e} A50 ${e} 0 0 1 0 ${100 - e} Z" ${attrs(P)}/><path d="M0 ${e} A50 ${e} 0 0 0 100 ${e}" fill="none" style="stroke:${sk ? c.stroke : 'rgba(40, 20, 50, .2)'}" stroke-width="${sk ? c.sw : 1.5}" vector-effect="non-scaling-stroke"/>`; })(),
      fnote: (() => { const fx = Math.min(30, 20 * 100 / (c.w || 170)), fy = Math.min(30, 20 * 100 / (c.h || 110)); return `<path d="M0 0 H${100 - fx} L100 ${fy} V100 H0 Z" stroke-linejoin="round" ${attrs(P)}/><path d="M${100 - fx} 0 V${fy} H100" fill="none" style="stroke:${sk ? c.stroke : 'rgba(40, 20, 50, .2)'}" stroke-width="${sk ? c.sw : 1.5}" vector-effect="non-scaling-stroke"/>`; })(),
      page: (() => { const W = c.w || 150, H = c.h || 96, b = 22 * 100 / H; return `<rect x="0" y="0" width="100" height="100" rx="${8 * 100 / W}" ry="${8 * 100 / H}" ${attrs(P)}/><path d="M0 ${b} H100" fill="none" style="stroke:${sk ? c.stroke : 'rgba(40, 20, 50, .18)'}" stroke-width="${sk ? c.sw : 1.5}" vector-effect="non-scaling-stroke"/>`; })(),
      heart: `<path d="M50 92 C20 72 3 55 3 33 C3 15 17 4 31 4 C40 4 47 9 50 16 C53 9 60 4 69 4 C83 4 97 15 97 33 C97 55 80 72 50 92 Z" ${attrs(P)}/>`,
      line: (c.squig || 'straight') === 'straight' ? `<line x1="0" y1="50" x2="100" y2="50" style="stroke:${(c.fill || 'gray') === 'gray' ? 'var(--pen-ink)' : f}" stroke-width="${c.lw || 4}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
        : `<path d="${squigPath(c)}" fill="none" style="stroke:${(c.fill || 'gray') === 'gray' ? 'var(--pen-ink)' : f}" stroke-width="${c.lw || 4}" stroke-linecap="round" stroke-linejoin="${(c.round ?? 60) < 15 && c.squig === 'zigzag' ? 'miter' : 'round'}" vector-effect="non-scaling-stroke"/>`,
    })[c.shape || 'rect'];
    return `<svg class="sh${(c.shape || 'rect') === 'line' ? ' is-line' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none">${body}</svg>`;
  }

  // ---------- collections: a named header over a frame; cards inside stack in columns and the frame grows to fit ----------
  const COLL = { pink: ['#ffb8d2', '#ffe3ee'], butter: ['#f8e08a', '#fff6cf'], mint: ['#a8e6c3', '#dff6ea'], lilac: ['#cdb8ff', '#eee6ff'], sky: ['#aed3ff', '#e2efff'], peach: ['#ffc8a6', '#ffeee0'], white: ['#e7e1ea', '#f5f1f6'] };
  const CW = 260, CPAD = 14, CGAP = 12, CHEAD = 52;
  const colls = () => board.cards.filter(c => c.type === 'coll');
  const parentOf = id => board.cards.find(s => s.type === 'coll' && (s.kids || []).includes(id));
  function naturalHeight(c, el) {
    if (c.type === 'image') return Math.round(CW * (c.h / c.w));
    if (!['note', 'todo'].includes(c.type)) return c.h;
    const was = el.style.height; el.style.height = 'auto'; const b = el.querySelector('.body'); b.style.height = 'auto';
    const h = Math.max(64, b.offsetHeight); el.style.height = was; b.style.height = ''; return h;
  }
  function layoutColl(s) {
    s.kids = (s.kids || []).filter(id => byId(id) && id !== s.id); s.cols = Math.max(1, s.cols || 1);
    s.w = s.cols * CW + (s.cols - 1) * CGAP + CPAD * 2;
    const top = s.head === false ? 0 : CHEAD, colH = Array(s.cols).fill(0), slot = [];
    s.kids.forEach(id => {
      const c = byId(id), el = cardsEl.querySelector(`[data-id="${id}"]`); if (!el) return;
      const h = naturalHeight(c, el); if (c.type === 'image') { c.h = h; }
      // each card remembers its column (where you dropped it); new ones go in the shortest
      let k = s.colOf?.[id]; if (k == null || k >= s.cols) { k = colH.indexOf(Math.min(...colH)); (s.colOf = s.colOf || {})[id] = k; }
      c.x = s.x + CPAD + k * (CW + CGAP); c.y = s.y + top + CPAD + colH[k]; c.w = CW; if (['note', 'todo'].includes(c.type)) c.h = h; c.r = 0;
      colH[k] += c.h + CGAP;
      Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: titleW(c), height: c.type === 'title' ? 'auto' : c.h + 'px' }); el.classList.add('inside');
    });
    s.h = top + CPAD * 2 + Math.max(90, Math.max(...colH) - CGAP);
    const el = cardsEl.querySelector(`[data-id="${s.id}"]`);
    // cards inside always sit on top of their collection (a card made before the collection would otherwise hide under it)
    if (el) { let after = el; s.kids.forEach(id => { const k = cardsEl.querySelector(`[data-id="${id}"]`); if (k && (k.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) { after.after(k); after = k; } }); }
    if (el) { Object.assign(el.style, { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }); el.querySelector('.coll-empty')?.remove(); if (!s.kids.length) el.querySelector('.body').insertAdjacentHTML('beforeend', '<div class="coll-empty">Drop cards here</div>'); }
  }
  function layoutAll() { if (!board) return; colls().forEach(layoutColl); cardsEl.querySelectorAll('.card.inside').forEach(el => { if (!parentOf(el.dataset.id)) el.classList.remove('inside'); }); }
  // which collection is under a point (or just to its right: dropping there adds a column)
  function collAt(w, skip) {
    for (const s of [...colls()].reverse()) { if (skip.has(s.id)) continue;
      if (w.y > s.y && w.y < s.y + s.h + 70) { if (w.x > s.x && w.x < s.x + s.w) return { s, side: false }; if (w.y < s.y + s.h && w.x >= s.x + s.w && w.x < s.x + s.w + 70) return { s, side: true }; } }   // a little below the frame adds to the end
    return null;
  }
  function dropInto(t, ids, w) {
    ids.forEach(id => { const from = parentOf(id); if (from) { from.kids = from.kids.filter(k => k !== id); if (from.colOf) delete from.colOf[id]; } });
    const s = t.s; s.kids = s.kids || []; s.colOf = s.colOf || {};
    let col;
    if (t.side) { s.cols = (s.cols || 1) + 1; col = s.cols - 1; }
    else col = clamp(Math.floor((w.x - s.x - CPAD) / (CW + CGAP)), 0, (s.cols || 1) - 1);
    // within that column, slot it after the cards that sit above where you let go
    const inCol = s.kids.filter(k => s.colOf[k] === col), above = inCol.filter(k => { const c = byId(k); return c && c.y + c.h / 2 < w.y; });
    const at = above.length ? s.kids.indexOf(above[above.length - 1]) + 1 : inCol.length ? s.kids.indexOf(inCol[0]) : s.kids.length;
    s.kids.splice(at, 0, ...ids); ids.forEach(id => s.colOf[id] = col);
  }

  // ---------- connectors: curved lines from edge to edge; select one to bend it, re-attach it, or restyle it ----------
  let selWire = null, selWires = new Set();   // the line you picked, and every line picked with Shift
  const center = c => ({ x: c.x + c.w / 2, y: c.y + (c.type === 'title' ? 25 : c.h / 2) });
  function edgePoint(c, toward) {   // where the line from a card's center toward a point leaves the card
    const m = center(c), dx = toward.x - m.x, dy = toward.y - m.y, hw = c.w / 2 + 6, hh = (c.type === 'title' ? 25 : c.h / 2) + 6;
    const k = Math.min(Math.abs(dx) ? hw / Math.abs(dx) : Infinity, Math.abs(dy) ? hh / Math.abs(dy) : Infinity, 1);
    return { x: m.x + dx * k, y: m.y + dy * k };
  }
  // a pinned line end: a spot on the card's edge, kept as a fraction of its width and height, so it follows the card when it moves or resizes
  function pinPoint(c, p) { const h = c.type === 'title' ? 50 : c.h, x = c.x + p.u * c.w, y = c.y + p.v * h, o = 6;
    return { x: x + (p.u <= 0 ? -o : p.u >= 1 ? o : 0), y: y + (p.v <= 0 ? -o : p.v >= 1 ? o : 0) }; }
  function pinAt(c, w) {   // the nearest point on the card's edge to where you dropped the end
    const h = c.type === 'title' ? 50 : c.h, u = Math.max(0, Math.min(1, (w.x - c.x) / c.w)), v = Math.max(0, Math.min(1, (w.y - c.y) / h));
    const d = [u, 1 - u, v, 1 - v], k = d.indexOf(Math.min(...d)), r = x => Math.round(x * 1000) / 1000;
    return k === 0 ? { u: 0, v: r(v) } : k === 1 ? { u: 1, v: r(v) } : k === 2 ? { u: r(u), v: 0 } : { u: r(u), v: 1 };
  }
  function wireGeom(l, a, b) {
    const ca = l.pa ? pinPoint(a, l.pa) : center(a), cb = l.pb ? pinPoint(b, l.pb) : center(b), p0 = l.pa ? ca : edgePoint(a, cb), p2 = l.pb ? cb : edgePoint(b, ca);
    const dx = p2.x - p0.x, dy = p2.y - p0.y, len = Math.hypot(dx, dy) || 1, n = { x: -dy / len, y: dx / len }, mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
    const bend = l.bend ?? Math.min(80, len * .2);   // a gentle curve unless you've set your own
    const c1 = { x: mid.x + n.x * bend, y: mid.y + n.y * bend }, handle = { x: mid.x + n.x * bend / 2, y: mid.y + n.y * bend / 2 };
    return { p0, p2, c1, handle, mid, n };
  }
  function renderWires(live) {
    const O = 5000; let h = '';
    board.links.forEach(l => { const a = byId(l.a), b = byId(l.b); if (!a || !b) return; const g = wireGeom(l, a, b), on = selWires.has(l.id);
      let d, from, from0, p0 = g.p0, p2 = g.p2, lab;
      if (l.route === 'elbow') { const E = elbowPts(l, a, b, g); d = roundPoly(E, O); p0 = E[0]; p2 = E[E.length - 1]; from = E[E.length - 2]; from0 = E[1]; lab = polyMid(E); }
      else { d = `M${g.p0.x + O} ${g.p0.y + O} Q${g.c1.x + O} ${g.c1.y + O} ${g.p2.x + O} ${g.p2.y + O}`; from = from0 = g.c1; lab = { x: (g.p0.x + 2 * g.c1.x + g.p2.x) / 4, y: (g.p0.y + 2 * g.c1.y + g.p2.y) / 4 }; }
      wireLab[l.id] = lab;
      const wc = l.color ? ` style="--wc:${l.color}"` : '', sh = p => ({ x: p.x + O, y: p.y + O });
      const arrow = headPath(headOf(l), sh(p2), sh(from), on, l.color) + headPath(tailOf(l), sh(p0), sh(from0), on, l.color);
      if (false) { const ux = p2.x - from.x, uy = p2.y - from.y, ul = Math.hypot(ux, uy) || 1, ax = ux / ul, ay = uy / ul, tip = { x: p2.x + O, y: p2.y + O };
        arrow = `<path class="w-arrow${on ? ' on' : ''}" d="M${tip.x - ax * 11 - ay * 7} ${tip.y - ay * 11 + ax * 7} L${tip.x} ${tip.y} L${tip.x - ax * 11 + ay * 7} ${tip.y - ay * 11 - ax * 7}"/>`; }
      h += `<path class="w${l.dash ? ' dash' : ''}${on ? ' on' : ''}" d="${d}"${wc}/>${arrow}<path class="w-hit" data-wire="${l.id}" d="${d}"/>`;
      if (l.label) h += `<text class="w-label${on ? ' on' : ''}" data-wire="${l.id}" x="${lab.x + O}" y="${lab.y + O}"${wc}>${esc(l.label)}</text>`;
      if (on) h += `<circle class="w-end" data-end="a" data-wire="${l.id}" cx="${p0.x + O}" cy="${p0.y + O}" r="6"/><circle class="w-end" data-end="b" data-wire="${l.id}" cx="${p2.x + O}" cy="${p2.y + O}" r="6"/>` + (l.route === 'elbow' ? '' : `<circle class="w-bend" data-wire="${l.id}" cx="${g.handle.x + O}" cy="${g.handle.y + O}" r="7"/>`);
    });
    if (live) { const a = live.a, b = live.b; h += `<path class="live${live.snap ? ' snap' : ''}" d="M${a.x + O} ${a.y + O} Q${(a.x + b.x) / 2 + O} ${(a.y + b.y) / 2 - 30 + O} ${b.x + O} ${b.y + O}"/>`;
      if (live.snap) h += `<circle class="w-snap-halo" cx="${b.x + O}" cy="${b.y + O}" r="16"/><circle class="w-snap" cx="${b.x + O}" cy="${b.y + O}" r="7"/>`; }
    wires.innerHTML = h;
  }
  const linkById = id => board.links.find(l => l.id === id);
  function selectWire(id, add) {
    if (add && id) { selWires.has(id) ? selWires.delete(id) : selWires.add(id); selWire = [...selWires].pop() || null; } else { selWires = new Set(id ? [id] : []); selWire = id; }
    if (selWire) selectOnly([]); renderWires(); }
  const byId = id => board.cards.find(c => c.id === id);
  let trayN = null;
  function renderTray() {
    if (window.__phone?.on) setTimeout(window.__phone.count);
    // Unsorted turned off in Settings: still say when something lands there, with a way to see it
    if (settings.wTray === false && trayN !== null && board.tray.length > trayN) chirp('Saved to Unsorted ✦', 4000, [{ label: 'Show Unsorted', run: () => { settings.wTray = true; applySettings(); } }]);
    trayN = board.tray.length;
    const list = $('trayList'); list.innerHTML = ''; $('trayCount').textContent = board.tray.length;
    board.tray.forEach(c => { const d = document.createElement('div'); d.className = 'tray-item'; d.dataset.id = c.id; d.style.setProperty('--tilt', (c.r / 2) + 'deg');
      d.innerHTML = c.type === 'image' ? `<img src="${esc(c.src)}">` : esc(c.type === 'link' ? (c.title || c.url) : c.text); list.appendChild(d); });
  }
  // (the stage gets a 'multi' class when more than one thing is selected: tilt handles only show for one thing at a time)
  function selectOnly(ids) { if (ids.length && selWires.size) { selWire = null; selWires.clear(); renderWires(); } sel = new Set(ids); stage.classList.toggle('multi', sel.size > 1); LY.reveal = true; layersSoon(); board.cards.forEach(c => { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); el && el.classList.toggle('sel', sel.has(c.id)); }); syncPorts();   // the dots follow the selection
  }

  // ---------- adding things ----------
  // ---------- the Pen: click to drop points (straight lines), click-and-drag for a smooth curve, click the first point to close a shape;
  // Enter, Esc or a double-click finishes an open line. The result is a 'path' card you can move, resize, tilt, stroke and fill ----------
  // round the sharp corners of a polyline: each corner is cut back by up to r along both sides and joined with a soft curve
  function roundedD(pts, closed, r) {
    const n = pts.length, f = v => +v.toFixed(2); if (!r || n < 3 && !closed) return null;
    const corner = (prev, p, next) => { const a = Math.hypot(p.x - prev.x, p.y - prev.y), b = Math.hypot(next.x - p.x, next.y - p.y), k = Math.min(r, a / 2, b / 2);
      return { s: { x: p.x + (prev.x - p.x) * k / (a || 1), y: p.y + (prev.y - p.y) * k / (a || 1) }, e: { x: p.x + (next.x - p.x) * k / (b || 1), y: p.y + (next.y - p.y) * k / (b || 1) }, p }; };
    let d = ''; const idx = closed ? [...Array(n).keys()] : [...Array(n).keys()].slice(1, -1);
    if (!closed) d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
    idx.forEach((i, j) => { const c = corner(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]); d += (j === 0 && closed ? `M${f(c.s.x)} ${f(c.s.y)}` : ` L${f(c.s.x)} ${f(c.s.y)}`) + ` Q${f(c.p.x)} ${f(c.p.y)} ${f(c.e.x)} ${f(c.e.y)}`; });
    return d + (closed ? ' Z' : ` L${f(pts[n - 1].x)} ${f(pts[n - 1].y)}`);
  }
  // a pen path with curves AND rounded corners: a sharp point (no handles, straight on both sides) is rounded by its own radius (q.r) or the shape's
  function pathD(pts, closed, R = 0, k = 1) {
    const n = pts.length, f = v => +v.toFixed(2); if (!n) return ''; const P = i => pts[(i + n) % n];
    const node = i => { const q = P(i), r = (q.r ?? R) * k, hasPrev = closed || i > 0, hasNext = closed || i < n - 1;
      if (!(r > 0) || !hasPrev || !hasNext || q.ix != null || q.ox != null || P(i - 1).ox != null || P(i + 1).ix != null) return { p: q, s: q, e: q };
      const a = P(i - 1), b = P(i + 1), la = Math.hypot(q.x - a.x, q.y - a.y) || 1, lb = Math.hypot(b.x - q.x, b.y - q.y) || 1, kk = Math.min(r, la / 2, lb / 2);
      return { p: q, round: true, s: { x: q.x + (a.x - q.x) * kk / la, y: q.y + (a.y - q.y) * kk / la }, e: { x: q.x + (b.x - q.x) * kk / lb, y: q.y + (b.y - q.y) * kk / lb } }; };
    const N = pts.map((_, i) => node(i));
    const seg = (A, B) => A.p.ox == null && B.p.ix == null ? ` L${f(B.s.x)} ${f(B.s.y)}` : ` C${f(A.p.ox ?? A.p.x)} ${f(A.p.oy ?? A.p.y)} ${f(B.p.ix ?? B.p.x)} ${f(B.p.iy ?? B.p.y)} ${f(B.p.x)} ${f(B.p.y)}`;
    const corner = B => B.round ? ` Q${f(B.p.x)} ${f(B.p.y)} ${f(B.e.x)} ${f(B.e.y)}` : '';
    let d = `M${f(N[0].e.x)} ${f(N[0].e.y)}`;
    for (let i = 1; i < n; i++) d += seg(N[i - 1], N[i]) + corner(N[i]);
    if (closed && n > 2) d += seg(N[n - 1], N[0]) + corner(N[0]) + ' Z';
    return d;
  }
  const penD = (pts, closed) => { if (!pts?.length) return ''; const f = n => +n.toFixed(2);
    const seg = (a, b) => a.ox == null && b.ix == null ? ` L${f(b.x)} ${f(b.y)}` : ` C${f(a.ox ?? a.x)} ${f(a.oy ?? a.y)} ${f(b.ix ?? b.x)} ${f(b.iy ?? b.y)} ${f(b.x)} ${f(b.y)}`;
    let d = `M${f(pts[0].x)} ${f(pts[0].y)}`; for (let i = 1; i < pts.length; i++) d += seg(pts[i - 1], pts[i]); if (closed && pts.length > 2) d += seg(pts[pts.length - 1], pts[0]) + ' Z'; return d; };
  let penT = null;   // { pts, down, hover, svg } while the Pen is in your hand
  function startPen() { stopPlacing(); if (drawOn) exitDraw(); selectOnly([]); selWire = null; selWires.clear();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('pen-live'); world.appendChild(svg);
    penT = { pts: [], down: null, hover: null, svg }; stage.classList.add('pen-mode'); $('tools').querySelector('[data-add="pen"]')?.classList.add('on'); drawPen(); }
  function endPen(keep = true, closed = false) { if (!penT) return; const p = penT; penT = null; p.svg.remove(); stage.classList.remove('pen-mode'); $('tools').querySelector('[data-add="pen"]')?.classList.remove('on');
    const pts = p.pts; if (!keep || pts.length < 2) return;
    const xs = pts.flatMap(q => [q.x, q.ix ?? q.x, q.ox ?? q.x]), ys = pts.flatMap(q => [q.y, q.iy ?? q.y, q.oy ?? q.y]);
    let x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0; if (w < 12) { x0 -= (12 - w) / 2; w = 12; } if (h < 12) { y0 -= (12 - h) / 2; h = 12; }
    const sh = q => { const o = { x: q.x - x0, y: q.y - y0 }; if (q.ix != null) Object.assign(o, { ix: q.ix - x0, iy: q.iy - y0, ox: q.ox - x0, oy: q.oy - y0 }); return o; };
    remember(); const c = card('path', { x: x0, y: y0, w, h, ow: w, oh: h, r: 0, pts: pts.map(sh), closed: closed || undefined, stroke: '#27272a', sw: 2.5, ...(closed ? { fill: '#ffe0ec' } : {}) });
    addCard(c); selectOnly([c.id]); }
  function drawPen() { if (!penT) return; const z = view.z, P = penT.pts, last = P[P.length - 1], hv = penT.hover;
    const nearFirst = hv && P.length > 2 && Math.hypot(hv.x - P[0].x, hv.y - P[0].y) < 10 / z;
    let h = `<path d="${penD(P)}" class="pl-path" style="stroke-width:${2 / z}px"/>`;
    if (last && hv && penT.down == null) h += `<path d="${penD([last, nearFirst ? P[0] : hv])}" class="pl-band" style="stroke-width:${1.5 / z}px;stroke-dasharray:${4 / z} ${4 / z}"/>`;
    const dn = penT.down != null && P[penT.down]; if (dn && dn.ox != null) h += `<path d="M${dn.ix} ${dn.iy} L${dn.ox} ${dn.oy}" class="pl-handle" style="stroke-width:${1 / z}px"/><circle cx="${dn.ix}" cy="${dn.iy}" r="${3 / z}" class="pl-hdot"/><circle cx="${dn.ox}" cy="${dn.oy}" r="${3 / z}" class="pl-hdot"/>`;
    P.forEach((q, i) => h += `<circle cx="${q.x}" cy="${q.y}" r="${(i === 0 && nearFirst ? 6 : 4) / z}" class="pl-pt${i === 0 && nearFirst ? ' close' : ''}" style="stroke-width:${1.5 / z}px"/>`);
    penT.svg.innerHTML = h; }
  const snap45 = (from, w) => { const dx = w.x - from.x, dy = w.y - from.y, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(dx, dy); return { x: from.x + Math.cos(a) * l, y: from.y + Math.sin(a) * l }; };
  function penDown(e) { let w = toWorld(e.clientX, e.clientY); const P = penT.pts; if (e.shiftKey && P.length) w = snap45(P[P.length - 1], w);   // Shift: straight across, up or at 45°
    if (P.length > 2 && Math.hypot(w.x - P[0].x, w.y - P[0].y) < 10 / view.z) return endPen(true, true);   // back to the start: a closed shape
    P.push({ x: w.x, y: w.y }); penT.down = P.length - 1; stage.setPointerCapture(e.pointerId); drawPen(); }
  function penMove(e) { const w = toWorld(e.clientX, e.clientY); penT.hover = w;
    if (penT.down != null) { const q = penT.pts[penT.down]; if (Math.hypot(w.x - q.x, w.y - q.y) > 3 / view.z) { if (e.altKey) Object.assign(q, { ox: w.x, oy: w.y, ix: q.ix ?? q.x, iy: q.iy ?? q.y }); else Object.assign(q, { ox: w.x, oy: w.y, ix: 2 * q.x - w.x, iy: 2 * q.y - w.y }); } }   // dragging pulls out smooth curve handles; Option bends only the way out
    else if (e.shiftKey && penT.pts.length) penT.hover = snap45(penT.pts[penT.pts.length - 1], w);
    drawPen(); }
  // ---------- editing a pen shape's points (double-click it, like Figma). Every corner shows a circle:
  //   drag a point to move it (Shift: straight across/up/down) · drag a handle to bend the curve, Option-drag to bend just one side
  //   Option-drag a sharp point to pull curve handles out of it · double-click a point to switch sharp ↔ smooth (sharp drops its roundness)
  //   click a point to pick it (Shift-click for more): Corners in the bar, or the little dot inside the corner, rounds just those
  //   click the outline to add a point · Delete removes picked points · Enter, Esc or clicking away finishes. Rectangles, triangles, stars and circles turn into pen shapes when you do this ----------
  let vec = null;   // { id, sel: Set, svg, drag }
  const vecCard = () => vec && byId(vec.id);
  const vW = (c, q, kx = 'x', ky = 'y') => ({ x: c.x + q[kx] * c.w / c.ow, y: c.y + q[ky] * c.h / c.oh });
  function shapeToPath(c) {   // a built-in shape becomes editable points in its own box
    const W = c.w, H = c.h, P = (x, y) => ({ x: x * W / 100, y: y * H / 100 }); let pts;
    if ((c.shape || 'rect') === 'rect') pts = [P(0, 0), P(100, 0), P(100, 100), P(0, 100)];
    else if (c.shape === 'tri') pts = [P(50, 2), P(98, 98), P(2, 98)];
    else if (c.shape === 'star') pts = [[50, 3], [62, 36], [97, 37], [69, 58], [79, 93], [50, 72], [21, 93], [31, 58], [3, 37], [38, 36]].map(([x, y]) => P(x, y));
    else if (c.shape === 'circle') { const k = .5523; pts = [[50, 0, 50 - 50 * k, 0, 50 + 50 * k, 0], [100, 50, 100, 50 - 50 * k, 100, 50 + 50 * k], [50, 100, 50 + 50 * k, 100, 50 - 50 * k, 100], [0, 50, 0, 50 + 50 * k, 0, 50 - 50 * k]].map(([x, y, ix, iy, ox, oy]) => ({ ...P(x, y), ix: ix * W / 100, iy: iy * H / 100, ox: ox * W / 100, oy: oy * H / 100 })); }
    else return false;
    const fill = c.fill === 'none' ? 'none' : SHAPE_FILL[c.fill || 'gray'] || c.fill, rad = c.shape === 'rect' || !c.shape ? (c.radius ?? 10) : c.radius;
    Object.assign(c, { type: 'path', pts, closed: true, ow: W, oh: H, fill, radius: rad || undefined, stroke: c.stroke, sw: c.sw }); delete c.shape; return true;
  }
  function startVec(id) { const c = byId(id); if (!c) return; remember();
    if (c.type === 'shape' && !shapeToPath(c)) return;
    const sx = c.w / c.ow, sy = c.h / c.oh; if (Math.abs(sx - 1) > 1e-6 || Math.abs(sy - 1) > 1e-6) { c.pts = c.pts.map(q => { const o = { ...q, x: q.x * sx, y: q.y * sy }; if (q.ix != null) Object.assign(o, { ix: q.ix * sx, iy: q.iy * sy, ox: q.ox * sx, oy: q.oy * sy }); return o; }); if (c.radius) c.radius = c.radius; c.ow = c.w; c.oh = c.h; }
    c.r = 0; renderCard(c); selectOnly([id]);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('pen-live', 'vec-live'); world.appendChild(svg);
    vec = { id, sel: new Set(), svg, drag: null }; stage.classList.add('vec-mode'); drawVec(); say('Editing points: drag them, double-click one to make it sharp or smooth, click the line to add one. Enter when you’re done.', 4000); }
  function endVec() { if (!vec) return; vec.svg.remove(); const id = vec.id; vec = null; stage.classList.remove('vec-mode'); const c = byId(id); if (c) { refit(c); renderCard(c); selectOnly([id]); save(); } }
  function refit(c) {   // keep the card's box snug around its points and handles
    const xs = c.pts.flatMap(q => [q.x, q.ix ?? q.x, q.ox ?? q.x]), ys = c.pts.flatMap(q => [q.y, q.iy ?? q.y, q.oy ?? q.y]);
    let x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0; if (w < 12) { x0 -= (12 - w) / 2; w = 12; } if (h < 12) { y0 -= (12 - h) / 2; h = 12; }
    if (Math.abs(x0) < 1e-6 && Math.abs(y0) < 1e-6 && Math.abs(w - c.ow) < 1e-6 && Math.abs(h - c.oh) < 1e-6) return;
    c.pts = c.pts.map(q => { const o = { ...q, x: q.x - x0, y: q.y - y0 }; if (q.ix != null) Object.assign(o, { ix: q.ix - x0, iy: q.iy - y0, ox: q.ox - x0, oy: q.oy - y0 }); return o; });
    c.x += x0; c.y += y0; c.w = c.ow = w; c.h = c.oh = h;
  }
  const vecRadiusDot = (c, i) => { const n = c.pts.length, q = c.pts[i]; if (q.ix != null || (!c.closed && (i === 0 || i === n - 1))) return null;
    const a = c.pts[(i - 1 + n) % n], b = c.pts[(i + 1) % n], ua = { x: a.x - q.x, y: a.y - q.y }, ub = { x: b.x - q.x, y: b.y - q.y }, la = Math.hypot(ua.x, ua.y) || 1, lb = Math.hypot(ub.x, ub.y) || 1;
    const bis = { x: ua.x / la + ub.x / lb, y: ua.y / la + ub.y / lb }, lbis = Math.hypot(bis.x, bis.y); if (lbis < 1e-3) return null;
    const r = q.r ?? c.radius ?? 0, d = Math.max(18 / view.z, r * 1.2 + 10 / view.z); return { x: q.x + bis.x / lbis * d, y: q.y + bis.y / lbis * d, ux: bis.x / lbis, uy: bis.y / lbis }; };
  function drawVec() { const c = vecCard(); if (!c) return; const z = view.z, T = q => ({ x: c.x + q.x, y: c.y + q.y });
    let h = `<path d="${pathD(c.pts.map(q => { const o = { ...q, x: q.x + c.x, y: q.y + c.y }; if (q.ix != null) Object.assign(o, { ix: q.ix + c.x, iy: q.iy + c.y, ox: q.ox + c.x, oy: q.oy + c.y }); return o; }), c.closed, c.radius || 0)}" class="pl-path" style="stroke-width:${1.5 / z}px"/>`;
    c.pts.forEach((q, i) => { const p = T(q), on = vec.sel.has(i);
      if (q.ix != null && (on || vec.sel.size === 0)) { const A = T({ x: q.ix, y: q.iy }), B = T({ x: q.ox, y: q.oy }); h += `<path d="M${A.x} ${A.y} L${p.x} ${p.y} L${B.x} ${B.y}" class="pl-handle" style="stroke-width:${1 / z}px"/><circle cx="${A.x}" cy="${A.y}" r="${3.5 / z}" class="pl-hdot"/><circle cx="${B.x}" cy="${B.y}" r="${3.5 / z}" class="pl-hdot"/>`; }
      if (on) { const rd = vecRadiusDot(c, i); if (rd) h += `<circle cx="${c.x + rd.x}" cy="${c.y + rd.y}" r="${4 / z}" class="pl-rdot" style="stroke-width:${1.5 / z}px"/>`; }
      h += `<circle cx="${p.x}" cy="${p.y}" r="${5 / z}" class="pl-pt${on ? ' close' : ''}" style="stroke-width:${1.5 / z}px"/>`; });
    vec.svg.innerHTML = h; }
  function vecHit(w) { const c = vecCard(), z = view.z, L = { x: w.x - c.x, y: w.y - c.y }, near = (x, y, r) => Math.hypot(L.x - x, L.y - y) < r / z;
    for (const i of vec.sel) { const rd = vecRadiusDot(c, i); if (rd && near(rd.x, rd.y, 8)) return { kind: 'radius', i, rd }; }
    for (let i = 0; i < c.pts.length; i++) { const q = c.pts[i]; if (q.ix != null && (vec.sel.has(i) || !vec.sel.size)) { if (near(q.ox, q.oy, 7)) return { kind: 'out', i }; if (near(q.ix, q.iy, 7)) return { kind: 'in', i }; } }
    for (let i = 0; i < c.pts.length; i++) if (near(c.pts[i].x, c.pts[i].y, 9)) return { kind: 'pt', i };
    // on the outline: sample each segment
    const n = c.pts.length, segs = c.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) { const a = c.pts[i], b = c.pts[(i + 1) % n];
      const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot((a.ox ?? a.x) - a.x, (a.oy ?? a.y) - a.y) + Math.hypot((b.ix ?? b.x) - b.x, (b.iy ?? b.y) - b.y), dt = Math.min(.025, 2 / (view.z * Math.max(1, len)));   // checks close enough together that a click on a long edge never slips between them
      for (let t = 0; t <= 1.0001; t += dt) { const u = 1 - t, ax = a.ox ?? a.x, ay = a.oy ?? a.y, bx = b.ix ?? b.x, by = b.iy ?? b.y;
        const x = u * u * u * a.x + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * b.x, y = u * u * u * a.y + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * b.y;
        if (near(x, y, 7)) return { kind: 'seg', i, x, y }; } }
    return null; }
  function vecDown(e) { const c = vecCard(), w = toWorld(e.clientX, e.clientY), hit = vecHit(w);
    if (!hit) { const inside = w.x > c.x && w.x < c.x + c.w && w.y > c.y && w.y < c.y + c.h; if (inside) { vec.sel.clear(); drawVec(); syncCornerPop(); return true; } endVec(); return false; }
    remember();
    if (hit.kind === 'seg') { const at = (hit.i + 1) % c.pts.length; c.pts.splice(hit.i + 1, 0, { x: hit.x, y: hit.y }); vec.sel = new Set([hit.i + 1 === c.pts.length ? c.pts.length - 1 : hit.i + 1]); vec.drag = { kind: 'pt', i: hit.i + 1 }; renderCard(c); drawVec(); return true; }
    if (hit.kind === 'pt') { const now = Date.now(); if (vec.last && vec.last.i === hit.i && now - vec.last.t < 400) { vec.last = null; vecToggle(hit.i); return true; } vec.last = { i: hit.i, t: now };   // two quick clicks on a point: sharp ↔ smooth
      if (e.shiftKey) { vec.sel.has(hit.i) ? vec.sel.delete(hit.i) : vec.sel.add(hit.i); } else if (!vec.sel.has(hit.i)) vec.sel = new Set([hit.i]);
      const q = c.pts[hit.i]; vec.drag = e.altKey && q.ix == null ? { kind: 'pull', i: hit.i } : { kind: 'pt', i: hit.i, sx: w.x, sy: w.y, start: [...vec.sel].map(j => [j, { ...c.pts[j] }]) }; }
    else vec.drag = hit;
    stage.setPointerCapture(e.pointerId); drawVec(); syncCornerPop(); return true; }
  function vecMove(e) { const c = vecCard(), d = vec.drag; if (!d) return; const w = toWorld(e.clientX, e.clientY), L = { x: w.x - c.x, y: w.y - c.y };
    if (d.kind === 'pt' && d.start) { let dx = w.x - d.sx, dy = w.y - d.sy; if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      d.start.forEach(([j, o]) => { const q = c.pts[j]; q.x = o.x + dx; q.y = o.y + dy; if (o.ix != null) Object.assign(q, { ix: o.ix + dx, iy: o.iy + dy, ox: o.ox + dx, oy: o.oy + dy }); }); }
    else if (d.kind === 'pt') { const q = c.pts[d.i]; q.x = L.x; q.y = L.y; }
    else if (d.kind === 'pull' || d.kind === 'out' || d.kind === 'in') { const q = c.pts[d.i]; const out = d.kind !== 'in';
      if (d.kind === 'pull') { delete q.r; }
      const hx = L.x, hy = L.y; if (out) { q.ox = hx; q.oy = hy; } else { q.ix = hx; q.iy = hy; }
      if (!e.altKey || d.kind === 'pull') { if (out) { q.ix = 2 * q.x - hx; q.iy = 2 * q.y - hy; } else { q.ox = 2 * q.x - hx; q.oy = 2 * q.y - hy; } }   // Option: only this side bends
      if (q.ix == null) { q.ix = q.x; q.iy = q.y; } if (q.ox == null) { q.ox = q.x; q.oy = q.y; } }
    else if (d.kind === 'radius') { const q = c.pts[d.i], rd = d.rd, proj = (L.x - q.x) * rd.ux + (L.y - q.y) * rd.uy; const r = Math.max(0, Math.round((proj - 10 / view.z) / 1.2)); vec.sel.forEach(j => c.pts[j].r = r); syncCornerPop(); }
    renderCard(c); drawVec(); }
  function vecUp() { if (!vec || !vec.drag) return; vec.drag = null; const c = vecCard(); const before = { x: c.x, y: c.y }; refit(c); renderCard(c); drawVec(); renderWires(); save(); }
  function vecToggle(i) { const c = vecCard(), q = c.pts[i]; remember();
    if (q.ix != null) { delete q.ix; delete q.iy; delete q.ox; delete q.oy; delete q.r; }   // smooth → sharp (and no roundness)
    else { const n = c.pts.length, a = c.pts[(i - 1 + n) % n], b = c.pts[(i + 1) % n], dx = (b.x - a.x) / 4, dy = (b.y - a.y) / 4; Object.assign(q, { ix: q.x - dx, iy: q.y - dy, ox: q.x + dx, oy: q.y + dy }); delete q.r; }   // sharp → smooth
    refit(c); renderCard(c); drawVec(); save(); }
  function syncCornerPop() { const c = vecCard(), t = document.querySelector('[data-pop="corners"] b'); if (!c || !t) return; const rs = [...vec.sel].map(i => c.pts[i].r ?? c.radius ?? 0);
    const v = rs.length ? (rs.every(r => r === rs[0]) ? rs[0] : '–') : (c.radius || 0); t.textContent = v; const num = document.querySelector('[data-corners-num]'); if (num && v !== '–' && document.activeElement !== num) num.value = v; }
  stage.addEventListener('pointerdown', e => { if (!vec || e.button !== 0 || space) return; if (e.target.closest('.tools, .selbar, .dock, .side, .top, .cpop, .mochi')) return;
    if (vecDown(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  stage.addEventListener('pointermove', e => { if (vec && vec.drag) { e.stopImmediatePropagation(); vecMove(e); } }, true);
  stage.addEventListener('pointerup', e => { if (vec && vec.drag) { e.stopImmediatePropagation(); vecUp(); } }, true);
  stage.addEventListener('dblclick', e => {
    if (vec) { const hit = vecHit(toWorld(e.clientX, e.clientY)); e.preventDefault(); e.stopImmediatePropagation(); if (hit && hit.kind === 'pt') vecToggle(hit.i); return; }
    if (penT) return; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card'); if (!el) return; const c = byId(el.dataset.id);   // (the board holds the pointer while you press, so look at what's under it)
    if (c && !c.locked && (c.type === 'path' || c.type === 'shape' && ['rect', 'tri', 'star', 'circle'].includes(c.shape || 'rect'))) { e.preventDefault(); e.stopImmediatePropagation(); endEdit(); startVec(c.id); }
  }, true);
  function addCard(c, pop = true) { board.cards.push(c); renderCard(c, pop); save(); return c; }
  // ---------- layers: every piece on the board, top of the stack first (like Figma). Frames and collections fold open, groups stay together ----------
  const LY = { open: new Set(), t: 0, drag: null };
  const LI = d => `<svg viewBox="0 0 ${d.includes('data-l24') ? 24 : 20} ${d.includes('data-l24') ? 24 : 20}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const LICON = {
    path: LI('<g data-l24="1"><path d=\"M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z\"/><path d=\"m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18\"/><path d=\"m2.3 2.3 7.286 7.286\"/><circle cx=\"11\" cy=\"11\" r=\"2\"/></g>'),
    section: LI('<g data-l24="1"><path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" /><path d="M21 19a2 2 0 0 1-2 2" /><path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h1" /><path d="M14 3h1" /><path d="M14 21h1" /><path d="M3 9v1" /><path d="M21 9v1" /><path d="M3 14v1" /><path d="M21 14v1" /></g>'),
    note: LI('<g data-l24="1"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M15 3v4a2 2 0 0 0 2 2h4" /></g>'), todo: LI('<g data-l24="1"><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></g>'),
    title: LI('<g data-l24="1"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="12" x2="12" y1="4" y2="20" /></g>'), text: LI('<g data-l24="1"><path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1" /><path d="M7 22h1a4 4 0 0 0 4-4v-1" /><path d="M7 2h1a4 4 0 0 1 4 4v1" /></g>'), image: LI('<g data-l24="1"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></g>'),
    audio: LI('<g data-l24="1"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></g>'), ink: LI('<g data-l24="1"><path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z" /><path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18" /><path d="m2.3 2.3 7.286 7.286" /><circle cx="11" cy="11" r="2" /></g>'),
    frame: LI('<g data-l24="1"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></g>'), box: LI('<g data-l24="1"><rect width="18" height="18" x="3" y="3" rx="2" /></g>'), font: LI('<g data-l24="1"><path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z" /></g>'),
    coll: LI('<g data-l24="1"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></g>'),
    group: LI('<g data-l24="1"><path d="M3 7V5c0-1.1.9-2 2-2h2" /><path d="M17 3h2c1.1 0 2 .9 2 2v2" /><path d="M21 17v2c0 1.1-.9 2-2 2h-2" /><path d="M7 21H5c-1.1 0-2-.9-2-2v-2" /><rect width="7" height="5" x="7" y="7" rx="1" /><rect width="7" height="5" x="10" y="12" rx="1" /></g>'),
    shape: LI('<g data-l24="1"><path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" /></g>'), icon: LI('<g data-l24="1"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></g>'),
  };
  const lyText = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const SHAPE_N = { rect: 'Rectangle', circle: 'Circle', tri: 'Triangle', star: 'Star', heart: 'Heart', line: 'Line', diamond: 'Decision', pill: 'Start / end', io: 'Input / output', doc: 'Document', db: 'Database', fnote: 'Note', page: 'Page' };
  function layerName(c) {
    if (c.type === 'section') return lyText(c.text) || 'Section';
    if (c.ln) return c.ln;
    const t = {
      frame: c.name || 'Screen', coll: c.name || 'Collection', note: lyText(c.name) || lyText(c.text), text: lyText(c.text), title: lyText(c.text), todo: lyText(c.text) || lyText(c.items?.[0]?.t), table: 'Table' + ((c.rows?.[0] || []).filter(v => (v || '').trim()).length ? ' · ' + lyText(c.rows[0].filter(v => (v || '').trim()).join(', ')) : ''),
      image: c.tagText || 'Image', file: c.name || 'File', folder: c.name || 'Folder', link: c.title || (c.url ? host(c.url) : 'Link'), doc: c.text || 'Doc', canvas: c.text || 'Canvas', swatch: c.label || (c.hex || '').toUpperCase(),
      shape: (c.kit && lyText(c.text)) || SHAPE_N[c.shape || 'rect'], path: c.closed ? 'Pen shape' : 'Pen line', stamp: 'Stamp', icon: c.name || 'Icon', audio: 'Voice memo', video: c.title || 'Video', spotify: c.title || 'Spotify', ink: 'Drawing', box: c.img ? 'Image spot' : 'Box', font: c.font || 'DM Sans',
    }[c.type];
    return t || ({ note: 'Note', text: 'Text', title: 'Title', todo: 'Checklist' })[c.type] || c.type;
  }
  function layerIcon(c) {
    if (c.type === 'section') return LICON.section;
    if (c.type === 'folder') return CFIC; if (c.type === 'file') return CIC.doc;
    if (c.type === 'stamp') { const s = c.src || pxSrc(c.emoji || '⭐'); return s ? `<img src="${esc(s)}" alt="">` : `<span class="ly-emo">${esc(c.emoji || '⭐')}</span>`; }
    if (c.type === 'swatch') return `<i class="ly-sw" style="background:${esc(c.hex)}"></i>`;
    if (c.type === 'icon') return `<span class="mi">${esc(c.name || 'star')}</span>`;
    return toolIcon(c.type) || LICON[c.type] || CIC[c.type] || LICON.box;
  }
  // the very same icon as the button you made it with (the toolbar, or the wireframe panel), so a piece looks the same in both places
  const TOOL_OF = { ink: '[data-add="draw"]', frame: '[data-wf="frame"]', box: '[data-wf="box"]', icon: '[data-wf="icon"]', text: '[data-wf="text"]' }, toolIc = {};
  function toolIcon(type) {
    if (type in toolIc) return toolIc[type];
    const svg = document.querySelector(`${TOOL_OF[type] || `.tools [data-add="${type}"]`} svg`);
    if (!svg) return toolIc[type] = null; const k = svg.cloneNode(true); k.removeAttribute('width'); k.removeAttribute('height'); return toolIc[type] = k.outerHTML;   // only the outer size: the shapes inside keep theirs
  }
  // the tree: [{ key, ids, kind, c?, kids: [...] }], ordered top of the stack first (collections list their cards in reading order)
  function layerTree() {
    const z = new Map([...cardsEl.children].map((el, i) => [el.dataset.id, i])), zOf = n => Math.max(...n.ids.map(i => z.get(i) ?? -1));
    const inColl = new Set(board.cards.filter(c => c.type === 'coll').flatMap(c => c.kids || [])), frames = new Set(board.cards.filter(c => c.type === 'frame').map(c => c.id));
    const secs = board.cards.filter(c => c.type === 'section').sort((a, b) => a.w * a.h - b.w * b.h), secOf = new Map();
    board.cards.forEach(c => { if (inColl.has(c.id) || (c.onFrame && frames.has(c.onFrame) && c.type !== 'frame')) return; const mx = c.x + c.w / 2, my = c.y + c.h / 2;
      const s = secs.find(s => s.id !== c.id && (c.type !== 'section' || s.w * s.h > c.w * c.h) && mx > s.x && mx < s.x + s.w && my > s.y && my < s.y + s.h); if (s) secOf.set(c.id, s.id); });
    const nodesFor = cards => {
      const groups = new Map(), out = [];
      cards.forEach(c => { if (c.group) { if (!groups.has(c.group)) { const g = { key: 'g:' + c.group, kind: 'group', ids: [], kids: [] }; groups.set(c.group, g); out.push(g); } groups.get(c.group).ids.push(c.id); groups.get(c.group).kids.push(nodeOf(c)); }
        else out.push(nodeOf(c)); });
      groups.forEach(g => g.kids.sort((a, b) => zOf(b) - zOf(a)));
      return out.sort((a, b) => zOf(b) - zOf(a));
    };
    const nodeOf = c => {
      const n = { key: c.id, kind: 'card', c, ids: [c.id], kids: [] };
      if (c.type === 'section') n.kids = nodesFor(board.cards.filter(k => secOf.get(k.id) === c.id));   // like a folder: what's inside sits under it
      if (c.type === 'frame') n.kids = nodesFor(board.cards.filter(k => k.id !== c.id && k.type !== 'frame' && k.onFrame === c.id && !inColl.has(k.id)));
      if (c.type === 'coll') n.kids = (c.kids || []).map(byId).filter(Boolean).map(k => ({ key: k.id, kind: 'card', c: k, ids: [k.id], kids: [], inColl: c.id }));
      return n;
    };
    return nodesFor(board.cards.filter(c => !inColl.has(c.id) && !secOf.has(c.id) && !(c.onFrame && frames.has(c.onFrame) && c.type !== 'frame')));
  }
  // a group goes by its own name, or by the words inside it (a button reads "Get started"), so the list never fills up with "Group, Group, Group"
  const groupName = ids => { const cs = ids.map(byId).filter(Boolean); const mk = cs.find(c => c.maskLayer); if (mk && !cs[0]?.gn) return layerName(mk) + ' mask'; if (cs[0]?.gn) return cs[0].gn; const t = cs.filter(c => ['text', 'title', 'note'].includes(c.type)).map(c => lyText(c.text)).filter(Boolean)[0];
    return t || (cs.some(c => c.type === 'box' && c.img) ? 'Image spot' : 'Group'); };
  const lyAll = n => n.kind === 'group' ? n.ids : [...n.ids, ...n.kids.flatMap(lyAll)];
  function renderLayers() {
    const list = $('layers'); if (!list || !board) return;
    if (list.querySelector('[contenteditable="true"]')) return;   // never rebuild under someone renaming
    const tree = layerTree(); $('layerCount').textContent = board.cards.length || '';
    // open whatever holds the selection, so a picked piece is always visible in the list
    const walk = (ns, up) => ns.forEach(n => { if (n.ids.some(i => sel.has(i)) && !(n.kind === 'group' && n.ids.every(i => sel.has(i)))) up.forEach(k => LY.open.add(k)); walk(n.kids, [...up, n.key]); });
    walk(tree, []);
    const row = (n, depth) => {
      const c = n.c, kids = n.kids.length, open = LY.open.has(n.key), ids = lyAll(n), hidden = ids.length && ids.every(i => byId(i)?.hidden), locked = ids.length && ids.every(i => byId(i)?.locked);
      const gm = n.kind === 'group' ? n.ids.map(byId).find(x => x && x.maskLayer) : null;
      const name = n.kind === 'group' ? groupName(n.ids) : (c.maskLayer && c.group ? layerName(c) + ' · mask' : layerName(c)), icon = n.kind === 'group' ? (gm ? LICON.mask : LICON.group) : (c.maskLayer && c.group ? LICON.mask : layerIcon(c));
      return `<div class="ly${n.ids.every(i => sel.has(i)) ? ' on' : ''}${hidden ? ' off' : ''}${locked ? ' lk' : ''}${c?.type === 'frame' || c?.type === 'coll' || c?.type === 'section' || n.kind === 'group' ? ' parent' : ''}" data-key="${esc(n.key)}" draggable="true" style="--d:${depth}">
        <button class="ly-tw${kids ? '' : ' none'}${open ? ' open' : ''}" tabindex="-1" aria-label="${open ? 'Close' : 'Open'}"><svg viewBox="0 0 10 10"><path d="M3.5 2l3 3-3 3"/></svg></button>
        <span class="ly-ic">${icon}</span><span class="ly-n">${esc(name)}</span>
        <button class="ly-b ly-lock" title="${locked ? 'Unlock' : 'Lock'}">${locked ? LI('<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>') : LI('<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1"/>')}</button>
        <button class="ly-b ly-eye" title="${hidden ? 'Show' : 'Hide'}">${hidden ? LI('<path d="M3 3l14 14M8.3 5.2A8 8 0 0 1 10 5c4.5 0 7.5 5 7.5 5a14 14 0 0 1-2.2 2.8M12.1 14.7A6 6 0 0 1 10 15c-4.5 0-7.5-5-7.5-5a14 14 0 0 1 3-3.4"/>') : LI('<path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z"/><circle cx="10" cy="10" r="2.3"/>')}</button>
      </div>` + (kids && open ? n.kids.map(k => row(k, depth + 1)).join('') : '');
    };
    const st = list.scrollTop;
    list.innerHTML = tree.length ? tree.map(n => row(n, 0)).join('') : '<div class="ly-empty">Nothing on this board yet. Everything you add shows up here.</div>';
    list.scrollTop = st; LY.tree = tree;
    const on = list.querySelector('.ly.on'); if (on && LY.reveal) { LY.reveal = false; const r = on.getBoundingClientRect(), lr = list.getBoundingClientRect(); if (r.top < lr.top || r.bottom > lr.bottom) on.scrollIntoView({ block: 'nearest' }); }
  }
  const layersSoon = () => { cancelAnimationFrame(LY.t); LY.t = requestAnimationFrame(renderLayers); };
  const lyFind = (key, ns = LY.tree || []) => { for (const n of ns) { if (n.key === key) return n; const f = lyFind(key, n.kids); if (f) return f; } return null; };
  const lyHL = (ids, on) => ids.forEach(i => cardsEl.querySelector(`[data-id="${i}"]`)?.classList.toggle('ly-hl', on));
  function wireLayers() {
    const list = $('layers'); if (!list || list.dataset.wired) return; list.dataset.wired = 1;
    list.addEventListener('pointerover', e => { const r = e.target.closest('.ly'); cardsEl.querySelectorAll('.ly-hl').forEach(el => el.classList.remove('ly-hl')); if (r) { const n = lyFind(r.dataset.key); n && lyHL(lyAll(n), true); } });
    list.addEventListener('pointerleave', () => cardsEl.querySelectorAll('.ly-hl').forEach(el => el.classList.remove('ly-hl')));
    // right-click a layer: the same menu as right-clicking that thing on the board (it gets selected first, if it isn't already)
    list.addEventListener('contextmenu', e => {
      const r = e.target.closest('.ly'); if (!r) return; const n = lyFind(r.dataset.key); if (!n) return; e.preventDefault(); e.stopPropagation();
      const ids = n.ids.filter(i => byId(i)); if (!ids.length) return;
      if (!(ids.length === sel.size && ids.every(i => sel.has(i)))) { endEdit(); selectOnly(ids); renderLayers(); }   // the row you right-clicked, not whatever happened to be selected
      stage.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY }));
    });
    list.addEventListener('click', e => {
      const r = e.target.closest('.ly'); if (!r) return; const n = lyFind(r.dataset.key); if (!n) return;
      if (e.target.closest('.ly-tw')) { LY.open.has(n.key) ? LY.open.delete(n.key) : LY.open.add(n.key); return renderLayers(); }
      if (e.target.closest('.ly-eye')) { remember(); const ids = lyAll(n), hide = !ids.every(i => byId(i)?.hidden); ids.forEach(i => { const c = byId(i); if (c) { c.hidden = hide || undefined; renderCard(c); } }); if (hide) selectOnly([...sel].filter(i => !ids.includes(i))); renderWires(); save(); return renderLayers(); }
      if (e.target.closest('.ly-lock')) { remember(); const ids = lyAll(n), lock = !ids.every(i => byId(i)?.locked); ids.forEach(i => { const c = byId(i); if (c) { c.locked = lock || undefined; renderCard(c); } }); if (lock) selectOnly([...sel].filter(i => !ids.includes(i))); save(); return renderLayers(); }
      if (n.ids.some(i => byId(i)?.hidden || byId(i)?.locked)) return;   // hidden or locked pieces can't be picked until they're shown/unlocked
      endEdit();
      if (e.shiftKey || e.metaKey || e.ctrlKey) { const all = n.ids.every(i => sel.has(i)); n.ids.forEach(i => all ? sel.delete(i) : sel.add(i)); selectOnly([...sel]); }
      else selectOnly(n.ids);
      lyBringIntoView(n.ids); lyFlash(lyAll(n)); renderLayers();
      const now = Date.now(), again = LY.lastClick && LY.lastClick.key === n.key && now - LY.lastClick.t < 450; LY.lastClick = again ? null : { key: n.key, t: now };
      if (again) setTimeout(() => lyRename(n.key), 0);
    });
    function lyRename(key) {
      const r = list.querySelector(`.ly[data-key="${CSS.escape(key)}"]`), nm = r?.querySelector('.ly-n'); if (!nm) return; const n = lyFind(key); if (!n) return;
      nm.contentEditable = 'true'; nm.focus(); getSelection().selectAllChildren(nm); r.draggable = false;
      const done = ok => { nm.contentEditable = 'false'; r.draggable = true; const v = nm.textContent.trim(); nm.onblur = nm.onkeydown = null;
        if (ok) { remember(); if (n.kind === 'group') n.ids.forEach(i => { const c = byId(i); if (c) c.gn = v || undefined; });
          else { const c = n.c; if (c.type === 'frame' || c.type === 'coll') { c.name = v || c.name; renderCard(c); }   // frames and collections rename on the board too
            else if (c.type === 'section') { if (v) { c.text = v; renderCard(c); } }
            else if (c.type === 'swatch') { if (v && v !== c.label) { const p = board.styles.colors.find(x => x.hex === c.hex); c.label = v; c.autoName = false; if (p) { p.name = v; renderPalette(); } renderCard(c); chirp(`Renamed the color to “${v}” ✓`, 2600); } }   // a color card: its color gets the new name (and the saved board color too)
            else c.ln = v && v !== layerName({ ...c, ln: '' }) ? v : undefined; }
          save(); }
        renderLayers(); };
      nm.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); done(true); } if (ev.key === 'Escape') done(false); };
      nm.onblur = () => done(true);
    }
    list.addEventListener('dblclick', e => { const r = e.target.closest('.ly'); if (r && !e.target.closest('.ly-b, .ly-tw')) setTimeout(() => lyRename(r.dataset.key), 0); });
    // drag rows to restack (or, inside a collection, to reorder its cards). Only between neighbors that share the same parent
    list.addEventListener('dragstart', e => { const r = e.target.closest('.ly'); if (!r) return; LY.drag = r.dataset.key; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch (er) {} });
    const parentKey = key => { const find = (ns, p) => { for (const n of ns) { if (n.key === key) return p; const f = find(n.kids, n.key); if (f !== undefined) return f; } return undefined; }; return find(LY.tree || [], ''); };
    list.addEventListener('dragover', e => { const r = e.target.closest('.ly'); list.querySelectorAll('.drop-a, .drop-b').forEach(x => x.classList.remove('drop-a', 'drop-b')); if (!r || !LY.drag || r.dataset.key === LY.drag) return; const pm = parentKey(LY.drag), pt = parentKey(r.dataset.key), isG = s => String(s).startsWith('g:');
      if (pm !== pt && !((pm === '' || isG(pm)) && (pt === '' || isG(pt)) && !(isG(pt) && lyFind(LY.drag)?.kind === 'group') && pt !== LY.drag)) return;   // between the top level and groups only: in or out of a group
      e.preventDefault(); const b = r.getBoundingClientRect(); r.classList.add(e.clientY < b.top + b.height / 2 ? 'drop-a' : 'drop-b'); });
    list.addEventListener('dragend', () => { LY.drag = null; list.querySelectorAll('.dragging, .drop-a, .drop-b').forEach(x => x.classList.remove('dragging', 'drop-a', 'drop-b')); });
    list.addEventListener('drop', e => {
      const r = e.target.closest('.drop-a, .drop-b'); if (!r || !LY.drag) return; e.preventDefault(); const above = r.classList.contains('drop-a');
      const mv = lyFind(LY.drag), tg = lyFind(r.dataset.key); if (!mv || !tg) return; remember();
      if (mv.inColl) { const co = byId(mv.inColl), k = (co.kids || []).filter(i => i !== mv.c.id), at = k.indexOf(tg.c.id); k.splice(above ? at : at + 1, 0, mv.c.id); co.kids = k; layoutAll(); }
      else { const ids = lyAll(mv), moving = board.cards.filter(c => ids.includes(c.id)), rest = board.cards.filter(c => !ids.includes(c.id)), tIdx = lyAll(tg).map(i => rest.findIndex(c => c.id === i)).filter(i => i >= 0);
        // the list is top-first, so "above" in the list means higher in the stack: after the target in the cards
        const at = above ? Math.max(...tIdx) + 1 : Math.min(...tIdx); rest.splice(at, 0, ...moving); board.cards = rest;
        const pt = parentKey(tg.key); if (pt !== parentKey(mv.key)) { if (String(pt).startsWith('g:')) { const g = pt.slice(2), hasMask = board.cards.some(x => x.group === g && x.maskLayer && !moving.includes(x)); moving.forEach(c => { c.group = g; if (hasMask) delete c.maskLayer; }); } else moving.forEach(c => { delete c.group; delete c.maskLayer; }); dissolveLonely(); }   // dropped into a group (one mask per group), or out of one
        renderAll(); }
      save(); renderLayers();
    });
  }
  // Mochi points it out: a soft pink glow pulses around the piece and she pops up on its corner with a wave, then both fade
  function lyFlash(ids) {
    const cs = ids.map(byId).filter(c => c && !c.hidden); if (!cs.length) return;
    world.querySelectorAll('.ly-flash').forEach(f => f.remove());
    const pad = 10 / view.z, x0 = Math.min(...cs.map(c => c.x)) - pad, y0 = Math.min(...cs.map(c => c.y)) - pad, x1 = Math.max(...cs.map(c => c.x + c.w)) + pad, y1 = Math.max(...cs.map(c => c.y + c.h)) + pad;
    const f = document.createElement('div'); f.className = 'ly-flash'; f.style.setProperty('--iz', (1 / view.z).toFixed(4));
    Object.assign(f.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
    f.innerHTML = '<i class="lf-ring"></i><i class="lf-ring two"></i><img class="lf-mochi" src="stamps/mochi-wave.png" alt=""><b class="lf-spark">✦</b>';
    world.appendChild(f); setTimeout(() => f.classList.add('out'), 1500); setTimeout(() => f.remove(), 1900);
  }
  function lyBringIntoView(ids) {
    const cs = ids.map(byId).filter(Boolean); if (!cs.length) return; const r = stage.getBoundingClientRect();
    const x0 = Math.min(...cs.map(c => c.x)), y0 = Math.min(...cs.map(c => c.y)), x1 = Math.max(...cs.map(c => c.x + c.w)), y1 = Math.max(...cs.map(c => c.y + c.h));
    const sx0 = x0 * view.z + view.x, sy0 = y0 * view.z + view.y, sx1 = x1 * view.z + view.x, sy1 = y1 * view.z + view.y;
    const L = document.body.classList.contains('phone') ? 0 : 270;   // the side panels' room (none on a phone)
    if (sx0 > L + 10 && sx1 < r.width - 40 && sy0 > 60 && sy1 < r.height - 100) return;   // already on screen
    const tx = L + (r.width - L) / 2 - (x0 + x1) / 2 * view.z, ty = r.height / 2 - (y0 + y1) / 2 * view.z, fx = view.x, fy = view.y, t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 320), e = 1 - Math.pow(1 - k, 3); view.x = fx + (tx - fx) * e; view.y = fy + (ty - fy) * e; applyView(); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  // ---------- zoom from the menu (click the %) or the keyboard: it glides there, centered on the part of the board you're looking at ----------
  const ZOOMS = [.25, .5, .75, 1, 1.25, 1.5, 2, 3];
  function glideView(to) {
    const from = { ...view }, t0 = performance.now(); stage.classList.add('moving');
    const step = t => { const k = Math.min(1, (t - t0) / 260), e = 1 - Math.pow(1 - k, 3); ['x', 'y', 'z'].forEach(n => view[n] = from[n] + (to[n] - from[n]) * e); applyView();
      if (k < 1) requestAnimationFrame(step); else stage.classList.remove('moving'); };
    requestAnimationFrame(step);
  }
  function zoomTo(z) {
    const r = stage.getBoundingClientRect(), L = document.body.classList.contains('phone') ? 0 : 270, cx = L + (r.width - L - 270) / 2, cy = r.height / 2;
    const p = { x: (cx - view.x) / view.z, y: (cy - view.y) / view.z }, nz = clamp(z, .15, 3);
    glideView({ x: cx - p.x * nz, y: cy - p.y * nz, z: nz });
  }
  const zoomStep = dir => zoomTo(dir > 0 ? (ZOOMS.find(z => z > view.z + .01) || 3) : ([...ZOOMS].reverse().find(z => z < view.z - .01) || .25));
  function zoomFit() { if (!board?.cards.length) return zoomTo(1); const from = { ...view }; fit(board.cards.filter(c => !c.hidden), 120, 2); const to = { ...view }; Object.assign(view, from); applyView(); glideView(to); }
  $('zoom').onclick = e => { e.stopPropagation(); const b = $('zoom').getBoundingClientRect();
    boardMenu({ clientX: b.left, clientY: b.top - 8 }, [
      { label: 'Zoom in  ⌘+', run: () => zoomStep(1) }, { label: 'Zoom out  ⌘−', run: () => zoomStep(-1) },
      { label: 'Zoom to 100%  ⌘0', run: () => zoomTo(1) }, { label: 'Zoom to fit  ⇧1', run: zoomFit }, '-',
      ...[.5, 1, 2].map(z => ({ label: `${z * 100}%${Math.abs(view.z - z) < .01 ? '  ✓' : ''}`, run: () => zoomTo(z) }))]);
    const m = $('rowMenu'); if (m) { const mr = m.getBoundingClientRect(); m.style.top = b.top - mr.height - 8 + 'px'; m.classList.add('zoom-menu'); } };
  function centerWorld() { const r = stage.getBoundingClientRect(); return toWorld(r.left + 270 + (r.width - 530) / 2, r.top + r.height / 2); }
  function addAtCenter(type, extra = {}) {
    const p = centerWorld(), c = card(type, extra); c.x = p.x - c.w / 2 + (Math.random() * 60 - 30); c.y = p.y - c.h / 2 + (Math.random() * 60 - 30);
    addCard(c); selectOnly([c.id]); if (['note', 'title', 'todo'].includes(type)) startEdit(c.id); return c;
  }
  // ---------- Spotify: a song, album, playlist, podcast or artist link becomes Spotify's own player on the board ----------
  const SP_KINDS = ['track', 'album', 'playlist', 'episode', 'show', 'artist'];
  function spotifyOf(u) {
    const m = String(u || '').trim().match(/^(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/i)
      || String(u || '').trim().match(/^spotify:(track|album|playlist|episode|show|artist):([A-Za-z0-9]{10,40})$/i);
    return m && SP_KINDS.includes(m[1].toLowerCase()) ? { kind: m[1].toLowerCase(), sid: m[2] } : null;
  }
  const SP_HEAD = 28, spH = kind => (['track', 'episode'].includes(kind) ? 152 : 352) + SP_HEAD + 6;   // Spotify's player only shows its full layout at exactly 152 / 352 tall
  const spEmbed = c => `https://open.spotify.com/embed/${c.kind}/${c.sid}?utm_source=mochiboard`;
  async function spotifyFill(c, url) {
    const s2 = spotifyOf(url); if (!s2) return false;
    Object.assign(c, { type: 'spotify', url: `https://open.spotify.com/${s2.kind}/${s2.sid}`, kind: s2.kind, sid: s2.sid, w: 320, h: spH(s2.kind), title: c.title && !/^https?:/.test(c.title) ? c.title : 'Spotify', loading: false, draft: '' });
    renderCard(c); save();
    // Spotify's own public info (no account needed): the real name and cover art, kept on the card for offline, Layers and Mochi
    try { const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(c.url)); if (r.ok) { const o = await r.json(); if (o.title) c.title = o.title; if (o.thumbnail_url) c.image = o.thumbnail_url; } } catch (e) {}
    if (!c.title || c.title === 'Spotify') try { const p = await MB.linkPreview(c.url); if (p.title && !/^open\.spotify\.com$/i.test(p.title)) c.title = p.title.replace(/\s*[|·-]\s*Spotify\s*$/i, ''); if (!c.image && p.image) c.image = p.image; } catch (e) {}
    c.desc = { track: 'Song', album: 'Album', playlist: 'Playlist', episode: 'Podcast episode', show: 'Podcast', artist: 'Artist' }[c.kind] + ' on Spotify'; renderCard(c); save();
    return true;
  }
  async function linkCard(url, at, toTray) {
    if (spotifyOf(url)) { const c = card('spotify', { url, title: 'Spotify' }); if (toTray) { board.tray.unshift(c); renderTray(); } else { Object.assign(c, at || {}); addCard(c); } await spotifyFill(c, url); if (toTray) renderTray(); return c; }
    const c = card('link', { url, title: url, desc: '' });
    if (toTray) board.tray.unshift(c); else { Object.assign(c, at || {}); addCard(c); }
    try { const p = await MB.linkPreview(url); Object.assign(c, { title: p.title || url, desc: p.desc || url, image: p.image || '' }); toTray ? renderTray() : renderCard(c); save(); } catch (e) {}
    if (toTray) { renderTray(); save(); }
    linkShot(c, url, toTray);
    return c;
  }
  // the picture on a link card is a screenshot of the page: the Mac app renders the page itself (nothing is sent anywhere but the site);
  // in a browser or on Windows a free screenshot service draws it, and it looks again a little later because the service draws in the background
  const MSHOTS = u => `https://s.wordpress.com/mshots/v1/${encodeURIComponent(u)}?w=1280&h=800`;
  async function linkShot(c, url, inTray) {
    let shot = '';
    try { shot = await MB.linkShot(url); } catch (e) {}
    const service = !shot; if (service) shot = MSHOTS(url) + '&t=' + Date.now();
    const show = () => { if (c.url !== url) return false; c.image = shot; c.shot = true; if (!c.h || c.h < 120) c.h = 210; inTray ? renderTray() : (byId(c.id) ? renderCard(c) : renderTray()); save(); return true; };
    if (!show()) return;
    if (service) [7, 16, 32].forEach(sec => setTimeout(() => { if (c.image === shot) { shot = MSHOTS(url) + '&t=' + Date.now(); show(); } }, sec * 1000));
  }
  // images come in as data URLs, scaled down so boards stay light
  // GIFs (and animated WebPs) keep their own file so they still move; PNGs stay PNGs so see-through parts stay see-through
  const MOVING = ['image/gif', 'image/webp', 'image/apng'], MOVING_MAX = 12e6;
  function imageFromFile(file) {
    return new Promise(res => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => {
      if (MOVING.includes(file.type) && file.size <= MOVING_MAX) return res({ src: fr.result, w: im.width, h: im.height });
      const k = Math.min(1, 2800 / Math.max(im.width, im.height))   // full Retina size, so pictures stay sharp when you zoom in
     , cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      if (MOVING.includes(file.type)) say('That one is too big to keep moving, so I kept a still of it.');
      const png = file.type === 'image/png' || file.type === 'image/svg+xml', out = png ? cv.toDataURL('image/png') : '';
      res({ src: png && out.length < 6e6 ? out : cv.toDataURL('image/jpeg', .9), w: cv.width, h: cv.height }); }; im.src = fr.result; }; fr.readAsDataURL(file); });
  }
  async function addImages(files, at, toTray) {
    files = [...files]; const vfs = files.filter(f => f.type.startsWith('video/')); files = files.filter(f => !f.type.startsWith('video/'));
    vfs.forEach((f, n) => addVideo(f, at ? { x: at.x + n * 30, y: at.y + n * 30 } : null));
    let i = 0;
    for (const f of files) { if (!f.type.startsWith('image/')) continue; const im = await imageFromFile(f);
      const nf = settings.imgFrame === false, w = 260, h = Math.round(w * im.h / im.w) + (nf ? 0 : 16), c = card('image', { src: im.src, w, h, ...(nf ? { noframe: true } : {}), ...(settings.imgRadius === false ? { radius: 0 } : {}) });
      if (toTray) { board.tray.unshift(c); renderTray(); save(); continue; }
      const p = at || centerWorld(); c.x = p.x - w / 2 + i * 30; c.y = p.y - h / 2 + i * 30; i++; addCard(c); }
  }

  // ---------- pulling colours out of an image ----------
  function pullColors(c) {
    const im = new Image(); im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 60; cv.height = Math.max(1, Math.round(60 * im.height / im.width)); const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
      const d = g.getImageData(0, 0, cv.width, cv.height).data, buckets = new Map();
      for (let i = 0; i < d.length; i += 4) { const k = [d[i] >> 5, d[i + 1] >> 5, d[i + 2] >> 5].join(','), b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; buckets.set(k, b); }
      const picks = []; [...buckets.values()].sort((a, b) => b.n - a.n).forEach(b => { const c3 = [b.r / b.n, b.g / b.n, b.b / b.n];
        if (picks.length < 5 && picks.every(p => Math.hypot(p[0] - c3[0], p[1] - c3[1], p[2] - c3[2]) > 48)) picks.push(c3); });
      const hex = c3 => '#' + c3.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      picks.forEach((p, i) => addCard(card('swatch', { x: c.x + c.w + 30 + i * 128, y: c.y + (i % 2) * 18, hex: hex(p), label: ['main', 'second', 'accent', 'shadow', 'pop'][i] })));
      board.links.push(...[]); say(`I pulled ${picks.length} colors out of that image ✦`);
    }; im.src = c.src;
  }

  // ---------- editing text ----------
  // notes and checklists fit their words, like auto-height in Figma: taller as you type, back down as you delete,
  // but never shorter than the height you gave the card yourself (c.userH, remembered the first time you edit or resize it)
  function fitText(c) {
    if (!c || !['note', 'todo', 'table'].includes(c.type) || parentOf(c.id)) return; const el = cardsEl.querySelector(`[data-id="${c.id}"]`), b = el?.querySelector('.body'); if (!b) return;
    if (c.userH == null) c.userH = c.h;
    const was = el.style.height; el.style.height = 'auto'; b.style.height = 'auto'; const need = Math.ceil(b.offsetHeight) + 2; b.style.height = ''; el.style.height = was;
    const h = Math.max(c.userH, need); if (Math.abs(h - c.h) > 1) { c.h = h; el.style.height = h + 'px'; if (typeof renderWires === 'function') renderWires(); }
  }
  // any words on a card can be edited: double-click the bit you want (text, list heading, a list item, the little label, a link's title or note)
  function editField(el, t, set, done) {
    editing = el.dataset.id; el.classList.add('editing'); t.contentEditable = 'true'; t.focus(); syncPorts();   // the connect dots step aside while you type
    const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const oneLine = !t.matches('.body > .text');   // notes and titles can wrap; labels, headings and list items are one line
    const fc = byId(el.dataset.id); if (fc && fc.userH == null && ['note', 'todo'].includes(fc.type)) fc.userH = fc.h;
    t.oninput = () => { set(oneLine ? t.innerText.replace(/\n/g, ' ').trim() : t.innerText.replace(/\n$/, '')); fitText(fc); save(); };
    t.onkeydown = ev => { if (ev.key === 'Enter' && oneLine) { ev.preventDefault(); t.blur(); } };
    t.onblur = () => { endEdit(); done && done(); };
  }
  function editTag(c) {
    const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return;
    if (!c.tagText) { c.tagText = 'label'; renderCard(c); selectOnly([c.id]); }
    const e2 = cardsEl.querySelector(`[data-id="${c.id}"]`);
    editField(e2, e2.querySelector('.tag'), v => c.tagText = v.trim(), () => { if (!c.tagText) { delete c.tagText; renderCard(c); if (sel.has(c.id)) selectOnly([c.id]); save(); } });   // (clicking elsewhere already moved the selection; leave it there)
  }
  let lastTap = {};
  // ---------- tables: type in a cell; Tab and Enter move on (and add a row at the end), right-click for rows and columns ----------
  let tbLast = { id: null, t: 0 };   // the table you just left a cell of: a click on another of its cells keeps typing there
  function editCell(c, el, cell) {
    if (!cell) return; const r = +cell.dataset.r, k = +cell.dataset.c;
    const go = (r2, k2) => { const n = cardsEl.querySelector(`[data-id="${c.id}"] [data-r="${r2}"][data-c="${k2}"]`); if (n) startEdit(c.id, n); };
    const grow = () => { c.rows.push(Array(c.rows[0].length).fill('')); renderCard(c); fitText(c); save(); };
    editField(el, cell, v => { c.rows[r][k] = v; }, () => { tbLast = { id: c.id, t: Date.now() }; });
    cell.onkeydown = ev => {
      const cols = c.rows[0].length;
      if (ev.key === 'Tab') { ev.preventDefault(); ev.stopPropagation(); let r2 = r, k2 = k + (ev.shiftKey ? -1 : 1); if (k2 >= cols) { k2 = 0; r2++; } if (k2 < 0) { k2 = cols - 1; r2--; } if (r2 < 0) return;
        cell.onblur = null; endEdit(); if (r2 >= c.rows.length) grow(); go(r2, k2); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); cell.onblur = null; endEdit(); if (r + 1 >= c.rows.length) grow(); go(r + 1, k); }
      else if (ev.key === 'Enter') ev.preventDefault();   // a cell is one line (Shift+Enter would show a break that can't be kept)
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cell.blur(); selectOnly([c.id]); }
    };
    // paste as plain text; spreadsheet cells (tabs / several rows) spread out from this cell, the way a spreadsheet does
    cell.onpaste = ev => {
      ev.preventDefault(); ev.stopPropagation(); const txt = (ev.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
      const grid = /\t/.test(txt) ? txt.replace(/\n+$/, '').split('\n').map(l => l.split('\t')) : null;
      if (!grid || (grid.length === 1 && grid[0].length === 1)) return document.execCommand('insertText', false, txt.replace(/\s+/g, ' ').trim());
      remember(); cell.onblur = null; endEdit();
      const need = k + Math.max(...grid.map(g => g.length)); if (need > c.rows[0].length) c.rows.forEach(row => row.push(...Array(need - row.length).fill('')));
      while (c.rows.length < r + grid.length && c.rows.length < 300) c.rows.push(Array(c.rows[0].length).fill(''));
      grid.forEach((g, i) => g.forEach((v, j) => { if (c.rows[r + i]) c.rows[r + i][k + j] = v.replace(/\s+/g, ' ').trim(); }));
      if (c.w < c.rows[0].length * 110) c.w = Math.min(1400, c.rows[0].length * 110);
      renderCard(c); fitText(c); selectOnly([c.id]); save(); chirp(`Pasted ${grid.length} × ${Math.max(...grid.map(g => g.length))} ✦`);
    };
  }
  function tableEdit(c, what, at) {
    remember(); endEdit(); const cols = c.rows[0].length;
    if (what === 'row+') c.rows.splice(at ?? c.rows.length, 0, Array(cols).fill(''));
    if (what === 'col+') { c.rows.forEach(row => row.splice(at ?? cols, 0, '')); if (c.w < (cols + 1) * 110) c.w = (cols + 1) * 110; }
    if (what === 'row-' && c.rows.length > 1) c.rows.splice(at, 1);
    if (what === 'col-' && cols > 1) c.rows.forEach(row => row.splice(at, 1));
    if (what === 'head') { if (c.head === false) delete c.head; else c.head = false; }
    if (what === 'row-' || what === 'col-') c.userH = 40; renderCard(c); fitText(c); selectOnly([c.id]); save();   // a height you set stays, unless rows go away
    if (what === 'row+' || what === 'col+') { const r2 = what === 'row+' ? at ?? c.rows.length - 1 : 0, k2 = what === 'col+' ? at ?? c.rows[0].length - 1 : 0; setTimeout(() => startEdit(c.id, cardsEl.querySelector(`[data-id="${c.id}"] [data-r="${r2}"][data-c="${k2}"]`)), 0); }
  }
  function tableMenu(cs, e) {
    const c = cs.length === 1 && cs[0].type === 'table' && cs[0]; if (!c) return [];
    const cell = e.target.closest?.('td, th'), r = cell ? +cell.dataset.r : c.rows.length - 1, k = cell ? +cell.dataset.c : c.rows[0].length - 1;
    return [{ label: 'Table', sub: [
      { label: 'Add row above', run: () => tableEdit(c, 'row+', r) }, { label: 'Add row below', run: () => tableEdit(c, 'row+', r + 1) },
      { label: 'Add column left', run: () => tableEdit(c, 'col+', k) }, { label: 'Add column right', run: () => tableEdit(c, 'col+', k + 1) },
      ...(c.rows.length > 1 ? [{ label: 'Delete row', run: () => tableEdit(c, 'row-', r) }] : []), ...(c.rows[0].length > 1 ? [{ label: 'Delete column', run: () => tableEdit(c, 'col-', k) }] : []),
      { label: c.head === false ? 'Make the first row a header' : 'Plain first row', run: () => tableEdit(c, 'head') }] }];
  }
  // pasted rows from a spreadsheet (tabs), a table copied from a web page or doc, or CSV become a table card
  function tableFrom(text, html) {
    const tidy = rows => { rows = rows.map(r => r.map(v => String(v ?? '').replace(/\s+/g, ' ').trim())).filter(r => r.some(Boolean)).slice(0, 300); const n = Math.max(...rows.map(r => r.length)); return rows.length >= 2 && n >= 2 ? rows.map(r => [...r, ...Array(n - r.length).fill('')].slice(0, 30)) : null; };
    const lines = (text || '').replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length >= 2 && lines.every(l => l.includes('\t'))) return tidy(lines.map(l => l.split('\t')));
    if (html && /<table/i.test(html)) { const d = new DOMParser().parseFromString(html, 'text/html'), t = d.querySelector('table'); if (t) return tidy([...t.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent))); }
    const csv = l => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
    // commas only make a table when it really looks like data: 3+ lines or 3+ columns, and no line ends like a sentence (an address or a two-line message stays text)
    if (lines.length >= 2 && !lines.some(l => /[.!?…]["')]?\s*$/.test(l.trim()))) { const rows = lines.map(csv), n = rows[0].length; if (n >= 2 && (lines.length >= 3 || n >= 3) && rows.every(r => r.length === n)) return tidy(rows); }
    return null;
  }
  function addTable(rows, at) {
    const p = at || centerWorld(), cols = rows[0].length, c = card('table', { rows, w: Math.min(900, Math.max(260, cols * 130)), h: 60, r: 0 });
    c.x = p.x - c.w / 2; c.y = p.y - 40; addCard(c); fitText(c); selectOnly([c.id]); save(); return c;
  }
  function startEdit(id, target) {
    const el = cardsEl.querySelector(`[data-id="${id}"]`), c = byId(id); if (!el || !c) return;
    if (c.type === 'file') return FINFO.get(c.path)?.exists === false ? findFile(c) : openFileCard(c);   // double-click opens the real file
    if (c.type === 'folder') return;   // inside a folder card, double-clicks open what's in it
    if (target && target.closest('.tag')) return editTag(c);
    if (target && target.closest('.nname')) return editField(el, el.querySelector('.nname'), v => c.name = v);
    if (c.type === 'coll') return editField(el, el.querySelector('.coll-head .text'), v => c.text = v);
    if (c.type === 'frame') return editField(el, el.querySelector('.fr-name'), v => c.name = v);
    if (c.type === 'section') return editField(el, el.querySelector('.sec-name .text'), v => c.text = v);
    if (c.type === 'font') return editField(el, el.querySelector('.fs-sample'), v => c.text = v);
    if ((c.type === 'doc' || c.type === 'canvas') && target && !target.closest('.text')) return c.type === 'doc' ? openDoc(c) : openCanvas(c);
    if (c.type === 'doc') return editField(el, el.querySelector('.text'), v => c.text = v);
    if (c.type === 'canvas') return editField(el, el.querySelector('.text'), v => c.text = v, () => renameChild(c));
    if (c.type === 'link' && !c.url) return wireLinkInput(c);
    if (c.type === 'audio') { if (target && target.closest('.au-tx') && c.text) return editField(el, el.querySelector('.au-tx'), v => c.text = v); return editField(el, el.querySelector('.au-top .text'), v => c.title = v); }
    if (c.type === 'table') return editCell(c, el, (target && target.closest('td, th')) || el.querySelector('td, th'));
    const li = target && target.closest('li');
    if (li && c.type === 'todo') { const i = +li.dataset.i, sp = li.querySelector('span');
      const edit = (j, end) => setTimeout(() => { const s2 = cardsEl.querySelector(`[data-id="${c.id}"] li[data-i="${j}"] span`); if (!s2) return; startEdit(c.id, s2); if (end) { const r = document.createRange(); r.selectNodeContents(s2); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); } }, 0);
      editField(el, sp, v => c.items[i].t = v, () => { if (c.items[i] && !c.items[i].t.trim()) { c.items.splice(i, 1); renderCard(c); fitText(c); save(); } });
      sp.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); ev.stopImmediatePropagation(); if (!c.items[i].t.trim()) return sp.blur(); sp.onblur = null; endEdit(); c.items.splice(i + 1, 0, { t: '', done: false }); renderCard(c); fitText(c); save(); edit(i + 1); }
        else if (ev.key === 'Backspace' && !sp.textContent) { ev.preventDefault(); ev.stopImmediatePropagation(); sp.onblur = null; endEdit(); c.items.splice(i, 1); renderCard(c); fitText(c); save(); if (i > 0) edit(i - 1, true); else selectOnly([c.id]); }
      }, true);
      return; }
    if (c.type === 'link') { const desc = target && target.closest('.meta span'); return editField(el, el.querySelector(desc ? '.meta span' : '.meta b'), v => desc ? c.desc = v : c.title = v); }
    if (c.type === 'image') return editTag(c);
    if (c.type === 'swatch') return openColor(c);
    if (c.type === 'todo') return editField(el, el.querySelector('.head'), v => c.text = v);
    const t = el.querySelector(c.type === 'todo' ? '.head' : '.text'); if (!t) return;
    editing = id; el.classList.add('editing'); t.contentEditable = 'true'; t.focus(); syncPorts(); if (c.userH == null && ['note', 'todo'].includes(c.type)) c.userH = c.h;
    const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    t.oninput = () => { c.text = t.innerText.replace(/\n$/, '');
      fitText(c);
      save(); };
    t.onblur = () => endEdit();
  }
  function endEdit() { if (!editing) return; { const c0 = byId(editing), e0 = cardsEl.querySelector(`[data-id="${editing}"]`); if (c0 && e0 && ['title', 'text'].includes(c0.type)) setTimeout(() => textStrokeSVG(c0, e0), 0); }
    const el = cardsEl.querySelector(`[data-id="${editing}"]`); if (el) { el.classList.remove('editing'); el.querySelectorAll('[contenteditable]').forEach(n => n.contentEditable = 'false');
      const c1 = byId(editing); if (c1 && c1.type === 'title') { if (!c1.fixedW && el.offsetWidth) c1.w = el.offsetWidth; if (el.offsetHeight) c1.h = el.offsetHeight; renderWires(); }
      editing = null; requestAnimationFrame(syncPorts); return; } editing = null; }

  // ---------- pointer: drag cards, resize, connect, marquee, pan ----------
  let drag = null;
  function clearStuckDrag() { cardsEl.querySelectorAll('.card.dragging').forEach(el => { el.classList.remove('dragging'); el.style.transform = ''; el.style.willChange = ''; }); stage.classList.remove('dragging-cards', 'cloning', 'panning'); }
  stage.addEventListener('pointercancel', () => { if (drag?.mode === 'move') { drag.start?.forEach(s => { const el = s.el || cardsEl.querySelector(`[data-id="${s.c.id}"]`); if (el) { el.style.left = s.c.x + 'px'; el.style.top = s.c.y + 'px'; } }); } drag = null; clearStuckDrag(); placeSelbar(); });
  stage.addEventListener('pointerdown', e => {
    if (!drag) clearStuckDrag();
    if (e.target.closest('.tools, .tray, .mochi, .top, .capture, .side, .keys, .cpop, .home, .linkbox, .selbar, .dock, .docview, .shapepick, .tplpick')) return;
    const el = e.target.closest('.card'), w = toWorld(e.clientX, e.clientY);
    if (e.button === 2) return;   // right-click opens the menu, it doesn't drag
    if (board) { clearTimeout(snapT); remember(); }   // lock in the last change before a new one starts, so undo steps stay separate
    if (penT && e.button === 0 && !space) { e.preventDefault(); penDown(e); return; }
    if (drawOn && e.button === 0 && !space) { e.preventDefault(); drawDown(e); return; }
    if (e.target.id === 'rh' && rhFor && rhFor.startsWith('g:') && e.button === 0) { const cs = board.cards.filter(c => c.group === rhFor.slice(2)), bx = Math.min(...cs.map(c => c.x)), by = Math.min(...cs.map(c => c.y));
      drag = { mode: 'gresize', sx: w.x, sy: w.y, bx, by, bw: Math.max(...cs.map(c => c.x + c.w)) - bx, bh: Math.max(...cs.map(c => c.y + c.h)) - by, items: cs.map(c => ({ c, x: c.x, y: c.y, w: c.w, h: c.h })) }; stage.setPointerCapture(e.pointerId); return; }
    if (e.target.id === 'mrot' && e.button === 0) { const cs0 = selCards().filter(c => !c.locked), R = realBox;
      const inside = cs0.filter(c => c.type === 'section').flatMap(s => board.cards.filter(k => k !== s && !cs0.includes(k) && !k.locked && !k.hidden && k.type !== 'section' && k.x + R(k).w / 2 > s.x && k.x + R(k).w / 2 < s.x + s.w && k.y + R(k).h / 2 > s.y && k.y + R(k).h / 2 < s.y + s.h));
      const cs = [...cs0, ...inside]; if (cs.length >= 1) { remember();
      const x0 = Math.min(...cs.map(c => c.x)), x1 = Math.max(...cs.map(c => c.x + R(c).w)), y0 = Math.min(...cs.map(c => c.y)), y1 = Math.max(...cs.map(c => c.y + R(c).h));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const single = cs.length === 1, anchor = anchorOf(cs0), ang0 = tiltOf(anchor);
      drag = { mode: 'mrotate', cx, cy, ang0, single, anchor: anchor.id, selIds: cs0.map(c => c.id), a0: Math.atan2(w.y - cy, w.x - cx), dot0: { x: parseFloat(mrot.style.left), y: parseFloat(mrot.style.top) }, items: cs.map(c => { const r = R(c); return { c, mx: c.x + r.w / 2, my: c.y + r.h / 2, w: r.w, h: r.h, r0: WF.includes(c.type) ? (c.rot || 0) : (c.type === 'section' && !c.turned ? 0 : (c.r || 0)), wf: WF.includes(c.type) }; }) };   // an untouched section starts from upright, whatever stray tilt it carried
      drag.items.forEach(it => cardsEl.querySelector(`[data-id="${it.c.id}"]`)?.classList.add('tilting'));   // no easing while turning, so nothing trails behind
      stage.setPointerCapture(e.pointerId); return; } }
    if (e.target.id === 'rh' && rhFor === 'm' && e.button === 0) { const cs = selCards().filter(c => !c.locked && c.type !== 'ink'); if (cs.length > 1) { remember();
      const items = cs.map(c => { const r = realBox(c); return { c, x: c.x, y: c.y, w: r.w, h: r.h, fs0: fsMul(c), size0: c.size, sw0: c.sw }; }), bx = Math.min(...items.map(i => i.x)), by = Math.min(...items.map(i => i.y));
      drag = { mode: 'gresize', multi: true, sx: w.x, sy: w.y, bx, by, bw: Math.max(...items.map(i => i.x + i.w)) - bx, bh: Math.max(...items.map(i => i.y + i.h)) - by, items }; stage.setPointerCapture(e.pointerId); return; } }
    if (e.target.classList?.contains('kport') && kpFor && e.button === 0) { const c = byId(kpFor), s = e.target.dataset.side;   // a diagram shape's side dot
      if (c) { drag = { mode: 'wire', id: c.id, a: pinPoint(c, SIDE[s]), pa: SIDE[s], side: s, sx: e.clientX, sy: e.clientY }; showPorts(null); stage.setPointerCapture(e.pointerId); return; } }
    if (e.target.id === 'rh' && rhFor && e.button === 0) { const c = byId(rhFor); if (c) { drag = { mode: 'resize', id: c.id, sx: w.x, sy: w.y, w0: c.w, h0: c.h, fs0: fsMul(c) }; stage.setPointerCapture(e.pointerId); return; } }
    if (cropping && e.target.closest('.crop-ui')) { e.preventDefault(); cropDown(e); return; }
    if (placing?.type === 'box' && e.button === 0) { e.preventDefault(); stopPlacing(); drag = { mode: 'drawbox', sx: w.x, sy: w.y }; stage.setPointerCapture(e.pointerId); return; }
    if (placing && e.button === 0) { e.preventDefault(); placeAt(w); return; }
    const wireEl = e.target.closest('[data-wire]');
    if (wireEl && !space) {
      const l = linkById(wireEl.dataset.wire); if (!l) return;
      if (wireEl.classList.contains('w-bend')) drag = { mode: 'bend', l };
      else if (wireEl.dataset.end) drag = { mode: 'rewire', l, end: wireEl.dataset.end };
      else { const now = Date.now(), again = wireTap.id === l.id && now - wireTap.t < 450; if (e.shiftKey) { selectWire(l.id, true); return; } wireTap = again ? {} : { id: l.id, t: now }; selectWire(l.id); if (again) setTimeout(() => editWireLabel(l), 60); return; }   // pressing a line twice: type its label (the first press redraws the lines, so the browser never sends a double-click)
      stage.setPointerCapture(e.pointerId); return;
    }
    if (selWires.size && !el && !e.shiftKey) selectWire(null);
    if (space || e.button === 1) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; stage.classList.add('panning'); stage.setPointerCapture(e.pointerId); return; }
    if (el) {
      const id = el.dataset.id, c = byId(id);
      if (editing === id && !e.target.closest('.handle, .knob')) return;      // clicking inside text you're editing
      if (e.target.closest('input[type=checkbox], .link-in input')) return;
      if (e.target.closest('[data-act]')) return;
      if (c.type === 'section' && !sel.has(id) && e.button === 0 && !e.shiftKey && !e.target.closest('.sec-name, .handle, .knob, .rot-h')) {
        endEdit(); selectOnly([]); drag = { mode: 'marquee', sx: e.clientX, sy: e.clientY, base: new Set(), sec: id }; stage.setPointerCapture(e.pointerId); return; }
      if (e.target.classList.contains('rot-h')) { drag = { mode: 'rotate', c, cx: c.x + c.w / 2, cy: c.y + c.h / 2, tilt: TILTS(c) }; if (drag.tilt) el.classList.add('tilting'); }
      else if (e.target.classList.contains('handle')) { drag = { mode: 'resize', id, sx: w.x, sy: w.y, w0: c.w, h0: c.h, fs0: fsMul(c) }; }
      else if (e.target.classList.contains('knob')) { drag = { mode: 'wire', id, a: { x: c.x + c.w, y: c.y + c.h / 2 } }; }
      else {
        endEdit();
        if (e.shiftKey) { sel.has(id) ? sel.delete(id) : sel.add(id); selectOnly([...sel]); }
        else if (e.metaKey || e.ctrlKey) selectOnly([id]);   // ⌘-click reaches inside a group for just this piece
        else if (!sel.has(id)) selectOnly(groupOf(id));
        const ids = new Set(sel); [...sel].forEach(i => { const c = byId(i); if (c?.type === 'section') inSection(c).forEach(k => ids.add(k.id)); });
        [...ids].forEach(i => { const c = byId(i); if (c?.type === 'coll') (c.kids || []).forEach(k => ids.add(k)); if (c?.type === 'frame') onFrame(c).forEach(k => ids.add(k.id)); });
        drag = { mode: 'move', sx: w.x, sy: w.y, start: [...ids].map(i => byId(i)).filter(Boolean).map(c => ({ c, x: c.x, y: c.y })), moved: false };
      }
      stage.setPointerCapture(e.pointerId); return;
    }
    // zoomed out, cards are tiny and the gaps between them are easy to hit: a press anywhere inside the selection's outline grabs the whole selection
    if (sel.size && !e.shiftKey && e.button === 0 && !space) { const W2 = toWorld(e.clientX, e.clientY), cs0 = selCards().filter(c => !c.hidden && !c.locked), pad = 14 / view.z;
      if (cs0.length && W2.x > Math.min(...cs0.map(c => c.x)) - pad && W2.x < Math.max(...cs0.map(c => c.x + c.w)) + pad && W2.y > Math.min(...cs0.map(c => c.y)) - pad && W2.y < Math.max(...cs0.map(c => c.y + c.h)) + pad) {
        endEdit(); const ids = new Set(sel); [...sel].forEach(i => { const c = byId(i); if (c?.type === 'section') inSection(c).forEach(k => ids.add(k.id)); });
        [...ids].forEach(i => { const c = byId(i); if (c?.type === 'coll') (c.kids || []).forEach(k => ids.add(k)); if (c?.type === 'frame') onFrame(c).forEach(k => ids.add(k.id)); });
        drag = { mode: 'move', sx: W2.x, sy: W2.y, start: [...ids].map(i => byId(i)).filter(Boolean).map(c => ({ c, x: c.x, y: c.y })), moved: false };
        stage.setPointerCapture(e.pointerId); return; } }
    endEdit();
    if (!e.shiftKey) { if (sel.size) deselectAt = Date.now(); selectOnly([]); }
    if (e.pointerType === 'touch') { if (!e.shiftKey) selectOnly([]); drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; stage.classList.add('panning'); stage.setPointerCapture(e.pointerId); return; }   // a finger on empty board moves the board
    drag = { mode: 'marquee', sx: e.clientX, sy: e.clientY, base: new Set(sel) }; stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (penT && !drag) { penMove(e); return; }
    if (!drag) return; const w = toWorld(e.clientX, e.clientY);
    if (drag.mode === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy; applyView(); }
    if (drag.mode === 'move') {
      let dx = w.x - drag.sx, dy = w.y - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 2) { drag.moved = true; if (e.altKey) cloneForDrag(); }
      const sn = snapWF(drag.start, dx, dy); dx = sn.dx; dy = sn.dy;
      // move on the GPU: the card is lifted as an already-drawn picture and slid with a transform, so the wobbly-edge filter isn't redrawn every frame (Safari is slow at that)
      drag.start.forEach(s => { s.c.x = s.x + dx; s.c.y = s.y + dy; const el = s.el || (s.el = cardsEl.querySelector(`[data-id="${s.c.id}"]`)); if (!el) return;
        if (!s.lifted) { s.lifted = true; el.style.willChange = 'transform'; el.classList.add('dragging'); stage.classList.add('dragging-cards'); }
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`; });
      renderWires();
      $('tray').classList.toggle('drop', overTray(e));
      const loose = drag.start.filter(s => s.c.type !== 'coll'), skip = new Set(drag.start.filter(s => s.c.type === 'coll').map(s => s.c.id));
      cardsEl.querySelectorAll('.drop-in, .drop-col').forEach(n => n.classList.remove('drop-in', 'drop-col'));
      const dt = loose.length && !skip.size && docTarget(e, w, loose); $('docview').classList.toggle('drop', dt === 'page');
      if (dt && dt !== 'page') { cardsEl.querySelector(`[data-id="${dt.id}"]`)?.classList.add('drop-in'); }
      else if (loose.length && !skip.size) { const t = collAt(w, skip); if (t) cardsEl.querySelector(`[data-id="${t.s.id}"]`)?.classList.add(t.side ? 'drop-col' : 'drop-in'); }
    }
    if (drag.mode === 'resize' && byId(drag.id).type === 'coll') { const c = byId(drag.id); c.cols = Math.max(1, Math.round((drag.w0 + w.x - drag.sx - CPAD * 2 + CGAP) / (CW + CGAP))); layoutColl(c); renderWires(); return; }
    if (drag.mode === 'resize' && ['stamp', 'icon'].includes(byId(drag.id).type)) { const c = byId(drag.id); c.w = c.h = clamp(drag.w0 + Math.max(w.x - drag.sx, w.y - drag.sy), 24, 400); const el = cardsEl.querySelector(`[data-id="${c.id}"]`); Object.assign(el.style, { width: c.w + 'px', height: c.h + 'px' }); el.style.setProperty('--sz', c.w + 'px'); return; }
    // Shift + resize scales the whole thing: same shape, and the words (and everything inside) grow or shrink with it
    if (drag.mode === 'resize' && e.shiftKey && !['coll', 'frame', 'section'].includes(byId(drag.id).type)) {
      const c = byId(drag.id), el = cardsEl.querySelector(`[data-id="${c.id}"]`), kx = (drag.w0 + w.x - drag.sx) / drag.w0, ky = (drag.h0 + w.y - drag.sy) / drag.h0;
      const k = Math.max(.2, Math.min(drag.w0 * 12 / drag.w0, Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky));
      c.w = Math.round(drag.w0 * k); c.h = Math.round(drag.h0 * k);
      if (SIZED.includes(c.type)) { const m = +(drag.fs0 * k).toFixed(4), hit = Object.keys(FS).find(z => Math.abs(FS[z] - m) < .001); if (hit === 'm') delete c.fs; else c.fs = hit || m; el.style.setProperty('--fs', fsMul(c)); }
      if (c.type === 'title' && !c.fixedW) { c.fixedW = true; el.classList.add('fixedw'); } if (c.type === 'note' || c.type === 'todo' || c.type === 'table') c.userH = c.h;
      el.style.width = c.w + 'px'; if (c.type !== 'title') el.style.height = c.h + 'px'; else c.h = el.offsetHeight; renderWires(); return;
    }
    if (drag.mode === 'resize') { const c = byId(drag.id); c.w = Math.max(80, drag.w0 + w.x - drag.sx); c.h = Math.max(50, drag.h0 + w.y - drag.sy); const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (c.type === 'title' && !c.fixedW) { c.fixedW = true; el.classList.add('fixedw'); } if (c.type === 'note' || c.type === 'todo' || c.type === 'table') c.userH = c.h; el.style.width = c.w + 'px'; el.style.setProperty('--cw', c.w + 'px'); el.classList.toggle('tiny', c.w < 140 || c.h < 90); if (c.type !== 'title') el.style.height = c.h + 'px'; else c.h = el.offsetHeight; renderWires(); }
    if (drag.mode === 'gresize' && drag.multi && e.shiftKey) { const d = drag, kx = (d.bw + w.x - d.sx) / d.bw, ky = (d.bh + w.y - d.sy) / d.bh, k = Math.max(.15, Math.abs(kx - 1) >= Math.abs(ky - 1) ? kx : ky);
      d.items.forEach(it => { const c = it.c; c.x = d.bx + (it.x - d.bx) * k; c.y = d.by + (it.y - d.by) * k; c.w = Math.max(8, it.w * k); c.h = Math.max(8, it.h * k);
        if (SIZED.includes(c.type)) { const m = +(it.fs0 * k).toFixed(4), hit = Object.keys(FS).find(z => Math.abs(FS[z] - m) < .001); if (hit === 'm') delete c.fs; else c.fs = hit || m; }
        if (c.type === 'text' && it.size0) c.size = Math.max(4, Math.round(it.size0 * k * 10) / 10);
        if (c.type === 'title' && c.fixedW) c.w = Math.max(8, it.w * k);
        const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) { Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: titleW(c), height: c.type === 'title' ? 'auto' : c.h + 'px' }); el.style.setProperty('--fs', fsMul(c)); if (c.type === 'text') { const tx = el.querySelector('.tx'); if (tx) tx.style.fontSize = (c.size || 18) + 'px'; } } });
      renderWires(); }
    else if (drag.mode === 'gresize') { const d = drag, nw = Math.max(24, d.bw + w.x - d.sx), nh = Math.max(14, d.bh + w.y - d.sy), kx = nw / d.bw, ky = nh / d.bh;
      d.items.forEach(it => { const c = it.c, txt = c.type === 'text';   // text keeps its height and stays centered where it was, so a label sits in the middle of its button
        c.x = d.bx + (it.x - d.bx) * kx; c.w = Math.max(8, it.w * kx); c.h = txt ? it.h : Math.max(8, it.h * ky); c.y = txt ? d.by + (it.y + it.h / 2 - d.by) * ky - it.h / 2 : d.by + (it.y - d.by) * ky;
        const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: titleW(c), height: c.type === 'title' ? 'auto' : c.h + 'px' }); });
      renderWires(); }
    if (drag.mode === 'wire') { if (drag.sx != null && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
      const t = wireTarget(drag, w); drag.to = t; drag.b = t ? t.pt : w; renderWires({ a: drag.a, b: drag.b, snap: t && drag.pa ? t.pt : null }); }
    if (drag.mode === 'mrotate') { const d = drag; let a = (Math.atan2(w.y - d.cy, w.x - d.cx) - d.a0) * 180 / Math.PI; a = ((a + 540) % 360) - 180;
      a = e.shiftKey ? Math.round(a / 15) * 15 : (Math.abs(a - Math.round(a / 15) * 15) < 2 ? Math.round(a / 15) * 15 : a); d.cur = a; const t = a * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
      d.items.forEach(it => { const c = it.c, dx = it.mx - d.cx, dy = it.my - d.cy, nx = d.cx + dx * co - dy * si, ny = d.cy + dx * si + dy * co;   // each piece's middle goes around the turn
        c.x = nx - it.w / 2; c.y = ny - it.h / 2; const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; }
        if (ROT_FIXED.includes(c.type)) return;
        if (it.wf) { c.rot = +(it.r0 + a).toFixed(2); el?.style.setProperty('--rot', c.rot + 'deg'); }
        else { c.r = +(it.r0 + a).toFixed(2); if (c.type === 'stamp') c.tilted = true; if (c.type === 'section') c.turned = true; el?.style.setProperty('--tilt', c.r + 'deg'); } });
      renderWires(); const rb = $('rotBadge'); rb.textContent = Math.round(a) + '°'; rb.style.left = e.clientX + 18 + 'px'; rb.style.top = e.clientY - 34 + 'px'; rb.classList.add('on'); }
    if (drag.mode === 'rotate') { let a = Math.atan2(w.y - drag.cy, w.x - drag.cx) * 180 / Math.PI + 90; a = ((a % 360) + 360) % 360; if (a > 180) a -= 360;
      const near = Math.round(a / 15) * 15; if (Math.abs(a - near) < 4) a = near;   // eases onto 15° steps
      if (drag.tilt) { drag.c.r = Math.round(a); drag.c.tilted = true; cardsEl.querySelector(`[data-id="${drag.c.id}"]`)?.style.setProperty('--tilt', drag.c.r + 'deg'); }
      else { drag.c.rot = Math.round(a); cardsEl.querySelector(`[data-id="${drag.c.id}"]`)?.style.setProperty('--rot', drag.c.rot + 'deg'); syncDesign(); }
      const rb = $('rotBadge'); rb.textContent = Math.round(a) + '°'; rb.style.left = e.clientX + 18 + 'px'; rb.style.top = e.clientY - 34 + 'px'; rb.classList.add('on'); }
    if (drag.mode === 'drawbox') { let r = drag.rect; if (!r) { r = drag.rect = document.createElement('div'); r.className = 'draw-rect'; world.appendChild(r); }
      const x = Math.min(drag.sx, w.x), y = Math.min(drag.sy, w.y); Object.assign(r.style, { left: x + 'px', top: y + 'px', width: Math.abs(w.x - drag.sx) + 'px', height: Math.abs(w.y - drag.sy) + 'px' }); }
    if (drag.mode === 'bend') { const a = byId(drag.l.a), b = byId(drag.l.b); if (a && b) { drag.l.bend = 0; const g = wireGeom(drag.l, a, b), bend = 2 * ((w.x - g.mid.x) * g.n.x + (w.y - g.mid.y) * g.n.y);
      drag.l.bend = Math.abs(bend) < 12 ? 0 : Math.round(bend); renderWires(); } }   // pull it flat and it snaps straight
    if (drag.mode === 'rewire') { const ke = drag.end === 'a' ? 'b' : 'a', keep = byId(drag.l[ke]); if (keep) { const g = wireGeom(drag.l, byId(drag.l.a), byId(drag.l.b)); renderWires({ a: ke === 'a' ? g.p0 : g.p2, b: w }); } }
    if (drag.mode === 'marquee') {
      const m = $('marquee'), r = stage.getBoundingClientRect(), x0 = Math.min(drag.sx, e.clientX), y0 = Math.min(drag.sy, e.clientY), x1 = Math.max(drag.sx, e.clientX), y1 = Math.max(drag.sy, e.clientY);
      Object.assign(m.style, { display: 'block', left: x0 - r.left + 'px', top: y0 - r.top + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
      const a = toWorld(x0, y0), b = toWorld(x1, y1);
      const secIn = c => (c.x > a.x && c.x + c.w < b.x && c.y > a.y && c.y + c.h < b.y) || (a.x < c.x + 60 && b.x > c.x + 60 && a.y < c.y + 30 && b.y > c.y + 30)
        || Math.max(0, Math.min(b.x, c.x + c.w) - Math.max(a.x, c.x)) * Math.max(0, Math.min(b.y, c.y + c.h) - Math.max(a.y, c.y)) >= c.w * c.h * .5;
      const hit = board.cards.filter(c => !c.hidden && !c.locked && (c.type === 'section' ? c.id !== drag.sec && secIn(c) : c.x < b.x && c.x + c.w > a.x && c.y < b.y && c.y + c.h > a.y)).flatMap(c => groupOf(c.id));
      selectOnly([...new Set([...drag.base, ...hit])]);
    }
  });
  const overTray = e => { const r = $('tray').getBoundingClientRect(); return e.clientX > r.left && e.clientY > r.top && e.clientY < r.bottom && !$('tray').classList.contains('closed'); };
  stage.addEventListener('pointerup', e => {
    if (penT) { penT.down = null; drawPen(); return; }
    if (!drag) return; const d = drag; drag = null; stage.classList.remove('panning'); $('guides').innerHTML = ''; $('marquee').style.display = 'none'; $('tray').classList.remove('drop');
    if (d.mode === 'marquee' && d.sec && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) { selectOnly([d.sec]); return; }
    if (d.mode === 'move') {
      stage.classList.remove('dragging-cards', 'cloning');
      // set it down: the transform becomes its real position again
      d.start.forEach(s => { const el = s.el || cardsEl.querySelector(`[data-id="${s.c.id}"]`); if (!el) return; el.style.left = s.c.x + 'px'; el.style.top = s.c.y + 'px'; el.style.transform = ''; el.style.willChange = ''; el.classList.remove('dragging'); });
      if (d.moved && overTray(e)) {                       // dropped on the tray: back to Unsorted
        d.start.forEach(s => { board.cards = board.cards.filter(c => c !== s.c); board.links = board.links.filter(l => l.a !== s.c.id && l.b !== s.c.id); board.tray.unshift(s.c); cardsEl.querySelector(`[data-id="${s.c.id}"]`)?.remove(); });
        sel.clear(); renderTray(); renderWires(); save(); return;
      }
      cardsEl.querySelectorAll('.drop-in, .drop-col').forEach(n => n.classList.remove('drop-in', 'drop-col'));
      if (d.moved) {
        if (settings.snap) { const lead = d.start[0].c, dx = snapTo(lead.x) - lead.x, dy = snapTo(lead.y) - lead.y; d.start.forEach(s2 => { s2.c.x += dx; s2.c.y += dy; renderCard(s2.c); }); }   // snap the group together, keeping its shape
        const w = toWorld(e.clientX, e.clientY), skip = new Set(d.start.filter(s => s.c.type === 'coll').map(s => s.c.id));
        const dt = !skip.size && docTarget(e, w, d.start); $('docview').classList.remove('drop');
        if (dt) { d.start.forEach(s2 => { s2.c.x = s2.x; s2.c.y = s2.y; renderCard(s2.c); }); dropIntoDoc(dt, d.start.map(s2 => s2.c), e); return; }   // the card slides home; its words go into the doc
        if (!skip.size) {
          const ids = d.start.map(s => s.c.id), t = collAt(w, skip);
          if (t) dropInto(t, ids, w);
          else ids.forEach(id => { const from = parentOf(id); if (from) { from.kids = from.kids.filter(k => k !== id); const el = cardsEl.querySelector(`[data-id="${id}"]`); el?.classList.remove('inside'); byId(id).r = tilt(); renderCard(byId(id)); } });
        }
        if (!skip.size) fileIntoFrame(d.start.map(s2 => s2.c).filter(c => c.type !== 'frame' && !parentOf(c.id)));
        if (d.start.length === 1 && d.start[0].c.kit) autoLink(d.start[0].c);
        save(); renderWires();
      }
      else if (d.start.length === 1 && d.start[0].c.type === 'swatch' && document.elementFromPoint(e.clientX, e.clientY)?.closest('.chipcol')) openColor(d.start[0].c);   // only the color itself opens the wheel; the rest of the card just selects it
      else {   // our own double-click check (pointer events don't count clicks everywhere), on whatever is really under the pointer
        const now = Date.now(), id = d.start[0].c.id, under = document.elementFromPoint(e.clientX, e.clientY);
        if (under && under.matches('.card.todo li span') && !under.isContentEditable) { lastTap = {}; startEdit(id, under); return; }   // list items edit with one click
        const pid = under?.closest('.card')?.dataset.id || id;
        if (lastTap.id === pid && now - lastTap.t < 420) { lastTap = {};
          if (sel.size > 1 && byId(pid)?.group && sel.has(pid)) { selectOnly([pid]); if (['text', 'note', 'title', 'todo'].includes(byId(pid).type)) startEdit(pid, under); return; }   // into the group: just this piece
          startEdit(pid, under); } else lastTap = { id: pid, t: now };
      }
    }
    if (d.mode === 'resize') { const rc = byId(d.id); if (rc && rc.type === 'table') fitText(rc); save(); }   // a table never ends shorter than its rows
    if (d.mode === 'gresize') { d.items.forEach(it => { renderCard(it.c); if (['note', 'todo', 'table'].includes(it.c.type)) it.c.userH = it.c.h; }); selectOnly(d.items.map(it => it.c.id)); save(); }
    if (d.mode === 'bend') save();
    if (d.mode === 'mrotate' && !d.single) mrotKeep = { key: selKey(d.items.map(it => it.c)), anchor: d.anchor };   // the dot stays on the piece that was on top
    if (d.mode === 'mrotate') { $('rotBadge').classList.remove('on'); d.items.forEach(it => { renderCard(it.c); cardsEl.querySelector(`[data-id="${it.c.id}"]`)?.classList.remove('tilting'); }); selectOnly(d.selIds || d.items.map(it => it.c.id)); save(); $('selbar').dataset.key = ''; }
    if (d.mode === 'rotate') { $('rotBadge').classList.remove('on'); cardsEl.querySelector(`[data-id="${d.c.id}"]`)?.classList.remove('tilting'); save(); $('selbar').dataset.key = ''; }
    if (d.mode === 'drawbox') { d.rect?.remove(); const w = toWorld(e.clientX, e.clientY); let x = Math.min(d.sx, w.x), y = Math.min(d.sy, w.y), bw = Math.abs(w.x - d.sx), bh = Math.abs(w.y - d.sy);
      if (bw < 6 && bh < 6) { bw = 160; bh = 100; }   // a click makes a standard box
      const c = card('box', { x, y, w: Math.round(bw), h: Math.round(bh), r: 0, fill: '#e4e4e7', radius: 6 }); addCard(c); fileIntoFrame([c]); pickWF(null); selectOnly([c.id]); save(); }
    if (d.mode === 'rewire') {
      const w = toWorld(e.clientX, e.clientY), other = d.end === 'a' ? d.l.b : d.l.a, pad = 16 / view.z;
      const t = [...board.cards].reverse().find(c => c.id !== other && c.type !== 'coll' && c.type !== 'section' && w.x > c.x - pad && w.x < c.x + c.w + pad && w.y > c.y - pad && w.y < c.y + (c.type === 'title' ? 50 : c.h) + pad);
      if (t) { d.l[d.end] = t.id; d.l['p' + d.end] = pinAt(t, w); save(); } renderWires();
    }
    if (d.mode === 'wire') {
      const w = toWorld(e.clientX, e.clientY), src = byId(d.id), tg = wireTarget(d, w), t = tg && tg.c, same = (p, q) => !!p && !!q && p.u === q.u && p.v === q.v;
      // a diagram shape can have many lines to the same shape (Yes and No, there and back); only an exact repeat is skipped
      const linked = t && board.links.some(l => d.pa ? (l.a === d.id && l.b === t.id && same(l.pa, d.pa) && same(l.pb, SIDE[tg.side])) : ((l.a === d.id && l.b === t.id) || (l.b === d.id && l.a === t.id)));
      const nearDot = d.sx != null && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 40;
      if (d.pa && src && (!d.moved || (nearDot && !t))) quickAdd(src, d.side);   // a click (or a wobbly one) on a side dot: the next shape, lined up and connected
      else if (d.pa && src && !t) quickAdd(src, d.side, w);               // dropped on empty board: the next shape right there
      else if (t && !linked) { remember(); board.links.push(d.pa && src ? kitLink(src, t, d.pa, SIDE[tg.side]) : { id: uid(), a: d.id, b: t.id }); save(); }   // near a side's middle: it snaps there
      renderWires();
    }
  });
  stage.addEventListener('dblclick', e => {
    const wl = e.target.closest('[data-wire]') || document.elementsFromPoint(e.clientX, e.clientY).find(x => x.matches?.('.wires .w-hit, .wires .w-label')); if (wl && !wl.dataset.end && !wl.classList.contains('w-bend')) { e.preventDefault(); return editWireLabel(linkById(wl.dataset.wire)); }
    if (penT) { const P = penT.pts; if (P.length > 1 && Math.hypot(P[P.length - 1].x - P[P.length - 2].x, P[P.length - 1].y - P[P.length - 2].y) < 4 / view.z) P.pop(); endPen(true); return; }   // a double-click finishes the line
    if (settings.dblNote === false) return;   // only the setting turns this off
    const hitEl = document.elementFromPoint(e.clientX, e.clientY);
    if (hitEl?.closest('.selbar') || hitEl?.closest('.card:not(.section)') || hitEl?.closest('.sec-name, [contenteditable="true"]')) return;
    if (e.target.closest('.card:not(.section), .tools, .tray, .mochi, .top, .capture, .side, .keys, .cpop, .home, .linkbox, .selbar, .docview, .hub, .sheet')) return;
    const w = toWorld(e.clientX, e.clientY), c = card('note', { color: newNoteColor() }); c.x = snapTo(w.x - c.w / 2); c.y = snapTo(w.y - c.h / 2); addCard(c); selectOnly([c.id]); startEdit(c.id);
  });
  // card buttons: pull colours, checklist items
  cardsEl.addEventListener('click', e => {
    const el = e.target.closest('.card'); if (!el) return; const c = byId(el.dataset.id), act = e.target.closest('[data-act]')?.dataset.act;
    if (act && act.startsWith('vd-')) return videoAct(c, act, e);
    if (act && /^f[lo]-/.test(act)) return fileAct(c, act, e, el);
    if (act && act.startsWith('au-')) return audioAct(c, act, e);
    if (act === 'colors') pullColors(c);
    if (act === 'tb-row' || act === 'tb-col') return tableEdit(c, act === 'tb-row' ? 'row+' : 'col+');
    const tcell = e.target.closest('td, th'); if (tcell && c.type === 'table' && !tcell.isContentEditable && tbLast.id === c.id && Date.now() - tbLast.t < 450) return startEdit(c.id, tcell);
    if (act === 'item') { c.items = c.items || []; c.items.push({ t: 'new thing', done: false }); renderCard(c); fitText(c); save(); }
    if (act === 'item-x') { const i = +e.target.closest('li').dataset.i; remember(); endEdit(); c.items.splice(i, 1); renderCard(c); fitText(c); selectOnly([c.id]); save(); return; }
    const li = e.target.closest('li'); if (li && c.type === 'todo') {
      const i = +li.dataset.i;
      if (e.target.matches('input')) { c.items[i].done = e.target.checked; li.classList.toggle('done', c.items[i].done); save(); }
      else if (e.target.matches('span') && !e.target.isContentEditable) startEdit(c.id, e.target);
    }
  });
  // trackpad: two fingers pan, pinch (or ⌘/ctrl + scroll) zooms
  stage.addEventListener('wheel', e => {
    if (e.target.closest('.tray, .m-bubble, .cpop, .home, .m-chat, .design, .side, .row-menu, .stamp-pick, .wheel-stamps, .docview, .settings, .shapepick, .tplpick')) return; e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, view.z * Math.exp(-e.deltaY * .01), true);
    else { view.x -= e.deltaX; view.y -= e.deltaY; viewSoon(); }
  }, { passive: false });

  // ---------- the tray: drag ideas out onto the board ----------
  // Unsorted collapses to its title with its – button, like the other widgets, and remembers it
  const trayMin = min => { $('tray').classList.toggle('closed', min); $('trayMin').textContent = min ? '+' : '–'; $('trayMin').title = min ? 'Open' : 'Minimize'; try { localStorage.setItem('mochiboard:trayMin', min ? '1' : ''); } catch (e) {} };
  try { trayMin(!!localStorage.getItem('mochiboard:trayMin')); } catch (e) {}
  $('trayMin').onclick = e => { e.stopPropagation(); trayMin(!$('tray').classList.contains('closed')); };
  $('trayList').addEventListener('pointerdown', e => {
    const it = e.target.closest('.tray-item'); if (!it) return; e.preventDefault();
    const c = board.tray.find(x => x.id === it.dataset.id), ghost = it.cloneNode(true);
    Object.assign(ghost.style, { position: 'fixed', width: it.offsetWidth + 'px', pointerEvents: 'none', zIndex: 99, left: e.clientX - 40 + 'px', top: e.clientY - 20 + 'px', rotate: '-3deg' });
    document.body.appendChild(ghost); it.style.opacity = .3;
    const mv = ev => { ghost.style.left = ev.clientX - 40 + 'px'; ghost.style.top = ev.clientY - 20 + 'px'; };
    const up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ghost.remove(); it.style.opacity = '';
      if (!overTray(ev) && !ev.target.closest('.side, .box')) { const w = toWorld(ev.clientX, ev.clientY); c.x = w.x - c.w / 2; c.y = w.y - 20; board.tray = board.tray.filter(x => x !== c); addCard(c); renderTray(); } };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });

  // no Mac beep: keys pressed on the board (not while typing) are Mochiboard's own, so tell macOS they were handled.
  // Otherwise Delete, Escape, arrows and the letter shortcuts fall through to the window, and macOS beeps.
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === ' ' && e.target.closest?.('button, a, [role="button"]')) return;   // Space still presses a focused button
    if (/^(Backspace|Delete|Escape|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Home|End|PageUp|PageDown)$/.test(e.key) || e.key.length === 1) e.preventDefault();
  });

  // ---------- quick capture (⌘K) ----------
  const capture = on => { $('capture').classList.toggle('on', on); if (on) { $('capInput').value = ''; $('capInput').focus(); } else $('capInput').blur(); };
  // clicking anywhere outside the box closes it (what you typed isn't saved unless you pressed Enter)
  addEventListener('pointerdown', e => { if ($('capture').classList.contains('on') && !e.target.closest('.capture')) capture(false); }, true);
  $('capForm').onsubmit = e => { e.preventDefault(); const v = $('capInput').value.trim(); if (v) { if (asLink(v)) linkCard(asLink(v), null, true); else { board.tray.unshift(card('note', { text: v })); renderTray(); save(); } $('tray').classList.remove('closed'); } capture(false); };

  // ---------- focus mode ----------
  function setFocus(on) {
    focusSet = on && sel.size ? new Set(sel) : null;
    if (focusSet) board.links.forEach(l => { if (focusSet.has(l.a)) focusSet.add(l.b); if (focusSet.has(l.b)) focusSet.add(l.a); });
    board.cards.forEach(c => cardsEl.querySelector(`[data-id="${c.id}"]`)?.classList.toggle('dim', !!focusSet && !focusSet.has(c.id)));
    if (focusSet) { fit(board.cards.filter(c => focusSet.has(c.id)), 160); say('Focus mode: just these. Press Esc when you want everything back.'); }
  }

  // ---------- your toolbar: pick which tools show at the bottom and in what order (shortcuts keep working for hidden ones) ----------
  const TB_DEFAULT = [...$('tools').querySelectorAll(':scope > [data-add]')].map(b => b.dataset.add);
  const tbName = b => (b.dataset.tip || b.getAttribute('aria-label') || '').split('·')[0].trim();
  function applyToolbar() {
    const box = $('tools'), cfg = settings.toolbar || {}, hidden = new Set(cfg.hidden || []);
    const order = (cfg.order || []).filter(k => TB_DEFAULT.includes(k)); TB_DEFAULT.forEach((k, i) => { if (!order.includes(k)) order.splice(Math.min(i, order.length), 0, k); });   // tools added in a later version slot in where they belong
    const end = $('zoom'); order.forEach(k => { const b = box.querySelector(`:scope > [data-add="${k}"]`); if (b) { box.insertBefore(b, end); b.hidden = hidden.has(k); } });
    document.body.dataset.tb = settings.tbSize || 'm'; requestAnimationFrame(fitToolbar);
    return order;
  }
  // Settings → Toolbar: the tool list (switches + drag to reorder) and the icon size
  function renderTbList() {
    const L = $('setTbList'); if (!L) return; const order = applyToolbar(), hidden = new Set((settings.toolbar || {}).hidden || []);
    L.innerHTML = order.map(k => { const b = $('tools').querySelector(`:scope > [data-add="${k}"]`); if (!b) return '';
      return `<div class="tbe-row${hidden.has(k) ? ' off' : ''}" draggable="true" data-tb="${k}"><span class="tbe-grip">⋮⋮</span><span class="tbe-ic">${b.querySelector('svg')?.outerHTML || ''}</span><span class="tbe-name">${esc(tbName(b))}</span><input type="checkbox" class="tgl" ${hidden.has(k) ? '' : 'checked'} aria-label="Show ${esc(tbName(b))}"></div>`; }).join('');
  }
  (() => { const L = $('setTbList'); if (!L) return;
    const now = () => ({ order: [...L.querySelectorAll('.tbe-row')].map(r => r.dataset.tb), hidden: [...L.querySelectorAll('.tbe-row')].filter(r => !r.querySelector('input').checked).map(r => r.dataset.tb) });
    const commit = () => { settings.toolbar = now(); applySettings(); };
    L.onchange = e => { if (e.target.matches('input')) { e.target.closest('.tbe-row').classList.toggle('off', !e.target.checked); commit(); } };
    let dragging = null;
    L.ondragstart = e => { dragging = e.target.closest('.tbe-row'); if (!dragging) return; dragging.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging.dataset.tb); };
    L.ondragover = e => { if (!dragging) return; e.preventDefault(); const r = e.target.closest('.tbe-row'); if (!r || r === dragging) return; const box = r.getBoundingClientRect(); L.insertBefore(dragging, e.clientY < box.top + box.height / 2 ? r : r.nextSibling); };
    L.ondragend = () => { if (!dragging) return; dragging.classList.remove('drag'); dragging = null; commit(); };
    $('tbReset').onclick = () => { delete settings.toolbar; settings.tbSize = 'm'; applySettings(); renderTbList(); };
  })();
  const openToolbarSettings = () => { $('gearBtn').click(); setTab('toolbar'); renderTbList(); };
  $('tools').addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); boardMenu(e, [{ label: 'Customize toolbar…', run: openToolbarSettings }]); });

  // tools that don't fit the screen tuck into ··· at the end (never a toolbar wider than the window)
  function fitToolbar() {
    const box = $('tools'), more = $('tbMore'), dock = $('dock'); if (!box || !more) return;
    box.querySelectorAll(':scope > .tb-over').forEach(b => b.classList.remove('tb-over')); more.hidden = true;
    const m = $('mochi'), others = m && m.offsetWidth && getComputedStyle(m).position !== 'absolute' ? m.offsetWidth + 10 : 0;   // only Mochi's pill shares the row
    const room = innerWidth - 32 - others;
    if (box.offsetWidth <= room) return;
    more.hidden = false; const shown = [...box.querySelectorAll(':scope > [data-add]')].filter(b => !b.hidden);
    for (let i = shown.length - 1; i > 0 && box.offsetWidth > room; i--) shown[i].classList.add('tb-over');
  }
  const tbRect = b => (b.classList.contains('tb-over') ? $('tbMore') : b).getBoundingClientRect();   // pickers that open from a tool open from ··· when the tool is tucked away
  $('tbMore').onclick = e => { e.stopPropagation(); const r = $('tbMore').getBoundingClientRect(), over = [...$('tools').querySelectorAll(':scope > .tb-over')];
    boardMenu({ clientX: r.left, clientY: r.top - 8 - over.length * 36 }, [...over.map(b => ({ label: `<span class="tbm-row">${b.querySelector('svg')?.outerHTML || ''}<span>${esc(tbName(b))}</span></span>`, run: () => b.click() })), '-', { label: 'Customize toolbar…', run: openToolbarSettings }]);
    $('rowMenu')?.classList.add('tb-menu'); };
  addEventListener('resize', () => requestAnimationFrame(fitToolbar));

  // ---------- just the board: every panel tucks away (⌘\, like Figma), and comes back with ⌘\ or Esc ----------
  const CLEAN_EL = ['side', 'tray', 'dock', 'keys', 'design'].map(id => $(id)).concat([document.querySelector('.top')]).filter(Boolean);
  function setClean(on) {
    if (on === document.body.classList.contains('clean') || (on && document.body.classList.contains('phone'))) return;
    const fade = (from, to) => CLEAN_EL.forEach(el => el.animate?.([{ opacity: from }, { opacity: to }], { duration: 220, easing: 'ease' }));
    if (on) { closeColor(); mochiOpen(false); fade(1, 0); setTimeout(() => document.body.classList.add('clean'), 200); }
    else { document.body.classList.remove('clean'); fade(0, 1); }
  }
  $('cleanBtn').onclick = () => setClean(true);
  $('cleanBack').onclick = () => setClean(false);
  ['pointerdown', 'mousedown', 'dblclick'].forEach(t => $('cleanBack').addEventListener(t, e => e.stopPropagation()));   // the board mustn't grab presses on the pill

  addEventListener('keydown', e => {
    const typing = e.target.closest('input, textarea, [contenteditable="true"]');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); capture(true); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === '\\' || e.code === 'Backslash') && !homeAt && !docCard) { e.preventDefault(); setClean(!document.body.classList.contains('clean')); return; }
    if (e.key === 'Escape' && document.body.classList.contains('clean') && !editing && !drawOn) { setClean(false); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input, textarea, [contenteditable="true"]') && !homeAt) { e.preventDefault(); travel(e.shiftKey ? 1 : -1); return; }   // inside text, ⌘Z undoes typing as usual
    if (vec && !e.metaKey && !e.ctrlKey && !document.activeElement?.closest?.('input, textarea')) {   // editing points
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); endVec(); return; }
      if ((e.key === 'Backspace' || e.key === 'Delete') && vec.sel.size) { e.preventDefault(); e.stopImmediatePropagation(); const c = vecCard(); if (c.pts.length - vec.sel.size >= 2) { remember(); c.pts = c.pts.filter((_, i) => !vec.sel.has(i)); if (c.pts.length < 3) c.closed = undefined; vec.sel.clear(); refit(c); renderCard(c); drawVec(); save(); } return; } }
    if (penT && !editing && !e.metaKey && !e.ctrlKey) {   // the Pen: Enter or Esc finishes, Backspace takes back the last point
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); endPen(true); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopImmediatePropagation(); penT.pts.pop(); drawPen(); return; } }
    if (e.key === 'Escape' && homeAt) { closeHome(); return; }
    if (e.key === 'Enter' && $('coach').classList.contains('on') && !editing && !document.activeElement?.closest?.('input, textarea, [contenteditable="true"]') && !$('capture').classList.contains('on')) { e.preventDefault(); $('coachNext').click(); return; }
    if (e.key === 'Escape' && $('coach').classList.contains('on') && !editing && !document.activeElement?.closest?.('input, textarea, [contenteditable="true"]') && !$('capture').classList.contains('on')) { endTour(); return; }
    if ($('onboard').classList.contains('on')) return obKeys(e);   // setup has its own keys
    if (e.key === 'Escape' && $('settings').classList.contains('on')) { closeSettings(); return; }
    if (e.key === 'Escape' && cropping) { endCrop('cancel'); return; }
    if (e.key === 'Enter' && cropping && !e.target.closest('input, textarea, [contenteditable="true"]')) { endCrop('done'); return; }
    if (e.key === 'Escape' && drawOn) { exitDraw(); return; }
    if (e.key === 'Escape' && docCard) { closeDoc(); return; }
    if (e.key === 'Escape' && (placing || $('shapePick').classList.contains('on') || $('tplPick').classList.contains('on') || $('stampWheel').classList.contains('on') || $('stampPick').classList.contains('on'))) { stopPlacing(); return; }
    if (e.key === 'Escape' && selWires.size) { selectWire(null); return; }
    if (e.key === 'Escape') { closeColor(); capture(false); endEdit(); setFocus(false); selectOnly([]); mochiOpen(false); document.activeElement.blur(); return; }
    if (typing || homeAt || $('capture').classList.contains('on')) return;   // never fire board shortcuts while quick capture is open
    if (e.key === ' ') { space = true; stage.classList.add('space'); e.preventDefault(); }
    if ((e.key === 'Backspace' || e.key === 'Delete') && selWires.size) { remember(); board.links = board.links.filter(l => !selWires.has(l.id)); selWire = null; selWires.clear(); renderWires(); save(); return; }
    if ((e.key === 'Backspace' || e.key === 'Delete') && sel.size) removeSelected();
    if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyG' && sel.size) { e.preventDefault(); makeSection(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && sel.size) { e.preventDefault(); groupSel(!e.shiftKey); return; }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && ['=', '+', '-', '_', '0'].includes(e.key)) { e.preventDefault(); return e.key === '0' ? zoomTo(1) : zoomStep(e.key === '=' || e.key === '+' ? 1 : -1); }
    if (e.shiftKey && !e.metaKey && !e.ctrlKey && e.code === 'Digit1') { e.preventDefault(); return zoomFit(); }
    if ((e.metaKey || e.ctrlKey) && (e.code === 'BracketRight' || e.code === 'BracketLeft') && sel.size) { e.preventDefault(); restack(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward')); return; }
    if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase()) && sel.size) { e.preventDefault(); $('selbar').querySelector(`[data-ts="${{ b: 'bold', i: 'italic', u: 'under' }[e.key.toLowerCase()]}"]`)?.click(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectOnly(board.cards.map(c => c.id)); }
    if ((e.metaKey || e.ctrlKey) && ['c', 'x'].includes(e.key.toLowerCase()) && sel.size && !homeAt) { const r = copyCards(); if (r) { navigator.clipboard?.writeText(r.text).catch(() => {}); if (e.key.toLowerCase() === 'x') { e.preventDefault(); removeSelected(); } } return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && !homeAt) { pendingPaste = true; setTimeout(() => { if (pendingPaste && lastClip) pasteCards(); pendingPaste = false; }, 150); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && sel.size) { e.preventDefault(); remember(); const gm = {}, copies = withMaskGroups([...sel].map(byId).filter(Boolean)).map(c => Object.assign(JSON.parse(JSON.stringify(c)), { id: uid(), r: tilt() })); copies.forEach(c => { if (c.group) c.group = gm[c.group] || (gm[c.group] = uid()); }); copies.forEach(c => { c.x += 30; c.y += 30; addCard(c); }); selectOnly(copies.map(c => c.id)); }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f') setFocus(!focusSet);
    if (k === 'n') startPlacing('note');
    if (k === 't') startPlacing('title');
    if (k === 'c') startPlacing('todo');
    if (k === 'b') startPlacing('table');
    if (k === 'g') startPlacing('coll');
    if (k === 'r') pickWF('box');
    if (k === 'x') pickWF('text');
    if (k === 'd') startPlacing('doc');
    if (k === 's') $('tools').querySelector('[data-add="shape"]').click();
    if (k === 'e') $('tools').querySelector('[data-add="stamp"]').click();
    if (k === 'l') startPlacing('link');
    if (k === 'p' && e.shiftKey) { penT ? endPen(true) : startPen(); return; }
    if (k === 'p') drawOn ? exitDraw() : enterDraw();
    if (k === 'a') readyToRecord().then(ok => ok && startPlacing('audio'));
    if (k === 'v') { if (e.shiftKey) startPlacing('video'); else toPointer(); }
    if (k === 'i') $('filePick').click();
    if (k === '0') fit(board.cards);
    if (k === 'm') { e.preventDefault(); mochiOpen(true); }
  });
  addEventListener('keyup', e => { if (e.key === ' ') { space = false; stage.classList.remove('space'); } });
  // links get a little paste box under the toolbar (the app can't show the browser's prompt)
  function addLinkPrompt() { $('linkbox').classList.add('on'); $('linkInput').value = ''; setTimeout(() => $('linkInput').focus(), 30); }
  const closeLink = () => $('linkbox').classList.remove('on');
  $('linkbox').onsubmit = e => { e.preventDefault(); const u = $('linkInput').value.trim(); closeLink(); if (u) linkCard(/^https?:/i.test(u) ? u : 'https://' + u, centerWorld()); };
  $('linkInput').onkeydown = e => { if (e.key === 'Escape') { closeLink(); e.stopPropagation(); } };
  addEventListener('pointerdown', e => { if ($('linkbox').classList.contains('on') && !e.target.closest('.linkbox, [data-add="link"]')) closeLink(); }, true);

  // ---------- toolbar ----------
  // the select arrow: puts down whatever tool you're holding (placing, drawing, the pen, a picker) so you're just selecting and moving. It lights up whenever no other tool is on
  function toPointer() { if (penT) endPen(true); stopPlacing(); if (drawOn) exitDraw(); ['shapePick', 'tplPick', 'stampWheel', 'stampPick'].forEach(id => $(id)?.classList.remove('on')); syncPointer(); }
  function syncPointer() { const p = $('tools').querySelector('[data-add="pointer"]'); if (!p) return;
    const busy = drawOn || placing || penT || $('tools').querySelector('[data-add]:not([data-add="pointer"]).on') || ['shapePick', 'tplPick', 'stampWheel', 'stampPick'].some(id => $(id)?.classList.contains('on'));
    p.classList.toggle('on', !busy); }
  { const mo = new MutationObserver(() => syncPointer()); mo.observe($('tools'), { subtree: true, attributes: true, attributeFilter: ['class'] }); mo.observe($('dock'), { attributes: true, attributeFilter: ['class'] });
    ['shapePick', 'tplPick', 'stampWheel', 'stampPick'].forEach(id => $(id) && mo.observe($(id), { attributes: true, attributeFilter: ['class'] })); }
  $('tools').onclick = e => { const b = e.target.closest('[data-add]'); if (!b) return; const t = b.dataset.add;
    if (t === 'pointer') return toPointer();
    if (t === 'pen') return penT ? endPen(true) : startPen();
    if (penT) endPen(true);   // picking another tool finishes the pen line
    if (t === 'image') return $('filePick').click();
    if (t === 'draw') return drawOn ? exitDraw() : enterDraw();
    if (t === 'stamp') { const on = !$('stampWheel').classList.contains('on'); stopPlacing(); const r = tbRect(b), sr = stage.getBoundingClientRect(); ['stampWheel', 'stampPick'].forEach(id => $(id).style.left = (r.left + r.width / 2 - sr.left) + 'px'); renderWheel(); $('stampWheel').classList.toggle('on', on); b.classList.toggle('on', on); $('mBubble').classList.remove('on'); return; }
    if (t === 'shape') { const on = !$('shapePick').classList.contains('on'); stopPlacing(); const r = tbRect(b), sr = stage.getBoundingClientRect(); $('shapePick').style.left = (r.left + r.width / 2 - sr.left) + 'px'; $('shapePick').classList.toggle('on', on); b.classList.toggle('on', on); $('mBubble').classList.remove('on'); return; }
    if (t === 'tpl') { const on = !$('tplPick').classList.contains('on'); stopPlacing(); const r = tbRect(b), sr = stage.getBoundingClientRect(); $('tplPick').style.left = (r.left + r.width / 2 - sr.left) + 'px'; $('tplPick').classList.toggle('on', on); b.classList.toggle('on', on); $('mBubble').classList.remove('on'); return; }
    if (t === 'audio') return readyToRecord().then(ok => ok && startPlacing('audio'));
    startPlacing(t); };
  $('filePick').onchange = e => { const fs = [...e.target.files], tgt = $('filePick').dataset.into; delete $('filePick').dataset.into; e.target.value = '';
    const c = tgt && byId(tgt), v = fs.find(f => f.type.startsWith('video/'));
    if (c && v) return fillVideo(c, v); addImages(fs); };
  $('boardName').oninput = e => { board.name = e.target.value || 'Untitled board'; save(); };
  // + Board / + Folder add into wherever you are: the folder you're in, or the project you're in
  function scope() {
    const f = homeAt ? (homeAt.level === 'folder' ? folders.find(x => x.id === homeAt.id) : null) : folders.find(x => x.id === board?.folder);
    const p = homeAt?.level === 'project' ? projects.find(x => x.id === homeAt.id) : homeAt?.level === 'all' ? null : f && projects.find(x => x.id === f.project);
    return { f, p };
  }
  $('newBoard').onclick = async () => { const { f, p } = scope(), into = f || (p && foldersIn(p.id)[0]); if (into) return newBoardIn(into.id); const b = newBoard(); await MB.save(b); closeHome(); openBoard(b.id); };
  $('newFolder').onclick = async () => { const f = makeFolder(uniqueName(folders, 'New folder'), scope().p?.id || null); await saveLib(); await refreshBoards(); renameNewest('.node.folder', f); };
  $('newProject').onclick = async () => { const p = makeProject(uniqueName(projects, 'New project')); await saveLib(); await refreshBoards(); renameNewest('.node.project', p); };

  // ---------- copy, cut and paste cards: works across boards (the clip lives in Mochiboard, plus their words go to the Mac clipboard) ----------
  const CLIP = 'mochiboard:clip';
  let lastClip = null, pendingPaste = false, pasteN = 0;
  try { lastClip = JSON.parse(localStorage.getItem(CLIP) || 'null'); } catch (e) {}
  function copyCards() {
    const ids = new Set();
    const take = c => { if (!c || ids.has(c.id)) return; ids.add(c.id);
      if (c.type === 'coll') (c.kids || []).forEach(k => take(byId(k)));
      if (c.type === 'frame') onFrame(c).forEach(take);
      if (c.group) board.cards.filter(x => x.group === c.group).forEach(take); };
    selCards().forEach(take); if (!ids.size) return null;
    const cards = board.cards.filter(c => ids.has(c.id)).map(c => JSON.parse(JSON.stringify(c)));
    const links = board.links.filter(l => ids.has(l.a) && ids.has(l.b)).map(l => ({ ...l }));
    const text = cards.map(c => c.text || c.title || c.name || c.label || '').filter(Boolean).join('\n') || `${cards.length} Mochiboard card${cards.length > 1 ? 's' : ''}`;
    lastClip = { cards, links, from: board.id, text }; pasteN = 0;
    try { localStorage.setItem(CLIP, JSON.stringify(lastClip)); } catch (e) {}   // big pictures may not fit; the copy still works while the app is open
    return lastClip;
  }
  // a fresh copy of a card, pointing at the copies of whatever it holds (collection cards, frame contents, its group)
  function copyOf(c, map, gmap) {
    const n = JSON.parse(JSON.stringify(c)); n.id = map[c.id];
    if (n.kids) n.kids = n.kids.map(k => map[k]).filter(Boolean);
    if (n.colOf) n.colOf = Object.fromEntries(Object.entries(n.colOf).filter(([k]) => map[k]).map(([k, v]) => [map[k], v]));
    if (n.onFrame) { if (map[n.onFrame]) n.onFrame = map[n.onFrame]; else delete n.onFrame; }
    if (n.group) n.group = gmap[n.group] || (gmap[n.group] = uid());
    return n;
  }
  // Option-drag (Alt on Windows): the originals stay put and a copy comes along with the cursor, like in Figma
  function cloneForDrag() {
    const src = drag.start.map(s => s.c), map = {}, gmap = {}; src.forEach(c => map[c.id] = uid());
    const fresh = src.map(c => copyOf(c, map, gmap)), links = board.links.filter(l => map[l.a] && map[l.b]);
    board.cards.push(...fresh); fresh.forEach(c => renderCard(c, true));
    links.forEach(l => board.links.push({ ...l, id: uid(), a: map[l.a], b: map[l.b] }));
    layoutAll(); renderWires();
    selectOnly([...sel].map(i => map[i]).filter(Boolean));
    drag.start = fresh.map(c => ({ c, x: c.x, y: c.y })); drag.cloned = true; stage.classList.add('cloning');
  }
  function pasteCards() {
    const c0 = lastClip; if (!c0?.cards?.length || !board) return;
    remember();
    const map = {}, gmap = {}; c0.cards.forEach(c => map[c.id] = uid());
    const x0 = Math.min(...c0.cards.map(c => c.x)), y0 = Math.min(...c0.cards.map(c => c.y)), x1 = Math.max(...c0.cards.map(c => c.x + c.w)), y1 = Math.max(...c0.cards.map(c => c.y + c.h));
    let dx, dy;
    if (c0.from === board.id) { pasteN++; dx = dy = 30 * pasteN; }                    // same board: a little down and right of the original
    else { const ctr = centerWorld(); dx = ctr.x - (x0 + x1) / 2; dy = ctr.y - (y0 + y1) / 2; }   // another board: right in the middle of the view
    const fresh = c0.cards.map(c => { const n = copyOf(c, map, gmap); n.x += dx; n.y += dy; return n; });
    board.cards.push(...fresh); fresh.forEach(c => renderCard(c, true));   // all in first, so collections find the cards that belong in them
    (c0.links || []).forEach(l => board.links.push({ ...l, id: uid(), a: map[l.a], b: map[l.b] }));
    layoutAll(); renderWires(); save();
    const inside = new Set(fresh.flatMap(c => c.kids || []));
    const freshIds = new Set(fresh.map(c => c.id));
    selectOnly(fresh.filter(c => !inside.has(c.id) && !(c.onFrame && freshIds.has(c.onFrame))).map(c => c.id));   // select the tops, not every card inside them
    if (c0.from !== board.id) chirp(`Pasted ${fresh.length} card${fresh.length > 1 ? 's' : ''} ✦`, 2200);
  }
  addEventListener('copy', e => { if (e.target.closest?.('input, textarea, [contenteditable="true"]') || !sel.size || homeAt) return;
    const r = copyCards(); if (!r) return; e.preventDefault(); e.clipboardData.setData('text/plain', r.text); e.clipboardData.setData('text/x-mochiboard', '1'); });
  addEventListener('cut', e => { if (e.target.closest?.('input, textarea, [contenteditable="true"]') || !sel.size || homeAt) return;
    const r = copyCards(); if (!r) return; e.preventDefault(); e.clipboardData.setData('text/plain', r.text); e.clipboardData.setData('text/x-mochiboard', '1'); removeSelected(); });

  // ---------- paste and drop ----------
  addEventListener('paste', e => {
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    pendingPaste = false;
    // cards copied in Mochiboard (on this board or another one) come back as cards
    const tx = e.clipboardData.getData('text/plain');
    if (lastClip && !e.clipboardData.files?.length && (e.clipboardData.getData('text/x-mochiboard') || tx === lastClip.text)) { e.preventDefault(); return pasteCards(); }
    const files = [...(e.clipboardData.files || [])]; const intoTray = $('capture').classList.contains('on');
    if (files.length) { e.preventDefault(); addImages(files, null, intoTray); capture(false); return; }
    const t = e.clipboardData.getData('text/plain').trim(), rows = tableFrom(t, e.clipboardData.getData('text/html'));
    if (rows) { e.preventDefault(); if (intoTray) capture(false); addTable(rows); return chirp(`Made a table: ${rows.length} rows, ${rows[0].length} columns ✦`, 3000); }
    if (!t) return; e.preventDefault();
    if (asLink(t) || spotifyOf(t)) linkCard(asLink(t) || t, centerWorld()); else addAtCenter('note', { text: t, color: 'butter' });
  });
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => { e.preventDefault(); const files = [...e.dataTransfer.files], w = toWorld(e.clientX, e.clientY);
    const bid = e.dataTransfer.getData('mb/board'); if (bid && board) return nestBoard(bid, board.id, { x: w.x - 130, y: w.y - 90 }).then(ok => ok && refreshBoards());
    const cf = e.dataTransfer.getData('mb/cfolder'); if (cf && board) { const f = connected.find(x => x.id === cf); if (f) putFolderCard(f, w); return; }
    if (files.length) { const media = files.filter(f => /^(image|video)\//.test(f.type)), other = files.filter(f => !media.includes(f)); if (media.length) addImages(media, w, overTray(e)); if (other.length) dropFiles(other, w); window.__dropPaths = null; return; }
    const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'); if (/^https?:/.test(u)) linkCard(u.trim(), w); });

  // ---------- Mochi on the board ----------
  // her hop: she jumps right up out of her pill, then squishes a little as she lands
  function hopMochi() { goo.hop(); favGoo?.hop(); const c = $('goo'); c.classList.remove('hopping'); void c.offsetWidth; c.classList.add('hopping'); }
  // in a browser, the tab's icon is a tiny Mochi who breathes, blinks and hops along with the real one
  const favGoo = MB.native ? null : (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const fg = Goo(c, { manual: true, outfit: 'wear' });
    let link = document.querySelector('link[rel="icon"]'); if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    setInterval(() => { fg.draw(); link.href = c.toDataURL('image/png'); }, 120); return fg; })();
  const goo = Goo($('goo'), { headroom: 8 }), duGoo = Goo($('duGoo')), SMALL = { outfit: 'wear', headroom: 8 };   // small Mochis get room above for hats, and skip what she's holding so she stays big enough to see
  const goos = [goo, duGoo, ...(favGoo ? [favGoo] : []), Goo($('brandGoo'), SMALL), Goo($('aboutGoo'), SMALL), Goo($('chatGoo'), SMALL), Goo($('obGoo'), { headroom: 8 }), Goo($('obGoo2'), { headroom: 8 }), Goo($('coachGoo'), SMALL), Goo($('setGoo'), SMALL)];

  // ---------- settings: Mochi's color and greeting, her helpers, how the board looks ----------
  const MOCHI_COLORS = { blue: { B: '#33c7ff', S: '#ccf5ff', D: '#1480db' }, pink: { B: '#ff8fc2', S: '#ffe0ee', D: '#e0559a' }, mint: { B: '#5fdba0', S: '#d9fbe9', D: '#2fae73' },
    lilac: { B: '#b49bff', S: '#ece5ff', D: '#7e5ee6' }, butter: { B: '#ffd54f', S: '#fff4c4', D: '#e0a800' }, peach: { B: '#ffa978', S: '#ffe6d6', D: '#e57841' }, night: { B: '#4a4f7a', S: '#8d93c9', D: '#2b2e4f' } };
  const settings = Object.assign({ pullColors: true, imgRadius: true, panelH: {}, mochiName: '', mochiCalm: 'lively', mochiChar: true, tbSize: 'm', dblNote: true, wLayers: true, wColors: true, wDressup: false, wMusic: false,   /* the playful widgets wait until someone switches them on */ wDesign: true, wTray: true, autoLink: true, imgFrame: true, wLearn: true, ports: true, hints: true,  mochi: 'blue', greet: true, grid: true, tilt: true, motion: true, keys: true, theme: 'system', chat: 'normal', emoji: true, noteColor: 'random', snap: false, ai: true, mobbin: true, higgs: true, mochiFiles: true, chatKeep: 'board', chatMax: '60', cursor: '#ff9ec4', fancyCursor: true, colors: { light: {}, dark: {} } }, (() => { try { return JSON.parse(localStorage.getItem('mochiboard:settings') || '{}'); } catch (e) { return {}; } })());
  try { if (localStorage.getItem('mochiboard:keys') === 'hide') settings.keys = false; } catch (e) {}
  // ---------- widgets snap into the left and right sidebars. Drag one by its title: little drop boxes show where it can go ----------
  // the Boards panel is pinned at the top left (it's home to your boards and Settings), everything else can move
  const WG_DEFAULT = { left: ['layers', 'colors', 'music'], right: ['design', 'tray', 'dressup'] };
  const WG_ALL = ['layers', 'colors', 'music', 'dressup', 'design', 'tray'];
  const wgEl = k => k === 'design' ? $('design') : k === 'tray' ? $('tray') : document.querySelector(`.box[data-box="${k}"]`);
  const wgKey = el => el.id === 'design' ? 'design' : el.id === 'tray' ? 'tray' : el.dataset.box;
  function wgLayout() {   // the saved layout, with anything missing (a new widget) added where it belongs by default
    const L = settings.layout || WG_DEFAULT, seen = new Set(), clean = side => (L[side] || []).filter(k => WG_ALL.includes(k) && !seen.has(k) && seen.add(k));
    const out = { left: clean('left'), right: clean('right') };
    WG_ALL.forEach(k => { if (!seen.has(k)) (WG_DEFAULT.left.includes(k) ? out.left : out.right).push(k); });
    return out;
  }
  let wgLast = '', wgJustDragged = false;
  function applyLayout() {
    const L = wgLayout(), key = JSON.stringify(L); if (key === wgLast) return; wgLast = key;
    const put = (col, keys) => keys.forEach(k => { const el = wgEl(k); if (el && !el.classList.contains('in-sheet')) col.appendChild(el); });   // a widget showing in a phone sheet goes home when the sheet closes
    put($('side'), L.left); put($('sideR'), L.right);
  }
  function wgDragStart(e, el) {
    // the widget itself lifts off the sidebar and follows the cursor, so you can see what you're holding
    const r0 = el.getBoundingClientRect(), gx = e.clientX - r0.left, gy = e.clientY - r0.top;
    Object.assign(el.style, { position: 'fixed', left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', maxHeight: Math.min(r0.height, 320) + 'px', overflow: 'hidden', zIndex: 400, pointerEvents: 'none', margin: 0 });
    const home = [el.parentNode, el.nextSibling]; document.body.appendChild(el);   // carried above both sidebars, not inside one
    el.classList.add('wg-lifted'); document.body.classList.add('wg-arranging');
    const slots = [];
    [[$('side'), true], [$('sideR'), false]].forEach(([col, pinned]) => {
      const kids = [...col.children].filter(c => !c.classList.contains('wg-off'));
      kids.forEach((c, i) => { if (pinned && i === 0) return; const s = document.createElement('div'); s.className = 'wg-slot'; col.insertBefore(s, c); slots.push(s); });
      const s = document.createElement('div'); s.className = 'wg-slot'; col.appendChild(s); slots.push(s);
    });
    let pick = null;
    const move = ev => {
      el.style.left = ev.clientX - gx + 'px'; el.style.top = ev.clientY - gy + 'px';
      let best = null, bd = 1e9; slots.forEach(s => { const r = s.getBoundingClientRect(), d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)); if (d < bd) { bd = d; best = s; } });
      if (best !== pick) { pick?.classList.remove('on'); pick = best; pick?.classList.add('on'); }
    };
    const end = (drop) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('keydown', esc, true);
      if (drop && pick) pick.parentNode.insertBefore(el, pick); else home[0].insertBefore(el, home[1]?.parentNode === home[0] ? home[1] : null);
      slots.forEach(s => s.remove()); ['position', 'left', 'top', 'width', 'maxHeight', 'overflow', 'zIndex', 'pointerEvents', 'margin'].forEach(k => el.style[k] = ''); el.classList.remove('wg-lifted'); document.body.classList.remove('wg-arranging');
      wgJustDragged = true; setTimeout(() => wgJustDragged = false, 50);
      if (drop && pick) { const keys = col => [...col.children].map(wgKey).filter(k => WG_ALL.includes(k));
        settings.layout = { left: keys($('side')), right: keys($('sideR')) }; wgLast = JSON.stringify(wgLayout()); applySettings(); placeTray(); }
    };
    const up = () => end(true), esc = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); end(false); } };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('keydown', esc, true); move(e);
  }
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.side .box > header, .side #design .dz-head, .side #tray .tray-head'); if (!h || e.button !== 0 || e.pointerType === 'touch' || e.target.closest('button, input, .brand')) return;
    const el = h.parentElement; if (el.dataset.box === 'boards') return;
    const x0 = e.clientX, y0 = e.clientY;
    const go = ev => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return; stop(); wgDragStart(ev, el); };
    const stop = () => { removeEventListener('pointermove', go); removeEventListener('pointerup', stop); };
    addEventListener('pointermove', go); addEventListener('pointerup', stop);
  }, true);   // listen first: some widgets (Wireframe) keep their clicks to themselves
  const WIDGETS = [['wLayers', () => document.querySelector('.box[data-box="layers"]')], ['wColors', () => document.querySelector('.box[data-box="colors"]')],
    ['wLearn', () => document.querySelector('.box[data-box="learn"]')], ['wDressup', () => document.querySelector('.box[data-box="dressup"]')], ['wMusic', () => document.querySelector('.box[data-box="music"]')], ['wDesign', () => $('design')], ['wTray', () => $('tray')]];
  function applySettings() {
    if ($('dzTabs')) renderDzTabs();
    document.body.classList.toggle('no-pull', settings.pullColors === false); queueMicrotask(() => applyColors()); queueMicrotask(() => applyGridShape()); queueMicrotask(() => applyToolbar());
    goos.forEach(g => g.setColors(MOCHI_COLORS[settings.mochi] || MOCHI_COLORS.blue));
    window.MochiOutfit = settings.outfit || {}; queueMicrotask(() => renderDressup());
    // widgets: the panels people can turn off (the Boards panel always stays: it holds their boards and Settings)
    WIDGETS.forEach(([k, el]) => el()?.classList.toggle('wg-off', settings[k] === false));
    [['layers', 'wLayers'], ['tray', 'wTray']].forEach(([sh, k]) => document.querySelector(`#hub [data-sheet="${sh}"]`)?.classList.toggle('wg-off', settings[k] === false));
    queueMicrotask(() => { applyLayout(); placeTray(); });
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-seg]').forEach(g => g.querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', settings[g.dataset.seg] === b.dataset.v)));
    $('obNotes').innerHTML = $('noteColors').innerHTML = `<button data-nc="random" class="rand ${settings.noteColor === 'random' ? 'on' : ''}" title="A random pastel"></button>` + COLOR_NAMES.map(n => `<button data-nc="${n}" title="${n}" style="background:${COLORS[n]}" class="${settings.noteColor === n ? 'on' : ''}"></button>`).join('');
    // Mochi's name, how lively she is, and whether her character shows
    const mn = (settings.mochiName || '').trim() || 'Mochi'; window.mochiName = mn;
    [['mName'], ['mcHeadName'], ['coachName']].forEach(([id]) => { const el = $(id); if (el) el.textContent = mn; });
    ['mInput', 'mcInput'].forEach(id => { const el = $(id); if (el) el.placeholder = `Ask ${mn}… “group these by theme”`; });
    const bs = $('mBubble')?.querySelector('small'); if (bs) bs.textContent = mn.toLowerCase();
    document.querySelectorAll('[data-mname]').forEach(el => el.textContent = el.dataset.mname.replace('{name}', mn));
    if ($('mochiNameIn') && document.activeElement !== $('mochiNameIn')) $('mochiNameIn').value = settings.mochiName || '';
    window.mochiCalm = settings.mochiCalm !== 'lively'; document.body.classList.toggle('mochi-calm', window.mochiCalm); window.mochiMuted = settings.mochiCalm === 'calmest'; goos.forEach(gg => gg.draw?.()); document.body.classList.toggle('mochi-hidden', settings.mochiChar === false);
    document.body.classList.toggle('no-grid', !settings.grid); document.body.classList.toggle('neat', !settings.tilt); document.body.classList.toggle('calm', !settings.motion);
    $('keys').classList.toggle('hide', !settings.keys);
    $('obMochi').innerHTML = $('mochiColors').innerHTML = Object.entries(MOCHI_COLORS).map(([n, c]) => `<button data-mc="${n}" title="${n}" style="background:${c.B}" class="${settings.mochi === n ? 'on' : ''}"></button>`).join('');
    document.querySelectorAll('[data-set]').forEach(t => t.checked = !!settings[t.dataset.set]);
    try { localStorage.setItem('mochiboard:settings', JSON.stringify(settings)); localStorage.setItem('mochiboard:keys', settings.keys ? 'show' : 'hide'); } catch (e) {}
  }
  // ---------- your cursor: the same little pointer and name bubble as jessa.art, in your color ----------
  // It follows the mouse; over a card it turns into an open hand, and a fist while you drag. Text and inputs keep the Mac's own I-beam.
  const myCur = document.createElement('div'); myCur.className = 'mcur'; myCur.setAttribute('aria-hidden', 'true');
  myCur.innerHTML = `<svg class="tipv" viewBox="-1 -1 12.3 10.9"><path d="M3.4554 0.917919C4.24277 -0.305972 6.03201 -0.305974 6.81938 0.917917L9.94507 5.7765C11.0536 7.49959 9.16221 9.57694 7.34302 8.63439L6.05709 7.96814C5.48011 7.6692 4.79386 7.66921 4.21689 7.96817L2.93214 8.63388C1.11295 9.57651 -0.778528 7.49915 0.330012 5.77603L3.4554 0.917919Z"/></svg>`
    + `<svg class="grabhand open" viewBox="0 0 34 34"><g class="o"><rect x="8.5" y="15" width="19.5" height="16" rx="7"/><rect x="8" y="4.2" width="5" height="15.5" rx="2.5" transform="rotate(-8 10.5 19)"/><rect x="13.2" y="1.2" width="5" height="17.5" rx="2.5"/><rect x="18.4" y="2.2" width="5" height="16.5" rx="2.5"/><rect x="23.4" y="5.6" width="4.6" height="14" rx="2.3" transform="rotate(8 25.7 19)"/><rect x="7.6" y="15.5" width="3.8" height="9" rx="1.9" transform="rotate(-42 9.5 24)"/></g><g class="f"><rect x="8.5" y="15" width="19.5" height="16" rx="7"/><rect x="8" y="4.2" width="5" height="15.5" rx="2.5" transform="rotate(-8 10.5 19)"/><rect x="13.2" y="1.2" width="5" height="17.5" rx="2.5"/><rect x="18.4" y="2.2" width="5" height="16.5" rx="2.5"/><rect x="23.4" y="5.6" width="4.6" height="14" rx="2.3" transform="rotate(8 25.7 19)"/><rect x="7.6" y="15.5" width="3.8" height="9" rx="1.9" transform="rotate(-42 9.5 24)"/></g></svg>`
    + `<svg class="grabhand fist" viewBox="0 0 34 34"><g class="o"><rect x="7.5" y="13" width="21" height="17" rx="7.5"/><circle cx="11" cy="13.6" r="3"/><circle cx="16" cy="12.6" r="3"/><circle cx="21" cy="12.8" r="3"/><circle cx="25.4" cy="14.4" r="2.7"/><rect x="6" y="17" width="12" height="5" rx="2.5" transform="rotate(-12 12 19.5)"/></g><g class="f"><rect x="7.5" y="13" width="21" height="17" rx="7.5"/><circle cx="11" cy="13.6" r="3"/><circle cx="16" cy="12.6" r="3"/><circle cx="21" cy="12.8" r="3"/><circle cx="25.4" cy="14.4" r="2.7"/><rect x="6" y="17" width="12" height="5" rx="2.5" transform="rotate(-12 12 19.5)"/></g></svg>`
    + `<i class="ring"></i><div class="bub"></div>`;
  document.body.appendChild(myCur);
  const NATIVE = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=color]), textarea, select, [contenteditable="true"], .card.editing, .handle, #rh, .knob, .wires .w-end, .wires .w-bend, iframe, .wheel, .bright';
  function paintCursor() {
    const c = settings.cursor || '#ff9ec4', edge = mixHex(c, '#000000', lum(c) > .6 ? .28 : .38);
    myCur.style.setProperty('--c', c); myCur.style.setProperty('--cs', edge); myCur.style.setProperty('--ct', lum(c) > .4 ? '#3d3640' : '#ffffff');
    myCur.querySelector('.bub').textContent = (settings.name || 'You').slice(0, 24);
    document.body.classList.toggle('fancy-cursor', settings.fancyCursor !== false && matchMedia('(hover: hover) and (pointer: fine)').matches);
  }
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !document.body.classList.contains('fancy-cursor')) return;
    myCur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; myCur.classList.add('show');
    // at the window's edges, hand back the Mac's own cursor so its resize arrows show (and you can see where to grab)
    const edge = MB.native && (e.clientX < 8 || e.clientY < 8 || e.clientX > innerWidth - 8 || e.clientY > innerHeight - 8); document.body.classList.toggle('cur-edge', edge);
    const t = e.target, native = edge || !!(t.closest && t.closest(NATIVE));
    myCur.classList.toggle('hide', native); document.body.classList.toggle('cur-native', native);
    const onCard = !native && !placing && !drawOn && t.closest && t.closest('.card') && !t.closest('button, a, input');
    myCur.classList.toggle('grabby', !!onCard || stage.classList.contains('space') || stage.classList.contains('panning'));
  }, { passive: true, capture: true });
  addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; myCur.classList.add('down'); myCur.classList.remove('tap'); void myCur.offsetWidth; myCur.classList.add('tap'); }, true);
  addEventListener('pointerup', () => myCur.classList.remove('down'), true);
  document.addEventListener('pointerleave', () => myCur.classList.remove('show'));
  addEventListener('blur', () => myCur.classList.remove('show'));

  // ---------- your colors: the board, its dots, the panels and the accent, set per light/dark; one board can also have its own background ----------
  const COLOR_DEFAULTS = { light: { bg: '#fbf8fc', dot: '#e3dcee', panel: '#ffffff', accent: '#f27aa8' }, dark: { bg: '#1c1920', dot: '#35303c', panel: '#26222b', accent: '#f27aa8' } };
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const mixHex = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
  const modeName = () => document.body.classList.contains('dark') ? 'dark' : 'light';
  const myColors = () => { settings.colors = settings.colors || { light: {}, dark: {} }; return settings.colors[modeName()] = settings.colors[modeName()] || {}; };
  const colorOf = k => (k === 'bg' && board && board.bg) || myColors()[k] || COLOR_DEFAULTS[modeName()][k];
  function applyColors() {
    const B = document.body.style, mine = myColors(), bg = colorOf('bg'), darkBg = lum(bg) < .2;
    B.setProperty('--board', bg);
    if (mine.dot) B.setProperty('--dot', mine.dot); else if (darkBg !== (modeName() === 'dark')) B.setProperty('--dot', mixHex(bg, darkBg ? '#ffffff' : '#000000', .13)); else B.removeProperty('--dot');
    document.body.classList.toggle('tint-panels', !!mine.panel); if (mine.panel) B.setProperty('--panel', mine.panel); else B.removeProperty('--panel');
    document.body.classList.toggle('panel-dark', !!mine.panel && lum(mine.panel) < .2);
    if (mine.accent) { B.setProperty('--pink-deep', mine.accent); B.setProperty('--pink', mixHex(mine.accent, '#ffffff', .3)); B.setProperty('--blush', mixHex(mine.accent, modeName() === 'dark' ? '#1c1920' : '#ffffff', .82)); }
    else ['--pink-deep', '--pink', '--blush'].forEach(v => B.removeProperty(v));
    document.body.classList.toggle('board-dark', darkBg); document.body.classList.toggle('board-light', !darkBg && modeName() === 'dark');
    document.querySelectorAll('[data-col]').forEach(b => b.style.setProperty('--chip', b.dataset.col === 'cursor' ? settings.cursor : colorOf(b.dataset.col)));
    $('colReset') && ($('colReset').hidden = !Object.keys(mine).length);
    paintCursor();
    // settings: name, cursor colors and the little preview
    if ($('setName') && document.activeElement !== $('setName')) $('setName').value = settings.name || '';
    if ($('curColors')) $('curColors').innerHTML = PRESETS.cursor.map(h => `<button data-cc="${h}" title="${h.toUpperCase()}" style="background:${h}" class="${settings.cursor === h ? 'on' : ''}"></button>`).join('')
      + `<button class="rand${PRESETS.cursor.includes(settings.cursor) ? '' : ' on'}" data-col="cursor" title="Any color"></button>`;
    const pv = document.querySelector('#curPrev .mcur'); if (pv) { pv.innerHTML = myCur.innerHTML; pv.setAttribute('style', myCur.getAttribute('style') || ''); pv.style.transform = ''; }
  }
  $('setName').oninput = e => { settings.name = e.target.value.trim().slice(0, 24); applySettings(); };
  $('setName').onkeydown = e => e.stopPropagation();
  $('curColors').onclick = e => { const b = e.target.closest('[data-cc]'); if (b) { settings.cursor = b.dataset.cc; applySettings(); } };
  $('colReset').onclick = () => { settings.colors[modeName()] = {}; applySettings(); };
  // Settings → Camera & microphone: the same choice the little menus on video and memo cards make
  async function fillDevices() {
    let list = []; try { list = await navigator.mediaDevices.enumerateDevices(); } catch (e) {}
    const named = list.some(d => d.label);   // names only show once Mochiboard has been allowed to use them
    $('devAllow').hidden = named || !navigator.mediaDevices;
    for (const [id, kind, key, title] of [['devCam', 'videoinput', 'camId', 'Camera'], ['devMic', 'audioinput', 'micId', 'Microphone']]) {
      const sel = $(id), ds = list.filter(d => d.kind === kind && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      sel.innerHTML = `<option value="">Default ${title.toLowerCase()}</option>` + ds.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(devName(d, `${title} ${i + 1}`))}</option>`).join('');
      sel.value = ds.some(d => d.deviceId === settings[key]) ? settings[key] : ''; sel.disabled = !ds.length && named;
      sel.onchange = () => { if (sel.value) settings[key] = sel.value; else delete settings[key]; applySettings();
        if (key === 'micId' && warm) { warm.getTracks().forEach(t => t.stop()); warm = null; }
        [...cams.keys()].forEach(cid => { const c = byId(cid); camOff(cid); if (c) camOn(c); }); };
    }
  }
  $('whGo').onclick = () => setupWhisper();
  $('devAllow').onclick = async () => { try { const st = await openMedia(true); st.getTracks().forEach(t => t.stop()); } catch (e) { try { const st = await openMedia(false); st.getTracks().forEach(t => t.stop()); } catch (e2) {} } fillDevices(); };
  navigator.mediaDevices?.addEventListener?.('devicechange', () => { if ($('settings').classList.contains('on')) fillDevices(); });
  $('gearBtn').onclick = e => { e.stopPropagation(); fillDevices(); paintWhisper(); showConnections(true);   // always a fresh look at Claude's connections
    if (placing) stopPlacing(); if (sel.size) selectOnly([]); checkUpdate(); showUsage(); $('boardCount').textContent = `${boardList.length} board${boardList.length === 1 ? '' : 's'}, kept on this Mac. They never leave your computer.`; showHome(); showConnections(true); if (MB.native) loadConnected().then(renderConnected); $('settings').classList.add('on'); };
  const closeSettings = () => $('settings').classList.remove('on');
  // settings tabs: one topic at a time, so it isn't one long scroll
  function setTab(t) { $('setTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('settings').querySelectorAll('.set-body section[data-tab]').forEach(sec => sec.classList.toggle('tab-off', sec.dataset.tab !== t)); $('settings').querySelector('.set-body').scrollTop = 0; if (t === 'helpers') showUsage(); }
  // panel heights: drag the little bar at the bottom of your boards list, Layers, Wireframe or Unsorted (double-click it to go back to automatic). Layers always keeps at least one row showing
  const PANELS = { boards: () => $('boards'), layers: () => $('layers'), tray: () => $('trayList'), design: () => document.querySelector('#design .dz-body') };
  const panelMin = k => k === 'layers' ? Math.max(30, $('layers').querySelector('.ly')?.offsetHeight || 30) : k === 'boards' ? Math.max(30, $('boards').querySelector('.board-row, .folder-row, .proj-row')?.offsetHeight || 32) : k === 'tray' ? 60 : 120;
  function applyPanelH() { Object.entries(PANELS).forEach(([k, f]) => { const el = f(); if (!el) return; const v = (settings.panelH || {})[k];
    if (v) Object.assign(el.style, { height: Math.max(panelMin(k), v) + 'px', maxHeight: 'none', flex: 'none', overflowY: 'auto' }); else Object.assign(el.style, { height: '', maxHeight: '', flex: '', overflowY: '' }); }); }
  Object.entries(PANELS).forEach(([k, f]) => { const el = f(); if (!el) return; const grip = document.createElement('div'); grip.className = 'rz-grip'; grip.title = 'Drag to change the height · double-click for automatic'; grip.dataset.panel = k; el.insertAdjacentElement('afterend', grip);
    grip.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); const y0 = e.clientY, h0 = el.getBoundingClientRect().height; grip.setPointerCapture(e.pointerId); grip.classList.add('on');
      const mv = ev => { settings.panelH = { ...(settings.panelH || {}), [k]: Math.round(Math.max(panelMin(k), Math.min(innerHeight - 140, h0 + ev.clientY - y0))) }; applyPanelH(); };
      const up = () => { grip.classList.remove('on'); grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); applySettings(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); });
    grip.addEventListener('dblclick', e => { e.stopPropagation(); const p = { ...(settings.panelH || {}) }; delete p[k]; settings.panelH = p; applyPanelH(); applySettings(); }); });
  applyPanelH();
  $('mochiNameIn').oninput = e => { settings.mochiName = e.target.value.slice(0, 18); applySettings(); };
  $('mochiNameIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); };
  $('setTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { setTab(b.dataset.tab); if (b.dataset.tab === 'toolbar') renderTbList(); } };
  setTab('general');
  // Claude usage (Mac app): Mochi's own tally, plus a door to the plan limits page
  const kTok = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n));
  const usLine = u => !u || !u.asks ? 'No asks yet' : `${u.asks} ask${u.asks === 1 ? '' : 's'} · ${kTok(u.tokensIn + u.tokensOut)} tokens`;
  async function showUsage() {
    if (!MB.native) return; let u = null; try { u = await MB.usage(); } catch (e) {}
    if (!u) return; $('usToday').textContent = usLine(u.today); $('usWeek').textContent = usLine(u.week); $('usAll').textContent = usLine(u.all);
    $('usNote').textContent = (u.week.cost >= .01 ? `About $${u.week.cost.toFixed(2)} this week if you paid per request (on a Pro or Max plan you don't). ` : '') + "Just Mochi's share, counted on this Mac. Your plan's limits cover everything you do with Claude.";
  }
  $('usLimits').onclick = () => MB.openURL('https://claude.ai/settings/usage');
  $('sendFeedback').onclick = () => { closeSettings?.(); openFeedback(); };   // the same note as mochiboard.app/feedback.html, sent from right here
  $('usReset').onclick = async () => { await MB.resetUsage(); showUsage(); };

  $('setClose').onclick = closeSettings;
  $('settings').onclick = e => { if (e.target === $('settings')) closeSettings(); };
  // ---------- Dress up Mochi: hover to try things on, click to wear them. She wears it everywhere she shows up ----------
  const DU_TABS = [['hat', 'Hats'], ['face', 'Face'], ['neck', 'Neck'], ['held', 'Hold'], ['color', 'Color']];
  let duTab = 'hat';
  const duThumb = (kind, key) => {   // the piece as big as fits, whole pixels only, with a little shadow so white things show
    const c = document.createElement('canvas'), S = 72; c.width = c.height = S; const x = c.getContext('2d');
    const rows = MOCHI_WARDROBE[kind][key][3], w = Math.max(...rows.map(r => r.length)), h = rows.length, cell = Math.max(2, Math.floor(Math.min(60 / w, 54 / h)));
    const ox = Math.round((S - w * cell) / 2), oy = Math.round((S - h * cell) / 2);
    x.shadowColor = 'rgba(110, 60, 100, .22)'; x.shadowOffsetY = Math.max(1, cell / 3);
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.' && MOCHI_PAL[ch]) { x.fillStyle = MOCHI_PAL[ch]; x.fillRect(ox + xx * cell, oy + yy * cell, cell, cell); } }));
    return c;
  };
  function renderDressup() {
    const fit = settings.outfit || {};
    $('duTabs').innerHTML = DU_TABS.map(([k, l]) => `<button role="tab" data-du="${k}" class="${k === duTab ? 'on' : ''}" aria-selected="${k === duTab}">${l}</button>`).join('');
    const box = $('duItems'); box.innerHTML = '';
    if (duTab === 'color') Object.entries(MOCHI_COLORS).forEach(([k, c]) => box.insertAdjacentHTML('beforeend', `<button class="du-item du-color${settings.mochi === k ? ' on' : ''}" data-kind="color" data-key="${k}" title="${k[0].toUpperCase() + k.slice(1)}" aria-pressed="${settings.mochi === k}"><span style="background:linear-gradient(160deg, ${c.S} 0 22%, ${c.B} 22% 78%, ${c.D} 78%)"></span></button>`));
    else Object.entries(MOCHI_WARDROBE[duTab]).forEach(([k, sp]) => { const b = document.createElement('button'); b.className = 'du-item' + (fit[duTab] === k ? ' on' : ''); Object.assign(b.dataset, { kind: duTab, key: k }); b.title = sp[0]; b.setAttribute('aria-pressed', fit[duTab] === k); b.append(duThumb(duTab, k)); box.append(b); });
    $('duOff').hidden = !Object.values(fit).some(Boolean);
  }
  $('duTabs').onclick = e => { const b = e.target.closest('[data-du]'); if (b) { duTab = b.dataset.du; renderDressup(); } };
  $('duItems').addEventListener('pointerover', e => { const b = e.target.closest('.du-item'); if (!b || e.pointerType === 'touch') return;
    if (b.dataset.kind === 'color') goos.forEach(g => g.setColors(MOCHI_COLORS[b.dataset.key])); else window.MochiPreview = { [b.dataset.kind]: b.dataset.key }; });
  $('duItems').addEventListener('pointerleave', () => { window.MochiPreview = null; goos.forEach(g => g.setColors(MOCHI_COLORS[settings.mochi] || MOCHI_COLORS.blue)); });
  $('duItems').onclick = e => {
    const b = e.target.closest('.du-item'); if (!b) return; const { kind, key } = b.dataset;
    if (kind === 'color') settings.mochi = key;
    else { const fit = { ...(settings.outfit || {}) }; fit[kind] = fit[kind] === key ? null : key; settings.outfit = fit; }
    window.MochiPreview = null; applySettings(); hopMochi(); duGoo.hop();
  };
  // ---------- Mochi's music: three little lo-fi songs. Each one softens at the end, takes a breath, and starts again ----------
  // It never starts on its own. It remembers the song and volume, and keeps playing when you switch boards.
  const TRACKS = [
    { id: 'strawberry-milk-beats', name: 'Strawberry Milk Beats', vibe: 'Cozy, Mochi’s everyday groove', art: 'strawberry' },
    { id: 'cloud-desk', name: 'Cloud Desk', vibe: 'Calm, for focusing', art: 'rainbow' },
    { id: 'jelly-jog', name: 'Jelly Jog', vibe: 'Bouncy, for getting things done', art: 'cupcake' },
  ];
  const music = (() => {
    // Perfect loops: the song is loaded into memory and loops right at its last bar, no fade, no gap.
    // Volume and the tiny click-free start/stop run on the audio system's own clock, so a hidden window can't pause anything.
    // If loading ever fails, the plain player's own repeat takes over (it has a hair of a gap at the seam).
    const BAR = 3;   // 80 BPM, 4 beats: every song is a whole number of 3-second bars
    let mine = {}; try { mine = JSON.parse(localStorage.getItem('mochiboard:music') || '{}'); } catch (e) {}
    let cur = TRACKS.findIndex(t => t.id === mine.track); if (cur < 0) cur = 0;
    let vol = typeof mine.vol === 'number' ? mine.vol : .6, playing = false, ctx = null, gain = null, src = null, startedAt = 0, offset = 0, loopLen = 0, el = null, mode = '';
    const bufs = {};
    const keep = () => { try { localStorage.setItem('mochiboard:music', JSON.stringify({ track: TRACKS[cur].id, vol })); } catch (e) {} };
    const url = () => `music/${TRACKS[cur].id}.mp3`;
    const fetchBuf = id => bufs[id] || (bufs[id] = new Promise((ok, no) => {   // XHR, because the Mac app's page is a local file
      const x = new XMLHttpRequest(); x.open('GET', `music/${id}.mp3`); x.responseType = 'arraybuffer';
      x.onload = () => (x.status === 200 || x.status === 0) && x.response?.byteLength ? ok(x.response) : no(new Error('empty'));
      x.onerror = () => no(new Error('blocked')); x.send();
    }).then(ab => ctx.decodeAudioData(ab)).catch(e => { delete bufs[id]; throw e; }));
    function stopNow(soft) {
      if (src) { const s = src, t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + (soft ? .12 : .02)); s.stop(t + (soft ? .13 : .03)); src = null; }
      if (el) el.pause();
    }
    async function play(i = cur) {
      if (i !== cur) { stopNow(); cur = i; offset = 0; keep(); }
      playing = true; paint();
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (!gain) { gain = ctx.createGain(); gain.connect(ctx.destination); }
        await ctx.resume();
        const id = TRACKS[cur].id, b = await fetchBuf(id); if (!playing || TRACKS[cur].id !== id) return;
        const bars = Math.round(b.duration / BAR) * BAR; loopLen = Math.abs(bars - b.duration) < .3 && bars > 0 ? Math.min(bars, b.duration) : b.duration;
        stopNow(); src = ctx.createBufferSource(); src.buffer = b; src.loop = true; src.loopStart = 0; src.loopEnd = loopLen; src.connect(gain);
        const t = ctx.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(vol, t + .15);
        src.start(t, offset % loopLen); startedAt = t - offset % loopLen; mode = 'loop';
      } catch (e) {
        if (!playing) return;
        el = el || Object.assign(new Audio(), { loop: true }); if (!el.src.endsWith(url())) { el.src = url(); el.currentTime = 0; }
        el.volume = vol; mode = 'element'; el.play().catch(() => { playing = false; paint(); });
      }
    }
    function pause() { if (src) offset = (ctx.currentTime - startedAt) % loopLen; playing = false; stopNow(true); setTimeout(() => { if (!playing && ctx) ctx.suspend(); }, 200); paint(); }   // the audio engine sleeps while paused
    function paint() {
      const t = TRACKS[cur];
      $('muName').textContent = t.name; $('muVibe').textContent = t.vibe; $('muArt').src = `stamps/px/${t.art}.png`;
      $('muNow').dataset.track = t.id; $('muNow').classList.toggle('on', playing);
      $('muPlay').classList.toggle('on', playing); $('muPlay').setAttribute('aria-label', playing ? 'Pause' : 'Play');
      $('muList').innerHTML = TRACKS.map((x, i) => `<button class="mu-row${i === cur ? ' cur' : ''}${i === cur && playing ? ' on' : ''}" data-i="${i}" role="listitem"><img src="stamps/px/${x.art}.png" alt=""><span><b>${esc(x.name)}</b><small>${esc(x.vibe.split(',')[0])}</small></span></button>`).join('');
    }
    $('muPlay').onclick = e => { e.stopPropagation(); playing ? pause() : play(); };
    $('muVolBtn').onclick = e => { e.stopPropagation(); $('muVolPop').classList.toggle('on'); };   // the volume lives up by the minimize button
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.mu-volw')) $('muVolPop').classList.remove('on'); }, true);
    $('muList').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; if (i === cur && playing) return pause(); play(i); };
    $('muVol').value = vol; $('muVol').oninput = () => { vol = +$('muVol').value; if (gain) gain.gain.setTargetAtTime(playing ? vol : 0, ctx.currentTime, .04); if (el) el.volume = vol; keep(); };
    paint();
    return { play, pause, get playing() { return playing; }, get mode() { return mode; }, get position() { return src ? (ctx.currentTime - startedAt) % loopLen : el ? el.currentTime : 0; }, get loopLen() { return loopLen; } };
  })();

  $('wgReset').onclick = () => { settings.layout = null; applySettings(); chirp('Widgets are back where they started ✦', 2600); };
  $('duOff').onclick = () => { settings.outfit = {}; applySettings(); duGoo.hop(); };

  $('obMochi').onclick = $('mochiColors').onclick = e => { const b = e.target.closest('[data-mc]'); if (b) { settings.mochi = b.dataset.mc; applySettings(); hopMochi(); } };
  document.querySelectorAll('[data-set]').forEach(t => t.onchange = () => { settings[t.dataset.set] = t.checked; applySettings(); if (t.dataset.set === 'autoUpdate') { showUpdate.answered = true; if (t.checked && updInfo) showUpdate(); } });
  $('recheck').onclick = () => showConnections(true);
  // switching chats off (or to "until I quit") removes what's saved in the board files right away
  async function clearSavedChats() { const list = await MB.list(); for (const b of list) { const bb = b.id === board?.id ? board : await MB.load(b.id); if (bb?.chat?.length) { bb.chat = []; await MB.save(bb); } } }
  $('clearChats').onclick = async () => { await clearSavedChats(); Object.keys(sessionChats).forEach(k => delete sessionChats[k]); renderChat(); $('clearChats').textContent = 'Cleared ✓'; setTimeout(() => $('clearChats').textContent = 'Clear all chats', 1800); };
  document.querySelectorAll('[data-seg]').forEach(g => g.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; settings[g.dataset.seg] = b.dataset.v; applySettings();
    if (g.dataset.seg === 'chatKeep' && b.dataset.v !== 'board') clearSavedChats(); if (g.dataset.seg === 'chatKeep') renderChat(); });
  $('obNotes').onclick = $('noteColors').onclick = e => { const b = e.target.closest('[data-nc]'); if (b) { settings.noteColor = b.dataset.nc; applySettings(); } };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => settings.theme === 'system' && applySettings());
  const newNoteColor = () => settings.noteColor === 'random' ? COLOR_NAMES[1 + Math.floor(Math.random() * 6)] : settings.noteColor;
  let deselectAt = 0;
  const snapTo = v => settings.snap ? Math.round(v / 26) * 26 : v;
  $('revealBoards').onclick = () => MB.reveal();
  // where boards are saved: this computer's own folder, or one they pick (Dropbox, iCloud Drive) so boards follow them to another computer
  async function showHome() {
    if (!MB.native) return; let h = null; try { h = await MB.boardsHome(); } catch (e) {} if (!h) return;
    $('homeTitle').textContent = h.custom ? 'Saved in your own folder' : 'Saved on this Mac';
    if (h.custom) $('boardCount').textContent = `${h.path} · ${h.count} board${h.count === 1 ? '' : 's'}`;
    $('moveBoards').textContent = h.custom ? 'Move them…' : 'Choose a folder…';
    $('homeBackRow').hidden = !h.custom && !h.missing;
    $('homeBackSub').textContent = h.missing ? `Your boards folder (${h.missing}) isn’t here right now, so these are the boards kept on this Mac. Plug the drive in and reopen Mochiboard, or stop using that folder.` : 'Copies every board back into Mochiboard’s own folder on this Mac. The folder you picked keeps its copies';
    $('homeBack').textContent = h.missing ? 'Stop using it' : 'Bring them back';
  }
  const flushSave = async () => { if (saveT && board) { clearTimeout(saveT); saveT = 0; board.view = view; await MB.save(board); } };
  async function rehome(go) {
    await flushSave(); let h; try { h = await go(); } catch (e) { return say(e.message, 7000); } if (!h || h.cancelled) return;
    await refreshBoards(); showHome(); chirp(h.custom ? `Your boards live in ${h.path} now ✦ Every change saves there.` : 'Your boards are back in Mochiboard’s own folder ✦', 6000);
  }
  $('moveBoards').onclick = () => rehome(MB.moveBoards);
  $('homeBack').onclick = () => rehome(MB.resetBoardsHome);
  $('cfAdd').onclick = connectFolder; $('cfAll').onclick = () => { $('cfAsk').hidden = false; }; $('cfAllYes').onclick = connectAll; $('cfAllNo').onclick = () => { $('cfAsk').hidden = true; };
  let sayT = 0;
  // the little extras: skipped when she's set to Quiet
  function chirp(text, ms, acts) { if (settings.chat !== 'quiet') say(text, ms, acts); }
  function tip(text) { if (settings.chat === 'chatty') say(text, 6000); }
  function say(text, ms = 6000, acts = []) {
    if (chatOpen()) { if (text) addMsg('mochi', text, acts); return; }
    $('mSay').textContent = noOrphan(text); $('mActs').innerHTML = '';
    acts.forEach(a => { const b = document.createElement('button'); b.textContent = a.label; b.className = a.cls || (a.ghost ? 'ghost' : ''); b.onclick = () => { $('mBubble').classList.remove('on'); a.run(); }; $('mActs').appendChild(b); });
    $('mBubble').classList.add('on'); hopMochi(); clearTimeout(sayT); if (ms) sayT = setTimeout(() => $('mBubble').classList.remove('on'), ms);
  }
  // ---------- Mochi's chat window: click her to open it, click again (or Esc) to close ----------
  const chatOpen = () => $('mochi').classList.contains('chat');
  function mochiOpen(on) { $('mochi').classList.toggle('chat', on); if (on) { $('mBubble').classList.remove('on'); renderChat(); fitChat(); $('mcInput').focus(); } }
  // the chat slides left just enough to clear the right-hand panels, so the widgets stay in front, bright and clickable while Mochi is open
  function fitChat() {
    const ch = $('mChat'), sr = $('sideR'); if (!ch) return; ch.style.right = '';
    if (!chatOpen() || !sr || getComputedStyle(sr).visibility === 'hidden' || getComputedStyle(sr).opacity === '0') return;
    const a = ch.getBoundingClientRect(), b = sr.getBoundingClientRect(); if (!b.width || a.right <= b.left - 12 || a.bottom < b.top || a.top > b.bottom) return;
    const shift = Math.min(a.right - b.left + 12, Math.max(0, a.left - 12)); ch.style.right = shift + 'px';
  }
  addEventListener('resize', () => fitChat()); if ($('sideR')) new ResizeObserver(() => fitChat()).observe($('sideR'));
  $('mPill').onclick = () => mochiOpen(!chatOpen());
  $('mcClose').onclick = () => mochiOpen(false);
  $('mcNew').onclick = () => { chatLog().length = 0; if (settings.chatKeep === 'board') { board.chat = []; save(); } renderChat(); $('mcInput').focus(); };
  const IDEAS = ['Group these by theme', 'What am I missing?', 'Make a checklist from this', 'Find onboarding screens on Mobbin'];
  function msgEl(m) {
    const d = document.createElement('div'); d.className = 'mc-msg ' + m.who; d.textContent = m.text;
    if (m.acts?.length) { const box = document.createElement('div'); box.className = 'm-acts';
      m.acts.forEach(a => { const b = document.createElement('button'); b.textContent = a.label; b.className = a.cls || (a.ghost ? 'ghost' : ''); b.onclick = () => { box.remove(); a.run(); }; box.appendChild(b); }); d.appendChild(box); }
    return d;
  }
  function renderChat() {
    const list = $('mcList'); list.innerHTML = ''; const msgs = chatLog();
    if (!msgs.length) { list.innerHTML = `<div class="mc-empty"><b>Hi! I'm Mochi ✦</b>Ask me to sort, write, plan or find things for this board.<div class="mc-ideas">${IDEAS.filter(i => settings.mobbin || !/Mobbin/.test(i)).map(i => `<button>${i}</button>`).join('')}</div></div>`;
      list.querySelectorAll('.mc-ideas button').forEach(b => b.onclick = () => { ask(b.textContent); }); return; }
    msgs.forEach(m => list.appendChild(msgEl(m))); list.scrollTop = list.scrollHeight;
  }
  // where a chat lives depends on Settings: saved with the board, kept only until Mochiboard quits, or not kept at all
  const sessionChats = {};
  function chatLog() { if (!board) return []; if (settings.chatKeep === 'board') return (board.chat = board.chat || []); return (sessionChats[board.id] = sessionChats[board.id] || []); }
  const noOrphan = t => String(t ?? '').replace(/ ([✦♡★☆✧]+)$/, '\u00a0$1');
  function addMsg(who, text, acts = []) {
    if (!board) return; const log = chatLog(), m = { who, text: who === 'mochi' ? noOrphan(text) : text, t: Date.now() }, max = +settings.chatMax || 60;
    log.push(m); if (log.length > max) log.splice(0, log.length - max); if (settings.chatKeep === 'board') save();
    const list = $('mcList'); list.querySelector('.mc-empty')?.remove(); list.appendChild(msgEl({ ...m, acts })); list.scrollTop = list.scrollHeight;
  }
  function typing(on, label) { $('mcList').querySelector('.typing')?.remove(); clearTimeout(doingTimer); $('mcStatus').textContent = on ? (label || 'thinking') + '…' : '';
    if (on) { const d = document.createElement('div'); d.className = 'mc-msg mochi typing'; d.innerHTML = '<i></i><i></i><i></i><span></span>'; $('mcList').appendChild(d); $('mcList').scrollTop = 1e9; showDoing(label || 'thinking'); } }
  $('mcForm').onsubmit = e => { e.preventDefault(); const q = $('mcInput').value.trim(); if (!q) return; $('mcInput').value = ''; $('mcInput').style.height = ''; $('mcInput').placeholder = 'Ask Mochi… “group these by theme”'; ask(q); };
  $('mcInput').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('mcForm').requestSubmit(); } if (e.key === 'Escape') { mochiOpen(false); e.stopPropagation(); } };
  $('mcInput').oninput = () => { const t = $('mcInput'); t.style.height = 'auto'; t.style.height = Math.min(120, t.scrollHeight) + 'px'; };
  $('mChat').addEventListener('pointerdown', e => e.stopPropagation());
  // what Mochi sees: the cards (trimmed), where they are, what's selected, and what's in Unsorted
  function snapshot() {
    const brief = c => ({ id: c.id, type: c.type, x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.w), h: Math.round(c.h), color: c.color,
      text: (c.text || c.title || c.label || '').slice(0, 300), font: c.font, name: c.name, path: c.type === 'file' ? c.path : c.type === 'folder' ? dirOf(c) : undefined, art: c.art, onScreen: c.onFrame, kids: c.kids, desc: c.desc, body: c.body ? c.body.slice(0, 600) : undefined, shape: c.shape, tag: c.tagText, items: c.items ? c.items.map(i => i.t) : undefined, rows: c.rows ? c.rows.slice(0, 40).map(r => r.slice(0, 12).map(x => String(x || '').slice(0, 80))) : undefined, header: c.type === 'table' ? c.head !== false : undefined, hex: c.hex, url: c.url, selected: sel.has(c.id) || undefined });
    return { name: board.name, cards: board.cards.map(brief), links: board.links.map(l => [l.a, l.b]), unsorted: board.tray.map(brief), styles: { colors: board.styles.colors, text: board.styles.text.map(t => t.name) },
      fontsOnThisMac: FONTS.filter(f => !/^(\.|Apple |System|STIX|Noto Sans [A-Z][a-z]+ [A-Z])/.test(f)).slice(0, 400),
      recentChat: (settings.chatKeep === 'off' ? chatLog().slice(-2) : chatLog().slice(-8)).map(m => `${m.who === 'me' ? 'Person' : 'Mochi'}: ${m.text}`),
      mochiStyle: (settings.name ? `The person's name is ${settings.name}; use it now and then, not in every reply. ` : '') + ({ quiet: 'Keep "say" to one short sentence.', normal: 'Keep "say" short and warm.', chatty: 'Be warm, playful and encouraging in "say" (2 to 3 sentences, a little cheer is welcome).' }[settings.chat] || '') + (settings.emoji ? ' A couple of fitting emojis in "say" are welcome.' : ' Never use emojis.'),
      remembered: board.mochiNotes || [], settings: settingsCatalog(), yourFolders: connected.filter(f => !f.missing).map(f => f.name),
      library: { projects: projects.map(p => ({ name: p.name, folders: foldersIn(p.id).map(f => f.name) })), foldersNotInAProject: looseFolders().map(f => f.name), boards: boardList.map(b => ({ id: b.id, name: b.name, folder: (folders.find(f => f.id === b.folder) || {}).name || null, current: b.id === board.id || undefined })) } };
  }
  // without AI (switched off, or Claude Code not installed) Mochi still helps with the simple stuff, right here on the Mac
  function offlineMochi(q, why) {
    if (offlineRecipe(q) || learnAnswer(q)) return;   // building beats explaining: "make a sitemap" builds one, "what is a sitemap" explains it
    const notes = board.cards.filter(c => c.type === 'note' && !parentOf(c.id));
    if (/group|sort|organi[sz]e|tidy|line up/i.test(q) && notes.length) {
      const x0 = Math.min(...notes.map(c => c.x)), y0 = Math.min(...notes.map(c => c.y));
      notes.forEach((c, i) => { c.x = x0 + (i % 4) * 250; c.y = y0 + Math.floor(i / 4) * 180; c.r = tilt(); renderCard(c); }); renderWires(); save();
      return say(`I lined your ${notes.length} notes up in tidy rows ✦ ${why}`, 9000);
    }
    say(`${why} Everything else on the board works without me thinking ✦`, 0, (haveClaude === false || offlineMochi.signin) && settings.ai ? [{ label: 'Show me how to connect', run: () => MB.openURL(GUIDE) }] : []); offlineMochi.signin = false;
  }
  let haveClaude = null;
  const GUIDE = 'https://mochiboard.app/connect.html';   // the step-by-step page for connecting Claude Code
  const SIGNIN = /log ?in|api key|auth|credential|subscription|not (signed|logged)|oauth|unauthori[sz]ed|401|403/i;
  // the web demo: Mochi tidies for real, and for anything that needs AI she points you to the Mac app
  const getApp = () => MB.openURL(MB.getURL || 'https://github.com/jessawolfe-ux/mochiboard/releases/latest/download/Mochiboard.zip');
  const DL = [{ label: 'Download Mochiboard ✦', run: getApp }, { label: 'Keep playing', ghost: true, run: () => {} }];
  function webMochi(q) {
    if (offlineRecipe(q) || learnAnswer(q)) return;   // building beats explaining: "make a sitemap" builds one, "what is a sitemap" explains it
    const notes = board.cards.filter(c => c.type === 'note' && !parentOf(c.id));
    if (/group|sort|organi[sz]e|tidy|line up/i.test(q) && notes.length) return offlineMochi(q, 'In the Mac app I can sort them by theme too, with Claude.');
    const what = /mobbin/i.test(q) ? 'Mobbin lives in your Claude account, and I can only reach it from the Mac app.' : /higgsfield|photo|picture|image/i.test(q) ? 'Making pictures with Higgsfield happens in the Mac app, where I can check the price with you first.' : 'I think with Claude Code, and that lives in the Mac app.';
    say(`I'd love to help with that! ${what} Download me and I'll connect to your Claude, Mobbin and Higgsfield ✦`, 0, DL);
  }
  async function ask(q, confirmed = false, again = false, note = '') {
    const tj = !confirmed && q.match(TELL_JESSA);
    if (tj) { if (!chatOpen()) mochiOpen(true); addMsg('me', q); const note = tj[1].trim().replace(/^[\s.!?…]+$/, '');
      return addMsg('mochi', note ? "Want me to send that to Jessa? You'll see exactly what goes out first." : 'What should I tell her? I can open a note for you.', [{ label: note ? 'Review and send ♡' : 'Write a note ♡', run: () => openFeedback(note.charAt(0).toUpperCase() + note.slice(1)) }, { label: 'Not now', ghost: true, run: () => {} }]); }
    if (MB.web) { if (!chatOpen()) mochiOpen(true); addMsg('me', q); return webMochi(q); }
    if (!confirmed && !again && MB.native && ALL_FILES.test(q) && !NOT_ALL_FILES.test(q)) { if (!chatOpen()) mochiOpen(true); addMsg('me', q); return offerAllFiles(); }   // no need to think for this one
    if (!settings.ai || haveClaude === false) { if (!chatOpen()) mochiOpen(true); addMsg('me', q); }
    if (!settings.ai) return offlineMochi(q, "My thinking is switched off in Settings, so I can only do simple tidying.");
    if (haveClaude === false) { await showConnections(true); if (haveClaude === false) return offlineMochi(q, "I need Claude Code on this Mac to think. It's a one-time setup with your Claude account."); }   // look again first: they may have just set it up
    if (!navigator.onLine) { if (!chatOpen()) mochiOpen(true); addMsg('me', q); return offlineMochi(q, "You're offline, so I can't think with Claude right now. I'll be back when the internet is."); }
    if (!chatOpen()) mochiOpen(true);
    if (again) addMsg('mochi', note || 'Thanks! Looking now ✦'); else if (!confirmed) addMsg('me', q); else addMsg('mochi', 'Making it… this can take a minute ✦');
    $('mochi').classList.add('thinking'); goo.think(true); favGoo?.think(true); typing(true, confirmed ? 'making it' : doingLabel(q));
    // designing something for their game or site: photograph its pages first so she can see the real look (the .html cards on the board, selected ones first)
    let shots = pendingShots || []; pendingShots = null;
    if (!shots.length && MB.native && !confirmed && DESIGN_ASK.test(q)) { const pages = [...selCards(), ...board.cards].filter(c => c.type === 'file' && isWeb(c)).map(c => c.path).filter((p, k, a) => a.indexOf(p) === k).slice(0, 3);
      if (pages.length) { typing(true, 'looking at your game'); try { shots = (await MB.lookAt(pages)) || []; } catch (e) { shots = []; } typing(true, doingLabel(q)); } }
    const snap = snapshot(); if (shots.length) { snap.screenshots = shots; lastShots = shots.filter(x => x.size !== 'built'); }
    try { const raw = await MB.ask((window.mochiName && window.mochiName !== 'Mochi' ? `(The person named you ${window.mochiName}. That's your name now; sign off and refer to yourself that way.) ` : '') + q, snap, confirmed, { mobbin: settings.mobbin, higgs: settings.higgs, files: settings.mochiFiles !== false }); await applyMochi(parse(raw), q); }
    catch (err) { if (/Claude Code/.test(err.message)) { haveClaude = false; return offlineMochi(q, "I need Claude Code on this Mac to think. It's a one-time setup with your Claude account."); }
      if (SIGNIN.test(err.message)) { offlineMochi.signin = true; return offlineMochi(q, "Claude Code is here, but it isn't signed in yet. Open Terminal, type claude, and sign in with a Claude Pro or Max account."); }
      say("Hmm, I couldn't reach Claude: " + err.message); }
    finally { $('mochi').classList.remove('thinking'); goo.think(false); favGoo?.think(false); typing(false); }
  }
  // ---------- feedback to Jessa: write it here, see exactly what goes out, then send. No Claude needed ----------
  const FB_URL = 'https://formspree.io/f/xaqplzgy';   // the same inbox as mochiboard.app/feedback.html
  let fbKind = 'Idea';
  const fbOn = () => $('fbSheet').classList.contains('on');
  function openFeedback(text = '') {
    $('fbsMsg').value = text || $('fbsMsg').value; fbStep('write'); $('fbsStatus').textContent = '';
    $('fbSheet').classList.add('on'); $('fbSheet').setAttribute('aria-hidden', 'false'); setTimeout(() => $('fbsMsg').focus(), 60);
  }
  function closeFeedback() { $('fbSheet').classList.remove('on'); $('fbSheet').setAttribute('aria-hidden', 'true'); }
  function fbStep(at) { $('fbsWrite').hidden = at !== 'write'; $('fbsReview').hidden = at !== 'review'; $('fbsBack').hidden = at !== 'review'; $('fbsNext').textContent = at === 'review' ? 'Send to Jessa ♡' : 'Review'; $('fbsNext').disabled = false; $('fbSheet').dataset.at = at; if (at === 'review') setTimeout(() => $('fbsNext').focus(), 30); }
  async function fbOut() {
    let v = null; try { v = await MB.version(); } catch (e) {}
    const o = { kind: fbKind, message: $('fbsMsg').value.trim() }, mail = $('fbsEmail').value.trim(), nm = $('fbsName').value.trim(), role = $('fbsRole').value.trim();
    if (mail) o.email = mail;
    if ($('fbsCredit').checked && nm) { o.credit_name = nm; if (role) o.credit_role = role; }
    o.version = v || Object.keys(NEWS).pop(); o.computer = { mac: 'Mac', windows: 'Windows', linux: 'Linux' }[OS] || 'Web'; o.page = 'Mochiboard app';
    return o;
  }
  const FB_LABEL = { kind: 'Kind', message: 'Note', email: 'Reply to', credit_name: 'Thank me as', credit_role: 'Role', version: 'Version', computer: 'Computer', page: 'Sent from' };
  $('fbsKinds').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; fbKind = b.dataset.k; $('fbsKinds').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('fbsCredit').onchange = () => { $('fbsCreditRow').hidden = !$('fbsCredit').checked; if ($('fbsCredit').checked) $('fbsName').focus(); };
  $('fbsClose').onclick = closeFeedback;
  $('fbSheet').onclick = e => { if (e.target === $('fbSheet')) closeFeedback(); };
  $('fbSheet').addEventListener('keydown', e => e.stopPropagation());
  // while the sheet is open it owns the keyboard: Esc closes, ⌘Enter goes on, Tab stays inside (WebKit doesn't tab to buttons on its own), and nothing reaches the board
  addEventListener('keydown', e => {
    if (!fbOn()) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); return closeFeedback(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopImmediatePropagation(); return $('fbsNext').click(); }
    if (e.key === 'Tab') {
      const f = [...$('fbSheet').querySelectorAll('button, textarea, input')].filter(x => !x.disabled && x.offsetParent && x.type !== 'hidden');
      const i = f.indexOf(document.activeElement); e.preventDefault(); e.stopImmediatePropagation();
      return f[(i < 0 ? (e.shiftKey ? f.length - 1 : 0) : i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    }
    if (!$('fbSheet').contains(e.target)) e.stopImmediatePropagation();
  }, true);
  $('fbsBack').onclick = () => fbStep('write');
  $('fbsNext').onclick = async () => {
    const o = await fbOut();
    if ($('fbSheet').dataset.at === 'write') {
      if (!o.message) { $('fbsStatus').textContent = 'Write a little note first ✦'; $('fbsMsg').focus(); return; }
      if (o.email && !/^\S+@\S+\.\S+$/.test(o.email)) { $('fbsStatus').textContent = 'That email looks a little off.'; $('fbsEmail').focus(); return; }
      if ($('fbsCredit').checked && !o.credit_name) { $('fbsStatus').textContent = 'What name should I thank you by?'; $('fbsName').focus(); return; }
      $('fbsList').innerHTML = Object.entries(o).filter(([k]) => FB_LABEL[k]).map(([k, v]) => `<dt>${FB_LABEL[k]}</dt><dd>${esc(v)}</dd>`).join('');
      $('fbsStatus').textContent = ''; return fbStep('review');
    }
    if (!navigator.onLine) { $('fbsStatus').textContent = "You're offline. Your note is still here; send it when you're back."; return; }
    $('fbsNext').disabled = true; $('fbsStatus').textContent = 'Sending…';
    try {
      const r = await fetch(FB_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ...o, _subject: 'Mochiboard feedback ✦' }) });
      if (!r.ok) throw new Error(r.status);
      ['fbsMsg', 'fbsEmail', 'fbsName', 'fbsRole'].forEach(id => $(id).value = ''); $('fbsCredit').checked = false; $('fbsCreditRow').hidden = true;
      $('fbsStatus').textContent = 'Sent ✦ Thank you!'; setTimeout(closeFeedback, 1200);
      say(o.kind === 'Love note' ? 'Sent! Jessa is going to love that ♡' : 'Sent to Jessa ✦ She reads every one.');
    } catch (err) { $('fbsNext').disabled = false; $('fbsStatus').innerHTML = `That didn't go through. Try again, or <a href="#" id="fbsWeb">use the feedback page</a>.`; $('fbsWeb').onclick = ev => { ev.preventDefault(); MB.openURL('https://mochiboard.app/feedback.html'); }; }
  };
  $('mcFb').onclick = () => openFeedback();
  // right-click Mochi: her little menu
  $('mPill').oncontextmenu = e => { e.preventDefault(); $('rowMenu')?.remove();
    const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu'; m.innerHTML = '<button data-m="fb">Send feedback to Jessa ♡</button><button data-m="chat">Open chat</button>'; document.body.appendChild(m);
    const r = m.getBoundingClientRect(); m.style.left = Math.min(e.clientX, innerWidth - r.width - 10) + 'px'; m.style.top = Math.max(10, e.clientY - r.height - 8) + 'px';
    m.onclick = ev => { const a = ev.target.closest('[data-m]')?.dataset.m; if (!a) return; m.remove(); if (a === 'fb') openFeedback(); else mochiOpen(true); };
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true)); };
  // "tell Jessa …" in the chat: Mochi offers to send it (rules first, so it works without Claude too)
  const TELL_JESSA = /^\s*(?:please\s+|can you\s+|could you\s+)?(?:tell|send|message|let)\s+jessa(?!['’]s)(?:\s+know)?\b[\s:,-]*(?:that\s+)?([\s\S]*)$/i;
  $('mForm').onsubmit = e => { e.preventDefault(); const q = $('mInput').value.trim(); if (!q) return; $('mInput').value = ''; mochiOpen(false); $('mInput').placeholder = 'Ask Mochi… “group these by theme”'; ask(q); };
  const parse = raw => { const s = String(raw), a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0) return { say: s.trim() }; try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return { say: s.trim() }; } };
  // her actions: say, add cards, move cards, place unsorted ideas, add titles, connect cards
  async function applyMochi(r, q) {
    // folders first: create, rename, and move boards around the library
    const fo = r.folders, pr = r.projects;
    if (fo || pr) {
      await loadLib();
      ((pr && pr.create) || []).forEach(n => makeProject(n));
      ((pr && pr.rename) || []).forEach(o => { const x = byName(projects, o.from); if (x && o.to) x.name = String(o.to).trim(); });
      ((fo && fo.create) || []).forEach(o => { const n = typeof o === 'string' ? o : o.name, f = makeFolder(n); if (o.project) f.project = makeProject(o.project).id; });
      ((fo && fo.rename) || []).forEach(o => { const f = findFolder(o.from); if (f && o.to) f.name = String(o.to).trim(); });
      ((fo && fo.file) || []).forEach(o => { const f = findFolder(o.folder) || makeFolder(o.folder); f.project = o.project ? makeProject(o.project).id : null; });
      for (const m of (fo && fo.move) || []) { if (!boardList.some(b => b.id === m.board)) continue; const f = m.folder ? makeFolder(m.folder) : null; if (f && m.project) f.project = makeProject(m.project).id; await moveBoard(m.board, f ? f.id : null); }
      [...projects, ...folders].forEach(x => x.open = true);
      await saveLib(); await refreshBoards();
    }
    const center = centerWorld(), added = []; let i = 0;
    const place = o => { if (o.x == null || o.y == null) { const wide = o.type === 'font', fl = o.type === 'file', fo = o.type === 'folder'; o.x = center.x - 300 + (i % 3) * (fo ? 500 : wide ? 330 : fl ? 260 : 250); o.y = center.y - 100 + Math.floor(i / 3) * (fo ? 420 : wide || fl ? 244 : 170); i++; } };
    // collections Mochi makes, and cards she files into them (by collection id, or by the name of one she just made)
    const made = {};
    (r.collections || []).forEach(o => { place(o); const s2 = card('coll', { x: o.x, y: o.y, text: o.name || o.text || '', color: COLL[o.color] ? o.color : 'pink', kids: [], cols: o.cols || 1, r: 0 }); addCard(s2); made[(o.name || '').toLowerCase()] = s2; added.push(s2); });
    const collFor = k => k && (byId(k)?.type === 'coll' ? byId(k) : made[String(k).toLowerCase()] || colls().find(s2 => s2.text.toLowerCase() === String(k).toLowerCase()));
    const file = (c, k) => { const s2 = collFor(k); if (!s2 || c.id === s2.id) return; const from = parentOf(c.id); if (from) from.kids = from.kids.filter(x => x !== c.id); s2.kids.push(c.id); };
    (r.add || []).forEach(o => { if (o.type === 'image' && o.path && MB.native) { place(o); const c = card('image', { x: o.x, y: o.y, w: 260, h: 200, fileSrc: String(o.path), src: '' }); addCard(c); added.push(c); if (o.in) file(c, o.in); return; }
      if ((o.type === 'file' || o.type === 'folder') && o.path) { place(o); const c = o.type === 'folder' ? folderCard(String(o.path), o.x, o.y) : fileCard(String(o.path), o.x, o.y); if (o.root && c.type === 'file') c.root = String(o.root); addCard(c); added.push(c); if (o.in) file(c, o.in); watchSoon(); return; }
      place(o); const c = card(['todo', 'title', 'swatch', 'doc', 'font'].includes(o.type) ? o.type : 'note', { font: o.type === 'font' ? (o.font || o.text) : (o.font ? String(o.font) : undefined), body: o.type === 'doc' ? (o.body || '') : undefined,
      x: o.x, y: o.y, text: o.type === 'font' ? (o.sample || '') : o.text || '', color: COLOR_NAMES.includes(o.color) ? o.color : 'white', hex: o.hex, label: o.label,
      items: o.items ? o.items.map(t => ({ t: typeof t === 'string' ? t : t.t, done: false })) : undefined, tagText: o.tag, name: o.name }); addCard(c); added.push(c); if (o.in) file(c, o.in); });
    (r.titles || []).forEach(o => { place(o); added.push(addCard(card('title', { x: o.x, y: o.y, text: o.text }))); });
    (r.place || []).forEach(o => { const c = board.tray.find(x => x.id === o.id); if (!c) return; place(o); c.x = o.x; c.y = o.y; board.tray = board.tray.filter(x => x !== c); addCard(c); added.push(c); });
    (r.move || []).forEach(o => { const c = byId(o.id); if (!c || o.x == null) return; c.x = o.x; c.y = o.y; if (o.color && COLOR_NAMES.includes(o.color)) c.color = o.color;
      const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) { el.style.transition = 'left .6s cubic-bezier(.2,.8,.3,1), top .6s cubic-bezier(.2,.8,.3,1)'; renderCard(c); setTimeout(() => el.style.transition = '', 650); } added.push(c); });
    (r.edit || []).forEach(o => { const c = byId(o.id) || board.tray.find(x => x.id === o.id); if (!c) return;
      if (o.text != null) { if (c.type === 'link') c.title = o.text; else c.text = o.text; }
      if (o.desc != null) c.desc = o.desc;
      if (o.body != null && c.type === 'doc') { c.body = o.body; c.doc = null; if (docCard === c && ed) ed.commands.setContent(mdToHTML(c.body), false); }
      if (o.items) c.items = o.items.map((t, k) => ({ t: typeof t === 'string' ? t : t.t, done: (typeof t === 'object' && t.done) || (c.items?.[k]?.t === t && c.items[k].done) || false }));
      if (o.color && COLOR_NAMES.includes(o.color)) c.color = o.color;
      if (o.src && MB.native && ['box', 'image'].includes(c.type)) { if (c.type === 'box' && /\.(webm|mov|mp4|m4v)$/i.test(String(o.src))) { c.fileVideo = String(o.src); delete c.src; } else { c.fileSrc = String(o.src); delete c.video; } added.push(c); }   // swap in different art from their files
      if (o.tag !== undefined) { if (o.tag) c.tagText = o.tag; else delete c.tagText; }
      if (o.hex && /^#[0-9a-f]{6}$/i.test(o.hex)) c.hex = o.hex.toLowerCase();
      if (o.label != null) c.label = o.label;
      ['bold', 'italic', 'under', 'strike'].forEach(k => { if (typeof o[k] === 'boolean') c[k] = o[k]; });
      if (o.size && FS[o.size]) { if (o.size === 'm') delete c.fs; else c.fs = o.size; }
      if (o.name != null && c.type === 'note') c.name = o.name;
      if (o.in !== undefined) { if (o.in) file(c, o.in); else { const from = parentOf(c.id); if (from) from.kids = from.kids.filter(x => x !== c.id); } }
      if (board.cards.includes(c)) { renderCard(c, true); added.push(c); } else renderTray(); });
    if (r.remove && r.remove.length) { const gone = new Set(r.remove); board.cards = board.cards.filter(c => !gone.has(c.id)); board.tray = board.tray.filter(c => !gone.has(c.id)); board.links = board.links.filter(l => !gone.has(l.a) && !gone.has(l.b)); gone.forEach(id => cardsEl.querySelector(`[data-id="${id}"]`)?.remove()); }
    (r.connect || []).forEach(p => { const [a, b] = Array.isArray(p) ? p : [p.a, p.b]; if (byId(a) && byId(b)) board.links.push({ id: uid(), a, b }); });
    // wireframes: real screens built from the pieces, left to right, with arrows for the flow
    if (Array.isArray(r.screens) && r.screens.length) {
      let sx = board.cards.length ? Math.max(...board.cards.map(c => c.x + c.w)) + 160 : center.x - 200, sy = board.cards.length ? Math.min(...board.cards.map(c => c.y)) : center.y - 400, prev = null;
      const builtFrames = []; r.screens.forEach(sp => { const { f, made } = buildScreen(sp, sx, sy); builtFrames.push(f); made.forEach(c => added.push(c)); if (prev && sp.flow !== false) board.links.push({ id: uid(), a: prev.id, b: f.id, arrow: true }); prev = f; sx += f.w + 140; });
    }
    if (r.screens?.length && !r.screens.some(sp => Array.isArray(sp.layers))) setTimeout(() => offerFill(spotsIn(board.cards.filter(c => c.type === 'frame').slice(-r.screens.length))), 1500);
    const fixed = []; (Array.isArray(r.replace) ? r.replace : []).forEach(o => { const res = o && replaceScreen(o); if (res) { fixed.push(res.nf); res.made.forEach(c => added.push(c)); } });
    const designed = r.screens?.some(sp => Array.isArray(sp.layers)) && !checking ? board.cards.filter(c => c.type === 'frame').slice(-r.screens.length) : [];
    if (designed.length) setTimeout(() => checkWork(designed, q), 0);
    // pictures (Mobbin screens, Higgsfield images): fetched and saved into the board, laid out in a row of tilted cards
    const imgs = r.images || [];
    if (imgs.length) {
      const base = { x: Math.max(...board.cards.map(c => c.x + c.w), center.x - 300) + 80, y: Math.min(...board.cards.map(c => c.y), center.y) };
      let k = 0;
      for (const im of imgs) {
        try {
          const data = await MB.fetchImage(im.url), dims = await new Promise(res => { const t = new Image(); t.onload = () => res([t.width, t.height]); t.onerror = () => res([3, 4]); t.src = data; });
          const w = 240, h = Math.min(520, Math.round(w * dims[1] / dims[0])) + 16;
          const c = card('image', { src: data, w, h, x: im.x ?? base.x + (k % 4) * 270, y: im.y ?? base.y + Math.floor(k / 4) * 560, tagText: im.caption || '' });
          addCard(c); added.push(c); k++;
        } catch (e) {}
      }
    }
    // file and folder cards she placed on top of each other get laid out in tidy rows (they're bigger than notes)
    const fls = added.filter(c => c.type === 'file' || c.type === 'folder'), hit = (a, b) => a.x < b.x + b.w + 10 && b.x < a.x + a.w + 10 && a.y < b.y + b.h + 10 && b.y < a.y + a.h + 10;
    if (fls.length > 1 && fls.some((a, k) => fls.slice(k + 1).some(b => hit(a, b)))) {
      const x0 = Math.min(...fls.map(c => c.x)), y0 = Math.min(...fls.map(c => c.y)); let x = x0, y = y0, rowH = 0;
      [...fls.filter(c => c.type === 'folder'), ...fls.filter(c => c.type === 'file')].forEach(c => { if (x > x0 && x + c.w > x0 + 1100) { x = x0; y += rowH + 30; rowH = 0; } c.x = x; c.y = y; x += c.w + 30; rowH = Math.max(rowH, c.h); renderCard(c); });
    }
    layoutAll();
    renderTray(); renderWires(); save();
    if (MB.native) { const art = [...added, ...board.cards.filter(c => c.fileSrc || c.fileVideo)].filter((c, k, a) => (c.fileSrc || c.fileVideo) && a.indexOf(c) === k); if (art.length) fillFileArt(art); }
    if (added.length) setTimeout(() => showWhatMochiMade(added), 250);
    const changed = r.settings && typeof r.settings === 'object' ? changeSettings(r.settings) : { done: [] };
    // what she learns from corrections ("our logo is the 3D one") stays with the board, so she gets it right next time
    [].concat(r.remember || []).filter(t => typeof t === 'string' && t.trim()).forEach(t => { board.mochiNotes = (board.mochiNotes || []).filter(x => x.toLowerCase() !== t.trim().toLowerCase()); board.mochiNotes.push(t.trim().slice(0, 300)); if (board.mochiNotes.length > 30) board.mochiNotes.shift(); });
    if (r.connectAll && MB.native) { if (r.say) addMsg('mochi', r.say); return offerAllFiles(); }
    if (Array.isArray(r.look) && r.look.length && MB.native && !lookedOnce) {   // she wants to see their pages before designing: photograph them, then ask her again
      if (r.say) addMsg('mochi', r.say); lookedOnce = true; typing(true, 'looking at your game');
      let sh = []; try { sh = (await MB.lookAt(r.look.map(String).slice(0, 3))) || []; } catch (e) {} typing(false);
      pendingShots = sh.length ? sh : null;
      try { await ask(q, false, true, sh.length ? '' : "I couldn't open those pages, so I'll go from what I know…"); } finally { lookedOnce = false; } return; }   // one look per ask, however long the answer takes
    // she needs to see a folder: one tap connects it (or switches reading back on) and she tries again by herself
    const needFolder = r.needFolder && MB.native && !acts0(r);
    const acts = r.confirm ? [{ label: (r.confirm || 'Yes, make it') + ' ✦', run: () => ask(q, true) }, { label: 'Not now', ghost: true, run: () => {} }]
      : needFolder ? [{ label: settings.mochiFiles === false && connected.length ? 'Let Mochi read my folders ✦' : `Connect ${String(r.needFolder).length < 28 && !/^(your )?(folder|files?)$/i.test(String(r.needFolder)) ? `“${String(r.needFolder)}”` : 'a folder'} ✦`, run: () => connectForMochi(q) }, { label: 'Not now', ghost: true, run: () => {} }] : [];
    // what next: Mochi's own ideas, or a sensible guess from what she just made
    const next = acts.length ? [] : (Array.isArray(r.next) && r.next.length ? r.next : guessNext(r, added)).filter(t => typeof t === 'string' && t.trim()).slice(0, 3);
    next.forEach(t => acts.push({ label: t.trim(), cls: 'next', run: () => ask(t.trim()) }));
    if (changed.done.length) acts.unshift({ label: 'Undo', ghost: true, run: () => { changeSettings(changed.before); chirp('Back how it was ✦', 3000); } });
    say(r.say || (added.length ? `Done! I touched ${added.length} cards.` : 'Done!'), r.confirm || needFolder ? 0 : next.length ? 16000 : 9000, acts);
  }
  function guessNext(r, added) {
    const has = t => added.some(c => c.type === t);
    if (r.screens?.length) return added.some(c => c.img) ? ['Make the mobile version', 'Try a different color style', 'Write the real copy'] : ['Add the next screen', 'Make it a website too', 'Try a different style'];
    if (has('font')) return ['Pair these with colors', 'Show them on a landing page', 'Narrow it down to two'];
    if (has('swatch')) return ['Pick fonts that match', 'Build a page in these colors'];
    if (has('todo')) return ['Break it into smaller steps', 'Put dates on it'];
    if (added.length >= 3) return ['Group these by theme', 'What am I missing?', 'Turn this into a plan'];
    return [];
  }

  // ---------- Mochi's helpers: Claude Code, Mobbin, Higgsfield ----------
  let lastConn = 0;
  async function showConnections(force) {
    if (!force && Date.now() - lastConn < 5 * 60 * 1000) return; lastConn = Date.now();
    const els = [...document.querySelectorAll('.conns')];
    els.forEach(el => { if (!el.children.length) el.innerHTML = ['Claude Code', 'Mobbin', 'Higgsfield'].map(n => `<div class="conn"><span class="dot"></span>${n}<em style="color:var(--ink-faint)">checking…</em></div>`).join(''); });
    const c = await MB.connections().catch(() => ({})); if (!c.browser) haveClaude = !!c.claude;
    const rows = [['claude', 'Claude Code', GUIDE, 'Set up'], ['mobbin', 'Mobbin', 'https://claude.ai/settings/connectors', 'Connect'], ['higgsfield', 'Higgsfield', 'https://claude.ai/settings/connectors', 'Connect']];
    els.forEach(el => { el.innerHTML = '';
    // Connect clears the 5-minute wait, so the app looks again the moment they come back from claude.ai
    rows.forEach(([k, name, url, verb]) => { const r = document.createElement('div'); r.className = 'conn' + (c[k] ? ' on' : ''); r.innerHTML = `<span class="dot"></span>${name}`;
      if (c[k]) r.insertAdjacentHTML('beforeend', '<em>ready</em>');
      else if (!c.browser) { const b = document.createElement('button'); b.textContent = verb; b.onclick = () => { lastConn = 0; MB.openURL(url); say(k === 'claude' ? 'Follow the steps on that page, then come back. I’ll notice as soon as Claude Code is ready!' : `Connect ${name} in your Claude settings (Connectors), then come back. I'll check again when you reopen me ✦`, 9000); }; r.appendChild(b); }
      el.appendChild(r); }); });
  }
  addEventListener('focus', () => showConnections());

  function removeSelected() {
    const gone = new Set(sel); board.cards = board.cards.filter(c => !gone.has(c.id)); board.links = board.links.filter(l => !gone.has(l.a) && !gone.has(l.b));
    gone.forEach(id => cardsEl.querySelector(`[data-id="${id}"]`)?.remove()); sel.clear();
    cardsEl.querySelectorAll('.card.inside').forEach(el => { if (!parentOf(el.dataset.id)) { el.classList.remove('inside'); } });
    renderWires(); save();
  }

  // ---------- placing: pick a tool, the new thing rides on your cursor, click to drop it, then type ----------
  let placing = null, mouse = { x: 0, y: 0 };
  const PLACE = { kit: ['', [300, 180]], table: ['Table', [360, 130]], note: ['Note', [220, 120]], todo: ['Checklist', [240, 170]], title: ['Title', [300, 56]], coll: ['Collection', [288, 200]], swatch: ['Color', [120, 150]], doc: ['Doc', [240, 52]], canvas: ['Canvas', [260, 180]], link: ['Paste a link', [260, 52]], shape: ['', [160, 160]], stamp: ['', [56, 56]], audio: ['Voice memo', [290, 150]], piece: ['', [300, 60]], icon: ['', [28, 28]], frame: ['Screen', [393, 852]], text: ['Text', [220, 26]], box: ['Drag to draw a box', [160, 100]] , video: ['Video', [360, 246]] };
  function startPlacing(type, extra = {}) {
    if (placing?.type === type && placing.extra?.shape === extra.shape && placing.extra?.piece === extra.piece) return stopPlacing();
    stopPlacing(); placing = { type, extra }; selectOnly([]);
    const g = $('ghost'), [label, [w, h]] = PLACE[type]; g.className = 'ghost on ' + type; g.innerHTML = `<span>${label}</span>`;
    g.style.width = w + 'px'; g.style.height = (extra.shape === 'line' ? 24 : h) + 'px'; if (type === 'shape') g.innerHTML = shapeSVG({ shape: extra.shape });
    if (type === 'piece') { const P = PIECES[extra.piece], items = P.make(P.w || 360), W = Math.max(...items.map(i => i.x + i.w)), H = Math.max(...items.map(i => i.y + i.h)); g.style.width = W + 'px'; g.style.height = H + 'px'; g.querySelector('span').textContent = extra.piece; }
    if (type === 'kit') { const P = KITS[extra.kit].pieces[extra.piece], s = P.shape; if (s) { g.innerHTML = shapeSVG(s); g.style.width = s.w + 'px'; g.style.height = s.h + 'px'; } else { g.style.width = '300px'; g.style.height = '180px'; g.querySelector('span').textContent = extra.piece; } }
    if (type === 'icon') { g.innerHTML = `<span class="mi" style="font-size:28px;position:static;color:#27272a">${esc(extra.name)}</span>`; g.style.width = g.style.height = '28px'; }
    if (type === 'frame' && DEVICES[extra.device]) { g.style.width = DEVICES[extra.device][0] + 'px'; g.style.height = DEVICES[extra.device][1] + 'px'; g.querySelector('span').textContent = extra.device; }
    if (type === 'stamp') { const st = extra.stamp; g.innerHTML = stampHTML(st); g.style.width = g.style.height = '56px'; } moveGhost(); stage.classList.add('placing');
    $('tools').querySelector(`[data-add="${type}"]`)?.classList.add('on');
  }
  function stopPlacing() { if (placing?.type === 'audio') setTimeout(coolMic, 15000); $('shapePick').classList.remove('on'); $('tplPick').classList.remove('on'); $('stampWheel').classList.remove('on'); $('stampPick').classList.remove('on'); placing = null; $('ghost').className = 'ghost'; stage.classList.remove('placing'); $('tools').querySelectorAll('.on').forEach(b => b.classList.remove('on')); }
  function moveGhost() { if (!placing) return; const r = stage.getBoundingClientRect(), g = $('ghost'), o = placing.type === 'stamp' ? 28 * view.z : 14; g.style.left = mouse.x - r.left - o + 'px'; g.style.top = mouse.y - r.top - o + 'px'; g.style.transform = `scale(${view.z})`; }
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; moveGhost(); }, true);
  function placeAt(w) {
    if (placing.type === 'stamp') return stampAt(w, placing.extra.stamp);
    if (placing.type === 'kit') { const { kit, piece } = placing.extra; stopPlacing(); $('design').querySelectorAll('[data-kp].on').forEach(x => x.classList.remove('on')); return placeKit(kit, piece, w); }
    if (placing.type === 'piece') { const n = placing.extra.piece; stopPlacing(); $('dzPieces').querySelectorAll('.on').forEach(x => x.classList.remove('on')); return placePiece(n, w); }
    const type = placing.type, more = placing.extra || {}; stopPlacing();
    const dev = DEVICES[more.device], extra = type === 'icon' ? { name: more.name || 'star', color: '#27272a', w: 28, h: 28, r: 0 } : type === 'frame' ? { name: more.device === 'Desktop' ? 'Desktop' : 'Screen', device: more.device || 'Custom', w: dev ? dev[0] : 393, h: dev ? dev[1] : 852, radius: dev ? dev[2] : 0, fill: '#ffffff', r: 0 }
      : type === 'text' ? { text: '', size: 18, weight: 500, font: 'DM Sans', color: '#27272a', r: 0 } : type === 'audio' ? { r: 0 } : type === 'doc' ? { text: '', body: '' } : type === 'canvas' ? { text: '' } : type === 'link' ? { url: '' } : type === 'shape' ? { shape: more.shape, fill: 'gray', text: '', r: 0 } : type === 'note' ? { name: '', color: newNoteColor() } : type === 'todo' ? { text: '', items: [{ t: 'first thing', done: false }] } : type === 'title' ? { text: '' }
      : type === 'coll' ? { text: '', color: 'pink', kids: [], cols: 1 } : type === 'table' ? { rows: [['', '', ''], ['', '', ''], ['', '', '']], r: 0 } : type === 'swatch' ? { hex: '#ff9ec4', label: 'Pink' } : {};
    const c = card(type, extra); c.x = snapTo(w.x - 14 / view.z); c.y = snapTo(w.y - 14 / view.z);
    if (type === 'coll') c.r = 0;
    if (type === 'link') c.h = 52;
    if (type === 'shape' && more.shape === 'line') { c.w = 200; c.h = 24; }
    if (window.__phone?.on) {   // a finger has no ghost to aim with: center it on the tap, and keep it on screen
      const r = stage.getBoundingClientRect(), z = view.z, mx = 12 / z, wl = (r.left + 12 - view.x) / z, wr = (r.right - 12 - view.x) / z, wt = (r.top + 70 - view.y) / z, wb = (r.bottom - 100 - view.y) / z;
      c.x = snapTo(clamp(w.x - c.w / 2, wl, Math.max(wl, wr - c.w))); c.y = snapTo(clamp(w.y - c.h / 2, wt, Math.max(wt, wb - c.h))); }
    if (type === 'swatch') { c.label = colorName(c.hex); c.autoName = true; }
    if (type === 'canvas') { const child = newBoard('Untitled canvas'); child.parent = board.id; child.folder = board.folder || null; c.board = child.id; MB.save(child).then(refreshBoards); }
    addCard(c); selectOnly([c.id]);
    if (type === 'note' && board.cards.filter(x => x.type === 'note' && !parentOf(x.id)).length === 6) tip('That\'s a lot of loose notes! Want me to sort them into collections? Just ask ✦');
    const t = type !== 'coll' && collAt(w, new Set([c.id])); if (t) { dropInto(t, [c.id], w); save(); }
    if (WF.includes(type)) { fileIntoFrame([c]); pickWF(null); }
    if (type === 'table') fitText(c);
    if (['note', 'todo', 'title', 'doc', 'canvas', 'text', 'table'].includes(type)) startEdit(c.id);   // ready to type right away, so the first letters never act as shortcuts
    if (type === 'coll') startEdit(c.id);
    if (type === 'swatch') setTimeout(() => openColor(c), 60);
    if (type === 'audio') { c.ready = true; renderCard(c); selectOnly([c.id]); save(); readyToRecord().then(() => renderCard(c)); }
    if (type === 'video') { c.ready = true; renderCard(c); selectOnly([c.id]); save(); camOn(c); }   // it waits for Start recording, so nothing records by surprise
  }

  // ---------- design thinking templates: a ready-made layout with one or two examples, plus Mochi's how-to note (delete it anytime) ----------
  // items: title / note / coll (a collection with example notes) / how (Mochi's note). keys + links draw arrows between items.
  const FRAMEWORKS = {
    affinity: { emoji: '🧩', name: 'Affinity map', line: 'Cluster notes into themes', items: [
      { t: 'title', x: 0, y: 0, text: 'Affinity map' },
      { t: 'coll', x: 0, y: 90, name: 'Raw notes', color: 'white', notes: [{ text: '“I never know if my payment went through”' }, { text: '“I check my balance three times a day”' }, { text: 'Skipped the tutorial, then got lost' }, { text: '“The fees feel hidden”' }] },
      { t: 'coll', x: 330, y: 90, name: 'People don’t trust the numbers', color: 'pink', notes: [{ text: '“I never know if my payment went through”', color: 'pink' }, { text: '“The fees feel hidden”', color: 'pink' }] },
      { t: 'coll', x: 660, y: 90, name: 'Name a theme', color: 'mint', notes: [{ text: 'Drag notes that feel alike in here', color: 'mint' }] },
      { t: 'how', x: 990, y: 90, text: 'Write one observation per note, in Raw notes. Then drag notes that feel alike into the same group.\n\nName each group as an insight, like “People don’t trust the numbers”, not just “Trust”.\n\nStuck? Ask me to group them by theme.' },
    ] },
    opportunity: { emoji: '🌳', name: 'Opportunity map', line: 'Outcome → opportunities → solutions', items: [
      { t: 'title', x: 0, y: 0, text: 'Opportunity map' },
      { t: 'note', key: 'o', x: 330, y: 90, name: 'Outcome', text: 'More people finish signing up', color: 'sky' },
      { t: 'note', key: 'p1', x: 120, y: 300, name: 'Opportunity', text: '“I don’t know why it needs my ID”', color: 'butter' },
      { t: 'note', key: 'p2', x: 540, y: 300, name: 'Opportunity', text: '“Setting up takes too long”', color: 'butter' },
      { t: 'note', key: 's1', x: 0, y: 510, name: 'Solution', text: 'Explain why, right on that screen', color: 'mint' },
      { t: 'note', key: 's2', x: 240, y: 510, name: 'Solution', text: 'Let people add their ID later', color: 'mint' },
      { t: 'note', key: 's3', x: 540, y: 510, name: 'Solution', text: 'Save progress so they can come back', color: 'mint' },
      { t: 'note', key: 'e1', x: 0, y: 720, name: 'Test', text: 'Show the new copy to 5 people', color: 'lilac' },
      { t: 'how', x: 900, y: 90, text: 'Start at the top with the outcome you want.\n\nUnder it, add opportunities: needs and pains you heard from real people, in their words.\n\nUnder each one, a few solutions, then a small test to try first.\n\nDrag from a card’s edge to draw the lines, so you always know why you’re building something.' },
    ], links: [['o', 'p1'], ['o', 'p2'], ['p1', 's1'], ['p1', 's2'], ['p2', 's3'], ['s1', 'e1']] },
    matrix: { emoji: '⚖️', name: 'Impact / effort', line: 'Sort ideas into four boxes', items: [
      { t: 'title', x: 0, y: 0, text: 'Impact / effort' },
      { t: 'coll', x: 0, y: 90, name: '⚡ Quick wins', color: 'mint', notes: [{ text: 'Add a “save for later” button', color: 'mint' }] },
      { t: 'coll', x: 330, y: 90, name: '🚀 Big bets', color: 'sky', notes: [{ text: 'Rebuild search', color: 'sky' }] },
      { t: 'coll', x: 0, y: 360, name: '🧺 Fill-ins', color: 'butter', notes: [{ text: 'New empty-state art', color: 'butter' }] },
      { t: 'coll', x: 330, y: 360, name: '💤 Skip for now', color: 'pink', notes: [{ text: 'Custom themes', color: 'pink' }] },
      { t: 'how', x: 660, y: 90, text: 'Write every idea on its own note, then drop each one into a box.\n\nQuick wins: big impact, little effort. Big bets: big impact, lots of effort. Fill-ins: small and easy. Skip for now: small and hard.\n\nDo the quick wins first. Plan the big bets. Fill-ins are for slow days. Be honest about the last box.\n\nNot sure where one goes? Compare it to its neighbors, not to a perfect score.' },
    ] },
    empathy: { emoji: '💭', name: 'Empathy map', line: 'What they say, think, do and feel', items: [
      { t: 'title', x: 0, y: 0, text: 'Empathy map' },
      { t: 'note', x: 245, y: 90, name: 'Who', text: 'Maya, saving for her first apartment', color: 'lilac' },
      { t: 'coll', x: 0, y: 270, name: 'Says', color: 'sky', notes: [{ text: '“I just want to know I’m on track”', color: 'sky' }] },
      { t: 'coll', x: 330, y: 270, name: 'Thinks', color: 'lilac', notes: [{ text: 'Am I doing this wrong?', color: 'lilac' }] },
      { t: 'coll', x: 0, y: 520, name: 'Does', color: 'butter', notes: [{ text: 'Checks the app every morning', color: 'butter' }] },
      { t: 'coll', x: 330, y: 520, name: 'Feels', color: 'pink', notes: [{ text: 'Nervous before payday', color: 'pink' }] },
      { t: 'how', x: 660, y: 90, text: 'Pick one real person (or a clear type of person) and write who they are up top.\n\nFill each box from interviews and research, not guesses. Quotes go in Says.\n\nThe gold is where Says and Thinks don’t match. That gap is usually the real problem.' },
    ] },
    journey: { emoji: '🗺️', name: 'Journey map', line: 'Steps, feelings and pain points', items: [
      { t: 'title', x: 0, y: 0, text: 'Journey map' },
      { t: 'coll', x: 0, y: 90, name: '1 · Hears about it', color: 'sky', notes: [{ text: 'Sees a friend’s post', color: 'white' }, { text: '😊 Curious', color: 'mint' }] },
      { t: 'coll', x: 300, y: 90, name: '2 · Signs up', color: 'lilac', notes: [{ text: 'Fills out 4 screens', color: 'white' }, { text: '😩 “Why do you need my ID?”', color: 'pink' }] },
      { t: 'coll', x: 600, y: 90, name: '3 · First use', color: 'butter', notes: [{ text: 'Sets a savings goal', color: 'white' }] },
      { t: 'coll', x: 900, y: 90, name: '4 · Comes back', color: 'mint', notes: [{ text: 'What brings them back?', color: 'white' }] },
      { t: 'how', x: 1200, y: 90, text: 'One column per step, in order. In each, add what they do (white), how they feel (green = good, pink = rough) and what gets in the way.\n\nThe pink notes are your opportunities.\n\nRename the steps to fit your product.' },
    ] },
    hmw: { emoji: '💡', name: 'How might we', line: 'Turn problems into questions', items: [
      { t: 'title', x: 0, y: 0, text: 'How might we…' },
      { t: 'coll', x: 0, y: 90, name: 'Problems we heard', color: 'pink', notes: [{ text: 'People abandon sign up at the ID step', color: 'pink' }] },
      { t: 'coll', x: 330, y: 90, name: 'How might we…', color: 'butter', notes: [{ text: 'HMW make the ID step feel safe?', color: 'butter' }, { text: 'HMW let people start before the ID step?', color: 'butter' }] },
      { t: 'how', x: 660, y: 90, text: 'Write each problem on its own note. Then flip it into a question that starts with “How might we…”.\n\nGood ones are wide enough to have many answers, but narrow enough to start on today.\n\nWrite a few versions of each, then vote with stamps.' },
    ] },
    rtb: { emoji: '🌹', name: 'Rose, thorn, bud', line: 'A quick, kind retro', items: [
      { t: 'title', x: 0, y: 0, text: 'Rose, thorn, bud' },
      { t: 'coll', x: 0, y: 90, name: '🌹 Rose · what’s working', color: 'pink', notes: [{ text: 'Testing every Friday kept us honest', color: 'pink' }] },
      { t: 'coll', x: 330, y: 90, name: '🌵 Thorn · what hurt', color: 'peach', notes: [{ text: 'Handoff to engineering was rushed', color: 'peach' }] },
      { t: 'coll', x: 660, y: 90, name: '🌱 Bud · what could grow', color: 'mint', notes: [{ text: 'Share the research earlier', color: 'mint' }] },
      { t: 'how', x: 990, y: 90, text: 'Everyone writes quietly for 5 minutes: one note per thought.\n\nRoses are wins, thorns are pains, buds are ideas worth trying.\n\nThen read them out, group the alike ones, and pick one bud to try next.' },
    ] },
  };
  function placeFramework(key, at, F0) {
    const F = F0 || FRAMEWORKS[key]; if (!F) return; remember(); stopPlacing();
    const c0 = centerWorld(), x0 = at ? Math.round(at.x) : board.cards.length ? Math.max(...board.cards.map(c => c.x + c.w)) + 200 : c0.x - 500, y0 = at ? Math.round(at.y) : board.cards.length ? Math.min(...board.cards.map(c => c.y)) : c0.y - 300;
    const made = [], keyed = {};
    F.items.forEach(it => {
      const at = { x: x0 + it.x, y: y0 + it.y };
      if (it.t === 'title') made.push(addCard(card('title', { ...at, text: it.text }), true));
      if (it.t === 'note') { const c = addCard(card('note', { ...at, text: it.text, name: it.name, color: it.color || 'white' }), true); made.push(c); if (it.key) keyed[it.key] = c; }
      if (it.t === 'how') made.push(addCard(card('note', { ...at, w: 280, h: 300, r: 1.5, name: 'Mochi’s how-to', text: it.text, color: 'white', mochi: true }), true));
      if (it.t === 'coll') {
        const kids = it.notes.map(n => card('note', { text: n.text, color: n.color || 'white', r: 0 }));
        const s2 = card('coll', { ...at, text: it.name, color: it.color, kids: kids.map(k => k.id), cols: 1, r: 0 });
        board.cards.push(s2); renderCard(s2, true); kids.forEach(k => { board.cards.push(k); renderCard(k, true); }); made.push(s2, ...kids);
      }
    });
    (F.links || []).forEach(([a, b]) => keyed[a] && keyed[b] && board.links.push({ id: uid(), a: keyed[a].id, b: keyed[b].id, arrow: true }));
    // notes grow to fit their words
    made.filter(c => c.type === 'note' && !parentOf(c.id)).forEach(c => { const el = cardsEl.querySelector(`[data-id="${c.id}"]`), b = el?.querySelector('.body'); if (!b) return; b.style.height = 'auto'; c.h = Math.max(c.h, b.offsetHeight + 8); b.style.height = ''; el.style.height = c.h + 'px'; });
    layoutAll(); renderWires(); save(); fit(made);
    say(`Here’s ${/^[aeiou]/i.test(F.name) ? 'an' : 'a'} ${F.name.toLowerCase()} ${F.emoji} My how-to note is on the right. Delete it whenever you’re ready ✦`, 7000);
  }
  // little line icons for the menu, drawn like the toolbar's
  const TPL_IC = {
    affinity: '<rect x="2.5" y="3" width="5" height="5" rx="1.2"/><rect x="4.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="12" y="3.5" width="5" height="5" rx="1.2"/><rect x="11.5" y="11" width="5" height="5" rx="1.2"/>',
    opportunity: '<rect x="7.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="2.5" y="9" width="5" height="3.5" rx="1"/><rect x="12.5" y="9" width="5" height="3.5" rx="1"/><rect x="2.5" y="15" width="5" height="2.5" rx="1"/><path d="M10 6v1.5M5 9V7.5h10V9M5 12.5V15"/>',
    matrix: '<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M10 3v14M3 10h14"/><circle cx="13.5" cy="6.5" r="1" fill="currentColor"/>',
    empathy: '<path d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M10 11.5s-2.6-1.5-2.6-3.1a1.3 1.3 0 0 1 2.6-.4 1.3 1.3 0 0 1 2.6.4c0 1.6-2.6 3.1-2.6 3.1z"/>',
    journey: '<circle cx="4.5" cy="15" r="1.8"/><circle cx="15.5" cy="5" r="1.8"/><path d="M6.2 14.4c3-1 1.5-4.4 4.3-5.4 1.6-.6 2.7-1.4 3.4-2.6"/><path d="M15.5 9.5v.01M11 16h.01M14 13.5h.01" stroke-width="2.2"/>',
    hmw: '<path d="M7.5 14.5h5M8.3 17h3.4M10 2.8a5 5 0 0 0-3 9c.6.5 1 1.2 1 2v.7h4v-.7c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z"/>',
    rtb: '<circle cx="10" cy="7" r="3.6"/><path d="M10 5.3c-.9.4-1.2 1.4-.6 2.1M10 10.6V17.5M10 14c-2.3 0-3.8-1.2-4.2-3 2 0 3.6.9 4.2 3zM10 15.5c1.8 0 3.2-1 3.6-2.6-1.7 0-3.1.8-3.6 2.6z"/>',
  };
  // the old "Start from" boards live here now too, under the frameworks: each opens as its own new board
  const STARTERS = {
    'Moodboard': ['References, colors and type for a feeling', '<path d="M10 2.8a7.2 7.2 0 1 0 0 14.4c1.2 0 1.8-.9 1.4-1.9-.5-1.1.2-2.3 1.4-2.3h1.7a2.7 2.7 0 0 0 2.7-2.7c0-4.2-3.2-7.5-7.2-7.5z"/><circle cx="6.6" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="6.2" r=".9" fill="currentColor"/><circle cx="12.6" cy="6.8" r=".9" fill="currentColor"/>'],
    'App plan': ['Who it\'s for, the problem, the screens', '<rect x="6" y="2.5" width="8" height="15" rx="2"/><path d="M8.5 6h3M8.5 9h3M8.5 12h2"/>'],
    'Dream it': ['The poster: you can literally do anything', '<path d="M10 2.5l1.9 4.2 4.6.5-3.4 3.1 1 4.5-4.1-2.3-4.1 2.3 1-4.5-3.4-3.1 4.6-.5z"/>'],
    'Brain dump': ['Empty your head, then let Mochi sort it', '<path d="M10 3.5c-3.6 0-6.5 2.4-6.5 5.5 0 1.9 1.1 3.5 2.8 4.5l-.6 3 3-1.8c.4.1.9.1 1.3.1 3.6 0 6.5-2.4 6.5-5.8S13.6 3.5 10 3.5z"/><path d="M7.5 8.5h5M7.5 11h3"/>'],
  };
  $('tplPick').innerHTML = '<div class="tp-h">Add to this board</div>' + Object.entries(FRAMEWORKS).map(([k, F]) => `<button data-tpl="${k}"><span class="tp-e"><svg viewBox="0 0 20 20">${TPL_IC[k]}</svg></span><span class="tp-t"><b>${esc(F.name)}</b><small>${esc(F.line)}</small></span></button>`).join('')
    + '<div class="tp-h">Start a new board</div>' + Object.entries(STARTERS).filter(([k]) => TEMPLATES[k]).map(([k, [line, ic]]) => `<button data-starter="${esc(k)}"><span class="tp-e"><svg viewBox="0 0 20 20">${ic}</svg></span><span class="tp-t"><b>${esc(k)}</b><small>${esc(line)}</small></span><span class="tp-new">New ↗</span></button>`).join('');
  $('tplPick').onclick = async e => { const st = e.target.closest('[data-starter]');
    if (st) { $('tplPick').classList.remove('on'); $('tools').querySelector('[data-add="tpl"]').classList.remove('on'); const name = st.dataset.starter, b = newBoard(name, name); await MB.save(b); await openBoard(b.id); fit(board.cards); refreshBoards(); return; }
    const b = e.target.closest('[data-tpl]'); if (!b) return; $('tplPick').classList.remove('on'); $('tools').querySelector('[data-add="tpl"]').classList.remove('on'); placeFramework(b.dataset.tpl); };

  // ---------- export: right-click a card (or the empty board) to save it as an image or PDF ----------
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  async function exportCards(cs, name, pdf) {
    if (!cs.length) return say('Nothing to export yet ✦', 2500);
    if (MB.web) return say('Saving images and PDFs works in the Mac app ✦', 0, DL);
    const all = new Set(cs); cs.forEach(c => { if (c.type === 'coll') (c.kids || []).forEach(k => byId(k) && all.add(byId(k))); if (c.type === 'frame') onFrame(c).forEach(k => all.add(k)); });
    const list = [...all], x0 = Math.min(...list.map(c => c.x)) - 24, y0 = Math.min(...list.map(c => c.y)) - 40, x1 = Math.max(...list.map(c => c.x + c.w)) + 24, y1 = Math.max(...list.map(c => c.y + c.h)) + 24;
    const keep = { ...view }, keepSel = [...sel], r = stage.getBoundingClientRect(), bw = x1 - x0, bh = y1 - y0;
    selectOnly([]); selWire = null; selWires.clear(); endEdit(); renderWires(); document.body.classList.add('exporting');
    const z = Math.min((r.width - 60) / bw, (r.height - 60) / bh, 2); view = { x: (r.width - bw * z) / 2 - x0 * z, y: (r.height - bh * z) / 2 - y0 * z, z }; applyView();
    await nextFrame(); await new Promise(res => setTimeout(res, 150));
    try {
      const saved = await MB.exportRect({ x: r.left + (r.width - bw * z) / 2, y: r.top + (r.height - bh * z) / 2, w: bw * z, h: bh * z, name, pdf, scale: Math.min(4, 2 / Math.min(z, 1)) });
      if (saved) chirp(`Saved “${saved}” ✦`, 3500);
    } catch (e) { say(e.message, 4000); }
    finally { document.body.classList.remove('exporting'); view = keep; applyView(); selectOnly(keepSel); }
  }
  function boardMenu(e, items) {
    $('rowMenu')?.remove(); const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    m.innerHTML = items.map((it, i) => it === '-' ? '<span class="rm-sep"></span>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.label}</button>`).join('');
    document.body.appendChild(m); const rr = m.getBoundingClientRect(); if (rr.bottom > innerHeight - 10) m.style.top = innerHeight - rr.height - 10 + 'px'; if (rr.right > innerWidth - 10) m.style.left = innerWidth - rr.width - 10 + 'px';
    m.onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; m.remove(); items[+b.dataset.i].run(); };
    setTimeout(() => addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', off, true); } }, true));
  }
  const cardName = cs => (cs.length === 1 ? (cs[0].name || cs[0].text || cs[0].title || cs[0].label || ({ image: 'Image', stamp: 'Stamp', shape: 'Shape' }[cs[0].type]) || 'Card') : `${board.name} – ${cs.length} cards`).toString().slice(0, 60).trim() || 'Card';
  stage.addEventListener('contextmenu', e => {
    // holding something (a sticker, a note to place, a shape) or a picker is open: a right-click just puts it down, like Esc
    if (placing || ['stampWheel', 'stampPick', 'shapePick', 'tplPick'].some(id => $(id).classList.contains('on'))) { e.preventDefault(); stopPlacing(); return; }
    if (e.target.closest('.dock, .side, .tray, .top, .home, .docview, .cpop, .settings')) return;
    e.preventDefault(); let el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card');   // the pointer may be captured, so look at what's really under it
    // things are selected and you right-click empty board: the menu is still about what you selected (click empty board first to get the board's own menu)
    if (!el && sel.size) el = cardsEl.querySelector(`[data-id="${[...sel][0]}"]`);
    if (el) {
      if (!sel.has(el.dataset.id)) selectOnly(groupOf(el.dataset.id)); const cs = selCards();   // like a click: a grouped piece means its group, unless you picked the piece
      boardMenu(e, [
        ...(cs.length > 1 && !cs.every(c => c.group && c.group === cs[0].group) ? [{ label: 'Group  ⌘G', run: () => { remember(); groupSel(true); } }] : []),
        ...(cs.some(c => c.group) ? [{ label: 'Ungroup  ⇧⌘G', run: () => { remember(); groupSel(false); } }] : []),
        ...(!(cs.length === 1 && cs[0].type === 'section') ? [{ label: 'Create section  ⌥⌘G', run: () => makeSection(cs) }] : []),
        ...(cs.length === 1 && cs[0].type === 'section' ? [{ label: 'Rename section', run: () => renameSection(cs[0]) }] : []),
        ...(cs.some(c => c.type === 'section') ? [{ label: 'Remove section', run: () => removeSection(cs.filter(c => c.type === 'section')) }] : []),
        ...(cs.some(c => TILTS(c) && Math.round(c.type === 'stamp' && !c.tilted ? 0 : c.r || 0)) ? [{ label: cs.length > 1 ? 'Reset tilts' : 'Reset tilt', run: () => { remember(); cs.filter(TILTS).forEach(c => { c.r = 0; c.tilted = true; renderCard(c); }); selectOnly(cs.map(c => c.id)); $('selbar').dataset.key = ''; save(); } }] : []),
        ...fileMenu(cs), ...maskMenuItems(cs), ...tableMenu(cs, e),
        ...(cs.some(c => SIZED.includes(c.type)) ? [{ label: 'Save text style', run: () => saveTextStyle(cs.find(c => SIZED.includes(c.type))) },
          ...(board.styles.text.length ? [{ label: 'Text style', sub: board.styles.text.map(st => ({ label: esc(st.name), run: () => applyTextStyle(st, cs) })) }] : [])] : []),
        { label: 'Arrange', sub: arrangeSub() }, '-',
        { label: 'Export as image', run: () => exportCards(cs, cardName(cs), false) },
        { label: 'Export as PDF', run: () => exportCards(cs, cardName(cs), true) },
        ...(cs.length > 1 ? [{ label: 'Save each as its own image', run: () => exportEach(cs) }] : []),
        ...(cs.length > 1 && cs.every(c => c.src && (c.type === 'image' || c.type === 'box')) ? [{ label: `Save ${cs.length} pictures as PNG…`, run: () => savePictures(cs, 'png') }, { label: `Save ${cs.length} pictures as JPEG…`, run: () => savePictures(cs, 'jpg') }] : []),
        ...(spotsIn(cs).length ? [{ label: `Fill ${spotsIn(cs).length} image spot${spotsIn(cs).length > 1 ? 's' : ''}…`, run: () => offerFill(spotsIn(cs)) }] : []), '-',
        { label: 'Duplicate', run: () => { remember(); const gm = {}, copies = withMaskGroups(cs).filter(c => c.type !== 'coll').map(c => Object.assign(JSON.parse(JSON.stringify(c)), { id: uid(), r: tilt(), x: c.x + 30, y: c.y + 30 })); copies.forEach(c => { if (c.group) c.group = gm[c.group] || (gm[c.group] = uid()); }); copies.forEach(c => addCard(c)); selectOnly(copies.map(c => c.id)); } },
        { label: 'Delete', danger: true, run: () => removeSelected() }]);
    } else boardMenu(e, [
      ...(MB.native ? [{ label: 'Put a file here…', run: () => pickPut(toWorld(e.clientX, e.clientY)) },
        connected.some(f => !f.missing) ? { label: 'Show a folder here', sub: connected.filter(f => !f.missing).map(f => ({ label: esc(f.name), run: () => putFolderCard(f, toWorld(e.clientX, e.clientY)) })) } : { label: 'Connect a folder…', run: connectFolder }, '-'] : []),
      { label: 'Background color…', run: () => tintPicker('bg', { x: e.clientX + 12, y: e.clientY - 40 }, true) },
      ...(board.bg ? [{ label: 'Use the default background', run: () => { delete board.bg; save(); applyColors(); } }] : []),
      '-',
      { label: 'Export board as image', run: () => exportCards(board.cards, board.name, false) },
      { label: 'Export board as PDF', run: () => exportCards(board.cards, board.name, true) }]);
  });

  // ---------- voice memos: record straight onto the board, play them back, and Mochi writes them out ----------
  const PLAY = '<svg viewBox="0 0 12 12"><path d="M3 1.6v8.8L10.2 6z"/></svg>', PAUSE = '<svg viewBox="0 0 12 12"><rect x="2.2" y="1.8" width="2.6" height="8.4" rx=".8"/><rect x="7.2" y="1.8" width="2.6" height="8.4" rx=".8"/></svg>';
  const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const live = new Map();     // card id → { recorder, stream, timer, ... } while recording
  const players = new Map();  // card id → Audio
  // a memo that leaves the board (deleted, cut, undone, or another board opened) stops playing, and a recording in progress lets go of the mic
  function stopGone() {
    const here = new Set(board.cards.map(c => c.id));
    players.forEach((p, id) => { if (!here.has(id)) { p.pause(); p.removeAttribute('src'); p.load(); players.delete(id); } });
    live.forEach((L, id) => { if (!here.has(id)) { L.gone = true; live.delete(id); try { L.recorder.state !== 'inactive' ? L.recorder.stop() : 0; } catch (e) {} L.stream.getTracks().forEach(t => t.stop()); try { L.ac.close(); } catch (e) {} } });
  }
  // every way a card can leave (Delete, cut, undo, Mochi, tidying, opening another board) takes it off the page, so watch for that
  let goneSoon = 0;
  new MutationObserver(ms => { if ((!players.size && !live.size) || goneSoon || !ms.some(m => m.removedNodes.length)) return; goneSoon = requestAnimationFrame(() => { goneSoon = 0; stopGone(); }); }).observe(cardsEl, { childList: true, subtree: true });
  const MIC = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7.5" y="2.5" width="5" height="9.5" rx="2.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/></svg>';
  function fitAudio(c, el) { const b = el.querySelector('.body'); if (!b) return; b.style.height = 'auto'; const h = Math.max(150, b.offsetHeight); b.style.height = ''; if (Math.abs(h - c.h) > 2) { c.h = h; el.style.height = h + 'px'; renderWires(); } }
  // the first time someone picks the voice memo tool, ask for the mic (and speech) right then; macOS remembers the answer
  let micOK = false, warm = null, warmT = 0;
  // the mic switches on as soon as the tool is picked, so the first words aren't lost while it wakes up; it switches off again if nothing gets recorded
  function warmMic(st) { clearTimeout(warmT); if (warm && warm !== st) warm.getTracks().forEach(t => t.stop()); warm = st; warmT = setTimeout(coolMic, 60000); }
  function coolMic() { if (warm && !live.size) { warm.getTracks().forEach(t => t.stop()); warm = null; } }
  // ---------- video cards: record yourself with the camera, or drop in a video file ----------
  const SPK = '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8v4h3l4 3.5v-11l-4 3.5z"/><path class="w" d="M13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.5 6.5 0 0 1 0 9"/></svg>';
  const vids = new Map(), cams = new Map(), VBAR = 44;
  // flip: what you see is what you record. On (the default) mirrors you like a selfie; off shows the room the right way round, so writing reads normally
  const camFlip = () => settings.camFlip !== false;
  function paintLook() { cams.forEach(cam => { cam.view.style.transform = camFlip() ? 'scaleX(-1)' : 'none'; }); }
  const vEl = id => cardsEl.querySelector(`[data-id="${id}"]`);
  function setupVideo(c, el) {
    if (c.src) {
      let v = vids.get(c.id);
      if (!v) { v = document.createElement('video'); v.className = 'vd-v'; v.playsInline = true; v.preload = 'metadata'; if (c.poster) v.poster = c.poster; vids.set(c.id, v);
        MB.mediaURL(c.src).then(u => { if (u) v.src = u; });
        const paint = () => { const e2 = vEl(c.id); if (!e2) return; const f = (v.currentTime || 0) / (v.duration || c.dur || 1);
          const bar = e2.querySelector('.vd-prog i'); if (bar) bar.style.width = (f * 100).toFixed(2) + '%';
          const t = e2.querySelector('.vd-time'); if (t) t.textContent = v.paused && !v.currentTime ? fmtT(c.dur || v.duration || 0) : `${fmtT(v.currentTime)} / ${fmtT(c.dur || v.duration || 0)}`; };
        v.addEventListener('timeupdate', paint); v.addEventListener('seeked', paint);
        ['play', 'pause', 'ended'].forEach(t => v.addEventListener(t, () => { vEl(c.id)?.classList.toggle('playing', !v.paused); paint(); }));
        v.addEventListener('loadedmetadata', () => { if (!c.dur && isFinite(v.duration)) { c.dur = v.duration; save(); } paint(); }); }
      v.muted = !!c.muted; v.style.transform = c.mirror ? 'scaleX(-1)' : ''; el.querySelector('.vd-v').replaceWith(v); el.classList.toggle('playing', !v.paused);
      return;
    }
    const cam = cams.get(c.id), slot = el.querySelector('.vd-live');
    if (slot && cam) { slot.replaceWith(cam.view); cam.view.play().catch(() => {}); }
  }
  async function camOn(c) {
    if (cams.has(c.id)) return cams.get(c.id);
    let stream; try { stream = await openMedia(true); }
    catch (e) { c.camErr = `Mochiboard needs the camera. Turn it on in ${privacy('Camera')}, then click Start recording again.`; c.camRest = false; renderCard(c); return null; }
    const view = document.createElement('video'); view.className = 'vd-live'; view.muted = true; view.playsInline = true; view.autoplay = true; view.srcObject = stream;
    view.style.transform = camFlip() ? 'scaleX(-1)' : 'none';
    const cam = { stream, view, idle: 0 }; cams.set(c.id, cam); c.camErr = ''; c.camRest = false;
    // the camera rests after a minute of waiting (no recording), and switches off if the card goes away
    cam.tick = setInterval(() => { if (!vEl(c.id) || (!c.rec && (cam.idle += 2) >= 60)) { camOff(c.id); if (byId(c.id) && !c.src) { c.camRest = true; renderCard(c); } } }, 2000);
    renderCard(c); return cam;
  }
  function camOff(id) { const cam = cams.get(id); if (!cam) return; clearInterval(cam.tick); cam.stream.getTracks().forEach(t => t.stop()); cams.delete(id); }
  async function videoRecord(c) {
    const cam = await camOn(c); if (!cam) return;
    const type = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    let stream = cam.stream, stopSlice = () => {};
    // a wide video records straight from the camera (true colors) and is shown mirrored on the board if flip is on;
    // a phone-shaped one is cut frame by frame anyway, so its flip is drawn right in
    c.mirror = !c.vert && camFlip() || undefined;
    if (c.vert) {
      const st = cam.stream.getVideoTracks()[0]?.getSettings() || {}, W0 = cam.view.videoWidth || st.width || 1280, H0 = cam.view.videoHeight || st.height || 720;   // the real frame size, not what the camera says it sends
      const H = H0, W = c.vert ? Math.round(H * 9 / 16 / 2) * 2 : Math.round(W0 / 2) * 2, cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = W; cv.height = H; let on = true;
      (function slice() { if (!on) return; try { const fw = cam.view.videoWidth || W0, fh = cam.view.videoHeight || H0, sw = c.vert ? Math.round(fh * 9 / 16) : fw, flip = camFlip();
        g.save(); if (flip) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(cam.view, (fw - sw) / 2, 0, sw, fh, 0, 0, W, H); g.restore(); } catch (e) {} requestAnimationFrame(slice); })();   // re-measured every frame, in case the camera changes size; flip can change mid-recording
      stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...cam.stream.getAudioTracks()]); stopSlice = () => { on = false; stream.getVideoTracks().forEach(t => t.stop()); }; }
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: c.vert ? 3000000 : 2500000 } : undefined), chunks = [];
    cam.rec = rec; cam.idle = 0; c.rec = true; c.ready = false; selectOnly([c.id]);
    for (const n of [3, 2, 1]) { c.count = n; renderCard(c); await new Promise(r => setTimeout(r, 700)); if (!cams.has(c.id) || !c.rec) return; }
    c.count = 0; renderCard(c);
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = async () => { stopSlice(); const blob = new Blob(chunks, { type: (rec.mimeType || 'video/mp4').split(';')[0] }), secs = (Date.now() - cam.t0) / 1000; camOff(c.id);
      const when = new Date(); c.title = c.title || `Video · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      await fillVideo(c, blob, secs); };
    cam.t0 = Date.now(); rec.start(500);
    (function clock() { const e2 = vEl(c.id); if (!c.rec || !cams.has(c.id)) return; const t = e2?.querySelector('.vd-rtime'); if (t) t.textContent = fmtT((Date.now() - cam.t0) / 1000);
      if (Date.now() - cam.t0 > 15 * 60 * 1000) return videoAct(c, 'vd-stop');   // a 15 minute limit keeps files a sensible size
      setTimeout(clock, 250); })();
  }
  // a still from the video (for the poster and the board's thumbnails), plus its size and length
  function videoInfo(url) {
    return new Promise(res => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; let done = false;
      const finish = poster => { if (done) return; done = true; res({ poster, vw: v.videoWidth, vh: v.videoHeight, dur: isFinite(v.duration) ? v.duration : 0 }); };
      v.onloadeddata = () => { try { v.currentTime = Math.min(.3, (v.duration || 1) / 10); } catch (e) { finish(''); } };
      v.onseeked = () => { try { const W = 480, cv = document.createElement('canvas'); cv.width = W; cv.height = Math.round(W * v.videoHeight / (v.videoWidth || 1)) || 270; cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); finish(cv.toDataURL('image/jpeg', .8)); } catch (e) { finish(''); } };
      v.onerror = () => finish(''); setTimeout(() => finish(''), 8000); });
  }
  async function fillVideo(c, blob, secs) {
    if (blob.size > 1024 * 1024 * 1024) return say('That video is over 1 GB, which is too big for a board. Try a shorter clip ✦', 7000);
    c.rec = false; c.ready = false; c.count = 0; c.saving = true; c.pct = 0; c.title = c.title || (blob.name ? blob.name.replace(/\.[^.]+$/, '') : 'Video'); renderCard(c);
    const local = URL.createObjectURL(blob), info = await videoInfo(local); URL.revokeObjectURL(local);
    let src; try { src = await MB.saveMedia(blob, f => { c.pct = f; const s2 = vEl(c.id)?.querySelector('.vd-msg span'); if (s2) s2.textContent = Math.round(f * 100) + '%'; }); }
    catch (e) { c.saving = false; c.ready = true; renderCard(c); return say("I couldn't save that video: " + e.message, 8000); }
    vids.get(c.id)?.pause(); vids.delete(c.id);
    Object.assign(c, { saving: false, pct: 0, src, poster: info.poster, dur: info.dur || secs || 0, vw: info.vw, vh: info.vh });
    if (info.vw && info.vh) c.h = Math.round(c.w * info.vh / info.vw) + VBAR;
    renderCard(c); selectOnly([c.id]); save();
  }
  function addVideo(file, at) {
    const p = at || centerWorld(), c = card('video', { title: file.name.replace(/\.[^.]+$/, '') }); c.x = p.x - c.w / 2; c.y = p.y - c.h / 2; addCard(c); fillVideo(c, file);
  }
  function videoAct(c, act, e) {
    const v = vids.get(c.id), el = vEl(c.id);
    if (act === 'vd-play' && v) { if (v.paused) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
    if (act === 'vd-seek' && v && e) { const r = el.querySelector('.vd-prog').getBoundingClientRect(); v.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * (v.duration || c.dur || 0); }
    if (act === 'vd-mute') { c.muted = !c.muted; if (v) v.muted = c.muted; renderCard(c); save(); }
    if (act === 'vd-wake') camOn(c);
    // writing out what was said: the words open under the video, with Turn into notes and Copy
    if (act === 'vd-tx') { if (c.text) return; if (!c.txShown) { c.txShown = true; c.h += 120; } c.txNote = 'Mochi is writing it out…'; c.needTx = false; renderCard(c); save(); return transcribe(c, true); }
    if (act === 'vd-notes') return ask(`This is what I said in a video I recorded (card ${c.id}). Turn it into short notes on the board, placed just to the right of that card, grouped if there are a few ideas:\n"${c.text}"`);
    if (act === 'vd-copy') { navigator.clipboard?.writeText(c.text || '').then(() => chirp('Copied ✦', 1600), () => {}); return; }
    if (act === 'vd-flip') { settings.camFlip = settings.camFlip === false; applySettings(); paintLook(); renderCard(c); }
    if (act === 'vd-dev') return devicePick(e, [['videoinput', 'Camera', 'camId'], ['audioinput', 'Microphone', 'micId']], () => { camOff(c.id); camOn(c); });
    if ((act === 'vd-wide' || act === 'vd-tall') && !c.rec) { const vert = act === 'vd-tall'; if (!!c.vert === vert) return;
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2; c.vert = vert; c.w = vert ? 230 : 360; c.h = vert ? Math.round(230 * 16 / 9) + VBAR : 246; c.x = cx - c.w / 2; c.y = cy - c.h / 2; renderCard(c); selectOnly([c.id]); save(); }
    if (act === 'vd-start') videoRecord(c);
    if (act === 'vd-stop') { const cam = cams.get(c.id);
      if (cam?.rec && cam.rec.state !== 'inactive' && !c.count) cam.rec.stop();
      else { c.rec = false; c.count = 0; c.ready = true; renderCard(c); } }   // stopped during the countdown: back to ready (nothing was sliced yet)
    if (act === 'vd-file') { $('filePick').dataset.into = c.id; $('filePick').click(); }
  }

  const privacy = what => MB.platform === 'windows' ? `Windows Settings → Privacy & security → ${what}` : `System Settings → Privacy & Security → ${what}`;
  // ---------- which camera and microphone: the person picks, Mochiboard remembers, and falls back to the default if one is unplugged ----------
  const micC = () => settings.micId ? { deviceId: { exact: settings.micId } } : true;
  async function openMedia(video) {
    const want = () => ({ audio: micC(), video: video ? { width: { ideal: 1920 }, height: { ideal: 1080 }, ...(settings.camId ? { deviceId: { exact: settings.camId } } : {}) } : false });
    try { return await navigator.mediaDevices.getUserMedia(want()); }
    catch (e) { if (!/Overconstrained|NotFound|NotReadable/.test(e.name || '') || !(settings.micId || settings.camId)) throw e;
      delete settings.micId; delete settings.camId; applySettings(); return navigator.mediaDevices.getUserMedia(want()); }
  }
  const devName = (track, fallback) => (track?.label || fallback).replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').replace(/^(Default|Communications) - /, '').trim() || fallback;
  // the little menu: cameras (for video) and microphones, the one in use checked
  async function devicePick(e, kinds, onPick) {
    let list = []; try { list = await navigator.mediaDevices.enumerateDevices(); } catch (er) {}
    const items = [];
    for (const [kind, title, key] of kinds) {
      const ds = list.filter(d => d.kind === kind && d.deviceId && d.deviceId !== 'communications'); if (!ds.length) continue;
      if (items.length) items.push('-');
      items.push({ label: `<span class="dm-h">${title}</span>`, run: () => {} });
      const def = ds.find(d => d.deviceId === 'default'), cur = settings[key] || (def && ds.find(d => d.deviceId !== 'default' && d.groupId === def.groupId) || def || ds[0]).deviceId;   // "default" is a stand-in: check the real device behind it
      ds.filter(d => !(d.deviceId === 'default' && ds.length > 1)).forEach(d => items.push({ label: `<span class="dm-ck">${d.deviceId === cur ? '✓' : ''}</span>${esc(devName(d, title))}`, run: () => { settings[key] = d.deviceId; applySettings(); onPick(); } }));
    }
    if (!items.length) items.push({ label: 'No devices found', run: () => {} });
    boardMenu(e, items);
  }

  async function readyToRecord() {
    if (micOK) { if (!warm) try { warmMic(await openMedia(false)); } catch (e) {} return true; }
    try { warmMic(await openMedia(false)); }
    catch (e) { say(`Mochiboard needs the microphone for voice memos. Turn it on in ${privacy('Microphone')}, then try again ✦`, 10000); return false; }
    micOK = true;
    const sp = await MB.speechAuth().catch(() => 'off');
    if (sp === 'off') say("Recording works! To have me write memos out, turn on Speech Recognition for Mochiboard in System Settings → Privacy & Security.", 9000);
    return true;
  }
  async function record(c) {
    let stream = warm && warm.active ? warm : null; warm = null; clearTimeout(warmT);
    try { if (!stream) stream = await openMedia(false); }
    catch (e) { say(`I can't hear you yet. Let Mochiboard use the microphone (${privacy('Microphone')}), then try again.`, 9000); if (!c.src) { sel = new Set([c.id]); removeSelected(); } return; }
    const chunks = [], recorder = new MediaRecorder(stream), ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 256; ac.createMediaStreamSource(stream).connect(an);
    const L = { recorder, stream, ac, start: Date.now(), paused: 0, pausedAt: 0 }; live.set(c.id, L);
    c.rec = true; c.ready = false; c.paused = false; c.starting = true; renderCard(c); selectOnly([c.id]);
    recorder.onstart = () => { c.starting = false; L.start = Date.now(); renderCard(c); };   // only say "Recording…" once it's really listening
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      if (L.gone) return;   // the card was deleted while it was recording: nothing to keep
      stream.getTracks().forEach(t => t.stop()); ac.close(); live.delete(c.id);
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/mp4' }), url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      let wave = [], dur = (Date.now() - L.start - L.paused) / 1000;
      try { const buf = await new AudioContext().decodeAudioData(await blob.arrayBuffer()), d = buf.getChannelData(0), n = 44, step = Math.floor(d.length / n); dur = buf.duration;
        for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step; j += 16) m = Math.max(m, Math.abs(d[j])); wave.push(m); }
        const top = Math.max(...wave, .01); wave = wave.map(v => +(v / top).toFixed(2)); } catch (e) { wave = Array(44).fill(.3); }
      const when = new Date();
      Object.assign(c, { rec: false, paused: false, src: url, dur, wave, text: '', txNote: '', title: c.title || `Voice memo · ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` });
      renderCard(c); save(); transcribe(c);
    };
    // count 3·2·1 right away while the mic wakes up in the background; recording starts on "go" once real sound is coming in
    (async () => {
      const buf = new Uint8Array(an.fftSize), awake = () => { an.getByteTimeDomainData(buf); return buf.some(v => Math.abs(v - 128) > 1); };
      for (const n of [3, 2, 1]) { c.count = n; renderCard(c); await new Promise(r => setTimeout(r, 650)); if (!live.has(c.id)) return; }
      const t0 = Date.now(); if (!awake()) { c.count = 'connecting'; renderCard(c); }
      while (!awake() && Date.now() - t0 < 8000) { await new Promise(r => setTimeout(r, 60)); if (!live.has(c.id)) return; }
      c.count = 0; recorder.start(250);
    })();
    const cv = () => cardsEl.querySelector(`[data-id="${c.id}"] .au-live`), data = new Uint8Array(an.frequencyBinCount);
    (function draw() {
      if (!live.has(c.id)) return; const el = cardsEl.querySelector(`[data-id="${c.id}"]`), canvas = cv();
      if (canvas) { // the canvas matches the size it's shown at, so the bars grow with the card instead of stretching
        const W = Math.round(canvas.clientWidth * 2), H = Math.round(canvas.clientHeight * 2); if (W && H && (canvas.width !== W || canvas.height !== H)) { canvas.width = W; canvas.height = H; }
        const g = canvas.getContext('2d'); an.getByteTimeDomainData(data); g.clearRect(0, 0, canvas.width, canvas.height); g.fillStyle = '#f27aa8';
        const step = canvas.width / 44, bw = step * .58, r = Math.min(bw / 2, 6);
        for (let i = 0; i < 44; i++) { const v = Math.abs(data[Math.floor(i * data.length / 44)] - 128) / 128, h = Math.min(canvas.height, Math.max(bw, v * canvas.height * 2.2)); g.beginPath(); g.roundRect ? g.roundRect(i * step, (canvas.height - h) / 2, bw, h, r) : g.rect(i * step, (canvas.height - h) / 2, bw, h); g.fill(); } }
      const t = el?.querySelector('.au-time'); if (t && !c.paused) t.textContent = fmtT((Date.now() - L.start - L.paused) / 1000);
      requestAnimationFrame(draw);
    })();
  }
  // a video's sound, as a plain 16 kHz mono WAV: what the Mac's speech recognizer and Whisper both read
  // voice memos go through it too: the Mac's recognizer only heard the last few seconds of the recorder's own fragmented .mp4
  async function videoAudio(c) {
    let buf;
    try { const ab = await (await fetch(c.type === 'video' ? await MB.mediaURL(c.src) : c.src)).arrayBuffer(), ac = new (window.AudioContext || window.webkitAudioContext)(); buf = await ac.decodeAudioData(ab); ac.close?.(); }
    catch (e) { throw new Error(c.type === 'video' ? 'This video has no sound to write out.' : "I couldn't read that recording."); }
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * 16000)), 16000), s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start();
    const pcm = (await off.startRendering()).getChannelData(0), n = pcm.length, out = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (o, t) => [...t].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    const u8 = new Uint8Array(out.buffer); let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return 'data:audio/wav;base64,' + btoa(bin);
  }
  async function transcribe(c, asked) {
    if (MB.whisperStatus) { c.txNote = 'Mochi is writing it out…'; renderCard(c); }
    try { const text = await MB.transcribe(await videoAudio(c)); c.text = (text || '').trim(); c.txNote = c.text ? '' : "I couldn't make out any words in that one."; }
    catch (e) {
      if (e.message === 'NEED_WHISPER') { c.txNote = 'Not written out yet.'; c.needTx = true; renderCard(c); save(); offerWhisper(asked); return; }
      c.txNote = e.message; }
    c.needTx = false;
    renderCard(c); save();
    const what = c.type === 'video' ? 'video' : 'voice memo';
    if (c.text && (!settings.ai || haveClaude === false)) say(`I wrote out your ${what} ✦`, 4000);
    else if (c.text) say(`I wrote out your ${what} ✦ Want me to turn it into notes?`, 6000, [{ label: 'Turn into notes', run: () => c.type === 'video' ? videoAct(c, 'vd-notes') : audioAct(c, 'au-notes') }, { label: 'Not now', ghost: true, run: () => {} }]);
  }
  // Windows/Linux: Whisper writes memos out on this computer. The first memo asks once; after that it just happens.
  let whisperBusy = false;
  function offerWhisper(force) {
    let asked = false; try { asked = !!localStorage.getItem('mochiboard:whisperAsked'); } catch (e) {}
    if (asked && !force) return; try { localStorage.setItem('mochiboard:whisperAsked', '1'); } catch (e) {}
    say("Want me to write out your voice memos? I learn once (a 140 MB download), then it all happens right here on your computer, privately ✦", 0,
      [{ label: 'Yes, set it up', run: setupWhisper }, { label: 'Not now', ghost: true, run: () => say('No problem! Your memos still record and play. Tap “Write it out” on one anytime, or turn it on in Settings → Helpers.', 7000) }]);
  }
  async function setupWhisper() {
    if (whisperBusy || !MB.whisperGet) return; whisperBusy = true;
    try { await MB.whisperGet(); } catch (e) {}
    for (;;) {
      await new Promise(r => setTimeout(r, 600)); let st = {}; try { st = await MB.whisperStatus(); } catch (e) { break; }
      paintWhisper(st);
      if (st.ready) { whisperBusy = false; say("All set! I’ll write out your voice memos from now on ✦", 5000); board.cards.filter(c => (c.type === 'audio' || (c.type === 'video' && c.needTx)) && c.src && !c.text).forEach(c => transcribe(c)); return; }
      if (st.error) { whisperBusy = false; say(st.error, 8000, [{ label: 'Try again', run: setupWhisper }]); return; }
      if (st.downloading) say(`Learning to listen… ${Math.round((st.progress || 0) * 100)}%`, 0);
    }
    whisperBusy = false;
  }
  async function paintWhisper(st) {
    const row = $('whRow'); if (!row || !MB.whisperStatus) return; row.hidden = false;
    if (!st) try { st = await MB.whisperStatus(); } catch (e) { st = {}; }
    $('whState').textContent = st.ready ? 'Ready. Memos are written out on this computer.' : st.downloading ? `Downloading… ${Math.round((st.progress || 0) * 100)}%` : 'Off. A one-time 140 MB download, then it works offline.';
    $('whGo').hidden = !!st.ready || !!st.downloading;
  }
  function audioAct(c, act, e) {
    const L = live.get(c.id), el = cardsEl.querySelector(`[data-id="${c.id}"]`);
    if (act === 'au-stop' && L) { if (L.recorder.state !== 'inactive') L.recorder.stop();
      else { L.stream.getTracks().forEach(t => t.stop()); L.ac.close(); live.delete(c.id); c.rec = false; c.count = 0; c.starting = false; if (!c.src) c.ready = true; renderCard(c); save(); } }   // stopped before it began
    if (act === 'au-pause' && L && L.recorder.state === 'inactive') return;
    if (act === 'au-pause' && L) { if (c.paused) { L.recorder.resume(); L.paused += Date.now() - L.pausedAt; } else { L.recorder.pause(); L.pausedAt = Date.now(); } c.paused = !c.paused; renderCard(c); }
    if (act === 'au-start') { readyToRecord().then(ok => { if (ok) record(c); }); return; }
    if (act === 'au-tx') { transcribe(c, true); return; }
    if (act === 'au-dev') return devicePick(e, [['audioinput', 'Microphone', 'micId']], async () => { if (warm) { warm.getTracks().forEach(t => t.stop()); warm = null; } await readyToRecord(); renderCard(c); });
    if (act === 'au-replace') { players.get(c.id)?.pause(); players.delete(c.id); record(c); }
    if (act === 'au-notes') ask(`This is a voice memo I recorded (card ${c.id}). Turn it into short notes on the board, placed just to the right of that card, grouped if there are a few ideas:\n"${c.text}"`);
    if (act === 'au-play' || act === 'au-seek') {
      let p = players.get(c.id); if (!p) { p = new Audio(c.src); players.set(c.id, p); }
      if (act === 'au-seek' && e) { const r = el.querySelector('.au-wave').getBoundingClientRect(); p.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * (c.dur || p.duration || 0); if (p.paused) p.play(); }
      else if (p.paused) p.play(); else p.pause();
      const tick = () => { const e2 = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!e2) return; const f = (p.currentTime || 0) / (c.dur || p.duration || 1);
        e2.querySelectorAll('.au-wave i').forEach((b, i, all) => b.classList.toggle('past', i / all.length < f));
        e2.querySelector('.au-time').textContent = `${fmtT(p.currentTime || 0)} / ${fmtT(c.dur || 0)}`; const pb = e2.querySelector('.au-play'); pb.innerHTML = p.paused ? PLAY : PAUSE; pb.classList.toggle('on', !p.paused);
        if (!p.paused) requestAnimationFrame(tick); };
      p.onended = tick; requestAnimationFrame(tick);
    }
  }

  // ---------- wireframes: screens, boxes and text, a design panel, and snapping ----------
  const WF = ['frame', 'box', 'text', 'icon'];
  const DEVICES = { iPhone: [393, 852, 44], Android: [412, 915, 28], iPad: [834, 1194, 20], Desktop: [1440, 1024, 10], Watch: [205, 251, 40] };
  let FONTS = ['DM Sans', 'Inter', 'Helvetica Neue', 'Georgia']; MB.fonts().then(f => { if (f?.length) FONTS = f; }).catch(() => {});
  function styleWF(c, el) {
    el.classList.add('wf'); c.r = 0; el.style.setProperty('--rot', (c.rot || 0) + 'deg'); el.classList.toggle('grouped', !!c.group);
    if (!el.querySelector('.rot-h')) el.insertAdjacentHTML('beforeend', '<i class="rot-h" title="Drag to rotate"></i>');
    if (c.type === 'icon') { el.style.setProperty('--isz', Math.min(c.w, c.h) + 'px'); el.style.setProperty('--ic', c.color || '#27272a'); }
    if (c.type === 'frame') { el.style.setProperty('--fr-fill', c.fill === 'none' ? 'transparent' : c.fill || '#ffffff'); el.classList.toggle('no-fill', c.fill === 'none'); el.style.setProperty('--fr-r', (c.radius ?? 0) + 'px'); }
    if (c.type === 'box') Object.assign(el.querySelector('.bx').style, { background: c.src ? 'transparent' : c.fill === 'none' ? 'transparent' : c.fill || '#e4e4e7', borderRadius: (c.radius || 0) + 'px', opacity: c.opacity ?? 1,
      boxShadow: 'none', border: '0' });
    if (c.type === 'text') { el.style.height = 'auto'; Object.assign(el.querySelector('.tx').style, { fontFamily: `"${c.font || 'DM Sans'}", system-ui`, fontSize: (c.size || 18) + 'px', fontWeight: c.weight || 500,
      color: c.color && c.color !== 'none' ? c.color : '#27272a', textAlign: c.align || 'left', lineHeight: c.lh || 1.3 }); requestAnimationFrame(() => { const h = el.offsetHeight; if (h && Math.abs(h - c.h) > 1) c.h = h; }); }
    applyStroke(c, el);
  }
  // ---------- glass sections: a frosted bubble around a bunch of things. Anything whose middle sits inside it belongs to it,
  // so dragging something in makes it join and dragging it out makes it leave, with nothing to keep in sync ----------
  const SEC_PAD = 36, SEC_TOP = 58;
  const inSection = s => board.cards.filter(c => c.id !== s.id && !c.hidden && !parentOf(c.id) && !(c.type === 'section' && c.w * c.h >= s.w * s.h)
    && c.x + c.w / 2 > s.x && c.x + c.w / 2 < s.x + s.w && c.y + c.h / 2 > s.y && c.y + c.h / 2 < s.y + s.h);
  function makeSection(cs = selCards()) {
    cs = cs.filter(c => !parentOf(c.id)); if (!cs.length || !board) return;
    remember();
    const box = cs, x0 = Math.min(...box.map(c => c.x)), y0 = Math.min(...box.map(c => c.y)), x1 = Math.max(...box.map(c => c.x + c.w)), y1 = Math.max(...box.map(c => c.y + c.h));
    const s = card('section', { x: Math.round(x0 - SEC_PAD), y: Math.round(y0 - SEC_TOP), w: Math.round(x1 - x0 + SEC_PAD * 2), h: Math.round(y1 - y0 + SEC_TOP + SEC_PAD), r: 0, text: 'Section', color: 'white' });
    board.cards.unshift(s); renderCard(s, true); cardsEl.prepend(cardsEl.querySelector(`[data-id="${s.id}"]`)); save();   // behind everything it holds selectOnly([s.id]); layersSoon();
    setTimeout(() => renameSection(s), 60);
  }
  // rename: the name tab becomes editable with the old name selected, ready to type over
  function renameSection(sec) {
    startEdit(sec.id); const t = cardsEl.querySelector(`[data-id="${sec.id}"] .sec-name .text`);
    if (t) { t.focus(); const r = document.createRange(); r.selectNodeContents(t); getSelection().removeAllRanges(); getSelection().addRange(r); }
  }
  // ---------- tilt popover: type an exact angle, or pick one ----------
  function setTilt(c, deg, keepPop) {
    if (!c) return; remember(); deg = Math.max(-180, Math.min(180, Math.round(+deg || 0))); c.r = deg; c.tilted = true;
    renderCard(c); selectOnly([c.id]); $('selbar').dataset.key = ''; save();
    const inp = $('tiltPop').querySelector('input'); if (keepPop && inp && document.activeElement !== inp) inp.value = deg;
    $('tiltPop').querySelectorAll('[data-deg]').forEach(b => b.classList.toggle('on', +b.dataset.deg === deg));
    if (!keepPop) closeTiltPop();
  }
  function openTiltPop(c, btn) {
    const pop = $('tiltPop'), cur = c.type === 'stamp' && !c.tilted ? 0 : Math.round(c.r || 0);
    pop.innerHTML = `<div class="tp-row"><label class="tp-in"><span>Tilt</span><input type="number" min="-180" max="180" step="1" value="${cur}" aria-label="Tilt in degrees"><b>°</b></label><button class="tp-reset" data-deg="0" title="Straighten it"><svg viewBox="0 0 20 20"><path d="M4.5 8.5a6 6 0 1 1 1 5.5"/><path d="M4 4v4.5h4.5"/></svg>Reset</button></div>
      <div class="tp-chips">${[0, 5, 10, 15, 30, 45, 90, -5, -10, -15, -30, -45, -90].map(d => `<button data-deg="${d}" class="${d === cur ? 'on' : ''}">${d}°</button>`).join('')}</div>`;
    const r = btn.getBoundingClientRect(); pop.classList.add('on'); pop.style.left = Math.min(innerWidth - pop.offsetWidth - 10, Math.max(10, r.left + r.width / 2 - pop.offsetWidth / 2)) + 'px'; pop.style.top = r.top - pop.offsetHeight - 10 + 'px';
    const inp = pop.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 60);   // after the click that opened it has finished
    inp.oninput = () => { if (inp.value !== '' && inp.value !== '-') setTilt(c, inp.value, true); };   // the card turns as you type
    inp.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); closeTiltPop(); } ev.stopPropagation(); };
    pop.onclick = ev => { const b = ev.target.closest('[data-deg]'); if (b) setTilt(c, b.dataset.deg, true); };
  }
  function closeTiltPop() { $('tiltPop').classList.remove('on'); }
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('tiltPop').classList.contains('on')) { closeTiltPop(); e.stopPropagation(); } }, true);
  addEventListener('pointerdown', e => { if ($('tiltPop').classList.contains('on') && !e.target.closest('#tiltPop, [data-sb="tiltpop"]')) closeTiltPop(); }, true);

  // removing a section pops the bubble but leaves everything that was inside it right where it is
  function removeSection(secs) {
    if (!secs.length) return; remember();
    const kids = secs.flatMap(inSection).map(c => c.id), gone = new Set(secs.map(c => c.id));
    board.cards = board.cards.filter(c => !gone.has(c.id)); secs.forEach(c => cardsEl.querySelector(`[data-id="${c.id}"]`)?.remove());
    if (board.links) board.links = board.links.filter(l => !gone.has(l.a) && !gone.has(l.b));
    selectOnly(kids); renderWires(); layersSoon(); save();
  }
  // what's on a screen: anything whose middle sits inside it
  const onFrame = f => board.cards.filter(c => c.id !== f.id && c.type !== 'frame' && c.onFrame === f.id);
  function fileIntoFrame(cs) {
    cs.forEach(c => { const mx = c.x + c.w / 2, my = c.y + c.h / 2, f = [...board.cards].reverse().find(f => f.type === 'frame' && f.id !== c.id && mx > f.x && mx < f.x + f.w && my > f.y && my < f.y + f.h);
      if (f) c.onFrame = f.id; else delete c.onFrame;
      // landing on a screen that's above it: lift it onto the screen so it doesn't vanish underneath
      if (f && board.cards.indexOf(c) < board.cards.indexOf(f)) { board.cards.splice(board.cards.indexOf(c), 1); board.cards.splice(board.cards.indexOf(f) + 1, 0, c);
        const el = cardsEl.querySelector(`[data-id="${c.id}"]`), fe = cardsEl.querySelector(`[data-id="${f.id}"]`); if (el && fe) fe.after(el); } });
  }
  // snapping: edges and center lines line up with the things around them (any kind), with pink guides
  function snapWF(start, dx, dy) {
    const moving = new Set(start.map(s => s.c.id)), mine = start.filter(s => s.c.type !== 'ink').map(s => ({ ...s, c: { ...s.c, ...realBox(s.c) } })); $('guides').innerHTML = '';
    if (!mine.length || space) return { dx, dy };
    const x0 = Math.min(...mine.map(s => s.x)) + dx, y0 = Math.min(...mine.map(s => s.y)) + dy, x1 = Math.max(...mine.map(s => s.x + s.c.w)) + dx, y1 = Math.max(...mine.map(s => s.y + s.c.h)) + dy;
    const near = 1600 / view.z, others = board.cards.filter(c => !moving.has(c.id) && c.type !== 'ink' && !c.hidden && Math.abs(c.x - x0) < near && Math.abs(c.y - y0) < near && !parentOf(c.id)).map(c => ({ ...c, ...realBox(c) })), T = 6 / view.z;
    let bx = null, by = null;
    const mx = [x0, (x0 + x1) / 2, x1], my = [y0, (y0 + y1) / 2, y1];
    others.forEach(o => { const ox = [o.x, o.x + o.w / 2, o.x + o.w], oy = [o.y, o.y + o.h / 2, o.y + o.h];
      mx.forEach(a => ox.forEach(b => { const d = b - a; if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: b, o }; }));
      my.forEach(a => oy.forEach(b => { const d = b - a; if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: b, o }; })); });
    let g = '';
    if (bx) { dx += bx.d; const top = Math.min(y0 + dy - y0 + y0, bx.o.y), bot = Math.max(y1, bx.o.y + bx.o.h); g += `<line x1="${bx.at + O}" y1="${Math.min(y0, bx.o.y) + O - 10}" x2="${bx.at + O}" y2="${Math.max(y1, bx.o.y + bx.o.h) + O + 10}"/>`; }
    if (by) { dy += by.d; g += `<line x1="${Math.min(x0, by.o.x) + O - 10}" y1="${by.at + O}" x2="${Math.max(x1, by.o.x + by.o.w) + O + 10}" y2="${by.at + O}"/>`; }
    $('guides').innerHTML = g; return { dx, dy };
  }
  // fonts: use what's on this Mac; anything else is fetched from Google Fonts so the real type shows
  const fontsLoaded = new Set();
  const onMac = f => FONTS.some(x => x.toLowerCase() === String(f || '').toLowerCase()) || ['DM Sans', 'Caveat'].includes(f);
  function useFont(f) {
    if (!f || onMac(f) || fontsLoaded.has(f)) return; fontsLoaded.add(f);
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;700&display=swap`; document.head.appendChild(l);
  }
  // groups: ready-made pieces arrive grouped; ⌘G groups a selection, ⇧⌘G ungroups
  const groupOf = id => { const g = byId(id)?.group; return g ? board.cards.filter(c => c.group === g).map(c => c.id) : [id]; };
  // ---------- stacking: bring to front / forward, send backward / to back. Later in board.cards = higher on the board, and Layers lists it top-first ----------
  // groups move as one, a frame brings everything on it along, and a card on a frame never goes behind its frame
  function restack(where) {
    const cs = selCards(); if (!cs.length || !board) return;
    // sections always sit behind cards, so they stack among themselves; a screen stacks like a card and brings its pieces along
    const box = c => c.type === 'section', boxes = cs.every(box), peer = c => !boxes || box(c);
    // a whole group you selected moves as one (all its pieces are selected); a piece picked out of a group moves on its own
    const ids = new Set(); cs.forEach(c => { ids.add(c.id); if (c.type === 'frame' && !boxes) onFrame(c).forEach(k => ids.add(k.id)); });
    const all = board.cards, moving = all.filter(c => ids.has(c.id)), rest = all.filter(c => !ids.has(c.id)), idx = all.map((c, i) => ids.has(c.id) ? i : -1).filter(i => i >= 0);
    const seen = c => !ids.has(c.id) && !c.hidden && peer(c);
    let at;
    if (where === 'front') at = boxes ? rest.reduce((n, c, i) => box(c) ? i + 1 : n, 0) : rest.length;
    else if (where === 'back') at = 0;
    else if (where === 'forward') { const i = all.findIndex((c, k) => k > Math.max(...idx) && seen(c)); if (i < 0) return; at = rest.indexOf(all[i]) + 1; }
    else { let i = -1; for (let k = Math.min(...idx) - 1; k >= 0; k--) if (seen(all[k])) { i = k; break; } if (i < 0) return; at = rest.indexOf(all[i]); }
    moving.forEach(c => { const f = c.onFrame && !ids.has(c.onFrame) && rest.findIndex(x => x.id === c.onFrame); if (f >= 0 && f !== false) at = Math.max(at, f + 1); });
    const next = [...rest]; next.splice(at, 0, ...moving);
    if (next.every((c, i) => c === all[i])) return chirp(where === 'front' || where === 'forward' ? 'Already on top ✦' : 'Already at the back ✦', 1600);
    remember(); board.cards = next;
    // move only the restacked cards on the page, so a playing Spotify or video elsewhere keeps going
    const after = next.slice(next.indexOf(moving[moving.length - 1]) + 1).map(c => cardsEl.querySelector(`[data-id="${c.id}"]`)).find(el => el && !el.classList.contains('coll'));
    moving.forEach(c => { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) cardsEl.insertBefore(el, after || null); });
    renderWires(); save(); LY.reveal = true; layersSoon();
  }
  function groupSel(on) {
    let cs = selCards(); if (on && cs.length < 2) return;
    if (on) cs = withMaskGroups(cs);   // a mask group travels as one: grouping a member with something else brings the whole mask group along
    else { const mg = cs.filter(c => c.group && (c.maskLayer || maskLayerOf(c))); if (mg.length) { const all = withMaskGroups(mg); unmask(all); all.forEach(c => { delete c.group; renderCard(c); }); layersSoon(); save(); return; } }   // ungrouping inside a mask group = the mask turns back into a shape and the group opens
    const g = on ? uid() : null; cs.forEach(c => { if (g) c.group = g; else delete c.group; renderCard(c); }); selectOnly(cs.map(c => c.id)); $('selbar').dataset.key = ''; save(); }
  // ready-made pieces, in clean gray; bars stretch to the screen they land on
  const T = (x, y, w, text, o = {}) => { const sz = o.size || 15, perLine = Math.max(4, Math.floor(w / (sz * .52))), lines = Math.max(1, ...String(text || '').split('\n').map(l => Math.ceil(Math.max(1, l.length) / perLine)));
    return { type: 'text', x, y, w, h: Math.round(sz * (o.lh || 1.3) * lines), text, size: 15, weight: 500, color: '#27272a', font: 'DM Sans', ...o }; };
  const B = (x, y, w, h, o = {}) => ({ type: 'box', x, y, w, h, fill: '#e4e4e7', radius: 0, ...o });
  const IC = (x, y, name, s = 24, o = {}) => ({ type: 'icon', x, y, w: s, h: s, name, color: '#3f3f46', ...o });
  // each piece can take its own words: (width, { title, text, sub, label, tabs, h, align, style… })
  const PIECES = {
    'Nav bar': { icon: 'web_asset', bar: 'top', make: (W, o = {}) => [B(0, 0, W, 56, { fill: '#fafafa', stroke: '#e4e4e7', sw: 1 }), ...(o.back === false ? [] : [IC(14, 16, 'arrow_back')]), T(56, 18, W - 112, o.title || o.text || 'Title', { size: 17, weight: 700, align: 'center' }), IC(W - 38, 16, o.icon || 'more_vert')] },
    'Tab bar': { icon: 'tab', bar: 'bottom', make: (W, o = {}) => { const items = (o.tabs || [['home', 'Home'], ['search', 'Search'], ['favorite_border', 'Saved'], ['person_outline', 'Profile']]).slice(0, 5).map(t => Array.isArray(t) ? t : [t.icon || 'circle', t.label || t.text || '']), cw = W / items.length;
      return [B(0, 0, W, 64, { fill: '#fafafa', stroke: '#e4e4e7', sw: 1 }), ...items.flatMap(([n, l], i) => [IC(i * cw + cw / 2 - 12, 10, n, 24, { color: i === (o.active ?? 0) ? '#18181b' : '#71717a' }), T(i * cw, 38, cw, l, { size: 11, align: 'center', color: i === (o.active ?? 0) ? '#18181b' : '#71717a' })])]; } },
    'Button': { icon: 'smart_button', w: 160, make: (W, o = {}) => { const sec = o.style === 'secondary' || o.style === 'outline';
      return [B(0, 0, W, 48, { fill: sec ? '#ffffff' : '#27272a', stroke: sec ? '#27272a' : undefined, sw: sec ? 1.5 : 0, radius: 12 }), T(0, 14, W, o.text || 'Button', { size: 15, weight: 600, color: sec ? '#27272a' : '#ffffff', align: 'center' })]; } },
    'Input': { icon: 'input', w: 300, make: (W, o = {}) => { const top = o.label ? 22 : 0; return [...(o.label ? [T(0, 0, W, o.label, { size: 13, weight: 600, color: '#3f3f46' })] : []), B(0, top, W, 48, { fill: '#ffffff', stroke: '#d4d4d8', sw: 1.5, radius: 10 }), T(14, top + 14, W - 28, o.text || 'Placeholder', { color: '#a1a1aa' })]; } },
    'Search': { icon: 'search', w: 300, make: (W, o = {}) => [B(0, 0, W, 44, { fill: '#f4f4f5', radius: 22 }), IC(14, 10, 'search', 24, { color: '#71717a' }), T(46, 12, W - 60, o.text || 'Search', { color: '#a1a1aa' })] },
    'Card': { icon: 'crop_landscape', w: 300, make: (W, o = {}) => [B(0, 0, W, 236, { fill: '#ffffff', stroke: '#e4e4e7', sw: 1, radius: 14 }), B(10, 10, W - 20, 130, { radius: 10 }), IC(W / 2 - 12, 63, o.icon || 'image', 24, { color: '#a1a1aa' }), T(16, 154, W - 32, o.title || 'Card title', { size: 17, weight: 700 }), T(16, 182, W - 32, o.text || 'A short line about this card.', { size: 13, color: '#71717a' })] },
    'List row': { icon: 'view_list', bar: 'row', make: (W, o = {}) => [B(0, 0, W, 68, { fill: '#ffffff' }), o.icon ? IC(24, 22, o.icon, 24, { color: '#52525b' }) : B(16, 14, 40, 40, { radius: 20 }), T(68, 15, W - 120, o.title || o.text || 'Row title', { weight: 600 }), T(68, 36, W - 120, o.sub ?? 'Supporting text', { size: 13, color: '#71717a' }), IC(W - 36, 22, 'chevron_right', 24, { color: '#a1a1aa' }), B(68, 67, W - 68, 1, { fill: '#e4e4e7' })] },
    'Toggle': { icon: 'toggle_on', w: 52, make: (W, o = {}) => o.text ? [T(0, 6, W - 70, o.text), B(W - 52, 0, 52, 30, { fill: o.on === false ? '#d4d4d8' : '#27272a', radius: 15 }), B(o.on === false ? W - 49 : W - 27, 3, 24, 24, { fill: '#ffffff', radius: 12 })]
      : [B(0, 0, 52, 30, { fill: '#27272a', radius: 15 }), B(25, 3, 24, 24, { fill: '#ffffff', radius: 12 })] },
    'Checkbox': { icon: 'check_box', w: 240, make: (W, o = {}) => [B(0, 0, 22, 22, { fill: o.on === false ? '#ffffff' : '#27272a', stroke: '#27272a', sw: 1.5, radius: 6 }), ...(o.on === false ? [] : [IC(1, 1, 'check', 20, { color: '#ffffff' })]), T(32, 2, W - 32, o.text || 'Remember me')] },
    'Avatar': { icon: 'account_circle', w: 56, make: (W, o = {}) => { const s = o.size || 56; return [B(0, 0, s, s, { radius: s / 2 }), IC(s / 4, s / 4, 'person', s / 2, { color: '#a1a1aa' })]; } },
    'Image': { icon: 'image', w: 300, make: (W, o = {}) => { const h = o.h || 180; if (o.src && MB.native) return [B(0, 0, W, h, { radius: o.radius ?? 12, ...(/\.(webm|mov|mp4|m4v)$/i.test(String(o.src)) ? { fileVideo: String(o.src) } : { fileSrc: String(o.src) }), fill: 'transparent', nobg: true })]; /* their own art sits whole inside the spot (logos and cut-outs aren't cropped) */ return o.img ? [PH(0, 0, W, h, o.img, { radius: 12 })] : [B(0, 0, W, h, { radius: 12 }), IC(W / 2 - 16, h / 2 - 16, o.icon || 'image', 32, { color: '#a1a1aa' })]; } },
    'Heading': { icon: 'title', w: 300, make: (W, o = {}) => [T(0, 0, W, o.text || o.title || 'Heading', { size: o.size || 28, weight: 800, align: o.align || 'left' }), ...(o.sub === '' ? [] : [T(0, (o.size || 28) * 1.3 + 6, W, o.sub || 'A little line underneath it.', { size: 15, color: '#71717a', align: o.align || 'left' })])] },
  };
  const PH = (x, y, w, h, label, o = {}) => ({ ...B(x, y, w, h, { radius: 16, ...o }), img: label || 'Image' });
  const WEB = {
    'Header': { icon: 'web', web: 1, make: (W, o = {}) => { const links = o.links || ['Product', 'Pricing', 'About', 'Blog'], M = 64;
      return [B(0, 0, W, 80, { fill: '#ffffff' }), T(M, 26, 260, o.logo || o.title || 'Brand', { size: 22, weight: 800 }), ...links.slice(0, 5).map((l, i) => T(W / 2 - links.length * 55 + i * 110, 30, 110, l, { size: 15, align: 'center', color: '#52525b' })),
        B(W - M - 150, 18, 150, 44, { fill: '#18181b', radius: 22 }), T(W - M - 150, 30, 150, o.cta || 'Get started', { size: 14, weight: 600, color: '#ffffff', align: 'center' }), B(0, 79, W, 1, { fill: '#e4e4e7' })]; } },
    'Hero': { icon: 'view_day', web: 1, make: (W, o = {}) => { const M = 64, cw = (W - M * 2) * .48, h = 600, t = T(M, 120, cw, o.title || 'A big, clear promise goes right here', { size: 56, weight: 800, lh: 1.1 }), sub = T(M, 120 + t.h + 24, cw, o.text || 'One or two sentences that say who it is for and why it helps.', { size: 20, color: '#71717a', lh: 1.45 }), by = sub.y + sub.h + 36;
      return [B(0, 0, W, h, { fill: '#ffffff' }), t, sub, B(M, by, 170, 52, { fill: '#18181b', radius: 26 }), T(M, by + 15, 170, o.cta || 'Get started', { size: 16, weight: 600, color: '#ffffff', align: 'center' }),
        B(M + 186, by, 160, 52, { fill: '#ffffff', stroke: '#18181b', sw: 1.5, radius: 26 }), T(M + 186, by + 15, 160, o.cta2 || 'Learn more', { size: 16, weight: 600, align: 'center' }), PH(W / 2 + 16, 72, W / 2 - M - 16, h - 144, o.img || 'Hero image', { radius: 28 })]; } },
    'Features': { icon: 'view_column', web: 1, make: (W, o = {}) => { const M = 64, items = (o.items || [{ icon: 'bolt', title: 'Fast', text: 'Say what makes it quick.' }, { icon: 'favorite_border', title: 'Friendly', text: 'Say why people enjoy it.' }, { icon: 'lock', title: 'Safe', text: 'Say why they can trust it.' }]).slice(0, 4), n = items.length, gap = 32, cw = (W - M * 2 - gap * (n - 1)) / n;
      const title = T(M, 96, W - M * 2, o.title || 'Why people love it', { size: 36, weight: 800, align: 'center' }), y0 = 96 + title.h + 56; let tall = 0;
      const cols = items.flatMap((it, i) => { const x = M + i * (cw + gap), tt = T(x, y0 + 72, cw, it.title || 'Feature', { size: 20, weight: 700 }), tx = T(x, y0 + 72 + tt.h + 8, cw, it.text || '', { size: 15, color: '#71717a', lh: 1.5 }); tall = Math.max(tall, 72 + tt.h + 8 + tx.h);
        return [B(x, y0, 52, 52, { fill: '#f4f4f5', radius: 14 }), IC(x + 14, y0 + 14, it.icon || 'star', 24), tt, tx]; });
      return [B(0, 0, W, y0 + tall + 96, { fill: '#ffffff' }), title, ...cols]; } },
    'Stats': { icon: 'insights', web: 1, make: (W, o = {}) => { const M = 64, items = (o.items || [{ value: '10k+', label: 'happy people' }, { value: '4.9', label: 'average rating' }, { value: '24/7', label: 'support' }]).slice(0, 4), cw = (W - M * 2) / items.length;
      return [B(0, 0, W, 220, { fill: '#f4f4f5' }), ...items.flatMap((it, i) => [T(M + i * cw, 60, cw, it.value || '100', { size: 48, weight: 800, align: 'center' }), T(M + i * cw, 128, cw, it.label || '', { size: 15, color: '#71717a', align: 'center' })])]; } },
    'Testimonials': { icon: 'format_quote', web: 1, make: (W, o = {}) => { const M = 64, items = (o.items || [{ quote: 'A short, warm quote from a happy customer.', name: 'Alex Kim' }, { quote: 'Another quote about what changed for them.', name: 'Sam Rivera' }, { quote: 'One more, short and specific.', name: 'Jo Patel' }]).slice(0, 3), gap = 24, cw = (W - M * 2 - gap * (items.length - 1)) / items.length;
      const title = T(M, 96, W - M * 2, o.title || 'What people say', { size: 36, weight: 800, align: 'center' }), y0 = 96 + title.h + 48;
      return [B(0, 0, W, y0 + 280 + 96, { fill: '#ffffff' }), title, ...items.flatMap((it, i) => { const x = M + i * (cw + gap); return [B(x, y0, cw, 280, { fill: '#f4f4f5', radius: 20 }), IC(x + 28, y0 + 28, 'format_quote', 32, { color: '#a1a1aa' }), T(x + 28, y0 + 72, cw - 56, '“' + (it.quote || '') + '”', { size: 17, lh: 1.5 }), PH(x + 28, y0 + 208, 44, 44, (it.name || 'Person') + ' portrait', { radius: 22 }), T(x + 84, y0 + 220, cw - 112, it.name || 'Name', { size: 15, weight: 700 })]; })]; } },
    'Pricing': { icon: 'sell', web: 1, make: (W, o = {}) => { const M = 64, plans = (o.plans || [{ name: 'Starter', price: 'Free', features: ['The basics', 'One project'] }, { name: 'Pro', price: '$12/mo', features: ['Everything in Starter', 'Unlimited projects', 'Priority help'] }, { name: 'Team', price: '$29/mo', features: ['Everything in Pro', 'Shared spaces'] }]).slice(0, 3), gap = 24, cw = Math.min(360, (W - M * 2 - gap * (plans.length - 1)) / plans.length), x0 = (W - (cw * plans.length + gap * (plans.length - 1))) / 2;
      const title = T(M, 96, W - M * 2, o.title || 'Simple pricing', { size: 36, weight: 800, align: 'center' }), y0 = 96 + title.h + 48, ch = 380;
      return [B(0, 0, W, y0 + ch + 96, { fill: '#ffffff' }), title, ...plans.flatMap((pl, i) => { const x = x0 + i * (cw + gap), hot = i === Math.min(1, plans.length - 1);
        return [B(x, y0, cw, ch, { fill: hot ? '#18181b' : '#ffffff', stroke: '#e4e4e7', sw: hot ? 0 : 1.5, radius: 22 }), T(x + 28, y0 + 28, cw - 56, pl.name || 'Plan', { size: 18, weight: 700, color: hot ? '#ffffff' : '#27272a' }), T(x + 28, y0 + 62, cw - 56, pl.price || '$0', { size: 40, weight: 800, color: hot ? '#ffffff' : '#18181b' }),
          ...(pl.features || []).slice(0, 5).map((f, k) => T(x + 28, y0 + 130 + k * 30, cw - 56, '✓  ' + f, { size: 15, color: hot ? '#e4e4e7' : '#52525b' })),
          B(x + 28, y0 + ch - 76, cw - 56, 48, { fill: hot ? '#ffffff' : '#18181b', radius: 24 }), T(x + 28, y0 + ch - 62, cw - 56, pl.cta || 'Choose ' + (pl.name || 'plan'), { size: 15, weight: 600, align: 'center', color: hot ? '#18181b' : '#ffffff' })]; })]; } },
    'Gallery': { icon: 'collections', web: 1, make: (W, o = {}) => { const M = 64, imgs = (o.imgs || ['Photo one', 'Photo two', 'Photo three', 'Photo four', 'Photo five', 'Photo six']).slice(0, 9), cols = 3, gap = 20, cw = (W - M * 2 - gap * (cols - 1)) / cols, rh = cw * .72;
      const title = T(M, 96, W - M * 2, o.title || 'A closer look', { size: 36, weight: 800, align: 'center' }), y0 = 96 + title.h + 48, rows = Math.ceil(imgs.length / cols);
      return [B(0, 0, W, y0 + rows * (rh + gap) + 76, { fill: '#ffffff' }), title, ...imgs.map((l, i) => PH(M + (i % cols) * (cw + gap), y0 + Math.floor(i / cols) * (rh + gap), cw, rh, l, { radius: 18 }))]; } },
    'Logos': { icon: 'workspaces', web: 1, make: (W, o = {}) => { const M = 64, n = 5, cw = (W - M * 2 - 32 * (n - 1)) / n;
      return [B(0, 0, W, 170, { fill: '#ffffff' }), T(M, 40, W - M * 2, o.title || 'Trusted by teams everywhere', { size: 14, weight: 600, color: '#a1a1aa', align: 'center' }), ...Array.from({ length: n }, (_, i) => B(M + i * (cw + 32), 84, cw, 44, { fill: '#f4f4f5', radius: 10 }))]; } },
    'CTA': { icon: 'campaign', web: 1, make: (W, o = {}) => { const M = 64, t = T(M + 64, 80, W - M * 2 - 128, o.title || 'Ready to start?', { size: 40, weight: 800, align: 'center', color: '#ffffff' }), sub = T(M + 64, 80 + t.h + 16, W - M * 2 - 128, o.text || 'One last nudge, in one line.', { size: 18, align: 'center', color: '#d4d4d8' }), by = sub.y + sub.h + 32;
      return [B(0, 0, W, by + 52 + 96, { fill: '#ffffff' }), B(M, 24, W - M * 2, by + 52 + 48, { fill: '#18181b', radius: 32 }), t, sub, B(W / 2 - 90, by, 180, 52, { fill: '#ffffff', radius: 26 }), T(W / 2 - 90, by + 15, 180, o.cta || 'Get started', { size: 16, weight: 600, align: 'center', color: '#18181b' })]; } },
    'Footer': { icon: 'call_to_action', web: 1, make: (W, o = {}) => { const M = 64, cols = o.cols || [['Product', ['Features', 'Pricing', 'Updates']], ['Company', ['About', 'Careers', 'Press']], ['Help', ['Support', 'Contact', 'Privacy']]];
      return [B(0, 0, W, 300, { fill: '#f4f4f5' }), T(M, 64, 300, o.logo || 'Brand', { size: 22, weight: 800 }), T(M, 100, 300, o.text || 'A one-line sign-off.', { size: 14, color: '#71717a' }),
        ...cols.slice(0, 4).flatMap(([h, ls], i) => [T(W - M - (cols.length - i) * 180, 64, 160, h, { size: 14, weight: 700 }), ...ls.slice(0, 4).map((l, k) => T(W - M - (cols.length - i) * 180, 98 + k * 28, 160, l, { size: 14, color: '#71717a' }))]),
        B(M, 240, W - M * 2, 1, { fill: '#e4e4e7' }), T(M, 258, 400, o.copy || '© 2026 ' + (o.logo || 'Brand'), { size: 12, color: '#a1a1aa' })]; } },
  };
  Object.assign(PIECES, WEB);
  // a screen's look: colors and fonts swapped onto the gray pieces
  const GRAY = { text: '#27272a', ink: '#18181b', muted: '#71717a', soft: '#52525b', surface: '#f4f4f5', bar: '#fafafa', line: '#e4e4e7' };
  function themeIt(list, th) {
    if (!th) return list; const t = { bg: '#ffffff', text: '#18181b', muted: '#71717a', primary: '#18181b', onPrimary: '#ffffff', surface: '#f4f4f5', font: 'DM Sans', headFont: '', ...th };
    useFont(t.font); if (t.headFont) useFont(t.headFont);
    return list.map(it => { const c = { ...it };
      if (c.type === 'text') { c.font = (c.weight >= 700 && t.headFont) ? t.headFont : t.font;
        if ([GRAY.text, GRAY.ink].includes(c.color)) c.color = t.text; else if ([GRAY.muted, GRAY.soft].includes(c.color)) c.color = t.muted; else if (c.color === '#ffffff' && th.onPrimary) c.color = t.onPrimary; }
      if (c.type === 'box' && !c.img) { if (c.fill === '#18181b' || c.fill === '#27272a') c.fill = t.primary; else if (c.fill === '#ffffff') c.fill = t.bg; else if ([GRAY.surface, GRAY.bar].includes(c.fill)) c.fill = t.surface; if (c.stroke === '#18181b' || c.stroke === '#27272a') c.stroke = t.primary; }
      if (c.type === 'icon' && [GRAY.text, '#3f3f46'].includes(c.color)) c.color = t.text;
      return c; });
  }
  // pieces only Mochi asks for by name (not in the panel)
  const EXTRA = {
    'Text': (W, o = {}) => [T(0, 0, W, o.text || '', { size: o.size || 15, weight: o.weight || 500, align: o.align || 'left', color: o.color || '#3f3f46' })],
    'Icon': (W, o = {}) => { const s = o.size || 32; return [IC(o.align === 'center' ? W / 2 - s / 2 : 0, 0, o.name || o.icon || 'star', s, { color: o.color || '#27272a' })]; },
    'Space': (W, o = {}) => [],
    'Divider': (W, o = {}) => [B(0, 0, W, 1, { fill: '#e4e4e7' })],
  };
  const pieceH = (items, o) => Math.max(o.h && !items.length ? o.h : 0, ...items.map(i => i.y + i.h));
  // a whole screen from a list of pieces, top to bottom: bars hug the edges, the rest stacks with even gaps
  const num = (v, d) => { const n = +v; return Number.isFinite(n) && v !== '' && v !== null ? n : d; };
  // "4 4 0 #141210" or {x, y, blur, color} → a card shadow (a hard ink shadow is blur 0)
  function layerShadow(v) { if (!v) return null; if (typeof v === 'string') { const m = v.trim().match(/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?(?:\s+([\d.]+)(?:px)?)?(?:\s+(#[0-9a-f]{3,8}|rgba?\([^)]*\)))?/i); if (!m) return null; v = { x: +m[1], y: +m[2], blur: +(m[3] || 0), color: m[4] || '#000000' }; }
    const col = String(v.color || '#000000'), hex = /^#[0-9a-f]{6}$/i.test(col) ? col : /^#[0-9a-f]{3}$/i.test(col) ? '#' + col.slice(1).split('').map(ch => ch + ch).join('') : '#000000';
    return { x: +v.x || 0, y: +v.y || 0, blur: +v.blur || 0, color: hex, a: v.a != null ? +v.a : v.opacity != null ? +v.opacity : 1 }; }
  function buildScreen(spec, x, y) {
    spec = { ...spec, w: num(spec.w, undefined), h: num(spec.h, undefined), gap: num(spec.gap, undefined) };
    spec.items = (Array.isArray(spec.items) ? spec.items : []).filter(it => it && typeof it === 'object').map(it => ({ ...it, w: num(it.w, undefined), h: num(it.h, undefined), size: num(it.size, undefined), count: num(it.count, undefined) }));
    const dev = DEVICES[spec.device] || DEVICES.iPhone, W = spec.w || dev[0], phone = !spec.device || /iPhone|Android/.test(spec.device), webFirst = (spec.items || []).some(it => /^(header|hero|features|footer)$/i.test(it.piece || ''));
    const f = card('frame', { x, y, w: W, h: spec.h || (webFirst && spec.device === 'Desktop' ? 600 : dev[1]), r: 0, name: spec.name || 'Screen', device: DEVICES[spec.device] ? spec.device : 'iPhone', radius: webFirst ? 12 : dev[2], fill: '#ffffff' });
    board.cards.push(f); renderCard(f, true);
    const items = spec.items || [], M = spec.device === 'Desktop' ? 64 : 24, CW = W - M * 2, GAP = spec.gap || 16, made = [f];
    // a designed screen: layers placed exactly where Mochi put them (their art, panels, text, real buttons with outlines and hard shadows), like a design file, not a stack of stock pieces
    if (Array.isArray(spec.layers) && spec.layers.length) {
      if (spec.theme?.bg || spec.bg) { f.fill = spec.bg || spec.theme.bg; renderCard(f); }
      const add = (o, g) => { const c = card(o.type, { ...o, x: x + o.x, y: y + o.y, r: 0, onFrame: f.id, ...(g ? { group: g } : {}) }); board.cards.push(c); renderCard(c, true); made.push(c); return c; };
      spec.layers.forEach(L => { if (!L || typeof L !== 'object') return; const k = String(L.kind || L.type || '').toLowerCase(), n = v => num(v, 0);
        const lx = n(L.x), ly = n(L.y), lw = Math.max(4, n(L.w) || 200), lh = Math.max(4, n(L.h) || 60), sh = layerShadow(L.shadow), sk = L.stroke && n(L.strokeWidth ?? L.sw) > 0 ? { stroke: L.stroke, sw: n(L.strokeWidth ?? L.sw) } : {};
        if ((k === 'video' || (k === 'art' && /\.(webm|mov|mp4|m4v)$/i.test(String(L.src || '')))) && MB.native) add({ type: 'box', x: lx, y: ly, w: lw, h: lh, radius: n(L.radius), fill: 'transparent', nobg: true, fileVideo: String(L.src || ''), name: L.name || undefined });
        else if (k === 'art' || k === 'image') add({ type: 'box', x: lx, y: ly, w: lw, h: lh, radius: n(L.radius), fill: 'transparent', nobg: true, ...(L.src && MB.native ? { fileSrc: String(L.src) } : { img: L.img || L.label || 'Picture' }), ...(sh ? { shadow: sh } : {}), name: L.name || undefined });
        else if (k === 'text') { useFont(L.font); add({ type: 'text', x: lx, y: ly, w: lw, h: Math.round((n(L.size) || 18) * 1.35), text: String(L.text || ''), font: L.font || spec.theme?.font, size: n(L.size) || 18, weight: n(L.weight) || 500, color: L.color || spec.theme?.text || '#27272a', align: L.align || 'left', ...(L.lh ? { lh: n(L.lh) } : {}), ...sk }); }
        else if (k === 'button') { const g = uid(), size = n(L.size) || 18; useFont(L.font);
          add({ type: 'box', x: lx, y: ly, w: lw, h: lh, fill: L.fill || spec.theme?.primary || '#18181b', radius: L.radius != null ? n(L.radius) : lh / 2, ...sk, ...(sh ? { shadow: sh } : {}) }, g);
          add({ type: 'text', x: lx, y: ly + Math.round((lh - size * 1.3) / 2), w: lw, h: Math.round(size * 1.3), text: String(L.text || 'Button'), font: L.font || spec.theme?.headFont || spec.theme?.font, size, weight: n(L.weight) || 800, color: L.color || spec.theme?.onPrimary || '#ffffff', align: 'center', lh: 1.3 }, g); }
        else if (k === 'icon') add({ type: 'icon', x: lx, y: ly, w: n(L.size) || lw, h: n(L.size) || lw, name: L.name || 'star', color: L.color || spec.theme?.text });
        else add({ type: 'box', x: lx, y: ly, w: lw, h: lh, fill: L.fill || 'transparent', radius: n(L.radius), opacity: L.opacity != null ? n(L.opacity) : undefined, ...sk, ...(sh ? { shadow: sh } : {}) });   // rect / panel / shape
      });
      if (spec.note) { const nt = card('note', { x, y: y + f.h + 28, w: W, h: 120, text: spec.note, name: spec.name || '', color: 'butter', r: 0 }); board.cards.push(nt); renderCard(nt, true); made.push(nt); }
      return { f, made };
    }
    let top = y + (phone ? 44 : 0), bottom = y + f.h;
    const put = (list, ox, oy) => { const g = uid(); list.forEach(it => { const c = card(it.type, { ...it, x: ox + it.x, y: oy + it.y, r: 0, group: list.length > 1 ? g : undefined, onFrame: f.id }); if (!c.group) delete c.group; board.cards.push(c); renderCard(c, true); made.push(c); }); };
    const nav = items.find(it => /nav/i.test(it.piece || '')), tab = items.find(it => /tab/i.test(it.piece || ''));
    if (nav) { const l = themeIt(PIECES['Nav bar'].make(W, nav), spec.theme); put(l, x, top); top += 56; }
    if (tab) { const l = themeIt(PIECES['Tab bar'].make(W, tab), spec.theme); bottom -= 64 + (phone ? 20 : 0); put(l, x, bottom); }
    const isWeb = (spec.items || []).some(it => WEB[Object.keys(WEB).find(k => k.toLowerCase() === String(it.piece || '').toLowerCase())]);
    if (spec.theme?.bg) { f.fill = spec.theme.bg; renderCard(f); }
    let cur = top + (spec.padTop ?? (isWeb ? 0 : 20));
    items.filter(it => it !== nav && it !== tab).forEach(it => {
      const name = Object.keys(PIECES).find(k => k.toLowerCase() === String(it.piece || '').toLowerCase()) || Object.keys(EXTRA).find(k => k.toLowerCase() === String(it.piece || '').toLowerCase()) || 'Text';
      const P = PIECES[name], full = name === 'List row' || (P && P.web), w = full ? W : ['Avatar', 'Toggle'].includes(name) && !it.text ? P.w : it.w || CW;
      const reps = Math.max(1, Math.min(8, +it.count || (Array.isArray(it.rows) ? it.rows.length : 1)));
      for (let k = 0; k < reps; k++) {
        const o = Array.isArray(it.rows) ? { ...it, ...it.rows[k] } : it, list = P ? P.make(w, o) : EXTRA[name](w, o), h = pieceH(list, o);
        const ox = full ? x : (it.align === 'center' && w < CW) ? x + (W - w) / 2 : x + M;
        put(themeIt(list, spec.theme), ox, cur); cur += h + (full ? 0 : GAP);
      }
    });
    if (webFirst && !tab) { f.h = Math.max(200, cur - y); renderCard(f); }
    else if (cur > bottom - 12) { const grow = cur - bottom + 24; f.h += grow; renderCard(f); made.filter(c => c.y >= bottom - 1 && c !== f).forEach(c => { c.y += grow; renderCard(c); }); }
    if (spec.note) { const n = card('note', { x, y: y + f.h + 28, w: W, h: 120, text: spec.note, name: spec.name || '', color: 'butter', r: 0 }); board.cards.push(n); renderCard(n, true); made.push(n); }
    return { f, made };
  }
  const pieceBtn = ([n, p]) => `<button data-piece="${n}" title="Add ${n.toLowerCase()}"><span class="mi">${p.icon}</span>${n}</button>`;
  $('dzPieces').innerHTML = Object.entries(PIECES).filter(([, p]) => !p.web).map(pieceBtn).join('') + '<div class="label dz-sub">Website</div>' + Object.entries(PIECES).filter(([, p]) => p.web).map(pieceBtn).join('');
  $('dzPieces').onclick = e => { const b = e.target.closest('[data-piece]'); if (!b) return; pickWF(null); $('dzPieces').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); startPlacing('piece', { piece: b.dataset.piece }); };
  function placePiece(name, w) {
    const P = PIECES[name], f = [...board.cards].reverse().find(f => f.type === 'frame' && w.x > f.x && w.x < f.x + f.w && w.y > f.y && w.y < f.y + f.h);
    const W = (P.bar || P.web) && f ? f.w : P.web ? 1200 : P.w || 360, items = P.make(W); let ox = w.x - 14 / view.z, oy = w.y - 14 / view.z;
    if ((P.bar || P.web) && f) { ox = f.x; if (P.bar === 'top') oy = Math.max(f.y, oy); if (P.bar === 'bottom') oy = Math.min(f.y + f.h - 64, Math.max(f.y, oy)); }
    const g = uid(), made = items.map(it => { const c = card(it.type, { ...it, x: ox + it.x, y: oy + it.y, r: 0, group: g }); board.cards.push(c); renderCard(c, true); return c; });
    fileIntoFrame(made); selectOnly(made.map(c => c.id)); renderWires(); save();
  }
  // ---------- diagram kits: the Flowchart, Journey, Sitemap and Mind map tabs of the Wireframe panel ----------
  // a diagram shape has a dot on each side: drag one to another shape to connect them, drop it on empty board for the next shape there, or click it to add the next one lined up
  const SIDE = { t: { u: .5, v: 0 }, r: { u: 1, v: .5 }, b: { u: .5, v: 1 }, l: { u: 0, v: .5 } }, OPP = { t: 'b', b: 't', l: 'r', r: 'l' }, DIR = { t: [0, -1], r: [1, 0], b: [0, 1], l: [-1, 0] };
  // the dots live in their own layer over the lines (a line leaving a side would otherwise sit right on top of its dot)
  const kp = document.createElement('div'); kp.id = 'kports'; world.appendChild(kp);
  kp.innerHTML = ['t', 'r', 'b', 'l'].map(s => `<i class="kport" data-side="${s}" title="Drag to another shape to connect, or click to add the next one"></i>`).join('');
  let kpFor = null;
  new MutationObserver(() => { if (kpFor && !cardsEl.querySelector(`[data-id="${kpFor}"]`)) showPorts(null); }).observe(cardsEl, { childList: true });   // the card went away (deleted, undone): its dots go with it, right away
  function showPorts(c) {
    kpFor = c ? c.id : null; kp.classList.toggle('on', !!c); if (!c) return;
    const el = cardsEl.querySelector(`[data-id="${c.id}"]`), W = el && c.type !== 'section' && el.offsetWidth ? el.offsetWidth : c.w;   // the card as it really is on screen (a title that just got shorter, say)
    const o = 20 / view.z, h = el && c.type !== 'section' && el.offsetHeight ? el.offsetHeight : (c.type === 'title' ? 50 : c.h), at = { t: [c.x + W / 2, c.y - o], r: [c.x + W + o, c.y + h / 2], b: [c.x + W / 2, c.y + h + o], l: [c.x - o, c.y + h / 2] };
    kp.style.setProperty('--iz', (1 / view.z).toFixed(4)); kp.querySelectorAll('.kport').forEach(d => { const [x, y] = at[d.dataset.side]; d.style.left = x + 'px'; d.style.top = y + 'px'; });
  }
  const PORTABLE = c => !!c && !c.hidden && c.type !== 'section' && c.type !== 'ink' && editing !== c.id && (settings.ports !== false || !!c.kit);   // the dots setting hides them on ordinary cards; diagram pieces always keep theirs
  let kpHide = 0;
  const kpLater = () => { clearTimeout(kpHide); kpHide = setTimeout(() => { const s = sel.size === 1 && byId([...sel][0]); if (PORTABLE(s)) showPorts(s); else showPorts(null); }, 300); };   // a little grace before they go, and a selected shape keeps its dots
  stage.addEventListener('pointermove', e => {
    if (drag || placing || space || sel.size > 1 || e.buttons || penT || drawOn) { if (kpFor) showPorts(null); return; }
    const under = document.elementsFromPoint(e.clientX, e.clientY); if (under.some(x => x.classList?.contains('kport'))) { clearTimeout(kpHide); return; }
    const top = under.map(x => x.closest?.('.card')).find(Boolean), c0 = top && byId(top.dataset.id), c = PORTABLE(c0) ? c0 : null;
    if (c) { clearTimeout(kpHide); if (kpFor !== c.id || !kp.classList.contains('on')) showPorts(c); return; }
    const cur = kpFor && byId(kpFor), w = toWorld(e.clientX, e.clientY), m = 44 / view.z;   // near the shape still counts, so you can reach its dots
    if (!(cur && w.x > cur.x - m && w.x < cur.x + cur.w + m && w.y > cur.y - m && w.y < cur.y + cur.h + m)) kpLater();
  });
  // one rule for the dots, read from the board's state: typing hides them, one selected card shows them (measured fresh), several selected hides them
  function syncPorts() { const s = sel.size === 1 && byId([...sel][0]); if (editing || drag || placing) { if (kpFor) showPorts(null); return; } if (PORTABLE(s)) showPorts(s); else if (kpFor && sel.size > 1) showPorts(null); else if (kpFor) kpLater(); }   // (nothing selected: a short grace, in case the pointer is still over a card)
  const sideOf = p => p.u <= 0 ? 'l' : p.u >= 1 ? 'r' : p.v <= 0 ? 't' : 'b';
  const sideNear = (c, w) => sideOf(pinAt(c, w));
  const wireLab = {};   // where each line's label sits, for typing into it
  // line ends: an open arrow, a filled triangle, a dot, a diamond, or nothing, at either end
  const headOf = l => l.head || (l.arrow ? 'arrow' : 'none'), tailOf = l => l.tail || 'none', ENDS = ['none', 'arrow', 'tri', 'dot', 'diamond'], END_N = { none: 'None', arrow: 'Arrow', tri: 'Triangle', dot: 'Dot', diamond: 'Diamond' };
  function headPath(kind, tip, from, on, col) {
    if (!kind || kind === 'none') return '';
    const ux = tip.x - from.x, uy = tip.y - from.y, ul = Math.hypot(ux, uy) || 1, ax = ux / ul, ay = uy / ul, nx = -ay, ny = ax, st = col ? ` style="--wc:${col}"` : '', cls = on ? ' on' : '';
    if (kind === 'arrow') return `<path class="w-arrow${cls}" d="M${tip.x - ax * 11 + nx * 7} ${tip.y - ay * 11 + ny * 7} L${tip.x} ${tip.y} L${tip.x - ax * 11 - nx * 7} ${tip.y - ay * 11 - ny * 7}"${st}/>`;
    if (kind === 'tri') return `<path class="w-arrow w-solid${cls}" d="M${tip.x} ${tip.y} L${tip.x - ax * 13 + nx * 6.5} ${tip.y - ay * 13 + ny * 6.5} L${tip.x - ax * 13 - nx * 6.5} ${tip.y - ay * 13 - ny * 6.5} Z"${st}/>`;
    if (kind === 'dot') return `<circle class="w-arrow w-solid${cls}" cx="${tip.x - ax * 5}" cy="${tip.y - ay * 5}" r="5"${st}/>`;
    return `<path class="w-arrow w-solid${cls}" d="M${tip.x} ${tip.y} L${tip.x - ax * 7 + nx * 5.5} ${tip.y - ay * 7 + ny * 5.5} L${tip.x - ax * 14} ${tip.y - ay * 14} L${tip.x - ax * 7 - nx * 5.5} ${tip.y - ay * 7 - ny * 5.5} Z"${st}/>`;
  }
  const WEND = { none: '<path d="M3 10h14"/>', arrow: '<path d="M3 10h13M12 6l4 4-4 4"/>', tri: '<path d="M3 10h8"/><path d="M11 5.5l6 4.5-6 4.5z" fill="currentColor"/>', dot: '<path d="M3 10h9"/><circle cx="14.5" cy="10" r="3" fill="currentColor"/>', diamond: '<path d="M3 10h7"/><path d="M10 10l3.5-4 3.5 4-3.5 4z" fill="currentColor"/>' };
  const endIcon = (kind, tail) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${tail ? ' style="transform:scaleX(-1)"' : ''}>${WEND[kind] || WEND.none}</svg>`;
  const CARET_W = '<svg class="sb-caret" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3"/></svg>';
  function wireEndsPop(lw) {
    const row = (which, cur) => `<div class="sb-endrow"><span>${which === 'head' ? 'End' : 'Start'}</span>${ENDS.map(k => `<button data-we="${which}:${k}" class="${cur === k ? 'on' : ''}" title="${END_N[k]}">${endIcon(k, which === 'tail')}</button>`).join('')}</div>`;
    return `<span class="sb-popw" data-popw="wends"><button class="sb-poptrig sb-ic" data-pop="wends" title="Line ends">${endIcon(headOf(lw), false)}${CARET_W}</button><div class="sb-pop sb-pop-wends">${row('head', headOf(lw))}${row('tail', tailOf(lw))}</div></span>`;
  }
  function wireColorPop(lw) {
    const cur = lw.color || '', custom = cur && !WCOLORS.includes(cur);
    return `<span class="sb-popw" data-popw="wcolor"><button class="sb-poptrig" data-pop="wcolor" title="Line color"><i class="sb-cur" style="background:${cur || 'var(--ink-soft)'}"></i>${CARET_W}</button><div class="sb-pop sb-pop-wcolor"><div class="sb-dots">${WCOLORS.map(c => `<button data-wc="${c}" title="${c ? c : 'Default'}" style="background:${c || 'var(--ink-soft)'}" class="${cur === c ? 'on' : ''}"></button>`).join('')}<label class="sf-any ${custom ? 'on' : ''}" title="Any color"${custom ? ` style="--any:${cur}"` : ''}><input type="color" data-wcany value="${cur || '#8d8595'}"></label></div></div></span>`;
  }
  const WCOLORS = ['', '#494848', '#f27aa8', '#e8b03a', '#4fbf87', '#9b7cf0', '#4a9df5', '#ff8a5c', '#ffffff'];
  // while you drag a line: the card under (or near) the pointer, and on a diagram line, the middle of its nearest side to snap to
  function wireTarget(d, w) {
    const m = 36 / view.z, c = [...board.cards].reverse().find(c => c.id !== d.id && !c.hidden && (!d.pa || (c.type !== 'section' && c.type !== 'ink')) && w.x > c.x - m && w.x < c.x + c.w + m && w.y > c.y - m && w.y < c.y + c.h + m);
    if (!c) return null; if (!d.pa) return { c, pt: w };
    const s = sideNear(c, w); return { c, side: s, pt: pinPoint(c, SIDE[s]) };
  }
  let wireTap = {};
  // the connector bar's little pictures: each one shows the kind of line it makes
  const WI = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const WICON = {
    curve: WI('<path d="M3 15c5 0 4-10 9-10h5"/>'), straight: WI('<path d="M3 15L17 5"/>'), elbow: WI('<path d="M3 15h7V5h7"/>'),
    dash: WI('<path d="M3 10h14" stroke-dasharray="3 2.6"/>'), arrow: WI('<path d="M3 10h13M12 6l4 4-4 4"/>'), flip: WI('<path d="M4 7h11M12 4l3 3-3 3M16 13H5M8 10l-3 3 3 3"/>'),
    label: WI('<path d="M2 10h4M14 10h4"/><rect x="6.5" y="6.5" width="7" height="7" rx="2"/>'), auto: WI('<rect x="2" y="8" width="5" height="6" rx="1.2"/><rect x="13" y="8" width="5" height="6" rx="1.2"/><path d="M7 11h6M10 2.5v3M8.5 4h3"/>'),
  };
  // a right-angle line: out of each end the way its side faces, then across
  function elbowPts(l, a, b, g) {
    const dx = g.p2.x - g.p0.x, dy = g.p2.y - g.p0.y, horiz = Math.abs(dx) >= Math.abs(dy);
    const dirOf = (p, sgn) => p ? DIR[sideOf(p)] : horiz ? [(Math.sign(dx) || 1) * sgn, 0] : [0, (Math.sign(dy) || 1) * sgn];
    const dA = dirOf(l.pa, 1), dB = dirOf(l.pb, -1), sd = v => v[0] > 0 ? 'r' : v[0] < 0 ? 'l' : v[1] < 0 ? 't' : 'b';
    const P0 = l.pa ? g.p0 : pinPoint(a, SIDE[sd(dA)]), P2 = l.pb ? g.p2 : pinPoint(b, SIDE[sd(dB)]), s = 20;
    const a1 = { x: P0.x + dA[0] * s, y: P0.y + dA[1] * s }, b1 = { x: P2.x + dB[0] * s, y: P2.y + dB[1] * s }, hA = !!dA[0], hB = !!dB[0];
    let pts;
    if (hA && hB) { const mx = (a1.x + b1.x) / 2; pts = [P0, { x: mx, y: P0.y }, { x: mx, y: P2.y }, P2]; }
    else if (!hA && !hB) { const my = (a1.y + b1.y) / 2; pts = [P0, { x: P0.x, y: my }, { x: P2.x, y: my }, P2]; }
    else if (hA) pts = [P0, { x: P2.x, y: P0.y }, P2];
    else pts = [P0, { x: P0.x, y: P2.y }, P2];
    return pts.filter((p, i) => !i || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > .5);
  }
  function roundPoly(pts, O, r = 10) {   // the corners softly rounded
    let d = `M${pts[0].x + O} ${pts[0].y + O}`;
    for (let i = 1; i < pts.length - 1; i++) { const p = pts[i], a = pts[i - 1], b = pts[i + 1], la = Math.hypot(p.x - a.x, p.y - a.y) || 1, lb = Math.hypot(b.x - p.x, b.y - p.y) || 1, k = Math.min(r, la / 2, lb / 2);
      d += ` L${p.x - (p.x - a.x) / la * k + O} ${p.y - (p.y - a.y) / la * k + O} Q${p.x + O} ${p.y + O} ${p.x + (b.x - p.x) / lb * k + O} ${p.y + (b.y - p.y) / lb * k + O}`; }
    const z = pts[pts.length - 1]; return d + ` L${z.x + O} ${z.y + O}`;
  }
  function polyMid(pts) {   // halfway along the line
    const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)); let left = seg.reduce((n, x) => n + x, 0) / 2;
    for (let i = 0; i < seg.length; i++) { if (left <= seg[i]) { const k = left / (seg[i] || 1); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; } left -= seg[i]; }
    return pts[0];
  }
  function editWireLabel(l) {
    if (!l) return; renderWires(); const p = wireLab[l.id]; if (!p) return; const r = stage.getBoundingClientRect();
    const inp = document.createElement('input'); inp.className = 'w-edit'; inp.value = l.label || ''; inp.placeholder = 'Label'; inp.maxLength = 60;
    Object.assign(inp.style, { left: r.left + view.x + p.x * view.z + 'px', top: r.top + view.y + p.y * view.z + 'px' });
    ['pointerdown', 'mousedown', 'dblclick', 'keyup'].forEach(t => inp.addEventListener(t, e => e.stopPropagation()));
    document.body.appendChild(inp); inp.focus(); inp.select();
    let done = false; const fin = keep => { if (done) return; done = true; const v = inp.value.trim();
      if (keep && v !== (l.label || '')) { remember(); if (v) l.label = v; else delete l.label; save(); } inp.remove(); $('selbar').dataset.key = ''; renderWires(); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true);
  }

  // the pieces
  const FLOW = {
    'Start / end': { shape: 'pill', w: 160, h: 64, fill: 'mint', text: 'Start' },
    'Process': { shape: 'rect', w: 170, h: 90, fill: 'sky', text: 'Do a thing', radius: 10 },
    'Decision': { shape: 'diamond', w: 160, h: 120, fill: 'butter', text: 'Yes or no?' },
    'Input / output': { shape: 'io', w: 180, h: 84, fill: 'pink', text: 'Input' },
    'Document': { shape: 'doc', w: 160, h: 104, fill: 'lilac', text: 'Document' },
    'Database': { shape: 'db', w: 140, h: 116, fill: 'peach', text: 'Database' },
    'Note': { shape: 'fnote', w: 170, h: 110, fill: 'gray', text: 'A note' },
  };
  const PAGE = { shape: 'page', w: 150, h: 96, fill: '#ffffff', stroke: '#d9cfe0', sw: 1.5, text: 'Page' };
  const ROOT = { shape: 'pill', w: 230, h: 92, fill: 'pink', text: 'Big idea' }, BRANCH = { shape: 'pill', w: 160, h: 60, fill: 'sky', text: 'Branch' };
  const MIND_COLORS = ['sky', 'mint', 'butter', 'lilac', 'peach', 'pink'];
  function kitCard(kit, s, at, o = {}) {   // `at` is where its middle goes
    const c = card('shape', { kit, shape: s.shape, fill: s.fill, text: s.text ?? '', w: s.w, h: s.h, r: 0, ...(s.radius != null ? { radius: s.radius } : {}), ...(s.stroke ? { stroke: s.stroke, sw: s.sw || 1.5 } : {}), ...o });
    c.x = Math.round(at.x - c.w / 2); c.y = Math.round(at.y - c.h / 2); return c;
  }
  function kitLink(a, b, pa, pb, o = {}) {
    const l = { id: uid(), a: a.id, b: b.id, ...o };
    if (a.kit === 'mind') return l;   // mind maps: soft curves, edge to edge
    if (pa) l.pa = pa; if (pb) l.pb = pb; if (a.kit) l.route = 'elbow'; if (!a.kit || a.kit === 'flow') l.arrow = true; return l;   // diagram kits: right angles; anything else: a soft curve with an arrow
  }
  const crowded = (c, list) => list.some(k => k !== c && k.type !== 'section' && c.x < k.x + k.w + 20 && k.x < c.x + c.w + 20 && c.y < k.y + k.h + 20 && k.y < c.y + c.h + 20);
  const QUICK = {
    note: c => card('note', { w: c.w, h: c.h, text: '', color: c.color, r: 0 }), todo: c => card('todo', { w: c.w, h: c.h, text: '', items: [], color: c.color, r: 0 }),
    text: c => card('text', { w: c.w, h: c.h, text: '', size: c.size, weight: c.weight, font: c.font, color: c.color, align: c.align, r: 0 }), title: c => card('title', { text: '', fs: c.fs, tc: c.tc }),
    box: c => card('box', { w: c.w, h: c.h, fill: c.fill, radius: c.radius, stroke: c.stroke, sw: c.sw, r: 0 }), shape: c => card('shape', { w: c.w, h: c.h, shape: c.shape, fill: c.fill, radius: c.radius, stroke: c.stroke, sw: c.sw, text: '', r: 0 }),
    frame: c => card('frame', { w: c.w, h: c.h, name: 'Screen', device: c.device, radius: c.radius, fill: c.fill, r: 0 }), doc: () => card('doc', { text: '', body: '' }), canvas: () => card('canvas', { text: '' }),
  };
  function quickAdd(c, side, at) {
    let n;
    if (!c.kit) { const mk = QUICK[c.type]; if (!mk) { if (!at) chirp('Drag this dot onto another card to connect them ✦', 2400); return; } n = mk(c); if (c.onFrame) n.onFrame = c.onFrame; }
    remember();
    const s = !c.kit ? null : c.kit === 'mind' ? (c.root ? { ...BRANCH, fill: MIND_COLORS[board.links.filter(l => l.a === c.id).length % MIND_COLORS.length] } : { ...BRANCH, w: 140, h: 52, fill: c.fill, text: 'Idea' })
      : c.kit === 'site' ? PAGE : { shape: c.shape, w: c.w, h: c.h, fill: c.fill, text: '', ...(c.radius != null ? { radius: c.radius } : {}), ...(c.stroke ? { stroke: c.stroke, sw: c.sw } : {}) };
    if (s) n = kitCard(c.kit, s, { x: 0, y: 0 });
    const [dx, dy] = DIR[side], gap = c.kit === 'mind' ? 80 : c.kit === 'site' ? 50 : 70, H = c.type === 'title' ? 50 : c.h;
    const mid = at || { x: c.x + c.w / 2 + dx * (c.w / 2 + gap + n.w / 2), y: c.y + H / 2 + dy * (H / 2 + gap + n.h / 2) };
    n.x = Math.round(mid.x - n.w / 2); n.y = Math.round(mid.y - n.h / 2);
    if (!at) { const others = board.cards.filter(k => !k.hidden), step = dx ? n.h + 30 : n.w + 30;   // something already there: slide along until there's room
      for (let i = 1; crowded(n, others) && i < 16; i++) { const k = c.kit === 'site' && side === 'b' ? i : (i % 2 ? 1 : -1) * Math.ceil(i / 2); n.x = Math.round(mid.x - n.w / 2 + (dx ? 0 : step * k)); n.y = Math.round(mid.y - n.h / 2 + (dx ? step * k : 0)); } }
    addCard(n); if (!c.kit && n.type !== 'frame') fileIntoFrame([n]); board.links.push(kitLink(c, n, SIDE[side], at ? SIDE[sideNear(n, center(c))] : SIDE[OPP[side]]));
    selectOnly([n.id]); renderWires(); save(); setTimeout(() => startEdit(n.id), 30); return n;
  }
  function lanes(at, names, W = 1100, H = 220) {   // swimlanes: sections stacked into rows; whatever sits in a lane moves with it
    const cols = ['sky', 'lilac', 'mint', 'butter', 'peach', 'pink'];
    return names.map((n, i) => card('section', { x: Math.round(at.x), y: Math.round(at.y + i * (H + 10)), w: W, h: H, text: n, color: cols[i % cols.length], lane: true, r: 0 }));
  }
  function starterFlow(at) {
    const F = (n, x, y, o) => kitCard('flow', { ...FLOW[n], ...o }, { x: at.x + x, y: at.y + y });
    const s = F('Start / end', 0, 0, { text: 'Start' }), p1 = F('Process', 0, 150, { text: 'Open the app' }), d = F('Decision', 0, 320, { text: 'Signed in?' });
    const yes = F('Process', 300, 320, { text: 'Show home' }), no = F('Process', 0, 500, { text: 'Sign in' }), e = F('Start / end', 300, 500, { text: 'Done' });
    const L = (a, b, sa, sb, o) => kitLink(a, b, SIDE[sa], SIDE[sb], o);
    return { cards: [s, p1, d, yes, no, e], links: [L(s, p1, 'b', 't'), L(p1, d, 'b', 't'), L(d, yes, 'r', 'l', { label: 'Yes' }), L(d, no, 'b', 't', { label: 'No' }), L(yes, e, 'b', 't'), L(no, e, 'r', 'l')] };
  }
  function sitemapStarter(at) {
    const P = (t, x, y) => kitCard('site', { ...PAGE, text: t }, { x: at.x + x, y: at.y + y }), home = P('Home', 0, 0);
    const kids = ['About', 'Work', 'Blog', 'Contact'].map((t, i) => P(t, (i - 1.5) * 190, 170)), work = kids[1], sub = ['Case study', 'Process'].map((t, i) => P(t, work.x + work.w / 2 - at.x + (i - .5) * 175, 340));
    const L = (a, b) => kitLink(a, b, SIDE.b, SIDE.t);
    return { cards: [home, ...kids, ...sub], links: [...kids.map(k => L(home, k)), ...sub.map(k => L(work, k))] };
  }
  function mindStarter(at) {
    const root = kitCard('mind', ROOT, at, { root: true }), names = ['Who it’s for', 'Problems', 'Ideas', 'Questions', 'Inspiration', 'Next steps'];
    const kids = names.map((t, i) => { const a = -Math.PI / 2 + (i + .5) * Math.PI * 2 / names.length; return kitCard('mind', { ...BRANCH, text: t, fill: MIND_COLORS[i] }, { x: at.x + Math.cos(a) * 340, y: at.y + Math.sin(a) * 210 }); });
    return { cards: [root, ...kids], links: kids.map(k => kitLink(root, k)) };
  }
  function blueprint(at) {
    const steps = ['Discover', 'Sign up', 'First use', 'Get help'], W = 220, X0 = 230, made = [];
    const rows = [['Customer actions', ['Hears about it from a friend', 'Signs up on their phone', 'Sets a first goal', 'Asks for help in chat'], 'white'],
      ['Frontstage · what they see', ['Landing page', 'Sign up screens', 'Home screen', 'Chat with a person'], 'sky'],
      ['Backstage · what they don’t', ['Referral tracking', 'ID check', 'Goal suggestions', 'Agent sees their account'], 'lilac'],
      ['Support · systems and partners', ['Analytics', 'Identity partner', 'Bank data feed', 'Help desk tool'], 'butter']];
    made.push(card('title', { x: Math.round(at.x), y: Math.round(at.y), text: 'Service blueprint' }));
    steps.forEach((s, i) => made.push(card('text', { x: Math.round(at.x + X0 + i * (W + 30)), y: Math.round(at.y + 70), w: W, h: 28, text: s, size: 18, weight: 700, color: '#27272a', font: 'DM Sans', align: 'center', r: 0 })));
    const L = lanes({ x: at.x, y: at.y + 112 }, rows.map(r => r[0]), X0 + steps.length * (W + 30) + 10, 192); made.push(...L);
    rows.forEach((r, k) => r[1].forEach((t, i) => made.push(card('note', { x: Math.round(at.x + X0 + i * (W + 30)), y: L[k].y + 62, w: W, h: 110, text: t, color: r[2], r: 0 }))));
    return { cards: made };
  }
  const PERSONA = { emoji: '🙂', name: 'Persona', items: [
    { t: 'title', x: 0, y: 0, text: 'Persona' },
    { t: 'note', x: 0, y: 90, name: 'Who', color: 'white', text: 'Maya Chen, 29\nProduct manager in Austin\n\n“I want to feel on top of my money without thinking about it.”' },
    { t: 'coll', x: 260, y: 90, name: 'Goals', color: 'mint', notes: [{ text: 'Save for a trip this year' }, { text: 'Know where every dollar goes' }] },
    { t: 'coll', x: 570, y: 90, name: 'Frustrations', color: 'pink', notes: [{ text: 'Fees she didn’t see coming' }, { text: 'Too many apps to check' }] },
    { t: 'coll', x: 880, y: 90, name: 'Habits', color: 'sky', notes: [{ text: 'Checks her balance on the bus' }, { text: 'Pays bills on Sundays' }] },
    { t: 'how', x: 1190, y: 90, text: 'Base her on what you heard in research, not guesses.\n\nKeep her goals and frustrations specific. A real quote does more than a paragraph.\n\nOne persona per kind of person who uses it differently.' },
  ] };
  const KIC = {
    lanes: '<rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M2.5 8h15M2.5 12.5h15M6.5 3.5v13"/>',
    flow: '<rect x="7" y="2" width="6" height="3.4" rx="1.7"/><path d="M10 5.4v2.2M10 7.6l3 2.6-3 2.6-3-2.6zM10 12.8v2.2"/><rect x="7" y="15" width="6" height="3" rx="1"/>',
    persona: '<circle cx="10" cy="7" r="3"/><path d="M4.5 17c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/>',
    blueprint: '<path d="M2.5 5h15M2.5 10h15M2.5 15h15"/><circle cx="6" cy="5" r="1.3"/><circle cx="11" cy="10" r="1.3"/><circle cx="15" cy="15" r="1.3"/>',
    site: '<rect x="7.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="2.5" y="13.5" width="4" height="3.5" rx="1"/><rect x="8" y="13.5" width="4" height="3.5" rx="1"/><rect x="13.5" y="13.5" width="4" height="3.5" rx="1"/><path d="M10 6v4M4.5 13.5V10h11v3.5M10 10v3.5"/>',
    mind: '<circle cx="10" cy="10" r="2.6"/><circle cx="3.8" cy="4.5" r="1.6"/><circle cx="16.2" cy="4.5" r="1.6"/><circle cx="3.8" cy="15.5" r="1.6"/><circle cx="16.2" cy="15.5" r="1.6"/><path d="M8 8.3L5 5.6M12 8.3l3-2.7M8 11.7l-3 2.7M12 11.7l3 2.7"/>',
  };
  const KITS = {
    flow: { hint: 'Click a shape, then the board. Hover a shape: drag a side dot to another shape to connect, or click a dot to add the next step. Double-click a line to label it.', pieces: {
      ...Object.fromEntries(Object.entries(FLOW).map(([n, s]) => [n, { shape: s, place: at => [kitCard('flow', s, at)] }])),
      'Swimlanes': { ic: KIC.lanes, place: at => lanes({ x: at.x - 40, y: at.y - 40 }, ['Customer', 'App', 'Team']) },
      'Starter flow': { ic: KIC.flow, place: at => starterFlow(at) } } },
    journey: { hint: 'Research boards to fill in. Each one comes with Mochi’s how-to note; delete it whenever you like.', pieces: {
      'Journey map': { ic: TPL_IC.journey, fw: 'journey' }, 'Empathy map': { ic: TPL_IC.empathy, fw: 'empathy' },
      'Persona': { ic: KIC.persona, fw: PERSONA }, 'Service blueprint': { ic: KIC.blueprint, place: at => blueprint(at) } } },
    site: { hint: 'Hover a page and click the dot underneath to add a page below it (or to the side for a sibling).', pieces: {
      'Page': { shape: PAGE, place: at => [kitCard('site', PAGE, at)] }, 'Sitemap starter': { ic: KIC.site, place: at => sitemapStarter(at) } } },
    mind: { hint: 'Start with a big idea. Hover it and click a dot to grow a branch; branches keep their color as they grow.', pieces: {
      'Big idea': { shape: ROOT, place: at => [kitCard('mind', ROOT, at, { root: true })] }, 'Branch': { shape: BRANCH, place: at => [kitCard('mind', BRANCH, at)] },
      'Mind map starter': { ic: KIC.mind, place: at => mindStarter(at) } } },
  };
  // auto-connect: set a diagram shape down close to another one and a line joins them (Settings → Widgets turns it off)
  function autoLink(c) {
    if (settings.autoLink === false || !c || !c.kit) return;
    const linked = k => board.links.some(l => (l.a === c.id && l.b === k.id) || (l.b === c.id && l.a === k.id));
    let best = null, bd = Infinity;
    board.cards.forEach(k => { if (k === c || !k.kit || k.hidden || k.kit !== c.kit || linked(k)) return;
      const gx = Math.max(k.x - (c.x + c.w), c.x - (k.x + k.w), 0), gy = Math.max(k.y - (c.y + c.h), c.y - (k.y + k.h), 0), d = Math.hypot(gx, gy); if (d < bd) { bd = d; best = k; } });
    if (!best || bd > 110) return;
    const dx = (c.x + c.w / 2) - (best.x + best.w / 2), dy = (c.y + c.h / 2) - (best.y + best.h / 2), s = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');   // the sides that face each other
    // and line it up with its neighbour, so the arrow runs straight across (or straight down); only when it's nearly there already
    const was = { x: c.x, y: c.y }, el = cardsEl.querySelector(`[data-id="${c.id}"]`);
    if (c.kit !== 'mind') { if (s === 'r' || s === 'l') { if (Math.abs(dy) <= Math.max(60, c.h)) c.y = Math.round(best.y + best.h / 2 - c.h / 2); } else if (Math.abs(dx) <= Math.max(60, c.w)) c.x = Math.round(best.x + best.w / 2 - c.w / 2); }   // mind-map branches fan out on purpose
    const moved = c.x !== was.x || c.y !== was.y; if (moved && el) { el.style.transition = 'left .16s ease, top .16s ease'; el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; setTimeout(() => { el.style.transition = ''; }, 220); }
    const l = kitLink(best, c, SIDE[s], SIDE[OPP[s]]); board.links.push(l); renderWires(); save();
    const nb = String(best.text || '').replace(/\s+/g, ' ').trim().slice(0, 22); chirp(moved ? `Lined up with ${nb || 'its neighbour'} ✦` : 'Connected ✦', 2200, [{ label: 'Undo', run: () => { board.links = board.links.filter(x => x !== l); if (moved) { c.x = was.x; c.y = was.y; const e2 = cardsEl.querySelector(`[data-id="${c.id}"]`); if (e2) { e2.style.left = c.x + 'px'; e2.style.top = c.y + 'px'; } } renderWires(); save(); } }]);
  }
  function placeKit(kit, name, w) {
    const P = KITS[kit]?.pieces[name]; if (!P) return;
    if (P.fw) return placeFramework(typeof P.fw === 'string' ? P.fw : null, w, typeof P.fw === 'string' ? null : P.fw);
    remember(); const out = P.place(w), { cards, links = [] } = Array.isArray(out) ? { cards: out } : out;
    cards.forEach(c => { board.cards.push(c); renderCard(c, true); }); board.links.push(...links);
    const picks = cards.filter(c => c.type !== 'section'); selectOnly((picks.length ? picks : cards).map(c => c.id)); renderWires(); save();
    if (cards.length === 1 && cards[0].type === 'shape') { autoLink(cards[0]); setTimeout(() => startEdit(cards[0].id), 30); }
  }
  function renderKits() {
    Object.entries(KITS).forEach(([k, K]) => { const el = $('kit-' + k); if (!el) return;
      el.innerHTML = `<div class="kit-grid">${Object.entries(K.pieces).map(([n, p]) => `<button data-kit="${k}" data-kp="${esc(n)}" title="Add ${esc(n.toLowerCase())}">${p.shape ? `<span class="kp-sh">${shapeSVG(p.shape)}</span>` : `<svg class="kp-ic" viewBox="0 0 20 20">${p.ic}</svg>`}<span>${esc(n)}</span></button>`).join('')}</div><div class="dz-hint">${K.hint}</div>`; });
  }
  renderKits();
  $('design').addEventListener('click', e => { const b = e.target.closest('[data-kp]'); if (!b) return; pickWF(null);
    $('design').querySelectorAll('[data-kp]').forEach(x => x.classList.toggle('on', x === b)); startPlacing('kit', { kit: b.dataset.kit, piece: b.dataset.kp });
    if (placing?.type !== 'kit') b.classList.remove('on'); });

  // ---------- Learn: a widget with two links (Dictionary, Principles) that open the library, a roomy window with groups on the left, entries in the middle, the picked one on the right ----------
  const LDB = window.LEARN || { groups: [], terms: [], sets: [] }, FW_NAMES = { journey: 'Journey map', empathy: 'Empathy map', affinity: 'Affinity map', matrix: 'Impact / effort', hmw: 'How might we', rtb: 'Rose, thorn, bud', opportunity: 'Opportunity map' };
  const seeName = s => DZ_TABS[s] ? DZ_TABS[s] + ' tab' : FW_NAMES[s] ? FW_NAMES[s] + ' template' : '';
  const learnTerm = name => LDB.terms.find(t => t.t.toLowerCase() === String(name).toLowerCase());
  function dropTerm(t, at) {
    const p = at || centerWorld(); remember(); const c = card('note', { x: Math.round(p.x - 130), y: Math.round(p.y - 80), w: 260, h: 150, name: t.t, text: t.d + (t.why ? '\n\n' + t.why : ''), color: 'butter' });
    addCard(c); selectOnly([c.id]); chirp(`${t.t} is on the board ✦`, 1800); return c;
  }
  function dropSet(s, at) {
    const p = at || centerWorld(); remember(); const c = card('todo', { x: Math.round(p.x - 140), y: Math.round(p.y - 120), w: 300, h: 60 + s.items.length * 30, text: s.name, items: s.items.map(([t, d]) => ({ t: d ? t + ' — ' + d : t, done: false })), color: 'white', r: 0 });
    addCard(c); selectOnly([c.id]); chirp(`${s.name} ✦ ${s.by}`, 3000); return c;
  }
  const LIB = { part: 'dictionary', group: null, q: '', pick: null };
  function openLibrary(part = 'dictionary', pick = null) {
    LIB.part = part; LIB.q = ''; LIB.pick = pick; if (part === 'dictionary' && !LIB.group) LIB.group = LDB.groups[0];
    $('library').classList.add('on'); renderLibrary(); setTimeout(() => $('libQ')?.focus(), 60);
  }
  const closeLibrary = () => $('library').classList.remove('on');
  function renderLibrary() {
    const dict = LIB.part === 'dictionary', q = LIB.q.trim().toLowerCase();
    $('libTitle').textContent = dict ? 'Dictionary' : 'Principles';
    $('libNav').innerHTML = `<button data-lpart="dictionary" class="lib-part ${dict ? 'on' : ''}">Dictionary <small>${LDB.terms.length}</small></button>` + (dict ? LDB.groups.map(g => `<button data-lgroup="${esc(g)}" class="${!q && LIB.group === g ? 'on' : ''}">${esc(g)} <small>${LDB.terms.filter(t => t.g === g).length}</small></button>`).join('') : '')
      + `<button data-lpart="principles" class="lib-part ${dict ? '' : 'on'}">Principles <small>${LDB.sets.length}</small></button>`;
    let list = '';
    if (dict) { const terms = q ? LDB.terms.filter(t => (t.t + ' ' + t.d + ' ' + (t.why || '')).toLowerCase().includes(q)) : LDB.terms.filter(t => t.g === LIB.group);
      list = `<div class="lib-h">${q ? `${terms.length} for “${esc(LIB.q.trim())}”` : esc(LIB.group)}</div>` + (terms.length ? terms.map(t => `<button class="lib-item ${LIB.pick === t.t ? 'on' : ''}" data-lterm="${esc(t.t)}"><b>${esc(t.t)}</b><span>${esc(t.d)}</span></button>`).join('') : '<div class="dz-hint">Nothing by that name yet. Ask Mochi and she’ll do her best ✦</div>'); }
    else { const sets = q ? LDB.sets.filter(s => (s.name + ' ' + s.by + ' ' + s.items.map(i => i.join(' ')).join(' ')).toLowerCase().includes(q)) : LDB.sets;
      list = `<div class="lib-h">${q ? `${sets.length} for “${esc(LIB.q.trim())}”` : 'Sets people keep coming back to'}</div>` + sets.map(s => `<button class="lib-item ${LIB.pick === s.name ? 'on' : ''}" data-lset="${LDB.sets.indexOf(s)}"><b>${esc(s.name)}</b><span>${esc(s.line)} · ${s.items.length} · ${esc(s.by)}</span></button>`).join(''); }
    $('libList').innerHTML = `<div class="lib-search"><input id="libQ" placeholder="${dict ? 'Search the dictionary…' : 'Search the principles…'}" spellcheck="false" autocomplete="off" value="${esc(LIB.q)}"></div>${list}`;
    const inp = $('libQ'); inp.oninput = () => { LIB.q = inp.value; const at = inp.selectionStart; renderLibrary(); const i2 = $('libQ'); i2.focus(); i2.setSelectionRange(at, at); };
    // the detail
    const D = $('libDetail'); const t = dict && LIB.pick && learnTerm(LIB.pick), s = !dict && LIB.pick && LDB.sets.find(x => x.name === LIB.pick);
    if (t) D.innerHTML = `<div class="lib-kicker">${esc(t.g)}</div><h3>${esc(t.t)}</h3><p>${esc(t.d)}</p>${t.why ? `<p class="lib-why">${esc(t.why)}</p>` : ''}${t.see && seeName(t.see) ? `<button class="lib-see" data-lsee="${t.see}">Open the ${esc(seeName(t.see))} →</button>` : ''}<div class="lib-acts"><button class="solid" data-ladd="term">Add as a note</button><button data-lask="${esc(t.t)}">Ask Mochi more</button></div>`;
    else if (s) D.innerHTML = `<div class="lib-kicker">${esc(s.by)}</div><h3>${esc(s.name)}</h3><p class="lib-why">${esc(s.line)}</p><ol class="lib-items">${s.items.map(([a, b]) => `<li><b>${esc(a)}</b>${b ? ` <span>${esc(b)}</span>` : ''}</li>`).join('')}</ol><div class="lib-acts"><button class="solid" data-ladd="set">Add as a checklist</button></div>`;
    else D.innerHTML = `<div class="lib-empty"><canvas id="libGoo" width="64" height="56"></canvas><p>${dict ? 'Pick a term to read it in full, or search for one.' : 'Pick a set to see what’s in it.'}</p></div>`;
    const cv = $('libGoo'); if (cv && window.Goo) try { Goo(cv); } catch (e) {}
  }
  $('library').addEventListener('click', e => {
    if (e.target === $('library')) return closeLibrary();
    const part = e.target.closest('[data-lpart]'); if (part) { LIB.part = part.dataset.lpart; LIB.q = ''; LIB.pick = null; return renderLibrary(); }
    const g = e.target.closest('[data-lgroup]'); if (g) { LIB.group = g.dataset.lgroup; LIB.q = ''; LIB.pick = null; return renderLibrary(); }
    const tb = e.target.closest('[data-lterm]'); if (tb) { LIB.pick = tb.dataset.lterm; return renderLibrary(); }
    const sb = e.target.closest('[data-lset]'); if (sb) { LIB.pick = LDB.sets[+sb.dataset.lset]?.name; return renderLibrary(); }
    const add = e.target.closest('[data-ladd]'); if (add) { if (add.dataset.ladd === 'term') { const t = learnTerm(LIB.pick); if (t) dropTerm(t); } else { const s = LDB.sets.find(x => x.name === LIB.pick); if (s) dropSet(s); } return closeLibrary(); }
    const see = e.target.closest('[data-lsee]'); if (see) { const k2 = see.dataset.lsee; closeLibrary(); if (DZ_TABS[k2]) { settings.wDesign = true; settings.dzTab = k2; applySettings(); renderDzTabs(); } else placeFramework(k2); return; }
    const ak = e.target.closest('[data-lask]'); if (ak) { closeLibrary(); return ask(`Tell me more about ${ak.dataset.lask} in design, with an example I could try on this board.`); }
  });
  ['pointerdown', 'mousedown', 'dblclick', 'wheel', 'keydown'].forEach(t => $('library').addEventListener(t, e => e.stopPropagation(), { passive: t === 'wheel' }));
  $('libClose').onclick = closeLibrary;
  addEventListener('keydown', e => { if (e.key === 'Escape' && $('library').classList.contains('on')) { e.stopImmediatePropagation(); closeLibrary(); } }, true);
  document.querySelector('.box[data-box="learn"]')?.addEventListener('click', e => { const b = e.target.closest('[data-lib]'); if (b) openLibrary(b.dataset.lib); });
  // ---------- offline recipes: structure Mochi can see, she can build without Claude. Your selection first, otherwise the notes on the board, in reading order ----------
  const RECIPE_TYPES = ['note', 'text', 'title', 'todo'];
  function recipeSource() {
    const pick = c => RECIPE_TYPES.includes(c.type) && !c.hidden, sel = selCards().filter(pick), all = board.cards.filter(c => pick(c) && !parentOf(c.id));
    return (sel.length >= 2 ? sel : all).slice().sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));
  }
  const wordsOf = c => ((c.text || c.name || '').trim().split('\n')[0] || (c.items && c.items[0]?.t) || (c.rows && c.rows.flat().find(v => (v || '').trim())) || 'Untitled').slice(0, 60);
  const besideAll = () => { const cs = board.cards.filter(c => !c.hidden); return cs.length ? { x: Math.max(...cs.map(c => c.x + c.w)) + 200, y: Math.min(...cs.map(c => c.y)) } : centerWorld(); };
  function removeCards(cs) { remember(); const ids = new Set(cs.map(c => c.id)); board.cards = board.cards.filter(c => !ids.has(c.id)); board.links = board.links.filter(l => !ids.has(l.a) && !ids.has(l.b)); ids.forEach(id => cardsEl.querySelector(`[data-id="${id}"]`)?.remove()); selectOnly([]); renderWires(); layersSoon(); save(); }
  const RECIPES = {
    sitemap: { re: /site ?map|page tree|site structure|pages/i, name: 'sitemap', build(src, at) {
      const title = src.find(c => c.type === 'title'), root = title || src[0], kids = src.filter(c => c !== root), made = [], links = [];
      const colls = board.cards.filter(c => c.type === 'coll' && !c.hidden), W = 150, GX = 40, GY = 90;
      const tree = { name: wordsOf(root), kids: [...kids.map(c => ({ name: wordsOf(c), kids: [] })), ...colls.map(c => ({ name: c.text || 'Pages', kids: (c.kids || []).map(byId).filter(Boolean).map(n => ({ name: wordsOf(n), kids: [] })) }))] };
      const width = n => n.kids.length ? Math.max(W, n.kids.reduce((s, k) => s + width(k), 0) + GX * (n.kids.length - 1)) : W;
      const lay = (n, x, y, parent) => { const w = width(n), c = kitCard('site', { ...PAGE, text: n.name }, { x: x + w / 2, y: y + 48 }); made.push(c); if (parent) links.push(kitLink(parent, c, SIDE.b, SIDE.t));
        let cx = x; n.kids.forEach(kd => { lay(kd, cx, y + 96 + GY, c); cx += width(kd) + GX; }); };
      lay(tree, at.x, at.y, null); return { made, links }; } },
    flow: { re: /flow ?chart|user flow|\bflow\b|steps|process|in order/i, name: 'flowchart', build(src, at) {
      const made = [], links = []; let prev = null;
      src.forEach((c, i) => { const s = i === 0 || i === src.length - 1 ? { ...FLOW['Start / end'], text: wordsOf(c) } : { ...FLOW['Process'], text: wordsOf(c) }, n = kitCard('flow', s, { x: at.x + 110, y: at.y + 45 + i * 150 });
        made.push(n); if (prev) links.push(kitLink(prev, n, SIDE.b, SIDE.t)); prev = n; }); return { made, links }; } },
    journey: { re: /journey|customer path|experience map/i, name: 'journey map', build(src, at) {
      const cols = ['sky', 'lilac', 'butter', 'mint', 'peach', 'pink'];
      const F0 = { name: 'Journey map', emoji: '🗺️', items: [{ t: 'title', x: 0, y: 0, text: 'Journey map' }, ...src.map((c, i) => ({ t: 'coll', x: i * 300, y: 90, name: `${i + 1} · ${wordsOf(c)}`, color: cols[i % cols.length], notes: [{ text: 'What they do', color: 'white' }, { text: '😊 How they feel', color: 'mint' }] })),
        { t: 'how', x: src.length * 300, y: 90, text: 'One column per step, from your notes. In each, add what they do (white), how they feel (green = good, pink = rough) and what gets in the way.\n\nThe pink notes are your opportunities.' }] };
      placeFramework(null, at, F0); return null; } },
    mind: { re: /mind ?map|branches|brainstorm map/i, name: 'mind map', build(src, at) {
      const title = src.find(c => c.type === 'title'), rootC = title || src[0], kids = src.filter(c => c !== rootC), made = [], links = [];
      const cx = at.x + 420, cy = at.y + 260, root = kitCard('mind', { ...ROOT, text: wordsOf(rootC) }, { x: cx, y: cy }, { root: true }); made.push(root);
      kids.forEach((c, i) => { const a = -Math.PI / 2 + (i + .5) * Math.PI * 2 / Math.max(1, kids.length), n = kitCard('mind', { ...BRANCH, text: wordsOf(c), fill: MIND_COLORS[i % MIND_COLORS.length] }, { x: cx + Math.cos(a) * 340, y: cy + Math.sin(a) * 210 }); made.push(n); links.push(kitLink(root, n)); });
      return { made, links }; } },
    checklist: { re: /check ?list|to-?do|tasks|action items/i, name: 'checklist', build(src, at) {
      const items = src.flatMap(c => c.type === 'todo' ? (c.items || []) : [{ t: wordsOf(c), done: false }]);
      const c = card('todo', { x: Math.round(at.x), y: Math.round(at.y), w: 300, h: 60 + items.length * 30, text: 'To do', items, color: 'white', r: 0 }); return { made: [c], links: [] }; } },
  };
  function runRecipe(key, src) {
    const R = RECIPES[key], at = besideAll(); remember();
    const out = R.build(src, at); if (out) { out.made.forEach(c => { board.cards.push(c); renderCard(c, true); }); board.links.push(...out.links); selectOnly(out.made.map(c => c.id)); renderWires(); layoutAll(); save(); fit(out.made); }
    say(`Here’s a ${R.name} from your ${src.length} ${src.length === 1 ? 'note' : 'notes'} ✦ I left the originals where they were.`, 0, [{ label: 'Remove the original notes', run: () => removeCards(src) }, { label: 'Keep both', ghost: true, run: () => {} }]);
  }
  // true if Mochi built something (or asked which thing to build)
  function offlineRecipe(q) {
    const s = String(q); if (flowTplAsk(s)) return true; if (flowAsk(s)) return true;
    if (/\b(what|why|explain|mean|define|how do(es)?)\b/i.test(s) && !/\b(make|build|turn|create|put|draw|convert)\b/i.test(s)) return false;   // a question is the dictionary's, not a recipe
    const hit = Object.keys(RECIPES).find(k => RECIPES[k].re.test(s));
    const wants = /\b(make|build|turn|create|put|lay ?out|arrange|organi[sz]e|structure|map out|draw|convert)\b/i.test(s) || hit;
    if (!wants) return false;
    const src = recipeSource();
    if (hit) { if (src.length < 2 && hit !== 'checklist') { say(`Write a few notes first, one per ${hit === 'sitemap' ? 'page' : hit === 'journey' ? 'step' : 'idea'}, then ask me again and I’ll build the ${RECIPES[hit].name} from them ✦`, 7000); return true; } if (!src.length) { say('Write a note or two first and I’ll turn them into a checklist ✦', 6000); return true; } runRecipe(hit, src); return true; }
    if (!/\b(this|these|them|my notes|the notes|board)\b/i.test(s) || src.length < 2) return false;   // "organize this" with nothing to organize: not ours
    say(`I can build a few things from your ${src.length} notes without thinking too hard. Which one?`, 0, ['sitemap', 'flow', 'journey', 'mind', 'checklist'].map(k => ({ label: RECIPES[k].name[0].toUpperCase() + RECIPES[k].name.slice(1), run: () => runRecipe(k, recipeSource()) })));
    return true;
  }
  // Mochi answers from the dictionary when she can't think (no Claude, offline, the web demo). Returns true if she did.
  function learnAnswer(q) {
    const s = String(q).toLowerCase().replace(/[?.!,’']/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.split(' ').length > 12) return false;   // long asks aren't dictionary questions
    if (/\b(make|build|turn|create|put|lay ?out|arrange|organi[sz]e|structure|map out|draw|convert|add|these|this|them)\b/.test(s)) return false;   // a doing-word means they want something made, not explained
    const hits = LDB.terms.filter(t => { const n = t.t.toLowerCase(); return (' ' + s + ' ').includes(' ' + n + ' ') || s === n || s.endsWith(' ' + n) || (n.length > 4 && s.includes(n)); }).sort((a, b) => b.t.length - a.t.length);
    const t = hits[0]; if (!t) return false;
    const asks = /^(what|whats|what s|define|explain|meaning|tell me about|describe|who|how)\b/.test(s) || s === t.t.toLowerCase() || s.split(' ').length <= 3; if (!asks) return false;
    say(`${t.t}: ${t.d}${t.why ? ' ' + t.why : ''}${t.see && seeName(t.see) ? ` (See the ${seeName(t.see)}.)` : ''}`, 0, [{ label: 'Put it on the board', run: () => dropTerm(t) }, { label: 'Open the dictionary', ghost: true, run: () => { LIB.group = t.g; openLibrary('dictionary', t.t); } }]); return true;
  }
  // the panel's tabs: which come first, and which are off, live in Settings → Widgets
  const DZ_TABS = { wf: 'Wireframing', flow: 'Flowchart', journey: 'Journey', site: 'Sitemap', mind: 'Mind map' };
  function dzOrder() {
    const s = settings.dzTabs || {}, keys = Object.keys(DZ_TABS), order = [...(s.order || []).filter(k => keys.includes(k)), ...keys.filter(k => !(s.order || []).includes(k))];
    const hidden = new Set(s.hidden || []), shown = order.filter(k => !hidden.has(k)); return { order, hidden, shown: shown.length ? shown : [order[0]] };
  }
  function renderDzTabs() {
    const { shown } = dzOrder(), cur = shown.includes(settings.dzTab) ? settings.dzTab : shown[0];
    $('dzTabs').innerHTML = shown.map(k => `<button data-dzt="${k}" class="${k === cur ? 'on' : ''}">${DZ_TABS[k]}</button>`).join(''); $('dzTabs').hidden = shown.length < 2;
    $('design').querySelectorAll('.dz-pane').forEach(p => p.hidden = p.dataset.pane !== cur);
    $('design').dataset.tab = cur;   // (the widget is called Ideate; the lit tab says which kit is open)
  }
  $('dzTabs').onclick = e => { const b = e.target.closest('[data-dzt]'); if (!b) return; if (placing) stopPlacing(); pickWF(null); settings.dzTab = b.dataset.dzt; renderDzTabs(); applySettings(); };
  function renderDzList() {
    const L = $('setDzList'); if (!L) return; const { order, hidden } = dzOrder();
    L.innerHTML = order.map(k => `<div class="tbe-row${hidden.has(k) ? ' off' : ''}" draggable="true" data-tb="${k}"><span class="tbe-grip">⋮⋮</span><span class="tbe-name">${DZ_TABS[k]}</span><input type="checkbox" class="tgl" ${hidden.has(k) ? '' : 'checked'} aria-label="Show ${DZ_TABS[k]}"></div>`).join('');
  }
  (() => { const L = $('setDzList'); if (!L) return;
    const now = () => ({ order: [...L.querySelectorAll('.tbe-row')].map(r => r.dataset.tb), hidden: [...L.querySelectorAll('.tbe-row')].filter(r => !r.querySelector('input').checked).map(r => r.dataset.tb) });
    const commit = () => { const n = now(); if (n.hidden.length >= n.order.length) { n.hidden = n.hidden.slice(1); chirp('One tab stays on ✦', 1800); } settings.dzTabs = n; renderDzList(); renderDzTabs(); applySettings(); };
    L.onchange = e => { if (e.target.matches('input')) commit(); };
    let dragging = null;
    L.ondragstart = e => { dragging = e.target.closest('.tbe-row'); if (!dragging) return; dragging.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging.dataset.tb); };
    L.ondragover = e => { if (!dragging) return; e.preventDefault(); const r = e.target.closest('.tbe-row'); if (!r || r === dragging) return; const box = r.getBoundingClientRect(); L.insertBefore(dragging, e.clientY < box.top + box.height / 2 ? r : r.nextSibling); };
    L.ondragend = () => { if (!dragging) return; dragging.classList.remove('drag'); dragging = null; commit(); };
    $('dzReset').onclick = () => { delete settings.dzTabs; renderDzList(); renderDzTabs(); applySettings(); };
  })();
  renderDzTabs(); renderDzList();

  // ---------- remove a picture's background: the Mac's own Vision model, or the open-source one in the page (fetched once, kept by the browser) ----------
  const BGRM = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm'; let bgrm = null;
  // crop a see-through PNG to the pixels that are left (plus a little breathing room)
  function trimAlpha(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => {
      const W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return res({ src, w: W, h: H, ow: W, oh: H });
      const pad = Math.round(Math.max(W, H) * .02); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, w, h);
      res({ src: o.toDataURL('image/png'), w, h, ow: W, oh: H }); }; im.onerror = () => res({ src, w: 1, h: 1, ow: 1, oh: 1 }); im.src = src; });
  }
  async function removeBg(c) {
    if (c.nobg) { if (c.srcBg) { remember(); c.src = c.srcBg; if (c.bgBox) Object.assign(c, c.bgBox); delete c.srcBg; delete c.bgBox; delete c.nobg; renderCard(c); selectOnly([c.id]); renderWires(); $('selbar').dataset.key = ''; save(); } return; }   // put the background back
    if (c._busy) return; c._busy = true; const el = cardsEl.querySelector(`[data-id="${c.id}"]`); el?.classList.add('busy');
    chirp(MB.removeBg ? 'Lifting the subject out ✦' : 'Lifting the subject out ✦ The first time fetches a little model (about 40 MB), then it works offline.', 7000);
    try {
      let out = null;
      if (MB.removeBg) { try { out = await MB.removeBg(c.src); } catch (e) { if (!/macOS 14/.test(String(e.message))) throw e; } }   // an older Mac falls through to the page's model
      if (!out) { bgrm = bgrm || await import(BGRM); const blob = await bgrm.removeBackground(await (await fetch(await MB.mediaURL(c.src))).blob()); out = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }
      const t = await trimAlpha(out);   // hug the subject: the card shrinks to what's left, staying where its middle was
      remember(); c.srcBg = c.src; c.bgBox = { x: c.x, y: c.y, w: c.w, h: c.h }; c.src = t.src; c.nobg = true; delete c.crop;
      const cx = c.x + c.w / 2, cy = c.y + c.h / 2, w = Math.round(c.w * Math.min(1, t.w / Math.max(1, t.ow))), h = Math.round(w * t.h / Math.max(1, t.w)); c.w = Math.max(40, w); c.h = Math.max(40, h); c.x = Math.round(cx - c.w / 2); c.y = Math.round(cy - c.h / 2);
      renderCard(c); selectOnly([c.id]); renderWires(); $('selbar').dataset.key = ''; save(); chirp('Background gone ✦', 2000);
    } catch (e) { const m = String(e.message || e); say(/no subject/.test(m) ? 'I couldn’t find a subject to lift out of that one.' : 'Hmm, I couldn’t lift that one out. ' + m, 6000); }
    finally { c._busy = false; el?.classList.remove('busy'); }
  }
  // ---------- the browser try-out: a small banner says where boards live, with the way out; × puts it away for good on this browser ----------
  if (MB.web && $('webBar')) {
    let off = false; try { off = localStorage.getItem('mochiboard:webbar') === 'off'; } catch (e) {}
    // sit in the open space between the board's name and the panels on the right; step down only when that's too tight (the update banner's rule)
    const fitWebBar = () => { const b = $('webBar'); if (b.hidden) return; b.classList.remove('low'); b.style.left = '';
      const st = stage.getBoundingClientRect(), t = document.querySelector('.top')?.getBoundingClientRect(), w = b.getBoundingClientRect().width;
      const right = [$('design'), $('tray')].map(el => el?.getBoundingClientRect()).filter(r => r && r.width && r.top < 140).reduce((m, r) => Math.min(m, r.left), st.right);
      const from = (t ? t.right : st.left) + 20, to = right - 20;
      if (to - from >= w) b.style.left = (from + to) / 2 - st.left + 'px'; else b.classList.add('low'); };
    if (!off) { $('webBar').hidden = false; requestAnimationFrame(fitWebBar); setTimeout(fitWebBar, 400); addEventListener('resize', fitWebBar); }
    ['pointerdown', 'mousedown', 'dblclick'].forEach(t => $('webBar').addEventListener(t, e => e.stopPropagation()));
    $('wbGet').onclick = () => MB.openURL('https://mochiboard.app/#download');
    $('wbX').onclick = () => { $('webBar').hidden = true; try { localStorage.setItem('mochiboard:webbar', 'off'); } catch (e) {} };
  }

  // ---- the flow library (web/flows.js): whole flows as wireframes, placed by a click in the Wireframing pane or by Mochi offline ----
  const FLOWS = window.FLOWS || [], flowBy = key => FLOWS.find(f => f.key === key);
  function freeSpot(w, h) {   // the first empty spot near the view: where you're looking, else below everything, else to the right
    const vx = (300 - view.x) / view.z, vy = (120 - view.y) / view.z, boxes = board.cards.filter(c => !c.hidden).map(c => [c.x, c.y, c.x + c.w, c.y + c.h]);
    const free = (x, y) => !boxes.some(b => x < b[2] + 60 && x + w > b[0] - 60 && y < b[3] + 60 && y + h > b[1] - 60);
    const cands = [[vx, vy]]; if (boxes.length) { cands.push([vx, Math.max(...boxes.map(b => b[3])) + 200]); cands.push([Math.min(...boxes.map(b => b[0])), Math.max(...boxes.map(b => b[3])) + 200]); }
    for (const [x, y] of cands) if (free(x, y)) return { x: Math.round(x), y: Math.round(y) }; return besideAll();
  }
  // the why, as a few small notes instead of one wall of text
  function whyNotes(lines, x, y, made) { let yy = y; lines.forEach((t, i) => { const h = 54 + Math.ceil(t.length / 40) * 19; const n = card('note', { x, y: yy, w: 300, h, text: t, name: i ? '' : 'Why it works', color: 'white', fs: 's', r: i % 2 ? 1.2 : -1 }); board.cards.push(n); renderCard(n, true); made.push(n); yy += h + 12; }); return yy; }
  function placeFlow(key, quiet) {
    const F = flowBy(key); if (!F) return null;
    const estW = 360 + F.screens.reduce((a, sp) => a + (sp.w || DEVICES[sp.device][0]) + (sp.panel ? (sp.panel.w || 300) : 0) + 140, 0), estH = Math.max(...F.screens.map(sp => DEVICES[sp.device][1])) + 260;
    remember(); const at = freeSpot(estW, estH), made = [], frames = []; let sx = at.x + 360, prev = null;
    whyNotes(F.why, at.x, at.y, made);
    const title = card('title', { x: at.x, y: at.y - 70, w: 700, h: 50, text: F.name }); board.cards.push(title); renderCard(title, true); made.push(title);
    F.screens.forEach(sp => {
      const pw = sp.panel ? (sp.panel.w || Math.round((sp.w || DEVICES[sp.device][0]) * 0.46)) : 0, spec = { ...sp, w: (sp.w || DEVICES[sp.device][0]) - pw };
      const { f, made: m } = buildScreen(spec, sx, at.y); frames.push(f); m.forEach(c => made.push(c));
      if (pw) {   // a side panel (brand image, order summary, sidebar) the stacker can't do: widen the screen and drop a labeled placeholder beside the stack
        const left = sp.panel.side === 'left'; f.w += pw; renderCard(f);
        if (left) m.filter(c => c !== f).forEach(c => { c.x += pw; renderCard(c); });
        const p = PH(0, 0, pw, f.h, sp.panel.img, { radius: 0, fill: '#f4f4f5' }), c = card(p.type, { ...p, x: left ? f.x : f.x + f.w - pw, y: f.y, r: 0, onFrame: f.id }); board.cards.push(c); renderCard(c, true); made.push(c);
      }
      m.filter(c => c.type === 'note' && c.w > 420).forEach(n => { n.w = 420; renderCard(n); });   // a desktop screen's note needn't be as wide as the screen
      if (prev) board.links.push({ id: uid(), a: prev.id, b: f.id, arrow: true }); prev = f; sx += f.w + 140;
    });
    layoutAll(); renderWires(); save(); selectOnly([]); fit(made);
    if (!quiet) chirp(`${F.name} is on the board: ${F.screens.length} screen${F.screens.length === 1 ? '' : 's'} and the why. Every piece is editable ✦`, 5000);
    return made;
  }
  const FLOW_CATS = [...new Set(FLOWS.map(f => f.cat))];
  // ---- the Wireframing Templates window: the flow library, drawn out screen by screen, with the why ----
  const WFM = { cat: null, pick: null };
  function flowPreview(F) {
    const mob = F.platform !== 'web', FW = mob ? 150 : 270, FH = mob ? 300 : 190, GAP = 48, n = F.screens.length, W = n * FW + (n - 1) * GAP + 40, H = FH + 70;
    const block = (x, y, w, h, fill, r = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
    let g = '';
    F.screens.forEach((sc, i) => {
      const x0 = 20 + i * (FW + GAP), y0 = 20, pad = mob ? 12 : 16, iw = FW - pad * 2; let y = y0 + (mob ? 26 : 30);
      g += `<rect x="${x0}" y="${y0}" width="${FW}" height="${FH}" rx="${mob ? 22 : 10}" fill="#fff" stroke="#d9d2dc" stroke-width="2"/>`;
      g += mob ? `<rect x="${x0 + FW / 2 - 22}" y="${y0 + 9}" width="44" height="7" rx="3.5" fill="#e8e2ea"/>` : `<rect x="${x0}" y="${y0}" width="${FW}" height="22" rx="10" fill="#efeaf1"/><circle cx="${x0 + 14}" cy="${y0 + 11}" r="3.5" fill="#f7b5c8"/><circle cx="${x0 + 26}" cy="${y0 + 11}" r="3.5" fill="#f8e08a"/><circle cx="${x0 + 38}" cy="${y0 + 11}" r="3.5" fill="#a8e6c3"/>`;
      const items = (sc.items || []).slice(0, 14);
      for (const it of items) {
        if (y > y0 + FH - 24) break;
        const pz = String(it.piece || '').toLowerCase(), x = x0 + pad;
        if (pz === 'nav bar') { g += block(x, y, iw, 14, '#efeaf1', 4); y += 22; }
        else if (pz === 'tab bar') { g += block(x0 + 6, y0 + FH - 26, FW - 12, 18, '#efeaf1', 6); }
        else if (pz === 'space') { y += Math.min(28, (it.h || 16) / 2); }
        else if (pz === 'heading') { g += block(x, y, iw * .7, 10, '#5d5564', 3); y += 14; if (it.sub) { g += block(x, y, iw * .5, 6, '#c9c2cd', 3); y += 12; } y += 4; }
        else if (pz === 'button') { g += block(x, y, iw, 20, it.style === 'secondary' || it.style === 'ghost' ? '#efeaf1' : '#2b2630', 10); y += 26; }
        else if (pz === 'input' || pz === 'search') { g += `<rect x="${x}" y="${y}" width="${iw}" height="20" rx="8" fill="#fff" stroke="#d9d2dc" stroke-width="1.5"/>`; y += 26; }
        else if (pz === 'text') { g += block(x, y, iw * (it.align === 'center' ? .6 : .85), 6, '#c9c2cd', 3) ; y += 12; }
        else if (pz === 'image' || pz === 'hero' || pz === 'card') { g += block(x, y, iw, mob ? 54 : 40, '#e4dde7', 8); y += (mob ? 60 : 46); }
        else if (pz === 'list row' || pz === 'row' || pz === 'list') { g += block(x, y, iw, 16, '#f3eff5', 5); y += 20; }
        else if (pz === 'code' || pz === 'otp') { for (let k = 0; k < 4; k++) g += `<rect x="${x + k * (iw / 4)}" y="${y}" width="${iw / 4 - 6}" height="24" rx="6" fill="#fff" stroke="#d9d2dc" stroke-width="1.5"/>`; y += 30; }
        else { g += block(x, y, iw, 12, '#f3eff5', 4); y += 16; }
      }
      g += `<text x="${x0 + FW / 2}" y="${y0 + FH + 30}" text-anchor="middle" font-size="15" font-weight="600" fill="#6b6370">${esc(sc.name)}</text>`;
      if (i < n - 1) g += `<path d="M${x0 + FW + 8} ${y0 + FH / 2}H${x0 + FW + GAP - 8}" stroke="#8c8494" stroke-width="2.2" fill="none" marker-end="url(#wfarrow)"/>`;
    });
    return `<svg class="wf-prev" viewBox="0 0 ${W} ${H}" font-family="var(--font)"><defs><marker id="wfarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8c8494"/></marker></defs>${g}</svg>`;
  }
  function openFlowLib(pick) { if (!$('wfModal')) buildFlowLibModal(); WFM.cat = WFM.cat || FLOW_CATS[0]; if (pick) { WFM.pick = pick; WFM.cat = flowBy(pick).cat; } $('wfModal').classList.add('on'); renderFlowLibModal(); setTimeout(() => ($('wfList').querySelector('.lib-item.on') || $('wfList').querySelector('.lib-item'))?.focus(), 30); }
  const closeFlowLib = () => $('wfModal')?.classList.remove('on');
  function buildFlowLibModal() {
    const m = document.createElement('div'); m.className = 'settings library ft-modal'; m.id = 'wfModal';
    m.innerHTML = `<div class="set-panel lib-panel"><div class="set-head"><h2>Wireframe templates</h2><button class="dv-btn" id="wfClose" title="Close">×</button></div><div class="lib-body"><nav class="lib-nav" id="wfNav"></nav><div class="lib-list" id="wfList"></div><div class="lib-detail" id="wfDetail"></div></div></div>`;
    document.body.appendChild(m); $('wfClose').onclick = closeFlowLib; m.addEventListener('click', e => { if (e.target === m) closeFlowLib(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('on')) { e.stopPropagation(); closeFlowLib(); } }, true);
    m.addEventListener('click', e => { const n = e.target.closest('[data-wfcat]'); if (n) { WFM.cat = n.dataset.wfcat; renderFlowLibModal(); return; }
      const i = e.target.closest('[data-wfkey]'); if (i) { WFM.pick = i.dataset.wfkey; renderFlowLibModal(); return; }
      const add = e.target.closest('[data-wfadd]'); if (add) { closeFlowLib(); if (placing) stopPlacing(); pickWF(null); placeFlow(add.dataset.wfadd); } });
  }
  function renderFlowLibModal() {
    $('wfNav').innerHTML = FLOW_CATS.map(c => `<button data-wfcat="${esc(c)}" class="lib-part ${WFM.cat === c ? 'on' : ''}">${esc(c)} <small>${FLOWS.filter(f => f.cat === c).length}</small></button>`).join('');
    const list = FLOWS.filter(f => f.cat === WFM.cat);
    $('wfList').innerHTML = `<div class="lib-h">${esc(WFM.cat)}</div>` + list.map(f => `<button class="lib-item ${WFM.pick === f.key ? 'on' : ''}" data-wfkey="${f.key}"><b>${esc(f.name.replace(/^[^·]+·\s*/, ''))}</b><span>${esc(f.line)}</span><small class="ft-meta">${esc(f.platform)} · ${f.screens.length} screen${f.screens.length === 1 ? '' : 's'}</small></button>`).join('');
    const F = WFM.pick && flowBy(WFM.pick), D = $('wfDetail');
    D.innerHTML = F ? `<div class="lib-kicker">${esc(F.cat)} · ${esc(F.platform)}</div><h3>${esc(F.name)}</h3><p class="lib-why">${esc(F.line)}</p><div class="ft-prevbox">${flowPreview(F)}</div><ul class="ft-why">${(F.why || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul><div class="lib-acts"><button class="solid" data-wfadd="${F.key}">Add to the board</button></div>`
      : `<div class="lib-empty"><p>Pick a flow to see its screens drawn out, with the thinking behind them.</p></div>`;
  }
  function renderDzFlows() {
    const b = $('wfTplBtn'); if (!b) return;
    $('wfTplN').textContent = `${FLOWS.length} app flows`;
    b.onclick = e => { e.stopPropagation(); if (placing) stopPlacing(); pickWF(null); openFlowLib(); };
  }
  renderDzFlows();
  window.__flows = { ask: s => flowAsk(s), place: placeFlow, n: () => FLOWS.length, open: openFlowLib };   // for the test harness
  // Mochi offline: "make me a login flow" places one from the library (web words pick the web version)
  const FLOW_ASKS = [[/forgot|reset (my )?password|password reset/i, ['forgot-mobile']], [/\blog ?in|sign ?in|login\b/i, ['login-mobile', 'login-web']], [/sign ?up|regist|create account/i, ['signup-mobile', 'signup-web']],
    [/onboard|welcome|first[- ]run|first time/i, ['onboard-carousel', 'onboard-quiz']], [/check ?out|\bcart\b|payment|purchase/i, ['checkout-mobile', 'checkout-web']], [/dashboard/i, ['dashboard-web']], [/settings|profile (page|screen)/i, ['settings-mobile']], [/empty state/i, ['empty-states']]];
  function flowAsk(s) {
    if (!FLOWS.length) return false;
    const hit = FLOW_ASKS.find(([re]) => re.test(s)); if (!hit) return false;
    if (!/\b(make|build|create|draw|put|place|add|give|show|wireframe|wireframes|screens?|flow|mockups?|layout|design)\b/i.test(s) && s.trim().split(/\s+/).length > 4) return false;   // "what is onboarding" is the dictionary's; a bare "forgot password" is fine
    if (/\b(what|why|explain|mean|define)\b/i.test(s) && !/\b(make|build|create|draw|put|place|add)\b/i.test(s)) return false;
    let keys = hit[1]; const web = /\b(web|desktop|website|browser|laptop)\b/i.test(s), quiz = /quiz|question|personali/i.test(s);
    let key = keys.length === 1 ? keys[0] : keys[0].startsWith('onboard') ? (quiz ? keys[1] : keys[0]) : (web ? keys[1] : keys[0]);
    const F = flowBy(key), alt = keys.find(k => k !== key); if (!F) return false;
    placeFlow(key, true);
    say(`Here’s ${F.name} from the library: ${F.screens.length === 1 ? 'one screen' : F.screens.length + ' screens'} with the why beside it. Change anything; it’s yours now ✦`, 0,
      [...(alt ? [{ label: `Try the ${flowBy(alt).platform === 'web' ? 'web' : alt.includes('quiz') ? 'quiz' : 'mobile'} one instead`, run: () => { undo(); placeFlow(alt); } }] : []), { label: 'Undo', ghost: true, run: () => undo() }]);
    return true;
  }

  // ---- what Mochi is doing while she thinks: a line made from the ask itself ("finding font ideas…"), and little check-ins when it runs long ----
  const DOING = [   // Mochi's own verbs: she squishes, hops, bounces and peeks
    [/^(what|why|how come|is|are|does|do|should i|which is)\b|\bwhat (is|are|does)\b|\bmean\b|\bexplain\b/i, 'squishing on that one'],
    [/\b(mobbin|inspiration|references?|examples? of|other apps|real apps|how (do )?(other|most|good) (apps|people|designers|teams))\b/i, 'peeking at real apps'],
    [/\bfonts?\b|typeface|typography|type ideas/i, 'squishing through fonts'],
    [/\b(organi[sz]e|group|sort|cluster|tidy|arrange|by theme)\b/i, 'hopping your notes into piles'],
    [/\b(wireframes?|screens?|mockups?|app layout|landing page|website|user flow|log ?in|sign ?up|onboarding|checkout|dashboard)\b/i, 'sketching little screens'],
    [/\b(pictures?|photos?|images?|illustrations?|fill the)\b/i, 'hunting for pictures'],
    [/\b(site ?map|flow ?chart|journey|mind ?map|persona|affinity|impact|effort|retro|storyboard|template|framework)\b/i, 'bouncing a map together'],
    [/\b(colou?rs?|palette|swatch|hex)\b/i, 'mixing colors'],
    [/\b(rename|move|file|folder|project|archive|boards?)\b/i, 'tidying your boards'],
    [/\b(summari[sz]e|sum up|tl;?dr|recap|what did)\b/i, 'reading the whole board'],
    [/\b(write|draft|copy|headline|tagline|name for|names for|caption)\b/i, 'nibbling on words'],
    [/\b(plan|schedule|week|checklist|to-?do|steps)\b/i, 'lining up the steps'],
  ];
  const DOING_ANY = ['hopping on it', 'squishing on it', 'bouncing ideas around', 'wiggling into it'];
  function doingLabel(q) { const s = String(q || ''); const hit = DOING.find(([re]) => re.test(s)); return hit ? hit[1] : DOING_ANY[Math.floor(Math.random() * DOING_ANY.length)]; }
  const LATER = ['still squishing', 'nearly there ✦', 'this one’s a thinker', 'ok, really nearly there'];
  let doingTimer = 0;
  function showDoing(label) {
    clearTimeout(doingTimer); const put = t => { const b = $('mcList').querySelector('.typing span'); if (b) b.textContent = t + '…'; $('mcStatus').textContent = t + '…'; };
    put(label); let i = 0; const tick = () => { if (!$('mcList').querySelector('.typing')) return; put(LATER[Math.min(i, LATER.length - 1)]); i++; doingTimer = setTimeout(tick, i === 1 ? 10000 : 14000); };
    doingTimer = setTimeout(tick, 9000);
  }

  // ---- pixel-Mochi placeholder pictures (stamps/ph, drawn by tools/placeholders.py): the empty image spot shows a little scene that matches its label ----
  const PH_SCENES = [[/\b(album|song|podcast|audio|music|playlist|headphones|spotify|track|record)\b/i, 'music'], [/\b(screenshot|screen ?shot|ui|interface|app screen)\b/i, 'photo'], [/\b(logo|icon|brand|badge|emblem|mark)\b/i, 'product'],
    [/\b(hero|landscape|banner|cover|outdoor|park|city|street|sky|beach|mountain|garden|sunny|nature|view)\b/i, 'landscape'],
    [/\b(portrait|avatar|profile|face|person|woman|man|user|customer|headshot|selfie|founder)\b/i, 'portrait'], [/\b(team|people|friends|group|family|crowd|together|community)\b/i, 'team'],
    [/\b(product|item|shoe|bag|food|dish|coffee|cake|bottle|box|packag|merch|shirt|plate|meal|drink)\b/i, 'product'], [/\b(photo|camera|gallery|snapshot|picture of)\b/i, 'photo'],
    [/\b(chart|graph|stats?|data|dashboard|analytics|report|number)\b/i, 'chart'], [/\b(map|location|route|trip|travel|place|address|pin)\b/i, 'map'], [/\b(music|song|audio|podcast|video|film|movie|playlist|headphones)\b/i, 'music']];
  function phScene(c) { if (c && typeof c === 'object') { if (c.ph && PH_LIST.some(p => p[0] === c.ph)) return c.ph; c = c.img; } const s = String(c || ''); const hit = PH_SCENES.find(([re]) => re.test(s)); return hit ? hit[1] : 'any'; }
  const PH_LIST = [['landscape', 'a landscape'], ['portrait', 'a portrait'], ['product', 'a product'], ['team', 'the team'], ['photo', 'a photo'], ['chart', 'a chart'], ['map', 'a map'], ['music', 'media'], ['any', 'a picture']];

  // ---- the placeholder library in the Wireframing pane: click to add a spot, or drag one onto a picture to replace it ----
  function renderDzPh() {
    const L = $('dzPh'); if (!L) return;
    L.innerHTML = PH_LIST.map(([k, n]) => `<button data-ph="${k}" draggable="true" title="${esc(n)}"><img src="stamps/ph/${k}.png" alt="" draggable="false"><span>${esc(k === 'any' ? 'any' : k)}</span></button>`).join('');
    L.onclick = e => { const b = e.target.closest('[data-ph]'); if (!b) return; const at = centerWorld(); addSpot(b.dataset.ph, at.x - 150, at.y - 112); };
    L.addEventListener('dragstart', e => { const b = e.target.closest('[data-ph]'); if (!b) return; e.dataTransfer.setData('mb/ph', b.dataset.ph); e.dataTransfer.effectAllowed = 'copy'; });
  }
  function addSpot(scene, x, y) { const n = PH_LIST.find(p => p[0] === scene)?.[1] || 'a picture'; remember(); const c = card('box', { x: Math.round(x), y: Math.round(y), w: 300, h: 225, r: 0, fill: '#ffffff', stroke: '#e4e4e7', sw: 1, radius: 12, img: n, ph: scene }); addCard(c); selectOnly([c.id]); return c; }
  function placeholderOnto(c, scene) {   // a placeholder dropped on a picture: the picture goes, the placeholder takes its spot
    remember();
    if (c.type === 'box') { delete c.src; delete c.srcBg; delete c.nobg; delete c.fx; delete c.fy; delete c.fz; c.ph = scene; if (!c.img) c.img = PH_LIST.find(p => p[0] === scene)?.[1] || 'a picture'; }
    else { c.type = 'box'; c.ph = scene; c.img = PH_LIST.find(p => p[0] === scene)?.[1] || 'a picture'; ['src', 'crop', 'nobg', 'srcBg', 'fx', 'fy', 'fz', 'sw', 'stroke', 'noframe', 'tagText', 'radius'].forEach(key => delete c[key]); c.r = 0; c.fill = '#e4e4e7'; }   // the photo becomes a real spot
    renderCard(c); renderWires(); save(); selectOnly([c.id]);
  }
  renderDzPh();
  // ---- replacing a picture: click a placeholder spot (or right-click any picture) for a little menu: upload one, ask Mochi, change the label, or go back to the placeholder ----
  const isPic = c => c && ((c.type === 'box' && c.img) || c.type === 'image');
  const picPick = document.createElement('input'); picPick.type = 'file'; picPick.accept = 'image/*'; picPick.hidden = true; picPick.id = 'picPick'; document.body.appendChild(picPick);
  function pictureMenu(c, x, y, above) {
    $('rowMenu')?.remove(); const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu pic-menu'; m.style.left = x + 'px'; m.style.top = y + 'px';
    const spot = c.type === 'box';
    const mkl = maskLayerOf(c); m.innerHTML = `<span class="pm-title">${spot ? esc(c.img) : 'Picture'}${mkl ? ` · masked with the ${esc(shapeWord(mkl))}` : ''}</span><button data-m="up">Upload a picture…</button><button data-m="mochi">Ask Mochi for one ✦</button>` +
      (c.src ? `<button data-m="frame2">Adjust the crop</button>` : '') + (spot && c.src ? `<button data-m="nobg2">${c.nobg ? 'Put the background back' : 'Remove the background'}</button>` : '') + (c.src ? `<button data-m="png">Save as PNG…</button><button data-m="jpg">Save as JPEG…</button>` : '') + (spot || c.nobg ? '' : `<button data-m="nobg">Remove the background</button>`) + `<button data-m="mask" class="has-sub">Mask</button>` + ((isMasked(c) || c.maskLayer) ? `<button data-m="unmask">${isMasked(c) ? 'Take it out of the mask' : 'Turn the mask back into a shape'}</button>` : '') + `<button data-m="arr" class="has-sub">Arrange</button><span class="rm-sep"></span><button data-m="dup">Duplicate</button><button data-m="del" class="danger">Delete</button>`;
    const subs = { mask: () => maskSub([c]), arr: arrangeSub };
    document.body.appendChild(m); const r = m.getBoundingClientRect(); if (above) m.style.top = y - r.height - 8 + 'px'; if (r.right > innerWidth - 10) m.style.left = innerWidth - r.width - 10 + 'px'; if (!above && r.bottom > innerHeight - 10) m.style.top = innerHeight - r.height - 10 + 'px';
    const close = () => { m.remove(); $('rowSub')?.remove(); removeEventListener('pointerdown', away, true); removeEventListener('keydown', escP, true); };
    const away = ev => { if (!m.contains(ev.target) && !$('rowSub')?.contains(ev.target)) close(); }, escP = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } }; setTimeout(() => addEventListener('pointerdown', away, true), 0); addEventListener('keydown', escP, true);
    m.addEventListener('mouseover', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; if (subs[b.dataset.m]) openSub(b, subs[b.dataset.m](), close); else { $('rowSub')?.remove(); m.querySelectorAll('.sub-open').forEach(x => x.classList.remove('sub-open')); } });
    m.onclick = async ev => {
      const a = ev.target.closest('[data-m]')?.dataset.m; if (!a) return; if (subs[a]) { openSub(ev.target.closest('[data-m]'), subs[a](), close); return; } close();
      if (a === 'unmask') unmask([c]);
      if (a === 'dup') duplicateCards([c]);
      if (a === 'del') removeSelected();
      if (a === 'up') { picPick.value = ''; picPick.onchange = async () => { const f = picPick.files[0]; if (f) putPicture(c, await imageFromFile(f)); }; picPick.click(); }
      if (a === 'mochi') { if (spot) { const v = prompt('What picture should go here?', c.img); if (v == null) return; if (v.trim() && v.trim() !== c.img) { remember(); c.img = v.trim(); renderCard(c); save(); } if (c.src) { remember(); delete c.src; renderCard(c); } offerFill([c]); } /* the label is the brief Mochi works from */ else { if (!chatOpen()) mochiOpen(true); const i = $('mcInput'); i.value = 'Make me a new picture for the selected one: '; i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
      if (a === 'frame2') startFrame(c);
      if (a === 'png' || a === 'jpg') exportPicture(c, a);
      if (a === 'nobg2') removeBgSpot(c);
      if (a === 'nobg') removeBg(c);
    };
  }
  function putPicture(c, im) {
    remember(); const spot = c.type === 'box';
    if (spot) { c.src = im.src; delete c.fx; delete c.fy; delete c.fz; } else { c.src = im.src; c.h = Math.round(c.w * im.h / im.w) + (c.noframe ? 0 : 16); delete c.crop; }
    renderCard(c); renderWires(); save(); selectOnly([c.id]); chirp(spot ? 'Picture’s in. Right-click it to crop or swap it ✦' : 'Swapped ✦', 4500);
  }
  // a file dragged from the Finder onto a picture or a placeholder lands in it (instead of becoming a new card next to it)
  const picUnder = e => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.card'); const c = el && byId(el.dataset.id); return isPic(c) ? c : null; };
  const hasFile = e => { const t = [...(e.dataTransfer?.types || [])]; return t.includes('Files') || t.includes('mb/ph'); };
  let picOver = null;
  stage.addEventListener('dragover', e => { if (!hasFile(e)) return; const c = picUnder(e); if (c !== picOver) { picOver?.id && cardsEl.querySelector(`[data-id="${picOver.id}"]`)?.classList.remove('pic-over'); picOver = c; if (c) cardsEl.querySelector(`[data-id="${c.id}"]`)?.classList.add('pic-over'); } }, true);
  stage.addEventListener('dragleave', e => { if (picOver && !stage.contains(e.relatedTarget)) { cardsEl.querySelector(`[data-id="${picOver.id}"]`)?.classList.remove('pic-over'); picOver = null; } }, true);
  stage.addEventListener('drop', async e => {
    if (picOver) { cardsEl.querySelector(`[data-id="${picOver.id}"]`)?.classList.remove('pic-over'); picOver = null; }
    const scene = e.dataTransfer?.getData('mb/ph');
    if (scene) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const c = picUnder(e); if (c) placeholderOnto(c, scene); else { const w = toWorld(e.clientX, e.clientY); addSpot(scene, w.x - 150, w.y - 112); } return; }
    const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length !== 1) return;
    const c = picUnder(e); if (!c) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); putPicture(c, await imageFromFile(files[0])); }, true);
  // folder cards: drag what's inside out onto the board, and scroll the list once the card is selected (otherwise the wheel moves the board as usual)
  cardsEl.addEventListener('pointerdown', foDragStart, true);
  stage.addEventListener('wheel', e => { const l = e.target.closest?.('.fo-list'); if (!l || e.ctrlKey || e.metaKey) return; const el = l.closest('.card');
    if (!el || !sel.has(el.dataset.id) || l.scrollHeight <= l.clientHeight + 1) return; e.stopImmediatePropagation(); }, { capture: true, passive: true });
  cardsEl.addEventListener('contextmenu', e => { const el = e.target.closest('.card'); const c = el && byId(el.dataset.id); if (!isPic(c)) return; if (sel.size > 1 && sel.has(c.id)) return; e.preventDefault(); e.stopPropagation(); selectOnly([c.id]); pictureMenu(c, e.clientX, e.clientY); }, true);
  // (a plain click on a placeholder just selects it; the menu is on right-click, or Replace… in the bar)
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-pic]'); if (!b) return; e.stopImmediatePropagation(); const c = selCards()[0]; if (!c) return; const r = b.getBoundingClientRect(); pictureMenu(c, r.left, r.top, true); }, true);
  // the pen: a right-click finishes the line where it is (no new point, no menu)   // right-click finishes the pen
  let penEnded = 0;
  stage.addEventListener('pointerdown', e => { if (penT && e.button === 2) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); endPen(true); penEnded = Date.now(); } }, true);
  stage.addEventListener('contextmenu', e => { if (penT || Date.now() - penEnded < 600) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if (penT) endPen(true); } }, true);

  // ---- arrowheads on pen lines: the same ends as connectors (arrow, triangle, dot, diamond), drawn in screen pixels so a stretched card doesn't squash them ----
  function endMark(kind, tip, from, col, sw) {
    if (!kind || kind === 'none') return '';
    const ux = tip.x - from.x, uy = tip.y - from.y, ul = Math.hypot(ux, uy) || 1, ax = ux / ul, ay = uy / ul, nx = -ay, ny = ax, s = Math.max(1, (sw || 2) / 2.5), f = v => +v.toFixed(2);
    if (kind === 'arrow') return `<path d="M${f(tip.x - ax * 11 * s + nx * 7 * s)} ${f(tip.y - ay * 11 * s + ny * 7 * s)} L${f(tip.x)} ${f(tip.y)} L${f(tip.x - ax * 11 * s - nx * 7 * s)} ${f(tip.y - ay * 11 * s - ny * 7 * s)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (kind === 'tri') return `<path d="M${f(tip.x)} ${f(tip.y)} L${f(tip.x - ax * 13 * s + nx * 6.5 * s)} ${f(tip.y - ay * 13 * s + ny * 6.5 * s)} L${f(tip.x - ax * 13 * s - nx * 6.5 * s)} ${f(tip.y - ay * 13 * s - ny * 6.5 * s)} Z" fill="${col}" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (kind === 'dot') return `<circle cx="${f(tip.x - ax * 5 * s)}" cy="${f(tip.y - ay * 5 * s)}" r="${f(5 * s)}" fill="${col}"/>`;
    return `<path d="M${f(tip.x)} ${f(tip.y)} L${f(tip.x - ax * 7 * s + nx * 5.5 * s)} ${f(tip.y - ay * 7 * s + ny * 5.5 * s)} L${f(tip.x - ax * 14 * s)} ${f(tip.y - ay * 14 * s)} L${f(tip.x - ax * 7 * s - nx * 5.5 * s)} ${f(tip.y - ay * 7 * s - ny * 5.5 * s)} Z" fill="${col}" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  }
  function pathEnds(c) {
    if (c.closed || !(c.head || c.tail) || !c.pts || c.pts.length < 2 || !(c.sw > 0)) return '';
    const sx = (c.w || c.ow) / Math.max(1, c.ow), sy = (c.h || c.oh) / Math.max(1, c.oh), k = c.ow / Math.max(1, c.w);   // viewBox units → screen px (the path itself is drawn at k = ow / w)
    const px = q => ({ x: q.x * k * sx, y: q.y * k * sy }), n = c.pts.length, col = c.stroke || '#27272a', sw = c.sw || 2;
    const P = i => c.pts[i], a = P(n - 1), b = P(n - 2), dirA = b.ox != null ? { x: b.ox, y: b.oy } : a.ix != null ? { x: a.ix, y: a.iy } : b;   // the last segment's incoming direction, following a bezier handle if there is one
    const s0 = P(0), s1 = P(1), dirS = s0.ox != null ? { x: s0.ox, y: s0.oy } : s1.ix != null ? { x: s1.ix, y: s1.iy } : s1;
    const marks = endMark(c.head, px(a), px(dirA), col, sw) + endMark(c.tail, px(s0), px(dirS), col, sw);
    return marks ? `<g transform="scale(${(1 / sx).toFixed(5)} ${(1 / sy).toFixed(5)})">${marks}</g>` : '';
  }
  $('selbar').addEventListener('click', e => {
    const we = e.target.closest('[data-we]'); if (!we || selWires.size) return; const c = selCards()[0]; if (!c || c.type !== 'path') return;
    e.stopImmediatePropagation(); remember(); const [which, kind] = we.dataset.we.split(':'); if (kind === 'none') delete c[which]; else c[which] = kind;
    renderCard(c); closeSbPops(); $('selbar').dataset.key = ''; save(); }, true);

  // ---- framing: double-click a filled image spot to move and zoom the picture inside its mask (focus fx, fy in 0..1; zoom fz ≥ 1). Non-destructive. ----
  function frameStyle(c) { const fx = (c.fx ?? .5) * 100, fy = (c.fy ?? .5) * 100, fz = c.fz ?? 1; return `object-position:${fx}% ${fy}%;transform:scale(${fz});transform-origin:${fx}% ${fy}%${c.nobg ? ';object-fit:contain' + (shadowOf(c) ? ';filter:' + shadowFilter(c) : '') : ''}`; }   // a cut-out's shadow follows what's visible of it, clipped by the spot like the picture is
  // background removal for a picture in a spot: same lift as a picture card, but the spot keeps its size (it's part of a layout); the cut-out sits inside it
  async function removeBgSpot(c) {
    if (c.nobg) { if (c.srcBg) { remember(); c.src = c.srcBg; delete c.srcBg; delete c.nobg; renderCard(c); selectOnly([c.id]); save(); } return; }
    if (c._busy) return; c._busy = true; const el = cardsEl.querySelector(`[data-id="${c.id}"]`); el?.classList.add('busy');
    chirp(MB.removeBg ? 'Lifting the subject out ✦' : 'Lifting the subject out ✦ The first time fetches a little model (about 40 MB), then it works offline.', 7000);
    try {
      let out = null;
      if (MB.removeBg) { try { out = await MB.removeBg(c.src); } catch (e) { if (!/macOS 14/.test(String(e.message))) throw e; } }
      if (!out) { bgrm = bgrm || await import(BGRM); const blob = await bgrm.removeBackground(await (await fetch(await MB.mediaURL(c.src))).blob()); out = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); }
      const t = await trimAlpha(out);
      remember(); c.srcBg = c.src; c.src = t.src; c.nobg = true; delete c.fx; delete c.fy; delete c.fz;
      renderCard(c); selectOnly([c.id]); save(); chirp('Background gone ✦', 2000);
    } catch (e) { const m = String(e.message || e); say(/no subject/.test(m) ? 'I couldn’t find a subject to lift out of that one.' : 'Hmm, I couldn’t lift that one out. ' + m, 6000); }
    finally { c._busy = false; el?.classList.remove('busy'); }
  }
  let framing = null;   // { c, el, bar }
  function startFrame(c) {
    if (framing) endFrame(); const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return;
    remember(); selectOnly([c.id]); framing = { c, el, was: { fx: c.fx, fy: c.fy, fz: c.fz } }; el.classList.add('framing');
    const bar = document.createElement('div'); bar.className = 'frame-bar'; bar.innerHTML = `<span>Drag the picture to reposition it · scroll to zoom in or out · Esc cancels</span><button data-f="reset">Reset</button><button data-f="done" class="pri">Done</button>`; refreshCropTip(); document.body.appendChild(bar); framing.bar = bar;
    bar.onclick = e => { const a = e.target.closest('[data-f]')?.dataset.f; if (a === 'reset') { delete c.fx; delete c.fy; delete c.fz; applyFrame(c); } if (a === 'done') endFrame(); };
    ['pointerdown', 'mousedown', 'dblclick'].forEach(t => bar.addEventListener(t, e => e.stopPropagation()));
  }
  const imgFrameStyle = c => { const fx = (c.fx ?? .5) * 100, fy = (c.fy ?? .5) * 100, fz = c.fz ?? 1; return `object-position:${fx}% ${fy}%;transform:scale(${fz});transform-origin:${fx}% ${fy}%`; };
  function applyFrame(c) { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return; const st = c.type === 'image' ? imgFrameStyle(c) : frameStyle(c); el.querySelectorAll('.bx-img, .bx-ghost').forEach(i => i.style.cssText = st); }
  function endFrame() { if (!framing) return; const { c, el, bar } = framing; framing = null; el.classList.remove('framing'); bar.remove(); save(); refreshCropTip(); }
  // while a cropped-in picture is selected, a little tip above the toolbar says how to get at the crop
  const cropTip = document.createElement('div'); cropTip.className = 'frame-bar crop-tip'; cropTip.hidden = true; cropTip.textContent = 'Double-click the picture to adjust its crop'; document.body.appendChild(cropTip);
  // the tip shows only while the pointer is over a picture (not all the time it's selected)
  let hoverPic = null;
  function refreshCropTip() { cropTip.hidden = !!framing || !hoverPic || settings.hints === false; if (hoverPic) cropTip.textContent = hoverPic.src ? 'Right-click to crop or swap the picture' : 'Right-click to see image options'; }
  // decided from what is really under the pointer on every move (over/out events are unreliable with the pointer captured mid-drag)
  let tipRaf = 0;
  addEventListener('pointermove', e => { if (tipRaf) return; tipRaf = requestAnimationFrame(() => { tipRaf = 0;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.card'); const c = el && cardsEl.contains(el) && byId(el.dataset.id);
    hoverPic = c && isPic(c) && (c.src || c.img) && !drag ? c : null; refreshCropTip(); }); }, true);
  document.addEventListener('mouseleave', () => { hoverPic = null; refreshCropTip(); });
  addEventListener('pointerdown', () => { hoverPic = null; refreshCropTip(); }, true);   // it steps aside the moment you do anything
  const frameImg = () => framing && framing.el.querySelector('.bx-img');
  // (no double-click into cropping: a double-click already means "pick this one inside its group". Crop lives on right-click, the Crop chip and the bar.)
  // drag moves the focus point; the overflow (how much picture hangs outside the mask) decides how far a pixel of drag goes
  let fdrag = null;
  cardsEl.addEventListener('pointerdown', e => {
    if (!framing || e.button !== 0) return; const el = e.target.closest('.card'); if (!el || el !== framing.el) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const c = framing.c, im = frameImg(), iw = im?.naturalWidth || 1, ih = im?.naturalHeight || 1, z = view.z, cover = Math.max(c.w / iw, c.h / ih), fz = c.fz ?? 1;
    fdrag = { x: e.clientX, y: e.clientY, fx: c.fx ?? .5, fy: c.fy ?? .5, ox: iw * cover * fz - c.w, oy: ih * cover * fz - c.h, z };
    const mv = ev => { const dx = (ev.clientX - fdrag.x) / fdrag.z, dy = (ev.clientY - fdrag.y) / fdrag.z;
      if (fdrag.ox > 1) c.fx = Math.max(0, Math.min(1, fdrag.fx - dx / fdrag.ox)); if (fdrag.oy > 1) c.fy = Math.max(0, Math.min(1, fdrag.fy - dy / fdrag.oy)); applyFrame(c); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); fdrag = null; };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }, true);
  stage.addEventListener('wheel', e => {
    if (!framing) return; const el = e.target.closest('.card'); if (!el || el !== framing.el) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const c = framing.c; c.fz = Math.max(1, Math.min(4, (c.fz ?? 1) * (e.deltaY < 0 ? 1.06 : 1 / 1.06))); if (c.fz === 1) delete c.fz; applyFrame(c);
  }, { capture: true, passive: false });
  addEventListener('keydown', e => { if (!framing) return; if (e.key === 'Escape') { const { c, was } = framing; Object.assign(c, was); ['fx', 'fy', 'fz'].forEach(k => c[k] == null && delete c[k]); applyFrame(c); endFrame(); e.stopPropagation(); } if (e.key === 'Enter') { endFrame(); e.stopPropagation(); } }, true);
  stage.addEventListener('pointerdown', e => { if (framing && !e.target.closest('.card') && !e.target.closest('.frame-bar')) endFrame(); }, true);
  // ways in to framing besides the double-click: a Frame chip on the selected spot, a Frame button in its bar, and Mochi mentions it once
  cardsEl.addEventListener('click', e => { const b = e.target.closest('.bx-fr'); if (!b) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const c = byId(b.closest('.card').dataset.id); if (c) startFrame(c); }, true);
  cardsEl.addEventListener('pointerdown', e => { if (e.target.closest('.bx-fr')) { e.stopPropagation(); e.stopImmediatePropagation(); } }, true);
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-frame2]'); if (!b) return; e.stopImmediatePropagation(); const c = selCards()[0]; if (c?.type === 'box' && c.src) startFrame(c); }, true);

  // ---- drop shadows, the Figma way: x, y, blur, spread, colour and opacity, live, with presets to start from ----
  const SHADOW_PRESETS = { soft: { x: 0, y: 8, blur: 18, spread: 0, color: '#1e1428', a: 18 }, medium: { x: 0, y: 14, blur: 30, spread: 0, color: '#1e1428', a: 22 }, strong: { x: 0, y: 26, blur: 52, spread: 2, color: '#1e1428', a: 28 }, hard: { x: 8, y: 8, blur: 0, spread: 0, color: '#1e1428', a: 90 } };
  const SHADOWABLE = ['box', 'image', 'shape', 'frame', 'path', 'canvas'];
  const shadowOf = c => !c.shadow ? null : typeof c.shadow === 'string' ? SHADOW_PRESETS[c.shadow] || null : c.shadow;
  const rgba = (hex, a) => { const h = String(hex || '#1e1428').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(100, a ?? 18)) / 100})`; };
  function shadowCss(c) { const s = shadowOf(c); return s && !(c.type === 'box' && c.nobg) ? `${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${rgba(s.color, s.a)}` : 'none'; }   // drawn by a layer behind the card (see the css), so the wobble filter can't clip it; a cut-out in a spot shadows its outline instead (see frameStyle)
  function shadowFilter(c) { const s = shadowOf(c); return s ? `drop-shadow(${s.x}px ${s.y}px ${Math.max(0, s.blur / 2)}px ${rgba(s.color, s.a)})` : 'none'; }   // outlines: no spread in a drop-shadow, so the blur does the work
  const bwOf = c => isMasked(c) ? 0 : c.sw != null ? Math.max(0, +c.sw || 0) : (c.nobg || c.noframe ? 0 : 8), bcOf = c => c.stroke || '#ffffff';   // a fresh picture's 8px white mat is its default stroke
  const outlineFilter = (w, col) => { if (!(w > 0)) return ''; const d = +(w * .7).toFixed(2); return [[w, 0], [-w, 0], [0, w], [0, -w], [d, d], [-d, d], [d, -d], [-d, -d]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${col})`).join(' '); };
  function borderVars(c, el) {
    if (c.type !== 'image') return; const w = bwOf(c), prev = el.dataset.mat === undefined ? null : +el.dataset.mat;
    if (prev !== null && prev !== w && !c.nobg) { const d = w - prev; c.x -= d; c.y -= d; c.w = Math.max(24, c.w + 2 * d); c.h = Math.max(24, c.h + 2 * d); Object.assign(el.style, { left: c.x + 'px', top: c.y + 'px', width: c.w + 'px', height: c.h + 'px' }); }   // the picture stays put; only the mat grows or goes
    el.dataset.mat = w; el.style.setProperty('--mat', (c.nobg ? 0 : w) + 'px'); el.style.setProperty('--matc', w > 0 ? bcOf(c) : 'transparent');
    el.style.setProperty('--img-R', (c.radius ?? 20) + 'px');   // the corner you see (the mat's outer edge, or the picture's when there is no mat); the picture inside follows it
    if (c.nobg && w > 0) el.style.setProperty('--outl', outlineFilter(w, bcOf(c))); else el.style.removeProperty('--outl'); }
  function shadowVars(c, el) { el.classList.toggle('cutout', c.type === 'box' && !!c.nobg); borderVars(c, el);
    if (shadowOf(c)) { el.dataset.sh = 'on'; el.style.setProperty('--shb', shadowCss(c)); el.style.setProperty('--shf', shadowFilter(c)); el.style.setProperty('--shr', (c.type === 'box' || c.type === 'frame' ? (c.radius || 0) : c.type === 'image' ? (c.noframe ? (c.radius ?? 12) : 18) : 18) + 'px'); }
    else { delete el.dataset.sh; el.style.removeProperty('--shb'); el.style.removeProperty('--shf'); el.style.removeProperty('--shr'); } }
  const SH_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="10" height="10" rx="2"/><path d="M7 16.5h7.5a2 2 0 0 0 2-2V7" stroke-dasharray="2 2"/></svg>';
  function shadowPop(cs) {
    const s = shadowOf(cs[0]) || null, cur = typeof cs[0].shadow === 'string' ? cs[0].shadow : s ? 'custom' : '', v = s || SHADOW_PRESETS.medium, missing = cs.some(c => !shadowOf(c));
    const row = (key, label, val, min, max, unit = 'px') => `<div class="sh-row" data-shk="${key}"><span class="sh-l" data-scrub="${key}" title="Drag to change">${label}</span><input type="range" min="${min}" max="${max}" step="1" value="${val}" style="--p:${(val - min) / (max - min) * 100}%" data-shr="${key}"><input type="number" value="${val}" data-shn="${key}" aria-label="${label}"><i>${unit}</i></div>`;
    return `<span class="sb-popw" data-popw="shadow"><button class="sb-poptrig sb-ic ${s ? 'on' : ''}" data-pop="shadow" title="Shadow">${SH_ICON}</button><div class="sb-pop sb-pop-shadow ${s ? '' : 'off'}"><div class="shbody">
      <div class="sh-head"><b class="sh-title">Drop shadow</b><span class="sh-btns">${missing ? `<button class="sh-clear sh-add" data-shadd="1" title="${s ? 'Give the rest a shadow too' : 'Add a shadow'}">Add${s ? ' to all' : ''}</button>` : ''}${s ? `<button class="sh-clear" data-shd="" title="Remove the shadow">Clear</button>` : ''}</span></div>
      ${row('x', 'X', v.x, -60, 60)}${row('y', 'Y', v.y, -60, 60)}${row('blur', 'Blur', v.blur, 0, 100)}${row('spread', 'Spread', v.spread, -30, 60)}${row('a', 'Opacity', v.a, 0, 100, '%')}
      <div class="sh-row sh-color"><span class="sh-l">Color</span><button class="sb-shsw" data-shsw="1" style="background:${v.color}" title="Pick a color" aria-label="Pick a color"></button><input class="sb-shhex" type="text" value="${v.color.replace('#', '').toUpperCase()}" data-shhex="1" maxlength="7" spellcheck="false" aria-label="Hex color"></div>
      <div class="sh-pre"><span class="sh-l">Start from</span><div class="sb-shpre">${[['', 'None'], ['soft', 'Soft'], ['medium', 'Medium'], ['strong', 'Strong'], ['hard', 'Hard']].map(([k, n]) => `<button data-shd="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    </div></div></span>`;
  }
  const SH_RANGE = { x: [-200, 200], y: [-200, 200], blur: [0, 200], spread: [-60, 100], a: [0, 100] };
  const shTargets = () => selCards().filter(c => SHADOWABLE.includes(c.type));
  let shMark = false;
  function setShadow(f) { const cs = shTargets(); if (!cs.length) return; if (!shMark) { remember(); shMark = true; }
    cs.forEach(c => { const s = { ...(shadowOf(c) || SHADOW_PRESETS.medium) }; f(s, c); c.shadow = s; renderCard(c); }); }
  const shSet = (key, val, pop) => { const [lo, hi] = SH_RANGE[key]; val = Math.round(Math.max(lo, Math.min(hi, val))); const nb = pop.querySelector(`[data-shn="${key}"]`), rg = pop.querySelector(`[data-shr="${key}"]`); if (nb) nb.value = val; if (rg) { rg.value = val; rg.style.setProperty('--p', (val - rg.min) / (rg.max - rg.min) * 100 + '%'); }
    setShadow(s => { s[key] = val; }); pop.querySelectorAll('[data-shd]').forEach(b => b.classList.remove('on')); };
  const reopenShadow = () => {   // the bar won't redraw while a dropdown is open, so: close, redraw (Add ↔ Clear, greyed or not), open the fresh sheet
    document.querySelectorAll('#selbar .sb-popw.open').forEach(w => w.classList.remove('open')); $('selbar').dataset.key = ''; placeSelbar();
    requestAnimationFrame(() => { const w = document.querySelector('#selbar [data-popw="shadow"]'); if (w) w.classList.add('open'); }); };
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-shd], [data-shadd]'); if (!b) return; e.stopImmediatePropagation(); remember();
    const kind = b.dataset.shadd ? 'medium' : b.dataset.shd;   // Add starts you on Medium, so the shadow is plainly there
    shTargets().forEach(c => { if (b.dataset.shadd) { if (!shadowOf(c)) c.shadow = 'medium'; } else if (kind) c.shadow = kind; else delete c.shadow; renderCard(c); });
    shMark = false; save(); reopenShadow(); }, true);
  $('selbar').addEventListener('input', e => {
    const r = e.target.closest('[data-shn], [data-shr], [data-shhex]'); if (!r) return; e.stopImmediatePropagation(); const pop = r.closest('.sb-pop');
    if (r.dataset.shhex) { const h = r.value.trim().replace(/^#/, ''); if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h)) return; const hex = '#' + (h.length === 3 ? h.split('').map(x => x + x).join('') : h).toLowerCase(); setShadow(s => { s.color = hex; }); pop.querySelector('.sb-shsw').style.background = hex; return; }
    if (r.value === '') return; shSet(r.dataset.shn || r.dataset.shr, +r.value, pop); }, true);
  $('selbar').addEventListener('change', e => { if (e.target.closest('[data-shn], [data-shr], [data-shhex]')) { shMark = false; save(); } }, true);
  // Figma-style scrubbing: drag a field's label left or right to change it (Shift for ×10); arrows in the field work too
  $('selbar').addEventListener('pointerdown', e => { const h = e.target.closest('[data-scrub]'); if (!h) return; e.preventDefault(); e.stopPropagation();
    const key = h.dataset.scrub, pop = h.closest('.sb-pop'), nb = pop.querySelector(`[data-shn="${key}"]`), x0 = e.clientX, v0 = +nb.value || 0; h.classList.add('scrubbing'); document.body.classList.add('scrub-ew');
    const mv = ev => shSet(key, v0 + Math.round((ev.clientX - x0) / 2) * (ev.shiftKey ? 10 : 1), pop);
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); h.classList.remove('scrubbing'); document.body.classList.remove('scrub-ew'); shMark = false; save(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); }, true);
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-shsw]'); if (!b) return; e.stopImmediatePropagation(); const cs = shTargets(); if (!cs.length) return; const r = b.getBoundingClientRect(), s = shadowOf(cs[0]) || SHADOW_PRESETS.medium;
    openColor({ tint: true, fromBar: true, title: 'Shadow color', hex: s.color, presets: ['#1e1428', '#000000', '#5b4a66', '#e2649a', '#4f9dff', '#5fc795', '#f7b955', '#ffffff'], at: { x: r.left - 110, y: r.top - 480 },
      apply: hex => { setShadow(x => { x.color = hex; }); b.style.background = hex; const hx = b.parentElement.querySelector('.sb-shhex'); if (hx) hx.value = hex.replace('#', '').toUpperCase(); } }); }, true);
  $('selbar').addEventListener('keydown', e => { if (e.target.closest('[data-shhex], [data-shn]')) e.stopPropagation(); }, true);   // typing in the panel mustn't trigger board shortcuts

  // ---- saving a picture out: what you see (the crop, the framing, the cut-out) as a PNG or a JPEG, at 2× ----
  async function exportPicture(c, fmt, n) {
    try {
      const url = await MB.mediaURL(c.src), im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture wouldn’t load')); i.src = url; });
      const scale = 2, cv = document.createElement('canvas'), g = cv.getContext('2d');
      if (c.type === 'box') {   // a spot: the picture as it sits in its mask (cover + focus + zoom, or a cut-out sitting inside)
        cv.width = Math.round(c.w * scale); cv.height = Math.round(c.h * scale);
        if (fmt === 'jpg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
        const fx = c.fx ?? .5, fy = c.fy ?? .5, fz = c.fz ?? 1, fit = c.nobg ? Math.min(c.w / im.width, c.h / im.height) : Math.max(c.w / im.width, c.h / im.height), w = im.width * fit, h = im.height * fit;
        const ox = (c.w - w) * fx, oy = (c.h - h) * fy;   // object-position
        g.translate(c.w * fx * scale, c.h * fy * scale); g.scale(fz, fz); g.translate(-c.w * fx * scale, -c.h * fy * scale);   // then the zoom, around the focus
        g.drawImage(im, ox * scale, oy * scale, w * scale, h * scale);
      } else {   // a picture card: the crop if there is one, else the whole picture
        const k = c.crop; const sx = k ? k.x * im.width : 0, sy = k ? k.y * im.height : 0, sw = k ? k.w * im.width : im.width, sh = k ? k.h * im.height : im.height;
        cv.width = Math.round(sw); cv.height = Math.round(sh);
        if (fmt === 'jpg') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height); }
        g.drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      }
      const data = cv.toDataURL(fmt === 'jpg' ? 'image/jpeg' : 'image/png', .92).split(',')[1];
      const name = ((c.type === 'box' ? c.img : c.title || c.name) || 'Picture') + (n ? ` ${n}` : '');
      await MB.saveFile(data, String(name).slice(0, 60).replace(/[^\w\- ]+/g, ' ').trim() || 'Picture', fmt); chirp(`Saved as ${fmt === 'jpg' ? 'JPEG' : 'PNG'} ✦`, 2500);
    } catch (e) { say('Hmm, I couldn’t save that picture. ' + String(e.message || e), 6000); }
  }

  // ---- saving a selection as separate files: each object on its own, a group as one, a section as one, a screen with what's on it ----
  function exportPlan(cs) {
    const inside = (c, s) => c !== s && c.x >= s.x - 1 && c.y >= s.y - 1 && c.x + c.w <= s.x + s.w + 1 && c.y + c.h <= s.y + s.h + 1;
    const sections = cs.filter(c => c.type === 'section'), frames = cs.filter(c => c.type === 'frame'), taken = new Set(), plan = [];
    sections.forEach(s => { plan.push({ name: s.text || 'Section', cards: [s, ...board.cards.filter(c => inside(c, s))] }); cs.forEach(c => { if (inside(c, s)) taken.add(c.id); }); taken.add(s.id); });
    frames.forEach(f => { if (taken.has(f.id)) return; plan.push({ name: f.name || 'Screen', cards: [f] }); taken.add(f.id); onFrame(f).forEach(c => taken.add(c.id)); });
    const groups = {}; cs.forEach(c => { if (taken.has(c.id) || !c.group) return; (groups[c.group] = groups[c.group] || []).push(c); taken.add(c.id); });
    Object.values(groups).forEach(g => plan.push({ name: cardName(g.slice(0, 1)) + ' group', cards: g }));
    cs.forEach(c => { if (!taken.has(c.id)) plan.push({ name: cardName([c]), cards: [c] }); });
    return plan;
  }
  async function exportEach(cs) { const plan = exportPlan(cs); for (const p of plan) await exportCards(p.cards, p.name, false); }
  async function savePictures(cs, fmt) { let i = 0; for (const c of cs) await exportPicture(c, fmt, cs.length > 1 ? ++i : 0); }
  window.__exportPlan = exportPlan;

  // ---- masks: a shape laid over something becomes its edge. Pick a shape from the Mask menu, or draw one, put it on top, select both and use it as the mask ----
  const MASKS = {
    circle: ['Circle', () => '<ellipse cx="50" cy="50" rx="50" ry="50"/>'],
    rounded: ['Rounded', (W, H) => { const r = .2 * Math.min(W, H); return `<rect x="0" y="0" width="100" height="100" rx="${r * 100 / W}" ry="${r * 100 / H}"/>`; }],
    squircle: ['Squircle', () => '<path d="M50 0C92 0 100 8 100 50C100 92 92 100 50 100C8 100 0 92 0 50C0 8 8 0 50 0Z"/>'],
    pill: ['Pill', (W, H) => { const r = Math.min(W, H) / 2; return `<rect x="0" y="0" width="100" height="100" rx="${r * 100 / W}" ry="${r * 100 / H}"/>`; }],
    arch: ['Arch', (W, H) => { const ry = Math.min(100, W / 2 * 100 / H); return `<path d="M0 100V${ry}A50 ${ry} 0 0 1 100 ${ry}V100Z"/>`; }],
    tri: ['Triangle', () => '<path d="M50 0L100 100L0 100Z"/>'],
    diamond: ['Diamond', () => '<path d="M50 0L100 50L50 100L0 50Z"/>'],
    hex: ['Hexagon', () => '<path d="M25 0L75 0L100 50L75 100L25 100L0 50Z"/>'],
    star: ['Star', () => '<path d="M50 3L62 36L97 37L69 58L79 93L50 72L21 93L31 58L3 37L38 36Z"/>'],
    heart: ['Heart', () => '<path d="M50 92C20 72 3 55 3 33C3 15 17 4 31 4C40 4 47 9 50 16C53 9 60 4 69 4C83 4 97 15 97 33C97 55 80 72 50 92Z"/>'],
    blob: ['Blob', () => '<path d="M52 3C72 1 95 15 97 40C99 63 88 92 60 97C35 101 8 86 3 60C-2 33 25 6 52 3Z"/>'],
  };
  const maskable = c => c && !['section', 'coll'].includes(c.type) && !(c.type === 'shape' && c.shape === 'line') && !(c.type === 'path' && !c.closed);   // an open pen line can't be masked itself (nothing inside it)
  const vectorish = c => c && (c.type === 'shape' && c.shape !== 'line' && c.shape !== 'bool' || c.type === 'path' && (c.pts || []).length >= 3 || c.type === 'box' && !c.img && !c.src);   // drawn things: shapes, pen lines (3+ points close up), plain wireframe boxes
  const isBool = c => c && c.type === 'shape' && c.shape === 'bool' && (c.parts || []).length > 0;
  const maskSource = c => vectorish(c) || isPic(c) && !!c.src || isBool(c);   // a combined shape masks by its drawing, like a picture does by its see-through parts   // pictures can mask too (by their see-through parts), but they can't be combined
  const SHAPE_WORDS = { bool: 'combined shape', box: 'box', rect: 'rectangle', circle: 'circle', ellipse: 'ellipse', rounded: 'rounded box', squircle: 'squircle', arch: 'arch', hex: 'hexagon', blob: 'blob', tri: 'triangle', star: 'star', heart: 'heart', diamond: 'diamond', pill: 'pill', io: 'slanted box', doc: 'page', db: 'cylinder', fnote: 'note shape', page: 'page' };
  const shapeWord = s => isPic(s) ? (s.nobg ? 'cut-out' : 'picture') : s.type === 'path' ? 'drawn shape' : s.type === 'box' ? 'box' : SHAPE_WORDS[s.shape || 'rect'] || 'shape';
  // the geometry of a mask, in a 0–100 box (its own units for a drawn shape)
  function maskGeo(m, W, H) { if (m.el) return m.el; const d = MASKS[m.shape]; return d ? d[1](Math.max(1, W), Math.max(1, H)) : MASKS.circle[1](); }
  function sourceMask(s) {
    if (s.mgeo) return { shape: s.shape || 'rect', ...s.mgeo };
    if (s.type === 'box') return { shape: 'rect', el: `<rect x="0" y="0" width="100" height="100" rx="${(s.radius || 0) * 100 / Math.max(1, s.w)}" ry="${(s.radius || 0) * 100 / Math.max(1, s.h)}"/>` };
    if (isPic(s)) return { shape: 'pic', src: s.src };
    if (isBool(s)) return { shape: 'bool', src: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${boolSVG(s, '#000')}</svg>`) };
    if (s.type === 'path') return { shape: 'path', el: `<path d="${pathD(s.pts, true, s.radius || 0, s.ow / Math.max(1, s.w))}"/>`, vw: s.ow, vh: s.oh };
    const svg = shapeSVG({ ...s, stroke: null, sw: 0, fill: 'none' }), mt = svg.match(/<(path|rect|ellipse)\b[^>]*>/); if (!mt) return null;
    return { shape: s.shape || 'rect', el: mt[0].replace(/\s(?:style|stroke|stroke-width|stroke-linejoin|vector-effect|fill)="[^"]*"/g, '') + (mt[1] === 'path' ? '' : '') };
  }
  const maskIcon = (m, W = 100, H = 100) => m.src ? `<img src="${m.src}" alt="" style="width:14px;height:14px;object-fit:contain">` : `<svg viewBox="-2 -2 104 104" width="14" height="14" fill="currentColor">${maskGeo(m, W, H)}</svg>`;
  function maskVars(c, el) {
    if (c.maskLayer && !c.group) delete c.maskLayer;   // a mask pulled out of its group is just a shape again
    const layer = !!c.maskLayer; el.classList.toggle('maskl', layer);
    const mk = layer ? null : (liveMask(c) || c.mask), on = !!mk; el.classList.toggle('masked', on); el.querySelector(':scope > svg.mk')?.remove(); el.dataset.mk = mk ? maskSig(c, mk) : '';
    const wrap = el.querySelector(':scope > .mkw'); if (!on) { el.style.removeProperty('--mask'); el.style.removeProperty('--imask'); return; }
    const m = mk, bx = m.bx ?? 0, by = m.by ?? 0, bw = m.bw ?? 1, bh = m.bh ?? 1, vw = m.vw || 100, vh = m.vh || 100, id = 'mk-' + c.id;
    if (m.src) { el.style.removeProperty('--mask'); el.style.setProperty('--imask', `url("${m.src}") ${bx * c.w}px ${by * c.h}px / ${bw * c.w}px ${bh * c.h}px no-repeat`); }   // a picture mask: CSS alpha mask, placed where the picture was
    else el.style.removeProperty('--imask');
    const L = m.live, tf = L ? `translate(${L.cx} ${L.cy}) rotate(${L.dr}) translate(${-L.mw / 2} ${-L.mh / 2}) scale(${L.mw / vw} ${L.mh / vh})` : `translate(${bx * c.w} ${by * c.h}) scale(${bw * c.w / vw} ${bh * c.h / vh})`;   // in the card's own pixels
    if (!m.src) el.insertAdjacentHTML('beforeend', `<svg class="mk" width="0" height="0" aria-hidden="true"><clipPath id="${id}" clipPathUnits="userSpaceOnUse">${maskGeo(m, c.w * bw, c.h * bh).replace(/^<(path|rect|ellipse)\b/, `<$1 transform="${tf}"`)}</clipPath></svg>`);
    if (!m.src) el.style.setProperty('--mask', `url(#${id})`);
    if (!wrap) { const fr = el.querySelector(':scope > .frame'), bd = el.querySelector(':scope > .body'); if (fr && bd) { const w = document.createElement('div'); w.className = 'mkw'; el.insertBefore(w, fr); w.append(fr, bd); } }
  }
  // the Mask menu: the shape on top (if there is one) first, then the ready-made shapes
  function maskSub(cs) {
    const pairs = [], z = c => board.cards.indexOf(c), overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    if (cs.length === 2) { const [a, b] = cs, top = z(a) > z(b) ? a : b, bot = top === a ? b : a;
      if (maskSource(top) && maskable(bot)) pairs.push([top, [bot], maskSource(bot) ? ' on top' : '']); if (maskSource(bot) && maskable(top)) pairs.push([bot, [top], maskSource(top) ? ' underneath' : '']); }
    else if (cs.length === 1 && maskSource(cs[0]) && !isPic(cs[0])) {   // just the shape is selected: offer it as the mask for what it sits on
      const s = cs[0], under = board.cards.filter(c => c !== s && z(c) < z(s) && maskable(c) && overlaps(c, s)).sort((a, b) => z(b) - z(a)).slice(0, 1);
      if (under.length) pairs.push([s, under, '', ` for the ${(under[0].type === 'image' || under[0].type === 'box' && under[0].img) ? 'picture' : under[0].type} underneath`]); }
    else if (cs.length > 2) {   // a drag-select that caught the shape and a few things: the shape masks what it actually sits on (a stray sticker in the selection is left alone)
      const srcs = cs.filter(c => maskSource(c) && !isPic(c)); if (srcs.length === 1) { const s = srcs[0]; let ts = cs.filter(c => c !== s && maskable(c) && overlaps(c, s)); if (!ts.length) ts = cs.filter(c => c !== s && maskable(c));
        if (ts.length) pairs.push([s, ts, '', ts.length === 1 ? ` for the ${(ts[0].type === 'image' || ts[0].type === 'box' && ts[0].img) ? 'picture' : ts[0].type} underneath` : ` for the ${ts.length} things`]); } }
    const targets = pairs.length ? pairs[0][1] : cs.filter(maskable); if (!targets.length) return null;
    return [...pairs.map(([s, ts, where, tail]) => ({ label: `Use the ${shapeWord(s)}${where} as the mask${tail || ''}`, icon: maskIcon(sourceMask(s) || { shape: 'circle' }, s.w, s.h), run: () => ts.length === 1 ? maskWithShape(s, ts[0]) : maskManyWithShape(s, ts) })), ...(pairs.length ? ['-'] : []),
      ...Object.keys(MASKS).map(key => ({ label: MASKS[key][0], icon: maskIcon({ shape: key }), run: () => maskCards(targets, key) }))];
  }
  function maskMenuItems(cs) {
    const sub = maskSub(cs), out = []; if (sub) out.push({ label: 'Mask', sub });
    const mk = cs.find(c => c.maskLayer) || (cs[0] && maskLayerOf(cs[0])), whole = mk && groupMembers(mk.group).every(c => cs.includes(c));
    if (whole && !cs.includes(mk)) out.push({ label: `Select the ${shapeWord(mk)} (the mask)`, run: () => selectOnly([mk.id]) }); else if (whole) out.push({ label: 'Select the mask', run: () => selectOnly([mk.id]) });
    if (cs.some(c => isMasked(c) || c.maskLayer)) out.push({ label: whole || cs.includes(mk) ? 'Turn the mask back into a shape' : (cs.filter(c => isMasked(c)).length > 1 ? 'Take these out of the mask' : 'Take it out of the mask'), run: () => unmask(cs) });
    if (cs.length >= 2 && cs.every(vectorish)) out.push({ label: 'Combine shapes', sub: Object.keys(BOOL).map(op => ({ label: BOOL[op], icon: boolIcon(op), run: () => combine(cs, op) })) });
    if (cs.some(c => c.type === 'shape' && c.shape === 'bool')) out.push({ label: cs.filter(c => c.shape === 'bool').length > 1 ? 'Separate the shapes' : 'Separate the shapes', run: () => separate(cs.filter(c => c.type === 'shape' && c.shape === 'bool')) });
    return out;
  }
  // ---- combining shapes, like Figma's booleans: the one underneath comes first, the ones above are added, cut out, kept where they overlap, or flipped ----
  const BOOL = { union: 'Union', subtract: 'Subtract', intersect: 'Intersect', exclude: 'Exclude' };
  const placed = (p, fill) => p.el.replace(/^<(path|rect|ellipse)\b/, `<$1 transform="translate(${(p.bx ?? 0) * 100} ${(p.by ?? 0) * 100}) scale(${(p.bw ?? 1) * 100 / (p.vw || 100)} ${(p.bh ?? 1) * 100 / (p.vh || 100)})" fill="${fill}"`);
  function boolSVG(c, f) {
    const P = c.parts || [], id = 'bl' + String(c.id).replace(/[^a-z0-9]/gi, ''), M = (mid, inner) => `<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">${inner}</mask>`;
    if (!P.length) return '';
    let defs = M(id + 'r0', `<rect width="100" height="100" fill="#000"/>${placed(P[0], '#fff')}`);
    for (let i = 1; i < P.length; i++) {
      const prev = `${id}r${i - 1}`, W = `<rect width="100" height="100" fill="#fff" mask="url(#${prev})"/>`;
      if (c.op === 'exclude') defs += M(`${id}n${i}`, `<rect width="100" height="100" fill="#fff"/><rect width="100" height="100" fill="#000" mask="url(#${prev})"/>`);
      const body = c.op === 'union' ? W + placed(P[i], '#fff') : c.op === 'subtract' ? W + placed(P[i], '#000') : c.op === 'intersect' ? `<g mask="url(#${prev})">${placed(P[i], '#fff')}</g>` : W + placed(P[i], '#000') + `<g mask="url(#${id}n${i})">${placed(P[i], '#fff')}</g>`;
      defs += M(`${id}r${i}`, `<rect width="100" height="100" fill="#000"/>${body}`);
    }
    return `<defs>${defs}</defs><rect x="0" y="0" width="100" height="100" style="fill:${f}" mask="url(#${id}r${P.length - 1})"/>`;
  }
  const boolIcon = op => `<svg viewBox="0 0 100 100" width="14" height="14" fill="currentColor">${boolSVG({ id: 'ic' + op, op, parts: [{ el: '<rect x="0" y="0" width="100" height="100" rx="12" ry="12"/>', bw: .64, bh: .64 }, { el: '<ellipse cx="50" cy="50" rx="50" ry="50"/>', bx: .36, by: .36, bw: .64, bh: .64 }] }, 'currentColor')}</svg>`;
  function combine(cs, op) {
    cs = cs.filter(vectorish).sort((a, b) => board.cards.indexOf(a) - board.cards.indexOf(b)); if (cs.length < 2) return; remember();
    const X = Math.min(...cs.map(c => c.x)), Y = Math.min(...cs.map(c => c.y)), W = Math.max(...cs.map(c => c.x + c.w)) - X, H = Math.max(...cs.map(c => c.y + c.h)) - Y;
    const parts = cs.map(s => ({ ...sourceMask(s), bx: (s.x - X) / W, by: (s.y - Y) / H, bw: s.w / W, bh: s.h / H, from: JSON.parse(JSON.stringify(s)) }));
    const bottom = cs[0], n = { id: uid(), type: 'shape', shape: 'bool', op, fill: bottom.fill || 'gray', x: X, y: Y, w: W, h: H, r: 0, parts, shadow: bottom.shadow };
    const ids = new Set(cs.map(c => c.id)); board.cards = board.cards.filter(c => !ids.has(c.id)); board.links = board.links.filter(l => !ids.has(l.a) && !ids.has(l.b)); ids.forEach(id => cardsEl.querySelector(`[data-id="${id}"]`)?.remove());
    board.cards.push(n); renderCard(n); renderWires(); layersSoon(); selectOnly([n.id]); $('selbar').dataset.key = ''; placeSelbar(); save();
    chirp(`${BOOL[op]} ✦ Right-click it to separate the shapes again.`, 4500);
  }
  function separate(cs) {
    cs = cs.filter(c => c.type === 'shape' && c.shape === 'bool' && c.parts?.some(p => p.from)); if (!cs.length) return; remember(); const back = [];
    cs.forEach(c => { board.cards = board.cards.filter(x => x.id !== c.id); board.links = board.links.filter(l => l.a !== c.id && l.b !== c.id); cardsEl.querySelector(`[data-id="${c.id}"]`)?.remove();
      c.parts.forEach(p => { if (!p.from || byId(p.from.id)) return; board.cards.push(p.from); back.push(p.from); }); });
    back.forEach(renderCard); renderWires(); layersSoon(); selectOnly(back.map(c => c.id)); $('selbar').dataset.key = ''; placeSelbar(); save();
  }
  Object.assign(window, { __combine: combine, __separate: separate });
  // a menu row with an arrow opens a second little menu beside it
  function openSub(btn, items, done) {
    const key = btn.closest('.row-menu').id + ':' + (btn.dataset.i ?? btn.dataset.m); if ($('rowSub')?.dataset.for === key) return; $('rowSub')?.remove(); btn.closest('.row-menu').querySelectorAll('.sub-open').forEach(b => b.classList.remove('sub-open'));
    const s = document.createElement('div'); s.id = 'rowSub'; s.className = 'row-menu row-sub'; s.dataset.for = key;
    s.innerHTML = items.map((it, i) => it === '-' ? '<span class="rm-sep"></span>' : `<button data-i="${i}">${it.icon ? `<i class="rm-ic">${it.icon}</i>` : ''}${it.label}</button>`).join('');
    document.body.appendChild(s); const b = btn.getBoundingClientRect(), r = s.getBoundingClientRect(); let x = b.right + 4, y = b.top - 5;
    if (x + r.width > innerWidth - 10) x = b.left - r.width - 4; x = Math.max(10, Math.min(x, innerWidth - r.width - 10)); if (y + r.height > innerHeight - 10) y = innerHeight - r.height - 10; y = Math.max(10, y); s.style.left = x + 'px'; s.style.top = y + 'px';
    s.onclick = ev => { const i = ev.target.closest('[data-i]'); if (!i) return; done(); items[+i.dataset.i].run(); }; btn.classList.add('sub-open');
  }
  boardMenu = function (e, items) {
    $('rowMenu')?.remove(); $('rowSub')?.remove(); const m = document.createElement('div'); m.id = 'rowMenu'; m.className = 'row-menu'; m.style.left = e.clientX + 'px'; m.style.top = e.clientY + 'px';
    m.innerHTML = items.map((it, i) => it === '-' ? '<span class="rm-sep"></span>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}${it.sub ? ' has-sub' : ''}">${it.label}</button>`).join('');
    document.body.appendChild(m); const rr = m.getBoundingClientRect(); if (rr.bottom > innerHeight - 10) m.style.top = innerHeight - rr.height - 10 + 'px'; if (rr.right > innerWidth - 10) m.style.left = innerWidth - rr.width - 10 + 'px';
    const close = () => { m.remove(); $('rowSub')?.remove(); removeEventListener('pointerdown', off, true); removeEventListener('keydown', esc, true); };
    const off = ev => { if (!m.contains(ev.target) && !$('rowSub')?.contains(ev.target)) close(); }, esc = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    addEventListener('keydown', esc, true);
    m.onclick = ev => { const b = ev.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; if (it.sub) { openSub(b, it.sub, close); return; } close(); it.run(); };
    m.addEventListener('mouseover', ev => { const b = ev.target.closest('[data-i]'); if (!b) return; const it = items[+b.dataset.i]; if (it.sub) openSub(b, it.sub, close); else { $('rowSub')?.remove(); m.querySelectorAll('.sub-open').forEach(x => x.classList.remove('sub-open')); } });
    setTimeout(() => addEventListener('pointerdown', off, true));
  };

  // ---- the stacking rows live under one Arrange ▸ arrow in every right-click menu ----
  const arrangeSub = () => [{ label: 'Bring to front  ⇧⌘]', run: () => restack('front') }, { label: 'Bring forward  ⌘]', run: () => restack('forward') }, { label: 'Send backward  ⌘[', run: () => restack('backward') }, { label: 'Send to back  ⇧⌘[', run: () => restack('back') }];
  const withMaskGroups = cs => { const out = new Set(cs); cs.forEach(c => { if (c.group && (c.maskLayer || maskLayerOf(c))) groupMembers(c.group).forEach(m => out.add(m)); }); return [...out]; };
  function duplicateCards(cs) { const gm = {}, copies = withMaskGroups(cs).filter(c => c.type !== 'coll').map(c => Object.assign(JSON.parse(JSON.stringify(c)), { id: uid(), r: tilt(), x: c.x + 30, y: c.y + 30 })); copies.forEach(c => { if (c.group) c.group = gm[c.group] || (gm[c.group] = uid()); }); copies.forEach(c => addCard(c)); selectOnly(copies.map(c => c.id)); }

  // ---- mask groups, the Figma way: the mask is a layer at the bottom of a group; everything in the group shows only where the mask is.
  //      Pull a layer out of the group (in Layers) and it's unmasked; drop one in and it's masked. Remove mask turns the mask back into a plain shape. ----
  const maskLayerOf = c => c && c.group ? board.cards.find(x => x.group === c.group && x.maskLayer && x !== c) : null;
  const rotOf = c => WF.includes(c.type) ? (c.rot || 0) : ((c.type === 'stamp' && !c.tilted) || (c.type === 'section' && !c.turned) ? 0 : (c.r || 0));   // the same tilt the card is drawn with
  const liveMask = c => { const m = maskLayerOf(c); if (!m || c.maskLayer) return null; const src = sourceMask(m); if (!src) return null;
    const rc = rotOf(c), rm = rotOf(m), a = -rc * Math.PI / 180, dx = m.x + m.w / 2 - (c.x + c.w / 2), dy = m.y + m.h / 2 - (c.y + c.h / 2);
    return { ...src, bx: (m.x - c.x) / c.w, by: (m.y - c.y) / c.h, bw: m.w / c.w, bh: m.h / c.h, live: { cx: c.w / 2 + dx * Math.cos(a) - dy * Math.sin(a), cy: c.h / 2 + dx * Math.sin(a) + dy * Math.cos(a), mw: m.w, mh: m.h, dr: rm - rc } }; };
  const isMasked = c => !!(c && !c.maskLayer && (c.mask || maskLayerOf(c)));
  const maskSig = (c, m) => [c.w, c.h, m.bx, m.by, m.bw, m.bh, m.src ? 1 : 0, m.live ? m.live.dr : 0]   /* relative only: moving the whole group changes nothing */.map(v => +(+v || 0).toFixed(3)).join(',');
  const groupMembers = g => board.cards.filter(c => c.group === g);
  // the mask sits at the bottom of its group's stack
  function sinkMask(m) { const g = groupMembers(m.group), low = Math.min(...g.filter(c => c !== m).map(c => board.cards.indexOf(c))); const i = board.cards.indexOf(m); if (i > low) { board.cards.splice(i, 1); board.cards.splice(low, 0, m); } }
  function makeMaskGroup(s, ts) {
    ts = ts.filter(c => c !== s && maskable(c)); if (!ts.length) return; remember();
    const g = (ts.find(t => t.group) || {}).group || uid();
    retireMask(g, s);   // one mask per group
    s.group = g; s.maskLayer = true; ts.forEach(t => { t.group = g; delete t.mask; delete t.maskPrev; }); sinkMask(s);
    renderAll(); selectOnly(groupMembers(g).map(c => c.id)); $('selbar').dataset.key = ''; placeSelbar(); layersSoon(); save();
    maskChirp(shapeWord(s));
  }
  function retireMask(g, keep) { board.cards.slice().forEach(c => { if (c.group !== g || !c.maskLayer || c === keep) return; if (c.ln && MASKS[Object.keys(MASKS).find(k => MASKS[k][0] === c.ln)]) { board.cards = board.cards.filter(x => x !== c); board.links = board.links.filter(l => l.a !== c.id && l.b !== c.id); cardsEl.querySelector(`[data-id="${c.id}"]`)?.remove(); } else { delete c.maskLayer; delete c.group; } }); }
  function maskChirp(word) { const first = !localStorage.getItem('mbMaskHint'); if (first) localStorage.setItem('mbMaskHint', '1'); chirp(first ? `Masked ✦ The ${word} is the group’s mask now: find it in Layers, and drag things in or out of the group to mask or unmask them.` : `Masked with the ${word} ✦`, first ? 8000 : 4000); }
  const maskWithShape = (s, t) => makeMaskGroup(s, [t]);
  const maskManyWithShape = (s, ts) => makeMaskGroup(s, ts);
  // a ready-made shape: a real shape is made over the thing and becomes its mask (pull it out of the group and it's an ordinary shape)
  function maskCards(cs, key) {
    cs = cs.filter(maskable); if (!cs.length) return; remember();
    const real = { circle: 'circle', tri: 'tri', star: 'star', heart: 'heart', diamond: 'diamond', pill: 'pill' };
    const made = cs.map(t => { const W = Math.max(1, t.w), H = Math.max(1, t.h), s = { id: uid(), type: 'shape', shape: real[key] || 'rect', fill: 'pink', x: t.x, y: t.y, w: W, h: H, r: 0, ln: MASKS[key][0] };
      if (key === 'rounded') s.radius = Math.round(.2 * Math.min(W, H)); else if (!real[key]) s.mgeo = { el: MASKS[key][1](W, H) };
      board.cards.push(s); const g = t.group || uid(); retireMask(g, s); s.group = g; s.maskLayer = true; t.group = g; delete t.mask; delete t.maskPrev; sinkMask(s); return s; });
    renderAll(); selectOnly(cs.map(c => c.id)); $('selbar').dataset.key = ''; placeSelbar(); layersSoon(); save(); maskChirp(MASKS[key][0].toLowerCase());
  }
  // Remove mask: on a mask (or its whole group) the mask becomes a plain shape and the group stays; on masked members, they leave the group
  function unmask(cs) {
    const old = cs.filter(c => c.mask), live = cs.filter(c => !c.mask && (isMasked(c) || c.maskLayer)); if (!old.length && !live.length) return; remember(); const back = [];
    old.forEach(c => { const p = c.maskPrev, from = c.mask.from; if (p) { Object.assign(c, { x: p.x, y: p.y, w: p.w, h: p.h }); if (p.crop) c.crop = p.crop; else delete c.crop; }
      if (from && !byId(from.id)) { board.cards.push(from); back.push(from); } delete c.mask; delete c.maskPrev; });
    const groups = new Set(live.map(c => c.group)); groups.forEach(g => { const m = board.cards.find(c => c.group === g && c.maskLayer), members = groupMembers(g);
      if (!m || cs.includes(m) || members.every(c => cs.includes(c))) { if (m) delete m.maskLayer; } else live.filter(c => c.group === g).forEach(c => { delete c.group; }); });
    dissolveLonely(); renderAll(); selectOnly([...cs.map(c => c.id), ...back.map(c => c.id)]); $('selbar').dataset.key = ''; placeSelbar(); layersSoon(); save();
  }
  // after anything moves or resizes, members whose mask shifted relative to them are drawn again
  function dissolveLonely() { const n = {}; board.cards.forEach(c => { if (c.group) n[c.group] = (n[c.group] || 0) + 1; }); board.cards.forEach(c => { if (c.group && n[c.group] === 1) { delete c.group; delete c.maskLayer; } }); }
  function applyGsel() { try { board.cards.forEach(c => { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return; const whole = c.group && (c.maskLayer || maskLayerOf(c)) ? groupMembers(c.group).every(x => sel.has(x.id)) : false; el.classList.toggle('gsel', !!whole); }); } catch (e) {} }
  function refreshMaskGroups() { if (!board) return; board.cards.forEach(c => { if (!c.group) return; const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (!el) return; const mk = c.maskLayer ? null : liveMask(c); const sig = mk ? maskSig(c, mk) : ''; if ((el.dataset.mk || '') !== sig || !!mk !== el.classList.contains('masked')) renderCard(c); }); }
  const _save0 = save; save = function () { try { refreshMaskGroups(); } catch (e) {} return _save0.apply(this, arguments); };
  LICON.mask = LI('<g data-l24="1"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/></g>');
  Object.assign(window, { __maskCards: maskCards, __maskWithShape: maskWithShape, __unmask: unmask, __liveMask: liveMask, __save: () => save() });

  // ---- masks made before mask groups existed (the shape was folded into the picture) become mask groups when the board opens ----
  function migrateMasks() {
    if (!board) return; let did = false;
    board.cards.slice().forEach(c => {
      if (!c.mask || c.maskLayer) return; const m = c.mask, p = c.maskPrev; let s = null;
      if (m.from) { if (p) { Object.assign(c, { x: p.x, y: p.y, w: p.w, h: p.h }); if (p.crop) c.crop = p.crop; else delete c.crop; } if (!byId(m.from.id)) { board.cards.push(m.from); s = m.from; } else s = byId(m.from.id); }
      else if (MASKS[m.shape]) { const real = { circle: 'circle', tri: 'tri', star: 'star', heart: 'heart', diamond: 'diamond', pill: 'pill' }, W = Math.max(1, c.w), H = Math.max(1, c.h);
        s = { id: uid(), type: 'shape', shape: real[m.shape] || 'rect', fill: 'pink', x: c.x, y: c.y, w: W, h: H, r: 0, ln: MASKS[m.shape][0] }; if (m.shape === 'rounded') s.radius = Math.round(.2 * Math.min(W, H)); else if (!real[m.shape]) s.mgeo = { el: MASKS[m.shape][1](W, H) }; board.cards.push(s); }
      if (!s) return; const g = c.group || uid(); s.group = g; s.maskLayer = true; delete s.mask; c.group = g; delete c.mask; delete c.maskPrev; sinkMask(s); did = true;
    });
    if (did) layersSoon();
  }
  const _renderAll0 = renderAll; renderAll = function () { try { migrateMasks(); } catch (e) {} const r = _renderAll0.apply(this, arguments); applyGsel(); return r; };
  // when a whole mask group is selected, the mask's box is the group's box (like Figma); members show their own box only when picked on their own
  const _selectOnly0 = selectOnly; selectOnly = function (ids) { const r = _selectOnly0.apply(this, arguments); applyGsel(); return r; };
  window.__autoLink = autoLink;

  // ---- the flowchart library (web/flowtpl.js): whole flows in the flowchart shapes, each with its why. Listed under the shapes in the Flowchart tab. ----
  const FT = window.FLOW_TPL || [], FT_COLW = 300, FT_ROWH = 170, FT_LANEH = 190, ftBy = key => FT.find(t => t.key === key);
  const FT_KIND = { start: ['Start / end', {}], end: ['Start / end', { fill: 'peach' }], step: ['Process', {}], q: ['Decision', {}], io: ['Input / output', {}], doc: ['Document', {}], db: ['Database', {}] };
  function buildFlowTpl(T, at) {
    const cards = [], links = [], byId = {}, cols = Math.max(...T.nodes.map(n => n[3])) + 1, lanesOn = !!T.lanes;
    const ox = at.x + (lanesOn ? 60 : 0) + 90, oy = at.y + (lanesOn ? FT_LANEH / 2 : 70);
    if (lanesOn) cards.push(...lanes({ x: at.x, y: at.y }, T.lanes, cols * FT_COLW + 120, FT_LANEH));
    T.nodes.forEach(([id, kind, text, col, row]) => { const [name, extra] = FT_KIND[kind] || FT_KIND.step; const c = kitCard('flow', { ...FLOW[name], ...extra, text }, { x: ox + col * FT_COLW, y: oy + row * (lanesOn ? FT_LANEH + 10 : FT_ROWH) }); byId[id] = c; cards.push(c); });
    T.links.forEach(([a, b, label, sa, sb]) => { const A = byId[a], B = byId[b]; if (!A || !B) return;
      if (!sa) { const dx = (B.x + B.w / 2) - (A.x + A.w / 2), dy = (B.y + B.h / 2) - (A.y + A.h / 2); if (Math.abs(dx) > Math.abs(dy)) { sa = dx > 0 ? 'r' : 'l'; sb = OPP[sa]; } else { sa = dy > 0 ? 'b' : 't'; sb = OPP[sa]; } }
      links.push(kitLink(A, B, SIDE[sa], SIDE[sb || OPP[sa]], label ? { label } : {})); });
    return { cards, links };
  }
  function placeFlowTpl(key, quiet) {
    const T = ftBy(key); if (!T) return null; remember(); if (placing) stopPlacing();
    const cols = Math.max(...T.nodes.map(n => n[3])) + 1, rows = T.lanes ? T.lanes.length : Math.max(...T.nodes.map(n => n[4])) + 1;
    const at = freeSpot(360 + cols * FT_COLW + (T.lanes ? 120 : 0), 120 + rows * (T.lanes ? FT_LANEH + 10 : FT_ROWH)), made = [];
    whyNotes(T.why, at.x, at.y, made);
    const title = card('title', { x: at.x, y: at.y - 70, w: 700, h: 50, text: T.name }); board.cards.push(title); renderCard(title, true); made.push(title);
    const { cards, links } = buildFlowTpl(T, { x: at.x + 360, y: at.y });
    cards.forEach(c => { board.cards.push(c); renderCard(c, true); made.push(c); }); board.links.push(...links);
    layoutAll(); renderWires(); layersSoon(); save(); selectOnly([]); fit(made);
    if (!quiet) chirp(`${T.name} is on the board: ${T.nodes.length} steps and the why. Every piece is editable ✦`, 5000);
    return made;
  }
  const FT_CATS = [...new Set(FT.map(t => t.cat))];
  function renderFlowTpl() {
    const grid = $('kit-flow')?.querySelector('.kit-grid'); if (!grid || !FT.length || grid.querySelector('[data-ftpl-open]')) return;
    const b = document.createElement('button'); b.dataset.ftplOpen = '1'; b.title = 'Whole flowcharts from the library'; b.innerHTML = `<svg class="kp-ic" viewBox="0 0 20 20"><rect x="2.5" y="3" width="6" height="4" rx="1.3"/><rect x="11.5" y="3" width="6" height="4" rx="1.3"/><rect x="7" y="13" width="6" height="4" rx="1.3"/><path d="M5.5 7v2.5h9V7M10 9.5V13" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><span>Templates</span>`;
    grid.prepend(b); b.onclick = e => { e.stopPropagation(); pickWF(null); if (placing) stopPlacing(); openFlowTpl(); };
  }
  // ---- the Templates window: categories on the left, the list in the middle, a drawn preview + the why on the right, Add to the board ----
  const FTM = { cat: null, pick: null };
  const FT_FILL = { start: '#a8e6c3', end: '#ffc8a6', step: '#aed3ff', q: '#f8e08a', io: '#ffb8d2', doc: '#cdb8ff', db: '#ffc8a6' };
  function ftPreview(T) {
    const lanesOn = !!T.lanes, CW = 300, RH = lanesOn ? 200 : 170, cols = Math.max(...T.nodes.map(n => n[3])) + 1, rows = lanesOn ? T.lanes.length : Math.max(...T.nodes.map(n => n[4])) + 1;
    const W = cols * CW + (lanesOn ? 180 : 40), H = rows * RH + 40, size = { start: [160, 64], end: [160, 64], step: [170, 90], q: [160, 120], io: [180, 84], doc: [160, 104], db: [140, 116] };
    const cx = c => (lanesOn ? 150 : 20) + 85 + c * CW, cy = r => 20 + RH / 2 + r * RH, P = {};
    let g = '';
    if (lanesOn) T.lanes.forEach((n, i) => { g += `<rect x="8" y="${20 + i * RH + 4}" width="${W - 16}" height="${RH - 8}" rx="18" fill="${['#eaf3ff', '#f1eaff', '#e8f8ef'][i % 3]}"/><text x="26" y="${20 + i * RH + 34}" font-size="22" font-weight="700" fill="#6b6370">${esc(n)}</text>`; });
    T.nodes.forEach(([id, kind, text, col, row]) => { const [w, h] = size[kind] || size.step, x = cx(col), y = cy(row); P[id] = { x, y, w, h }; const f = FT_FILL[kind] || FT_FILL.step;
      const shape = kind === 'q' ? `<path d="M${x} ${y - h / 2}L${x + w / 2} ${y}L${x} ${y + h / 2}L${x - w / 2} ${y}Z" fill="${f}"/>` : kind === 'io' ? `<path d="M${x - w / 2 + 18} ${y - h / 2}H${x + w / 2}L${x + w / 2 - 18} ${y + h / 2}H${x - w / 2}Z" fill="${f}"/>` : kind === 'db' ? `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="40" fill="${f}"/>` : kind === 'doc' ? `<path d="M${x - w / 2} ${y - h / 2}H${x + w / 2}V${y + h / 2 - 16}C${x + w / 4} ${y + h / 2 - 28} ${x} ${y + h / 2 + 6} ${x - w / 2} ${y + h / 2 - 6}Z" fill="${f}"/>` : `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${kind === 'start' || kind === 'end' ? 32 : 12}" fill="${f}"/>`;
      const words = text.split(' '), lines = []; let cur = ''; words.forEach(wd => { if ((cur + ' ' + wd).trim().length > (kind === 'q' ? 12 : 16)) { lines.push(cur.trim()); cur = wd; } else cur += ' ' + wd; }); lines.push(cur.trim());
      const tx = lines.slice(0, 3).map((l, i) => `<tspan x="${x}" dy="${i ? 19 : -(Math.min(lines.length, 3) - 1) * 9.5}">${esc(l)}</tspan>`).join('');
      g += shape + `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="16" font-weight="600" fill="#2b2630">${tx}</text>`; });
    const side = (n, s) => s === 'r' ? [n.x + n.w / 2, n.y] : s === 'l' ? [n.x - n.w / 2, n.y] : s === 't' ? [n.x, n.y - n.h / 2] : [n.x, n.y + n.h / 2];
    T.links.forEach(([a, b, label, sa, sb]) => { const A = P[a], B = P[b]; if (!A || !B) return;
      if (!sa) { const dx = B.x - A.x, dy = B.y - A.y; if (Math.abs(dx) > Math.abs(dy)) { sa = dx > 0 ? 'r' : 'l'; sb = dx > 0 ? 'l' : 'r'; } else { sa = dy > 0 ? 'b' : 't'; sb = dy > 0 ? 't' : 'b'; } } sb = sb || { r: 'l', l: 'r', t: 'b', b: 't' }[sa];
      const [x1, y1] = side(A, sa), [x2, y2] = side(B, sb), mid = (sa === 'l' || sa === 'r') ? `L${(x1 + x2) / 2} ${y1}L${(x1 + x2) / 2} ${y2}` : `L${x1} ${(y1 + y2) / 2}L${x2} ${(y1 + y2) / 2}`;
      g += `<path d="M${x1} ${y1}${mid}L${x2} ${y2}" fill="none" stroke="#8c8494" stroke-width="2.2" marker-end="url(#ftarrow)"/>`;
      if (label) { const lx = (sa === 'l' || sa === 'r') ? (x1 + x2) / 2 : x1, ly = (sa === 'l' || sa === 'r') ? y1 : (y1 + y2) / 2; g += `<rect x="${lx - 20}" y="${ly - 11}" width="40" height="22" rx="8" fill="#fdf7fa"/><text x="${lx}" y="${ly + 5}" text-anchor="middle" font-size="13" font-weight="600" fill="#6b6370">${esc(label)}</text>`; } });
    return `<svg class="ft-prev${lanesOn ? ' wide' : ''}" viewBox="0 0 ${W} ${H}" font-family="var(--font)"${lanesOn ? ` style="min-width:${Math.round(W * .62)}px"` : ''}><defs><marker id="ftarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8c8494"/></marker></defs>${g}</svg>`;
  }
  function openFlowTpl(pick) { if (!$('ftModal')) buildFlowTplModal(); FTM.cat = FTM.cat || FT_CATS[0]; if (pick) { FTM.pick = pick; FTM.cat = ftBy(pick).cat; } $('ftModal').classList.add('on'); renderFlowTplModal(); setTimeout(() => ($('ftList').querySelector('.lib-item.on') || $('ftList').querySelector('.lib-item') || $('ftClose'))?.focus(), 50); }
  const closeFlowTpl = () => $('ftModal')?.classList.remove('on');
  function buildFlowTplModal() {
    const m = document.createElement('div'); m.className = 'settings library ft-modal'; m.id = 'ftModal';
    m.innerHTML = `<div class="set-panel lib-panel"><div class="set-head"><h2>Flowchart templates</h2><button class="dv-btn" id="ftClose" title="Close">×</button></div><div class="lib-body"><nav class="lib-nav" id="ftNav"></nav><div class="lib-list" id="ftList"></div><div class="lib-detail" id="ftDetail"></div></div></div>`;
    document.body.appendChild(m); $('ftClose').onclick = closeFlowTpl; m.addEventListener('click', e => { if (e.target === m) closeFlowTpl(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.classList.contains('on')) { e.stopPropagation(); closeFlowTpl(); } }, true);
    m.addEventListener('click', e => { const n = e.target.closest('[data-ftcat]'); if (n) { FTM.cat = n.dataset.ftcat; renderFlowTplModal(); return; }
      const i = e.target.closest('[data-ftkey]'); if (i) { FTM.pick = i.dataset.ftkey; renderFlowTplModal(); return; }
      const add = e.target.closest('[data-ftadd]'); if (add) { closeFlowTpl(); placeFlowTpl(add.dataset.ftadd); } });
  }
  function renderFlowTplModal() {
    $('ftNav').innerHTML = FT_CATS.map(c => `<button data-ftcat="${esc(c)}" class="lib-part ${FTM.cat === c ? 'on' : ''}">${esc(c)} <small>${FT.filter(t => t.cat === c).length}</small></button>`).join('');
    const list = FT.filter(t => t.cat === FTM.cat);
    $('ftList').innerHTML = `<div class="lib-h">${esc(FTM.cat)}</div>` + list.map(t => `<button class="lib-item ${FTM.pick === t.key ? 'on' : ''}" data-ftkey="${t.key}"><b>${esc(t.name)}</b><span>${esc(t.line)}</span><small class="ft-meta">${t.lanes ? 'swimlanes · ' : ''}${t.nodes.length} steps</small></button>`).join('');
    const T = FTM.pick && ftBy(FTM.pick), D = $('ftDetail');
    D.innerHTML = T ? `<div class="lib-kicker">${esc(T.cat)}${T.lanes ? ' · swimlanes: ' + esc(T.lanes.join(', ')) : ''}</div><h3>${esc(T.name)}</h3><p class="lib-why">${esc(T.line)}</p><div class="ft-prevbox${T.lanes ? ' scroll' : ''}">${ftPreview(T)}</div>${T.lanes ? '<small class="ft-scroll">Scroll sideways to see the whole thing →</small>' : ''}<ul class="ft-why">${T.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul><div class="lib-acts"><button class="solid" data-ftadd="${T.key}">Add to the board</button></div>`
      : `<div class="lib-empty"><p>Pick a template to see it drawn out, with the thinking behind it.</p></div>`;
  }
  const _renderKits0 = renderKits; renderKits = function () { const r = _renderKits0.apply(this, arguments); renderFlowTpl(); return r; }; renderFlowTpl();
  window.__ftpl = { place: placeFlowTpl, n: () => FT.length, keys: () => FT.map(t => t.key), open: openFlowTpl };
  // Mochi offline: "make a flowchart for checkout" / "draw the bug triage process" places one from the flowchart library (plain "login flow" still means the wireframes)
  const FT_ASKS = [[/\blog ?in|sign ?in\b/i, 'login'], [/sign ?up|regist|create (an )?account/i, 'signup'], [/forgot|reset (my )?password|password reset/i, 'forgot'], [/onboard/i, 'onboarding'], [/checkout|purchase|buy/i, 'checkout'], [/search|filter/i, 'search'],
    [/cancel|delete (my |an )?account|churn/i, 'cancel'], [/approv/i, 'approval'], [/\bbug|triage/i, 'triage'], [/support|escalat|ticket|help ?desk/i, 'support'], [/publish|content|blog|editorial/i, 'publish'], [/hir(e|ing)|recruit|candidate|interview/i, 'hiring'], [/incident|outage|on-?call|postmortem/i, 'incident'], [/feature request|request/i, 'feature']];
  function flowTplAsk(s) {
    if (!FT.length) return false;
    if (/\b(what|why|explain|mean|define)\b/i.test(s) && !/\b(make|build|create|draw|put|place|add)\b/i.test(s)) return false;
    if (!/\b(make|build|create|draw|put|place|add|give|show|map|chart|diagram)\b/i.test(s) && s.trim().split(/\s+/).length > 5) return false;
    const hit = FT_ASKS.find(([re]) => re.test(s)); if (!hit) return false; const T = ftBy(hit[1]); if (!T) return false;
    if (!/\bflow ?charts?\b|\bdiagram\b|\bprocess\b|\bworkflow\b|\bswim ?lanes?\b/i.test(s) && (s.trim().split(/\s+/).length > 5 || FLOW_ASKS.some(([re]) => re.test(s)))) return false;   // "checkout" alone means the wireframes; "bug triage" alone has no wireframe twin, so it's the flowchart
    placeFlowTpl(hit[1], true);
    say(`Here’s ${T.name} from the flowchart library: ${T.nodes.length} steps${T.lanes ? ' in swimlanes' : ''}, with the why beside it. Change anything; it’s yours now ✦`, 0, [{ label: 'Undo', ghost: true, run: () => undo() }]);
    return true;
  }
  window.__ftpl.ask = flowTplAsk;

  // ---- Export as image, the Figma way: only what's selected is drawn (no other cards, no arrows to elsewhere, no cursor, no dots), at tight bounds, on a transparent background ----
  exportCards = async function (cs, name, pdf) {
    if (!cs.length) return say('Nothing to export yet ✦', 2500);
    if (MB.web) return say('Saving images and PDFs works in the Mac app ✦', 0, DL);
    const all = new Set(cs); cs.forEach(c => { if (c.type === 'coll') (c.kids || []).forEach(k => byId(k) && all.add(byId(k))); if (c.type === 'frame') onFrame(c).forEach(k => all.add(k));
      if (c.type === 'section') board.cards.forEach(k => { if (k !== c && k.x >= c.x - 1 && k.y >= c.y - 1 && k.x + k.w <= c.x + c.w + 1 && k.y + k.h <= c.y + c.h + 1) all.add(k); }); });
    // a mask group travels together: the mask layer is needed to draw the members
    [...all].forEach(c => { if (c.group) board.cards.forEach(k => { if (k.group === c.group && k.maskLayer) all.add(k); }); });
    const list = [...all], ids = new Set(list.map(c => c.id));
    // tight bounds: each card's box turned by its tilt, plus room for its shadow
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(c => { if (c.maskLayer) return; const a = rotOf(c) * Math.PI / 180, cx = c.x + c.w / 2, cy = c.y + c.h / 2, hw = c.w / 2, hh = c.h / 2, ex = Math.abs(hw * Math.cos(a)) + Math.abs(hh * Math.sin(a)), ey = Math.abs(hw * Math.sin(a)) + Math.abs(hh * Math.cos(a));
      const s = shadowOf(c), sh = s ? (typeof s === 'string' ? SHADOW_PRESETS[s] : s) : null, pad = sh ? (sh.blur || 0) + (sh.spread || 0) : 0, sx = sh ? sh.x || 0 : 0, sy = sh ? sh.y || 0 : 0;
      x0 = Math.min(x0, cx - ex - Math.max(0, pad - sx)); y0 = Math.min(y0, cy - ey - Math.max(0, pad - sy)); x1 = Math.max(x1, cx + ex + Math.max(0, pad + sx)); y1 = Math.max(y1, cy + ey + Math.max(0, pad + sy)); });
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const keep = { ...view }, keepSel = [...sel], keepLinks = board.links, r = stage.getBoundingClientRect(), bw = x1 - x0, bh = y1 - y0;
    selectOnly([]); selWire = null; selWires.clear(); endEdit(); if (framing) endFrame();
    board.links = keepLinks.filter(l => ids.has(l.a) && ids.has(l.b)); renderWires();
    board.cards.forEach(c => cardsEl.querySelector(`[data-id="${c.id}"]`)?.classList.toggle('exp-off', !ids.has(c.id)));
    document.body.classList.add('exporting');
    const z = Math.min((r.width - 60) / bw, (r.height - 60) / bh, 2); view = { x: (r.width - bw * z) / 2 - x0 * z, y: (r.height - bh * z) / 2 - y0 * z, z }; applyView();
    await nextFrame(); await new Promise(res => setTimeout(res, 150));
    try {
      const saved = await MB.exportRect({ x: r.left + (r.width - bw * z) / 2, y: r.top + (r.height - bh * z) / 2, w: bw * z, h: bh * z, name, pdf, scale: Math.min(4, 2 / Math.min(z, 1)), alpha: !pdf });
      if (saved) chirp(`Saved “${saved}” ✦`, 3500);
    } catch (e) { say(e.message, 4000); }
    finally { document.body.classList.remove('exporting', 'exp-black'); cardsEl.querySelectorAll('.exp-off').forEach(el => el.classList.remove('exp-off')); board.links = keepLinks; renderWires(); view = keep; applyView(); selectOnly(keepSel); }
  };
  // new pictures start square when the Pictures setting says so (every way a picture is made goes through card())
  const _card0 = card; card = function (type, o) { const c = _card0.apply(this, arguments); if (type === 'image' && settings.imgRadius === false && c.radius == null) c.radius = 0; return c; };

  // ---- arrow keys nudge whatever is selected: 1px, or 10px with Shift ----
  let nudgeMark = 0;
  addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d || !sel.size || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = document.activeElement; if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
    if (document.querySelector('.settings.on, #onboard.on, #library.on, #ftModal.on, #wfModal.on') || framing || vec || penT) return;
    const cs = selCards().filter(c => !c.locked); if (!cs.length) return; e.preventDefault();
    const step = e.shiftKey ? 10 : 1, now = Date.now(); if (now - nudgeMark > 800) remember(); nudgeMark = now;
    cs.forEach(c => { c.x += d[0] * step; c.y += d[1] * step; const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) { el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; } });
    renderWires(); placeSelbar(); clearTimeout(nudgeMark.t); nudgeMark.t = setTimeout(save, 250);
  });

  // ---- a line's own right-click menu: label, ends, colour, delete ----
  stage.addEventListener('contextmenu', e => {
    const w = e.target.closest('[data-wire]') || document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-wire]'); if (!w || placing || penT) return; const l = linkById(w.dataset.wire); if (!l) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (!selWires.has(l.id)) selectWire(l.id);
    const ls = () => [...selWires].map(linkById).filter(Boolean), swatch = c => `<i style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c || '#8c8494'};box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)"></i>`;
    const endItems = which => ENDS.map(kind => ({ label: END_N[kind] || kind, run: () => { remember(); ls().forEach(x => { if (which === 'head') { delete x.arrow; if (kind === 'none') delete x.head; else x.head = kind; } else { if (kind === 'none') delete x.tail; else x.tail = kind; } }); renderWires(); save(); } }));
    boardMenu(e, [
      ...(selWires.size === 1 ? [{ label: 'Label', run: () => editWireLabel(l) }] : []),
      { label: 'Arrow at the end', sub: endItems('head') }, { label: 'Arrow at the start', sub: endItems('tail') },
      { label: 'Color', sub: WCOLORS.map(c => ({ label: c ? c.toUpperCase() : 'Default', icon: swatch(c), run: () => { remember(); ls().forEach(x => { if (c) x.color = c; else delete x.color; }); renderWires(); save(); } })) },
      { label: l.route === 'elbow' ? 'Make it a curve' : 'Make it an elbow', run: () => { remember(); ls().forEach(x => { if (x.route === 'elbow') delete x.route; else x.route = 'elbow'; }); renderWires(); save(); } }, '-',
      { label: selWires.size > 1 ? `Delete ${selWires.size} lines` : 'Delete', danger: true, run: () => { remember(); const ids = new Set(selWires); board.links = board.links.filter(x => !ids.has(x.id)); selectWire(null); renderWires(); save(); } }]);
  }, true);

  // ---- the new Mochis together in one stamps tab; the ones that move say so ----
  const _renderPick0 = renderPick; renderPick = function (tab = 'mochi') { if (!STAMPS.fresh) STAMPS.fresh = [...STAMPS.mochi.filter(st => /^(Double|Wings|Devil)/.test(st.n)), ...STAMPS.moving.filter(st => /^Fly/.test(st.n))]; const r = _renderPick0.apply(this, arguments); if (tab === 'fresh') $('spGrid')?.querySelectorAll('[data-p]').forEach(b => { const [t, i] = b.dataset.p.split(':'), st = STAMPS[t]?.[+i]; if (st && (st.mv || /\.gif$/i.test(st.src || '')) && !b.querySelector('.sp-moves')) b.insertAdjacentHTML('beforeend', '<i class="sp-moves">moves</i>'); }); return r; };
  Object.assign(window, { __placeholderOnto: placeholderOnto, __phScene: phScene });
  Object.assign(window, { __maskMenu: cs => maskMenuItems(cs).map(i => i.label), __dupCards: duplicateCards });
  const _removeCards0 = removeCards; removeCards = function (cs) { const r = _removeCards0.apply(this, arguments); try { dissolveLonely(); renderAll(); } catch (e) {} return r; };
  const _removeSelected0 = removeSelected; removeSelected = function () { if (sel.size) remember(); const r = _removeSelected0.apply(this, arguments); try { if (board.cards.some(c => c.group)) { const before = JSON.stringify(board.cards.map(c => c.group || '')); dissolveLonely(); if (JSON.stringify(board.cards.map(c => c.group || '')) !== before) renderAll(); } } catch (e) {} return r; };
  // icons: search all of Material Icons, then click to place (or swap the selected icon)
  let iconSwap = null;
  function renderIcons() {
    const q = $('iconSearch').value.trim().toLowerCase().replace(/\s+/g, '_'), all = window.MATERIAL_ICONS || [], hits = q ? all.filter(n => n.includes(q)) : all, shown = hits.slice(0, 180);
    $('iconGrid').innerHTML = shown.map(n => `<button data-icon="${n}" title="${n.replace(/_/g, ' ')}"><span class="mi">${n}</span></button>`).join('') + (hits.length > shown.length ? `<div class="more">${hits.length - shown.length} more… keep typing to narrow it down</div>` : hits.length ? '' : '<div class="more">No icons match that</div>');
  }
  $('iconSearch').oninput = renderIcons;
  $('iconSearch').onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') { pickWF(null); stopPlacing(); } };
  $('iconGrid').onclick = e => { const b = e.target.closest('[data-icon]'); if (!b) return; $('iconGrid').querySelectorAll('.on').forEach(x => x.classList.remove('on')); b.classList.add('on');
    if (iconSwap && byId(iconSwap)) { const c = byId(iconSwap); c.name = b.dataset.icon; renderCard(c); selectOnly([c.id]); save(); iconSwap = null; pickWF(null); return; }
    startPlacing('icon', { name: b.dataset.icon }); };

  // the design panel: tools when nothing's picked, the selection's settings when something is
  let wfTool = null;
  function pickWF(t) {
    document.querySelectorAll('[data-wf]').forEach(b => b.classList.toggle('on', b.dataset.wf === t));
    $('dzPresets').classList.toggle('on', t === 'frame');
    $('dzIcons').classList.toggle('on', t === 'icon'); if (t === 'icon') { renderIcons(); setTimeout(() => $('iconSearch').focus(), 20); return; }
    if (t !== 'icon') iconSwap = null; if (t) $('dzPieces').querySelectorAll('.on').forEach(x => x.classList.remove('on'));
    if (t === 'frame') { $('dzPresets').innerHTML = Object.keys(DEVICES).map(n => `<button data-dev="${n}">${n}</button>`).join(''); return; }
    if (t) startPlacing(t);
  }
  document.querySelectorAll('[data-wf]').forEach(b => b.onclick = () => { const t = b.dataset.wf; if (b.classList.contains('on')) { stopPlacing(); pickWF(null); return; } pickWF(t); });
  $('dzPresets').onclick = e => { const b = e.target.closest('[data-dev]'); if (!b) return; $('dzPresets').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); startPlacing('frame', { device: b.dataset.dev }); };
  $('dzMin').onclick = () => { const m = $('design').classList.toggle('min'); $('dzMin').textContent = m ? '+' : '–'; placeTray(); };
  $('design').addEventListener('pointerdown', e => e.stopPropagation());
  // Unsorted sits under the Wireframe panel and always fits on screen; its list scrolls when it's long
  function placeTray() { if ($('tray').parentElement?.classList.contains('side')) { $('tray').style.top = $('tray').style.maxHeight = ''; return; }   // in a sidebar column: it just stacks
  }
  addEventListener('resize', placeTray);
  new ResizeObserver(placeTray).observe($('design'));
  const AL = d => `<svg viewBox="0 0 20 20">${d}</svg>`;
  const ALIGN = { l: AL('<path d="M4 3v14M7 6h9M7 13h5"/>'), c: AL('<path d="M10 3v14M5 6h10M7 13h6"/>'), r: AL('<path d="M16 3v14M4 6h9M8 13h5"/>'),
    t: AL('<path d="M3 4h14M6 7v9M13 7v5"/>'), m: AL('<path d="M3 10h14M6 5v10M13 7v6"/>'), b: AL('<path d="M3 16h14M6 4v9M13 8v5"/>'),
    dh: AL('<path d="M3 4v12M17 4v12M8 7v6M12 7v6"/>'), dv: AL('<path d="M4 3h12M4 17h12M7 8h6M7 12h6"/>') };
  const field = (k, label, v, type = 'number', extra = '') => `<label class="dz-f ${extra}"><span>${label}</span><input data-k="${k}" type="${type}" value="${esc(v)}"${type === 'number' ? ' step="1"' : ''}></label>`;
  function renderDesign() {
    const fc = selCards().length === 1 && selCards()[0].type === 'font' ? selCards()[0] : null;
    if (fc) { $('dzProps').innerHTML = `<div class="dz-sec"><div class="label">Font</div><div class="dz-grid"><label class="dz-f wide"><span>Font</span><select data-k="font">${[...new Set([fc.font || 'DM Sans', ...FONTS])].map(f => `<option${fc.font === f ? ' selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select></label><label class="dz-f wide"><span>Or any Google font</span><input data-k="gfont" placeholder="e.g. Playfair Display" spellcheck="false"></label></div><div class="dz-hint">Double-click the sample line on the card to try your own words.</div></div>`; return; }
    const cs = selCards().filter(c => WF.includes(c.type)), el = $('dzProps');
    if (!cs.length) { el.innerHTML = selCards().length ? '' : '<div class="dz-hint">Pick a tool or a piece. Drag to draw a box; things snap into line as you move them.</div>'; return; }
    const one = cs.length === 1 ? cs[0] : null; let h = '';
    if (one) h += `<div class="dz-sec"><div class="label">${{ frame: 'Screen', box: 'Box', text: 'Text', font: 'Font' }[one.type]}</div><div class="dz-grid">${field('x', 'X', Math.round(one.x))}${field('y', 'Y', Math.round(one.y))}${field('w', 'W', Math.round(one.w))}${one.type === 'text' ? '' : field('h', 'H', Math.round(one.h))}</div></div>`;
    if (one && one.type !== 'frame') h += `<div class="dz-sec"><div class="dz-grid">${field('rot', 'Rotate°', one.rot || 0, 'number', 'wide')}</div></div>`;
    if (one?.type === 'icon') h += `<div class="dz-sec"><div class="label">Icon</div><div class="dz-grid">${field('isz', 'Size', Math.round(one.w))}${field('color', 'Color', one.color || '#27272a', 'color')}</div><div class="dz-row"><button data-swap="1" style="font:600 11.5px/1 var(--font);gap:6px;display:flex;align-items:center;justify-content:center"><span class="mi" style="font-size:16px">${esc(one.name)}</span> Change icon</button></div></div>`;
    const groupedSel = cs.length > 1 && cs.every(c => c.group && c.group === cs[0].group);
    if (cs.length > 1) h += `<div class="dz-sec"><div class="dz-row"><button data-grp="${groupedSel ? 'off' : 'on'}" style="font:600 11.5px/1 var(--font)">${groupedSel ? 'Ungroup  ⇧⌘G' : 'Group  ⌘G'}</button></div></div>`;
    if (one?.type === 'frame') h += `<div class="dz-sec"><div class="dz-grid">${field('name', 'Name', one.name || 'Screen', 'text', 'wide')}<label class="dz-f wide"><span>Device</span><select data-k="device">${['Custom', ...Object.keys(DEVICES)].map(n => `<option${(one.device || 'Custom') === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${field('fill', 'Fill', one.fill || '#ffffff', 'color')}${field('radius', 'Corners', one.radius ?? 0)}</div></div>`;
    if (one?.type === 'box') h += `<div class="dz-sec"><div class="label">Look</div><div class="dz-grid">${field('fill', 'Fill', one.fill || '#e4e4e7', 'color')}${field('radius', 'Corners', one.radius || 0)}${field('stroke', 'Border', one.stroke || '#a1a1aa', 'color')}${field('sw', 'Width', one.sw || 0)}${field('opacity', 'Opacity %', Math.round((one.opacity ?? 1) * 100), 'number', 'wide')}</div></div>`;
    if (one?.type === 'text') h += `<div class="dz-sec"><div class="label">Type</div><div class="dz-grid"><label class="dz-f wide"><span>Font</span><select data-k="font">${[...new Set([one.font || 'DM Sans', ...FONTS])].map(f => `<option${(one.font || 'DM Sans') === f ? ' selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select></label>
      ${field('size', 'Size', one.size || 18)}<label class="dz-f"><span>Weight</span><select data-k="weight">${[[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semi'], [700, 'Bold'], [800, 'Extra']].map(([v, n]) => `<option value="${v}"${(+one.weight || 500) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      ${field('color', 'Color', one.color || '#27272a', 'color')}${field('lh', 'Line', one.lh || 1.3)}</div><div class="dz-row">${['left', 'center', 'right'].map(a => `<button data-talign="${a}" class="${(one.align || 'left') === a ? 'on' : ''}" title="Align ${a}">${ALIGN[a[0]]}</button>`).join('')}</div></div>`;
    const inFrame = one && one.onFrame && byId(one.onFrame);
    if (cs.length > 1 || inFrame) h += `<div class="dz-sec"><div class="label">${cs.length > 1 ? 'Align' : 'Align on its screen'}</div><div class="dz-row">${['l', 'c', 'r', 't', 'm', 'b'].map(a => `<button data-align="${a}" title="Align">${ALIGN[a]}</button>`).join('')}</div>${cs.length > 2 ? `<div class="dz-row"><button data-dist="h" title="Even spacing across">${ALIGN.dh}</button><button data-dist="v" title="Even spacing down">${ALIGN.dv}</button></div>` : ''}</div>`;
    el.innerHTML = h;
  }
  $('dzProps').addEventListener('input', e => {
    const fc = selCards().length === 1 && selCards()[0].type === 'font' ? selCards()[0] : null;
    if (fc && (e.target.dataset.k === 'font' || e.target.dataset.k === 'gfont')) { const v = e.target.value.trim(); if (!v) return; if (e.target.dataset.k === 'gfont') { clearTimeout(fc._t); fc._t = setTimeout(() => { fc.font = v; renderCard(fc); selectOnly([fc.id]); save(); }, 500); return; } fc.font = v; renderCard(fc); selectOnly([fc.id]); save(); return; }
    const k = e.target.dataset.k, one = selCards().filter(c => WF.includes(c.type))[0]; if (!k || !one) return; let v = e.target.value;
    if (['x', 'y', 'w', 'h', 'radius', 'sw', 'size', 'rot', 'isz'].includes(k)) v = +v || 0; if (k === 'opacity') v = Math.max(0, Math.min(100, +v)) / 100; if (k === 'lh') v = +v || 1.3; if (k === 'weight') v = +v;
    if (k === 'rot') { one.rot = v; } else if (k === 'isz') { one.w = one.h = Math.max(8, v); }
    else if (k === 'device') { if (DEVICES[v]) { one.w = DEVICES[v][0]; one.h = DEVICES[v][1]; one.radius = DEVICES[v][2]; } one.device = v; }
    else one[k] = v;
    if (k === 'w' || k === 'h') one.device = 'Custom';
    renderCard(one); selectOnly([one.id]); renderWires(); save();
    if (k === 'device') $('selbar').dataset.key = '', renderDesign();
  });
  $('dzProps').addEventListener('click', e => {
    if (e.target.closest('[data-swap]')) { iconSwap = selCards()[0]?.id; pickWF('icon'); return; }
    const gp = e.target.closest('[data-grp]'); if (gp) return groupSel(gp.dataset.grp === 'on');
    const cs = selCards().filter(c => WF.includes(c.type)), ta = e.target.closest('[data-talign]'), al = e.target.closest('[data-align]'), di = e.target.closest('[data-dist]');
    if (ta) { cs.forEach(c => c.align = ta.dataset.talign); }
    if (al) { // line them up with each other, or a single thing with its screen
      const ref = cs.length === 1 ? byId(cs[0].onFrame) : null, x0 = ref ? ref.x : Math.min(...cs.map(c => c.x)), y0 = ref ? ref.y : Math.min(...cs.map(c => c.y)), x1 = ref ? ref.x + ref.w : Math.max(...cs.map(c => c.x + c.w)), y1 = ref ? ref.y + ref.h : Math.max(...cs.map(c => c.y + c.h));
      cs.forEach(c => { const a = al.dataset.align; if (a === 'l') c.x = x0; if (a === 'c') c.x = (x0 + x1) / 2 - c.w / 2; if (a === 'r') c.x = x1 - c.w; if (a === 't') c.y = y0; if (a === 'm') c.y = (y0 + y1) / 2 - c.h / 2; if (a === 'b') c.y = y1 - c.h; });
    }
    if (di) { const hz = di.dataset.dist === 'h', s = [...cs].sort((a, b) => hz ? a.x - b.x : a.y - b.y), first = s[0], last = s[s.length - 1];
      const span = hz ? last.x + last.w - first.x : last.y + last.h - first.y, used = s.reduce((t, c) => t + (hz ? c.w : c.h), 0), gap = (span - used) / (s.length - 1); let at = hz ? first.x : first.y;
      s.forEach(c => { if (hz) c.x = at; else c.y = at; at += (hz ? c.w : c.h) + gap; }); }
    if (ta || al || di) { cs.forEach(c => renderCard(c)); selectOnly(cs.map(c => c.id)); renderWires(); save(); renderDesign(); }
  });
  // keep X / Y / W / H current while you drag (unless you're typing in them)
  function syncDesign() { const one = selCards().length === 1 && WF.includes(selCards()[0].type) ? selCards()[0] : null; if (!one || $('dzProps').contains(document.activeElement)) return;
    ['x', 'y', 'w', 'h'].forEach(k => { const i = $('dzProps').querySelector(`[data-k="${k}"]`); if (i && +i.value !== Math.round(one[k])) i.value = Math.round(one[k]); }); }

  // ---------- filling image spots: Higgsfield photos (price check, then your yes) or free drawn illustrations ----------
  const spotsIn = cs => { const ids = new Set(); cs.forEach(c => { if (c.type === 'frame') onFrame(c).forEach(k => ids.add(k.id)); else ids.add(c.id); }); return board.cards.filter(c => ids.has(c.id) && c.type === 'box' && c.img && !c.src); };
  const aspect = c => { const r = c.w / c.h, opts = [['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4], ['16:9', 16 / 9], ['9:16', 9 / 16], ['3:2', 1.5], ['2:3', 2 / 3], ['21:9', 21 / 9]]; return opts.sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0]; };
  const styleHint = spots => { const f = byId(spots[0]?.onFrame); return [board.name, f?.name].filter(Boolean).join(', '); };
  function offerFill(spots, where = 'chat') {
    if (!spots.length) return;
    if (MB.web) return say(`There ${spots.length === 1 ? 'is 1 image spot' : `are ${spots.length} image spots`} waiting for pictures. In the Mac app I can fill them with Higgsfield or draw them for you ✦`, 0, DL);
    const n = spots.length, acts = [];
    if (settings.ai && settings.higgs) acts.push({ label: `Fill ${n} with Higgsfield ✦`, run: () => quoteFill(spots) });
    if (settings.ai) acts.push({ label: 'Draw simple illustrations (free)', ghost: !!(settings.ai && settings.higgs), run: () => drawFill(spots) });
    if (!acts.length) return;
    say(`There ${n === 1 ? 'is 1 image spot' : `are ${n} image spots`} waiting for pictures. ${settings.higgs ? 'Higgsfield makes real photos (that uses credits, and I check the price with you first), or I can draw simple illustrations for free.' : 'I can draw simple illustrations for them, free.'}`, 0, [...acts, { label: 'Leave them empty', ghost: true, run: () => {} }]);
  }
  async function quoteFill(spots) {
    if (!chatOpen()) mochiOpen(true); addMsg('mochi', 'Checking your Higgsfield balance and the price per image…'); typing(true, 'checking prices');
    try {
      const q = parse(await MB.higgsQuote({ model: 'nano_banana_2' })); typing(false);
      const per = +q.perImage, bal = +q.balance, total = Number.isFinite(per) ? Math.ceil(per * spots.length) : null;
      const line = total != null ? `That's ${spots.length} image${spots.length > 1 ? 's' : ''} × about ${per} credits ≈ ${total} credits.` : `I couldn't find the exact price, so check Higgsfield before saying yes.`;
      const balLine = Number.isFinite(bal) ? ` You have ${bal} credits.` : '', short = Number.isFinite(bal) && total != null && total > bal;
      say(line + balLine + (short ? ' That\'s more than you have right now, so I\'d fill fewer spots or top up first.' : ' Want me to make them?'), 0,
        short ? [{ label: 'Draw illustrations instead (free)', run: () => drawFill(spots) }, { label: 'Not now', ghost: true, run: () => {} }]
              : [{ label: `Yes, make ${spots.length} ✦`, run: () => makeFill(spots) }, { label: 'Not now', ghost: true, run: () => {} }]);
    } catch (e) { typing(false); say("I couldn't reach Higgsfield: " + e.message); }
  }
  async function placeImages(spots, list, key) {
    let n = 0;
    for (const it of list || []) { const c = spots.find(s => s.id === it.id); if (!c) continue;
      try { c.src = key === 'svg' ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg) : await MB.fetchImage(it.url); renderCard(c); n++; } catch (e) {} }
    save(); return n;
  }
  async function makeFill(spots) {
    addMsg('mochi', `Making ${spots.length} image${spots.length > 1 ? 's' : ''} with Higgsfield… this can take a minute or two ✦`); typing(true, 'making pictures'); $('mochi').classList.add('thinking'); goo.think(true); favGoo?.think(true);
    try { const r = parse(await MB.higgsMake({ model: 'nano_banana_2', style: styleHint(spots), images: spots.map(c => ({ id: c.id, label: c.img, aspect: aspect(c) })) }));
      const n = await placeImages(spots, r.images, 'url'); typing(false); say(n ? `Done! ${n} image${n > 1 ? 's are' : ' is'} in place ✦` : "Hmm, the images didn't come back. Nothing was placed."); if (n) showWhatMochiMade(spots.filter(c => c.src)); }
    catch (e) { typing(false); say("Something went wrong making those: " + e.message); }
    finally { $('mochi').classList.remove('thinking'); goo.think(false); favGoo?.think(false); }
  }
  async function drawFill(spots) {
    if (!chatOpen()) mochiOpen(true); addMsg('mochi', `Drawing ${spots.length} little illustration${spots.length > 1 ? 's' : ''}…`); typing(true, 'drawing'); $('mochi').classList.add('thinking'); goo.think(true); favGoo?.think(true);
    try { const r = parse(await MB.drawFill({ style: 'soft pastel, rounded, friendly, minimal', images: spots.map(c => ({ id: c.id, label: c.img, w: Math.round(c.w), h: Math.round(c.h) })) }));
      const n = await placeImages(spots, r.images, 'svg'); typing(false); say(n ? `Drew ${n} ✦ (want real photos later? that's Higgsfield)` : "I couldn't draw those this time."); if (n) showWhatMochiMade(spots.filter(c => c.src)); }
    catch (e) { typing(false); say("I couldn't draw those: " + e.message); }
    finally { $('mochi').classList.remove('thinking'); goo.think(false); favGoo?.think(false); }
  }

  // ---------- crop an image: see the whole picture, drag the box or its corners, then Done ----------
  let cropping = null, cropDrag = null;
  function startCrop(c) {
    const img = cardsEl.querySelector(`[data-id="${c.id}"] img`), nw = img?.naturalWidth || c.w, nh = img?.naturalHeight || c.h;
    cropping = { c, nw, nh, prevH: c.h, prevCrop: c.crop, box: Object.assign({ x: 0, y: 0, w: 1, h: 1 }, c.crop) };
    c.cropEdit = true; c.h = Math.round((c.w - 16) * nh / nw + 16); renderCard(c); selectOnly([c.id]); $('selbar').dataset.key = ''; renderWires();
  }
  function endCrop(how) {
    if (!cropping) return; const { c, nw, nh, prevH, prevCrop, box } = cropping;
    if (how === 'reset') { cropping.box = { x: 0, y: 0, w: 1, h: 1 }; renderCard(c); selectOnly([c.id]); return; }
    if (how === 'done') { const full = box.w > .995 && box.h > .995; if (full) delete c.crop; else c.crop = { ...box }; c.h = Math.round((c.w - 16) * (nh * box.h) / (nw * box.w) + 16); }
    else { c.h = prevH; if (prevCrop) c.crop = prevCrop; else delete c.crop; }
    delete c.cropEdit; cropping = null; renderCard(c); selectOnly([c.id]); $('selbar').dataset.key = ''; renderWires(); if (how === 'done') save();
  }
  function cropDown(e) {
    const img = cardsEl.querySelector(`[data-id="${cropping.c.id}"] img`); if (!img) return;
    cropDrag = { h: e.target.closest('[data-h]')?.dataset.h || 'move', r: img.getBoundingClientRect(), sx: e.clientX, sy: e.clientY, b0: { ...cropping.box } }; stage.setPointerCapture(e.pointerId);
  }
  addEventListener('pointermove', e => {
    if (!cropDrag || !cropping) return;
    const { h, r, b0 } = cropDrag, dx = (e.clientX - cropDrag.sx) / r.width, dy = (e.clientY - cropDrag.sy) / r.height, MIN = .08, b = { ...b0 };
    if (h === 'move') { b.x = clamp(b0.x + dx, 0, 1 - b0.w); b.y = clamp(b0.y + dy, 0, 1 - b0.h); }
    if (h.includes('w')) { b.x = clamp(b0.x + dx, 0, b0.x + b0.w - MIN); b.w = b0.x + b0.w - b.x; }
    if (h.includes('e')) b.w = clamp(b0.w + dx, MIN, 1 - b0.x);
    if (h.includes('n')) { b.y = clamp(b0.y + dy, 0, b0.y + b0.h - MIN); b.h = b0.y + b0.h - b.y; }
    if (h.includes('s')) b.h = clamp(b0.h + dy, MIN, 1 - b0.y);
    cropping.box = b; const box = cardsEl.querySelector(`[data-id="${cropping.c.id}"] .crop-box`);
    if (box) Object.assign(box.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' });
  });
  addEventListener('pointerup', () => { cropDrag = null; });

  // ---------- drawing: the same soft ink as jessa.art (it swells when you slow down and tapers at the ends), plus a marker, a highlighter and an easy eraser ----------
  const INKS = { ink: '#494848', pink: '#f27aa8', coral: '#ff7f6b', butter: '#f3c84a', mint: '#3fbf86', sky: '#4aa3f0', lilac: '#9b7bff', white: '#ffffff' };
  const PEN_SIZE = { pen: { s: 5, m: 9, l: 16 }, marker: { s: 4, m: 8, l: 14 }, hi: { s: 14, m: 24, l: 38 } };
  const pen = { tool: 'pen', size: 'm', color: 'ink' };
  let drawOn = false, stroke = null, erasing = false, liveSvg = null;
  try { Object.assign(pen, JSON.parse(localStorage.getItem('mochiboard:pen') || '{}')); } catch (e) {}
  // any thickness, not just three: each tool keeps its own (old drawings saved as s / m / l still read from PEN_SIZE)
  const PEN_RANGE = { pen: [2, 48], marker: [2, 40], hi: [8, 72], eraser: [10, 90] };
  pen.sizes = Object.assign({ pen: PEN_SIZE.pen[pen.size] || 9, marker: PEN_SIZE.marker[pen.size] || 8, hi: PEN_SIZE.hi[pen.size] || 24, eraser: 28 }, pen.sizes || {});
  const penW = (tool, size) => typeof size === 'number' ? size : ((PEN_SIZE[tool] || PEN_SIZE.pen)[size] || 9);
  const curSize = () => pen.sizes[pen.tool] || 9;
  const sizeToT = v => { const [a, b] = PEN_RANGE[pen.tool] || PEN_RANGE.pen; return Math.pow((v - a) / (b - a), 1 / 1.7); };   // a gentle curve: fine control at the thin end
  const tToSize = t => { const [a, b] = PEN_RANGE[pen.tool] || PEN_RANGE.pen; return Math.round(a + (b - a) * Math.pow(Math.min(1, Math.max(0, t)), 1.7)); };
  function setSize(v) { const [a, b] = PEN_RANGE[pen.tool] || PEN_RANGE.pen; pen.sizes[pen.tool] = Math.min(b, Math.max(a, Math.round(v))); paintSize(); try { localStorage.setItem('mochiboard:pen', JSON.stringify(pen)); } catch (e) {} }
  function paintSize() {
    const v = curSize(), t = sizeToT(v), er = pen.tool === 'eraser', col = er ? 'transparent' : pen.color === 'ink' ? 'var(--pen-ink)' : INKS[pen.color] || pen.color;
    $('dbsFill').style.width = `calc(${t * 100}% + ${9 - t * 18}px)`; $('dbsKnob').style.left = `calc(${t * 100}% + ${9 - t * 18}px)`; $('dbsVal').textContent = v;
    const dot = $('dbsDot'), d = Math.min(22, Math.max(3, v * (er ? .35 : .6))); Object.assign(dot.style, { width: d + 'px', height: d + 'px', background: col, opacity: pen.tool === 'hi' ? .45 : 1 }); dot.classList.toggle('er', er);
    // the bubble over the knob shows the true size on the board right now (at this zoom)
    const bub = $('dbsBub').firstElementChild, bd = Math.min(110, Math.max(2, er ? v : v * view.z)); Object.assign(bub.style, { width: bd + 'px', height: bd + 'px', background: col, opacity: pen.tool === 'hi' ? .45 : 1 }); bub.classList.toggle('er', er);
    const ring = $('eraseRing'); if (ring) Object.assign(ring.style, { width: v + 'px', height: v + 'px', margin: `${-v / 2}px 0 0 ${-v / 2}px` });
  }
  { const tr = $('dbsTrack'); let on = false;
    const at = e => { const r = tr.getBoundingClientRect(); setSize(tToSize((e.clientX - r.left - 9) / (r.width - 18))); };
    tr.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on = true; tr.setPointerCapture(e.pointerId); $('dbSize').classList.add('sizing'); at(e); });
    tr.addEventListener('pointermove', e => on && at(e));
    const up = () => { on = false; $('dbSize').classList.remove('sizing'); }; tr.addEventListener('pointerup', up); tr.addEventListener('pointercancel', up);
    tr.addEventListener('keydown', e => { const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!d) return; e.preventDefault(); e.stopPropagation(); setSize(curSize() + d * Math.max(1, Math.round(curSize() * .08))); });
    tr.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); setSize(curSize() + (e.deltaY < 0 || e.deltaX > 0 ? 1 : -1) * Math.max(1, Math.round(curSize() * .06))); }, { passive: false });
  }
  // [ and ] while drawing: smaller / bigger, with the bubble flashing up so you can see it
  addEventListener('keydown', e => { if (!drawOn || e.metaKey || e.ctrlKey || e.target.closest?.('input, textarea, [contenteditable="true"]')) return; const d = e.key === ']' ? 1 : e.key === '[' ? -1 : 0; if (!d) return;
    e.preventDefault(); setSize(curSize() + d * Math.max(1, Math.round(curSize() * .12))); $('dbSize').classList.add('sizing'); clearTimeout(setSize.t); setSize.t = setTimeout(() => $('dbSize').classList.remove('sizing'), 700); });
  // a filled ribbon around the line: wider where you slowed down, thin at the start and end, with a little breathing wobble
  function butter(raw, finished, BASE) {
    const pts = []; let acc = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i === 0) { pts.push({ x: raw[0][0], y: raw[0][1] }); continue; }
      const a = raw[i - 1], b = raw[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]), dt = Math.max(1, b[2] - a[2]);
      let d = acc; while (d < seg) { const k = d / seg; pts.push({ x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, v: seg / dt }); d += 3; }
      acc = d - seg;
    }
    if (pts.length < 2) return '';
    if (finished && pts.length > 6) { const a = pts[0], z = pts[pts.length - 1]; if (Math.hypot(a.x - z.x, a.y - z.y) < 14) pts.splice(-2, 2); }
    let s = pts[1]?.v || .3; const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = lens[lens.length - 1], MIN = Math.max(1, BASE / 9), ramp = Math.min(54, BASE * 6);
    const width = i => { s += ((pts[i].v == null ? s : pts[i].v) - s) * .08; const slow = Math.max(0, Math.min(1, 1 - s / 1.8));
      let w = MIN + (BASE - MIN) * (.22 + .78 * slow * slow); const inR = Math.min(1, lens[i] / ramp), outR = finished ? Math.min(1, (total - lens[i]) / ramp) : 1;
      return w * Math.pow(inR, .8) * Math.pow(outR, .8) * (1 + .12 * Math.sin(lens[i] / 11)) + .4; };
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)]; let nx = -(p1.y - p0.y), ny = p1.x - p0.x; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n;
      const w = width(i) / 2; L.push([pts[i].x + nx * w, pts[i].y + ny * w]); R.push([pts[i].x - nx * w, pts[i].y - ny * w]); }
    const seq = L.concat(R.reverse()); let d = `M${seq[0][0].toFixed(1)} ${seq[0][1].toFixed(1)}`;
    for (let i = 1; i < seq.length; i++) { const m = seq[i - 1], c = seq[i]; d += ` Q${m[0].toFixed(1)} ${m[1].toFixed(1)} ${((m[0] + c[0]) / 2).toFixed(1)} ${((m[1] + c[1]) / 2).toFixed(1)}`; }
    return d + ' Z';
  }
  function centerline(p) {
    if (p.length < 3) return `M${p[0][0]} ${p[0][1]} L${p[p.length - 1][0] + .1} ${p[p.length - 1][1]}`;
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 1; i < p.length - 1; i++) d += ` Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${((p[i][0] + p[i + 1][0]) / 2).toFixed(1)} ${((p[i][1] + p[i + 1][1]) / 2).toFixed(1)}`;
    return d + ` L${p[p.length - 1][0].toFixed(1)} ${p[p.length - 1][1].toFixed(1)}`;
  }
  function inkPath(pts, tool, size, color, finished) {
    const col = color === 'ink' || !color ? 'var(--pen-ink)' : INKS[color] || color, w = penW(tool, size);
    if (tool === 'pen') { if (pts.length < 2) { const [x, y] = pts[0]; return `<path style="fill:${col}" d="M${x - w / 3} ${y} a${w / 3} ${w / 3} 0 1 0 ${w / 1.5} 0 a${w / 3} ${w / 3} 0 1 0 ${-w / 1.5} 0"/>`; } return `<path style="fill:${col}" d="${butter(pts, finished, w)}"/>`; }
    return `<path fill="none" style="stroke:${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${tool === 'hi' ? ' opacity=".38" style="mix-blend-mode:multiply"' : ''} d="${centerline(pts)}"/>`;
  }
  function renderDrawbar() {
    $('dbColors').innerHTML = Object.entries(INKS).map(([n, c]) => `<button data-ink="${n}" title="${n}" style="background:${n === 'ink' ? 'var(--pen-ink)' : c}" class="${pen.color === n ? 'on' : ''}"></button>`).join('');
    $('drawbar').querySelectorAll('[data-pen]').forEach(b => b.classList.toggle('on', b.dataset.pen === pen.tool));
    paintSize();
    stage.classList.toggle('erasing', drawOn && pen.tool === 'eraser'); stage.classList.toggle('drawing', drawOn && pen.tool !== 'eraser');
    try { localStorage.setItem('mochiboard:pen', JSON.stringify(pen)); } catch (e) {}
  }
  function enterDraw() { if (pen.tool === 'eraser') pen.tool = 'pen'; stopPlacing(); selectOnly([]); selWire = null; selWires.clear(); drawOn = true; $('dock').classList.add('drawing'); renderDrawbar();
    if (!liveSvg) { liveSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); liveSvg.classList.add('live-ink'); world.appendChild(liveSvg); const ring = document.createElement('div'); ring.className = 'erase-ring'; ring.id = 'eraseRing'; stage.appendChild(ring); } }
  function exitDraw() { drawOn = false; stroke = null; erasing = false; $('dock').classList.remove('drawing'); stage.classList.remove('drawing', 'erasing'); if (liveSvg) liveSvg.innerHTML = ''; }
  $('drawbar').addEventListener('pointerdown', e => e.stopPropagation());
  $('drawbar').onclick = e => {
    const t = e.target.closest('[data-pen]'), k = e.target.closest('[data-ink]');
    if (e.target.closest('[data-db="done"]')) return exitDraw();
    if (t) pen.tool = t.dataset.pen; if (k) { pen.color = k.dataset.ink; if (pen.tool === 'eraser') pen.tool = 'pen'; }
    renderDrawbar();
  };
  const O = 5000;
  function drawDown(e) {
    const w = toWorld(e.clientX, e.clientY); stage.setPointerCapture(e.pointerId);
    if (pen.tool === 'eraser') { erasing = true; eraseAt(e); return; }
    stroke = { pts: [[w.x, w.y, performance.now()]], tool: pen.tool, size: curSize(), color: pen.color };
    liveSvg.innerHTML = '';
  }
  function eraseAt(e) {
    const w = toWorld(e.clientX, e.clientY), r = (pen.sizes.eraser || 28) / 2 / view.z; let hit = false;   // the eraser is a size on screen, like the ring you see
    board.cards.filter(c => c.type === 'ink').forEach(c => {
      const sx = c.w / c.ow, sy = c.h / c.oh, half = penW(c.pen, c.size) / 2;
      if (w.x < c.x - r - half || w.x > c.x + c.w + r + half || w.y < c.y - r - half || w.y > c.y + c.h + r + half) return;
      if (c.pts.some(p => Math.hypot(c.x + p[0] * sx - w.x, c.y + p[1] * sy - w.y) < r + half)) {
        hit = true; board.cards = board.cards.filter(x => x !== c); const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) { el.classList.add('fading'); setTimeout(() => el.remove(), 260); }
      }
    });
    if (hit) save();
  }
  addEventListener('pointermove', e => {
    if (!drawOn) return;
    const ring = $('eraseRing'); if (ring) { const r = stage.getBoundingClientRect(); ring.style.left = e.clientX - r.left + 'px'; ring.style.top = e.clientY - r.top + 'px'; }
    if (erasing) return eraseAt(e);
    if (!stroke) return;
    const w = toWorld(e.clientX, e.clientY), last = stroke.pts[stroke.pts.length - 1]; if (Math.hypot(w.x - last[0], w.y - last[1]) < 1.5 / view.z) return;
    stroke.pts.push([w.x, w.y, performance.now()]);
    liveSvg.innerHTML = inkPath(stroke.pts.map(p => [p[0] + O, p[1] + O, p[2]]), stroke.tool, stroke.size, stroke.color, false);
  });
  addEventListener('pointerup', () => {
    if (!drawOn) return; erasing = false; if (!stroke) return;
    const s2 = stroke; stroke = null; liveSvg.innerHTML = '';
    const pad = penW(s2.tool, s2.size) + 4, xs = s2.pts.map(p => p[0]), ys = s2.pts.map(p => p[1]);
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
    const pts = s2.pts.map(p => [+(p[0] - x0).toFixed(1), +(p[1] - y0).toFixed(1), Math.round(p[2])]);
    const c = card('ink', { x: x0, y: y0, w, h, ow: w, oh: h, r: 0, pts, pen: s2.tool, size: s2.size, ink: s2.color });
    board.cards.push(c); renderCard(c); save();
  });

  // ---------- stamps: Mochi's emojis, moving Mochis and regular emoji, stamped with a little burst ----------
  const M = n => 'stamps/mochi' + (n ? '-' + n : '') + '.png';
  const STAMPS = {
    mochi: [['Mochi', M('')], ['Happy', M('happy')], ['Love', M('love')], ['Party', M('party')], ['Wave', M('wave')], ['Shook', M('shook')], ['Sleepy', M('sleepy')], ['Cry', M('cry')], ['Sigh', M('sigh')],
      ['Double', M('double')], ['Double · mint', M('double-mint')], ['Double · butter', M('double-butter')],
      ...['blue', 'pink', 'mint', 'lilac', 'butter', 'peach', 'night'].map(c => [c === 'blue' ? 'Wings' : 'Wings · ' + c, M('wings-' + c)]),
      ...['blue', 'pink', 'mint', 'lilac', 'butter', 'peach', 'night'].map(c => [c === 'blue' ? 'Devil' : 'Devil · ' + c, M('devil-' + c)])].map(([n, src]) => ({ n, src })),
    moving: [{ n: 'Bounce', src: 'stamps/mochi-bounce.gif' }, { n: 'Sigh', src: 'stamps/mochi-sigh.gif' },
      ...['blue', 'pink', 'mint', 'lilac', 'butter', 'peach', 'night'].map(c => ({ n: c === 'blue' ? 'Fly' : 'Fly · ' + c, src: `stamps/mochi-fly-${c}.gif` })), { n: 'Hi!', src: M('wave'), mv: 'wiggle' }, { n: 'Love', src: M('love'), mv: 'pulse' },
      { n: 'Party', src: M('party'), mv: 'spin' }, { n: 'Shook', src: M('shook'), mv: 'shake' }, { n: 'Sleepy', src: M('sleepy'), mv: 'float' }, { n: 'Happy', src: M('happy'), mv: 'squish' }, { n: 'Hop', src: M(''), mv: 'hop' }],
    emoji: [...'❤️ 👍 👎 ⭐ ✨ 🌈 🔥 🎉 💯 ✅ ❌ ❓ ❗ 💡 👀 🙌 👏 🤔 😍 😂 🥹 😭 😅 🫶 💖 🩷 💜 💙 🌸 🌷 🍓 🍑 🧁 ☕ 🚀 📌 📍 🎯 🏆 🧠 💬 🗓️ ⏰ 🔗 🎨 🖍️ 📸 🎧'.split(' ')].map(e => ({ n: e, emoji: e })),
  };
  const WHEEL_DEFAULT = [{ emoji: '❤️' }, { emoji: '👍' }, { src: M('love') }, { emoji: '⭐' }, { src: 'stamps/mochi-bounce.gif' }, { emoji: '❓' }, { emoji: '🌈' }, { src: M('happy'), mv: 'squish' }];
  // the wheel keeps your favorites; anything you pick from the full list joins it
  let wheel = WHEEL_DEFAULT; try { const w0 = JSON.parse(localStorage.getItem('mochiboard:wheel') || 'null'); if (Array.isArray(w0) && w0.length === 8) wheel = w0; } catch (e) {}
  // every emoji stamp is drawn as Mochi-style pixel art (stamps/px); boards made before keep working, they just get the new look
  const PX = { '❤️': 'heart', '👍': 'thumbsup', '👎': 'thumbsdown', '⭐': 'star', '✨': 'sparkles', '🌈': 'rainbow', '🔥': 'fire', '🎉': 'party', '💯': 'hundred', '✅': 'check', '❌': 'cross', '❓': 'question', '❗': 'exclaim', '💡': 'bulb', '👀': 'eyes', '🙌': 'raised', '👏': 'clap', '🤔': 'thinking', '😍': 'hearteyes', '😂': 'joy', '🥹': 'holdingtears', '😭': 'sob', '😅': 'sweat', '🫶': 'hearthands', '💖': 'sparkleheart', '🩷': 'pinkheart', '💜': 'purpleheart', '💙': 'blueheart', '🌸': 'blossom', '🌷': 'tulip', '🍓': 'strawberry', '🍑': 'peach', '🧁': 'cupcake', '☕': 'coffee', '🚀': 'rocket', '📌': 'pushpin', '📍': 'roundpin', '🎯': 'target', '🏆': 'trophy', '🧠': 'brain', '💬': 'speech', '🗓️': 'calendar', '⏰': 'alarm', '🔗': 'link', '🎨': 'palette', '🖍️': 'crayon', '📸': 'camera', '🎧': 'headphones' };
  const pxSrc = e => PX[e] ? `stamps/px/${PX[e]}.png` : null;
  const stampHTML = st => st.src ? `<img src="${esc(st.src)}" alt="">` : pxSrc(st.emoji) ? `<img src="${pxSrc(st.emoji)}" alt="${esc(st.emoji)}">` : esc(st.emoji);
  function renderWheel() {
    $('wsRing').innerHTML = wheel.map((st, i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2, x = 110 + Math.cos(a) * 76, y = 110 + Math.sin(a) * 76;
      return `<button data-w="${i}" class="${st.mv ? 'mv-' + st.mv : ''}" style="left:${x}px;top:${y}px">${stampHTML(st)}</button>`; }).join('');
  }
  function renderPick(tab = 'mochi') {
    $('stampPick').querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('spGrid').innerHTML = STAMPS[tab].map((st, i) => `<button data-p="${tab}:${i}" title="${esc(st.n)}" class="${st.mv ? 'mv-' + st.mv : ''}">${stampHTML(st)}</button>`).join('');
  }
  const pickStamp = st => { $('stampWheel').classList.remove('on'); $('stampPick').classList.remove('on'); startPlacing('stamp', { stamp: st }); $('tools').querySelector('[data-add="stamp"]').classList.add('on'); };
  $('wsRing').onclick = e => { const b = e.target.closest('[data-w]'); if (b) pickStamp(wheel[+b.dataset.w]); };
  $('wsMid').onclick = () => { $('stampWheel').classList.remove('on'); renderPick(); $('stampPick').classList.add('on'); };
  $('stampPick').onclick = e => {
    const t = e.target.closest('[data-tab]'); if (t) return renderPick(t.dataset.tab);
    const b = e.target.closest('[data-p]'); if (!b) return; const [tab, i] = b.dataset.p.split(':'), st = STAMPS[tab][+i], clean = { src: st.src, emoji: st.emoji, mv: st.mv };
    if (!wheel.some(w2 => w2.src === clean.src && w2.emoji === clean.emoji && w2.mv === clean.mv)) { wheel = [clean, ...wheel].slice(0, 8); try { localStorage.setItem('mochiboard:wheel', JSON.stringify(wheel)); } catch (e2) {} }
    pickStamp(clean);
  };
  ['stampWheel', 'stampPick'].forEach(id => $(id).addEventListener('pointerdown', e => e.stopPropagation()));
  function stampAt(w, st) {
    const c = card('stamp', { src: st.src, emoji: st.emoji, mv: st.mv, r: Math.round(Math.random() * 16 - 8) }); c.x = w.x - 28; c.y = w.y - 28;
    addCard(c);
    const r = stage.getBoundingClientRect(), b = document.createElement('div'); b.className = 'burst'; b.style.left = mouse.x - r.left + 'px'; b.style.top = mouse.y - r.top + 'px';
    b.innerHTML = [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<i style="--a:${a}deg"></i>`).join(''); stage.appendChild(b); setTimeout(() => b.remove(), 500);
  }

  // ---------- shapes: pick one from the little row, then place it ----------
  $('shapePick').onclick = e => { const b = e.target.closest('[data-shape]'); if (!b) return; startPlacing('shape', { shape: b.dataset.shape }); $('tools').querySelector('[data-add="shape"]').classList.add('on'); };

  // ---------- links: type or paste right into the card, then it fills in the site's name and picture ----------
  function wireLinkInput(c) {
    const el = cardsEl.querySelector(`[data-id="${c.id}"]`), inp = el?.querySelector('.link-in input'); if (!inp || inp.dataset.wired) return; inp.dataset.wired = 1;
    if (!c.loading) setTimeout(() => { inp.focus(); inp.select(); }, 20);
    inp.oninput = () => { c.draft = inp.value; };
    inp.onkeydown = async ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { inp.blur(); if (!inp.value.trim() && !c.title) { sel = new Set([c.id]); removeSelected(); } return; }
      if (ev.key !== 'Enter' || !inp.value.trim()) return;
      const u = inp.value.trim(), url = /^https?:/i.test(u) || /^spotify:/i.test(u) ? u : 'https://' + u;
      if (spotifyOf(url)) { await spotifyFill(c, url); selectOnly([c.id]); return; }
      c.loading = true; renderCard(c); selectOnly([c.id]);
      let p = {}; try { p = await MB.linkPreview(url); } catch (e2) {}
      Object.assign(c, { url, title: p.title || host(url), desc: p.desc || host(url), image: p.image || '', loading: false, draft: '' });
      c.h = c.image ? 210 : 52; renderCard(c); selectOnly([c.id]); save();
      linkShot(c, url);
    };
  }

  // ---------- docs: a real document editor (styles, fonts, sizes, colors, lists, tables, images, Mochi on any words), beside the board ----------
  // A doc keeps its rich content in c.doc (the editor's own structured format) and a plain-text copy in c.body (for the card, search and Mochi).
  let docCard = null, ed = null, dvT = 0; const bubbleEl = $('dvBubble');   // the editor's popup moves the floating bar out of the page, so keep hold of it
  const DOC_FONT = 'DM Sans', SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72];
  const BLOCKS = [['title', 'Title', 36], ['heading', 'Heading', 26], ['sub', 'Subheading', 20], ['body', 'Body', 16], ['lead', 'Lead', 19], ['caption', 'Caption', 13], ['quote', 'Quote', 18], ['code', 'Code', 14]];
  const TEXT_COLORS = ['#2b2630', '#6b6370', '#a39aa8', '#e2649a', '#e8590c', '#c99a00', '#1f9d63', '#1f7ae0', '#6b4fe0', '#c0392b'];
  const HIGHLIGHTS = ['#fff1a8', '#ffd3e5', '#cdf2df', '#d4e8ff', '#e5dbff', '#ffe0c9', '#e9e4ec'];
  const SUGGESTED_FONTS = ['DM Sans', 'Inter', 'Helvetica Neue', 'Avenir Next', 'Futura', 'Gill Sans', 'Georgia', 'Baskerville', 'Palatino', 'Times New Roman', 'Didot', 'Playfair Display', 'Lora', 'Fraunces', 'Merriweather', 'Space Grotesk', 'IBM Plex Mono', 'Menlo', 'Caveat'];
  const DI = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const DICON = {
    left: DI('<path d="M3.5 5h13M3.5 8.5h9M3.5 12h13M3.5 15.5h9"/>'), center: DI('<path d="M3.5 5h13M5.5 8.5h9M3.5 12h13M5.5 15.5h9"/>'),
    right: DI('<path d="M3.5 5h13M7.5 8.5h9M3.5 12h13M7.5 15.5h9"/>'), justify: DI('<path d="M3.5 5h13M3.5 8.5h13M3.5 12h13M3.5 15.5h13"/>'),
    bullet: DI('<circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="10" r="1" fill="currentColor"/><circle cx="4.5" cy="14" r="1" fill="currentColor"/><path d="M8 6h8.5M8 10h8.5M8 14h8.5"/>'),
    ordered: DI('<path d="M3.5 4.5h1.2v3.2M3.4 7.7h2.2M3.4 12.2c.2-.7 2.2-.8 2.2.3 0 .8-2.2 1.4-2.2 2.2h2.3M8.5 6h8M8.5 13.5h8"/>'),
    task: DI('<rect x="3" y="4" width="5" height="5" rx="1.3"/><path d="M4.3 6.5l1 1 1.6-2"/><rect x="3" y="11.5" width="5" height="5" rx="1.3"/><path d="M10.5 6.5h6M10.5 14h6"/>'),
    link: CIC.link, image: DI('<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.4"/><path d="M3.5 14.5l4-3.5 3 2.5 2.5-2 3.5 3"/>'),
    more: DI('<circle cx="5" cy="10" r="1.1" fill="currentColor"/><circle cx="10" cy="10" r="1.1" fill="currentColor"/><circle cx="15" cy="10" r="1.1" fill="currentColor"/>'),
    hl: DI('<path d="M11.5 3.5l5 5-6 6H6v-4.5z"/><path d="M4 18h12" stroke-width="3" class="bar"/>'), undo: DI('<path d="M7.5 7.5H13a3.5 3.5 0 0 1 0 7H8"/><path d="M10 4.5l-3 3 3 3"/>'), redo: DI('<path d="M12.5 7.5H7a3.5 3.5 0 0 0 0 7h5"/><path d="M10 4.5l3 3-3 3"/>'),
    mochi: DI('<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><path d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
    table: DI('<rect x="3" y="4" width="14" height="12" rx="1.6"/><path d="M3 8h14M3 12h14M8 4v12M12.5 4v12"/>'), hr: DI('<path d="M3 10h14"/><path d="M6 6h8M6 14h8" opacity=".4"/>'),
    clear: DI('<path d="M5 4.5h10M10 4.5L7.5 16"/><path d="M12.5 12l4 4M16.5 12l-4 4"/>'),
  };
  const fontName = f => String(f || '').replace(/["']/g, '').split(',')[0].trim();
  const escH = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  // plain text or Mochi's light markdown → editor HTML (headings, lists, checklists, quotes, dividers, **bold**, *italic*, `code`)
  function mdToHTML(src) {
    const inl = s => escH(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>').replace(/`(.+?)`/g, '<code>$1</code>');
    const lines = String(src || '').replace(/\r/g, '').split('\n'); let out = '', list = null;
    const close = () => { if (list) { out += `</${list === 'task' ? 'ul' : list}>`; list = null; } };
    const open = k => { if (list !== k) { close(); out += k === 'task' ? '<ul data-type="taskList">' : `<${k}>`; list = k; } };
    for (const raw of lines) {
      const l = raw.trimEnd(); let m;
      if (!l.trim()) { close(); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); out += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; }
      else if ((m = l.match(/^\s*(?:(?:[-*]\s+)?\[( |x|X)\]|([☐☑]))\s*(.*)/))) { open('task'); const on = (m[1] || '').toLowerCase() === 'x' || m[2] === '☑'; out += `<li data-type="taskItem" data-checked="${on}"><p>${inl(m[3])}</p></li>`; }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { open('ul'); out += `<li><p>${inl(m[1])}</p></li>`; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { open('ol'); out += `<li><p>${inl(m[1])}</p></li>`; }
      else if ((m = l.match(/^>\s?(.*)/))) { close(); out += `<blockquote><p>${inl(m[1])}</p></blockquote>`; }
      else if (/^(-{3,}|\*{3,})$/.test(l.trim())) { close(); out += '<hr>'; }
      else { close(); out += `<p>${inl(l)}</p>`; }
    }
    close(); return out || '<p></p>';
  }
  const docHTML = c => c.doc && window.MBEditor ? MBEditor.generateHTML(c.doc, MBEditor.extensions()) : mdToHTML(c.body);
  // load any web fonts a doc uses, so it looks right on this Mac
  function fontsIn(json) { const out = new Set(); (function walk(n) { (n?.marks || []).forEach(m => m.type === 'textStyle' && m.attrs?.fontFamily && out.add(fontName(m.attrs.fontFamily))); (n?.content || []).forEach(walk); })(json); return [...out]; }

  function ensureEditor() {
    if (ed) return ed; if (!window.MBEditor) return null;
    ed = new MBEditor.Editor({
      element: $('dvBody'),
      extensions: [...MBEditor.extensions('Start writing, or drag cards here from the board…'),
        MBEditor.BubbleMenu.configure({ element: bubbleEl, tippyOptions: { duration: [140, 90], placement: 'top', offset: [0, 10], maxWidth: 'none', zIndex: 60, appendTo: () => document.body, popperOptions: { strategy: 'fixed' } },
          shouldShow: ({ editor, state }) => !hlPen && !state.selection.empty && editor.isEditable && !editor.isActive('image') && !document.querySelector('#dvPop:not([hidden])') })],
      editorProps: {
        attributes: { class: 'dv-prose', spellcheck: 'true' },
        handleKeyDown: (v, e) => { if (hlPen && e.key === 'Escape') { hlPenOff(); return true; } if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); showPop('link', $('dvTools').querySelector('[data-pop="link"]')); return true; } return false; },
        // images dropped or pasted in become part of the doc (kept inside the doc, so they never go missing)
        handleDrop: (v, e) => { const fs = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (!fs.length) return false; e.preventDefault(); const pos = v.posAtCoords({ left: e.clientX, top: e.clientY })?.pos; fs.forEach(f => addDocImage(f, pos)); return true; },
        handlePaste: (v, e) => { const fs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (!fs.length) return false; fs.forEach(f => addDocImage(f)); return true; },
      },
      onUpdate: () => { if (!docCard) return; clearTimeout(dvT); $('dvSaved').textContent = 'saving…'; dvT = setTimeout(syncDoc, 350); paintCount(); },
      onSelectionUpdate: () => paintTools(), onTransaction: () => requestAnimationFrame(paintTools),
    });
    buildTools();
    // highlighter mode: let go of a drag and the words you swept over get highlighted (or un-highlighted, if they already were)
    ed.view.dom.addEventListener('pointerup', () => setTimeout(() => {
      if (!hlPen || !ed) return; const { from, to, empty } = ed.state.selection; if (empty) return;
      const c = ed.chain().focus(); (ed.isActive('highlight', { color: hlPen }) ? c.unsetHighlight() : c.setHighlight({ color: hlPen })).setTextSelection(to).run();
    }, 0));
    return ed;
  }
  let hlPen = null;   // the highlighter's color while you're holding it
  const penCursor = col => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><g transform='rotate(40 13 13)'><rect x='9' y='3' width='8' height='14' rx='2' fill='${col}' stroke='#494848' stroke-width='1.4'/><path d='M9.5 17h7l-1.5 5h-4z' fill='#fff' stroke='#494848' stroke-width='1.4' stroke-linejoin='round'/><rect x='11.5' y='22' width='3' height='2' fill='${col}' stroke='#494848' stroke-width='1'/></g></svg>`)}") 4 22, text`;
  function hlPenOn(col) {
    hlPen = col; $('docview').classList.add('hl-pen'); $('dvBody').style.setProperty('--pen', penCursor(col));
    let chip = $('hlChip'); if (!chip) { chip = document.createElement('div'); chip.id = 'hlChip'; chip.className = 'hl-chip'; $('docview').appendChild(chip); chip.onclick = e => { if (e.target.closest('button')) hlPenOff(); }; }
    chip.innerHTML = `<i style="background:${col}"></i>Highlighter on · drag over words <button type="button">Put it down · Esc</button>`;
    document.querySelectorAll('.dt-hl').forEach(b => b.classList.add('on')); ed?.commands.setTextSelection(ed.state.selection.to);
  }
  function hlPenOff() { hlPen = null; $('docview').classList.remove('hl-pen'); $('dvBody').style.removeProperty('--pen'); $('hlChip')?.remove(); document.querySelectorAll('.dt-hl').forEach(b => b.classList.remove('on')); }
  addEventListener('keydown', e => { if (hlPen && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hlPenOff(); if (!$('dvPop').hidden) hidePop(); } }, true);
  function syncDoc() {
    clearTimeout(dvT); if (!docCard || !ed) return;
    docCard.doc = ed.getJSON(); docCard.body = ed.getText({ blockSeparator: '\n' }).replace(/\n{3,}/g, '\n\n').trim();
    renderCard(docCard); save(); $('dvSaved').textContent = 'saved';
  }
  const paintCount = () => { if (!ed) return; const w = ed.storage.characterCount.words(); $('dvCount').textContent = `${w.toLocaleString()} word${w === 1 ? '' : 's'}`; };
  function addDocImage(file, pos) {
    const r = new FileReader(); r.onload = () => { const ch = ed.chain().focus(); (pos != null ? ch.insertContentAt(pos, { type: 'image', attrs: { src: r.result } }) : ch.setImage({ src: r.result })).run(); };
    r.readAsDataURL(file);
  }
  const imgPick = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: true, hidden: true }); document.body.appendChild(imgPick);
  imgPick.onchange = () => { [...imgPick.files].forEach(f => addDocImage(f)); imgPick.value = ''; };

  function openDoc(c) {
    if (docCard && docCard !== c) syncDoc();
    docCard = c; $('dvTitle').value = c.text || '';
    $('dvWhere').textContent = `${board.name} › ${c.text || 'Untitled'}`;
    $('docview').classList.add('on'); stage.classList.add('doc-open'); selectOnly([]);
    const e = ensureEditor();
    if (e) { e.commands.setContent(docHTML(c), false); if (c.doc) fontsIn(c.doc).forEach(useFont); e.commands.setTextSelection(0); paintTools(); paintCount(); $('dvSaved').textContent = ''; }
    $('dvPage').scrollTop = 0;
    setTimeout(() => c.text ? e?.commands.focus('end') : $('dvTitle').focus(), 250);
  }
  function closeDoc() { if (!docCard) return; hlPenOff(); syncDoc(); hidePop(); const c = docCard; docCard = null; $('docview').classList.remove('on', 'wide'); stage.classList.remove('doc-open'); document.activeElement.blur(); renderCard(c); selectOnly([c.id]); save(); }
  $('dvTitle').oninput = () => { if (!docCard) return; docCard.text = $('dvTitle').value; $('dvWhere').textContent = `${board.name} › ${docCard.text || 'Untitled'}`; renderCard(docCard); save(); };
  $('dvTitle').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); ed?.commands.focus('start'); } };
  $('dvBack').onclick = closeDoc; $('dvClose').onclick = closeDoc;
  $('dvExport').onclick = e => { ensureEditor(); showPop('export', e.currentTarget); };
  // writing on a dark page: only the view changes, never what gets saved or downloaded
  const pagePref = () => { try { return localStorage.getItem('mochiboard:docPage') || 'auto'; } catch (e) { return 'auto'; } };
  function applyDocPage() { const p = pagePref(), dark = p === 'dark' || (p === 'auto' && document.body.classList.contains('dark')); $('docview').classList.toggle('page-dark', dark); }
  $('dvPageMode').onclick = e => { ensureEditor(); showPop('page', e.currentTarget); };
  new MutationObserver(applyDocPage).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  applyDocPage();

  // ---------- a doc as a PDF: the same styles you see, laid out on real pages ----------
  // the editor's own text styles, read from the app's stylesheet, so the PDF always matches the screen
  function proseCSS() {
    let out = '';
    for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.selectorText && /\.dv-prose/.test(r.selectorText) && !/page-dark|ProseMirror-selectednode|selectedCell|column-resize|resize-cursor|is-empty|::selection|is-editor-empty/.test(r.selectorText)) out += r.cssText + '\n'; }
    return out;
  }
  function docPrintHTML(paper) {
    // glue each heading to the block after it, so a heading never sits alone at the bottom of a page (WebKit's print ignores break-after)
    const glue = html => { const d = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html'), r = d.getElementById('r');
      [...r.querySelectorAll(':scope > h1, :scope > h2, :scope > h3')].forEach(h => { const w = d.createElement('div'); w.className = 'keep'; h.before(w); w.append(h); const n = w.nextElementSibling; if (n && !/^H[1-3]$/.test(n.tagName)) w.append(n); });
      return r.innerHTML; };
    const body = glue(ed ? ed.getHTML() : docHTML(docCard)), first = (ed ? ed.state.doc.firstChild?.textContent : '') || '';
    const title = (docCard?.text || '').trim() && first.trim().toLowerCase() !== (docCard.text || '').trim().toLowerCase() ? docCard.text.trim() : '';   // no double title when the doc already starts with it
    const web = [...new Set(fontsIn(ed ? ed.getJSON() : docCard.doc || {}))].filter(f => !onMac(f));
    const size = paper === 'a4' ? '210mm 297mm' : '8.5in 11in';
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title || 'Document')}</title>
<link rel="stylesheet" href="__WEB__/fonts.css">${web.map(f => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400&display=swap">`).join('')}
<style>
@page { size: ${size}; margin: 0.8in 0.85in 0.85in; }   /* browsers use these; the Mac app sets the same margins on its printer */
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { padding: 0; }
:root { --paper: #ffffff; --paper-ink: #2b2630; --paper-soft: #6b6370; }   /* downloads are always light pages */
.doc-title { margin: 0 0 18px; font: 800 36px/1.1 "DM Sans", system-ui, sans-serif; letter-spacing: -.035em; color: #2b2630; }
${proseCSS()}
.dv-prose { min-height: 0; }
.dv-prose h1, .dv-prose h2, .dv-prose h3 { break-after: avoid; page-break-after: avoid; }
.dv-prose img, .dv-prose tr, .dv-prose blockquote, .dv-prose pre, .dv-prose li { break-inside: avoid; page-break-inside: avoid; }
.dv-prose p { orphans: 3; widows: 3; }
.dv-prose .keep { break-inside: avoid; page-break-inside: avoid; }
.dv-prose .keep > :first-child { margin-top: 0; } .dv-prose > .keep { margin-top: 1.5em; } .dv-prose > .keep:first-child { margin-top: 0; }
.dv-prose a { color: #c4417f; }
.dv-prose ul[data-type="taskList"] input[type="checkbox"] { pointer-events: none; }
</style></head><body>${title ? `<h1 class="doc-title">${escH(title)}</h1>` : ''}<div class="dv-prose">${body}</div></body></html>`;
  }
  // ---------- a doc as a Word file: real headings, lists, tables and pictures, with DM Sans built in ----------
  let docxLoading = null;
  const loadDocx = () => docxLoading || (docxLoading = new Promise((res, rej) => { if (window.MBDocx) return res(); const sc = document.createElement('script'); sc.src = 'vendor/docx.js'; sc.onload = res; sc.onerror = () => { docxLoading = null; rej(new Error("the Word maker didn't load")); }; document.head.appendChild(sc); }));
  async function downloadWord() {
    if (!docCard) return; syncDoc();
    const paper = (() => { try { return localStorage.getItem('mochiboard:paper') || 'letter'; } catch (e) { return 'letter'; } })();
    $('dvSaved').textContent = 'making your Word file…';
    try {
      await loadDocx();
      const bytes = await MBDocx.toDocx(ed ? ed.getJSON() : docCard.doc || MBEditor.generateJSON(docHTML(docCard), MBEditor.extensions()), { title: (docCard.text || '').trim(), paper });
      let b64 = ''; for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); b64 = btoa(b64);
      const name = await MB.saveFile(b64, (docCard.text || 'Document').trim() || 'Document', 'docx');
      if (name) say(`Saved “${name}” ✦`, 5000);
    } catch (err) { say("I couldn't make the Word file: " + err.message, 8000); }
    finally { $('dvSaved').textContent = ''; }
  }
  async function downloadPDF() {
    if (!docCard) return; syncDoc();
    const paper = (() => { try { return localStorage.getItem('mochiboard:paper') || 'letter'; } catch (e) { return 'letter'; } })();
    $('dvSaved').textContent = 'making your PDF…';
    try {
      const name = await MB.docPDF(docPrintHTML(paper), (docCard.text || 'Document').trim() || 'Document', paper);
      if (name) say(`Saved “${name}” ✦`, 5000);
    } catch (err) { say("I couldn't make the PDF: " + err.message, 8000); }
    finally { $('dvSaved').textContent = ''; }
  }
  $('dvWide').onclick = () => { const w = $('docview').classList.toggle('wide'); requestAnimationFrame(fitTools); $('dvWide').textContent = w ? '⤡' : '⤢'; $('dvWide').title = w ? 'Half page' : 'Full page'; };

  // ---------- the toolbar ----------
  function buildTools() {
    const tb = (c, label, tip, cls = '') => `<button type="button" class="dt-b ${cls}" data-c="${c}" title="${tip}" aria-label="${tip}">${label}</button>`;
    const pop = (p, label, tip, cls = '') => `<button type="button" class="dt-b dt-drop ${cls}" data-pop="${p}" title="${tip}" aria-label="${tip}" aria-haspopup="true">${label}</button>`;
    $('dvTools').innerHTML = [
      tb('undo', DICON.undo, 'Undo · ⌘Z', 'dt-fold f7'), tb('redo', DICON.redo, 'Redo · ⇧⌘Z', 'dt-fold f8'), '<span class="dt-sep"></span>',
      pop('style', '<span class="dt-lbl" id="dtStyle">Body</span><i class="dt-car"></i>', 'Text style', 'dt-style'),
      pop('font', '<span class="dt-lbl" id="dtFont">DM Sans</span><i class="dt-car"></i>', 'Font', 'dt-font'),
      `<span class="dt-size" title="Text size"><button type="button" class="dt-b" data-c="smaller" aria-label="Smaller">−</button><input id="dtSize" inputmode="numeric" aria-label="Text size" value="16"><button type="button" class="dt-b" data-c="bigger" aria-label="Bigger">+</button></span>`,
      '<span class="dt-sep"></span>',
      tb('bold', '<b>B</b>', 'Bold · ⌘B', 'dt-t'), tb('italic', '<i>I</i>', 'Italic · ⌘I', 'dt-t'), tb('underline', '<u>U</u>', 'Underline · ⌘U', 'dt-t'), tb('strike', '<s>S</s>', 'Strikethrough · ⇧⌘S', 'dt-t'),
      pop('color', '<span class="dt-a">A<i id="dtColorBar"></i></span>', 'Text color'), pop('hl', DICON.hl, 'Highlight', 'dt-hl'),
      '<span class="dt-sep"></span>',
      pop('align', `<span id="dtAlign">${DICON.left}</span>`, 'Alignment', 'dt-fold f6'),
      tb('bullet', DICON.bullet, 'Bulleted list', 'dt-fold f5'), tb('ordered', DICON.ordered, 'Numbered list', 'dt-fold f4'), tb('task', DICON.task, 'Checklist', 'dt-fold f3'),
      '<span class="dt-sep"></span>',
      pop('link', DICON.link, 'Link · ⌘K', 'dt-fold f2'), tb('image', DICON.image, 'Add a picture', 'dt-fold f1'), pop('more', DICON.more, 'More: line spacing, tables, dividers…'),
      `<button type="button" class="dt-mochi dt-round" data-pop="mochi" data-tip="Mochi" aria-label="Ask Mochi about your selection">${DICON.mochi}</button>`,
    ].join('');
    bubbleEl.innerHTML = [tb('bold', '<b>B</b>', 'Bold', 'dt-t'), tb('italic', '<i>I</i>', 'Italic', 'dt-t'), tb('underline', '<u>U</u>', 'Underline', 'dt-t'), tb('strike', '<s>S</s>', 'Strikethrough', 'dt-t'),
      pop('color', '<span class="dt-a">A<i class="dtBar"></i></span>', 'Text color'), pop('hl', DICON.hl, 'Highlight', 'dt-hl'), pop('link', DICON.link, 'Link'),
      `<button type="button" class="dt-mochi" data-pop="mochi" title="Ask Mochi to rewrite this">${DICON.mochi}<span>Mochi</span></button>`].join('');
    [$('dvTools'), bubbleEl].forEach(bar => {
      bar.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });   // keep the text selected while using the bar
      bar.addEventListener('click', e => { const b = e.target.closest('[data-c], [data-pop]'); if (!b) return; if (b.dataset.pop) return showPop(b.dataset.pop, b); run(b.dataset.c); });
    });
    const sz = $('dtSize');
    sz.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); const v = clamp(parseInt(sz.value, 10) || 16, 6, 200); ed.chain().focus().setFontSize(v + 'px').run(); } if (e.key === 'Escape') { sz.blur(); ed.commands.focus(); } });
    sz.addEventListener('focus', () => sz.select());
    new ResizeObserver(() => requestAnimationFrame(fitTools)).observe($('docview'));
  }
  // keep the toolbar to one row: when space is tight, picture, link, lists and alignment fold into More (like Word and Google Docs)
  function fitTools() {
    const bar = $('dvTools'); if (!bar.offsetParent) return;
    const folds = [...bar.querySelectorAll('.dt-fold')].sort((a, b) => +a.className.match(/f(\d)/)[1] - +b.className.match(/f(\d)/)[1]);
    folds.forEach(b => b.hidden = false); bar.querySelectorAll('.dt-sep').forEach(x => x.hidden = false);
    const first = bar.firstElementChild, oneRow = () => bar.lastElementChild.offsetTop - first.offsetTop < 6;
    for (const b of folds) { if (oneRow()) break; b.hidden = true; tidySeps(bar); }
    tidySeps(bar);
  }
  function tidySeps(bar) {   // no separator at the edges or two in a row once buttons fold away
    let prev = null; [...bar.children].forEach(el => { if (el.hidden && !el.classList.contains('dt-sep')) return;
      if (el.classList.contains('dt-sep')) { el.hidden = !prev || prev.classList.contains('dt-sep'); if (!el.hidden) prev = el; } else prev = el; });
    const vis = [...bar.children].filter(el => !el.hidden); const last = vis[vis.length - 2]; if (last?.classList.contains('dt-sep')) last.hidden = true;
  }
  const docSize = () => { const s = parseFloat(ed.getAttributes('textStyle').fontSize); if (s) return s; return (BLOCKS.find(b => b[0] === blockOf()) || BLOCKS[3])[2]; };
  function blockOf() {
    if (!ed) return 'body'; if (ed.isActive('heading', { level: 1 })) return 'title'; if (ed.isActive('heading', { level: 2 })) return 'heading'; if (ed.isActive('heading', { level: 3 })) return 'sub';
    if (ed.isActive('codeBlock')) return 'code'; if (ed.isActive('blockquote')) return 'quote'; const k = ed.getAttributes('paragraph').kind; return k === 'lead' || k === 'caption' ? k : 'body';
  }
  function setBlock(k) {
    const c = ed.chain().focus();
    if (ed.isActive('blockquote') && k !== 'quote') c.lift('blockquote'); if (ed.isActive('codeBlock') && k !== 'code') c.setParagraph();
    ({ title: () => c.setHeading({ level: 1 }), heading: () => c.setHeading({ level: 2 }), sub: () => c.setHeading({ level: 3 }), body: () => c.setParagraph().updateAttributes('paragraph', { kind: null }),
      lead: () => c.setParagraph().updateAttributes('paragraph', { kind: 'lead' }), caption: () => c.setParagraph().updateAttributes('paragraph', { kind: 'caption' }),
      quote: () => ed.isActive('blockquote') ? c : c.setParagraph().setBlockquote(), code: () => c.setCodeBlock() })[k]();
    c.run();
  }
  function run(cmd) {
    if (!ed) return; const c = ed.chain().focus();
    const step = d => { const s = docSize(), i = SIZES.findIndex(x => x >= s); const n = d > 0 ? (SIZES.find(x => x > s) || s + 8) : ([...SIZES].reverse().find(x => x < s) || Math.max(6, s - 2)); return n + 'px'; };
    ({ undo: () => c.undo(), redo: () => c.redo(), bold: () => c.toggleBold(), italic: () => c.toggleItalic(), underline: () => c.toggleUnderline(), strike: () => c.toggleStrike(),
      bullet: () => c.toggleBulletList(), ordered: () => c.toggleOrderedList(), task: () => c.toggleTaskList(),
      smaller: () => c.setFontSize(step(-1)), bigger: () => c.setFontSize(step(1)), image: () => (imgPick.click(), c),
    })[cmd]?.().run();
  }
  // show what's true where the cursor is: style, font, size, bold…, alignment, colors
  function paintTools() {
    if (!ed || !docCard) return;
    const k = blockOf(), st = ed.getAttributes('textStyle');
    $('dtStyle').textContent = (BLOCKS.find(b => b[0] === k) || BLOCKS[3])[1];
    const f = fontName(st.fontFamily) || DOC_FONT; $('dtFont').textContent = f; $('dtFont').style.fontFamily = `"${f}", ${DOC_FONT}, system-ui`;
    if (document.activeElement !== $('dtSize')) $('dtSize').value = Math.round(docSize());
    const on = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strike', bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' };
    [$('dvTools'), bubbleEl].forEach(bar => bar.querySelectorAll('[data-c]').forEach(b => { const n = on[b.dataset.c]; if (n) b.classList.toggle('on', ed.isActive(n)); }));
    const al = ['center', 'right', 'justify'].find(a => ed.isActive({ textAlign: a })) || 'left'; $('dtAlign').innerHTML = DICON[al];
    const col = st.color || ''; [$('dtColorBar'), ...bubbleEl.querySelectorAll('.dtBar')].forEach(b => b.style.background = col || 'var(--ink)');
    const hl = ed.getAttributes('highlight').color || ''; [...$('dvTools').querySelectorAll('.dt-hl .bar'), ...bubbleEl.querySelectorAll('.dt-hl .bar')].forEach(b => b.style.stroke = hl || '#f4dc6c');
    $('dvTools').querySelector('[data-c="undo"]').disabled = !ed.can().undo(); $('dvTools').querySelector('[data-c="redo"]').disabled = !ed.can().redo();
  }

  // ---------- the drop-down menus ----------
  let popKind = null;
  function hidePop() { $('dvPop').hidden = true; popKind = null; document.querySelectorAll('.dt-b.open, .dt-mochi.open').forEach(b => b.classList.remove('open')); }
  function showPop(kind, btn) {
    if (popKind === kind && !$('dvPop').hidden) return hidePop();
    hidePop(); popKind = kind; btn.classList.add('open'); const p = $('dvPop'); p.className = 'dv-pop pop-' + kind;
    const swatches = (list, cur, attr) => list.map(h => `<button type="button" class="dp-sw ${cur && cur.toLowerCase() === h.toLowerCase() ? 'on' : ''}" ${attr}="${h}" style="--sw:${h}" title="${h.toUpperCase()}" aria-label="${h.toUpperCase()}"></button>`).join('');
    const boardCols = [...new Set(board.styles.colors.map(x => x.hex).concat(board.cards.filter(c => c.type === 'swatch').map(c => c.hex)))].slice(0, 14);
    if (kind === 'style') {
      const k = blockOf(); p.innerHTML = BLOCKS.map(([id, name]) => `<button type="button" class="dp-row dp-st st-${id} ${id === k ? 'on' : ''}" data-block="${id}">${name}</button>`).join('');
    } else if (kind === 'font') {
      const cur = fontName(ed.getAttributes('textStyle').fontFamily) || DOC_FONT;
      const onBoard = boardFonts();
      const row = f => `<button type="button" class="dp-row dp-font ${f === cur ? 'on' : ''}" data-font="${escH(f)}" style="font-family:'${escH(f)}', ${DOC_FONT}, system-ui">${escH(f)}${onMac(f) ? '' : '<small>Google Fonts</small>'}</button>`;
      p.innerHTML = `<input class="dp-search" id="dpFontQ" placeholder="Search fonts…" autocomplete="off" spellcheck="false">
        <div class="dp-scroll" id="dpFontList">${onBoard.length ? `<div class="dp-h">Used on this board</div>${onBoard.map(row).join('')}` : ''}<div class="dp-h">Suggested</div>${SUGGESTED_FONTS.filter(f => !onBoard.includes(f)).map(row).join('')}
        <div class="dp-h">On your Mac</div>${FONTS.filter(f => !SUGGESTED_FONTS.includes(f) && !onBoard.includes(f)).slice(0, 400).map(row).join('')}</div>`;
      SUGGESTED_FONTS.concat(onBoard).forEach(useFont);
      const q = $('dpFontQ'); q.addEventListener('keydown', e => e.stopPropagation());
      q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); p.querySelectorAll('.dp-font').forEach(b => b.hidden = !!v && !b.dataset.font.toLowerCase().includes(v)); p.querySelectorAll('.dp-h').forEach(h => h.hidden = !!v); });
      setTimeout(() => q.focus(), 30);
    } else if (kind === 'color' || kind === 'hl') {
      const isHl = kind === 'hl', cur = isHl ? ed.getAttributes('highlight').color : ed.getAttributes('textStyle').color;
      p.innerHTML = `${isHl ? `<button type="button" class="dp-row dp-pen${hlPen ? ' on' : ''}" data-hlpen="1">${hlPen ? 'Put the highlighter down' : 'Highlighter mode'}<small>${hlPen ? 'Esc' : 'pick it up, drag over words'}</small></button>` : ''}<button type="button" class="dp-row dp-none" data-${isHl ? 'hl' : 'tc'}="">${isHl ? 'No highlight' : 'Default color'}</button>
        ${boardCols.length ? `<div class="dp-h">Board colors</div><div class="dp-grid">${swatches(boardCols, cur, isHl ? 'data-hl' : 'data-tc')}</div>` : ''}
        <div class="dp-h">${isHl ? 'Highlighters' : 'Colors'}</div><div class="dp-grid">${swatches(isHl ? HIGHLIGHTS : TEXT_COLORS, cur, isHl ? 'data-hl' : 'data-tc')}</div>
        <button type="button" class="dp-row dp-any" data-any="${kind}">Any color…</button>`;
    } else if (kind === 'align') {
      p.innerHTML = `<div class="dp-icons">${['left', 'center', 'right', 'justify'].map(a => `<button type="button" class="dp-ic ${ed.isActive({ textAlign: a }) || (a === 'left' && !['center', 'right', 'justify'].some(x => ed.isActive({ textAlign: x }))) ? 'on' : ''}" data-align="${a}" title="${a[0].toUpperCase() + a.slice(1)}">${DICON[a]}</button>`).join('')}</div>`;
    } else if (kind === 'link') {
      const href = ed.getAttributes('link').href || '';
      p.innerHTML = `<form class="dp-link" id="dpLink"><input id="dpLinkIn" placeholder="Paste a link…" value="${escH(href)}" autocomplete="off" spellcheck="false"><button class="dp-go" type="submit">${href ? 'Update' : 'Add link'}</button></form>
        ${href ? `<div class="dp-linkacts"><button type="button" class="dp-row" data-link="open">Open ↗</button><button type="button" class="dp-row" data-link="remove">Remove link</button></div>` : ''}`;
      const inp = $('dpLinkIn'); inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { hidePop(); ed.commands.focus(); } });
      $('dpLink').onsubmit = e => { e.preventDefault(); let v = inp.value.trim(); if (!v) { ed.chain().focus().extendMarkRange('link').unsetLink().run(); return hidePop(); }
        if (!/^(https?:|mailto:|tel:)/i.test(v)) v = 'https://' + v;
        if (ed.state.selection.empty && !ed.isActive('link')) ed.chain().focus().insertContent(`<a href="${escH(v)}">${escH(v.replace(/^https?:\/\//, ''))}</a> `).run();
        else ed.chain().focus().extendMarkRange('link').setLink({ href: v }).run(); hidePop(); };
      setTimeout(() => inp.focus(), 30);
    } else if (kind === 'more') {
      const lh = ed.getAttributes('paragraph').lineHeight || ed.getAttributes('heading').lineHeight || '';
      const inTable = ed.isActive('table');
      const folded = [...$('dvTools').querySelectorAll('.dt-fold[hidden]')].map(b => b.dataset.c || b.dataset.pop);
      const foldIcons = folded.flatMap(k => k === 'align' ? ['left', 'center', 'right', 'justify'].map(a => `<button type="button" class="dp-ic ${ed.isActive({ textAlign: a }) ? 'on' : ''}" data-align="${a}" title="Align ${a}">${DICON[a]}</button>`)
        : k === 'link' ? [`<button type="button" class="dp-ic ${ed.isActive('link') ? 'on' : ''}" data-flink="1" title="Link">${DICON.link}</button>`]
        : [`<button type="button" class="dp-ic ${({ bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' })[k] && ed.isActive(({ bullet: 'bulletList', ordered: 'orderedList', task: 'taskList' })[k]) ? 'on' : ''}" data-c2="${k}" title="${({ bullet: 'Bulleted list', ordered: 'Numbered list', task: 'Checklist', image: 'Add a picture', undo: 'Undo', redo: 'Redo' })[k]}">${DICON[k]}</button>`]).join('');
      p.innerHTML = (foldIcons ? `<div class="dp-h">Tools</div><div class="dp-icons dp-fold">${foldIcons}</div>` : '') + `<div class="dp-h">Line spacing</div><div class="dp-seg">${[['1', 'Single'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', 'Double']].map(([v, l]) => `<button type="button" class="${String(lh) === v ? 'on' : ''}" data-lh="${v}">${l}</button>`).join('')}</div>
        <div class="dp-h">Insert</div>
        <button type="button" class="dp-row dp-irow" data-ins="table">${DICON.table}Table</button>
        <button type="button" class="dp-row dp-irow" data-ins="hr">${DICON.hr}Divider</button>
        <button type="button" class="dp-row dp-irow" data-ins="sup"><b class="dp-glyph">x²</b>Superscript</button>
        <button type="button" class="dp-row dp-irow" data-ins="sub"><b class="dp-glyph">x₂</b>Subscript</button>
        ${inTable ? `<div class="dp-h">Table</div><div class="dp-grid2">${[['rowAfter', '+ Row'], ['colAfter', '+ Column'], ['delRow', '− Row'], ['delCol', '− Column'], ['header', 'Header row'], ['delTable', 'Delete table']].map(([a, l]) => `<button type="button" data-tbl="${a}">${l}</button>`).join('')}</div>` : ''}
        <div class="dp-h"></div><button type="button" class="dp-row dp-irow" data-ins="clear">${DICON.clear}Clear formatting</button>`;
    } else if (kind === 'page') {
      const cur = pagePref();
      p.innerHTML = `<div class="dp-h">Page color</div>${[['auto', 'Match Mochiboard', 'Light or dark, with the app'], ['light', 'Light paper', 'Always white'], ['dark', 'Dark', 'Easy on the eyes at night']].map(([v, l, sub]) => `<button type="button" class="dp-row dp-page ${cur === v ? 'on' : ''}" data-page="${v}"><i class="pg-sw pg-${v}"></i><span>${l}<small>${sub}</small></span></button>`).join('')}
        <p class="dp-tip">Only how it looks while you write. Downloads are always regular light pages.</p>`;
    } else if (kind === 'export') {
      const paper = (() => { try { return localStorage.getItem('mochiboard:paper') || 'letter'; } catch (e) { return 'letter'; } })();
      p.innerHTML = `<div class="dp-h">Paper</div><div class="dp-seg">${[['letter', 'Letter'], ['a4', 'A4']].map(([v, l]) => `<button type="button" class="${paper === v ? 'on' : ''}" data-paper="${v}">${l}</button>`).join('')}</div>
        <button type="button" class="dp-row dp-pdf" data-pdf="1"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2.5h6l3.5 3.5v10.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M11.5 2.5V6H15"/></svg><span>Download PDF<small>Real pages, ready to send or print</small></span></button>
        <button type="button" class="dp-row dp-pdf dp-word" data-word="1"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2.5h6l3.5 3.5v10.5a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/><path d="M11.5 2.5V6H15M7 9.5l1.2 5 1.8-3.6 1.8 3.6 1.2-5"/></svg><span>Download Word<small>A .docx you can keep editing in Word or Pages</small></span></button>`;
    } else if (kind === 'mochi') {
      const has = !ed.state.selection.empty;
      p.innerHTML = has ? `<div class="dp-h">Mochi, make this…</div>${[['Shorter', 'Make it shorter and tighter'], ['Clearer', 'Make it clearer and easier to read'], ['Friendlier', 'Make it warmer and friendlier'], ['More confident', 'Make it more confident and direct'], ['More professional', 'Make it more polished and professional'], ['Fix spelling & grammar', 'Fix spelling, grammar and punctuation only. Change nothing else'], ['Into bullet points', 'Turn it into a short bulleted list']].map(([l, how]) => `<button type="button" class="dp-row" data-how="${escH(how)}">${l}</button>`).join('')}
        <form class="dp-link" id="dpAsk"><input id="dpAskIn" placeholder="Or tell Mochi what to do…" autocomplete="off"><button class="dp-go" type="submit">✦</button></form>`
        : `<p class="dp-tip">Select some words, then ask Mochi to rewrite them: shorter, friendlier, fixed up, or anything you like ✦</p>`;
      const ask = $('dpAskIn'); if (ask) { ask.addEventListener('keydown', e => e.stopPropagation()); $('dpAsk').onsubmit = e => { e.preventDefault(); const v = ask.value.trim(); if (v) rewrite(v); }; }
    }
    // place it under its button, inside the doc panel
    p.hidden = false; const dv = $('docview').getBoundingClientRect(), r = btn.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight; let x = r.left - dv.left, y = r.bottom - dv.top + 8;
    if (y + h > dv.height - 10) y = Math.max(10, r.top - dv.top - h - 8);
    p.style.left = clamp(x, 10, dv.width - w - 10) + 'px'; p.style.top = y + 'px';
  }
  const p_seg = b => b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  $('dvPop').addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
  $('dvPop').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.type === 'submit') return; const d = b.dataset, c = ed.chain().focus();
    if (d.block) { setBlock(d.block); return hidePop(); }
    if (d.font != null) { useFont(d.font); (d.font === DOC_FONT ? c.unsetFontFamily() : c.setFontFamily(`"${d.font}"`)).run(); return hidePop(); }
    if (d.tc != null) { (d.tc ? c.setColor(d.tc) : c.unsetColor()).run(); return hidePop(); }
    if (d.hlpen) { hidePop(); return hlPen ? hlPenOff() : hlPenOn(ed.getAttributes('highlight').color || HIGHLIGHTS[0]); }
    if (d.hl != null && hlPen && d.hl) { hlPenOn(d.hl); return hidePop(); }   // holding the highlighter: a swatch swaps its ink
    if (d.hl != null) { (d.hl ? c.setHighlight({ color: d.hl }) : c.unsetHighlight()).run(); return hidePop(); }
    if (d.any) { const isHl = d.any === 'hl', r = b.getBoundingClientRect(), sel = { from: ed.state.selection.from, to: ed.state.selection.to }; hidePop();
      openColor({ tint: true, boardColors: true, title: isHl ? 'Highlight' : 'Text color', hex: (isHl ? ed.getAttributes('highlight').color : ed.getAttributes('textStyle').color) || (isHl ? '#fff1a8' : '#e2649a'), presets: isHl ? HIGHLIGHTS : TEXT_COLORS, at: { x: r.left, y: r.bottom + 8 },
        apply: hex => { const k = ed.chain().setTextSelection(sel); (isHl ? k.setHighlight({ color: hex }) : k.setColor(hex)).run(); }, reset: () => { const k = ed.chain().setTextSelection(sel); (isHl ? k.unsetHighlight() : k.unsetColor()).run(); } }); return; }
    if (d.align) { c.setTextAlign(d.align).run(); return hidePop(); }
    if (d.c2) { hidePop(); return run(d.c2); }
    if (d.flink) { const more = $('dvTools').querySelector('[data-pop="more"]'); hidePop(); return showPop('link', more); }
    if (d.link === 'open') { MB.openURL(ed.getAttributes('link').href); return hidePop(); }
    if (d.link === 'remove') { c.extendMarkRange('link').unsetLink().run(); return hidePop(); }
    if (d.lh) { (ed.getAttributes('paragraph').lineHeight === d.lh || ed.getAttributes('heading').lineHeight === d.lh ? c.unsetLineHeight() : c.setLineHeight(d.lh)).run(); return hidePop(); }
    if (d.ins) { ({ table: () => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }), hr: () => c.setHorizontalRule(), sup: () => c.toggleSuperscript(), sub: () => c.toggleSubscript(), clear: () => c.unsetAllMarks().clearNodes() })[d.ins]().run(); return hidePop(); }
    if (d.tbl) { ({ rowAfter: () => c.addRowAfter(), colAfter: () => c.addColumnAfter(), delRow: () => c.deleteRow(), delCol: () => c.deleteColumn(), header: () => c.toggleHeaderRow(), delTable: () => c.deleteTable() })[d.tbl]().run(); return hidePop(); }
    if (d.page) { try { localStorage.setItem('mochiboard:docPage', d.page); } catch (er) {} applyDocPage(); return hidePop(); }
    if (d.paper) { try { localStorage.setItem('mochiboard:paper', d.paper); } catch (er) {} p_seg(b); return; }
    if (d.pdf) { hidePop(); return downloadPDF(); }
    if (d.word) { hidePop(); return downloadWord(); }
    if (d.how) rewrite(d.how);
  });
  addEventListener('pointerdown', e => { if (!$('dvPop').hidden && !e.target.closest('#dvPop, .dt-drop, .dt-mochi, #cpop')) hidePop(); }, true);
  $('docview').addEventListener('keydown', e => { if (e.key === 'Escape' && !$('dvPop').hidden) { e.stopPropagation(); hidePop(); ed?.commands.focus(); } }, true);

  // ---------- Mochi rewrites the words you selected ----------
  async function rewrite(how) {
    hidePop(); if (!ed) return; const { from, to } = ed.state.selection; if (from === to) return;
    const text = ed.state.doc.textBetween(from, to, '\n'), size = ed.state.doc.content.size;
    const around = ed.state.doc.textBetween(Math.max(0, from - 700), Math.min(size, to + 700), '\n');
    $('docview').classList.add('mochi-busy'); goo.think(true); $('dvSaved').textContent = 'Mochi is rewriting…';
    try {
      const out = (await MB.rewrite(text, how, docCard?.text || '', around) || '').trim(); if (!out) throw new Error('Mochi came back empty-handed');
      const multi = /\n/.test(out);
      ed.chain().focus().insertContentAt({ from, to }, multi ? mdToHTML(out) : escH(out)).run();
      const end = ed.state.selection.from; ed.commands.setTextSelection({ from, to: end });
      say('Rewritten ✦ Undo brings back your words.', 6000, [{ label: 'Undo', run: () => ed.chain().focus().undo().run() }]);
    } catch (err) {
      const m = err.message || '';
      if (/Claude Code/.test(m)) say("I need Claude Code to rewrite things. It's a one-time setup with your Claude account.", 0, [{ label: 'Show me how to connect', run: () => MB.openURL(GUIDE) }]);
      else if (SIGNIN.test(m)) say("Claude Code is here, but it isn't signed in yet. Open Terminal, type claude, and sign in.", 0, [{ label: 'Show me how', run: () => MB.openURL(GUIDE) }]);
      else say(MB.native ? "Hmm, I couldn't rewrite that: " + m : 'Mochi rewrites text with Claude in the Mac app ✦', 8000);
    } finally { $('docview').classList.remove('mochi-busy'); goo.think(false); $('dvSaved').textContent = ''; }
  }

  // ---------- dropping cards into a doc: they arrive as real content (a checklist stays a checklist) ----------
  const WORDY = ['note', 'todo', 'title', 'link', 'swatch', 'doc', 'shape', 'audio', 'spotify', 'table'];
  function cardWords(c) {
    if (c.type === 'note') return [c.name, c.text].filter(x => (x || '').trim()).join('\n');
    if (c.type === 'todo') return [(c.text || '').trim(), ...(c.items || []).map(i => (i.done ? '☑ ' : '☐ ') + i.t)].filter(Boolean).join('\n');
    if (c.type === 'link') return [c.title, c.url].filter(Boolean).join('\n');
    if (c.type === 'swatch') return `${c.label || ''} ${c.hex.toUpperCase()}`.trim();
    if (c.type === 'audio') return [c.title, c.text].filter(Boolean).join('\n');
    if (c.type === 'spotify') return [c.title, c.desc].filter(Boolean).join(' · ');
    if (c.type === 'doc') return [c.text, c.body].filter(x => (x || '').trim()).join('\n');
    if (c.type === 'table') return (c.rows || []).map(r => r.join('\t')).join('\n');
    return c.text || '';
  }
  function cardHTML(c) {
    if (c.type === 'note') return (c.name ? `<p><strong>${escH(c.name)}</strong></p>` : '') + mdToHTML(c.text);
    if (c.type === 'todo') return (c.text ? `<p><strong>${escH(c.text)}</strong></p>` : '') + `<ul data-type="taskList">${(c.items || []).map(i => `<li data-type="taskItem" data-checked="${!!i.done}"><p>${escH(i.t)}</p></li>`).join('')}</ul>`;
    if (c.type === 'link') return `<p><a href="${escH(c.url)}">${escH(c.title || c.url)}</a></p>`;
    if (c.type === 'swatch') return `<p><span style="color: ${c.hex}">■</span> ${escH(c.label || '')} <code>${c.hex.toUpperCase()}</code></p>`;
    if (c.type === 'title') return `<h2>${escH(c.text)}</h2>`;
    if (c.type === 'doc') return (c.text ? `<h2>${escH(c.text)}</h2>` : '') + docHTML(c);
    if (c.type === 'table') return `<table><tbody>${(c.rows || []).map((r, i) => `<tr>${r.map(v => i === 0 && c.head !== false ? `<th><p>${escH(v)}</p></th>` : `<td><p>${escH(v)}</p></td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return mdToHTML(cardWords(c));
  }
  // the open doc page, or a doc card on the board, under the pointer (only for cards that have words)
  function docTarget(e, w, moving) {
    const cs = moving.map(m => m.c || m); if (!cs.length || !cs.every(c => WORDY.includes(c.type))) return null;
    if (docCard && !cs.includes(docCard)) { const r = $('docview').getBoundingClientRect(); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) return 'page'; }
    return [...board.cards].reverse().find(c => c.type === 'doc' && !cs.includes(c) && w.x > c.x && w.x < c.x + c.w && w.y > c.y && w.y < c.y + c.h) || null;
  }
  function dropIntoDoc(t, cs, e) {
    const doc = t === 'page' ? docCard : t, html = cs.map(cardHTML).join(''), before = { body: doc.body, doc: doc.doc };
    if (t === 'page' && ed) {
      // right where you let go on the page
      const at = ed.view.posAtCoords({ left: e.clientX, top: e.clientY }); const $p = at && ed.state.doc.resolve(at.pos);
      const pos = $p ? ($p.depth ? $p.after(1) : at.pos) : ed.state.doc.content.size;
      ed.chain().focus().insertContentAt(pos, html).run(); syncDoc();
    } else { doc.doc = MBEditor.generateJSON(docHTML(doc) + html, MBEditor.extensions()); doc.body = [doc.body, ...cs.map(cardWords)].filter(x => (x || '').trim()).join('\n\n'); }
    selectOnly(cs.map(c => c.id)); renderCard(doc); renderWires(); save();
    say(`Copied ${cs.length === 1 ? 'that' : cs.length + ' cards'} into “${doc.text || 'Untitled'}” ✦`, 6000, [{ label: 'Undo', run: () => {
      if (t === 'page' && ed && docCard === doc) { ed.commands.undo(); syncDoc(); } else { doc.body = before.body; doc.doc = before.doc; if (docCard === doc && ed) ed.commands.setContent(docHTML(doc), false); }
      renderCard(doc); save(); } }]);
  }

  // ---------- canvases: a board inside this board, like a folder you can open ----------
  async function openCanvas(c) {
    if (!c.board) { const child = newBoard(c.text || 'Untitled canvas'); child.parent = board.id; child.folder = board.folder || null; c.board = child.id; await MB.save(child); }
    board.view = view; await MB.save(board); miniCache.delete(c.board); await openBoard(c.board); fit(board.cards);
  }
  async function renameChild(c) { if (!c.board) return; const b = await MB.load(c.board); if (b && c.text && b.name !== c.text) { b.name = c.text; await MB.save(b); refreshBoards(); } }

  // ---------- colors name themselves (until you name one yourself) ----------
  const NAMED = { 'Black': '#000000', 'Charcoal': '#36454f', 'Slate': '#708090', 'Gray': '#808080', 'Silver': '#c0c0c0', 'Cloud': '#ecebef', 'White': '#ffffff', 'Ivory': '#fffff0', 'Cream': '#fff5c8', 'Butter': '#f3d96a', 'Lemon': '#fff44f', 'Gold': '#ffd700', 'Mustard': '#e1ad01', 'Amber': '#ffbf00', 'Tangerine': '#f28500', 'Orange': '#ff8c00', 'Peach': '#ffcba4', 'Apricot': '#fbceb1', 'Coral': '#ff7f50', 'Salmon': '#fa8072', 'Tomato': '#ff6347', 'Red': '#e0303a', 'Cherry': '#c2185b', 'Crimson': '#dc143c', 'Brick': '#b22222', 'Maroon': '#800000', 'Wine': '#722f37', 'Rose': '#ff66a3', 'Bubblegum': '#ff9ec4', 'Blush': '#ffd1dc', 'Pink': '#ffc0cb', 'Hot Pink': '#ff69b4', 'Magenta': '#ff00ff', 'Fuchsia': '#c154c1', 'Orchid': '#da70d6', 'Lilac': '#c8a2c8', 'Lavender': '#e6e6fa', 'Periwinkle': '#ccccff', 'Violet': '#8f00ff', 'Purple': '#800080', 'Plum': '#8e4585', 'Grape': '#6f2da8', 'Indigo': '#4b0082', 'Navy': '#000080', 'Midnight': '#191970', 'Royal Blue': '#4169e1', 'Cobalt': '#0047ab', 'Blue': '#1e6fff', 'Steel Blue': '#4682b4', 'Cornflower': '#6495ed', 'Sky': '#87ceeb', 'Baby Blue': '#bfdfff', 'Ice': '#dcedff', 'Powder': '#b0e0e6', 'Teal': '#008080', 'Turquoise': '#40e0d0', 'Aqua': '#00e5e5', 'Mint': '#98ff98', 'Seafoam': '#9fe2bf', 'Sage': '#9caf88', 'Pistachio': '#93c572', 'Lime': '#a4de02', 'Green': '#2e9e4f', 'Emerald': '#50c878', 'Forest': '#228b22', 'Olive': '#808000', 'Khaki': '#c3b091', 'Sand': '#e2c290', 'Tan': '#d2b48c', 'Camel': '#c19a6b', 'Caramel': '#af6f09', 'Brown': '#8b4513', 'Chocolate': '#5c3317', 'Espresso': '#3b2219' };
  function colorName(hex) {
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), [r, g, b] = rgb(hex); let best = 'Color', d = Infinity;
    for (const [n, h] of Object.entries(NAMED)) { const [r2, g2, b2] = rgb(h), rm = (r + r2) / 2, dd = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2; if (dd < d) { d = dd; best = n; } }
    return best;
  }

  // ---------- the dock swaps to tools for whatever is selected ----------
  const FILLABLE = ['note', 'todo', 'link'];
  const ARRANGE_IC = {"left": "<rect width=\"9\" height=\"6\" x=\"6\" y=\"14\" rx=\"2\" /><rect width=\"16\" height=\"6\" x=\"6\" y=\"4\" rx=\"2\" /><path d=\"M2 2v20\" />", "hcenter": "<path d=\"M12 2v20\" /><path d=\"M8 10H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h4\" /><path d=\"M16 10h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4\" /><path d=\"M8 20H7a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2h1\" /><path d=\"M16 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1\" />", "right": "<rect width=\"16\" height=\"6\" x=\"2\" y=\"4\" rx=\"2\" /><rect width=\"9\" height=\"6\" x=\"9\" y=\"14\" rx=\"2\" /><path d=\"M22 22V2\" />", "top": "<rect width=\"6\" height=\"16\" x=\"4\" y=\"6\" rx=\"2\" /><rect width=\"6\" height=\"9\" x=\"14\" y=\"6\" rx=\"2\" /><path d=\"M22 2H2\" />", "vcenter": "<path d=\"M2 12h20\" /><path d=\"M10 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4\" /><path d=\"M10 8V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4\" /><path d=\"M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1\" /><path d=\"M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1\" />", "bottom": "<rect width=\"6\" height=\"16\" x=\"4\" y=\"2\" rx=\"2\" /><rect width=\"6\" height=\"9\" x=\"14\" y=\"9\" rx=\"2\" /><path d=\"M22 22H2\" />", "dh": "<rect width=\"6\" height=\"14\" x=\"4\" y=\"5\" rx=\"2\" /><rect width=\"6\" height=\"10\" x=\"14\" y=\"7\" rx=\"2\" /><path d=\"M17 22v-5\" /><path d=\"M17 7V2\" /><path d=\"M7 22v-3\" /><path d=\"M7 5V2\" />", "dv": "<path d=\"M22 17h-3\" /><path d=\"M22 7h-5\" /><path d=\"M5 17H2\" /><path d=\"M7 7H2\" /><rect x=\"5\" y=\"14\" width=\"14\" height=\"6\" rx=\"2\" /><rect x=\"7\" y=\"4\" width=\"10\" height=\"6\" rx=\"2\" />"};
  const ALIGN_IC = {"left": "<path d=\"M15 12H3\" /><path d=\"M17 18H3\" /><path d=\"M21 6H3\" />", "center": "<path d=\"M17 12H7\" /><path d=\"M19 18H5\" /><path d=\"M21 6H3\" />", "right": "<path d=\"M21 12H9\" /><path d=\"M21 18H7\" /><path d=\"M21 6H3\" />"};
  // each card's normal text size in px, so a size can be shown and typed as real pixels
  let fsMark = false, skMark = false, spMark = false, sqMark = false;   // one undo step per visit to the size / stroke dropdown
  const FS_BASE = { note: 15, title: 44, todo: 14, shape: 15, coll: 15, table: 14 };
  const fsMul = c => typeof c.fs === 'number' ? c.fs : FS[c.fs] || 1, fsPx = c => Math.round((FS_BASE[c.type] || 15) * fsMul(c));
  function fitNote(c) { if (c.type !== 'note' || parentOf(c.id)) return; renderCard(c); const el = cardsEl.querySelector(`[data-id="${c.id}"]`), b2 = el.querySelector('.body'); b2.style.height = 'auto'; c.h = Math.max(80, b2.offsetHeight); b2.style.height = ''; renderCard(c); }
  function setFsPx(px) { px = Math.max(6, Math.min(400, Math.round(+px || 0))); if (!px) return;
    selCards().filter(c => SIZED.includes(c.type)).forEach(c => { const m = px / (FS_BASE[c.type] || 15), hit = Object.keys(FS).find(k => Math.abs(FS[k] - m) < .001);
      if (hit === 'm') delete c.fs; else c.fs = hit || +m.toFixed(6); renderCard(c); fitNote(c); });
    const t = document.querySelector('#selbar [data-pop="size"] b'); if (t) t.textContent = px;   // the bar stays put while the dropdown is open, so update its label by hand
    document.querySelectorAll('#selbar [data-fs]').forEach(b => b.classList.toggle('on', selCards().filter(c => SIZED.includes(c.type)).every(c => (c.fs || 'm') === b.dataset.fs)));
    renderWires(); save(); }
  // line height (a multiple of the text size) and letter spacing (% of the text size); each kind of card has its own normal
  const LH0 = { note: 1.45, title: 1, todo: 1.35, shape: 1.3, coll: 1.2 }, LS0 = { title: -4 };
  const lhOf = c => c.lh ?? LH0[c.type] ?? 1.4, lsOf = c => c.ls ?? LS0[c.type] ?? 0;
  const SPACING_IC = "<path d=\"M15 12h6\" /><path d=\"M15 6h6\" /><path d=\"m3 13 3.553-7.724a.5.5 0 0 1 .894 0L11 13\" /><path d=\"M3 18h18\" /><path d=\"M4 11h6\" />";
  function setSpacing(kind, v) {
    selCards().filter(c => SIZED.includes(c.type)).forEach(c => {
      const def = kind === 'lh' ? (LH0[c.type] ?? 1.4) : (LS0[c.type] ?? 0), n = v === 'normal' ? def : +v;
      if (!Number.isFinite(n)) return; if (Math.abs(n - def) < 1e-6) delete c[kind]; else c[kind] = kind === 'lh' ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10;
      renderCard(c); fitText(c); if (c.type === 'title') { const el = cardsEl.querySelector(`[data-id="${c.id}"]`); if (el) c.h = el.offsetHeight; } });
    renderWires(); save();
  }
  const FS = { s: .8, m: 1, l: 1.4, xl: 2 }, SIZED = ['note', 'todo', 'title', 'shape', 'coll', 'table'];
  function selCards() { return [...sel].map(byId).filter(Boolean); }
  const I = d => `<svg viewBox="0 0 ${d.includes('data-l24') ? 24 : 20} ${d.includes('data-l24') ? 24 : 20}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    tag: I('<g data-l24="1"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></g>'),
    edit: I('<g data-l24="1"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></g>'),
    mochi: I('<g data-l24="1"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></g>'),
    del: I('<g data-l24="1"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></g>'),
    head: I('<g data-l24="1"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /></g>'),
    caption: I('<g data-l24="1"><rect width="18" height="14" x="3" y="5" rx="2" ry="2" /><path d="M7 15h4M15 15h2M7 11h2M13 11h4" /></g>'),
    color: I('<g data-l24="1"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></g>'),
    name: I('<g data-l24="1"><path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" /><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" /><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" /><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" /><path d="M9 7v10" /></g>'),
    hex: I('<g data-l24="1"><line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" /></g>'),
    frame: I('<g data-l24="1"><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" stroke-dasharray="2 2"/></g>'),
    nobg: I('<g data-l24="1"><circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20.5a6.5 6.5 0 0 1 13 0"/><path d="M3.5 3.5l1.6 1.6M20.5 3.5l-1.6 1.6M2.5 12h2.2M19.3 12h2.2M3.5 20.5l1.6-1.6" stroke-dasharray="1.5 2.2"/></g>'),
    crop: I('<g data-l24="1"><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></g>'),
    open: I('<g data-l24="1"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></g>'),
    link: I('<g data-l24="1"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></g>'),
  };
  // fonts for board text: the same list as docs (fonts on this board first, then suggestions, then everything on this Mac)
  // every font this board uses: picked for notes and titles, wireframe text, font cards, and fonts set inside docs (most used first)
  function boardFonts() {
    const n = new Map(), add = f => { f = String(f || '').replace(/^["']|["']$/g, '').trim(); if (f && !/^(system-ui|sans-serif|serif|monospace|inherit|-apple-system)$/i.test(f)) n.set(f, (n.get(f) || 0) + 1); };
    board.cards.forEach(c => { if (c.font) add(c.font); if (c.type === 'doc' && c.doc) for (const m of JSON.stringify(c.doc).matchAll(/"fontFamily":"([^"]+)"/g)) add(m[1].split(',')[0]); });
    return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }
  function boardFontPop(btn, list) {
    let p = $('fontPop'); if (p && !p.hidden && p.dataset.for === list.map(c => c.id).join()) { p.hidden = true; return; }
    if (!p) { p = document.createElement('div'); p.id = 'fontPop'; p.className = 'dv-pop pop-font board-font'; document.body.appendChild(p);
      ['pointerdown', 'mousedown', 'wheel', 'dblclick'].forEach(t => p.addEventListener(t, e => e.stopPropagation(), { passive: true })); }
    p.dataset.for = list.map(c => c.id).join();
    const cur = list.every(c => (c.font || '') === (list[0].font || '')) ? (list[0].font || '') : null;
    const onBoard = boardFonts();
    const row = f => `<button type="button" class="dp-row dp-font ${f === cur ? 'on' : ''}" data-bfont="${escH(f)}" style="font-family:'${escH(f)}', ${DOC_FONT}, system-ui">${escH(f)}${onMac(f) ? '' : '<small>Google Fonts</small>'}</button>`;
    p.innerHTML = `<input class="dp-search" placeholder="Search fonts…" autocomplete="off" spellcheck="false">
      <div class="dp-scroll"><button type="button" class="dp-row dp-font ${cur === '' ? 'on' : ''}" data-bfont="">Default font<small>Mochiboard’s own</small></button>
      ${onBoard.length ? `<div class="dp-h">Used on this board</div>${onBoard.map(row).join('')}` : ''}<div class="dp-h">Suggested</div>${SUGGESTED_FONTS.filter(f => !onBoard.includes(f)).map(row).join('')}
      <div class="dp-h">On your Mac</div>${FONTS.filter(f => !SUGGESTED_FONTS.includes(f) && !onBoard.includes(f)).slice(0, 400).map(row).join('')}</div>`;
    SUGGESTED_FONTS.concat(onBoard).forEach(useFont);
    const r = btn.getBoundingClientRect(); p.hidden = false; p.style.position = 'fixed'; p.style.width = '260px';
    p.style.left = Math.max(10, Math.min(innerWidth - 270, r.left + r.width / 2 - 130)) + 'px';
    const above = r.top > innerHeight / 2; p.style.top = ''; p.style.bottom = '';
    if (above) p.style.bottom = (innerHeight - r.top + 8) + 'px'; else p.style.top = (r.bottom + 8) + 'px';
    const els = list.map(c => cardsEl.querySelector(`[data-id="${c.id}"]`)).filter(Boolean);
    const preview = f => els.forEach((el, i) => { const c = list[i]; const v = f === undefined ? c.font : f;
      el.classList.toggle('has-font', !!v); if (v) { useFont(v); el.style.setProperty('--cf', `"${v.replace(/"/g, '')}"`); } else el.style.removeProperty('--cf'); });
    const q = p.querySelector('.dp-search'); q.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { preview(); p.hidden = true; } if (e.key === 'Enter') p.querySelector('.dp-font:not([hidden])')?.click(); });
    q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); p.querySelectorAll('.dp-font').forEach(b => b.hidden = !!v && !b.dataset.bfont.toLowerCase().includes(v)); p.querySelectorAll('.dp-h').forEach(h => h.hidden = !!v); });
    p.onmouseover = e => { const b = e.target.closest('[data-bfont]'); if (b) preview(b.dataset.bfont); };
    p.onmouseleave = () => preview();
    p.onclick = e => { const b = e.target.closest('[data-bfont]'); if (!b) return; const f = b.dataset.bfont;
      remember(); list.forEach(c => { if (f) c.font = f; else delete c.font; renderCard(c); }); p.hidden = true; $('selbar').dataset.key = ''; selectOnly(list.map(c => c.id)); save(); };
    setTimeout(() => q.focus(), 30);
  }
  document.addEventListener('pointerdown', e => { const p = $('fontPop'); if (p && !p.hidden && !e.target.closest('#fontPop, [data-sbfont]')) p.hidden = true; }, true);
  // when the bar runs out of room (a narrow window, or bigger icons), groups move into the ··· menu, least important first
  function foldSelbar(bar) {
    const body = bar.querySelector('.sb-morebody'), wrap = bar.querySelector('[data-popw="more"]'); if (!body) return;
    const room = () => { const s = stage.getBoundingClientRect(), m = $('mPill')?.getBoundingClientRect(); return Math.max(260, (m && m.left > s.left ? m.left - 16 : s.right - 16) - Math.max(s.left + 16, s.left + (document.body.classList.contains('phone') ? 8 : 280))); };
    const groups = [...bar.querySelectorAll('.sb-g')].filter(g => +g.dataset.fold > 0).sort((a, b) => b.dataset.fold - a.dataset.fold);   // 0 = never folds
    for (const g of groups) { if (bar.scrollWidth <= room()) break; g.querySelectorAll(':scope > .sb-sep').forEach(x => x.remove()); body.appendChild(g); }
    const empty = !body.children.length; wrap.hidden = empty; bar.querySelector('.sb-moresep').hidden = empty;
  }
  // pixel-snap: nudge each toolbar icon by the fraction of a screen pixel it sits off-grid, so its lines stay razor sharp
  function snapIcons(root) {
    const d = devicePixelRatio || 1;
    root.querySelectorAll('svg').forEach(svg => { svg.style.translate = ''; const r = svg.getBoundingClientRect(); if (!r.width) return;
      const fx = (Math.round(r.left * d) - r.left * d) / d, fy = (Math.round(r.top * d) - r.top * d) / d; if (Math.abs(fx) > .01 || Math.abs(fy) > .01) svg.style.translate = `${fx}px ${fy}px`; });
  }
  const snapSoon = () => requestAnimationFrame(() => { snapIcons($('tools')); snapIcons($('selbar')); });
  addEventListener('resize', snapSoon); setTimeout(snapSoon, 300);
  function placeSelbar() {
    const bar = $('selbar'), dock = $('dock'), cs = selCards(), lw = selWire && linkById(selWire);
    if (lw && !homeAt) { dock.classList.add('ctx'); bar.classList.add('on'); const key = 'w' + lw.id + lw.bend + lw.dash + lw.arrow + lw.head + lw.tail + lw.color + !!(lw.pa || lw.pb) + lw.route + lw.label + selWires.size; if (bar.dataset.key === key) return; bar.dataset.key = key;
      const tb = (a, label, on, tip) => `<button class="sb-ic ${on ? 'on' : ''}" data-wb="${a}" title="${label}" aria-label="${label}: ${tip}">${WICON[a]}</button>`;
      bar.innerHTML = `<span class="sb-label">${selWires.size > 1 ? 'Connectors · ' + selWires.size : 'Connector'}</span>` + tb('curve', 'Curved', lw.bend !== 0 && lw.route !== 'elbow', 'Curved line (drag the middle dot to bend it)') + tb('straight', 'Straight', lw.bend === 0 && lw.route !== 'elbow', 'Straight line') + tb('elbow', 'Right angle', lw.route === 'elbow', 'Right-angle line, like a flowchart')
        + `<span class="sb-sep"></span>` + tb('dash', 'Dashed', !!lw.dash, 'Dashed line') + wireEndsPop(lw) + wireColorPop(lw) + tb('flip', 'Flip', false, 'Swap which end has the arrow') + (selWires.size > 1 ? '' : tb('label', lw.label ? 'Edit label' : 'Label', false, 'Words on the line (or double-click the line)')) + (lw.pa || lw.pb ? `<span class="sb-sep"></span>` + tb('auto', 'Auto ends', false, 'Let the line choose where it meets each card again') : '') + `<span class="sb-sep"></span><button class="sb-ic" data-wb="del" title="Delete">${ICON.del}</button>`;
      return; }
    // hidden only while a drag is really happening, or a wheel that isn't from this bar is really on screen (left-over state never hides the bar)
    const wheelUp = $('cpop').classList.contains('on') && $('cpop').classList.contains('tint') && !$('cpop').classList.contains('from-bar') && $('cpop').offsetParent && $('settings').classList.contains('on');
    const show = cs.length && !homeAt && !(drag && drag.mode === 'move' && drag.moved) && !wheelUp;   // a wheel opened from this bar keeps the bar   // a color card's own bar shows right away, next to its wheel
    dock.classList.toggle('ctx', !!show); bar.classList.toggle('on', !!show); if (!show) { closeSbPops(); bar.dataset.ids = ''; if (bar.dataset.key !== '') { bar.dataset.key = ''; renderDesign(); } return; }
    const key = Math.round(innerWidth / 30) + cs.map(c => c.id + c.tcase + c.tc + (c.type === 'text' ? c.color : '') + c.fill + c.squig + c.align + c.lh + c.ls + c.stroke + c.sw + c.sdash + c.dl + c.dg + c.radius + c.fill + Math.round(c.r || 0) + !!c.tilted + c.color + c.head + c.tagText + c.hideName + c.hideHex + c.fill + c.url + c.fs + c.font + c.bold + c.italic + c.under + c.strike + !!c.cropEdit + !!c.src + c.group).join();
    // never rebuild under an open dropdown for the SAME things (it would yank the slider out from under you); a new selection always gets a fresh bar
    const ids = cs.map(c => c.id).join(); if (bar.dataset.ids !== ids) { closeSbPops(); bar.dataset.ids = ids; }
    if (bar.dataset.key === key || bar.querySelector('.sb-popw.open')) { syncDesign(); return; } bar.dataset.key = key; renderDesign();   // never rebuild under an open dropdown (it would yank the slider out from under you)
    const one = cs.length === 1 ? cs[0] : null, btn = (a, icon, tip, on) => `<button class="sb-ic ${on ? 'on' : ''}" data-sb="${a}" title="${tip}">${ICON[icon]}</button>`;
    // a little dropdown inside the bar (its options use the same buttons, so they work exactly like before)
    const pop = (id, trig, body, tip) => `<span class="sb-popw" data-popw="${id}"><button class="sb-poptrig" data-pop="${id}" title="${tip}">${trig}</button><div class="sb-pop sb-pop-${id}">${body}</div></span>`;
    // a group that folds into the ··· menu when the bar runs out of room (higher numbers fold first)
    const G = (fold, html) => `<span class="sb-g" data-fold="${fold}">${html}</span>`;
    const CARET = '<svg class="sb-caret" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3"/></svg>';
    const colorPop = (cur, dots) => pop('color', `<i class="sb-cur" style="background:${cur}"></i>${CARET}`, `<div class="sb-dots">${dots}</div>`, 'Color');
    let more = '';
    let h = `<span class="sb-label">${one ? ({ section: 'Section', file: 'File', folder: 'Folder', note: 'Note', todo: 'Checklist', table: 'Table', title: 'Title', image: 'Image', link: 'Link', swatch: 'Color', coll: 'Collection', doc: 'Doc', canvas: 'Canvas', shape: 'Shape', path: 'Pen shape', stamp: 'Stamp', audio: 'Voice memo', video: 'Video', spotify: 'Spotify', ink: 'Drawing', frame: 'Screen', box: 'Box', text: 'Text', font: 'Font' }[one.type] || 'Card') : cs.length + ' selected'}</span>`;
    if (cs.length > 1) { const A = [['left', 'Align left edges'], ['hcenter', 'Align centers'], ['right', 'Align right edges'], ['top', 'Align tops'], ['vcenter', 'Align middles'], ['bottom', 'Align bottoms']];
      if (cs.length > 2) A.push(['dh', 'Space evenly across'], ['dv', 'Space evenly down']);
      h += G(0, `<div class="sb-sizes sb-style sb-arrange">${A.map(([k, t], i) => (i === 3 || i === 6 ? '<i class="sb-gap"></i>' : '') + `<button data-arr="${k}" title="${t}"><svg viewBox="0 0 24 24">${ARRANGE_IC[k]}</svg></button>`).join('')}</div>`); }
    const fill = cs.filter(c => FILLABLE.includes(c.type));
    if (one?.type === 'coll') h += G(2, colorPop(COLL[one.color]?.[0] || '#fff', Object.keys(COLL).map(n => `<button data-cc="${n}" title="${n}" style="background:${COLL[n][0]}" class="${one.color === n ? 'on' : ''}"></button>`).join('')) + `<span class="sb-sep"></span>`) + btn('head', 'head', one.head === false ? 'Show the header' : 'Hide the header', one.head !== false);
    else if (fill.length) h += G(2, colorPop(fill.every(c => c.color === fill[0].color) ? COLORS[fill[0].color] || '#fff' : 'conic-gradient(#ffe0ec 0 25%, #fff5c8 0 50%, #dcf5e7 0 75%, #dcedff 0)', COLOR_NAMES.map(n => `<button data-c="${n}" title="${n}" style="background:${COLORS[n]}" class="${fill.every(c => c.color === n) ? 'on' : ''}"></button>`).join('')) + `<span class="sb-sep"></span>`);
    if (one?.type === 'swatch') h += btn('pick', 'color', 'Change the color') + btn('hidename', 'name', one.hideName ? 'Show the name' : 'Hide the name', !one.hideName) + btn('hidehex', 'hex', one.hideHex ? 'Show the hex' : 'Hide the hex', !one.hideHex);
    if (one?.type === 'image' && cropping?.c === one) { bar.innerHTML = `<span class="sb-label">Crop</span><button class="sb-txt" data-crop="cancel">Cancel</button><button class="sb-txt" data-crop="reset">Reset</button><button class="sb-txt on" data-crop="done">Done</button>`; return; }
    if (one?.type === 'box' && one.img && !one.src) h += `<button class="sb-txt" data-fill="1" title="Fill this image spot">Fill image ✦</button>`;
    if (one && ((one.type === 'box' && one.img) || one.type === 'image')) h += `<button class="sb-ic" data-pic="1" title="Replace picture" aria-label="Replace picture"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M3 13l4-4 3.5 3.5L13 10l4 4"/><circle cx="13.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg></button>`;
    if (one?.type === 'box' && one.src) h += `<button class="sb-ic" data-frame2="1" title="Crop" aria-label="Crop"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5V14h11.5M2.5 6H14v11.5"/></svg></button>`;
    if (cs.length && cs.every(c => SHADOWABLE.includes(c.type))) h += shadowPop(cs);
    if (one?.type === 'image') h += btn('crop', 'crop', 'Crop') + btn('nobg', 'nobg', one.nobg ? 'Put the background back' : 'Remove the background', false) + '' + btn('tag', 'caption', one.tagText ? 'Remove the caption' : 'Add a caption', !!one.tagText);
    else if (one && !['coll', 'swatch', 'stamp', 'ink'].includes(one.type)) h += G(6, btn('tag', 'tag', one.tagText ? 'Remove the label' : 'Add a label', !!one.tagText));
    if (one?.type === 'doc') h += btn('open', 'open', 'Open the doc');
    if (one?.type === 'canvas') h += btn('open', 'open', 'Open this canvas');
    if (one?.type === 'link' && one.url) h += btn('visit', 'open', 'Open the link') + btn('relink', 'link', 'Change the link');
    if (one?.type === 'spotify') h += btn('visit', 'open', 'Open in Spotify');
    if (one?.type === 'path' && !one.closed && one.pts?.length > 1) h += wireEndsPop({ head: one.head, tail: one.tail });
    if (one?.type === 'shape' && one.shape === 'line') { const st = one.squig || 'straight', sl = (k, label, v, min, max, unit = '') => `<div class="sbc-top sb-sqrow" data-sqk="${k}"><span>${label}</span><input type="range" min="${min}" max="${max}" step="1" value="${v}" style="--p:${(v - min) / (max - min) * 100}%" data-sq="${k}"><input type="number" min="${min}" max="${max}" value="${v}" data-sqn="${k}" aria-label="${label}"><b class="sb-unit">${unit}</b></div>`;
      const ic = { straight: 'M3 12h18', wavy: 'M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-2', zigzag: 'M2 15l4-6 4 6 4-6 4 6 4-6', loopy: 'M2 15c3 0 4-8 2-8s-1 8 3 8 4-8 2-8-1 8 3 8 4-8 2-8-1 8 4 8' };
      h += G(2, pop('squig', `<svg viewBox="0 0 24 24" class="sb-l24"><path d="${ic[st]}"/></svg>${CARET}`,
        `<div class="sb-corners sb-squig" data-st="${st}"><div class="sbc-chips sb-sqstyles">${[['straight', 'Straight'], ['wavy', 'Wavy'], ['zigzag', 'Zigzag'], ['loopy', 'Loopy']].map(([k, t]) => `<button data-sqs="${k}" class="${st === k ? 'on' : ''}"><svg viewBox="0 0 24 24"><path d="${ic[k]}"/></svg>${t}</button>`).join('')}</div>
          <div class="sb-sqmore">${sl('waves', 'Tightness', one.waves ?? 6, 1, 30)}${sl('round', st === 'loopy' ? 'Loop size' : 'Roundness', one.round ?? 60, 0, 100, '%')}${sl('height', 'Height', Math.round(one.h), 8, 300, 'px')}${sl('wobble', 'Wobble', one.wobble ?? 0, 0, 100, '%')}</div>
          ${sl('lw', 'Thickness', one.lw ?? 4, 1, 24, 'px')}</div>`, 'Line style')); }
    if (one?.type === 'shape') h += G(2, pop('color', `<i class="sb-cur" style="background:${SHAPE_FILL[one.fill || 'gray'] ? `var(--sh-${one.fill || 'gray'})` : one.fill}"></i>${CARET}`, `<div class="sb-dots">${one.shape === 'line' ? '' : `<button data-sf="none" title="No fill" class="sb-nofill ${one.fill === 'none' ? 'on' : ''}"></button>`}${Object.keys(SHAPE_FILL).map(n => `<button data-sf="${n}" title="${n}" style="background:var(--sh-${n})" class="${(one.fill || 'gray') === n ? 'on' : ''}"></button>`).join('')}<label class="sf-any ${SHAPE_FILL[one.fill || 'gray'] ? '' : 'on'}" title="Any color"${SHAPE_FILL[one.fill || 'gray'] ? '' : ` style="--any:${one.fill}"`}><input type="color" data-sfany value="${SHAPE_FILL[one.fill || 'gray'] ? '#ff9ec4' : one.fill}"></label></div>`, 'Color') + `<span class="sb-sep"></span>`);
    const sized = cs.filter(c => SIZED.includes(c.type));
    if (sized.length) { const cur = sized.every(c => (c.fs || 'm') === (sized[0].fs || 'm')) ? (sized[0].fs || 'm') : '', px = sized.every(c => fsPx(c) === fsPx(sized[0])) ? fsPx(sized[0]) : '';
      // bold is on by default for titles and collection names, off for everything else
      const isOn = (c, k) => c[k] ?? (k === 'bold' && ['title', 'coll'].includes(c.type));
      const ST = [['bold', '<b>B</b>', 'Bold'], ['italic', '<i>I</i>', 'Italic'], ['under', '<u>U</u>', 'Underline'], ['strike', '<s>S</s>', 'Strikethrough']];
      const stb = ([k, l, t]) => `<button data-ts="${k}" title="${t}" class="${sized.every(c => isOn(c, k)) ? 'on' : ''}">${l}</button>`;
      h += G(1, `<span class="sb-sep"></span><div class="sb-sizes sb-style">${ST.map(stb).join('')}</div>`);   // B I U S stay together
      const al = sized.every(c => (c.align || 'left') === (sized[0].align || 'left')) ? (sized[0].align || 'left') : '';
      h += G(1, `<div class="sb-sizes sb-style sb-align">${[['left','Align left'],['center','Center'],['right','Align right']].map(([k, t]) => `<button data-al="${k}" title="${t}" class="${al === k ? 'on' : ''}"><svg viewBox="0 0 24 24">${ALIGN_IC[k]}</svg></button>`).join('')}</div>`);
      const fnt = sized.every(c => (c.font || '') === (sized[0].font || '')) ? (sized[0].font || '') : null;
      h += G(5, `<span class="sb-sep"></span><button class="sb-txt sb-font" data-sbfont="1" title="Font"><span style="${fnt ? `font-family:'${esc(fnt)}', var(--font)` : ''}">${fnt === null ? 'Mixed fonts' : esc(fnt || 'Default font')}</span><svg class="sb-caret" viewBox="0 0 12 12" width="10" height="10"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`);
      const SZ = { s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large' };
      h += G(4, `<span class="sb-sep"></span>` + pop('size', `<b>${px || 'Size'}</b>${CARET}`, `<div class="sb-fsbox"><div class="sbc-top sb-fsrow"><span>Size</span><button class="sb-fsstep" data-fsstep="-1" title="Smaller (⇧ for 10)">−</button><input type="number" min="6" max="400" step="1" value="${px}" placeholder="–" data-fsnum aria-label="Text size in pixels"><span class="sb-fspx">px</span><button class="sb-fsstep" data-fsstep="1" title="Bigger (⇧ for 10)">+</button></div><div class="sb-sizelist">${Object.entries(SZ).map(([z, n]) => `<button data-fs="${z}" class="sz-${z} ${cur === z ? 'on' : ''}"><b>Aa</b><span>${n}</span><em>${Math.round((FS_BASE[sized[0].type] || 15) * FS[z])}</em></button>`).join('')}</div></div>`, 'Text size')); }
    if (sized.length) { const f = sized[0], lh = lhOf(f), ls = lsOf(f), pct = (v, a, b) => Math.max(0, Math.min(100, (v - a) / (b - a) * 100)) + '%';
      const row = (k, label, v, min, max, step, unit) => `<div class="sbc-top"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${pct(v, min, max)}" data-sp="${k}"><input type="number" min="${min}" max="${max}" step="${step}" value="${v}" data-spn="${k}" aria-label="${label}"><b class="sb-unit">${unit}</b></div>`;
      const chips = (k, list) => `<div class="sbc-chips sb-spchips">${list.map(([t, v]) => `<button data-spq="${k}:${v}">${t}</button>`).join('')}</div>`;
      h += G(6, pop('spacing', `<svg class="sb-l24" viewBox="0 0 24 24">${SPACING_IC}</svg>${CARET}`,
        `<div class="sb-corners sb-spacing">${row('lh', 'Line height', lh, .8, 3, .05, '×')}${chips('lh', [['Tight', 1.1], ['Normal', 'normal'], ['Airy', 1.8]])}<i class="sb-sprule"></i>${row('ls', 'Letters', ls, -10, 30, .5, '%')}${chips('ls', [['Tight', -3], ['Normal', 'normal'], ['Wide', 8]])}<i class="sb-sprule"></i><div class="sbc-top"><span>Case</span></div><div class="sbc-chips sb-cases">${[['', 'Aa', 'As typed'], ['upper', 'AB', 'UPPERCASE'], ['lower', 'ab', 'lowercase'], ['title', 'Ab', 'Title Case']].map(([k, g, t]) => `<button data-tcase="${k}" title="${t}" class="${(f.tcase || '') === k ? 'on' : ''}"><b>${g}</b><small>${t}</small></button>`).join('')}</div></div>`, 'Line height and letter spacing')); }
    // box (and screen) fill: wireframe grays, your pastels, and any color
    const fillable = cs.filter(c => c.type === 'box' && !c.src || c.type === 'frame' || c.type === 'path' && c.closed);
    if (fillable.length === cs.length && fillable.length) { const BF = ['#ffffff', '#f4f4f5', '#e4e4e7', '#a1a1aa', '#27272a', '#ffe0ec', '#fff5c8', '#dcf5e7', '#dcedff', '#eadfff', '#ffe9d6', '#ff9ec4'];
      const cur = fillable[0].fill || (fillable[0].type === 'box' ? '#e4e4e7' : '#ffffff');
      h += G(2, pop('fill', `<i class="sb-cur${cur === 'none' ? ' sb-none' : ''}" style="background:${cur === 'none' ? '' : cur}"></i>${CARET}`, `<div class="sb-dots sb-fills"><button data-bfill="none" title="No fill" class="sb-nofill ${cur === 'none' ? 'on' : ''}"></button>${BF.map(v => `<button data-bfill="${v}" title="${v}" style="background:${v}" class="${cur.toLowerCase() === v ? 'on' : ''}"></button>`).join('')}<button class="sb-anycolor" data-bfwheel="1" title="Any color"></button></div>`, 'Fill')); }
    // text color for titles and wireframe text, with No fill (hollow letters)
    const tfs = cs.filter(c => c.type === 'title' || c.type === 'text');
    if (tfs.length === cs.length && tfs.length) { const f = tfs[0], cur = f.type === 'title' ? f.tc || '' : f.color || '#27272a', TF = ['#27272a', '#ffffff', '#ff5a6e', '#ff9ec4', '#f7b955', '#5fc795', '#4f9dff', '#9b7bff'];
      h += G(2, pop('tfill', `<i class="sb-cur sb-tcur${cur === 'none' ? ' sb-none' : ''}" style="--c:${cur && cur !== 'none' ? cur : 'var(--ink)'}">A</i>${CARET}`,
        `<div class="sb-dots sb-fills"><button data-tf="none" title="No fill" class="sb-nofill ${cur === 'none' ? 'on' : ''}"></button>${TF.map(v => `<button data-tf="${v}" title="${v}" style="background:${v}" class="${cur.toLowerCase() === v ? 'on' : ''}"></button>`).join('')}<button class="sb-anycolor" data-tfwheel="1" title="Any color"></button></div>`, 'Text color')); }
    const stk = cs.filter(c => canStroke(c));
    if (stk.length === cs.length && stk.length) { const f = stk[0], col = f.stroke || (f.type === 'image' ? '#ffffff' : '#27272a'), w = f.type === 'image' ? bwOf(f) : (f.sw || 0), textOnly = stk.every(c => STROKE_TEXT.includes(c.type)), max = textOnly ? 12 : 24, noDash = stk.some(c => ['icon', 'title', 'text', 'image'].includes(c.type));   // dashed/dotted is for shapes, boxes and screens
      const SK = ['#000000', '#ffffff', '#71717a', '#a1a1aa', '#ff5a6e', '#ff9ec4', '#f7b955', '#5fc795', '#4f9dff', '#9b7bff', ...board.styles.colors.map(p => p.hex), ...board.cards.filter(c => c.type === 'swatch' && c.hex).map(c => c.hex)].slice(0, 18);
      h += G(2, pop('stroke', `<i class="sb-cur sb-skcur${w ? '' : ' none'}" style="--c:${col}"></i>${CARET}`,
        `<div class="sb-corners sb-stroke">${f.type === 'image' ? '<small class="sb-cap">The picture’s border. 0 is none; on a cut-out it’s an outline.</small>' : ''}<div class="sbc-top"><span>Stroke</span><input type="range" min="0" max="${max}" step="0.5" value="${w}" style="--p:${Math.min(100, w / max * 100)}%" data-skw><input type="number" min="0" max="${max}" step="0.5" value="${w}" data-skn aria-label="Stroke width"><b class="sb-unit">px</b></div>
          <div class="sb-dots sb-fills">${[...new Set(SK.map(v => v.toLowerCase()))].map(v => `<button data-skc="${v}" title="${v}" style="background:${v}" class="${w && col.toLowerCase() === v ? 'on' : ''}"></button>`).join('')}<button class="sb-anycolor" data-skwheel="1" title="Any color"></button></div>
          ${noDash ? '' : (() => { const st = skStyle(f), sl = (k, label, v, max) => `<div class="sbc-top sb-skrow"><span>${label}</span><input type="range" min="1" max="${max}" step="1" value="${v}" style="--p:${(v - 1) / (max - 1) * 100}%" data-skr="${k}"><input type="number" min="1" max="${max}" value="${v}" data-skrn="${k}" aria-label="${label}"><b class="sb-unit">px</b></div>`;
            return `<div class="sbc-chips sb-skstyles">${[['solid', 'Solid'], ['dash', 'Dashed'], ['dot', 'Dotted'], ['none', 'None']].map(([k, t]) => `<button data-skd="${k}" class="${(k === 'none' ? !w : w && st === k) ? 'on' : ''}"><span class="sks sks-${k}"></span>${t}</button>`).join('')}</div>`
              + `<div class="sb-skdash${w && st !== 'solid' ? '' : ' off'}" data-skst="${st}">${sl('dl', 'Dash', f.dl ?? 8, 40)}${sl('dg', 'Gap', f.dg ?? 6, 40)}</div>`; })()}</div>`, 'Stroke')); }
    const rnd = cs.filter(c => (['frame', 'box'].includes(c.type) || c.type === 'image' && !c.nobg && !isMasked(c) || c.type === 'path' || c.type === 'shape' && ['rect', 'tri', 'star'].includes(c.shape || 'rect')));
    if (rnd.length === cs.length && rnd.length) { const cr = rnd[0].radius ?? (rnd[0].type === 'image' ? 20 : 0), same = rnd.every(c => (c.radius ?? (c.type === 'image' ? 20 : 0)) === cr);
      h += G(3, pop('corners', `<svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /></svg><b>${same ? (cr >= 999 ? 'Pill' : cr) : '–'}</b>${CARET}`,
        `<div class="sb-corners"><div class="sbc-top"><span>Corners</span><input type="range" min="0" max="80" step="1" value="${Math.min(80, cr)}" style="--p:${Math.min(100, cr / 80 * 100)}%" data-corners-range><input type="number" min="0" max="999" value="${cr >= 999 ? 0 : cr}" data-corners-num></div>
         <div class="sbc-chips">${[0, 4, 8, 12, 16, 24, 32].map(v => `<button data-corners="${v}" class="${same && cr === v ? 'on' : ''}"><i style="border-top-left-radius:${Math.min(v, 14)}px"></i>${v}</button>`).join('')}<button data-corners="999" class="${same && cr >= 999 ? 'on' : ''}"><i style="border-top-left-radius:14px"></i>Pill</button></div></div>`, 'Corners')); }
    const seen = one && (one.type === 'stamp' && !one.tilted ? 0 : Math.round(one.r || 0));
    if (one && TILTS(one)) h += G(3, `<span class="sb-sep"></span><button class="sb-tilt" data-sb="tiltpop" title="Tilt"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg><span class="sb-deg">${seen}°</span></button>`);   // Reset lives in the tilt box
    const oneGroup = cs.length > 1 && cs.every(c => c.group && c.group === cs[0].group);
    if (cs.length > 1) h += G(9, `<span class="sb-sep"></span><button class="sb-txt sb-glass" data-sb="section" title="Create section · ⌥⌘G">Create section</button>`);   // these tuck into ··· before the text controls do
    if (one?.type === 'section') h += `<button class="sb-txt" data-sb="rensection" title="Rename">Rename</button>`;
    if (one?.type === 'section') h += `<button class="sb-txt" data-sb="unsection" title="Remove section">Remove section</button><span class="sb-sep"></span>`;
    if (one?.type === 'section') h += G(2, colorPop(COLORS[one.color] || '#fff', COLOR_NAMES.map(n => `<button data-sc="${n}" title="${n}" style="background:${COLORS[n]}" class="${(one.color || 'white') === n ? 'on' : ''}"></button>`).join('')));
    if (cs.length > 1) h += G(8, `<span class="sb-sep"></span><button class="sb-txt" data-sb="${oneGroup ? 'ungroup' : 'group'}" title="${oneGroup ? 'Ungroup · ⇧⌘G' : 'Group · ⌘G'}">${oneGroup ? 'Ungroup' : 'Group'}</button>`);
    h += `<span class="sb-sep sb-moresep"></span>` + pop('more', '<svg viewBox="0 0 24 24" class="sb-l24"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>', `<div class="sb-morebody">${more}</div>`, 'More');
    h += `<span class="sb-sep"></span>` + btn('mochi', 'mochi', 'Ask Mochi') + btn('del', 'del', 'Delete');
    bar.innerHTML = h; foldSelbar(bar); snapSoon();
  }
  let coverT = 0;
  let coverKey = '';
  function checkTitleCover() {
    const t = document.querySelector('.top'); if (!t || !board) return; const key = view.x + ',' + view.y + ',' + view.z + ',' + board.cards.length + ',' + (drag ? 1 : 0);
    if (key === coverKey && !drag) return; coverKey = key;
    const r = t.getBoundingClientRect(), a = toWorld(r.left - 6, r.top - 6), b = toWorld(r.right + 6, r.bottom + 6);
    t.classList.toggle('covered', board.cards.some(c => c.x < b.x && c.x + c.w > a.x && c.y < b.y && c.y + c.h > a.y));
  }

  let gbKey = '';
  function drawGroupBoxes() {
    if (!board) return; const gs = [...new Set(selCards().map(c => c.group).filter(Boolean))];
    const boxes = gs.map(g => { const all = board.cards.filter(c => c.group === g && !c.onFrame); if (all.length < 2) return null; const mk = all.find(c => c.maskLayer), cs = mk ? [mk] : all;
      const x0 = Math.min(...cs.map(c => c.x)), y0 = Math.min(...cs.map(c => c.y)), x1 = Math.max(...cs.map(c => c.x + c.w)), y1 = Math.max(...cs.map(c => c.y + c.h)); return [x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 28, mk ? 'Mask' : 'Group']; }).filter(Boolean);
    const key = JSON.stringify(boxes); if (key === gbKey) return; gbKey = key;
    $('groupBoxes').innerHTML = boxes.map(([x, y, w, h, label]) => `<div class="group-box" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><span>${label || 'Group'}</span></div>`).join('');
  }
  (function tick() { placeSelbar(); drawGroupBoxes(); if (++coverT % 8 === 0) checkTitleCover(); requestAnimationFrame(tick); })();
  $('selbar').addEventListener('pointerdown', e => e.stopPropagation());
  $('selbar').addEventListener('click', e => {
    const we = e.target.closest('[data-we]'), wcb = e.target.closest('[data-wc]'); if (!we && !wcb) return; const ls = [...selWires].map(linkById).filter(Boolean); if (!ls.length) return; e.stopImmediatePropagation(); remember();
    if (we) { const [which, kind] = we.dataset.we.split(':'); ls.forEach(l => { if (which === 'head') { delete l.arrow; if (kind === 'none') delete l.head; else l.head = kind; } else { if (kind === 'none') delete l.tail; else l.tail = kind; } }); }
    else ls.forEach(l => { if (wcb.dataset.wc) l.color = wcb.dataset.wc; else delete l.color; });
    closeSbPops(); $('selbar').dataset.key = ''; renderWires(); save();
  }, true);
  $('selbar').addEventListener('input', e => { if (e.target.matches('[data-wcany]')) { const ls = [...selWires].map(linkById).filter(Boolean); ls.forEach(l => l.color = e.target.value); e.target.closest('.sf-any').style.setProperty('--any', e.target.value); $('selbar').querySelector('[data-popw="wcolor"] .sb-cur')?.style.setProperty('background', e.target.value); renderWires(); clearTimeout(e.target._t); e.target._t = setTimeout(save, 300); return; }
    if (!e.target.matches('[data-sfany]')) return; const one = selCards()[0]; if (!one) return; one.fill = e.target.value; renderCard(one); selectOnly([one.id]); e.target.closest('.sf-any').style.setProperty('--any', one.fill); save(); });
  $('selbar').addEventListener('click', e => {
    const a = e.target.closest('[data-wb]')?.dataset.wb, ls = [...selWires].map(linkById).filter(Boolean), l0 = ls[0]; if (!a || !l0) return; e.stopImmediatePropagation();
    if (a === 'label') { $('selbar').dataset.key = ''; return editWireLabel(l0); }
    remember(); ls.forEach(l => {
    if (a === 'curve') l.bend = l.bend === 0 ? undefined : l.bend; if (a === 'curve' && l.bend === undefined) delete l.bend;
    if (a === 'straight') l.bend = 0;
    if (a === 'curve' || a === 'straight') delete l.route;
    if (a === 'elbow') l.route = 'elbow';
    if (a === 'dash') l.dash = !l.dash;
    if (a === 'arrow') l.arrow = !l.arrow;
    if (a === 'flip') { [l.a, l.b] = [l.b, l.a]; [l.pa, l.pb] = [l.pb, l.pa]; if (!l.pa) delete l.pa; if (!l.pb) delete l.pb; if (l.bend) l.bend = -l.bend; }
    if (a === 'auto') { delete l.pa; delete l.pb; }
    if (a === 'del') board.links = board.links.filter(x => x !== l); });
    if (a === 'del') { selWire = null; selWires.clear(); }
    $('selbar').dataset.key = ''; renderWires(); save();
  }, true);
  // hover a button in the selection bar: a quick little name bubble above it (the same look as the main toolbar's)
  (() => {
    const tipEl = document.createElement('div'); tipEl.className = 'sb-tipbub'; document.body.appendChild(tipEl); let tT = 0;
    const NAMES = { color: 'Color', size: 'Text size', more: 'More' };
    $('selbar').addEventListener('pointerover', e => {
      const b = e.target.closest('button, .sb-tilt'); if (!b || b.closest('.sb-pop')) return;
      if (b.title) { b.dataset.tt = b.title; b.removeAttribute('title'); }   // our bubble instead of the slow system one
      const txt = b.dataset.tt || NAMES[b.dataset.pop] || b.getAttribute('aria-label') || ({ bold: 'Bold', italic: 'Italic', under: 'Underline', strike: 'Strikethrough' })[b.dataset.ts];
      if (!txt || b.closest('.sb-popw.open')) return;
      clearTimeout(tT); tT = setTimeout(() => { const r = b.getBoundingClientRect(); tipEl.textContent = txt; tipEl.classList.add('on');
        tipEl.style.left = Math.max(8, Math.min(innerWidth - tipEl.offsetWidth - 8, r.left + r.width / 2 - tipEl.offsetWidth / 2)) + 'px'; tipEl.style.top = r.top - tipEl.offsetHeight - 10 + 'px'; }, 250);
    });
    const hide = () => { clearTimeout(tT); tipEl.classList.remove('on'); };
    $('selbar').addEventListener('pointerout', e => { if (!e.relatedTarget || !e.relatedTarget.closest?.('#selbar')) hide(); else if (!e.relatedTarget.closest('button, .sb-tilt')) hide(); });
    $('selbar').addEventListener('pointerdown', hide, true);
  })();
  // the bar's dropdowns: open on click (placed above the bar, never cut off), close on a pick or a click elsewhere
  function closeSbPops() { const was = document.querySelector('.sb-popw.open'); document.querySelectorAll('.sb-popw.open').forEach(w => w.classList.remove('open')); fsMark = false; spMark = false; skMark = false; sqMark = false; if (was && $('selbar')) $('selbar').dataset.key = ''; }
  addEventListener('pointerdown', e => { if (!e.target.closest('.sb-popw')) closeSbPops(); }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.sb-popw.open')) { closeSbPops(); e.stopPropagation(); } }, true);
  $('selbar').addEventListener('click', e => {
    const t = e.target.closest('[data-pop]'); if (!t) return; e.stopImmediatePropagation();
    const w = t.closest('.sb-popw'), was = w.classList.contains('open');
    document.querySelectorAll('.sb-popw.open').forEach(x => { if (x === w || !x.contains(w)) x.classList.remove('open'); });   // a dropdown inside the ··· menu keeps the menu open
    if (!was) w.classList.add('open');
  }, true);
  function setCorners(v, keepOpen) {
    if (vec && vec.sel.size) { const c = vecCard(); v = Math.max(0, Math.round(+v || 0)); vec.sel.forEach(i => c.pts[i].r = v); renderCard(c); drawVec(); syncCornerPop(); save(); return; }   // editing points: round just the picked corners
    const cs = selCards().filter(c => (['frame', 'box', 'image'].includes(c.type) || c.type === 'path' || c.type === 'shape' && ['rect', 'tri', 'star'].includes(c.shape || 'rect'))); if (!cs.length) return; v = Math.max(0, Math.min(999, Math.round(+v || 0)));
    cs.forEach(c => { c.radius = v; renderCard(c); }); selectOnly(cs.map(c => c.id)); syncDesign(); save();
    const p = document.querySelector('.sb-pop-corners'); if (p) { p.querySelectorAll('[data-corners]').forEach(b => b.classList.toggle('on', +b.dataset.corners === v)); const t = document.querySelector('[data-pop="corners"] b'); if (t) t.textContent = v >= 999 ? 'Pill' : v; }
    if (!keepOpen) { $('selbar').dataset.key = ''; closeSbPops(); }
  }
  function setSquig(patch) {
    const c = selCards().find(k => k.type === 'shape' && k.shape === 'line'); if (!c) return; const el = cardsEl.querySelector(`[data-id="${c.id}"]`);
    // each style starts at its own look (wavy = round, zigzag = sharp); the slider takes it from there
    if (patch.squig) { c.squig = patch.squig === 'straight' ? undefined : patch.squig; c.round = { wavy: 100, zigzag: 0, loopy: 60 }[patch.squig] ?? c.round; if (c.squig && c.h < 40) { c.y -= (60 - c.h) / 2; c.h = 60; } if (!c.squig && c.h > 24) { c.y += (c.h - 24) / 2; c.h = 24; } }
    if (patch.height != null) { const nh = Math.max(8, +patch.height); c.y -= (nh - c.h) / 2; c.h = nh; }
    ['waves', 'round', 'wobble', 'lw'].forEach(k => { if (patch[k] != null) c[k] = +patch[k]; });
    renderCard(c); if (el) Object.assign(cardsEl.querySelector(`[data-id="${c.id}"]`).style, { top: c.y + 'px', height: c.h + 'px' }); selectOnly([c.id]); renderWires(); save();
    const pop = $('selbar').querySelector('.sb-squig'); if (pop && patch.squig) { pop.dataset.st = c.squig || 'straight'; pop.querySelectorAll('[data-sqs]').forEach(b => b.classList.toggle('on', b.dataset.sqs === (c.squig || 'straight')));
      const lab = pop.querySelector('[data-sqk="round"] span'); if (lab) lab.textContent = c.squig === 'loopy' ? 'Loop size' : 'Roundness';
      [['height', Math.round(c.h)], ['round', c.round ?? 60]].forEach(([k, v]) => { const row = pop.querySelector(`[data-sqk="${k}"]`); if (!row) return; row.querySelectorAll('input').forEach(i => i.value = v); const rg = row.querySelector('[data-sq]'); rg.style.setProperty('--p', (v - rg.min) / (rg.max - rg.min) * 100 + '%'); });
      const trig = $('selbar').querySelector('[data-pop="squig"] path'); const src = pop.querySelector(`[data-sqs="${c.squig || 'straight'}"] path`); if (trig && src) trig.setAttribute('d', src.getAttribute('d')); }
  }
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-sqs]'); if (!b) return; e.stopImmediatePropagation(); if (!sqMark) { remember(); sqMark = true; } setSquig({ squig: b.dataset.sqs }); }, true);
  $('selbar').addEventListener('input', e => { const r = e.target.closest('[data-sq], [data-sqn]'); if (!r || r.value === '') return; if (!sqMark) { remember(); sqMark = true; }
    const k = r.dataset.sq || r.dataset.sqn, row = r.parentElement, rg = row.querySelector('[data-sq]'), nb = row.querySelector('[data-sqn]'); if (r === rg) nb.value = rg.value; else rg.value = nb.value;
    rg.style.setProperty('--p', (rg.value - rg.min) / (rg.max - rg.min) * 100 + '%'); setSquig({ [k]: Math.max(+rg.min, Math.min(+rg.max, +r.value)) }); });
  $('selbar').addEventListener('keydown', e => { if (!e.target.matches('[data-sqn]')) return; e.stopPropagation(); if (e.key === 'Enter') { closeSbPops(); placeSelbar(); } });
  // going to No fill: if it has no border yet, it gets one in the color the fill had, so it never just disappears
  const toHex = v => { if (!v) return null; if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase(); const m = String(v).match(/\d+(\.\d+)?/g); return m && m.length >= 3 ? '#' + m.slice(0, 3).map(n => (+n | 0).toString(16).padStart(2, '0')).join('') : null; };
  function autoBorder(c, was) { if (c.stroke && c.sw > 0) return; c.stroke = toHex(was) || '#27272a'; c.sw = ['title', 'text', 'icon'].includes(c.type) ? 1 : 2; }
  const fillOf = c => c.type === 'shape' ? (SHAPE_FILL[c.fill || 'gray'] || c.fill) : c.type === 'box' ? c.fill || '#e4e4e7' : c.type === 'frame' ? c.fill || '#ffffff' : c.fill;
  function setTextFill(v) {
    const cs = selCards().filter(c => c.type === 'title' || c.type === 'text'); if (!cs.length) return;
    cs.forEach(c => { const k = c.type === 'title' ? 'tc' : 'color', el = cardsEl.querySelector(`[data-id="${c.id}"] ${c.type === 'title' ? '.text' : '.tx'}`);
      if (v === 'none' && c[k] !== 'none') autoBorder(c, c[k] && c[k] !== 'none' ? c[k] : el && getComputedStyle(el).color);
      if (c.type === 'title' && v === '') delete c.tc; else c[k] = v; renderCard(c); });
    selectOnly(cs.map(c => c.id)); syncDesign(); save();
    const t = $('selbar').querySelector('.sb-tcur'); if (t) { t.classList.toggle('sb-none', v === 'none'); t.style.setProperty('--c', v && v !== 'none' ? v : 'var(--ink)'); }
    $('selbar').querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('on', b.dataset.tf === v));
  }
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-tf], [data-tfwheel]'); if (!b) return; e.stopImmediatePropagation(); remember();
    if (b.dataset.tf != null) return setTextFill(b.dataset.tf);
    const cs = selCards().filter(c => c.type === 'title' || c.type === 'text'), r = $('selbar').getBoundingClientRect(), was = cs.map(c => [c.tc, c.color, c.stroke, c.sw]); closeSbPops();
    openColor({ tint: true, boardColors: true, title: 'Text color', hex: toHex(cs[0].type === 'title' ? cs[0].tc : cs[0].color) || '#27272a', presets: ['#27272a', '#ffffff', '#ff5a6e', '#ff9ec4', '#f7b955', '#5fc795', '#4f9dff', '#9b7bff'],
      fromBar: true, at: { x: r.left + r.width / 2 - 140, y: r.top - 480 }, apply: hex => setTextFill(hex), reset: () => { cs.forEach((c, i) => { [c.tc, c.color, c.stroke, c.sw] = was[i]; renderCard(c); }); save(); } });
  }, true);
  function setStroke(patch) {
    const cs = selCards().filter(c => canStroke(c)); if (!cs.length) return;
    cs.forEach(c => { if (patch.none) { delete c.stroke; delete c.sw; delete c.sdash; } else { if (patch.color) c.stroke = patch.color; if (patch.w != null) c.sw = +patch.w;
      if (patch.dash != null) c.sdash = patch.dash === 'solid' ? undefined : patch.dash; if (patch.dl != null) c.dl = +patch.dl; if (patch.dg != null) c.dg = +patch.dg; if (!c.stroke) c.stroke = c.type === 'image' ? '#ffffff' : '#27272a'; if (!(c.sw > 0) && (patch.color || patch.dash != null)) c.sw = c.type === 'image' ? (c.nobg ? 6 : 8) : STROKE_TEXT.includes(c.type) ? 1.5 : 2; } renderCard(c); });
    selectOnly(cs.map(c => c.id)); syncDesign(); renderWires(); save();
    const f = cs[0], bar = $('selbar'), cur = bar.querySelector('.sb-skcur'); if (cur) { cur.style.setProperty('--c', f.stroke || '#27272a'); cur.classList.toggle('none', !(f.sw > 0)); }
    bar.querySelectorAll('[data-skc]').forEach(b => b.classList.toggle('on', f.sw > 0 && (f.stroke || '').toLowerCase() === b.dataset.skc));
    bar.querySelectorAll('[data-skd]').forEach(b => b.classList.toggle('on', b.dataset.skd === 'none' ? !(f.sw > 0) : f.sw > 0 && b.dataset.skd === skStyle(f)));
    const dash = bar.querySelector('.sb-skdash'); if (dash) { dash.classList.toggle('off', !(f.sw > 0) || skStyle(f) === 'solid'); dash.dataset.skst = skStyle(f); }
    const rg = bar.querySelector('[data-skw]'), nb = bar.querySelector('[data-skn]'); if (rg && document.activeElement !== nb) { rg.value = nb.value = f.sw || 0; rg.style.setProperty('--p', Math.min(100, (f.sw || 0) / rg.max * 100) + '%'); }
  }
  $('selbar').addEventListener('input', e => { const r = e.target.closest('[data-skw], [data-skn]'); if (!r || r.value === '') return; if (!skMark) { remember(); skMark = true; }
    const row = r.parentElement, rg = row.querySelector('[data-skw]'), nb = row.querySelector('[data-skn]'); if (r === rg) nb.value = rg.value; else { nb.value = Math.max(0, Math.min(24, +nb.value || 0)); rg.value = nb.value; }
    rg.style.setProperty('--p', Math.min(100, rg.value / rg.max * 100) + '%'); setStroke({ w: Math.max(0, +r.value) }); });
  $('selbar').addEventListener('input', e => { const r = e.target.closest('[data-skr], [data-skrn]'); if (!r || r.value === '') return; if (!skMark) { remember(); skMark = true; }
    const k = r.dataset.skr || r.dataset.skrn, row = r.parentElement, rg = row.querySelector('[data-skr]'), nb = row.querySelector('[data-skrn]'); if (r === rg) nb.value = rg.value; else rg.value = nb.value;
    rg.style.setProperty('--p', (rg.value - 1) / (rg.max - 1) * 100 + '%'); setStroke({ [k]: Math.max(1, +r.value) }); });
  $('selbar').addEventListener('keydown', e => { if (e.target.matches('[data-skrn]')) { e.stopPropagation(); if (e.key === 'Enter') { closeSbPops(); placeSelbar(); } return; } if (!e.target.matches('[data-skn]')) return; e.stopPropagation(); if (e.key === 'Enter') { closeSbPops(); placeSelbar(); } });
  $('selbar').addEventListener('click', e => {
    const c = e.target.closest('[data-skc]'), d = e.target.closest('[data-skd]'), wh = e.target.closest('[data-skwheel]'); if (!c && !d && !wh) return; e.stopImmediatePropagation();
    if ((c || d) && !skMark) { remember(); skMark = true; }   // one undo per visit to the dropdown
    if (c) return setStroke({ color: c.dataset.skc });
    if (d) return setStroke(d.dataset.skd === 'none' ? { none: true } : { dash: d.dataset.skd });
    const cs = selCards().filter(k => canStroke(k)); remember(); const was = cs.map(k => [k.stroke, k.sw, k.sdash]), r = $('selbar').getBoundingClientRect(); closeSbPops();
    openColor({ tint: true, boardColors: true, title: 'Stroke', hex: cs[0].stroke || '#27272a', presets: ['#27272a', '#ffffff', '#ff5a6e', '#ff9ec4', '#f7b955', '#5fc795', '#4f9dff', '#9b7bff'],
      fromBar: true, at: { x: r.left + r.width / 2 - 140, y: r.top - 480 }, apply: hex => setStroke({ color: hex }), reset: () => { cs.forEach((k, i) => { [k.stroke, k.sw, k.sdash] = was[i]; renderCard(k); }); save(); } });
  }, true);
  function setFill(v, keep) { const cs = selCards().filter(c => c.type === 'box' && !c.src || c.type === 'frame' || c.type === 'path' && c.closed); if (!cs.length) return; cs.forEach(c => { if (v === 'none' && c.fill !== 'none') autoBorder(c, fillOf(c)); c.fill = v; renderCard(c); }); selectOnly(cs.map(c => c.id)); syncDesign(); save();
    const t = document.querySelector('[data-pop="fill"] .sb-cur'); if (t) { t.style.background = v === 'none' ? '' : v; t.classList.toggle('sb-none', v === 'none'); } document.querySelectorAll('[data-bfill]').forEach(b => b.classList.toggle('on', b.dataset.bfill === v)); if (!keep) { $('selbar').dataset.key = ''; closeSbPops(); } }
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-bfill]'); if (!b) return; e.stopImmediatePropagation(); remember(); setFill(b.dataset.bfill); }, true);
  $('selbar').addEventListener('click', e => {
    if (!e.target.closest('[data-bfwheel]')) return; e.stopImmediatePropagation();
    const cs = selCards().filter(c => c.type === 'box' && !c.src || c.type === 'frame' || c.type === 'path' && c.closed); if (!cs.length) return; remember();
    const was = cs.map(c => c.fill), r = $('selbar').getBoundingClientRect(); closeSbPops();
    openColor({ tint: true, boardColors: true, title: 'Fill', hex: cs[0].fill || (cs[0].type === 'box' ? '#e4e4e7' : '#ffffff'), presets: ['#ffffff', '#e4e4e7', '#27272a', '#ffe0ec', '#fff5c8', '#dcf5e7', '#dcedff', '#eadfff', '#ff9ec4'],
      fromBar: true, at: { x: r.left + r.width / 2 - 140, y: r.top - 480 }, apply: hex => setFill(hex, true), reset: () => { cs.forEach((c, i) => { c.fill = was[i]; renderCard(c); }); save(); } });
  }, true);
  let fillMark = false; $('selbar').addEventListener('input', e => { if (!e.target.matches('[data-bfany]')) return; if (!fillMark) { remember(); fillMark = true; } setFill(e.target.value, true); });
  $('selbar').addEventListener('change', e => { if (e.target.matches('[data-bfany]')) { fillMark = false; $('selbar').dataset.key = ''; } });
  let cornersMark = false;
  $('selbar').addEventListener('input', e => {
    const r = e.target.closest('[data-corners-range], [data-corners-num]'); if (!r) return; if (!cornersMark) { remember(); cornersMark = true; }
    const v = r.value; const other = r.matches('[data-corners-range]') ? r.parentElement.querySelector('[data-corners-num]') : r.parentElement.querySelector('[data-corners-range]'); if (other) other.value = v;
    const rg = r.parentElement.querySelector('[data-corners-range]'); rg.style.setProperty('--p', Math.min(100, v / 80 * 100) + '%');
    setCorners(v, true);
  });
  $('selbar').addEventListener('change', () => { cornersMark = false; });
  $('selbar').addEventListener('input', e => { const r = e.target.closest('[data-sp], [data-spn]'); if (!r || r.value === '' || r.value === '-') return; if (!spMark) { remember(); spMark = true; }
    const k = r.dataset.sp || r.dataset.spn, row = r.parentElement, rg = row.querySelector('[data-sp]'), nb = row.querySelector('[data-spn]');
    if (r === rg) nb.value = rg.value; else rg.value = nb.value; rg.style.setProperty('--p', Math.max(0, Math.min(100, (rg.value - rg.min) / (rg.max - rg.min) * 100)) + '%');
    setSpacing(k, r.value); });
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-tcase]'); if (!b) return; e.stopImmediatePropagation(); remember();
    selCards().filter(c => SIZED.includes(c.type)).forEach(c => { if (b.dataset.tcase) c.tcase = b.dataset.tcase; else delete c.tcase; renderCard(c); fitText(c); });
    $('selbar').querySelectorAll('[data-tcase]').forEach(x => x.classList.toggle('on', x === b)); selectOnly(selCards().map(c => c.id)); renderWires(); save(); }, true);
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-spq]'); if (!b) return; e.stopImmediatePropagation(); remember(); const [k, v] = b.dataset.spq.split(':'); setSpacing(k, v);
    const f = selCards().find(c => SIZED.includes(c.type)), cur = k === 'lh' ? lhOf(f) : lsOf(f), row = $('selbar').querySelector(`[data-sp="${k}"]`).parentElement;
    row.querySelector('[data-sp]').value = row.querySelector('[data-spn]').value = cur; const rg = row.querySelector('[data-sp]'); rg.style.setProperty('--p', Math.max(0, Math.min(100, (cur - rg.min) / (rg.max - rg.min) * 100)) + '%'); }, true);
  $('selbar').addEventListener('keydown', e => { if (!e.target.matches('[data-spn]')) return; e.stopPropagation(); if (e.key === 'Enter') { closeSbPops(); placeSelbar(); } });
  $('selbar').addEventListener('input', e => { if (!e.target.matches('[data-fsnum]') || !e.target.value) return; if (!fsMark) { remember(); fsMark = true; } setFsPx(e.target.value); });
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-fsstep]'); if (!b) return; e.stopImmediatePropagation(); const inp = $('selbar').querySelector('[data-fsnum]');
    const cur = +inp.value || fsPx(selCards().find(c => SIZED.includes(c.type))); if (!fsMark) { remember(); fsMark = true; } inp.value = Math.max(6, Math.min(400, cur + b.dataset.fsstep * (e.shiftKey ? 10 : 1))); setFsPx(inp.value); }, true);
  $('selbar').addEventListener('keydown', e => { if (!e.target.matches('[data-fsnum]')) return; e.stopPropagation();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); if (!fsMark) { remember(); fsMark = true; } e.target.value = Math.max(6, Math.min(400, (+e.target.value || 15) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))); setFsPx(e.target.value); }
    if (e.key === 'Enter') { setFsPx(e.target.value); fsMark = false; closeSbPops(); $('selbar').dataset.key = ''; placeSelbar(); } });
  $('selbar').addEventListener('keydown', e => { if (e.target.matches('[data-corners-num]')) { e.stopPropagation(); if (e.key === 'Enter') { closeSbPops(); $('selbar').dataset.key = ''; } } });
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-corners]'); if (!b) return; e.stopImmediatePropagation(); remember(); setCorners(b.dataset.corners); }, true);
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-al]'); if (!b) return; e.stopImmediatePropagation(); remember();
    selCards().filter(c => SIZED.includes(c.type)).forEach(c => { if (b.dataset.al === 'left') delete c.align; else c.align = b.dataset.al; renderCard(c); }); selectOnly(selCards().map(c => c.id)); $('selbar').dataset.key = ''; save(); }, true);
  // line selected things up with each other, or space them evenly (titles use their real drawn height)
  function arrange(how) {
    const cs = selCards().filter(c => !c.locked); if (cs.length < 2) return; remember();
    // real sizes right now (a title's saved width catches up a moment after it changes, which made the first click land off-center)
    const elOf = c => cardsEl.querySelector(`[data-id="${c.id}"]`), W = c => c.type === 'title' ? (elOf(c)?.offsetWidth || c.w) : c.w, H = c => c.type === 'title' ? (elOf(c)?.offsetHeight || c.h) : c.h;
    cs.forEach(c => { if (c.type === 'title') { c.w = W(c); c.h = H(c); } });
    // units: a whole group you selected moves as one block (its pieces keep their layout); pieces picked out of a group line up on their own
    const ids = new Set(cs.map(c => c.id)), units = new Map();
    cs.forEach(c => { const whole = c.group && board.cards.filter(k => k.group === c.group).every(k => ids.has(k.id)), key = whole ? 'g:' + c.group : c.id;
      if (!units.has(key)) units.set(key, []); units.get(key).push(c); });
    const U = [...units.values()].map(m => { const x = Math.min(...m.map(c => c.x)), y = Math.min(...m.map(c => c.y)); return { m, x, y, w: Math.max(...m.map(c => c.x + W(c))) - x, h: Math.max(...m.map(c => c.y + H(c))) - y, nx: x, ny: y }; });
    if (U.length < 2) return;
    const x0 = Math.min(...U.map(u => u.x)), x1 = Math.max(...U.map(u => u.x + u.w)), y0 = Math.min(...U.map(u => u.y)), y1 = Math.max(...U.map(u => u.y + u.h));
    const moved = new Map(cs.map(c => [c.id, [c.x, c.y]]));
    if (how === 'left') U.forEach(u => u.nx = x0); if (how === 'right') U.forEach(u => u.nx = x1 - u.w); if (how === 'hcenter') U.forEach(u => u.nx = (x0 + x1) / 2 - u.w / 2);
    if (how === 'top') U.forEach(u => u.ny = y0); if (how === 'bottom') U.forEach(u => u.ny = y1 - u.h); if (how === 'vcenter') U.forEach(u => u.ny = (y0 + y1) / 2 - u.h / 2);
    if (how === 'dh') { const o = [...U].sort((a, b) => a.x - b.x), gap = (x1 - x0 - o.reduce((n, u) => n + u.w, 0)) / (o.length - 1); let x = x0; o.forEach(u => { u.nx = x; x += u.w + gap; }); }
    if (how === 'dv') { const o = [...U].sort((a, b) => a.y - b.y), gap = (y1 - y0 - o.reduce((n, u) => n + u.h, 0)) / (o.length - 1); let y = y0; o.forEach(u => { u.ny = y; y += u.h + gap; }); }
    U.forEach(u => { const dx = u.nx - u.x, dy = u.ny - u.y; u.m.forEach(c => { c.x += dx; c.y += dy; }); });
    // a section brings what's inside it along
    cs.filter(c => c.type === 'section').forEach(sec => { const [ox, oy] = moved.get(sec.id), dx = sec.x - ox, dy = sec.y - oy; if (!dx && !dy) return;
      board.cards.filter(k => !moved.has(k.id) && k.x + k.w / 2 > ox && k.x + k.w / 2 < ox + sec.w && k.y + k.h / 2 > oy && k.y + k.h / 2 < oy + sec.h).forEach(k => { k.x += dx; k.y += dy; renderCard(k); }); });
    cs.forEach(c => { c.x = Math.round(c.x); c.y = Math.round(c.y); renderCard(c); }); selectOnly(cs.map(c => c.id)); renderWires(); save();
  }
  $('selbar').addEventListener('click', e => { const b = e.target.closest('[data-arr]'); if (!b) return; e.stopImmediatePropagation(); arrange(b.dataset.arr); }, true);
  $('selbar').onclick = e => {
    const cs = selCards(), one = cs[0], dot = e.target.closest('[data-c]'), cdot = e.target.closest('[data-cc]'), a = e.target.closest('[data-sb]')?.dataset.sb;
    if (a === 'group' || a === 'ungroup') { remember(); return groupSel(a === 'group'); }
    if (a === 'section') return makeSection(cs);
    if (a === 'untilt') { setTilt(one, 0); return; }
    if (a === 'tiltpop') { openTiltPop(one, e.target.closest('[data-sb]')); return; }
    if (a === 'unsection') return removeSection(cs.filter(c => c.type === 'section'));
    if (a === 'rensection') return renameSection(one);
    const sc = e.target.closest('[data-sc]'); if (sc && one?.type === 'section') { remember(); one.color = sc.dataset.sc; renderCard(one); selectOnly([one.id]); $('selbar').dataset.key = ''; save(); return; }
    const redraw = () => { cs.forEach(c => renderCard(c)); selectOnly(cs.map(c => c.id)); $('selbar').dataset.key = ''; save(); };
    if (dot) { cs.filter(c => FILLABLE.includes(c.type)).forEach(c => c.color = dot.dataset.c); redraw(); }
    if (cdot) { one.color = cdot.dataset.cc; redraw(); }
    const sf = e.target.closest('[data-sf]'); if (sf) { if (sf.dataset.sf === 'none' && one.fill !== 'none' && one.shape !== 'line') autoBorder(one, fillOf(one)); one.fill = sf.dataset.sf; redraw(); }
    const ts = e.target.closest('[data-ts]'); if (ts) { const k = ts.dataset.ts, list = cs.filter(c => SIZED.includes(c.type)), isOn = c => c[k] ?? (k === 'bold' && ['title', 'coll'].includes(c.type)), to = !list.every(isOn);
      list.forEach(c => c[k] = to); redraw(); }
    if (e.target.closest('[data-sbfont]')) return boardFontPop(e.target.closest('[data-sbfont]'), cs.filter(c => SIZED.includes(c.type)));
    const fz = e.target.closest('[data-fs]'); if (fz) { cs.filter(c => SIZED.includes(c.type)).forEach(c => { if (fz.dataset.fs === 'm') delete c.fs; else c.fs = fz.dataset.fs; fitNote(c); }); redraw(); }
    if (a === 'crop') return startFrame(one);
    if (a === 'nobg') return removeBg(one);
    if (a === 'frame') { remember(); const d = one.noframe ? -1 : 1; one.x += 8 * d; one.y += 8 * d; one.w = Math.max(24, one.w - 16 * d); one.h = Math.max(24, one.h - 16 * d);   // the picture itself stays put: only the mat comes and goes
      if (one.noframe) delete one.noframe; else one.noframe = true; renderCard(one); selectOnly([one.id]); renderWires(); $('selbar').dataset.key = ''; save(); return; }
    const cr = e.target.closest('[data-crop]')?.dataset.crop; if (cr) return endCrop(cr);
    if (e.target.closest('[data-fill]')) return offerFill(spotsIn(cs));
    if (a === 'open') one.type === 'doc' ? openDoc(one) : openCanvas(one);
    if (a === 'visit') MB.openURL(one.url);
    if (a === 'relink') { one.draft = one.url; one.url = ''; one.image = ''; one.shot = false; one.h = 52; redraw(); }
    if (a === 'head') { one.head = one.head === false ? true : false; redraw(); }
    if (a === 'hidename') { one.hideName = !one.hideName; redraw(); }
    if (a === 'hidehex') { one.hideHex = !one.hideHex; redraw(); }
    if (a === 'pick') openColor(one);
    if (a === 'tag') { if (one.tagText) { delete one.tagText; redraw(); } else editTag(one); }   // tap again to take the label off
    if (a === 'edit') startEdit(one.id);
    if (a === 'del') removeSelected();
    if (a === 'mochi') { mochiOpen(true); $('mcInput').placeholder = cs.length === 1 ? 'Change this… “make it say…”, “turn it mint”' : `Change these ${cs.length}… “rename to step 1, 2, 3”`; }
  };

  // ---------- colors: the editor beside a color card, and the board's own palette ----------
  // the wheel works in HSV: hue = angle, saturation = distance from the middle, value = the brightness slider
  let colorCard = null, hsv = { h: 330, s: .4, v: 1 };
  const normHex = v => { let h = String(v || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map(x => x + x).join(''); return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null; };
  const hsv2rgb = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map(x => Math.round(x * 255)); };
  const rgb2hex = c3 => '#' + c3.map(x => x.toString(16).padStart(2, '0')).join('');
  const hex2hsv = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx }; };
  const wheelCv = $('wheelCv'), wg = wheelCv.getContext('2d');
  function drawWheel() {
    const N = wheelCv.width, R = N / 2, img = wg.createImageData(N, N), d = img.data;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - R + .5, dy = y - R + .5, r = Math.hypot(dx, dy), i = (y * N + x) * 4; if (r > R) continue;
      const [cr, cg, cb] = hsv2rgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, Math.min(1, r / R), hsv.v);
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = r > R - 1 ? Math.round((R - r) * 255) : 255;
    }
    wg.putImageData(img, 0, 0);
  }
  function showHSV() {
    const W = 220, a = hsv.h * Math.PI / 180, rr = hsv.s * W / 2;
    Object.assign($('wheelRing').style, { left: W / 2 + Math.cos(a) * rr + 'px', top: W / 2 + Math.sin(a) * rr + 'px', background: rgb2hex(hsv2rgb(hsv.h, hsv.s, hsv.v)) });
    $('bright').style.background = `linear-gradient(to right, #000, ${rgb2hex(hsv2rgb(hsv.h, hsv.s, 1))})`;
    Object.assign($('brightRing').style, { left: hsv.v * 100 + '%', background: rgb2hex(hsv2rgb(hsv.h, hsv.s, hsv.v)) });
  }
  function dragOn(el, fn) {
    el.addEventListener('pointerdown', e => { e.stopPropagation(); el.setPointerCapture(e.pointerId); fn(e); const mv = ev => fn(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); save(); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); });
  }
  dragOn($('wheel'), e => { const r = $('wheel').getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; hsv.s = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)); if (hsv.v < .05) hsv.v = 1; drawIfV(); setColor(rgb2hex(hsv2rgb(hsv.h, hsv.s, hsv.v)), 'wheel'); });
  dragOn($('bright'), e => { const r = $('bright').getBoundingClientRect(); hsv.v = clamp((e.clientX - r.left) / r.width, 0, 1); drawIfV(); setColor(rgb2hex(hsv2rgb(hsv.h, hsv.s, hsv.v)), 'wheel'); });
  let drawnV = -1; function drawIfV() { if (Math.abs(drawnV - hsv.v) > .004) { drawnV = hsv.v; drawWheel(); } showHSV(); }
  function placeColorPop(c) {
    const el = cardsEl.querySelector(`[data-id="${c.id}"]`), r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), pop = $('cpop');
    const dock = $('dock').getBoundingClientRect(), floor = Math.min(s.height, dock.top - s.top - 14), ph = pop.offsetHeight || 470;   // never over the bottom bar
    let x = r.right + 14 - s.left, y = r.top - s.top; if (x + 270 > s.width - 250) x = r.left - 270 - s.left; pop.style.left = Math.max(260, x) + 'px'; pop.style.top = clamp(y, 70, Math.max(70, floor - ph)) + 'px';
  }
  // colors for the wheel's quick row: your saved board colors, then colors already used on this board (most used first); none at all → the starter set
  // the wheel's quick colors: black + white always, then saved board colors, the color cards on the board (with their names), then other colors in use
  let cpAll = false;   // the wheel's colors: two easy rows, or every color on the board (remembered while the app is open)
  function boardColorRows(starter) {
    const norm = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : COLORS[v] || null, seen = new Set(['#000000', '#ffffff']);
    const take = list => list.filter(x => x.hex && !seen.has(x.hex) && seen.add(x.hex));
    const saved = take(board.styles.colors.map(p => ({ hex: p.hex.toLowerCase(), name: p.name })));
    const cards = take(board.cards.filter(c => c.type === 'swatch' && c.hex).map(c => ({ hex: c.hex.toLowerCase(), name: c.label || c.hex.toUpperCase() })));
    const count = new Map(); board.cards.forEach(c => c.type !== 'swatch' && ['color', 'fill', 'stroke'].forEach(k => { const h = norm(c[k]); if (h) count.set(h, (count.get(h) || 0) + 1); }));
    const used = take([...count].sort((a, b) => b[1] - a[1]).map(([h]) => ({ hex: h, name: h.toUpperCase() })));
    const dot = x => `<button style="background:${x.hex}" data-hex="${x.hex}" title="${esc(x.name)}"></button>`, row = (label, xs) => xs.length ? `<div class="cpq-l">${label}</div><div class="cpq-row">${xs.map(dot).join('')}</div>` : '';
    const bw = [{ hex: '#000000', name: 'Black' }, { hex: '#ffffff', name: 'White' }];
    if (!saved.length && !cards.length && !used.length) return `<div class="cpq-row">${[...bw, ...take(starter.map(h => ({ hex: h.toLowerCase(), name: h.toUpperCase() })))].map(dot).join('')}</div>`;
    const all = [...bw, ...saved, ...cards, ...used], FEW = 16;   // two rows of dots
    if (all.length <= FEW) return `<div class="cpq-row">${all.map(dot).join('')}</div>`;
    return cpAll ? row('Black & white', bw) + row('Board colors', saved) + row('Color cards', cards) + row('On this board', used) + `<button class="cpq-more" data-cpq="few">Fewer</button>`
      : `<div class="cpq-row">${all.slice(0, FEW).map(dot).join('')}</div><button class="cpq-more" data-cpq="all">All board colors (${all.length})</button>`;
  }
  function openColor(c) {
    $('cpop').classList.toggle('tint', !!c.tint); $('cpop').classList.toggle('from-bar', !!c.fromBar);
    if (c.tint) document.body.appendChild($('cpop')); else if ($('cpop').parentNode !== stage) stage.appendChild($('cpop'));   // UI colors sit above Settings; card colors stay on the board
    if (c.tint) {   // a UI color, not a color card: no name or palette, a few starting points, and a way back to the default
      colorCard = c; hsv = hex2hsv(c.hex); drawIfV(); $('cpHex').value = c.hex.toUpperCase(); $('cpDot').style.background = c.hex; $('cpTitle').textContent = c.title;
      $('cpQuick').innerHTML = c.boardColors ? boardColorRows(c.presets) : c.presets.map(h => `<button style="background:${h}" data-hex="${h}" title="${h.toUpperCase()}"></button>`).join('');
      $('cpQuick').classList.toggle('rows', !!c.boardColors); $('cpReset').hidden = !!c.boardColors; $('cpQuick').dataset.starter = c.boardColors ? JSON.stringify(c.presets) : '';
      const pop = $('cpop'); pop.classList.add('on'); const w = 252, h = pop.offsetHeight || 470;
      pop.style.left = clamp(c.at.x, 12, innerWidth - w - 12) + 'px'; pop.style.top = clamp(c.at.y, 12, innerHeight - h - 12) + 'px'; return;
    }
    colorCard = c; hsv = hex2hsv(c.hex); drawIfV();
    $('cpHex').value = c.hex.toUpperCase(); $('cpName').value = c.label || ''; $('cpDot').style.background = c.hex;
    $('cpQuick').innerHTML = board.styles.colors.map(p => `<button style="background:${p.hex}" data-hex="${p.hex}" title="${esc(p.name)}"></button>`).join('');
    $('cpSave').textContent = board.styles.colors.some(p => p.hex === c.hex) ? 'Update board color' : 'Save to board colors'; $('cpSave').classList.remove('saved-ok');
    placeColorPop(c); $('cpop').classList.add('on');
  }
  function closeColor() { $('cpop').classList.remove('on'); colorCard = null; }
  function setColor(hex, from) {
    if (colorCard && colorCard.tint && hex) { colorCard.hex = hex; $('cpDot').style.background = hex; if (from !== 'hex') $('cpHex').value = hex.toUpperCase(); if (from !== 'wheel') { hsv = hex2hsv(hex); drawIfV(); } colorCard.apply(hex); return; }
    if (!colorCard || !hex) return; colorCard.hex = hex; $('cpDot').style.background = hex;
    if (from !== 'hex') $('cpHex').value = hex.toUpperCase();
    if (from !== 'wheel') { hsv = hex2hsv(hex); drawIfV(); }
    const named = board.styles.colors.find(p => p.hex === hex); if (named && from !== 'name') { colorCard.label = named.name; $('cpName').value = named.name; }
    else if (colorCard.autoName !== false && from !== 'name') { colorCard.label = colorName(hex); colorCard.autoName = true; $('cpName').value = colorCard.label; }
    $('cpSave').textContent = named ? 'Update board color' : 'Save to board colors'; $('cpSave').classList.remove('saved-ok');
    renderCard(colorCard); selectOnly([colorCard.id]); if (from !== 'wheel') save();
  }
  $('cpHex').oninput = e => { const h = normHex(e.target.value); if (h) setColor(h, 'hex'); };
  $('cpName').oninput = e => { if (!colorCard) return; colorCard.autoName = false; colorCard.label = e.target.value; renderCard(colorCard); selectOnly([colorCard.id]); save(); };
  $('cpQuick').onclick = e => { const m = e.target.closest('[data-cpq]'); if (m) { cpAll = m.dataset.cpq === 'all'; $('cpQuick').innerHTML = boardColorRows(JSON.parse($('cpQuick').dataset.starter || '[]')); keepCpopOnScreen(); return; }
    const b = e.target.closest('[data-hex]'); if (b) setColor(b.dataset.hex, 'quick'); };
  const keepCpopOnScreen = () => { const p = $('cpop'), r = p.getBoundingClientRect(); if (r.bottom > innerHeight - 12) p.style.top = Math.max(12, innerHeight - r.height - 12) + 'px'; };
  $('cpSave').onclick = () => {
    if (!colorCard) return; const name = (colorCard.label || '').trim() || colorCard.hex.toUpperCase(), hit = board.styles.colors.find(p => p.hex === colorCard.hex);
    if (hit) hit.name = name; else board.styles.colors.push({ hex: colorCard.hex, name });
    colorCard.label = name; renderCard(colorCard); selectOnly([colorCard.id]); renderPalette(); save(); openColor(colorCard);
    $('cpSave').textContent = 'Saved ✓'; $('cpSave').classList.add('saved-ok'); chirp(`Saved “${name}” to this board's colors ✦`, 3500);
  };
  $('cpDone').onclick = closeColor;
  addEventListener('pointerdown', e => { if ($('cpop').classList.contains('on') && !e.target.closest('.cpop, .card.swatch, [data-col]')) closeColor(); }, true);
  $('cpReset').onclick = () => { if (colorCard && colorCard.tint) { colorCard.reset(); closeColor(); } };
  const PRESETS = { bg: ['#fbf8fc', '#ffffff', '#fff6f9', '#fffaf0', '#f4fbf6', '#f3f8ff', '#f6f2ff', '#1c1920', '#232733', '#2b2433'], dot: ['#e3dcee', '#f2c9da', '#cfe8d9', '#cfe0f5', '#e6dcff', '#d8d2dd', '#35303c', '#4a4452'],
    panel: ['#ffffff', '#fff6f9', '#fffaf0', '#f4fbf6', '#f3f8ff', '#f6f2ff', '#26222b', '#2f2a36'], accent: ['#f27aa8', '#ff8a5c', '#f3c84a', '#3fbf86', '#4aa3f0', '#9b7bff', '#494848'],
    cursor: ['#ff9ec4', '#ffc8a6', '#f8e08a', '#a8e6c3', '#aed3ff', '#cdb8ff', '#ffffff', '#494848'] };
  const COLOR_TITLES = { bg: 'Board background', dot: 'Dots', panel: 'Panels', accent: 'Accent', cursor: 'Your cursor' };
  // open the wheel for a UI color; `forBoard` means just this board's background (from a right-click)
  function tintPicker(key, at, forBoard) {
    const set = hex => { if (key === 'cursor') settings.cursor = hex; else if (forBoard) { board.bg = hex; save(); } else myColors()[key] = hex; applySettings(); };
    openColor({ tint: true, title: forBoard ? 'This board’s background' : COLOR_TITLES[key], hex: key === 'cursor' ? settings.cursor : forBoard ? (board.bg || colorOf('bg')) : colorOf(key), presets: PRESETS[key], at,
      apply: set, reset: () => { if (key === 'cursor') settings.cursor = '#ff9ec4'; else if (forBoard) { delete board.bg; save(); } else delete myColors()[key]; applySettings(); } });
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-col]'); if (!b) return; const r = b.getBoundingClientRect(); tintPicker(b.dataset.col, { x: r.left - 270, y: r.top - 120 }); });
  // ---------- text styles: like Board colors, for type. Save how a note's or title's words look, then put it on other text with one click ----------
  const TS_KEYS = ['font', 'fs', 'bold', 'italic', 'under', 'strike', 'align', 'lh', 'ls', 'tcase', 'tc', 'stroke', 'sw', 'sdash'];
  const TS_TITLE = ['tc', 'stroke', 'sw', 'sdash'];   // a title's text color and outline (on a note these are the card's fill and border, so they only pass title to title)
  // sizes travel as real pixels (a 44 px heading stays 44 px on a note), and bold as on/off (titles are bold unless you said otherwise)
  const tsOf = c => { const s = {}; TS_KEYS.forEach(k => { if (k !== 'fs' && c[k] != null && (!TS_TITLE.includes(k) || c.type === 'title')) s[k] = c[k]; });
    s.px = fsPx(c); s.bold = c.bold ?? ['title', 'coll'].includes(c.type); return { type: c.type, s }; };
  const tsPx = st => st.s.px || fsPx({ type: st.type, fs: st.s.fs });   // (fs: styles saved before sizes were pixels)
  const tsLabel = st => [st.s.font || 'Default font', tsPx(st) + ' px', st.s.tcase === 'upper' ? 'CAPS' : ''].filter(Boolean).join(' · ');
  function applyTextStyle(st, cs) {
    const list = cs.filter(c => SIZED.includes(c.type)); if (!list.length) return false; remember();
    list.forEach(c => { TS_KEYS.forEach(k => { if (k === 'fs' || TS_TITLE.includes(k) && !(c.type === 'title' && st.type === 'title')) return; if (k in st.s) c[k] = st.s[k]; else delete c[k]; });
      const m = +(tsPx(st) / (FS_BASE[c.type] || 15)).toFixed(4), hit = Object.keys(FS).find(z => Math.abs(FS[z] - m) < .02); if (hit === 'm') delete c.fs; else c.fs = hit || m;
      if (st.s.font) useFont?.(st.s.font); renderCard(c); fitText(c); fitNote(c); });
    $('selbar').dataset.key = ''; selectOnly(list.map(c => c.id)); save(); return true;
  }
  function saveTextStyle(c) {
    if (!c || !SIZED.includes(c.type)) return chirp('Select a note or title first, then save its text style ✦', 3000);
    const base = { title: 'Heading', note: 'Note text', todo: 'List text', shape: 'Label', coll: 'Group name' }[c.type] || 'Text';
    let name = base, k = 2; while (board.styles.text.some(t => t.name === name)) name = base + ' ' + k++;
    board.styles.text.push({ name, ...tsOf(c) }); renderTextStyles(); save(); chirp(`Saved “${name}” to Text styles ✦ Click it to use it on other text`, 3500);
    setTimeout(() => $('tstyles').querySelector('.tsr:last-of-type span')?.dispatchEvent(new MouseEvent('dblclick')), 50);
  }
  function renderTextStyles() {
    const el = $('tstyles'); if (!el || !board) return; const list = board.styles.text;
    el.innerHTML = `<div class="ts-h">Text styles</div>` + (list.length ? '' : '<div class="palette-empty">Style some text, then right-click it → Save text style. Click a style to put it on what you select.</div>');
    list.forEach((st, i) => {
      const r = document.createElement('div'); r.className = 'tsr'; r.title = 'Click to use it on what you selected. Right-click to rename, update or remove it';
      r.innerHTML = '<span></span><small></small>'; const name = r.querySelector('span'); name.textContent = st.name; r.querySelector('small').textContent = tsLabel(st);
      Object.assign(name.style, { fontFamily: st.s.font ? `"${st.s.font}", var(--font)` : '', fontWeight: (st.s.bold ?? (st.type === 'title' || st.type === 'coll')) ? 800 : 500, fontStyle: st.s.italic ? 'italic' : '', textDecoration: [st.s.under && 'underline', st.s.strike && 'line-through'].filter(Boolean).join(' '),
        textTransform: { upper: 'uppercase', lower: 'lowercase', title: 'capitalize' }[st.s.tcase] || '', letterSpacing: typeof st.s.ls === 'number' ? st.s.ls / 100 + 'em' : '', color: st.type === 'title' && st.s.tc && st.s.tc !== 'none' ? st.s.tc : '' });
      if (st.s.font) useFont?.(st.s.font);
      const rename = () => { name.contentEditable = 'true'; name.focus(); getSelection().selectAllChildren(name);
        name.onblur = () => { name.contentEditable = 'false'; const v = name.textContent.trim(); if (v) st.name = v; renderTextStyles(); save(); };
        name.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); name.blur(); } if (ev.key === 'Escape') { name.textContent = st.name; name.blur(); } ev.stopPropagation(); }; };
      name.ondblclick = e => { e.stopPropagation(); rename(); };
      r.onclick = () => { if (name.isContentEditable) return;
        if (applyTextStyle(st, selCards())) return;
        if (sel.size) return chirp('Those cards have no text to style. Select some text, or click empty board first for a new note ✦', 3200);
        const c = addAtCenter(st.type === 'title' ? 'title' : 'note', { text: st.name }); if (!c) return; applyTextStyle(st, [c]);
        setTimeout(() => { startEdit(c.id); const t = cardsEl.querySelector(`[data-id="${c.id}"] [contenteditable="true"]`); if (t) getSelection().selectAllChildren(t); }, 30); };   // ready to type over
      r.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); const one = selCards().find(c => SIZED.includes(c.type)); boardMenu(e, [
        { label: 'Use on selected text', run: () => applyTextStyle(st, selCards()) || chirp('Select some text first ✦', 2500) },
        { label: 'Rename', run: rename },
        ...(one ? [{ label: 'Update from selected text', run: () => { Object.assign(st, tsOf(one)); renderTextStyles(); save(); chirp(`Updated “${st.name}” ✦`, 2500); } }] : []),
        '-', { label: 'Remove from text styles', danger: true, run: () => { board.styles.text.splice(i, 1); renderTextStyles(); save(); } }]); };
      el.appendChild(r);
    });
  }
  function renderPalette() {
    renderTextStyles();
    const el = $('palette'); el.innerHTML = '';
    if (!board.styles.colors.length) { el.innerHTML = '<div class="palette-empty">Click a color card to name it and save it here. Each board keeps its own palette.</div>'; return; }
    board.styles.colors.forEach((p, i) => {
      const r = document.createElement('div'); r.className = 'pal'; r.title = 'Click to add to the board';
      r.innerHTML = `<i style="background:${p.hex}"></i><span></span><small>${p.hex.slice(1)}</small>`;
      r.title = 'Click to add it to the board. Right-click to rename, change or remove it';
      const name = r.querySelector('span'); name.textContent = p.name;
      const rename = () => { name.contentEditable = 'true'; name.focus(); getSelection().selectAllChildren(name);
        const done = () => { name.contentEditable = 'false'; const v = name.textContent.trim(); if (v) { p.name = v; board.cards.filter(c => c.type === 'swatch' && c.hex === p.hex).forEach(c => { c.label = v; renderCard(c); }); } renderPalette(); save(); };
        name.onblur = done; name.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); name.blur(); } if (ev.key === 'Escape') { name.textContent = p.name; name.blur(); } ev.stopPropagation(); }; };
      // change the color itself: color cards on the board that use it follow along
      const recolor = e => { const was = p.hex, rr = r.getBoundingClientRect();
        openColor({ tint: true, title: `Change “${p.name}”`, hex: p.hex, presets: [p.hex, ...board.styles.colors.filter(x => x !== p).map(x => x.hex)].slice(0, 10), at: { x: rr.right + 12, y: rr.top - 60 },
          apply: hex => { const from = p.hex; p.hex = hex; board.cards.filter(c => c.type === 'swatch' && c.hex === from).forEach(c => { c.hex = hex; renderCard(c); }); r.querySelector('i').style.background = hex; r.querySelector('small').textContent = hex.slice(1); save(); },
          reset: () => { const from = p.hex; p.hex = was; board.cards.filter(c => c.type === 'swatch' && c.hex === from).forEach(c => { c.hex = was; renderCard(c); }); renderPalette(); save(); } }); };
      r.onclick = () => { if (name.isContentEditable) return; addAtCenter('swatch', { hex: p.hex, label: p.name }); };
      r.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); boardMenu(e, [
        { label: 'Add to the board', run: () => addAtCenter('swatch', { hex: p.hex, label: p.name }) },
        { label: 'Rename', run: rename },
        { label: 'Change color…', run: recolor },
        '-',
        { label: 'Remove from board colors', danger: true, run: () => { board.styles.colors.splice(i, 1); renderPalette(); save(); chirp(`Removed “${p.name}” from this board's colors`, 2500); } }]); };
      el.appendChild(r);
    });
  }

  // ---------- the floating boxes: minimize to their title, remembered between launches ----------
  const boxState = (() => { try { return JSON.parse(localStorage.getItem('mochiboard:boxes') || '{}'); } catch (e) { return {}; } })();
  document.querySelectorAll('.box').forEach(b => {
    const k = b.dataset.box, btn = b.querySelector('.mini:not(.home-btn):not(.gear)');
    const set = min => { b.classList.toggle('min', min); btn.textContent = min ? '+' : '–'; btn.title = min ? 'Open' : 'Minimize'; boxState[k] = min; try { localStorage.setItem('mochiboard:boxes', JSON.stringify(boxState)); } catch (e) {} };
    set(!!boxState[k]); btn.onclick = () => set(!b.classList.contains('min'));
  });
  $('keysX').onclick = () => { settings.keys = false; applySettings(); };

  // the board area never scrolls (it pans instead); if focusing something nudges it, snap it straight back
  [stage, document.scrollingElement].forEach(el => el && el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }));
  addEventListener('scroll', () => { if (scrollX || scrollY) scrollTo(0, 0); });

  world.appendChild($('guides')); setTimeout(placeTray, 0); renderDesign();
  // ---------- updates: check GitHub for a newer Mochiboard (about once a day), show what's new, update with one tap ----------
  let updInfo = null;
  if (!MB.native) $('setUpdate').style.display = 'none';   // updating is a Mac app thing: the web version changes when the site does
  async function checkUpdate(force) {
    if (document.documentElement.classList.contains('beta')) return;   // the Beta build is ahead of every release; updates come from ./install.sh --beta
    if (!MB.native) return;
    let last = 0; try { last = +localStorage.getItem('mochiboard:updChecked') || 0; } catch (e) {}
    if (!force && Date.now() - last < 15 * 60 * 1000 && updInfo) return showUpdate();   // at most every 15 minutes (it used to wait 20 hours, so an app left open never noticed)
    $('suSub').textContent = 'Checking for a new version…';
    try { updInfo = await MB.updateCheck(); localStorage.setItem('mochiboard:updChecked', Date.now()); } catch (e) { updInfo = { error: true }; }
    showUpdate(true);
  }
  function showUpdate(fresh) {
    const u = { ...(updInfo || {}) }, n = u.behind || 0;
    if (u.since && !u.release) { const d = new Date(u.since + 'T12:00'); if (!isNaN(d)) u.since = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    $('gearBtn').classList.toggle('has-update', n > 0);
    $('setUpdate').classList.toggle('ready', n > 0);
    $('suGo').hidden = !(n > 0);
    $('suTitle').textContent = n > 0 ? `A new Mochiboard is ready ✦` : 'Updates';
    $('suSub').textContent = !u.repo && !u.release ? 'To get updates, update once from Terminal with ./install.sh --update. After that it works from here.'
      : u.offline ? 'I couldn’t reach GitHub just now. I’ll try again later.'
      : u.release ? (n > 0 ? `Version ${String(u.latest || '').replace(/^v/, '')} is ready (you have ${u.since}). Your boards and settings stay just as they are.` : `You’re up to date (version ${u.since}).`)
      : n > 0 ? `${n} update${n > 1 ? 's' : ''} since your version${u.since ? ' from ' + u.since : ''}. Your boards and settings stay just as they are.`
      : `You’re up to date${u.since ? ' (version from ' + u.since + ')' : ''}.`;
    const notes = (u.notes || []).slice(0, 8);
    $('suNotes').hidden = !(n > 0 && notes.length);
    $('suNotes').innerHTML = notes.map(t => `<li>${esc(t)}</li>`).join('');
    // a quiet bar on the board instead of a pop-up: shown once there's a new version, hidden with × until the next one
    const ver = String(u.latest || u.since || '').replace(/^v/, '').replace(/\.0$/, ''), key = (u.latest || '') + ':' + (u.since || '') + ':' + n; let hid = ''; try { hid = localStorage.getItem('mochiboard:upbarHidden') || ''; } catch (e) {}
    $('ubText').textContent = u.latest ? `Mochiboard ${ver} is ready` : 'A new Mochiboard is ready';
    $('ubGo').disabled = false; $('ubGo').textContent = 'Update now'; $('upBar').classList.remove('busy');
    // the first time there's an update, the bar asks once if Mochi may keep things up to date; the answer becomes a switch in Settings
    const asking = n > 0 && (settings.autoUpdate === undefined || (u.preview && !showUpdate.answered));   // the preview always asks, so it can be shown again
    $('upBar').classList.toggle('ask', asking); requestAnimationFrame(fitUpBar); $('ubYes').hidden = $('ubNo').hidden = !asking; $('ubNotes').hidden = $('ubGo').hidden = asking;
    if (asking) $('ubText').textContent = `Mochiboard ${ver} is ready. Keep it up to date for you?`;
    else if (n > 0 && settings.autoUpdate) $('ubText').textContent = `Mochiboard ${ver} is ready. I’ll put it in when you quit, or`;
    if (n > 0 && settings.autoUpdate && !asking) prepareUpdate();
    $('upBar').hidden = !(n > 0) || (!asking && hid === key && !u.preview); $('upBar').dataset.key = key;
    fitUpBar();
  }
  $('suCheck').onclick = () => checkUpdate(true);
  setInterval(() => checkUpdate(), 60 * 60 * 1000);   // still open: look again every hour
  addEventListener('focus', () => checkUpdate());   // and whenever you come back to the window (no more than every 15 minutes)
  ['pointerdown', 'mousedown', 'dblclick'].forEach(t => $('upBar').addEventListener(t, e => e.stopPropagation()));
  // the bar sits at the top centre; if it would touch the board's name, it slides down just below it
  function fitUpBar() { const b = $('upBar'); if (b.hidden) return; b.classList.remove('low'); b.style.left = '';
    // centre it in the open space between the board's name and the panels on the right; only if that's too tight does it step down
    const st = stage.getBoundingClientRect(), t = document.querySelector('.top')?.getBoundingClientRect(), w = b.getBoundingClientRect().width;
    const right = [$('design'), $('tray')].map(el => el?.getBoundingClientRect()).filter(r => r && r.width && r.top < 140).reduce((m, r) => Math.min(m, r.left), st.right);
    const from = (t ? t.right : st.left) + 20, to = right - 20;
    if (to - from >= w) b.style.left = (from + to) / 2 - st.left + 'px';
    else if (t) { const r = b.getBoundingClientRect(); if (r.left < t.right + 16 && r.right > t.left - 16) b.classList.add('low'); } }
  addEventListener('resize', () => fitUpBar());   // the board mustn't grab presses on the bar
  // automatic updates: get the new version ready quietly; it goes in when Mochiboard quits
  let preparing = null;
  function prepareUpdate() { if (preparing || !MB.updatePrepare) return; preparing = MB.updatePrepare().catch(() => { preparing = null; }); }
  $('ubYes').onclick = () => { showUpdate.answered = true; settings.autoUpdate = true; applySettings(); showUpdate(); prepareUpdate(); $('ubText').textContent = 'Lovely ✦ I’ll update when you quit Mochiboard, or'; fitUpBar(); };
  $('ubNo').onclick = () => { showUpdate.answered = true; settings.autoUpdate = false; applySettings(); showUpdate(); };
  $('ubX').onclick = () => { try { localStorage.setItem('mochiboard:upbarHidden', $('upBar').dataset.key || ''); } catch (e) {} $('upBar').hidden = true; };
  $('ubNotes').onclick = () => { $('gearBtn').click(); setTab('about'); setTimeout(() => $('setUpdate').scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); };
  $('ubGo').onclick = async () => {
    $('ubGo').disabled = true; $('ubGo').textContent = 'Updating…'; $('upBar').classList.add('busy'); $('ubText').textContent = 'Getting the new version. Mochiboard will reopen in a moment';
    try { await MB.updateNow(); } catch (e) { $('ubText').textContent = e.message; $('ubGo').textContent = 'Update now'; $('ubGo').disabled = false; $('upBar').classList.remove('busy'); }
  };
  $('suGo').onclick = async () => {
    $('suGo').disabled = true; $('suGo').textContent = 'Updating…'; $('suSub').textContent = 'Getting the new version and rebuilding. Mochiboard will close and reopen in about 30 seconds.';
    try { await MB.updateNow(); } catch (e) { $('suGo').disabled = false; $('suGo').textContent = 'Update now'; $('suSub').textContent = e.message; }
  };
  document.querySelectorAll('[data-url]').forEach(b => b.onclick = () => MB.openURL(b.dataset.url));

  // ---------- first run: set up with Mochi, then an optional hands-on tour ----------
  const OB_N = 6; let obAt = 0;
  function obGo(i) {
    obAt = clamp(i, 0, OB_N - 1);
    document.querySelectorAll('.ob-step').forEach(s => s.classList.toggle('on', +s.dataset.step === obAt));
    $('obDots').innerHTML = Array.from({ length: OB_N }, (_, k) => `<i class="${k === obAt ? 'on' : k < obAt ? 'done' : ''}"></i>`).join('');
    $('obBack').style.visibility = obAt ? 'visible' : 'hidden'; $('obNext').textContent = obAt === 0 ? "Let's go" : 'Next';
    $('onboard').classList.toggle('last', obAt === OB_N - 1); $('obSkip').style.display = obAt === OB_N - 1 ? 'none' : '';
    if (obAt === 2) showConnections(true);
    if (obAt === OB_N - 1) $('obDoneTitle').textContent = `You're all set${settings.name ? ', ' + settings.name : ''}!`;
    if (obAt === 0) setTimeout(() => $('obName').focus(), 50);
    goos[4].hop(); goos[5].hop();
  }
  function openSetup() { closeSettings(); $('obName').value = settings.name || ''; applySettings(); $('onboard').classList.add('on'); obGo(0); }
  function finishSetup(tour) {
    settings.name = $('obName').value.trim().slice(0, 40); applySettings();
    try { localStorage.setItem('mochiboard:onboarded', '1'); } catch (e) {}
    $('onboard').classList.remove('on');
    if (tour) setTimeout(startTour, 350); else say(`Have fun${settings.name ? ', ' + settings.name : ''}! Click me anytime to chat ✦`, 6000);
  }
  $('obNext').onclick = () => { if (obAt === 0) { settings.name = $('obName').value.trim().slice(0, 40); applySettings(); } obGo(obAt + 1); };
  $('obBack').onclick = () => obGo(obAt - 1);
  $('obSkip').onclick = () => finishSetup(false);
  $('obTour').onclick = () => finishSetup(true);
  $('obExplore').onclick = () => finishSetup(false);
  $('obRecheck').onclick = () => showConnections(true);
  $('obName').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('obNext').click(); } e.stopPropagation(); };
  function obKeys(e) {
    if (e.target.closest?.('input')) return;
    if (e.key === 'ArrowRight') obGo(obAt + 1); if (e.key === 'ArrowLeft') obGo(obAt - 1);
    if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); obAt < OB_N - 1 ? $('obNext').click() : $('obTour').click(); }
  }
  $('redoSetup').onclick = openSetup;
  $('redoTour').onclick = () => { closeSettings(); setTimeout(startTour, 250); };

  // the tour: Mochi points at each part; some steps you try for real and she notices
  const TOUR = [
    { el: '#tools', side: 'top', text: 'These are your tools: notes, docs, checklists, titles, collections, links, images, voice memos, colors, shapes, stamps and drawing. Pick one, then click the board to place it.', try: 'Try it: add a note (or double-click the board).', done: t => board.cards.length > t.cards },
    { el: null, text: 'Got an idea mid-thought? Press ⌘K, type it, hit Enter. It goes to Unsorted so you never lose your place.', try: 'Try it: press ⌘K and jot something down.', done: t => board.tray.length > t.tray },
    { el: '#tray', side: 'left', text: 'Unsorted holds your quick ideas. Drag one onto the board when it finds a home, or ask me to sort them all.' },
    { el: '#side .box', side: 'right', text: 'Your boards live here. Group them into projects and folders. Right-click anything to rename, move, duplicate or delete it.' },
    { el: '#design', side: 'left', text: 'Wireframes: screens, boxes, text, icons, and ready-made pieces, from nav bars to whole website sections. Things snap into line as you move them.' },
    { el: '#mPill', side: 'top', text: "And that's me! Click me to chat. Ask me to sort your notes, plan a project, explore fonts, or build screens and whole landing pages. I'll take you right to whatever I make." },
    { el: '#gearBtn', side: 'right', text: 'Everything from setup lives in Settings, and you can replay this tour there anytime. Have fun! ✦' },
  ];
  let tourAt = -1, tourPoll = 0;
  function startTour() { if (homeAt) closeHome(); if (chatOpen()) mochiOpen(false); $('mBubble').classList.remove('on'); $('coach').classList.add('on'); tourGo(0); }
  function endTour() { clearInterval(tourPoll); tourAt = -1; $('coach').classList.remove('on'); }
  function tourGo(i) {
    clearInterval(tourPoll);
    if (i >= TOUR.length) { endTour(); say(`You're ready${settings.name ? ', ' + settings.name : ''}! Click me whenever you want help ✦`, 0,
      [{ label: 'Brainstorm with me', cls: 'next', run: () => ask('Help me brainstorm a new project. Ask me one question to start.') },
       { label: 'Build me a landing page', cls: 'next', run: () => { mochiOpen(true); $('mcInput').value = 'Build me a landing page for '; $('mcInput').focus(); } }]); return; }
    tourAt = i; const st = TOUR[i], start = { cards: board.cards.length, tray: board.tray.length };
    $('coachStep').textContent = `${i + 1} of ${TOUR.length}`; $('coachText').textContent = st.text;
    $('coachTry').textContent = st.try || ''; $('coachTry').classList.remove('yay'); $('coachTry').style.display = st.try ? '' : 'none';
    $('coachNext').textContent = i === TOUR.length - 1 ? 'Done ✦' : 'Continue';
    placeCoach(); goos[6].hop();
    if (st.done) tourPoll = setInterval(() => { if (tourAt !== i || !st.done(start)) return; clearInterval(tourPoll);
      $('coachTry').textContent = 'Nice! ✦'; $('coachTry').classList.add('yay'); hopMochi(); setTimeout(() => tourAt === i && tourGo(i + 1), 1200); }, 250);
  }
  function placeCoach() {
    if (tourAt < 0) return; const st = TOUR[tourAt], t = st.el && document.querySelector(st.el), card = $('coachCard'), ring = $('coachRing');
    const r = t && t.getBoundingClientRect(), ok = r && r.width > 0 && r.height > 0, cw = card.offsetWidth, ch = card.offsetHeight, W = innerWidth, H = innerHeight;
    ring.style.display = ok ? '' : 'none'; $('coach').classList.toggle('dim', !ok);
    let x = (W - cw) / 2, y = (H - ch) / 2;
    if (ok) { Object.assign(ring.style, { left: r.left - 8 + 'px', top: r.top - 8 + 'px', width: r.width + 16 + 'px', height: r.height + 16 + 'px' });
      if (st.side === 'top') { x = r.left + r.width / 2 - cw / 2; y = r.top - ch - 26; }
      else if (st.side === 'left') { x = r.left - cw - 26; y = r.top + Math.min(r.height, 300) / 2 - ch / 2; }
      else if (st.side === 'right') { x = r.right + 26; y = r.top + Math.min(r.height, 300) / 2 - ch / 2; } }
    card.style.left = clamp(x, 16, W - cw - 16) + 'px'; card.style.top = clamp(y, 16, H - ch - 16) + 'px';
  }
  addEventListener('resize', placeCoach);
  $('coachNext').onclick = () => tourGo(tourAt + 1);
  $('coachSkip').onclick = endTour;
  $('coachCard').addEventListener('pointerdown', e => e.stopPropagation());

  if (MB.web) document.body.classList.add('web');
  document.querySelectorAll('.get-app').forEach(b => b.onclick = e => { e.stopPropagation(); getApp(); });
  // ---------- what's new: a little card, once, the first time a new version opens ----------
  const NEWS = { '1.8.0': [
    ['<circle cx="8" cy="10" r="5.5"/><rect x="7" y="4" width="10" height="12" rx="2"/>', 'Masks, the Figma way', 'A shape, a pen line or a cut-out over anything becomes the window onto it: right-click → Mask. Layers shows the group, and there are ready-made circles, hearts and blobs.'],
    ['<circle cx="7.5" cy="10" r="5"/><circle cx="12.5" cy="10" r="5"/>', 'Combine shapes', 'Union, Subtract, Intersect and Exclude for drawn things, and Separate to take them apart again.'],
    ['<rect x="2.5" y="3" width="6" height="4" rx="1"/><path d="M11.5 10l3-3 3 3-3 3z"/><rect x="2.5" y="13" width="6" height="4" rx="1"/><path d="M8.5 5h3M8.5 15h3M12 7.5V5h-.5M12 12.5V15h-.5"/>', 'Flowcharts that line up, and 14 templates', 'Set a shape down near another and it connects and slides into line. The Templates button in the Flowchart tab has log in, checkout, bug triage and more, with the thinking beside each.'],
    ['<rect x="3" y="3" width="14" height="14" rx="2.5"/><path d="M3 12l4-4 4 4 2-2 4 4"/><circle cx="13" cy="7" r="1.2"/>', 'Pictures grew up', 'Crop inside the frame, real drop shadows, a stroke as the mat, corners that are the corners, remove the background, drop a file on a picture to swap it, save any picture as PNG or JPEG.'],
    ['<path d="M8 12.5l4-5"/><path d="M7 14.5a3 3 0 0 1-4.2-4.2l2-2a3 3 0 0 1 4.2 0"/><path d="M13 5.5a3 3 0 0 1 4.2 4.2l-2 2a3 3 0 0 1-4.2 0"/>', 'Links with a screenshot', 'A link card shows what the page looks like. Paste jessa.art without the https:// and it still reads as a link.'],
    ['<path d="M4 16V4h8l4 4v8z"/><path d="M7 9h6M7 12h6"/>', 'Learn, inside the app', 'An 80-term UX dictionary and the design principle sets, no Claude needed. Mochi also says what she’s doing while she thinks, and makes login flows, sitemaps and flowcharts offline.'],
    ['<path d="M10 3v14M3 10h14"/><path d="M6 6l8 8M14 6l-8 8" opacity=".4"/>', 'Little things', 'Export only what you selected on a transparent background. Right-click menus everywhere, lines included. Arrow keys nudge. New stamps under New ✦.'],
  ], '1.7.4': [
    ['<path d="M4 15.5c2-4 4-6 6-6s4 2 6 6"/><circle cx="10" cy="5.5" r="2"/><path d="M3 17.5h14"/>', 'A first board to dream on', 'New boards start from Jessa’s poster: “You can literally do anything, if you dream it.” Every piece of it is movable, so it’s a start, not a lesson.'],
    ['<path d="M10 2.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 7.8l5-.7z"/>', 'Signed by Apple', 'The Mac app is signed and notarized, so it opens on the first double-click with no warning and no trip to System Settings.'],
   ], '1.1.0': [
    ['<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><path d="M14 11.5v5M11.5 14h5"/>', 'Design thinking templates', 'Affinity maps, journey maps, impact / effort and more, from the new button in the toolbar. Each one comes with an example and a how-to note from me.'],
    ['<path d="M6 15.5h8.2a3.3 3.3 0 0 0 .6-6.5 4.6 4.6 0 0 0-8.9-.9A3.7 3.7 0 0 0 6 15.5z"/><path d="M3.5 3.5l13 13"/>', 'Works without internet', 'Your boards keep working offline. I’ll tell you when I can’t think with Claude and pick back up when you’re online.'],
    ['<circle cx="5" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="5" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="5" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/>', 'Canvases go anywhere', 'Drag a canvas onto another board, into a folder, or right-click to make it its own board.'],
    ['<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>', 'Tidier Settings', 'Settings has tabs now, and Helpers shows how much Claude I’ve used, with a link to your plan’s limits.'],
  ], '1.2.0': [
    ['<path d="M4.5 3.5l11 5.2-4.6 1.4-1.6 4.6z"/><path d="M11 10.2l4 4.3"/>', 'Your own cursor', 'Your name and color follow your mouse around the board. Pick them in Settings → General.'],
    ['<path d="M10 2.8a7.2 7.2 0 1 0 0 14.4c1.2 0 1.8-.9 1.4-1.9-.5-1.1.2-2.3 1.4-2.3h1.7a2.7 2.7 0 0 0 2.7-2.7c0-4.2-3.2-7.5-7.2-7.5z"/><circle cx="6.6" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="6.2" r=".9" fill="currentColor"/><circle cx="12.6" cy="6.8" r=".9" fill="currentColor"/>', 'Your colors', 'Change the board, dots, panels and accent. Right-click any board for its own background.'],
    ['<path d="M10 3l7 3.8-7 3.8-7-3.8z"/><path d="M3 10.2l7 3.8 7-3.8"/><path d="M3 13.6l7 3.8 7-3.8"/>', 'Layers', 'Everything on the board in one list. Pick, rename, hide, lock and restack, like Figma.'],
    ['<rect x="3.5" y="3.5" width="13" height="13" rx="2"/><path d="M11 16.5h5.5V11M16.5 16.5l-5-5"/>', 'Reshape wireframes', 'Drag any piece’s corner to resize it. Double-click to reach inside a button or input.'],
    ['<path d="M13.5 3.5l3 3L8 15l-4 1 1-4z"/><path d="M3 18.5h14" stroke-width="1.2"/>', 'Any pen size', 'A slider for every thickness, and [ and ] while you draw. Stamps are all pixel art now too.'],
    ['<path d="M11 2.5L4.5 11h5l-1 6.5L15.5 9h-5z"/>', 'Smoother', 'Dragging and zooming glide on big boards, and the dots stay the same size as you zoom.'],
  ], '1.3.0': [
    ['<path d="M5.5 2.5h6l4 4v11h-10z"/><path d="M11.5 2.5v4h4"/><path d="M8 10h5M8 13h5"/>', 'Real docs', 'Styles, any font on your Mac, colors and highlights, lists, tables and pictures. Open any doc to try it.'],
    ['<path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6z"/><path d="M15.5 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>', 'Mochi edits with you', 'Select words in a doc and ask me to make them shorter, clearer, friendlier, or anything you type.'],
    ['<path d="M10 3v9.5M6 8.5l4 4 4-4"/><path d="M4 16.5h12"/>', 'PDF and Word', 'Download any doc as a PDF or a Word file, on Letter or A4 pages. Headings, lists and tables come along.'],
    ['<path d="M7.5 4.5h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z"/><path d="M8 10.5l1.5 1.5L12.5 9"/>', 'Easier to set up', 'I find Claude Code wherever it lives, and a step-by-step guide shows up if I can\u2019t think yet.'],
 ], '1.4.0': [
    ['<rect x="2.5" y="5.5" width="10.5" height="9" rx="2.2"/><path d="M13 9l4.5-2.6v7.2L13 11"/>', 'Video cards', 'Press V to record yourself, wide or phone-shaped, or drop in a video. It plays right on the board.'],
    ['<path d="M3.5 15.5L8 4.5l4.5 11M5.2 11.5h5.6"/><path d="M13.5 10.5h4M15.5 8.5v6"/>', 'Your fonts', 'Any font on your Mac for notes, titles and checklists, with a live preview as you hover.'],
    ['<path d="M5 6.2c-.1 0-.2 0-.3-.1C4 5.5 3 4.8 3 3.9c0-.6.4-1 1-1 .4 0 .8.2 1 .5.2-.3.6-.5 1-.5.6 0 1 .4 1 1 0 .9-1 1.6-1.7 2.2-.1.1-.2.1-.3.1z" fill="currentColor" stroke="none"/><circle cx="10" cy="4.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="4.5" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M15 12.6c-.1 0-.2 0-.3-.1-.7-.6-1.7-1.3-1.7-2.2 0-.6.4-1 1-1 .4 0 .8.2 1 .5.2-.3.6-.5 1-.5.6 0 1 .4 1 1 0 .9-1 1.6-1.7 2.2-.1.1-.2.1-.3.1z" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15.5" r="1" fill="currentColor" stroke="none"/>', 'Grid shapes', 'Dots, crosses, hearts, sparkles and more behind your cards. Settings → Board.'],
    ['<path d="M3.5 6h13M3.5 10h13M3.5 14h13"/><circle cx="7" cy="6" r="1.6" fill="currentColor"/><circle cx="13" cy="10" r="1.6" fill="currentColor"/><circle cx="9" cy="14" r="1.6" fill="currentColor"/>', 'Your toolbar', 'Right-click the toolbar to hide tools you don\u2019t use and drag the rest into your own order.'],
    ['<rect x="7.5" y="2.5" width="5" height="9.5" rx="2.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"/>', 'Memos wait for you', 'Drop a voice memo and press Start recording when you\u2019re ready. Nothing records by surprise.'],
  ], '1.5.0': [
    ['<circle cx="10" cy="10" r="7"/><path d="M6.2 8.2c2.6-.8 5.2-.6 7.6.6M6.7 10.8c2-.6 4.2-.4 6 .5M7.3 13.2c1.6-.4 3.1-.3 4.5.4"/>', 'Spotify on your board', 'Paste a Spotify link and it becomes a real player. Songs, playlists, podcasts.'],
    ['<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2l4.3 4.3M8.5 6.5v4M6.5 8.5h4"/>', 'Sharp at any zoom', 'Text and pictures stay crisp however close you get, and zooming is smoother.'],
    ['<rect x="2.5" y="5.5" width="10" height="9" rx="2"/><path d="M12.5 9l5-2.5v7l-5-2.5"/>', 'Pick your camera and mic', 'Choose them in Settings, or from the little menu on video and voice memo cards.'],
    ['<rect x="2.5" y="3.5" width="15" height="10" rx="1.6"/><path d="M7 16.5h6M10 13.5v3"/>', 'Mochiboard for Windows', 'Share it with friends on a PC. Same board, Ctrl shortcuts, and memos written out right on the computer.'],
  ], '1.6.0': [
    ['<rect x="2.5" y="3" width="6" height="14" rx="1.6"/><rect x="11.5" y="3" width="6" height="6" rx="1.6"/><rect x="11.5" y="11" width="6" height="6" rx="1.6"/>', 'Make the sidebars yours', 'Drag any widget by its title to either side, and turn off the ones you don’t use.'],
    ['<path d="M7 4.5c1.5 1.6 4.5 1.6 6 0l3 2-1.5 3.5H13V16H7V10H5.5L4 6.5z"/>', 'Dress up Mochi', 'A closet full of hats, glasses and more. She wears her outfit everywhere.'],
    ['<path d="M7.5 14.5V5l9-2v9.5"/><circle cx="5.5" cy="14.5" r="2"/><circle cx="14.5" cy="12.5" r="2"/>', 'Mochi’s music', 'Three little lo-fi songs that loop softly while you work.'],
    ['<rect x="3" y="3" width="9" height="9" rx="1.6"/><rect x="8" y="8" width="9" height="9" rx="1.6"/>', 'Front and back', 'Right-click a card to bring it to the front or send it back. Layers follows.'],
    ['<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2l4.3 4.3M6.5 8.5h4"/>', 'Zoom menu', 'Click the zoom % for quick sizes, or press ⌘+, ⌘−, ⌘0 and ⇧1.'],
    ['<rect x="2.5" y="5.5" width="10" height="9" rx="2"/><path d="M12.5 9l5-2.5v7l-5-2.5"/>', 'Videos, flipped and written out', 'Flip your camera like a selfie, and turn what you said in a video into words.'],
   ], '1.7.0': [
    ['<path d="M11.7 17.3a.7.7 0 0 1-1 0l-1.1-1.1a.7.7 0 0 1 0-1l3.9-3.9a.7.7 0 0 1 1 0l1.1 1.1a.7.7 0 0 1 0 1z"/><path d="M13.3 10.7 12.3 5.9a.7.7 0 0 0-.5-.5L3.2 3a.7.7 0 0 0-.9.9l2.4 8.6a.7.7 0 0 0 .5.5l4.8 1"/><circle cx="8" cy="8" r="1.4"/>', 'The Pen', 'Draw any shape, then double-click to pull its points, round any corner, or curve it.'],
    ['<rect x="3" y="3" width="14" height="14" rx="3" stroke-dasharray="2.5 2.5"/>', 'Strokes and no fill', 'Solid, dashed or dotted outlines, and a no-fill option that keeps an outline in its color.'],
    ['<path d="M3 13c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0"/>', 'Squiggly lines', 'Wavy, zigzag and loopy lines you can tighten, round and wobble.'],
    ['<path d="M4 15 8 5l4 10M5.5 11.5h5M13 9h4M13 13h4"/>', 'Text, your way', 'Any size, line height, letter spacing, alignment, and UPPERCASE / lowercase / Title Case.'],
    ['<path d="M3 4h14M3 10h9M3 16h14"/><path d="M15 8l2 2-2 2"/>', 'Line things up', 'Alignment guides for everything, align and space buttons, and rotate or scale many things at once.'],
    ['<path d="M10 3c3.9 0 7 2.7 7 6 0 2.4-1.6 4.4-4 5.4V17l-3-2h0c-3.9 0-7-2.7-7-6s3.1-6 7-6z"/>', 'Name your Mochi, and let her rest', 'Give Mochi a name, and try Calm or Calmest when you want her quiet ♡'],
    ['<rect x="2.5" y="12" width="15" height="5" rx="2.5"/><path d="M6 8V3M10 8V5M14 8V4"/>', 'Toolbar and panels', 'Pick your icon size in Settings → Toolbar, and drag any panel to the height you like.'],
  ], '1.9.0': [
    ['<rect x="3" y="3" width="14" height="14" rx="2.5"/><path d="M3 8h14M3 12.5h14M8 3v14"/>', 'Tables', 'Press B for a table on the board. Tab and Enter move between cells, right-click adds rows and columns, and rows pasted from a spreadsheet arrive as a table.'],
    ['<path d="M4 15 8 5l4 10M5.5 11.5h5"/><path d="M13 8h4M13 11h4M13 14h3"/>', 'Saved text styles', 'Right-click styled text → Save text style. It sits under Board colors; click it to put the same font, size, spacing and case on anything.'],
    ['<path d="M11 3.5l5.5 5.5-6 6H6v-4.5z"/><path d="M3 17.5h14" opacity=".5"/>', 'Highlighter mode', 'In a doc, pick up the highlighter and drag over words. Drag again to erase, Esc puts it down.'],
    ['<path d="M3 6.5h14v9.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16z"/><path d="M2 3.5h16v3H2zM8 10h4"/>', 'Archive projects', 'Right-click a project → Archive to tuck it away. Archived, at the bottom of your projects, brings it back.'],
    ['<circle cx="6" cy="6" r="2.5"/><circle cx="14" cy="6" r="2.5"/><circle cx="6" cy="14" r="2.5"/><circle cx="14" cy="14" r="2.5"/>', 'Color your canvases', 'Click the dot beside a board, folder or project to give it a color, so a project reads at a glance.'],
    ['<path d="M3 5.5h14v9H8l-4 3v-3H3z"/><path d="M10 12.2c-.1 0-.2 0-.3-.1-.8-.7-1.9-1.4-1.9-2.4 0-.6.5-1.1 1.1-1.1.5 0 .9.2 1.1.6.2-.4.6-.6 1.1-.6.6 0 1.1.5 1.1 1.1 0 1-1.1 1.7-1.9 2.4-.1.1-.2.1-.3.1z"/>', 'Tell Jessa', 'Right-click Mochi → Send feedback, or tell her “tell Jessa…”. You see exactly what goes out first, and Settings → About has a little Support Mochi ♡ too.'],
  ], '1.10.0': [
    ['<path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h6a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z"/>', 'Your files, on the board', 'Connect a folder (or all your files) in Settings → General, or just drag one in. Folder cards stay live, and file cards show a real preview.'],
    ['<path d="M10 3.5l1.6 4.2 4.4.3-3.4 2.8 1.1 4.3L10 12.7l-3.7 2.4 1.1-4.3L4 8l4.4-.3z"/>', 'Mochi reads them', 'Ask “what’s in this folder?” or “sum up this file”. Read-only, only folders you’ve connected, and you can switch it off.'],
    ['<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M8.5 7.5v5l4-2.5z"/>', 'Play your games', 'An .html file card has a ▶ Play button: Mochiboard runs it on this computer and opens it in your browser, no Terminal needed.'],
    ['<path d="M4 16l2.5-.6 8.6-8.6a1.4 1.4 0 0 0-2-2L4.5 13.4z"/><path d="M11.5 6.5l2 2"/>', 'Mochi designs in your style', 'Ask for a start screen or a menu: she looks at your real pages, reads your colors and fonts, and builds it with your own art. Animated .webm logos play right on the board.'],
    ['<circle cx="10" cy="10" r="2.5"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6 15 15M5 15l1.4-1.4M13.6 6.4 15 5"/>', 'Ask Mochi to change settings', '“Turn on dark mode”, “hide the dot grid”, “make yourself pink”. She says what she changed, with an Undo.'],
    ['<path d="M5.5 14.5a3.5 3.5 0 0 1-.3-7 5 5 0 0 1 9.6 1.2 3 3 0 0 1-.3 5.8z"/>', 'Boards anywhere, memos in full', 'Keep your boards in Dropbox or iCloud Drive (Settings → General → Your boards), and voice memos are now written out in full.'],
  ] };
  // ideas from people that shipped, thanked by name on that version's card: [what, name, role]. New ones come from the "thank me by name" box in feedback
  const NEWS_CREDITS = { '1.7.0': [['Calm modes', 'Nikunj Tyagi', 'Product Designer']] };
  // the button on each version's card: try the headline thing
  const NEWS_TRY = { '1.10.0': ['Connect a folder', () => { $('gearBtn').click(); setTab('general'); setTimeout(() => $('cfAdd')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }], '1.9.0': ['Make a table', () => startPlacing('table')], '1.1.0': ['Try a template', () => $('tools').querySelector('[data-add="tpl"]').click()], '1.2.0': ['Make it yours', () => { $('gearBtn').click(); setTab('board'); setTimeout(() => $('settings').querySelector('.col-grid')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }], '1.3.0': ['Write a doc', () => openDoc(addAtCenter('doc', { text: 'My first real doc' }))], '1.4.0': ['Record a video', () => startPlacing('video')], '1.5.0': ['Pick your camera', () => { $('gearBtn').click(); setTab('general'); setTimeout(() => $('settings').querySelector('.set-devices')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120); }] };
  // a bigger update walks through extra steps: [title, subtitle] for each, after the list
  const NEWS_STEPS = { '1.6.0': [['Two new widgets, if you’d like them', 'They’re off until you switch them on.'], ['Find them anytime', 'Settings → Widgets turns any widget on or off.']] };
  let nwStep = 0, nwSteps = null, nwHead = null, nwGooT = 0;
  const nwGoo = Goo($('nwGoo'), { wearing: () => window.__nwFit || {} });
  const NW_FITS = [{ hat: 'party', held: 'balloon' }, { hat: 'crown', face: 'hearts' }, { hat: 'witch', neck: 'scarf', held: 'wand' }, { hat: 'frog' }, { hat: 'beanie', face: 'round', held: 'boba' }, { hat: 'bow', neck: 'pearls' }];
  function newsShow(n) {
    nwStep = n; const steps = nwSteps || [];
    $('newsList').hidden = n > 0; document.querySelectorAll('#news .nw-step').forEach(s => s.hidden = +s.dataset.s !== n);
    $('news').querySelector('h2').textContent = n ? steps[n - 1][0] : nwHead[0]; $('newsV').textContent = n ? steps[n - 1][1] : nwHead[1];
    $('news').querySelector('.nw-mochi').hidden = n > 0;
    $('nwDots').hidden = !steps.length; [...$('nwDots').children].forEach((d, i) => { d.hidden = i > steps.length; d.classList.toggle('on', i === n); });
    const last = n >= steps.length;
    $('newsOk').textContent = last ? 'Love it' : 'Next →';
    if (steps.length) { $('newsTry').textContent = n === 0 ? 'Skip' : last ? 'Show me' : '← Back'; }
    $('nwDress').checked = settings.wDressup !== false; $('nwMusic').checked = settings.wMusic !== false;
    clearInterval(nwGooT); if (n === 1) { let i = 0; window.__nwFit = NW_FITS[0]; nwGooT = setInterval(() => { window.__nwFit = NW_FITS[++i % NW_FITS.length]; nwGoo.hop(); }, 1300); }
  }
  $('nwDress').onchange = () => { settings.wDressup = $('nwDress').checked; applySettings(); if (settings.wDressup) nwGoo.hop(); };
  $('nwMusic').onchange = () => { settings.wMusic = $('nwMusic').checked; applySettings(); };
  $('nwListen').onclick = () => { if (music.playing) music.pause(); else music.play(0); $('nwListen').textContent = music.playing ? '❚❚ Pause' : '▶ Listen'; };
  const newsKey = 'mochiboard:newsSeen';
  async function maybeNews() {
    let v = null; try { v = await MB.version(); } catch (e) {} if (!v) v = Object.keys(NEWS).pop();
    let seen = null; try { seen = localStorage.getItem(newsKey); } catch (e) {}
    try { localStorage.setItem(newsKey, v); } catch (e) {}
    // everything new since the version you last saw (a small fix release has no card of its own)
    const num = x => String(x || '0').replace(/^v/, '').split('.').map(n => +n || 0), after = (x, y) => { const a = num(x), b = num(y); for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); return false; };
    const items = Object.keys(NEWS).filter(k => (!seen || after(k, seen)) && !after(k, v)).flatMap(k => NEWS[k]);
    if (seen === v || !items.length) return;
    $('newsV').textContent = `Mochiboard ${v}`; nwHead = ['What’s new ✦', `Mochiboard ${v}`];
    nwSteps = Object.keys(NEWS_STEPS).filter(k => (!seen || after(k, seen)) && !after(k, v)).flatMap(k => NEWS_STEPS[k]); if (!nwSteps.length) nwSteps = null;
    const credits = Object.keys(NEWS_CREDITS).filter(k => (!seen || after(k, seen)) && !after(k, v)).flatMap(k => NEWS_CREDITS[k]);
    $('newsList').innerHTML = items.map(([e, t, d]) => `<li><span class="nw-e"><svg viewBox="0 0 20 20">${e}</svg></span><div><b>${esc(t)}</b><small>${esc(d)}</small></div></li>`).join('')
      + (credits.length ? `<li class="nw-credits"><span class="nw-e">♡</span><div><b>Thank you</b>${credits.map(([w, n, r]) => `<small>${esc(w)}: idea from ${esc(n)}${r ? ', ' + esc(r) : ''} ♡</small>`).join('')}</div></li>` : '');
    const tryK = Object.keys(NEWS_TRY).filter(k => !after(k, v)).sort((a, b) => after(a, b) ? 1 : -1).pop(), tr = NEWS_TRY[tryK]; $('newsTry').textContent = tr[0]; $('newsTry').onclick = () => { closeNews(); tr[1](); };
    $('news').classList.add('on'); newsShow(0);
    if (nwSteps) $('newsTry').onclick = () => { if (nwStep === 0) closeNews(); else if (nwStep >= nwSteps.length) { closeNews(); $('gearBtn').click(); setTab('widgets'); } else newsShow(nwStep - 1); };
  }
  const closeNews = () => { $('news').classList.remove('on'); clearInterval(nwGooT); if (music.playing && settings.wMusic === false) music.pause(); $('nwListen').textContent = '▶ Listen'; };   // a song they only previewed stops with the card
  $('newsOk').onclick = () => nwSteps && nwStep < nwSteps.length ? newsShow(nwStep + 1) : closeNews();
  $('news').onclick = e => { if (e.target === $('news')) closeNews(); };

  // ---------- phone: the board gets the whole screen. Panels slide up as bottom sheets, and the bottom bar becomes a hub ----------
  // The sheets hold the app's real panels (moved in while on a phone, put back on a bigger screen), so everything works the same.
  const phone = (() => {
    const mq = matchMedia('(max-width: 700px)'), home = new Map();
    const PI = d => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const hub = document.createElement('div'); hub.className = 'hub'; hub.id = 'hub';
    hub.innerHTML = `<button data-sheet="boards">${PI('<rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/>')}<span>Boards</span></button>`
      + `<button data-sheet="layers">${PI('<path d="M10 3l7 3.8-7 3.8-7-3.8z"/><path d="M3 10.2l7 3.8 7-3.8"/><path d="M3 13.6l7 3.8 7-3.8"/>')}<span>Layers</span></button>`
      + `<button class="hub-add" data-sheet="add" aria-label="Add something">${PI('<path d="M10 4v12M4 10h12" stroke-width="2.4"/>')}</button>`
      + `<button data-sheet="tray">${PI('<path d="M3 11.5l2.2-6.3A1.5 1.5 0 0 1 6.6 4h6.8a1.5 1.5 0 0 1 1.4 1.2l2.2 6.3V15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15z"/><path d="M3 11.5h4l1 2h4l1-2h4"/>')}<span>Unsorted</span><b class="hub-n" id="hubN"></b></button>`
      + `<button data-hub="mochi"><canvas id="hubGoo" width="64" height="56"></canvas><span>Mochi</span></button>`;
    const sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'sheet';
    sh.innerHTML = '<div class="sh-veil"></div><div class="sh-panel" role="dialog"><div class="sh-grab"><i></i></div><div class="sh-head"><b id="shTitle"></b><div class="sh-tabs" id="shTabs"></div><button class="sh-x" aria-label="Close">×</button></div><div class="sh-body" id="shBody"></div></div>';
    document.body.appendChild(sh);
    const hubGoo = Goo(hub.querySelector('#hubGoo'), { outfit: 'wear' }); goos.push(hubGoo);
    const box = k => document.querySelector(`.box[data-box="${k}"]`);
    const SHEETS = {
      boards: { title: 'Boards', tabs: [['Boards', () => box('boards')], ['Dress up Mochi', () => box('dressup')], ['Music', () => box('music')]] },
      layers: { title: 'Layers', tabs: [['Layers', () => box('layers')]] },
      add: { title: 'Add', tabs: [['Basics', () => $('tools')], ['Wireframe', () => $('design')], ['Colors', () => box('colors')]] },
      tray: { title: 'Unsorted', tabs: [['Ideas', () => $('tray')]] },
    };
    let open = null, tab = 0;
    // move a real panel into the sheet (remembering where it lived) or put it back
    const adopt = el => { if (!home.has(el)) home.set(el, [el.parentNode, el.nextSibling]); };
    const restoreAll = () => home.forEach(([p, n], el) => { p.insertBefore(el, n && n.parentNode === p ? n : null); el.classList.remove('in-sheet'); });
    function show(name, t = 0) {
      const S0 = SHEETS[name]; if (!S0) return; open = name; tab = t;
      const S = { ...S0, tabs: S0.tabs.filter(([, get]) => { const el = get(); return el && !el.classList.contains('wg-off'); }) };   // widgets turned off in Settings stay out of the sheets too
      $('shTitle').textContent = S.title;
      $('shTabs').innerHTML = S.tabs.length > 1 ? S.tabs.map(([l], i) => `<button data-t="${i}" class="${i === t ? 'on' : ''}">${l}</button>`).join('') : '';
      const body = $('shBody'); [...body.children].forEach(c => c.classList.remove('shown'));
      S.tabs.forEach(([, get], i) => { const el = get(); if (!el) return; adopt(el); if (el.parentNode !== body) body.appendChild(el); el.classList.add('in-sheet'); el.classList.toggle('shown', i === t); });
      if (name === 'tray') $('tray').classList.remove('closed');
      sh.classList.add('on'); hub.querySelectorAll('[data-sheet]').forEach(b => b.classList.toggle('on', b.dataset.sheet === name));
      if (name === 'layers') renderLayers();
    }
    function hide() { open = null; sh.classList.remove('on'); sh.querySelector('.sh-panel').style.transform = ''; hub.querySelectorAll('[data-sheet]').forEach(b => b.classList.remove('on')); }
    hub.addEventListener('click', e => {
      const b = e.target.closest('[data-sheet], [data-hub]'); if (!b) return;
      if (b.dataset.hub === 'mochi') { hide(); hubGoo.hop(); return mochiOpen(!$('mochi').classList.contains('chat')); }
      if (open === b.dataset.sheet) return hide();
      mochiOpen(false); show(b.dataset.sheet);
    });
    $('shTabs').onclick = e => { const b = e.target.closest('[data-t]'); if (b) show(open, +b.dataset.t); };
    sh.querySelector('.sh-veil').onclick = hide; sh.querySelector('.sh-x').onclick = hide;
    // drag the sheet down by its handle to close it
    { const grab = sh.querySelector('.sh-grab'), panel = sh.querySelector('.sh-panel'); let y0 = null, dy = 0;
      grab.addEventListener('pointerdown', e => { y0 = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); panel.style.transition = 'none'; });
      grab.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
      grab.addEventListener('pointerup', () => { if (y0 === null) return; y0 = null; panel.style.transition = ''; if (dy > 90) hide(); else panel.style.transform = ''; }); }
    // picking something to place closes the sheet, so the next tap lands on the board
    const ready = () => placing || drawOn || ['shapePick', 'tplPick', 'stampWheel', 'linkbox'].some(id => $(id).classList.contains('on'));
    $('shBody').addEventListener('click', () => { setTimeout(() => ready() && hide(), 0); setTimeout(() => open && ready() && hide(), 700); });   // the second look catches tools that get ready a moment later (a voice memo asks for the mic first)
    // layers and boards: once you pick one, get out of the way so you can see it
    box('layers').addEventListener('click', e => { if (phone.on && e.target.closest('.ly') && !e.target.closest('.ly-tw, .ly-b')) setTimeout(hide, 60); });
    box('boards').addEventListener('click', e => { if (phone.on && e.target.closest('.board-row')) setTimeout(hide, 60); });
    // Unsorted on a phone: tap an idea to drop it in the middle of the board (Mochi points it out)
    $('trayList').addEventListener('pointerdown', e => {
      if (!phone.on) return; const it = e.target.closest('.tray-item'); if (!it) return; e.stopImmediatePropagation(); e.preventDefault();
      const c = board.tray.find(x => x.id === it.dataset.id); if (!c) return;
      const r = stage.getBoundingClientRect(), w = toWorld(r.left + r.width / 2, r.top + r.height * .42);
      c.x = w.x - c.w / 2; c.y = w.y - c.h / 2; board.tray = board.tray.filter(x => x !== c); addCard(c); renderTray(); hide(); selectOnly([c.id]); lyFlash([c.id]);
    }, true);
    function set(on) {
      phone.on = on; document.body.classList.toggle('phone', on);
      if (on) { $('dock').prepend(hub);
        $('tools').querySelectorAll('[data-tip]').forEach(b => b.dataset.name = b.dataset.tip.split(' · ')[0]);   // no keyboard on a phone, so just the names
        if (board?.cards.length && view.z < .6) { fit(board.cards, 40, 1); applyView(); } }   // start where the cards are, at a size you can read
      else { hide(); restoreAll(); hub.remove(); }
      hub.querySelector('#hubN').textContent = board?.tray?.length || '';
    }
    mq.addEventListener('change', e => set(e.matches));
    $('selbar').addEventListener('scroll', e => e.target.classList.toggle('end', e.target.scrollLeft + e.target.clientWidth >= e.target.scrollWidth - 4), { passive: true });
    return { on: false, set, hide, count: () => { hub.querySelector('#hubN').textContent = board?.tray?.length || ''; }, init: () => set(mq.matches) };
  })();
  window.__phone = phone;

  // ---------- touch: one finger pans an empty board, two fingers pinch to zoom, press and hold for the menu ----------
  { const pts = new Map(); let pinch = null, hold = null;
    stage.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clearTimeout(hold); const x0 = e.clientX, y0 = e.clientY, tgt = e.target;
      if (pts.size === 1 && !e.target.closest('.dock, .hub, .sheet, .top, .m-chat')) hold = setTimeout(() => {   // press and hold: the same menu as a right-click
        if (pts.size !== 1) return; const p = [...pts.values()][0]; if (Math.hypot(p.x - x0, p.y - y0) > 8) return;
        drag = null; stage.classList.remove('panning'); $('marquee').style.display = 'none'; navigator.vibrate?.(10);
        tgt.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x0, clientY: y0, button: 2 }));
      }, 520);
      if (pts.size === 2) {   // a second finger: whatever the first was doing becomes a pinch
        clearTimeout(hold); drag = null; stage.classList.remove('panning'); $('marquee').style.display = 'none';
        const [a, b] = [...pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: view.z, wx: (mx - view.x) / view.z, wy: (my - view.y) / view.z };
      }
    }, true);
    addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        view.z = clamp(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, .2, 3); view.x = mx - pinch.wx * view.z; view.y = my - pinch.wy * view.z; applyView(); }
    }, true);
    const end = e => { if (!pts.delete(e.pointerId)) return; clearTimeout(hold); if (pts.size < 2 && pinch) { pinch = null; save(); } };
    addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  }

  // ---------- start ----------
  (async () => {
    let list = await MB.list();
    if (!list.length) { const b = newBoard('Dream it', 'Dream it'); b.name = 'My first board'; await MB.save(b); list = await MB.list(); }   // everyone starts from the poster
    let last = null; try { last = localStorage.getItem('mochiboard:last'); } catch (e) {}
    await openBoard(list.some(b => b.id === last) ? last : list[0].id);
    applySettings(); phone.init();
    let onboarded = true; try { onboarded = !!localStorage.getItem('mochiboard:onboarded'); } catch (e) {}
    if (!onboarded) { try { localStorage.setItem(newsKey, (await MB.version().catch(() => null)) || Object.keys(NEWS).pop()); } catch (e) {} setTimeout(() => { fit(board.cards); openSetup(); }, 400); showConnections(true); return; }   // brand new: the tour covers it, no what's new
    setTimeout(() => { fit(board.cards); if (settings.greet && settings.chat !== 'quiet') say(`Hi${settings.name ? ' ' + settings.name : ''}, it's Mochi! Dump ideas with ⌘K, then ask me to sort them ✦`, 7000); }, 400);
    showConnections(true);
    setTimeout(maybeNews, 700);
    setTimeout(() => checkUpdate(), 4000);
  })();
  window.__mb = { ask, get kpFor() { return kpFor; }, get editingId() { return editing; }, selectOnly, restack, music, openSetup, startTour, get board() { return board; }, applyMochi, fit, lib: () => snapshot().library, openHome, get editing() { return editing; }, get sel() { return [...sel]; }, placeSelbar, renderAll, get view() { return view; }, applyView };   // handy for testing
})();
