import { useCallback, useEffect, useMemo, useState } from "react";
import { encryptRequest } from "../../utils/encryption";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  CircleAlert,
} from "lucide-react";
import "./AdminUsers.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function getRecords(response) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return [];
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

function AdminUsers() {
  const navigate = useNavigate();

  // const loggedInUser = JSON.parse(
  //   sessionStorage.getItem("spendwise_user") || "{}"
  // );

  const loggedInUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("spendwise_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (!API_BASE_URL) {
        throw new Error("VITE_API_BASE_URL is not configured in client/.env");
      }

      const token = sessionStorage.getItem("access_token");

      if (!token) {
        sessionStorage.removeItem("spendwise_user");
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/users/getAllUsers`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );
      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          `The server returned an invalid response (${response.status}).`
        );
      }

      if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("spendwise_user");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            result?.message ||
            `Request failed with status ${response.status}.`
        );
      }

      if (result?.status === "FAILED") {
        throw new Error(result.message || "Unable to retrieve users.");
      }

      setUsers(getRecords(result));
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, refreshKey]);

  const updateUserStatus = async (user) => {
    const userId = user.USER_ID;
    const isActive = String(user.ENABLE_FLAG).toUpperCase() === "Y";
    const enableFlag = isActive ? "N" : "Y";

    const actionText = enableFlag === "Y" ? "activate" : "deactivate";

    if (
      !window.confirm(
        `Are you sure you want to ${actionText} ${
          user.USER_NAME || "this user"
        }?`
      )
    ) {
      return;
    }

    setUpdatingUserId(userId);
    setActionMessage("");
    setError("");

    try {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        sessionStorage.removeItem("spendwise_user");
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/users/updateUserStatus`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            await encryptRequest({
              data: {
                user_id: userId,
                enable_flag: enableFlag,
              },
            })
          ),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("spendwise_user");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.detail || result?.message || "Unable to update user status."
        );
      }

      if (result?.status !== "SUCCESS") {
        throw new Error(result?.message || "Unable to update user status.");
      }

      setActionMessage(result.message || "User status updated successfully.");

      setTimeout(() => {
        setActionMessage("");
      }, 2000);

      // Reload the table and update the Active/Inactive counts.
      await loadUsers();
    } catch (err) {
      setError(
        typeof err.message === "string"
          ? err.message
          : "Unable to update user status."
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) return users;

    return users.filter((user) =>
      [
        user.USER_ID,
        user.USER_NAME,
        user.EMAIL,
        user.ROLE_CODE,
        user.ENABLE_FLAG,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase()
        .includes(searchText)
    );
  }, [users, search]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const startIndex = (currentPage - 1) * pageSize;

  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when search or page size changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  // Keep the current page valid when the result count changes.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeCount = users.filter(
    (user) => String(user.ENABLE_FLAG).toUpperCase() === "Y"
  ).length;

  const inactiveCount = users.filter(
    (user) => String(user.ENABLE_FLAG).toUpperCase() === "N"
  ).length;

  return (
    <div className="admin-users-page">
      <header className="admin-users-header">
        <div>
          <button
            type="button"
            className="admin-back-button"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft size={17} />
            Back to Admin Dashboard
          </button>

          <h1>Manage Users</h1>
          <p>View registered users and their account status.</p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className="admin-user-stats">
        <article className="admin-user-stat">
          <div className="admin-stat-icon total">
            <Users size={22} />
          </div>
          <div>
            <p>Total Users</p>
            <h2>{users.length}</h2>
          </div>
        </article>

        <article className="admin-user-stat">
          <div className="admin-stat-icon active">
            <UserCheck size={22} />
          </div>
          <div>
            <p>Active Users</p>
            <h2>{activeCount}</h2>
          </div>
        </article>

        <article className="admin-user-stat">
          <div className="admin-stat-icon inactive">
            <UserX size={22} />
          </div>
          <div>
            <p>Inactive Users</p>
            <h2>{inactiveCount}</h2>
          </div>
        </article>
      </section>

      <section className="admin-users-panel">
        <div className="admin-users-panel-heading">
          <div>
            <h2>Registered Users</h2>
            <p>
              {filteredUsers.length} of {users.length} users
            </p>
          </div>

          <label className="admin-users-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search name, email, role..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search users"
            />
          </label>
        </div>

        {actionMessage && (
          <div className="admin-users-success" role="status">
            {actionMessage}
          </div>
        )}
        {error && (
          <div className="admin-users-error" role="alert">
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
          <div className="admin-users-message" role="status">
            Loading users...
          </div>
        ) : (
          // <>
          <div className="admin-users-table-wrapper">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Registration Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {paginatedUsers.map((user, index) => {
                  const isActive =
                    String(user.ENABLE_FLAG).toUpperCase() === "Y";

                  return (
                    <tr key={user.USER_ID ?? index}>
                      <td>#{user.USER_ID ?? "—"}</td>

                      <td>
                        <div className="admin-user-identity">
                          <div className="admin-user-avatar">
                            {(user.USER_NAME || "?").charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{user.USER_NAME || "—"}</strong>
                            <span>{user.EMAIL || "—"}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="admin-role">
                          <ShieldCheck size={14} />
                          {user.ROLE_CODE || "USER"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`admin-user-status ${
                            isActive ? "is-active" : "is-inactive"
                          }`}
                        >
                          <span />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>{formatDate(user.CREATION_DATE)}</td>

                      <td>
                        <button
                          type="button"
                          className={`admin-user-action-button ${
                            isActive ? "deactivate" : "activate"
                          }`}
                          onClick={() => updateUserStatus(user)}
                          disabled={
                            (updatingUserId !== null &&
                              String(updatingUserId) ===
                                String(user.USER_ID)) ||
                            String(user.USER_ID) ===
                              String(loggedInUser.user_id)
                          }
                        >
                          {updatingUserId === user.USER_ID
                            ? "Updating..."
                            : isActive
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="admin-users-empty">
                      {search
                        ? "No users match your search."
                        : "No users found."}
                    </td>
                  </tr>
                )}
              </tbody>
              {/* </table>
          </div> */}
            </table>

            {/* Pagination */}
            <div className="admin-users-pagination">
              <div className="admin-users-page-size">
                <label htmlFor="users-page-size">Rows per page:</label>

                <select
                  id="users-page-size"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <span className="admin-users-pagination-info">
                {filteredUsers.length === 0
                  ? "0 records"
                  : `${startIndex + 1}–${Math.min(
                      startIndex + pageSize,
                      filteredUsers.length
                    )} of ${filteredUsers.length}`}
              </span>

              <div className="admin-users-pagination-buttons">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => page - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                <span>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => page + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsers;
