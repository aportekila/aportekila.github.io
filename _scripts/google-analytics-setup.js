---
permalink: /assets/js/google-analytics-setup.js
---
(function () {
  var GA_ID = "{{ site.google_analytics }}";

  window.__loadGoogleAnalytics = function () {
    if (window.__googleAnalyticsLoaded) return;
    window.__googleAnalyticsLoaded = true;

    var lib = document.createElement("script");
    lib.async = true;
    lib.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(lib);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", GA_ID);
  };

  // Returning visitor who already granted consent on a previous visit.
  if (localStorage.getItem("analytics-consent") === "granted") {
    window.__loadGoogleAnalytics();
  }
})();
