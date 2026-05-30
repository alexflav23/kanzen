import "./stylex.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider } from "./state/AuthContext";
import { RealtimeProvider } from "./realtime/RealtimeProvider";
import { queryClient } from "./state/query";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </RealtimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
