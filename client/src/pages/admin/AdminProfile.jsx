import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  UserRound,
  Mail,
  ShieldCheck,
  CalendarCheck,
  RefreshCw,
  LogOut,
  ArrowLeft,
  CircleAlert,
  Pencil,
  Save,
  X,
  CheckCircle2,
} from "lucide-react";
import { encryptRequest } from "../../utils/encryption";
import "./AdminProfile.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function AdminProfile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [editForm, setEditForm] = useState({
    user_name: "",
    email: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = sessionStorage.getItem("access_token");

        if (!token) {
          navigate("/login", { replace: true });
          return;
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
          navigate("/login", { replace: true });
          return;
        }

        const result = await response.json();

        if (!response.ok || result.status !== "SUCCESS") {
          throw new Error(
            result.message || result.detail || "Unable to load profile."
          );
        }

        const records = Array.isArray(result.data)
          ? result.data
          : result.data
          ? [result.data]
          : [];

        if (!records.length) {
          throw new Error("No profile information found.");
        }

        setProfile(records[0]);
      } catch (err) {
        setError(err.message || "Unable to load profile.");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
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
    } catch (err) {
      setError(err.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function getField(...keys) {
    for (const key of keys) {
      if (profile?.[key] !== undefined && profile[key] !== null) {
        return profile[key];
      }
    }
    return "";
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  }

  const userName = getField("USER_NAME", "user_name") || "Admin";
  const email = getField("EMAIL", "email");
  const userId = getField("USER_ID", "user_id");
  const role = getField("ROLE_CODE", "role_code");
  const status = getField("ENABLE_FLAG", "enable_flag");
  const createdDate = getField(
    "CREATION_DATE",
    "CREATED_DATE",
    "creation_date",
    "created_date"
  );

  return (
    <div className="admin-profile-page">
      <header className="admin-profile-header">
        <h1>
          <Wallet size={27} />
          SpendWise Admin
        </h1>

        <div className="admin-profile-actions">
          <button onClick={() => navigate("/admin")}>
            <ArrowLeft size={16} />
            Dashboard
          </button>

          <button onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-profile-content">
        <div className="admin-profile-heading">
          <div>
            <span>ACCOUNT MANAGEMENT</span>
            <h2>My Profile</h2>
            <p>View your administrator account information.</p>
          </div>
        </div>

        {loading && <p>Loading profile...</p>}

        {!loading && error && (
          <div className="admin-profile-error" role="alert">
            <CircleAlert size={18} />
            {error}
          </div>
        )}

        {!loading && profile && (
          <>
            <section className="admin-profile-overview">
              <div className="admin-profile-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div>
                <h2>{userName}</h2>
                <p>{email || "Email not available"}</p>
                <span className="admin-profile-role">
                  <ShieldCheck size={15} />
                  {role || "ADMIN"}
                </span>
              </div>
            </section>

            <section className="admin-profile-card">
              <div className="admin-profile-card-heading">
                <div>
                  <h3>Personal Information</h3>
                  <p>Your registered administrator account details</p>
                </div>

                {!isEditing && (
                  <button
                    type="button"
                    className="admin-profile-edit-btn"
                    onClick={handleEdit}
                  >
                    <Pencil size={16} />
                    Edit Profile
                  </button>
                )}
              </div>

              {message && (
                <div className="admin-profile-success" role="status">
                  <CheckCircle2 size={18} />
                  {message}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSaveProfile}>
                  <div className="admin-profile-form-grid">
                    <div className="admin-profile-input-group">
                      <label htmlFor="admin-user-name">Full Name</label>
                      <input
                        id="admin-user-name"
                        type="text"
                        name="user_name"
                        value={editForm.user_name}
                        onChange={handleEditChange}
                        maxLength={100}
                        required
                      />
                    </div>

                    <div className="admin-profile-input-group">
                      <label htmlFor="admin-user-email">Email Address</label>
                      <input
                        id="admin-user-email"
                        type="email"
                        name="email"
                        value={editForm.email}
                        onChange={handleEditChange}
                        maxLength={255}
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-profile-form-actions">
                    <button
                      type="button"
                      className="admin-profile-cancel-btn"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <X size={16} />
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="admin-profile-save-btn"
                      disabled={saving}
                    >
                      <Save size={16} />
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="admin-profile-grid">
                  {/* Keep your existing six profile fields here unchanged. */}
                  {/* <div className="admin-profile-grid"> */}
                  <div className="admin-profile-field">
                    <UserRound />
                    <div>
                      <label>User ID</label>
                      <strong>{userId || "—"}</strong>
                    </div>
                  </div>

                  <div className="admin-profile-field">
                    <UserRound />
                    <div>
                      <label>Full Name</label>
                      <strong>{userName}</strong>
                    </div>
                  </div>

                  <div className="admin-profile-field">
                    <Mail />
                    <div>
                      <label>Email Address</label>
                      <strong>{email || "—"}</strong>
                    </div>
                  </div>

                  <div className="admin-profile-field">
                    <ShieldCheck />
                    <div>
                      <label>Role</label>
                      <strong>{role || "—"}</strong>
                    </div>
                  </div>

                  <div className="admin-profile-field">
                    <ShieldCheck />
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

                  <div className="admin-profile-field">
                    <CalendarCheck />
                    <div>
                      <label>Account Created</label>
                      <strong>{formatDate(createdDate)}</strong>
                    </div>
                  </div>
                  {/* </div> */}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default AdminProfile;
