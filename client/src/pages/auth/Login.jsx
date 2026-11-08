import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Eye, EyeOff, ArrowRight, UserRound } from "lucide-react";
import { loginUser, registerUser } from "../../services/authService";
import { Link } from "react-router-dom";

function Login() {
  const navigate = useNavigate();

  const [isRegistering, setIsRegistering] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function switchForm(registerMode) {
    setIsRegistering(registerMode);
    setErrorMessage("");
    setSuccessMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleLogin(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await loginUser(email.trim(), password);

      const accessToken = response.data?.access_token;
      const user = response.data?.user;

      if (response.status !== "SUCCESS" || !accessToken || !user) {
        throw new Error("The login response is incomplete.");
      }

      sessionStorage.setItem("access_token", accessToken);
      sessionStorage.setItem("spendwise_user", JSON.stringify(user));

      if (user.role_code?.toUpperCase() === "ADMIN") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      const detail = error.response?.data?.detail;

      setErrorMessage(
        typeof detail === "string"
          ? detail
          : error.message || "Unable to log in. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = userName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerUser(trimmedName, trimmedEmail, password);

      if (response.status !== "SUCCESS") {
        throw new Error(response.message || "Unable to register.");
      }

      setEmail(trimmedEmail);
      setPassword("");
      setConfirmPassword("");
      setUserName("");

      setIsRegistering(false);
      setSuccessMessage("Registration successful! Please sign in.");
    } catch (error) {
      const detail = error.response?.data?.detail;

      setErrorMessage(
        typeof detail === "string"
          ? detail
          : error.message || "Unable to register. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-icon">
            <Wallet size={26} />
          </div>
          <span>SpendWise</span>
        </div>

        <div className="login-heading">
          <h1>{isRegistering ? "Create your account" : "Welcome back"}</h1>
          <p>
            {isRegistering
              ? "Sign up to start managing your money smarter."
              : "Sign in to manage your money smarter."}
          </p>
        </div>

        {successMessage && (
          <p className="login-success" role="status">
            {successMessage}
          </p>
        )}

        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          {isRegistering && (
            <div className="form-group">
              <label htmlFor="userName">Full name</label>
              <input
                id="userName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>

            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete={
                  isRegistering ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          <div className="forgot-password-link">
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm password</label>

              <div className="password-field">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="login-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button className="login-button" type="submit" disabled={isLoading}>
            {isLoading
              ? isRegistering
                ? "Creating account..."
                : "Signing in..."
              : isRegistering
              ? "Create account"
              : "Sign in"}

            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="login-switch">
          {isRegistering
            ? "Already have an account?"
            : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => switchForm(!isRegistering)}
            disabled={isLoading}
          >
            {isRegistering ? "Sign in" : "Register"}
          </button>
        </p>

        <p className="login-footer">Your finances, organized in one place.</p>
      </section>
    </main>
  );
}

export default Login;
