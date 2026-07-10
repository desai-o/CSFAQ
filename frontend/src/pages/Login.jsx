import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "error" });

  const { login, loading, error } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Clear validation errors on inputs change
  useEffect(() => {
    setValidationError("");
  }, [email, password]);

  // Display backend errors in toasts
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error]);

  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "error" });
    }, 4000);
  };

  const validateForm = () => {
    if (!email.trim()) {
      setValidationError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError("Please enter a valid email address");
      return false;
    }
    if (!password.trim()) {
      setValidationError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await login(email, password);
    if (result.success) {
      showToast("Successfully signed in!", "success");
      // Optional: Store remember me flag in local storage
      if (rememberMe) {
        localStorage.setItem("crowdfaq-remember-email", email);
      } else {
        localStorage.removeItem("crowdfaq-remember-email");
      }
      setTimeout(() => navigate("/dashboard"), 800);
    }
  };

  const handleGoogleSignIn = () => {
    showToast("Google Authentication is currently unavailable. Operating in local mode.", "error");
  };

  // Restore remembered email on boot
  useEffect(() => {
    const savedEmail = localStorage.getItem("crowdfaq-remember-email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="auth-page-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`auth-toast ${toast.type}`}>
          {toast.type === "success" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Background glow ornaments */}
      <div className="auth-glow-circle auth-glow-1"></div>
      <div className="auth-glow-circle auth-glow-2"></div>

      {/* Floating back home button */}
      <Link to="/" className="auth-back-home" tabIndex={1}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to Dashboard
      </Link>

      <div className="auth-theme-float">
        <button
          className={`theme-toggle-btn ${theme}`}
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          tabIndex={2}
        >
          <div className="theme-icon-container">
            <svg className="sun-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg className="moon-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </div>
        </button>
      </div>

      {/* Auth Card */}
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-icon">Q</div>
            <span>CrowdFAQ</span>
          </div>
          <p className="auth-subtitle">Welcome back! Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {validationError && (
            <div className="auth-error-msg">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {validationError}
            </div>
          )}

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="email">Email Address</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </span>
              <input
                id="email"
                type="email"
                className="auth-input has-icon"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                tabIndex={3}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-input has-icon has-toggle"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                tabIndex={4}
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={5}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="auth-options-row">
            <label className="auth-checkbox-label" htmlFor="remember">
              <input
                id="remember"
                type="checkbox"
                className="auth-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                tabIndex={6}
              />
              Remember me
            </label>
            <a href="#forgot" className="auth-forgot-link" onClick={(e) => { e.preventDefault(); showToast("Password recovery emails are disabled in development.", "error"); }} tabIndex={7}>
              Forgot Password?
            </a>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading} tabIndex={8}>
            {loading ? (
              <>
                <span className="auth-spinner"></span> Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="auth-divider">or</div>

        <button type="button" className="auth-google-btn" onClick={handleGoogleSignIn} tabIndex={9}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.927h6.6c-.29 1.5-.143 3.01-.84 4.02l3.415 2.65c2-1.84 3.57-4.55 3.57-8.527z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.41-2.65c-.95.63-2.16 1-3.55 1-2.73 0-5.05-1.84-5.87-4.31l-3.53 2.73C3.25 21.05 7.29 24 12 24z"/>
            <path fill="#FBBC05" d="M6.13 15.13A7.17 7.17 0 0 1 5.73 12c0-1.1.18-2.17.5-3.17l-3.53-2.73A11.95 11.95 0 0 0 1 12c0 2.22.6 4.3 1.7 6.13l3.43-3z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.96 1.19 15.24 0 12 0 7.29 0 3.25 2.95 1.7 7.1l3.53 2.73c.82-2.47 3.14-4.31 5.87-4.31z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-switch">
          Don't have an account? 
          <Link to="/signup" className="auth-switch-link" tabIndex={10}>Sign Up</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
