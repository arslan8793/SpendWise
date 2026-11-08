import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  CalendarDays,
  ChartNoAxesCombined,
  UserRound,
  Settings,
  LogOut,
  Menu,
  X,
  CircleAlert,
  Mail,
  ShieldCheck,
  User,
  CalendarCheck,
  Pencil,
  Save,
  CheckCircle2,
} from "lucide-react";

import { encryptRequest } from "../../utils/encryption";
import "./Profile.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Transactions", icon: ArrowLeftRight, path: "/transactions" },
  { label: "Categories", icon: Tags, path: "/categories" },
  { label: "Budgets", icon: CalendarDays, path: "/budgets" },
  { label: "Reports", icon: ChartNoAxesCombined, path: "/reports" },
];

const PREFERENCE_ITEMS = [
  { label: "Profile", icon: UserRound, path: "/profile" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

function getField(record, ...keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return "";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Profile() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [editForm, setEditForm] = useState({
    user_name: "",
    email: "",
  });

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      if (!API_BASE_URL) {
        throw new Error("VITE_API_BASE_URL is not configured.");
      }

      const token = sessionStorage.getItem("access_token");

      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/users/profile`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("spendwise_user");
        window.location.replace("/login");
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.detail ||
            `Request failed with status ${response.status}.`
        );
      }

      if (result?.status === "FAILED") {
        throw new Error(result.message || "Unable to load profile.");
      }

      const records = Array.isArray(result?.data)
        ? result.data
        : result?.data && typeof result.data === "object"
        ? [result.data]
        : [];

      if (!records.length) {
        throw new Error("No profile information was returned by the server.");
      }

      setProfile(records[0]);
    } catch (err) {
      setError(err.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [refreshKey]);

  function handleLogout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }

  function handleNavigation(path) {
    setSidebarOpen(false);
    navigate(path);
  }

  function handleEdit() {
    setEditForm({
      user_name: userName,
      email: email || "",
    });

    setError("");
    setMessage("");
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setEditForm({
      user_name: userName,
      email: email || "",
    });

    setError("");
    setMessage("");
    setIsEditing(false);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSaveProfile(event) {
    event.preventDefault();

    const updatedName = editForm.user_name.trim();
    const updatedEmail = editForm.email.trim();

    if (!updatedName || !updatedEmail) {
      setError("Name and email are required.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(updatedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!API_BASE_URL) {
      setError("VITE_API_BASE_URL is not configured.");
      return;
    }

    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleLogout();
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const encrypted = await encryptRequest({
        data: {
          action: "UpdateUser",
          user_name: updatedName,
          email: updatedEmail,
        },
      });

      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/users/register`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(encrypted),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (!response.ok || result.status !== "SUCCESS") {
        throw new Error(
          result.detail || result.message || "Unable to update profile."
        );
      }

      setProfile((previous) => ({
        ...previous,
        USER_NAME: updatedName,
        EMAIL: updatedEmail,
      }));

      setIsEditing(false);
      setMessage(result.message || "Profile updated successfully.");

      setTimeout(() => {
        setMessage("");
      }, 2000);
    } catch (err) {
      setError(err.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const userName = getField(profile, "USER_NAME", "user_name") || "User";

  const email = getField(profile, "EMAIL", "email");
  const userId = getField(profile, "USER_ID", "user_id");
  const role = getField(profile, "ROLE_CODE", "role_code");
  const status = getField(profile, "ENABLE_FLAG", "enable_flag");
  const createdDate = getField(
    profile,
    "CREATION_DATE",
    "CREATED_DATE",
    "created_date",
    "creation_date"
  );

  return (
    <div className="sw-dashboard">
      {sidebarOpen && (
        <button
          type="button"
          className="sw-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sw-sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sw-brand">
          <div className="sw-brand-icon">
            <Wallet size={22} />
          </div>

          <span>SpendWise</span>

          <button
            type="button"
            className="sw-icon-button sw-mobile-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sw-sidebar-section">
          <span className="sw-nav-heading">WORKSPACE</span>

          <nav className="sw-nav">
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
              <button
                type="button"
                key={label}
                className="sw-nav-link"
                onClick={() => handleNavigation(path)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sw-sidebar-section sw-sidebar-bottom">
          <span className="sw-nav-heading">PREFERENCES</span>

          <nav className="sw-nav">
            {PREFERENCE_ITEMS.map(({ label, icon: Icon, path }) => (
              <button
                type="button"
                key={label}
                className={`sw-nav-link ${path === "/profile" ? "active" : ""}`}
                onClick={() => handleNavigation(path)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}

            <button
              type="button"
              className="sw-nav-link sw-logout-link"
              onClick={handleLogout}
            >
              <LogOut size={19} />
              <span>Sign out</span>
            </button>
          </nav>
        </div>

        <div className="sw-sidebar-footer">
          <span className="sw-security-dot" />
          <span>Your finances, organized.</span>
        </div>
      </aside>

      <div className="sw-main">
        <header className="sw-topbar">
          <div className="sw-topbar-left">
            <button
              type="button"
              className="sw-icon-button sw-menu-button"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="sw-breadcrumb">
              <span>Preferences</span>
              <span>/</span>
              <strong>Profile</strong>
            </div>
          </div>

          <div className="sw-topbar-right">
            <div className="sw-profile">
              <div className="sw-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div className="sw-profile-text">
                <strong>{userName}</strong>
                <span>{role || "USER"}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="sw-content">
          <section className="sw-page-heading">
            <div>
              <div className="sw-eyebrow">ACCOUNT MANAGEMENT</div>
              <h1>My Profile</h1>
              <p>View your personal account information.</p>
            </div>
          </section>

          {error && (
            <div className="sw-error-banner" role="alert">
              <CircleAlert size={19} />
              <span>{error}</span>

              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="sw-loading" role="status">
              <span className="sw-spinner" />
              Loading your profile…
            </div>
          ) : profile ? (
            <>
              <section className="sw-profile-overview">
                <div className="sw-profile-large-avatar">
                  {userName.charAt(0).toUpperCase()}
                </div>

                <div className="sw-profile-overview-text">
                  <h2>{userName}</h2>
                  <p>{email || "Email not available"}</p>
                  <span className="sw-profile-role">
                    <ShieldCheck size={15} />
                    {role || "USER"}
                  </span>
                </div>
              </section>

              <section className="sw-panel sw-profile-details">
                <div className="sw-panel-heading">
                  <div>
                    <h2>Personal Information</h2>
                    <p>Your registered account details</p>
                  </div>

                  {!isEditing && (
                    <button
                      type="button"
                      className="sw-profile-edit-btn"
                      onClick={handleEdit}
                    >
                      <Pencil size={16} />
                      Edit Profile
                    </button>
                  )}
                </div>

                {message && (
                  <div className="sw-profile-success" role="status">
                    <CheckCircle2 size={18} />
                    {message}
                  </div>
                )}

                {isEditing ? (
                  <form onSubmit={handleSaveProfile}>
                    <div className="sw-profile-form-grid">
                      <div className="sw-profile-input-group">
                        <label htmlFor="user-profile-name">Full Name</label>
                        <input
                          id="user-profile-name"
                          type="text"
                          name="user_name"
                          value={editForm.user_name}
                          onChange={handleEditChange}
                          maxLength={100}
                          required
                        />
                      </div>

                      <div className="sw-profile-input-group">
                        <label htmlFor="user-profile-email">
                          Email Address
                        </label>
                        <input
                          id="user-profile-email"
                          type="email"
                          name="email"
                          value={editForm.email}
                          onChange={handleEditChange}
                          maxLength={255}
                          required
                        />
                      </div>
                    </div>

                    <div className="sw-profile-form-actions">
                      <button
                        type="button"
                        className="sw-profile-cancel-btn"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        <X size={16} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="sw-profile-save-btn"
                        disabled={saving}
                      >
                        <Save size={16} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="sw-profile-grid">
                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <User size={18} />
                      </span>

                      <div>
                        <label>User ID</label>
                        <strong>{userId || "—"}</strong>
                      </div>
                    </div>

                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <UserRound size={18} />
                      </span>

                      <div>
                        <label>Full Name</label>
                        <strong>{userName}</strong>
                      </div>
                    </div>

                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <Mail size={18} />
                      </span>

                      <div>
                        <label>Email Address</label>
                        <strong>{email || "—"}</strong>
                      </div>
                    </div>

                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <ShieldCheck size={18} />
                      </span>

                      <div>
                        <label>Role</label>
                        <strong>{role || "—"}</strong>
                      </div>
                    </div>

                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <ShieldCheck size={18} />
                      </span>

                      <div>
                        <label>Account Status</label>
                        <strong>
                          {String(status).toUpperCase() === "Y"
                            ? "Active"
                            : String(status).toUpperCase() === "N"
                            ? "Inactive"
                            : status || "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="sw-profile-field">
                      <span className="sw-profile-field-icon">
                        <CalendarCheck size={18} />
                      </span>

                      <div>
                        <label>Account Created</label>
                        <strong>{formatDate(createdDate)}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}

          <footer className="sw-footer">
            <span>© {new Date().getFullYear()} SpendWise</span>
            <span>Take control of your finances.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Profile;
