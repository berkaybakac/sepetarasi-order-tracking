import {
	API_ROUTES,
	type DisplayProfile,
	type DisplayTextScale,
	TB1_DISPLAY_PROFILES,
	type Tb1DisplayProfile,
} from "@sepetarasi/shared";

interface Tb1CompatProfilePreset {
	layoutPreference: "stack" | "split";
	maxVisiblePerColumn: number;
	pageSeconds: number;
	textScale: DisplayTextScale;
	listColumns: number;
}

export const TB1_COMPAT_PROFILE_PRESETS: Record<Tb1DisplayProfile, Tb1CompatProfilePreset> = {
	led_256x512: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 4,
		pageSeconds: 6,
		textScale: "s",
		listColumns: 2,
	},
	led_344_square: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 4,
		pageSeconds: 5,
		textScale: "s",
		listColumns: 2,
	},
	led_512_square: {
		layoutPreference: "stack",
		maxVisiblePerColumn: 6,
		pageSeconds: 6,
		textScale: "m",
		listColumns: 2,
	},
};

const LEGACY_PROFILE_ALIASES: Partial<Record<DisplayProfile, Tb1DisplayProfile>> = {
	led_256x512: "led_256x512",
	led_344_square: "led_344_square",
	led_512_square: "led_512_square",
	portrait_compact: "led_256x512",
	tiny_landscape: "led_512_square",
	tv_1080p: "led_512_square",
};

const TB1_PROFILE_SET = new Set<Tb1DisplayProfile>(TB1_DISPLAY_PROFILES);

export function normalizeTb1CompatProfile(
	value: string | null | undefined,
): Tb1DisplayProfile | null {
	if (!value) return null;
	if (TB1_PROFILE_SET.has(value as Tb1DisplayProfile)) return value as Tb1DisplayProfile;
	return LEGACY_PROFILE_ALIASES[value as DisplayProfile] ?? null;
}

