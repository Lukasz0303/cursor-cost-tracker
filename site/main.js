(function () {
  var root = document.documentElement;
  var button = document.querySelector("[data-theme-toggle]");
  var meta = document.getElementById("theme-color");
  if (!button) return;

  function currentTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function themeLabel(theme) {
    var i18n = window.CCT_I18N;
    if (!i18n) {
      return theme === "light" ? "Switch to dark mode" : "Switch to light mode";
    }
    var locale = i18n.currentLocale();
    return i18n.t(locale, theme === "light" ? "theme.toDark" : "theme.toLight") || "";
  }

  function applyTheme(theme) {
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try { localStorage.setItem("cct-site-theme", theme); } catch (e) {}
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f6f8" : "#07090c");
    button.setAttribute("aria-label", themeLabel(theme));
  }

  applyTheme(currentTheme());
  button.addEventListener("click", function () {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });
  document.addEventListener("cct:locale", function () {
    button.setAttribute("aria-label", themeLabel(currentTheme()));
  });
})();

(function () {
  var i18n = window.CCT_I18N;
  if (!i18n) return;
  var select = document.querySelector("[data-lang-select]");
  var locale = i18n.currentLocale();
  i18n.applyLocale(locale);
  if (!select) return;
  select.value = locale;
  select.addEventListener("change", function () {
    i18n.applyLocale(select.value);
  });
})();

(function () {
  var note = document.getElementById("stat-note");
  function noteText(key) {
    var i18n = window.CCT_I18N;
    if (!i18n) return key === "proof.live" ? "Live from Open VSX" : "Open VSX snapshot";
    return i18n.t(i18n.currentLocale(), key) || "";
  }
  fetch("https://open-vsx.org/api/lukasz0303/cursor-cost-tracker")
    .then(function (response) { return response.ok ? response.json() : Promise.reject(); })
    .then(function (data) {
      var downloads = document.querySelector("[data-downloads]");
      if (downloads && typeof data.downloadCount === "number") {
        downloads.textContent = new Intl.NumberFormat("en-US").format(data.downloadCount);
      }
      var version = document.querySelector("[data-version]");
      if (version && data.version) version.textContent = data.version;
      var rating = document.querySelector("[data-rating]");
      if (rating && typeof data.averageRating === "number") {
        rating.textContent = data.averageRating.toFixed(1);
      }
      var reviews = document.querySelector("[data-reviews]");
      if (reviews && typeof data.reviewCount === "number") {
        reviews.textContent = String(data.reviewCount);
      }
      if (note) {
        note.setAttribute("data-live", "1");
        note.textContent = noteText("proof.live");
      }
    })
    .catch(function () {
      if (note) {
        note.removeAttribute("data-live");
        note.textContent = noteText("proof.note");
      }
    });
  document.addEventListener("cct:locale", function () {
    if (!note) return;
    var live = note.getAttribute("data-live") === "1";
    note.textContent = noteText(live ? "proof.live" : "proof.note");
  });
})();

(function () {
  var fold = document.querySelector("[data-compare-fold]");
  var more = document.querySelector("[data-compare-more]");
  if (!fold || !more) return;
  more.addEventListener("click", function () {
    fold.classList.add("is-expanded");
  });
})();

(function () {
  var bar = document.querySelector(".top");
  if (!bar) return;

  function navOffset() {
    return Math.ceil(bar.getBoundingClientRect().height) + 16;
  }

  function scrollToHash(hash, smooth) {
    if (!hash || hash === "#") return false;
    var id = hash.replace(/^#/, "");
    var el = document.getElementById(id);
    if (!el) return false;
    var top = el.getBoundingClientRect().top + window.pageYOffset - navOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    return true;
  }

  document.addEventListener("click", function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link || link.getAttribute("href") === "#") return;
    if (link.target && link.target !== "_self") return;
    var hash = link.getAttribute("href");
    if (!scrollToHash(hash, true)) return;
    event.preventDefault();
    if (history.pushState) history.pushState(null, "", hash);
  });

  if (location.hash) {
    window.setTimeout(function () { scrollToHash(location.hash, false); }, 0);
  }
})();

