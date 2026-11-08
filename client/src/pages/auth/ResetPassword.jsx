import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Wallet,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  CircleAlert,
  ArrowLeft,
} from "lucide-react";

import { encryptRequest } from "../../utils/encryption";
import "./ResetPassword.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!resetToken) {
      setError("Password reset token is missing. Please request a new link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (!API_BASE_URL) {
      setError("API URL is not configured.");
      return;
    }

    setLoading(true);

    try {
      const encryptedRequest = await encryptRequest({
        data: {
          token: resetToken,
          new_password: newPassword,
        },
      });

      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/password-reset/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(encryptedRequest),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status === "FAILED") {
        throw new Error(
          result.detail || result.message || "Unable to reset password."
        );
      }

      setIsSuccess(true);
      setMessage(
        result.message || "Your password has been reset successfully."
      );

      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="reset-page">
      <section className="reset-card">
        <div className="reset-brand">
          <div className="reset-brand-icon">
            <Wallet size={27} />
          </div>
          <span>SpendWise</span>
        </div>

        <div className="reset-heading">
          <div className="reset-heading-icon">
            {isSuccess ? <CheckCircle2 size={27} /> : <LockKeyhole size={27} />}
          </div>

          <h1>
            {isSuccess ? "Password Reset Successful" : "Create New Password"}
          </h1>

          <p>
            {isSuccess
              ? "Your password has been updated successfully."
              : "Enter your new password below to secure your SpendWise account."}
          </p>
        </div>

        {error && (
          <div className="reset-alert reset-alert-error">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="reset-alert reset-alert-success">
            <CheckCircle2 size={18} />
            <span>{message}</span>
          </div>
        )}

        {isSuccess ? (
          <button
            type="button"
            className="reset-submit"
            onClick={() => navigate("/login", { replace: true })}
          >
            Continue to Login
          </button>
        ) : !resetToken ? (
          <div className="reset-invalid-token">
            <p>This reset link is missing its token.</p>
            <Link
              to="/forgot-password"
              className="reset-submit reset-link-button"
            >
              Request New Reset Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="reset-field">
              <label htmlFor="newPassword">New Password</label>

              <div className="reset-input-wrapper">
                <LockKeyhole size={18} />
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="reset-toggle-password"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="reset-field">
              <label htmlFor="confirmPassword">Confirm Password</label>

              <div className="reset-input-wrapper">
                <LockKeyhole size={18} />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="reset-toggle-password"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="reset-submit" disabled={loading}>
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
        )}

        <Link to="/login" className="reset-back-link">
          <ArrowLeft size={16} />
          Back to Login
        </Link>
      </section>
    </main>
  );
}

export default ResetPassword;
