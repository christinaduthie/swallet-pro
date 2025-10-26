import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Groups from "./pages/Groups.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import "./index.css";
import SignUp from "./pages/SignUp.jsx";
import Protected from "./Protected.jsx";

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/signup", element: <SignUp /> },
  { path: "/dashboard", element: (<Protected><Dashboard /></Protected>) },
  { path: "/groups", element: (<Protected><Groups /></Protected>) },
  { path: "/groups/:id", element: (<Protected><GroupDetail /></Protected>) },
]);

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ redirect_uri: window.location.origin }}
      cacheLocation="localstorage"
    >
      <RouterProvider router={router} />
    </Auth0Provider>
  </React.StrictMode>
);
