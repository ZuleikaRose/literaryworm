import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./store/StoreProvider";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/covers.css";
import "./styles/sections.css";
import "./styles/pages.css";
import "./styles/public.css";
import "./styles/profiles.css";
import "./styles/home.css";
import "./styles/detail.css";
import "./styles/search.css";
import "./styles/library.css";
import "./styles/reader.css";
import "./styles/account.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