(function () {
  var nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    Array.prototype.forEach.call(nodes, function (node) { node.classList.add("is-in"); });
    return;
  }
  if (!("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(nodes, function (node) { node.classList.add("is-in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  Array.prototype.forEach.call(nodes, function (node) { io.observe(node); });
})();

(function () {
  var buttons = document.querySelectorAll("[data-copy]");
  if (!buttons.length) return;
  Array.prototype.forEach.call(buttons, function (button) {
    var row = button.closest(".copy-row");
    var source = row ? row.querySelector("[data-copy-text]") : null;
    if (!source) return;
    button.addEventListener("click", function () {
      var text = source.textContent.trim();
      var idle = button.textContent;
      var i18n = window.CCT_I18N;
      var copied = i18n ? (i18n.t(i18n.currentLocale(), "install.copied") || "Copied") : "Copied";
      var done = function () {
        button.textContent = copied;
        button.classList.add("is-copied");
        setTimeout(function () {
          button.textContent = idle;
          button.classList.remove("is-copied");
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          window.prompt("Copy:", text);
        });
        return;
      }
      window.prompt("Copy:", text);
    });
  });
})();

(function () {
  var slider = document.querySelector("[data-slider]");
  var dialog = document.querySelector("[data-lightbox]");
  if (!slider || !dialog) return;

  var track = slider.querySelector("[data-track]");
  var slides = Array.prototype.slice.call(track.querySelectorAll(".slide"));
  var thumbsBox = slider.querySelector("[data-thumbs]");
  var count = slider.querySelector("[data-count]");
  var lbImg = dialog.querySelector("[data-lb-img]");
  var lbView = dialog.querySelector("[data-lb-view]");
  var lbCaption = dialog.querySelector("[data-lb-caption]");
  var lbCount = dialog.querySelector("[data-lb-count]");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var total = slides.length;
  var index = 0;

  var items = slides.map(function (slide) {
    var img = slide.querySelector("img");
    var caption = slide.querySelector("figcaption");
    return {
      src: img.getAttribute("src"),
      alt: img.alt,
      captionEl: caption,
      caption: caption ? caption.textContent : ""
    };
  });

  function thumbLabel(i, caption) {
    var i18n = window.CCT_I18N;
    var prefix = i18n ? (i18n.t(i18n.currentLocale(), "slider.show") || "Show screenshot") : "Show screenshot";
    return prefix + " " + (i + 1) + ": " + caption;
  }

  function refreshCaptions() {
    items.forEach(function (item, i) {
      item.caption = item.captionEl ? item.captionEl.textContent : "";
      if (thumbs[i]) thumbs[i].setAttribute("aria-label", thumbLabel(i, item.caption));
    });
    if (dialog.open && lbCaption && !dialog.classList.contains("is-direct")) {
      lbCaption.textContent = items[lbIndex] ? items[lbIndex].caption : "";
    }
  }

  var thumbs = items.map(function (item, i) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.setAttribute("aria-label", thumbLabel(i, item.caption));
    var img = document.createElement("img");
    img.src = item.src;
    img.alt = "";
    img.loading = "lazy";
    button.appendChild(img);
    button.addEventListener("click", function () { goTo(i); });
    thumbsBox.appendChild(button);
    return button;
  });

  document.addEventListener("cct:locale", refreshCaptions);

  function wrapIndex(i) {
    return (i + total) % total;
  }

  function render() {
    count.textContent = (index + 1) + " / " + total;
    thumbs.forEach(function (thumb, i) {
      var active = i === index;
      thumb.classList.toggle("is-active", active);
      thumb.setAttribute("aria-current", active ? "true" : "false");
    });
    var active = thumbs[index];
    thumbsBox.scrollTo({
      left: active.offsetLeft - (thumbsBox.clientWidth - active.clientWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  function goTo(i) {
    index = wrapIndex(i);
    track.scrollTo({ left: slides[index].offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
    render();
  }

  var scrollTimer = 0;
  track.addEventListener("scroll", function () {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var next = Math.round(track.scrollLeft / track.clientWidth);
      if (next === index || next < 0 || next >= total) return;
      index = next;
      render();
    }, 80);
  }, { passive: true });

  slider.querySelector("[data-prev]").addEventListener("click", function () { goTo(index - 1); });
  slider.querySelector("[data-next]").addEventListener("click", function () { goTo(index + 1); });
  slider.querySelector("[data-zoom]").addEventListener("click", function () { openLightbox(index); });

  track.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); goTo(index + 1); }
  });

  slides.forEach(function (slide, i) {
    slide.querySelector(".slide-open").addEventListener("click", function () { openLightbox(i); });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-open]"), function (button) {
    button.addEventListener("click", function () {
      var img = button.querySelector("img");
      var src = img ? img.getAttribute("src") : "";
      for (var i = 0; i < items.length; i++) {
        if (items[i].src === src) {
          openLightbox(i);
          return;
        }
      }
      openDirect(src, img ? img.alt : "");
    });
  });

  var lbIndex = 0;

  function showInLightbox(i) {
    lbIndex = wrapIndex(i);
    var item = items[lbIndex];
    dialog.classList.remove("is-actual");
    lbImg.src = item.src;
    lbImg.alt = item.alt;
    lbCaption.textContent = item.caption;
    lbCount.textContent = (lbIndex + 1) + " / " + total;
  }

  function openLightbox(i) {
    dialog.classList.remove("is-direct");
    showInLightbox(i);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      window.open(items[lbIndex].src, "_blank", "noopener");
      return;
    }
    document.documentElement.classList.add("lightbox-open");
  }

  function openDirect(src, alt) {
    if (!src) return;
    dialog.classList.add("is-direct");
    dialog.classList.remove("is-actual");
    lbImg.src = src;
    lbImg.alt = alt || "";
    lbCaption.textContent = alt || "";
    lbCount.textContent = "";
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      window.open(src, "_blank", "noopener");
      return;
    }
    document.documentElement.classList.add("lightbox-open");
  }

  function closeLightbox() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", function () {
    document.documentElement.classList.remove("lightbox-open");
    if (lbIndex !== index) goTo(lbIndex);
  });

  dialog.querySelector("[data-lb-close]").addEventListener("click", closeLightbox);
  dialog.querySelector("[data-lb-prev]").addEventListener("click", function () { showInLightbox(lbIndex - 1); });
  dialog.querySelector("[data-lb-next]").addEventListener("click", function () { showInLightbox(lbIndex + 1); });

  lbImg.addEventListener("click", function (event) {
    event.stopPropagation();
    var actual = !dialog.classList.contains("is-actual");
    if (actual) {
      var rect = lbImg.getBoundingClientRect();
      var rx = (event.clientX - rect.left) / rect.width;
      var ry = (event.clientY - rect.top) / rect.height;
      dialog.classList.add("is-actual");
      lbView.scrollLeft = rx * lbView.scrollWidth - lbView.clientWidth / 2;
      lbView.scrollTop = ry * lbView.scrollHeight - lbView.clientHeight / 2;
      return;
    }
    dialog.classList.remove("is-actual");
  });

  lbView.addEventListener("click", function (event) {
    if (event.target === lbView) closeLightbox();
  });

  dialog.addEventListener("keydown", function (event) {
    if (dialog.classList.contains("is-direct")) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); showInLightbox(lbIndex - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); showInLightbox(lbIndex + 1); }
  });

  var touchX = null;
  lbView.addEventListener("touchstart", function (event) {
    if (dialog.classList.contains("is-actual")) return;
    touchX = event.touches[0].clientX;
  }, { passive: true });
  lbView.addEventListener("touchend", function (event) {
    if (touchX === null || dialog.classList.contains("is-direct")) {
      touchX = null;
      return;
    }
    var dx = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 40) return;
    showInLightbox(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  render();
})();
