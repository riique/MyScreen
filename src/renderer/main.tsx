import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { bootTheme } from "./lib/theme";
import { desktopPlatform, loadServerUrl, PlatformProvider } from "./platform";

bootTheme();
void loadServerUrl().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <PlatformProvider value={desktopPlatform}>
        <App />
      </PlatformProvider>
    </StrictMode>,
  );
});
