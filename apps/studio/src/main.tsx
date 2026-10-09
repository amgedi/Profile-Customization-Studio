import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "./styles/shell.css";
import "./styles/app.css";
import "./styles/studio.css";
import "./styles/repair.css";
import "./styles/master.css";
import "./styles/ux-polish.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