export function buildTb1CompatDisplayHtml(forcedProfile: Tb1DisplayProfile | null = null) {
	const serializedForcedProfile = forcedProfile ? JSON.stringify(forcedProfile) : "null";
	const serializedPresets = JSON.stringify(TB1_COMPAT_PROFILE_PRESETS);
	const serializedAliases = JSON.stringify(LEGACY_PROFILE_ALIASES);

	return `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sepetarasi Display</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        font-family: "Segoe UI", Arial, sans-serif;
      }

      body {
        min-height: 100vh;
      }

      .shell {
        --bg: #08111f;
        --surface: #0b1220;
        --text: #f8fafc;
        --muted: #cbd5e1;
        --header-border: #1f2937;
        --panel-divider: rgba(255, 255, 255, 0.08);
        --preparing-panel-bg: #21110a;
        --preparing-panel-divider: rgba(217, 119, 6, 0.35);
        --ready-panel-bg: #08180f;
        --preparing-title: #fbbf24;
        --ready-title: #4ade80;
        --preparing-count-bg: rgba(251, 191, 36, 0.16);
        --preparing-count-border: rgba(251, 191, 36, 0.45);
        --preparing-count-text: #fef3c7;
        --ready-count-bg: rgba(74, 222, 128, 0.16);
        --ready-count-border: rgba(74, 222, 128, 0.45);
        --ready-count-text: #dcfce7;
        --item-border: rgba(255, 255, 255, 0.08);
        --preparing-item-bg: rgba(251, 191, 36, 0.1);
        --preparing-item-border: rgba(251, 191, 36, 0.28);
        --preparing-item-text: #fef3c7;
        --ready-item-bg: rgba(74, 222, 128, 0.1);
        --ready-item-border: rgba(74, 222, 128, 0.28);
        --ready-item-text: #dcfce7;
        --title-size: 24px;
        --clock-size: 22px;
        --panel-title-size: 20px;
        --count-size: 18px;
        --item-size: 36px;
        --empty-size: 22px;
        --footer-size: 14px;
        --item-min-height: 76px;
        --header-padding-y: 12px;
        --header-padding-x: 14px;
        --panel-padding: 12px;
        --panel-head-gap: 10px;
        --list-columns: 2;
        --list-gap: 10px;
        --count-min-width: 44px;
        --count-padding-y: 5px;
        --count-padding-x: 8px;
        --item-radius: 14px;
        --empty-padding-y: 14px;
        --empty-padding-x: 12px;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg);
        color: var(--text);
      }

      .shell.theme-light {
        --bg: #f8fafc;
        --surface: #ffffff;
        --text: #0f172a;
        --muted: #475569;
        --header-border: #cbd5e1;
        --panel-divider: rgba(15, 23, 42, 0.1);
        --preparing-panel-bg: #fff7ed;
        --preparing-panel-divider: rgba(245, 158, 11, 0.38);
        --ready-panel-bg: #ecfdf5;
        --preparing-title: #b45309;
        --ready-title: #047857;
        --preparing-count-bg: rgba(245, 158, 11, 0.12);
        --preparing-count-border: rgba(245, 158, 11, 0.34);
        --preparing-count-text: #78350f;
        --ready-count-bg: rgba(16, 185, 129, 0.12);
        --ready-count-border: rgba(16, 185, 129, 0.34);
        --ready-count-text: #064e3b;
        --item-border: rgba(15, 23, 42, 0.12);
        --preparing-item-bg: rgba(245, 158, 11, 0.12);
        --preparing-item-border: rgba(245, 158, 11, 0.3);
        --preparing-item-text: #92400e;
        --ready-item-bg: rgba(16, 185, 129, 0.12);
        --ready-item-border: rgba(16, 185, 129, 0.3);
        --ready-item-text: #065f46;
      }

      .shell.theme-vivid {
        --bg: #09090b;
        --surface: #18181b;
        --text: #fafafa;
        --muted: #cbd5e1;
        --header-border: #3f3f46;
        --panel-divider: rgba(255, 255, 255, 0.1);
        --preparing-panel-bg: rgba(249, 115, 22, 0.1);
        --preparing-panel-divider: rgba(249, 115, 22, 0.42);
        --ready-panel-bg: rgba(20, 184, 166, 0.1);
        --preparing-title: #fb923c;
        --ready-title: #5eead4;
        --preparing-count-bg: rgba(249, 115, 22, 0.18);
        --preparing-count-border: rgba(251, 146, 60, 0.45);
        --preparing-count-text: #ffedd5;
        --ready-count-bg: rgba(20, 184, 166, 0.18);
        --ready-count-border: rgba(94, 234, 212, 0.45);
        --ready-count-text: #ccfbf1;
        --item-border: rgba(255, 255, 255, 0.1);
        --preparing-item-bg: rgba(249, 115, 22, 0.14);
        --preparing-item-border: rgba(251, 146, 60, 0.34);
        --preparing-item-text: #ffedd5;
        --ready-item-bg: rgba(20, 184, 166, 0.14);
        --ready-item-border: rgba(94, 234, 212, 0.34);
        --ready-item-text: #ccfbf1;
      }

      .shell.theme-retro {
        --bg: #000000;
        --surface: #051b11;
        --text: #86efac;
        --muted: #4ade80;
        --header-border: #14532d;
        --panel-divider: rgba(34, 197, 94, 0.22);
        --preparing-panel-bg: rgba(113, 63, 18, 0.18);
        --preparing-panel-divider: rgba(234, 179, 8, 0.5);
        --ready-panel-bg: rgba(20, 83, 45, 0.24);
        --preparing-title: #fde047;
        --ready-title: #86efac;
        --preparing-count-bg: rgba(234, 179, 8, 0.18);
        --preparing-count-border: rgba(250, 204, 21, 0.48);
        --preparing-count-text: #fef08a;
        --ready-count-bg: rgba(34, 197, 94, 0.18);
        --ready-count-border: rgba(74, 222, 128, 0.48);
        --ready-count-text: #bbf7d0;
        --item-border: rgba(34, 197, 94, 0.16);
        --preparing-item-bg: rgba(234, 179, 8, 0.14);
        --preparing-item-border: rgba(250, 204, 21, 0.34);
        --preparing-item-text: #fde68a;
        --ready-item-bg: rgba(34, 197, 94, 0.14);
        --ready-item-border: rgba(74, 222, 128, 0.34);
        --ready-item-text: #bbf7d0;
      }

      .shell.profile-led_256x512 {
        --header-padding-y: 10px;
        --header-padding-x: 14px;
        --panel-padding: 12px;
        --panel-head-gap: 8px;
        --list-columns: 2;
        --list-gap: 8px;
        --count-min-width: 42px;
      }

      .shell.profile-led_344_square {
        --header-padding-y: 8px;
        --header-padding-x: 10px;
        --panel-padding: 10px;
        --panel-head-gap: 8px;
        --list-columns: 2;
        --list-gap: 8px;
        --count-min-width: 38px;
        --count-padding-y: 4px;
        --count-padding-x: 6px;
        --item-radius: 12px;
        --empty-padding-y: 12px;
        --empty-padding-x: 10px;
      }

      .shell.profile-led_512_square {
        --header-padding-y: 12px;
        --header-padding-x: 14px;
        --panel-padding: 12px;
        --panel-head-gap: 10px;
        --list-columns: 2;
        --list-gap: 10px;
        --count-min-width: 46px;
      }

      .shell.scale-xs {
        --title-size: 16px;
        --clock-size: 14px;
        --panel-title-size: 15px;
        --count-size: 14px;
        --item-size: 24px;
        --empty-size: 16px;
        --footer-size: 12px;
        --item-min-height: 48px;
      }

      .shell.scale-s {
        --title-size: 20px;
        --clock-size: 18px;
        --panel-title-size: 18px;
        --count-size: 16px;
        --item-size: 30px;
        --empty-size: 18px;
        --footer-size: 13px;
        --item-min-height: 64px;
      }

      .shell.scale-l {
        --title-size: 28px;
        --clock-size: 26px;
        --panel-title-size: 24px;
        --count-size: 22px;
        --item-size: 44px;
        --empty-size: 28px;
        --footer-size: 18px;
        --item-min-height: 90px;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--header-padding-y) var(--header-padding-x);
        border-bottom: 2px solid var(--header-border);
        background: var(--surface);
      }

      .title {
        font-size: var(--title-size);
        font-weight: 900;
        letter-spacing: 0.04em;
      }

      .clock {
        font-size: var(--clock-size);
        font-weight: 700;
      }

      .screen {
        flex: 1;
        display: flex;
        min-height: 0;
      }

      .screen.stack {
        flex-direction: column;
      }

      .screen.split {
        flex-direction: row;
      }

      .panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        padding: var(--panel-padding);
        box-sizing: border-box;
      }

      .panel.preparing {
        background: var(--preparing-panel-bg);
        border-right: 2px solid var(--preparing-panel-divider);
      }

      .screen.stack .panel.preparing {
        border-right: 0;
        border-bottom: 2px solid var(--preparing-panel-divider);
      }

      .panel.ready {
        background: var(--ready-panel-bg);
      }

      .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: var(--panel-head-gap);
      }

      .panel-title {
        font-size: var(--panel-title-size);
        font-weight: 900;
        letter-spacing: 0.03em;
      }

      .panel.preparing .panel-title {
        color: var(--preparing-title);
      }

      .panel.ready .panel-title {
        color: var(--ready-title);
      }

      .panel-count {
        min-width: var(--count-min-width);
        padding: var(--count-padding-y) var(--count-padding-x);
        border-radius: 999px;
        text-align: center;
        font-size: var(--count-size);
        font-weight: 900;
      }

      .panel.preparing .panel-count {
        background: var(--preparing-count-bg);
        border: 1px solid var(--preparing-count-border);
        color: var(--preparing-count-text);
      }

      .panel.ready .panel-count {
        background: var(--ready-count-bg);
        border: 1px solid var(--ready-count-border);
        color: var(--ready-count-text);
      }

      .list {
        display: grid;
        grid-template-columns: repeat(var(--list-columns), minmax(0, 1fr));
        gap: var(--list-gap);
      }

      .item {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: var(--item-min-height);
        border-radius: var(--item-radius);
        border: 2px solid var(--item-border);
        font-size: var(--item-size);
        font-weight: 900;
        letter-spacing: 0.02em;
      }

      .panel.preparing .item {
        background: var(--preparing-item-bg);
        border-color: var(--preparing-item-border);
        color: var(--preparing-item-text);
      }

      .panel.ready .item {
        background: var(--ready-item-bg);
        border-color: var(--ready-item-border);
        color: var(--ready-item-text);
      }

      .item.empty {
        justify-content: center;
        padding: var(--empty-padding-y) var(--empty-padding-x);
        font-size: var(--empty-size);
        font-weight: 700;
        letter-spacing: 0;
        opacity: 0.86;
      }

      .footer {
        display: none;
        padding: 10px 14px;
        border-top: 1px solid var(--panel-divider);
        font-size: var(--footer-size);
        font-weight: 700;
        color: var(--muted);
        background: var(--surface);
      }
    </style>
  </head>
  <body data-tb1-forced-profile="${forcedProfile ?? ""}">
    <div class="shell theme-dark scale-s profile-led_256x512" id="shell" data-tb1-forced-profile="${forcedProfile ?? ""}" data-tb1-profile="led_256x512">
      <div class="header">
        <div class="title" id="restaurant-name">SEPET ARASI</div>
        <div class="clock" id="clock">--:--</div>
      </div>
      <div class="screen stack" id="screen">
        <div class="panel preparing">
          <div class="panel-head">
            <div class="panel-title">Hazırlananlar</div>
            <div class="panel-count" id="prep-count">0</div>
          </div>
          <div class="list" id="prep-list">
            <div class="item empty">Yükleniyor...</div>
          </div>
        </div>
        <div class="panel ready">
          <div class="panel-head">
            <div class="panel-title">Hazır</div>
            <div class="panel-count" id="ready-count">0</div>
          </div>
          <div class="list" id="ready-list">
            <div class="item empty">Yükleniyor...</div>
          </div>
        </div>
      </div>
      <div class="footer" id="footer-status"></div>
    </div>
    <script>
      (function () {
        var ORDERS_URL = "${API_ROUTES.V1.ORDERS}";
        var SETTINGS_URL = "${API_ROUTES.V1.SETTINGS_PUBLIC}";
        var BEACON_URL = "/display-beacon.gif";
        var PROFILE_PRESETS = ${serializedPresets};
        var LEGACY_PROFILE_ALIASES = ${serializedAliases};
        var FORCED_PROFILE = ${serializedForcedProfile};
        var state = {
          orders: [],
          config: {
            restaurantName: "SEPET ARASI",
            profile: "led_256x512",
            layoutPreference: "stack",
            maxVisiblePerColumn: 4,
            pageSeconds: 6,
            readyDisplayMinutes: 5,
            textScale: "s",
            theme: "dark"
          },
          preparingPage: 0,
          readyPage: 0,
          nextPageSwitchAt: 0
        };

        var screen = document.getElementById("screen");
        var shell = document.getElementById("shell");
        var prepList = document.getElementById("prep-list");
        var readyList = document.getElementById("ready-list");
        var prepCount = document.getElementById("prep-count");
        var readyCount = document.getElementById("ready-count");
        var footerStatus = document.getElementById("footer-status");
        var restaurantName = document.getElementById("restaurant-name");
        var clock = document.getElementById("clock");

        function safeString(value) {
          if (value === null || value === undefined) return "";
          return String(value);
        }

        function sendDiagnostic(phase, detail) {
          try {
            var img = new Image();
            img.src =
              BEACON_URL +
              "?phase=" + encodeURIComponent(phase) +
              "&detail=" + encodeURIComponent(detail || "") +
              "&path=" + encodeURIComponent("/display/index.html");
            window.__tb1CompatBeacon = img;
          } catch (_error) {}
        }

        function requestJson(url, onSuccess, onError) {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, true);
          xhr.onreadystatechange = function () {
            var payload;

            if (xhr.readyState !== 4) return;

            if (xhr.status < 200 || xhr.status >= 300) {
              onError("HTTP " + xhr.status);
              return;
            }

            try {
              payload = JSON.parse(xhr.responseText);
            } catch (_error) {
              onError("INVALID_JSON");
              return;
            }

            if (!payload || payload.ok !== true) {
              onError("API_ERROR");
              return;
            }

            onSuccess(payload.data);
          };
          xhr.onerror = function () {
            onError("NETWORK_ERROR");
          };
          xhr.send();
        }

        function parsePositiveInt(value, fallbackValue) {
          var numberValue = Number(value);
          if (!isFinite(numberValue) || numberValue < 1 || Math.floor(numberValue) !== numberValue) {
            return fallbackValue;
          }
          return numberValue;
        }

        function parseOptionalPositiveInt(value) {
          var numberValue = Number(value);
          if (!isFinite(numberValue) || numberValue < 1 || Math.floor(numberValue) !== numberValue) {
            return null;
          }
          return numberValue;
        }

        function normalizeTheme(value) {
          if (value === "light" || value === "vivid" || value === "retro") return value;
          return "dark";
        }

        function normalizeTextScale(value) {
          if (value === "xs" || value === "s" || value === "l") return value;
          return "m";
        }

        function normalizeLayout(value) {
          if (value === "stack" || value === "split") return value;
          return null;
        }

        function getProfilePreset(profile) {
          return PROFILE_PRESETS[profile] || PROFILE_PRESETS.led_256x512;
        }

        function normalizeProfile(value) {
          var raw = safeString(value);
          if (!raw) return null;
          if (PROFILE_PRESETS[raw]) return raw;
          return LEGACY_PROFILE_ALIASES[raw] || null;
        }

        function getQueryParam(search, key) {
          var query = search && search.charAt(0) === "?" ? search.slice(1) : search;
          var pairs;
          var index;
          var pair;
          var separatorIndex;
          var rawKey;
          var rawValue;

          if (!query) return null;

          pairs = query.split("&");
          for (index = 0; index < pairs.length; index += 1) {
            pair = pairs[index];
            if (!pair) continue;
            separatorIndex = pair.indexOf("=");
            rawKey = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;
            if (decodeURIComponent(rawKey.replace(/\\+/g, " ")) !== key) continue;
            rawValue = separatorIndex >= 0 ? pair.slice(separatorIndex + 1) : "";
            return decodeURIComponent(rawValue.replace(/\\+/g, " "));
          }

          return null;
        }

        function readQueryOverrides() {
          var search = window.location && window.location.search ? window.location.search : "";
          var profile = normalizeProfile(getQueryParam(search, "profile"));
          var layout = normalizeLayout(getQueryParam(search, "layout"));
          var maxVisiblePerColumn = parseOptionalPositiveInt(getQueryParam(search, "max"));
          var pageSeconds = parseOptionalPositiveInt(getQueryParam(search, "pageSeconds"));
          var scaleRaw = getQueryParam(search, "scale");
          var textScale = scaleRaw ? normalizeTextScale(scaleRaw) : null;

          return {
            profile: profile,
            layoutPreference: layout,
            maxVisiblePerColumn: maxVisiblePerColumn,
            pageSeconds: pageSeconds,
            textScale: textScale
          };
        }

        function applyShellAppearance() {
          var themeName = normalizeTheme(state.config.theme);
          var scaleName = normalizeTextScale(state.config.textScale);

          if (!shell) return;

          shell.className =
            "shell theme-" +
            themeName +
            " scale-" +
            scaleName +
            " profile-" +
            state.config.profile;
          shell.setAttribute("data-tb1-profile", state.config.profile);
          shell.setAttribute("data-tb1-forced-profile", FORCED_PROFILE || "");
        }

        function applySettings(settings) {
          var queryOverrides = readQueryOverrides();
          var effectiveProfile =
            queryOverrides.profile ||
            FORCED_PROFILE ||
            normalizeProfile(settings.display_profile || "") ||
            "led_256x512";
          var preset = getProfilePreset(effectiveProfile);

          state.config.restaurantName = safeString(settings.restaurant_name || "SEPET ARASI");
          state.config.profile = effectiveProfile;
          state.config.layoutPreference = queryOverrides.layoutPreference || preset.layoutPreference;
          state.config.maxVisiblePerColumn =
            queryOverrides.maxVisiblePerColumn || preset.maxVisiblePerColumn;
          state.config.pageSeconds = queryOverrides.pageSeconds || preset.pageSeconds;
          state.config.readyDisplayMinutes = parsePositiveInt(settings.display_ready_minutes, 5);
          state.config.textScale = queryOverrides.textScale || preset.textScale;
          state.config.theme = normalizeTheme(safeString(settings.display_theme || "dark"));
          restaurantName.textContent = state.config.restaurantName || "SEPET ARASI";
          state.nextPageSwitchAt = Date.now() + state.config.pageSeconds * 1000;
          applyShellAppearance();
        }

        function isReadyVisible(order) {
          var readyAt;
          var diffMinutes;

          if (order.status !== "READY") return false;
          if (!order.ready_at) return true;

          readyAt = new Date(order.ready_at).getTime();
          if (!isFinite(readyAt)) return true;

          diffMinutes = (Date.now() - readyAt) / 60000;
          return diffMinutes <= state.config.readyDisplayMinutes;
        }

        function sortByDisplayNo(left, right) {
          return Number(left.display_no || 0) - Number(right.display_no || 0);
        }

        function getPreparingOrders() {
          return state.orders.filter(function (order) {
            return order.status === "PREPARING";
          }).sort(sortByDisplayNo);
        }

        function getReadyOrders() {
          return state.orders.filter(isReadyVisible).sort(sortByDisplayNo);
        }

        function getPageCount(totalItems, pageSize) {
          var safePageSize = Math.max(1, pageSize);
          if (totalItems <= 0) return 1;
          return Math.max(1, Math.ceil(totalItems / safePageSize));
        }

        function getPageSlice(items, pageSize, pageIndex) {
          var safePageSize = Math.max(1, pageSize);
          var pageCount = getPageCount(items.length, safePageSize);
          var boundedPage = pageIndex % pageCount;
          var start = boundedPage * safePageSize;
          return items.slice(start, start + safePageSize);
        }

        function renderItems(container, items, emptyText) {
          var fragment = document.createDocumentFragment();
          var item;
          var node;
          var index;

          container.innerHTML = "";

          if (!items.length) {
            node = document.createElement("div");
            node.className = "item empty";
            node.appendChild(document.createTextNode(emptyText));
            container.appendChild(node);
            return;
          }

          for (index = 0; index < items.length; index += 1) {
            item = items[index];
            node = document.createElement("div");
            node.className = "item";
            node.appendChild(document.createTextNode(safeString(item.display_no)));
            fragment.appendChild(node);
          }

          container.appendChild(fragment);
        }

        function renderClock() {
          var now = new Date();
          var hours = now.getHours();
          var minutes = now.getMinutes();
          clock.textContent =
            (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
        }

        function render() {
          var preparingOrders = getPreparingOrders();
          var readyOrders = getReadyOrders();
          var pageSize = Math.max(1, state.config.maxVisiblePerColumn);
          var preparingPageCount = getPageCount(preparingOrders.length, pageSize);
          var readyPageCount = getPageCount(readyOrders.length, pageSize);

          if (state.preparingPage >= preparingPageCount) state.preparingPage = 0;
          if (state.readyPage >= readyPageCount) state.readyPage = 0;

          prepCount.textContent = safeString(preparingOrders.length);
          readyCount.textContent = safeString(readyOrders.length);
          screen.className = "screen " + state.config.layoutPreference;

          renderItems(
            prepList,
            getPageSlice(preparingOrders, pageSize, state.preparingPage),
            "Bekleyen sipariş yok",
          );
          renderItems(
            readyList,
            getPageSlice(readyOrders, pageSize, state.readyPage),
            "Hazır sipariş yok",
          );
        }

        function maybeAdvancePages() {
          var now = Date.now();
          var preparingPageCount = getPageCount(getPreparingOrders().length, state.config.maxVisiblePerColumn);
          var readyPageCount = getPageCount(getReadyOrders().length, state.config.maxVisiblePerColumn);

          if (now < state.nextPageSwitchAt) return;

          state.preparingPage = (state.preparingPage + 1) % preparingPageCount;
          state.readyPage = (state.readyPage + 1) % readyPageCount;
          state.nextPageSwitchAt = now + state.config.pageSeconds * 1000;
          render();
        }

        function loadSettings() {
          requestJson(
            SETTINGS_URL,
            function (data) {
              applySettings(data || {});
              render();
              sendDiagnostic("tb1-compat-settings-ok", state.config.profile);
            },
            function (errorCode) {
              sendDiagnostic("tb1-compat-settings-failed", errorCode);
            },
          );
        }

        function loadOrders() {
          requestJson(
            ORDERS_URL,
            function (data) {
              state.orders = data || [];
              render();
              sendDiagnostic("tb1-compat-orders-ok", String(state.orders.length));
            },
            function (errorCode) {
              sendDiagnostic("tb1-compat-orders-failed", errorCode);
            },
          );
        }

        sendDiagnostic("tb1-compat-inline-start", FORCED_PROFILE || "generic");
        applyShellAppearance();
        renderClock();
        render();
        loadSettings();
        loadOrders();

        if (typeof window.addEventListener === "function") {
          window.addEventListener("resize", render);
        }

        window.setInterval(renderClock, 1000);
        window.setInterval(loadOrders, 1500);
        window.setInterval(loadSettings, 30000);
        window.setInterval(maybeAdvancePages, 1000);
      })();
    </script>
  </body>
</html>`;
}
