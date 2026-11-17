/* Finzz mock kit.
   <i data-ion="name"></i>                          Ionicons glyph (auto-filled)
   <span class="avatar" data-name="X" data-size="56"></span>   letter avatar (same hash/colours as src/components/ui/Avatar.tsx)
   <div id="statusbar"></div>                       auto Finzz.statusbar
   <nav id="tabbar" data-active="Chats"></nav>      auto Finzz.tabbar (Chats|Pool|Expenses|Notes|Vault)
   Finzz.inr(n) -> "Rs 1,24,500" style (en-IN, max 2 decimals), same as formatCurrency in src/utils/money.ts */
(function () {
  try { var m = /[?&]theme=(light|dark)/.exec(location.search); document.documentElement.dataset.theme = m ? m[1] : "dark"; } catch (e) { document.documentElement.dataset.theme = "dark"; }
  var ICONS = window.FINZZ_ICONS || {};
  var COLORS = ["#C0392B", "#1F7A6B", "#1F6FA8", "#4A7C59", "#B7791F", "#8E44AD", "#117864", "#A04000", "#6C3483", "#21618C", "#935116", "#1E8449"];
  function hash(n) { var h = 0; for (var i = 0; i < n.length; i++) { h = n.charCodeAt(i) + ((h << 5) - h); h |= 0; } return Math.abs(h); }
  function initials(n) { var p = n.trim().split(" ").filter(Boolean); if (!p.length) return "?"; if (p.length == 1) return p[0][0].toUpperCase(); return (p[0][0] + p[p.length - 1][0]).toUpperCase(); }
  var F = {
    inr: function (a) { var v = Number(a); if (!isFinite(v)) return "₹0"; return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 }); },
    num: function (a) { var v = Number(a); if (!isFinite(v)) return "0"; return v.toLocaleString("en-IN", { maximumFractionDigits: 2 }); },
    icons: function (root) {
      (root || document).querySelectorAll("i[data-ion]").forEach(function (e) {
        var c = ICONS[e.getAttribute("data-ion")];
        e.textContent = c ? String.fromCodePoint(c) : "?";
        if (!c) console.warn("no icon", e.getAttribute("data-ion"));
      });
    },
    avatars: function (root) {
      (root || document).querySelectorAll(".avatar[data-name]").forEach(function (e) {
        var n = e.getAttribute("data-name"), s = +(e.getAttribute("data-size") || 48);
        e.style.width = e.style.height = s + "px";
        e.style.fontSize = (s * 0.38) + "px";
        e.style.background = COLORS[hash(n.trim() || "?") % COLORS.length];
        e.textContent = initials(n);
      });
    },
    statusbar: function (el) {
      el.className = "statusbar";
      el.innerHTML = '<span>9:41</span><span class="sb-right"><i data-ion="wifi"></i><i data-ion="cellular"></i><i data-ion="battery-full"></i></span>';
      F.icons(el);
    },
    tabbar: function (el, active) {
      var T = [["Chats", "chatbubbles"], ["Pool", "people-circle"], ["Expenses", "wallet"], ["Notes", "document-text"], ["Vault", "lock-closed"]];
      el.className = "tabbar";
      el.innerHTML = T.map(function (t) {
        var a = t[0] === active;
        return '<div class="tab' + (a ? " active" : "") + '"><i data-ion="' + t[1] + (a ? "" : "-outline") + '"></i><span>' + t[0] + "</span></div>";
      }).join("") + '<div class="gesture-pill"></div>';
      F.icons(el);
    }
  };
  window.Finzz = F;
  function init() {
    var sb = document.getElementById("statusbar"); if (sb) F.statusbar(sb);
    var tb = document.getElementById("tabbar"); if (tb) F.tabbar(tb, tb.getAttribute("data-active") || "Chats");
    F.icons(); F.avatars();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
