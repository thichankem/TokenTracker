import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { InsforgeAuthProvider } from "./contexts/InsforgeAuthContext.jsx";
import { AccountViewProvider } from "./contexts/AccountViewContext.jsx";
import { LocaleProvider } from "./ui/foundation/LocaleProvider.jsx";
import { CurrencyProvider } from "./ui/foundation/CurrencyProvider.jsx";
import { TokenFormatProvider } from "./ui/foundation/TokenFormatProvider.jsx";
import App from "./App.jsx";
import { initAnalytics } from "./lib/analytics.js";
import { isNativeApp, isNativeEmbed } from "./lib/native-bridge.js";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/700.css";
import "@fontsource/geist-mono/900.css";
import "./styles.css";

initAnalytics();

const router = createBrowserRouter([
  { path: "*", element: <App /> },
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LocaleProvider>
      <TokenFormatProvider>
        <CurrencyProvider>
          <InsforgeAuthProvider>
            <AccountViewProvider>
              <RouterProvider router={router} />
            </AccountViewProvider>
          </InsforgeAuthProvider>
        </CurrencyProvider>
      </TokenFormatProvider>
    </LocaleProvider>
  </React.StrictMode>,
);

/**
 * Register the PWA service worker so the dashboard is installable on iPhone
 * and Android home screens. Production-only and skipped inside the native
 * macOS/Windows webviews (they do not need PWA installability).
 */
function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (import.meta.env.MODE !== "production") return;
  if (isNativeApp() || isNativeEmbed()) return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[tokentracker] service worker registration failed:", err);
    });
  });
}

registerServiceWorker();
