import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "error" });
  const [pwdStrength, setPwdStrength] = useState({ score: 0, label: "Empty", color: "transparent", width: "0%" });

  const { signup, loading, error } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Clear validation error on inputs change
  useEffect(() => {
    setValidationError("");
  }, [name, username, email, password, confirmPassword, termsAccepted]);

  // Display backend errors in toasts
  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error]);

  // Check password strength live
  useEffect(() => {
    if (!password) {
      setPwdStrength({ score: 0, label: "Empty", color: "transparent", width: "0%" });
      return;
    }
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) {
      setPwdStrength({ score, label: "Weak", color: "var(--accent-red)", width: "30%" });
    } else if (score <= 3) {
      setPwdStrength({ score, label: "Medium", color: "var(--accent-orange)", width: "60%" });
    } else {
      setPwdStrength({ score, label: "Strong", color: "var(--accent-green)", width: "100%" });
    }
  }, [password]);

  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "error" });
    }, 4000);
  };

  const validateForm = () => {
    if (!name.trim()) {
      setValidationError("Full name is required");
      return false;
    }
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
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return false;
    }
    if (!termsAccepted) {
      setValidationError("You must accept the Terms and Privacy Policy");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Use full name as main registry profile identifier
    const result = await signup(name, email, password);
    if (result.success) {
      showToast("Account created successfully!", "success");
      setTimeout(() => navigate("/dashboard"), 800);
    }
  };

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
          <p className="auth-subtitle">Join us! Create a new account to get started</p>
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
            <label className="auth-label" htmlFor="name">Full Name</label>
            <div className="auth-input-wrapper">
              <input
                id="name"
                type="text"
                className="auth-input"
                placeholder="Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                tabIndex={3}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="username">Username (Optional)</label>
            <div className="auth-input-wrapper">
              <input
                id="username"
                type="text"
                className="auth-input"
                placeholder="alexchen"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                tabIndex={4}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="email">Email Address</label>
            <div className="auth-input-wrapper">
              <input
                id="email"
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                tabIndex={5}
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="auth-input has-toggle"
                placeholder="•••••••• (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                tabIndex={6}
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={7}
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
            {/* Live Password Strength Indicator */}
            {password && (
              <div className="auth-strength-container">
                <div className="auth-strength-bars">
                  <div 
                    className="auth-strength-fill" 
                    style={{ width: pwdStrength.width, backgroundColor: pwdStrength.color }}
                  ></div>
                </div>
                <div className="auth-strength-text">
                  <span>Password Strength</span>
                  <span style={{ color: pwdStrength.color }}>{pwdStrength.label}</span>
                </div>
              </div>
            )}
          </div>

          <div className="auth-input-group">
            <label className="auth-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="auth-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                className="auth-input has-toggle"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                tabIndex={8}
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={9}
              >
                {showConfirmPassword ? (
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

          <div className="auth-options-row" style={{ justifyContent: "flex-start" }}>
            <label className="auth-checkbox-label" htmlFor="terms">
              <input
                id="terms"
                type="checkbox"
                className="auth-checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                tabIndex={10}
              />
              I agree to the Terms & Privacy Policy
            </label>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading} tabIndex={11}>
            {loading ? (
              <>
                <span className="auth-spinner"></span> Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? 
          <Link to="/login" className="auth-switch-link" tabIndex={12}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}

export default Signup;
