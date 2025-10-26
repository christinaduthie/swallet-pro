import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import Login from "./pages/login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Groups from "./pages/Groups.jsx";
import GroupDetail from "./pages/GroupDetail.jsx";
import Accounts from "./pages/Accounts.jsx";
import People from "./pages/People.jsx";
import MyProfile from "./pages/MyProfile.jsx";
import Settings from "./pages/Settings.jsx";
import Notifications from "./pages/Notifications.jsx";
import Faq from "./pages/Faq.jsx";
import Callback from "./pages/Callback.jsx";
import "./index.css";
import SignUp from "./pages/SignUp.jsx";
import Protected from "./Protected.jsx";
import AppLayout from "./layouts/AppLayout.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, element: <Login /> },
      { path: "signup", element: <SignUp /> },
      { path: "callback", element: <Callback /> },
      {
        element: (
          <Protected>
            <AppLayout />
          </Protected>
        ),
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "accounts", element: <Accounts /> },
          { path: "groups", element: <Groups /> },
          { path: "groups/:id", element: <GroupDetail /> },
          { path: "people", element: <People /> },
          { path: "profile", element: <MyProfile /> },
          { path: "settings", element: <Settings /> },
          { path: "notifications", element: <Notifications /> },
          { path: "faq", element: <Faq /> },
        ],
      },
    ],
  },
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
