import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { FAQProvider } from "./context/FAQContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { FollowProvider } from "./context/FollowContext";
import "./styles/style.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <FollowProvider>
          <FAQProvider>
            <App />
          </FAQProvider>
        </FollowProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>
);
