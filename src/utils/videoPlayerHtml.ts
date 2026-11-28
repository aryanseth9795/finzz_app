/**
 * HTML shell + navigation allow-list for the in-app video player (T-027).
 * The player is a WebView with a single <video>; nothing else may load.
 */

import { SITE_ORIGINS } from "../constants/links";

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// One strict pattern per allowed origin; nothing but a flat /videos/<name>.mp4 matches.
const VIDEO_URL_RES = SITE_ORIGINS.map(
  (origin) => new RegExp(`^${escapeRe(origin)}/videos/[A-Za-z0-9-]+\\.mp4$`),
);
const POSTER_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const BASE_URLS: readonly string[] = SITE_ORIGINS.flatMap((o) => [o, `${o}/`]);

const escapeAttr = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const buildVideoHtml = (
  url: string,
  options: { posterDataUri?: string } = {},
): string => {
  if (!VIDEO_URL_RES.some((re) => re.test(url))) throw new Error("Unsupported video URL");
  const { posterDataUri } = options;
  if (posterDataUri !== undefined && !POSTER_RE.test(posterDataUri)) {
    throw new Error("Unsupported poster");
  }
  const poster = posterDataUri ? ` poster="${escapeAttr(posterDataUri)}"` : "";
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}
video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#000}
</style>
</head>
<body>
<video src="${escapeAttr(url)}"${poster} controls playsinline preload="metadata" autoplay controlsList="nodownload"></video>
<script>
(function () {
  var v = document.querySelector("video");
  function send(t) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: t })); } catch (e) {}
  }
  v.addEventListener("error", function () { send("error"); });
  v.addEventListener("loadedmetadata", function () { send("loadedmetadata"); });
  v.addEventListener("playing", function () { send("playing"); });
  v.addEventListener("ended", function () { send("ended"); });
})();
</script>
</body>
</html>`;
};

/** Only the initial document, about:blank/srcdoc and the exact video URL may load. */
export const isAllowedVideoRequest = (url: string, videoUrl: string): boolean =>
  url === "about:blank" ||
  url === "about:srcdoc" ||
  url === videoUrl ||
  BASE_URLS.includes(url);
