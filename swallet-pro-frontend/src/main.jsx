import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Callback from "./pages/Callback.jsx";   // new
import "./index.css";

import { registerSW } from "virtual:pwa-register";
registerSW({ immediate: true }); // auto update when a new SW is available

// Register service worker (ignore if unsupported)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  });
}

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/dashboard", element: <Dashboard /> },   // we’ll protect inside the component
  { path: "/callback", element: <Callback /> },     // landing after Auth0 redirect
]);

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/callback`,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE, // undefined is fine if you don’t use an API
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"  // keeps sessions across reloads; good for dev
    >
      <RouterProvider router={router} />
    </Auth0Provider>
  </React.StrictMode>
);
