import React, { useState } from "react";
import { Link } from "react-router-dom";
import { encryptRequest } from "../../utils/encryption";
import "./ForgotPassword.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess(false);

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!API_BASE_URL) {
      setError("API URL is not configured.");
      return;
    }

    try {
      setLoading(true);

      // Encrypt request using the existing AES utility.
      const encryptedData = await encryptRequest({
        data: {
          email: normalizedEmail,
        },
      });

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/password-reset/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(encryptedData),
        }
      );

      const result = await response.json();

      if (!response.ok || result.status === "FAILED") {
        throw new Error(
          result.message || "Unable to process your request. Please try again."
        );
      }

      setSuccess(true);
      setEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.message || "Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-card">
        <div className="forgot-password-icon">
          <span>🔐</span>
        </div>

        <h2>Forgot Password?</h2>

        <p className="forgot-password-description">
          No worries! Enter your registered email address and we'll send you a
          password reset link.
        </p>

        {error && (
          <div className="forgot-alert forgot-alert-error">{error}</div>
        )}

        {success ? (
          <div className="forgot-success-section">
            <div className="forgot-alert forgot-alert-success">
              Password reset link has been sent. Please check your inbox.
            </div>

            <Link to="/login" className="forgot-submit-button">
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="forgot-form-group">
              <label htmlFor="forgot-email">Email Address</label>

              <input
                type="email"
                id="forgot-email"
                name="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="forgot-submit-button"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className="forgot-back-link">
          <Link to="/login">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
