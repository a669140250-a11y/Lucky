/* =========================================================
   Lucky 抽一下 — 交互逻辑
   ========================================================= */
(function () {
  'use strict';

  var DATA = window.LUCKY_DATA;
  var BANK_KEY = 'lucky.customBank.v1';
  var SETTINGS_KEY = 'lucky.settings.v1';
  var MAX_LEN = 140;

  var LABEL = {
    truth: '💬 真心话',
    dare: '🔥 大冒险',
    normal: '🌱 普通',
    advanced: '🌶️ 进阶',
    daily: '☀️ 现在干嘛'
  };
  var NAME = { truth: '真心话', dare: '大冒险', normal: '普通', advanced: '进阶' };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- 保存 ---------------- */
  var storage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  function emptyBank() {
    return { daily: [], truth: { normal: [], advanced: [] }, dare: { normal: [], advanced: [] } };
  }

  function cleanList(list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      if (typeof item !== 'string') return;
      var text = item.trim().slice(0, MAX_LEN);
      if (!text || seen[text]) return;
      seen[text] = true;
      out.push(text);
    });
    return out;
  }

  function normalizeBank(raw) {
    var bank = emptyBank();
    if (!raw || typeof raw !== 'object') return bank;
    bank.daily = cleanList(raw.daily);
    ['truth', 'dare'].forEach(function (type) {
      ['normal', 'advanced'].forEach(function (level) {
        bank[type][level] = cleanList(raw[type] && raw[type][level]);
      });
    });
    return bank;
  }

  var bank = normalizeBank(storage.get(BANK_KEY));
  var settings = (function () {
    var s = storage.get(SETTINGS_KEY, {}) || {};
    return {
      mode: s.mode === 'party' ? 'party' : 'daily',
      type: s.type === 'dare' ? 'dare' : 'truth',
      level: s.level === 'advanced' ? 'advanced' : 'normal',
      onlyCustom: s.onlyCustom === true,
      done: Number.isFinite(s.done) && s.done > 0 ? Math.floor(s.done) : 0
    };
  })();

  function saveSettings() { storage.set(SETTINGS_KEY, settings); }

  function customList(cat, level) {
    return cat === 'daily' ? bank.daily : bank[cat][level];
  }
  function builtinList(cat, level) {
    return cat === 'daily' ? DATA.daily : DATA[cat][level];
  }

  /* ---------------- 随机抽签 ----------------
     1. 一轮抽完才会重复，而且进度存在本机：重新打开页面也接着上次抽，不会每次都从头洗牌
     2. 每次随机挑几张没抽过的候选，避开和最近几题“讲同一件事”的（例如连续两题都跟手机或前任有关）
     3. “现在干嘛”还会尽量避开和上一张同一个分类
  */
  var HISTORY_KEY = 'lucky.history.v1';
  var RECENT_SIZE = 6;          // 记住最近几题，用来避开相似题
  var CANDIDATES = 8;           // 每次从没抽过的题里随机挑几张来比较
  var SIMILAR = 0.16;           // 相似度高于这个值就尽量避开
  var TOPIC_GAP = 2;            // 同一个话题至少隔几题再出现

  // 话题关键词：字面不同、但讲的是同一件事（例如都跟手机有关）的题目也能认出来；自定义题目同样适用
  var TOPICS = [
    /手机|相册|截屏|搜索记录|浏览器|聊天列表|聊天记录|订单|关注列表|壁纸|App/,
    /发消息|发一条|发一个|朋友圈|签名|昵称|头像|社交/,
    /打电话|视频电话|通讯录/,
    /前任|复合|甩/,
    /暗恋|喜欢的人|告白|表白|约会|恋爱|另一半|心动|情话|情歌|情诗|情书|求婚|撩|桃花|一见钟情|理想型|结婚|婚礼/,
    /拥抱|牵手|慢舞|公主抱|按摩|背起|背靠背/,
    /唱|歌/,
    /模仿|表演|演出/,
    /夸|称赞|赞美|欣赏/,
    /秘密|黑历史|不想让|不想被|抓包|丢脸|尴尬|糗/,
    /爸妈|家人|父母/,
    /最近一次/,
    /吃|食物|零食|饮料|奶茶|水果|巧克力|早餐|菜/,
    /维持|保留到|保持 24|直到下一轮|直到游戏结束|到下一轮结束/,
    /画|涂鸦/,
    /开合跳|深蹲|俯卧撑|平板支撑|伸展|瑜伽|跳舞|舞蹈|跳一段/,
    /照片|自拍|拍一张|合照/,
    /外语|单词|成语|古诗|百科|科普|播客/
  ];

  function topicsOf(text) {
    var mask = 0;
    TOPICS.forEach(function (re, i) { if (re.test(text)) mask |= 1 << i; });
    return mask;
  }

  function randInt(n) {
    if (window.crypto && window.crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  var drawHistory = (function () {
    var raw = storage.get(HISTORY_KEY, {});
    return raw && typeof raw === 'object' ? raw : {};
  })();
  var poolVersion = 0;      // 题库或设置变动时 +1，重新计算相似度用的词频
  var simCache = {};
  var warned = {};

  function invalidatePools() {
    poolVersion++;
    simCache = {};
    warned = {};
  }

  function buildPool(cat, level) {
    var builtin = builtinList(cat, level).map(function (item) {
      return cat === 'daily'
        ? { text: item.t, emoji: item.e, cat: item.c, minutes: item.m, custom: false }
        : { text: item, custom: false };
    });
    var custom = customList(cat, level).map(function (text) {
      return cat === 'daily'
        ? { text: text, emoji: '✨', cat: '自定义', minutes: null, custom: true }
        : { text: text, custom: true };
    });

    if (settings.onlyCustom) {
      if (custom.length) return { pool: custom, fallback: false };
      return { pool: builtin, fallback: true };
    }
    return { pool: builtin.concat(custom), fallback: false };
  }

  // 把题目拆成相邻两个字的组合（去掉标点、数字和 emoji），用来比较两题是不是在讲同一件事
  function bigrams(text) {
    var s = text.replace(/[^一-鿿A-Za-z]/g, '');
    var seen = {};
    var out = [];
    for (var i = 0; i < s.length - 1; i++) {
      var g = s.substr(i, 2);
      if (!seen[g]) { seen[g] = true; out.push(g); }
    }
    return out;
  }

  // “什么”“在场”这类每题都有的词权重很低，“前任”“相册”这类少见的词权重高
  function similarityIndex(key, pool) {
    var cached = simCache[key];
    if (cached && cached.size === pool.length) return cached;
    var grams = {};
    var df = {};
    pool.forEach(function (item) {
      var g = bigrams(item.text);
      grams[item.text] = g;
      g.forEach(function (x) { df[x] = (df[x] || 0) + 1; });
    });
    var idf = {};
    Object.keys(df).forEach(function (x) { idf[x] = Math.log((pool.length + 1) / df[x]); });
    var topics = {};
    pool.forEach(function (item) { topics[item.text] = topicsOf(item.text); });
    cached = { size: pool.length, grams: grams, idf: idf, topics: topics };
    simCache[key] = cached;
    return cached;
  }

  function similarity(index, a, b) {
    var ga = index.grams[a] || bigrams(a);
    var gb = index.grams[b] || bigrams(b);
    if (!ga.length || !gb.length) return 0;
    var setB = {};
    gb.forEach(function (x) { setB[x] = true; });
    var shared = 0;
    var total = 0;
    ga.forEach(function (x) {
      var w = index.idf[x] || 0;
      total += w;
      if (setB[x]) shared += w;
    });
    gb.forEach(function (x) { total += index.idf[x] || 0; });
    total -= shared;   // 并集
    return total > 0 ? shared / total : 0;
  }

  function saveHistory() { storage.set(HISTORY_KEY, drawHistory); }

  function drawFrom(key, pool) {
    var h = drawHistory[key];
    if (!h || !Array.isArray(h.seen) || !Array.isArray(h.recent)) h = drawHistory[key] = { seen: [], recent: [] };

    var seen = {};
    h.seen.forEach(function (t) { seen[t] = true; });
    var unseen = pool.filter(function (item) { return !seen[item.text]; });

    if (!unseen.length) {
      // 全部抽过一轮了 → 重新开始，但最近抽过的几张先不放回来
      h.seen = [];
      var hold = {};
      h.recent.slice(-Math.min(RECENT_SIZE, Math.floor(pool.length / 2))).forEach(function (t) { hold[t] = true; });
      unseen = pool.filter(function (item) { return !hold[item.text]; });
      if (!unseen.length) unseen = pool.slice();
    }

    var index = similarityIndex(key, pool);
    var byText = {};
    pool.forEach(function (item) { byText[item.text] = item; });
    var recent = h.recent.filter(function (t) { return byText[t]; });
    var lastCat = recent.length ? byText[recent[recent.length - 1]].cat : null;

    // 随机挑几张候选，算出各自和最近几题有多像
    var candidates = shuffle(unseen.slice()).slice(0, CANDIDATES).map(function (item) {
      var score = 0;
      recent.forEach(function (t, k) {
        var age = recent.length - 1 - k;                     // 0 = 上一题
        var weight = 1 - age * 0.12;                         // 越近的题影响越大
        score = Math.max(score, similarity(index, item.text, t) * weight);
        if (age < TOPIC_GAP && (index.topics[item.text] & index.topics[t])) score = Math.max(score, SIMILAR + 0.05);
      });
      if (item.cat && lastCat && item.cat === lastCat) score += SIMILAR;   // 同分类算作“有点像”
      return { item: item, score: score };
    });
    // 在“不像”的候选里随机选一张；都很像就选最不像的
    var fresh = candidates.filter(function (c) { return c.score < SIMILAR; });
    var chosen = fresh.length
      ? fresh[0]
      : candidates.reduce(function (a, b) { return b.score < a.score ? b : a; });

    var item = chosen.item;
    h.seen.push(item.text);
    h.recent.push(item.text);
    if (h.recent.length > RECENT_SIZE) h.recent = h.recent.slice(-RECENT_SIZE);
    // 被删掉的自定义题目不用一直记着
    h.seen = h.seen.filter(function (t) { return byText[t]; });
    saveHistory();
    return item;
  }

  function drawItem(cat, level) {
    var key = cat === 'daily' ? 'daily' : cat + '-' + level;
    var built = buildPool(cat, level);
    if (built.fallback && !warned[key]) {
      warned[key] = true;
      var name = cat === 'daily' ? '“现在干嘛”' : '“' + NAME[cat] + '·' + NAME[level] + '”';
      toast(name + '还没有自定义题目，先从内置题库抽啦');
    }
    return drawFrom(key, built.pool);
  }

  /* ---------------- 小工具 ---------------- */
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function animate(el, frames, options) {
    if (!el.animate || reduceMotion.matches) return Promise.resolve();
    try {
      return el.animate(frames, options).finished.catch(function () {});
    } catch (e) {
      return Promise.resolve();
    }
  }

  function stopAnimations(el) {
    if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); });
  }

  // 换文字时先淡出、再从下面淡入；连续快速切换时以最后一次为准
  function swapText(el, text, animated) {
    var pending = el.__nextText;
    if ((pending !== undefined ? pending : el.textContent) === text) return;
    if (!animated || !el.animate || reduceMotion.matches) {
      el.__nextText = undefined;
      stopAnimations(el);
      el.textContent = text;
      return;
    }
    el.__nextText = text;
    stopAnimations(el);
    el.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-5px)' }
    ], { duration: 110, easing: 'ease-in', fill: 'forwards' }).finished.then(function () {
      el.textContent = el.__nextText;
      el.__nextText = undefined;
      stopAnimations(el);
      el.animate([
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 220, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    }, function () {});
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* 不支持就算了 */ }
    }
  }

  function announce(text) {
    var el = $('#announcer');
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 50);
  }

  /* ---------------- Toast ---------------- */
  var toastEl = $('#toast');
  var toastMsg = $('.toast-msg', toastEl);
  var toastBtn = $('.toast-action', toastEl);
  var toastTimer = null;
  var toastAction = null;

  function toast(message, action) {
    // 自定义题库开着时，dialog 位于最上层，所以把 toast 搬进去才看得到
    var sheet = $('#bankSheet');
    var host = sheet.open ? sheet : document.body;
    if (toastEl.parentNode !== host) host.appendChild(toastEl);

    toastMsg.textContent = message;
    toastAction = action || null;
    toastBtn.hidden = !action;
    if (action) toastBtn.textContent = action.label;

    toastEl.classList.remove('is-show');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 4500 : 2600);
  }

  function hideToast() {
    toastEl.classList.remove('is-show');
    toastAction = null;
  }

  toastBtn.addEventListener('click', function () {
    var action = toastAction;
    hideToast();
    if (action) action.run();
  });

  /* ---------------- 彩带 ---------------- */
  function confetti(x, y) {
    if (reduceMotion.matches) return;
    var layer = $('#confetti');
    var colors = ['#D96B3F', '#6A5FD0', '#4A77C8', '#CF566B', '#2E9A80', '#E0B04A'];
    for (var i = 0; i < 26; i++) {
      var p = document.createElement('i');
      var size = 6 + Math.random() * 7;
      p.className = 'confetti-piece';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size * (0.45 + Math.random() * 0.8) + 'px';
      p.style.background = colors[i % colors.length];
      if (Math.random() < 0.3) p.style.borderRadius = '50%';
      layer.appendChild(p);

      var angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      var speed = 120 + Math.random() * 200;
      var dx = Math.cos(angle) * speed;
      var dy = Math.sin(angle) * speed;
      var rot = (Math.random() - 0.5) * 720;
      (function (piece) {
        piece.animate([
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
          { transform: 'translate(' + dx + 'px, ' + dy + 'px) rotate(' + rot + 'deg)', opacity: 1, offset: 0.45 },
          { transform: 'translate(' + dx * 1.35 + 'px, ' + (dy + 320) + 'px) rotate(' + rot * 2 + 'deg)', opacity: 0 }
        ], {
          duration: 1100 + Math.random() * 700,
          easing: 'cubic-bezier(.2, .6, .4, 1)'
        }).finished.then(function () { piece.remove(); }, function () { piece.remove(); });
      })(p);
    }
  }

  /* ---------------- 模式切换 ---------------- */
  var tabs = $$('.mode-tab');

  function setMode(mode, focus) {
    settings.mode = mode;
    saveSettings();
    document.body.dataset.mode = mode;
    tabs.forEach(function (tab) {
      var active = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    $('#panel-daily').hidden = mode !== 'daily';
    $('#panel-party').hidden = mode !== 'party';
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      if (settings.mode !== tab.dataset.mode) setMode(tab.dataset.mode);
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setMode(settings.mode === 'daily' ? 'party' : 'daily', true);
      }
    });
  });

  /* ---------------- 现在干嘛 ---------------- */
  var taskCard = $('#taskCard');
  var taskEmoji = $('#taskEmoji');
  var drawDailyBtn = $('#drawDaily');
  var doneBtn = $('#doneDaily');
  var dailyActions = $('#dailyActions');
  var dailyToken = 0;       // 每抽一次 +1；旧的动画看到号码不同就自动退场
  var dailyHasCard = false;

  function categoryColor(cat) {
    return DATA.categories[cat] || DATA.categories['自定义'];
  }

  function renderTask(item) {
    taskCard.classList.remove('is-empty', 'is-done');
    taskCard.style.setProperty('--cat', categoryColor(item.cat));
    taskEmoji.textContent = item.emoji;
    $('#taskCat').textContent = item.custom ? '✏️ 自定义' : '#' + item.cat;
    var time = $('#taskTime');
    time.hidden = !item.minutes;
    if (item.minutes) time.textContent = '⏱ ' + item.minutes + ' 分钟';
    $('#taskText').textContent = item.text;
  }

  function drawDaily() {
    var token = ++dailyToken;
    var item = drawItem('daily');
    vibrate(10);
    // 骰子滚一圈
    var dice = $('.btn-icon', drawDailyBtn);
    stopAnimations(dice);
    animate(dice, [
      { transform: 'none' },
      { transform: 'rotate(380deg) scale(1.15)', offset: 0.7 },
      { transform: 'rotate(360deg)' }
    ], { duration: 520, easing: 'cubic-bezier(.2, .7, .3, 1)' });

    // 从卡片“现在的样子”开始退场，就算上一张还在飞也不会跳一下
    var cs = getComputedStyle(taskCard);
    var from = { transform: cs.transform, opacity: cs.opacity };
    stopAnimations(taskCard);

    var exit = dailyHasCard
      ? animate(taskCard, [
          from,
          { transform: 'translate(-30%, 6px) rotate(-9deg) scale(.94)', opacity: 0 }
        ], { duration: 170, easing: 'cubic-bezier(.5, 0, .75, 0)', fill: 'forwards' })
      : animate(taskCard, [
          from,
          { transform: 'scale(.95) rotate(-1.5deg)', opacity: 1 }
        ], { duration: 110, easing: 'ease-in', fill: 'forwards' });

    exit.then(function () {
      if (token !== dailyToken) return;
      renderTask(item);
      dailyHasCard = true;
      swapText($('.btn-label', drawDailyBtn), '再抽一张', true);
      dailyActions.classList.add('has-done');
      doneBtn.disabled = false;
      doneBtn.tabIndex = 0;
      doneBtn.removeAttribute('aria-hidden');
      swapText($('.btn-label', doneBtn), '完成', true);
      announce('抽到任务：' + item.text);

      stopAnimations(taskEmoji);
      animate(taskEmoji, [
        { transform: 'scale(.3) rotate(-25deg)' },
        { transform: 'scale(1.12) rotate(6deg)', offset: 0.6 },
        { transform: 'none' }
      ], { duration: 520, delay: 80, easing: 'cubic-bezier(.3, .8, .4, 1)', fill: 'backwards' });

      return animate(taskCard, [
        { transform: 'translateY(34px) rotate(5deg) scale(.88)', opacity: 0 },
        { transform: 'translateY(-5px) rotate(-1deg) scale(1.015)', opacity: 1, offset: 0.62 },
        { transform: 'none', opacity: 1 }
      ], { duration: 440, easing: 'cubic-bezier(.25, .8, .35, 1)' }).then(function () {
        if (token === dailyToken) stopAnimations(taskCard);
      });
    });
  }

  function completeTask() {
    if (!dailyHasCard || taskCard.classList.contains('is-done')) return;
    settings.done += 1;
    saveSettings();
    renderDoneCount();
    taskCard.classList.add('is-done');
    doneBtn.disabled = true;
    swapText($('.btn-label', doneBtn), '已完成', true);
    vibrate([12, 40, 18]);
    var rect = doneBtn.getBoundingClientRect();
    confetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    var cheers = ['太棒了！🎉', '做得好！✨', '又完成一个！💪', '今天也很棒 🌈', '给自己拍拍手 👏'];
    toast(cheers[randInt(cheers.length)]);
  }

  function renderDoneCount() {
    $('#doneCount').textContent = settings.done;
  }

  drawDailyBtn.addEventListener('click', drawDaily);
  doneBtn.addEventListener('click', completeTask);

  /* ---------------- 真心话大冒险 ---------------- */
  var flipCard = $('#flipCard');
  var flipInner = $('.flip-inner', flipCard);
  var faceCover = $('.face-cover', flipCard);
  var faceContent = $('#faceContent');
  var drawPartyBtn = $('#drawParty');
  var levelPicker = $('#levelPicker');
  var flipped = false;      // 目前停在题目面
  var spinning = false;     // 翻牌动画进行中
  var queuedDraw = false;   // 动画中又按了一次 → 这次翻完马上再抽
  var shown = null;         // 题目面上那题的 { type, level }
  var partyCount = 0;

  var SPIN = {
    // 背面 → 题目：最后带一点点回弹
    reveal: { from: 0, to: 180, duration: 620, easing: 'cubic-bezier(.3, .9, .35, 1.06)' },
    // 题目 → 转一整圈 → 新题目：曲线必须前后对称，转到一半时刚好背面朝前，在那一刻换题
    redraw: { from: 180, to: 540, duration: 760, easing: 'cubic-bezier(.65, 0, .35, 1)' },
    // 题目 → 背面
    hide: { from: 180, to: 0, duration: 480, easing: 'cubic-bezier(.45, .05, .25, 1)' }
  };

  function setFlipped(value) {
    flipped = value;
    flipCard.classList.toggle('is-flipped', value);
    faceContent.setAttribute('aria-hidden', String(!value));
    faceCover.setAttribute('aria-hidden', String(value));
    flipCard.setAttribute('aria-label', value ? '再抽一张' : '翻牌');
  }

  function renderPicker(animated) {
    $$('.type-tile').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.type === settings.type));
    });
    $$('.level-picker button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.level === settings.level));
    });
    flipCard.dataset.type = settings.type;          // 牌背颜色会平滑过渡（CSS）
    levelPicker.dataset.level = settings.level;     // 尺度选中块滑过去（CSS）
    var showText = animated && !flipped;             // 牌背朝前时，文字也淡出淡入
    swapText($('#coverTitle'), NAME[settings.type], showText);
    swapText($('#coverSub'), LABEL[settings.level] + ' · 点我翻牌', showText);
  }

  // 换类型／尺度时，牌轻轻转一下回应（往选的那一边转）
  function nudgeCard(dir) {
    if (flipped || spinning || !flipInner.animate || reduceMotion.matches) return;
    flipInner.animate([
      { transform: 'rotateY(0deg)' },
      { transform: 'rotateY(' + (-18 * dir) + 'deg)', offset: 0.35 },
      { transform: 'rotateY(' + (6 * dir) + 'deg)', offset: 0.72 },
      { transform: 'rotateY(0deg)' }
    ], { duration: 560, easing: 'ease-in-out' });
    animate($('.cover-ring', flipCard), [
      { transform: 'none' },
      { transform: 'scale(.86) rotate(' + (-12 * dir) + 'deg)', offset: 0.4 },
      { transform: 'none' }
    ], { duration: 520, easing: 'cubic-bezier(.3, .7, .3, 1)' });
  }

  function spin(cfg, atMidpoint) {
    spinning = true;
    var swapped = false;
    var swap = function () {
      if (swapped || !atMidpoint) return;
      swapped = true;
      atMidpoint();
    };
    var finish = function () {
      swap();
      setFlipped(cfg.to % 360 === 180);
      flipCard.classList.remove('is-turning');
      stopAnimations(flipInner);
      spinning = false;
    };

    if (!flipInner.animate || reduceMotion.matches) {
      finish();
      return Promise.resolve();
    }

    flipCard.classList.add('is-turning');
    var anim = flipInner.animate([
      { transform: 'rotateY(' + cfg.from + 'deg)' },
      { transform: 'rotateY(' + cfg.to + 'deg)' }
    ], { duration: cfg.duration, easing: cfg.easing, fill: 'forwards' });
    flipCard.animate([
      { transform: 'none' },
      { transform: 'translateY(-10px) scale(1.035)', offset: 0.5 },
      { transform: 'none' }
    ], { duration: cfg.duration, easing: 'ease-in-out' });

    if (atMidpoint) {
      var watch = function () {
        if (swapped) return;
        if (anim.currentTime >= cfg.duration / 2) swap();
        else requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);
    }
    return anim.finished.catch(function () {}).then(finish);
  }

  function showQuestion(item, type, level, count) {
    shown = { type: type, level: level };
    faceContent.dataset.qtype = type;
    $('#qType').textContent = LABEL[type];
    $('#qLevel').textContent = LABEL[level];
    $('#qCustom').hidden = !item.custom;
    $('#qText').textContent = item.text;
    $('#qFoot').textContent = 'No. ' + String(count).padStart(2, '0');
  }

  function drawParty() {
    if (spinning) {
      queuedDraw = true;
      return;
    }
    var type = settings.type;
    var level = settings.level;
    var item = drawItem(type, level);
    var count = ++partyCount;
    var fill = function () { showQuestion(item, type, level, count); };
    vibrate(12);
    swapText($('.btn-label', drawPartyBtn), '再抽一张', true);
    animate($('.btn-icon', drawPartyBtn), [
      { transform: 'perspective(200px) rotateY(0deg)' },
      { transform: 'perspective(200px) rotateY(360deg)' }
    ], { duration: 600, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    announce(NAME[type] + '：' + item.text);

    var done;
    if (flipped) {
      done = spin(SPIN.redraw, fill);
    } else {
      fill();
      done = spin(SPIN.reveal);
    }
    done.then(afterSpin);
  }

  function hideCard() {
    if (!flipped || spinning) return;
    swapText($('.btn-label', drawPartyBtn), '翻牌！', true);
    spin(SPIN.hide).then(afterSpin);
  }

  function afterSpin() {
    if (queuedDraw) {
      queuedDraw = false;
      drawParty();
      return;
    }
    // 翻牌途中换了类型或尺度 → 翻完后收回背面
    if (flipped && shown && (shown.type !== settings.type || shown.level !== settings.level)) hideCard();
  }

  function choose(key, value) {
    if (settings[key] === value) return;
    settings[key] = value;
    saveSettings();
    renderPicker(true);
    // 换类型或尺度时：题目面朝前 → 翻回背面；背面朝前 → 牌轻轻转一下
    var dir = (key === 'type' ? value === 'dare' : value === 'advanced') ? 1 : -1;
    if (flipped && !spinning) hideCard();
    else nudgeCard(dir);
  }

  $$('.type-tile').forEach(function (btn) {
    btn.addEventListener('click', function () { choose('type', btn.dataset.type); });
  });
  $$('.level-picker button').forEach(function (btn) {
    btn.addEventListener('click', function () { choose('level', btn.dataset.level); });
  });
  drawPartyBtn.addEventListener('click', drawParty);
  flipCard.addEventListener('click', drawParty);
  flipCard.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      drawParty();
    }
  });

  /* ---------------- 自定义题库 ---------------- */
  var sheet = $('#bankSheet');
  var addInput = $('#addInput');
  var onlyCustomInput = $('#onlyCustom');
  var bankView = { cat: 'daily', level: 'normal' };
  var newestItems = [];

  var PLACEHOLDER = {
    daily: '例如：去楼下买一杯没喝过的饮料\n例如：写一张小卡给明天的自己',
    truth: '例如：你手机里最近一张截屏是什么？\n例如：你最想删掉哪一条旧朋友圈？',
    dare: '例如：用家乡话唱一段生日快乐歌\n例如：用三个 emoji 形容右边的人'
  };

  function saveBank() {
    invalidatePools();
    if (!storage.set(BANK_KEY, bank)) {
      toast('⚠️ 无法保存，浏览器可能禁用了本地存储');
    }
  }

  function renderBank() {
    var cat = bankView.cat;
    var level = bankView.level;

    $$('#bankCatSeg button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.cat === cat));
    });
    var levelSeg = $('#bankLevelSeg');
    levelSeg.hidden = cat === 'daily';
    $$('button', levelSeg).forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.level === level));
    });
    addInput.placeholder = PLACEHOLDER[cat];

    var list = customList(cat, level);
    var ul = $('#bankList');
    var frag = document.createDocumentFragment();
    list.forEach(function (text, index) {
      var li = document.createElement('li');
      li.className = 'bank-item';
      if (newestItems.indexOf(text) !== -1) li.classList.add('is-new');

      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(index + 1).padStart(2, '0');

      var p = document.createElement('p');
      p.textContent = text;

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'del-btn';
      del.textContent = '🗑️';
      del.setAttribute('aria-label', '删除：' + text);
      del.addEventListener('click', function () { removeItem(index); });

      li.appendChild(num);
      li.appendChild(p);
      li.appendChild(del);
      frag.appendChild(li);
    });
    ul.replaceChildren(frag);
    newestItems = [];

    $('#bankCount').textContent = list.length;
    $('#bankEmpty').hidden = list.length > 0;
    $('#clearCat').disabled = list.length === 0;
    $('#builtinCount').textContent = '另有内置 ' + builtinList(cat, level).length + ' 题';
    onlyCustomInput.checked = settings.onlyCustom;
  }

  function changeBank(mutate, message) {
    var snapshot = JSON.stringify(bank);
    mutate();
    saveBank();
    renderBank();
    toast(message, {
      label: '撤销',
      run: function () {
        bank = normalizeBank(JSON.parse(snapshot));
        saveBank();
        renderBank();
        toast('已撤销 ↩️');
      }
    });
  }

  function addItems(e) {
    e.preventDefault();
    var lines = addInput.value.split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    if (!lines.length) {
      toast('先输入题目再添加哦 ✍️');
      addInput.focus();
      return;
    }

    var list = customList(bankView.cat, bankView.level);
    var added = [];
    var skipped = 0;
    var trimmed = 0;
    lines.forEach(function (line) {
      var text = line.slice(0, MAX_LEN);
      if (text.length < line.length) trimmed++;
      if (list.indexOf(text) !== -1 || added.indexOf(text) !== -1) { skipped++; return; }
      added.push(text);
    });

    if (!added.length) {
      toast('这些题目已经在题库里了 👀');
      return;
    }

    newestItems = added.slice();
    var msg = '已添加 ' + added.length + ' 题 🎉';
    if (skipped) msg += '（跳过 ' + skipped + ' 题重复）';
    if (trimmed) msg += '（过长的题目已截断为 ' + MAX_LEN + ' 字）';
    changeBank(function () {
      Array.prototype.push.apply(list, added);
    }, msg);
    addInput.value = '';
    addInput.focus();
  }

  function removeItem(index) {
    var list = customList(bankView.cat, bankView.level);
    var text = list[index];
    if (text === undefined) return;
    changeBank(function () { list.splice(index, 1); }, '已删除“' + truncate(text, 12) + '”');
  }

  function clearCategory() {
    var list = customList(bankView.cat, bankView.level);
    if (!list.length) return;
    var count = list.length;
    changeBank(function () { list.length = 0; }, '已清空 ' + count + ' 题');
  }

  function truncate(text, n) {
    return text.length > n ? text.slice(0, n) + '…' : text;
  }

  function openBank() {
    // 缺省打开目前正在玩的分类
    if (settings.mode === 'daily') {
      bankView.cat = 'daily';
    } else {
      bankView.cat = settings.type;
      bankView.level = settings.level;
    }
    renderBank();
    sheet.classList.remove('is-closing');
    if (typeof sheet.showModal === 'function') {
      sheet.showModal();
    } else {
      sheet.setAttribute('open', '');
    }
  }

  function closeBank() {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    var finish = function () {
      if (typeof sheet.close === 'function') sheet.close();
      else { sheet.removeAttribute('open'); onBankClosed(); }
    };
    if (reduceMotion.matches) { finish(); return; }
    sheet.classList.add('is-closing');
    wait(230).then(finish);
  }

  function onBankClosed() {
    sheet.classList.remove('is-closing');
    hideToast();
    document.body.appendChild(toastEl);
  }

  function exportBank() {
    var total = bank.daily.length;
    ['truth', 'dare'].forEach(function (t) {
      total += bank[t].normal.length + bank[t].advanced.length;
    });
    if (!total) {
      toast('题库还是空的，先添加几题再导出吧');
      return;
    }
    var payload = {
      app: 'lucky',
      version: 1,
      exportedAt: new Date().toISOString(),
      bank: bank
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = url;
    a.download = 'lucky-custom-bank-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已导出 ' + total + ' 题 💾');
  }

  function importBank(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        toast('😵 文件格式不对，请选择 Lucky 导出的 JSON 文件');
        return;
      }
      var incoming = normalizeBank(parsed && parsed.bank ? parsed.bank : parsed);
      var added = 0;
      changeBankSilently(function () {
        added += mergeInto(bank.daily, incoming.daily);
        ['truth', 'dare'].forEach(function (t) {
          ['normal', 'advanced'].forEach(function (l) {
            added += mergeInto(bank[t][l], incoming[t][l]);
          });
        });
      }, function (snapshot) {
        if (!added) {
          toast('没有新的题目可以导入 👀');
          return;
        }
        toast('已导入 ' + added + ' 题 📥', {
          label: '撤销',
          run: function () {
            bank = normalizeBank(JSON.parse(snapshot));
            saveBank();
            renderBank();
            toast('已撤销 ↩️');
          }
        });
      });
    };
    reader.onerror = function () { toast('😵 读取文件失败'); };
    reader.readAsText(file);
  }

  function changeBankSilently(mutate, after) {
    var snapshot = JSON.stringify(bank);
    mutate();
    saveBank();
    renderBank();
    after(snapshot);
  }

  function mergeInto(target, source) {
    var count = 0;
    source.forEach(function (text) {
      if (target.indexOf(text) === -1) {
        target.push(text);
        count++;
      }
    });
    return count;
  }

  $('#openBank').addEventListener('click', openBank);
  $('#closeBank').addEventListener('click', closeBank);
  sheet.addEventListener('close', onBankClosed);
  sheet.addEventListener('cancel', function (e) {
    e.preventDefault();
    closeBank();
  });
  sheet.addEventListener('click', function (e) {
    // 点背景（dialog 本身）就关闭
    if (e.target === sheet) closeBank();
  });
  $$('#bankCatSeg button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      bankView.cat = btn.dataset.cat;
      renderBank();
    });
  });
  $$('#bankLevelSeg button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      bankView.level = btn.dataset.level;
      renderBank();
    });
  });
  $('#addForm').addEventListener('submit', addItems);
  addInput.addEventListener('keydown', function (e) {
    // Ctrl / ⌘ + Enter 快速添加
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addItems(e);
  });
  onlyCustomInput.addEventListener('change', function () {
    settings.onlyCustom = onlyCustomInput.checked;
    saveSettings();
    invalidatePools();
    toast(settings.onlyCustom ? '之后只会抽你的自定义题目 ✏️' : '内置＋自定义题目一起抽 🎲');
  });
  $('#exportBank').addEventListener('click', exportBank);
  $('#importBank').addEventListener('click', function () { $('#importFile').click(); });
  $('#importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) importBank(file);
    e.target.value = '';
  });
  $('#clearCat').addEventListener('click', clearCategory);

  /* ---------------- 初始化 ---------------- */
  setMode(settings.mode);
  renderPicker(false);
  renderDoneCount();
})();
