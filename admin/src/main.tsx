import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Only defined when this page is opened as @donpionadminbot's Mini App,
// not in a normal browser tab — every call below is optional-chained so
// nothing here can break the ordinary browser experience.
const tg = (window as unknown as { Telegram?: { WebApp?: Record<string, any> } }).Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
// Match the brand instead of Telegram's default white chrome around the app.
tg?.setHeaderColor?.("#131026"); // navy
tg?.setBackgroundColor?.("#FAF9F6"); // canvas

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
