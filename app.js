// Our living-room home screen: app dock, photos, and Annyka's Suno album as an idle surprise.
// Plain ES2017, no build step, so the Samsung TV runs it as-is (as a Tizen TV app or in the browser).
(function () {
  "use strict";

  var SLIDE_MS = 40000;          // how long each photo stays up
  var IDLE_MS = 30000;           // untouched this long: dock fades away and the music starts
  var SONG_GAP_S = 3;            // pause between songs (also covers the embed's load time)
  var SONG_FALLBACK_S = 240;     // if Suno didn't report a length
  var REFRESH_MS = 3 * 60 * 60 * 1000; // re-read songs.js / photos.js every 3 hours
  // When installed as a TV app, new songs and photos come from the GitHub Pages site.
  var DATA_BASE = window.DATA_BASE || "";

  var $ = function (id) { return document.getElementById(id); };
  var isTizen = typeof window.tizen !== "undefined";

  // ---------- greeting + clock ----------

  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  function partOfDay(h) {
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 17) return "afternoon";
    return "evening";
  }

  function tick() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    $("time").innerHTML = (h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m +
      '<span class="ampm">' + (h < 12 ? "AM" : "PM") + "</span>";
    $("date").textContent = DAYS[now.getDay()] + ", " + MONTHS[now.getMonth()] + " " + now.getDate();
    $("greeting").textContent = "Good " + partOfDay(h);
    // Re-align to the top of the next minute so the clock never drifts.
    setTimeout(tick, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
  }

  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }

  var toastTimer = null;
  function toast(text) {
    var el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4500);
  }

  // ---------- shuffled order that never repeats until everything has played ----------

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function Bag(items, keyOf) {
    this.keyOf = keyOf;
    this.items = items.slice();
    this.queue = shuffle(this.items);
    this.last = null;
  }
  Bag.prototype.next = function () {
    if (this.items.length === 0) return null;
    if (this.queue.length === 0) {
      this.queue = shuffle(this.items);
      // Don't play/show the same thing twice in a row across a reshuffle.
      if (this.queue.length > 1 && this.last && this.keyOf(this.queue[0]) === this.keyOf(this.last)) {
        this.queue.push(this.queue.shift());
      }
    }
    this.last = this.queue.shift();
    return this.last;
  };
  // Swap in a refreshed list: drop removed items, put brand-new ones at the front of the queue.
  Bag.prototype.update = function (items) {
    var keyOf = this.keyOf;
    var oldKeys = {};
    this.items.forEach(function (it) { oldKeys[keyOf(it)] = true; });
    var newKeys = {};
    items.forEach(function (it) { newKeys[keyOf(it)] = true; });
    var fresh = items.filter(function (it) { return !oldKeys[keyOf(it)]; });
    this.queue = shuffle(fresh).concat(this.queue.filter(function (it) { return newKeys[keyOf(it)]; }));
    this.items = items.slice();
  };
  // Played by hand from the album: take it out of this round so shuffle doesn't repeat it soon.
  Bag.prototype.take = function (item) {
    var key = this.keyOf(item);
    var keyOf = this.keyOf;
    this.queue = this.queue.filter(function (it) { return keyOf(it) !== key; });
    this.last = item;
  };

  // ---------- photos ----------

  var slides = document.querySelectorAll(".slide");
  var current = 0;
  var photoBag = new Bag(window.PHOTOS || [], function (p) { return p; });
  var drift = 0;

  document.documentElement.style.setProperty("--slide-ms", (SLIDE_MS + 4000) + "ms");

  function showNextPhoto() {
    var src = photoBag.next();
    if (!src) return;
    var img = new Image();
    img.onload = function () {
      var next = slides[1 - current];
      next.className = "slide" + (drift++ % 2 ? " alt" : "");
      next.querySelector(".photo").src = src;
      void next.offsetWidth; // restart the drift animation
      next.className += " drift show";
      slides[current].className = slides[current].className.replace(" show", "");
      current = 1 - current;
    };
    img.src = (DATA_BASE && src.indexOf("http") !== 0 ? DATA_BASE : "") + src;
  }

  // ---------- music, played by Suno's own embed player ----------
  // Suno encrypts its audio files, so only its player can play them. The embed doesn't
  // report progress or when a song ends, so we time both from the song's known length.

  var songBag = new Bag(window.SONGS || [], function (s) { return s.id; });
  var musicOn = false;
  var currentSong = null;
  var songTimer = null;
  var songStartedAt = 0;

  function stopSong() {
    clearTimeout(songTimer);
    songStartedAt = 0;
    $("suno-player").innerHTML = "";
  }

  function playSong(song) {
    stopSong();
    if (!song) return;
    musicOn = true;
    currentSong = song;
    var frame = document.createElement("iframe");
    frame.src = "https://suno.com/embed/" + song.id + "?autoplay=1";
    frame.setAttribute("allow", "autoplay; encrypted-media");
    frame.setAttribute("title", "Suno player: " + song.title);
    frame.tabIndex = -1; // keep the remote's keys on our page
    frame.onload = function () {
      songStartedAt = Date.now();
      songTimer = setTimeout(nextSong, ((song.duration || SONG_FALLBACK_S) + SONG_GAP_S) * 1000);
    };
    $("suno-player").appendChild(frame);
    showCard(song);
    markPlaying();
  }

  function nextSong() { playSong(songBag.next()); }

  function stopMusic() {
    musicOn = false;
    stopSong();
    $("now-playing").hidden = true;
    markPlaying();
  }

  function showCard(song) {
    var card = $("now-playing");
    var wasHidden = card.hidden;
    card.hidden = false;
    card.className = wasHidden ? "" : "swap";
    setTimeout(function () {
      $("np-cover").src = song.image || (window.ALBUM && window.ALBUM.image) || "";
      $("np-title").textContent = song.title;
      $("np-total").textContent = mmss(song.duration || SONG_FALLBACK_S);
      updateProgress();
      card.className = "";
    }, wasHidden ? 0 : 900);
  }

  function updateProgress() {
    if (!currentSong) return;
    var total = currentSong.duration || SONG_FALLBACK_S;
    var elapsed = songStartedAt ? Math.min(total, (Date.now() - songStartedAt) / 1000) : 0;
    $("np-elapsed").textContent = mmss(elapsed);
    $("np-bar").style.width = (100 * elapsed / total) + "%";
  }
  setInterval(updateProgress, 500);

  // ---------- apps ----------
  // On the TV (as an installed Tizen app) tiles open the real apps. App ids are looked up
  // by name from what's installed, with known ids as a fallback. In a plain browser,
  // web pages can't open TV apps, so tiles explain that instead.

  var APPS = {
    netflix: { name: "Netflix", id: "3201907018807" },
    prime:   { name: "Prime Video", id: "3201910019365" },
    disney:  { name: "Disney+", id: "3201901017640" },
    youtube: { name: "YouTube", id: "111299001912" }
  };

  if (isTizen) {
    try {
      tizen.application.getAppsInfo(function (infos) {
        Object.keys(APPS).forEach(function (key) {
          var want = APPS[key].name.toLowerCase();
          for (var i = 0; i < infos.length; i++) {
            if ((infos[i].name || "").toLowerCase() === want) { APPS[key].id = infos[i].id; break; }
          }
        });
      });
    } catch (e) { /* keep the fallback ids */ }
  }

  function launchApp(key) {
    if (key === "music") { openPicker(); return; }
    if (!isTizen) {
      toast(key === "home" ? "Press the Home button on your remote for Samsung's home screen"
                           : "Opening apps works once this is installed as a TV app");
      return;
    }
    try {
      if (key === "home") {
        tizen.application.getCurrentApplication().hide();
      } else if (key === "settings") {
        tizen.application.launchAppControl(
          new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/setting"),
          null, null, function () { toast("Press the Settings button on your remote"); });
      } else {
        stopMusic(); // don't play over Netflix
        tizen.application.launch(APPS[key].id, null, function () {
          toast("Couldn't open " + APPS[key].name + ". Is it installed?");
        });
      }
    } catch (e) {
      toast("Couldn't open that app");
    }
  }

  // ---------- dock ----------

  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile"));
  var tileIndex = 0;
  function focusTile(i) {
    tileIndex = Math.max(0, Math.min(tiles.length - 1, i));
    tiles.forEach(function (t, j) { t.classList.toggle("focused", j === tileIndex); });
  }
  tiles.forEach(function (t, i) {
    t.addEventListener("mouseenter", function () { focusTile(i); });
    t.addEventListener("click", function () { focusTile(i); launchApp(t.getAttribute("data-app")); });
  });

  // ---------- album picker ----------

  var pickerItems = [];   // [actions..., songs...] in one list for remote navigation
  var pickerIndex = 0;

  function buildPicker() {
    var album = window.ALBUM || { name: "Annyka", image: "" };
    var songs = window.SONGS || [];
    $("album-cover").src = album.image;
    $("album-name").textContent = album.name;
    var total = songs.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);
    $("album-meta").textContent = songs.length + " songs · " + Math.round(total / 60) + " min · Suno";
    var list = $("song-list");
    list.innerHTML = "";
    songs.forEach(function (s) {
      var li = document.createElement("li");
      li.className = "song";
      li.setAttribute("data-id", s.id);
      li.innerHTML = '<img alt=""><span class="t"></span><span class="eq"><i></i><i></i><i></i></span><span class="d"></span>';
      li.querySelector("img").src = s.image || album.image;
      li.querySelector(".t").textContent = s.title;
      li.querySelector(".d").textContent = mmss(s.duration);
      li.addEventListener("click", function () { pickSong(s); });
      list.appendChild(li);
    });
    pickerItems = Array.prototype.slice.call(document.querySelectorAll("#picker .pill"))
      .concat(Array.prototype.slice.call(list.children));
  }

  function markPlaying() {
    var id = musicOn && currentSong ? currentSong.id : "";
    Array.prototype.forEach.call($("song-list").children, function (li) {
      li.classList.toggle("playing", li.getAttribute("data-id") === id);
    });
  }

  function focusPicker(i) {
    pickerIndex = Math.max(0, Math.min(pickerItems.length - 1, i));
    pickerItems.forEach(function (el, j) { el.classList.toggle("focused", j === pickerIndex); });
    var el = pickerItems[pickerIndex];
    if (el.classList.contains("song")) el.scrollIntoView({ block: "nearest" });
  }

  function openPicker() {
    buildPicker();
    markPlaying();
    $("picker").hidden = false;
    // Start on the playing song if there is one, else on "Shuffle all".
    var start = 0;
    if (musicOn && currentSong) {
      for (var i = 0; i < pickerItems.length; i++) {
        if (pickerItems[i].getAttribute("data-id") === currentSong.id) { start = i; break; }
      }
    }
    focusPicker(start);
  }

  function closePicker() { $("picker").hidden = true; }

  function pickSong(song) {
    songBag.take(song);
    playSong(song);
    closePicker();
  }

  function activatePicker() {
    var el = pickerItems[pickerIndex];
    var action = el.getAttribute("data-action");
    if (action === "shuffle") { nextSong(); closePicker(); }
    else if (action === "stop") { stopMusic(); closePicker(); }
    else {
      var id = el.getAttribute("data-id");
      var song = (window.SONGS || []).filter(function (s) { return s.id === id; })[0];
      if (song) pickSong(song);
    }
  }

  document.querySelectorAll("#picker .pill").forEach(function (b) {
    b.addEventListener("click", function () {
      pickerIndex = pickerItems.indexOf(b);
      activatePicker();
    });
  });

  // ---------- idle: dock fades out, music starts as a surprise ----------

  var idleTimer = null;
  function goAmbient() {
    if (!$("picker").hidden) return;
    document.body.classList.add("ambient");
    if (!musicOn) nextSong();
  }
  function wake() {
    document.body.classList.remove("ambient");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(goAmbient, IDLE_MS);
  }

  // ---------- remote ----------

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 10009, BACKSPACE: 8, ESC: 27,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, NEXT: 10233 };

  if (isTizen) {
    ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaTrackNext"].forEach(function (k) {
      try { tizen.tvinputdevice.registerKey(k); } catch (e) { /* not on this model */ }
    });
  }

  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    var wasAmbient = document.body.classList.contains("ambient");
    wake();

    // Music keys work everywhere.
    if (k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) {
      e.preventDefault();
      if (musicOn) stopMusic(); else nextSong();
      return;
    }
    if (k === KEY.NEXT) { e.preventDefault(); if (musicOn) nextSong(); return; }

    if (!$("picker").hidden) {
      e.preventDefault();
      var nActions = document.querySelectorAll("#picker .pill").length;
      if (k === KEY.BACK || k === KEY.BACKSPACE || k === KEY.ESC) closePicker();
      else if (k === KEY.OK) activatePicker();
      else if (k === KEY.DOWN) focusPicker(pickerIndex < nActions ? nActions : pickerIndex + 1);
      else if (k === KEY.UP) focusPicker(pickerIndex <= nActions ? 0 : pickerIndex - 1);
      else if (k === KEY.LEFT) focusPicker(pickerIndex < nActions ? Math.max(0, pickerIndex - 1) : 0);
      else if (k === KEY.RIGHT) focusPicker(pickerIndex < nActions - 1 ? pickerIndex + 1 : Math.max(pickerIndex, nActions));
      return;
    }

    // First press after the idle screen just brings the dock back.
    if (wasAmbient) { e.preventDefault(); return; }

    if (k === KEY.LEFT) { e.preventDefault(); focusTile(tileIndex - 1); }
    else if (k === KEY.RIGHT) { e.preventDefault(); focusTile(tileIndex + 1); }
    else if (k === KEY.OK) { e.preventDefault(); launchApp(tiles[tileIndex].getAttribute("data-app")); }
  });
  ["mousemove", "touchstart", "wheel"].forEach(function (type) {
    document.addEventListener(type, wake, { passive: true });
  });

  // ---------- pick up new songs and photos without reloading ----------

  function reloadData(file, done) {
    var s = document.createElement("script");
    s.src = DATA_BASE + file + "?v=" + Date.now();
    s.onload = function () { s.parentNode.removeChild(s); done(); };
    s.onerror = function () { s.parentNode.removeChild(s); };
    document.body.appendChild(s);
  }

  function refresh() {
    reloadData("songs.js", function () {
      if (window.SONGS && window.SONGS.length) songBag.update(window.SONGS);
      setMusicTile();
    });
    reloadData("photos.js", function () {
      if (window.PHOTOS && window.PHOTOS.length) photoBag.update(window.PHOTOS);
    });
  }

  function setMusicTile() {
    var img = document.querySelector(".tile.music .cover");
    if (window.ALBUM && window.ALBUM.image) img.src = window.ALBUM.image;
  }

  // ---------- start ----------

  setMusicTile();
  focusTile(0);
  tick();
  showNextPhoto();
  setInterval(showNextPhoto, SLIDE_MS);
  wake();
  // An installed app ships its own copy of the lists; fetch today's right away.
  if (DATA_BASE) refresh();
  setInterval(refresh, REFRESH_MS);
})();
