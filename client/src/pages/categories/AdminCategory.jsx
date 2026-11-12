import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Power,
  CircleAlert,
  CheckCircle2,
  X,
} from "lucide-react";
import { encryptRequest } from "../../utils/encryption";
import "./Categories.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CATEGORY_API = `${API_BASE_URL?.replace(/\/$/, "")}/categories`;

const EMPTY_FORM = {
  category_id: "",
  category_name: "",
  category_type: "",
  description: "",
};

function getField(item, lowerCase, upperCase) {
  return item?.[lowerCase] ?? item?.[upperCase];
}

function isDefaultCategory(item) {
  return (
    String(getField(item, "is_default", "IS_DEFAULT") ?? "").toUpperCase() ===
    "Y"
  );
}

function isEnabled(item) {
  return (
    String(
      getField(item, "enable_flag", "ENABLE_FLAG") ?? "Y"
    ).toUpperCase() === "Y"
  );
}

function AdminCategory() {
  const navigate = useNavigate();

  const currentUser = JSON.parse(
    sessionStorage.getItem("spendwise_user") || "{}"
  );

  const currentUserRole = String(
    currentUser.role_code ?? currentUser.role ?? ""
  ).toUpperCase();

  const isAdmin = currentUserRole === "ADMIN";

  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const resetMessages = () => {
    setError("");
    setMessage("");
  };

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const parseResponse = useCallback(
    async (response) => {
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok || result.status === "FAILED") {
        throw new Error(
          result.detail ||
            result.message ||
            `Request failed with status ${response.status}.`
        );
      }

      return result;
    },
    [handleUnauthorized]
  );

  const sendEncryptedPost = useCallback(
    async (data) => {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!API_BASE_URL) {
        throw new Error("VITE_API_BASE_URL is missing from client/.env.");
      }

      const encrypted = await encryptRequest({ data });

      const response = await fetch(`${CATEGORY_API}/createCategory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(encrypted),
      });

      return parseResponse(response);
    },
    [navigate, parseResponse]
  );

  const fetchCategories = useCallback(
    async ({ clearMessages = true } = {}) => {
      if (clearMessages) resetMessages();

      if (!isAdmin) {
        setError(
          "Access denied. Only administrators can manage shared categories."
        );
        return;
      }

      const token = sessionStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      if (!API_BASE_URL) {
        setError("VITE_API_BASE_URL is missing from client/.env.");
        return;
      }

      setLoading(true);

      try {
        const encrypted = await encryptRequest({
          data: { action: "GetCategory" },
        });

        const url = new URL(`${CATEGORY_API}/getCategory`);
        url.searchParams.set("nonce", encrypted.nonce);
        url.searchParams.set("ciphertext", encrypted.ciphertext);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const result = await parseResponse(response);
        const records = Array.isArray(result.data) ? result.data : [];

        // Admin page displays shared/default categories only.
        setCategories(records.filter(isDefaultCategory));
      } catch (err) {
        setError(err.message || "Unable to retrieve categories.");
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, navigate, parseResponse]
  );

  useEffect(() => {
    if (!isAdmin) {
      setError("Access denied. Only administrators can access this page.");
      return;
    }

    fetchCategories();
  }, [isAdmin, fetchCategories]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function startCreating() {
    resetMessages();
    setForm(EMPTY_FORM);
    setMode("create");
    setShowForm(true);
  }

  function startEditing(item) {
    resetMessages();

    if (!isDefaultCategory(item)) {
      setError("Only shared default categories can be edited here.");
      return;
    }

    const categoryId = getField(item, "category_id", "CATEGORY_ID");

    if (
      categoryId == null ||
      !Number.isInteger(Number(categoryId)) ||
      Number(categoryId) <= 0
    ) {
      setError("A valid category ID is required.");
      return;
    }

    setForm({
      category_id: String(categoryId),
      category_name: getField(item, "category_name", "CATEGORY_NAME") ?? "",
      category_type: getField(item, "category_type", "CATEGORY_TYPE") ?? "",
      description: getField(item, "description", "DESCRIPTION") ?? "",
    });

    setMode("edit");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    resetMessages();

    if (!isAdmin) {
      setError("Access denied.");
      return;
    }

    if (!form.category_name.trim()) {
      setError("Please enter a category name.");
      return;
    }

    if (!["EXPENSE", "INCOME"].includes(form.category_type)) {
      setError("Please select a valid category type.");
      return;
    }

    const isEditing = mode === "edit";

    const data = {
      action: isEditing ? "UpdateCategory" : "CreateCategory",
      category_name: form.category_name.trim(),
      category_type: form.category_type,
      description: form.description.trim() || null,
    };

    if (isEditing) {
      const categoryId = Number(form.category_id);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        setError("A valid category ID is required.");
        return;
      }

      data.category_id = categoryId;
    }

    setSaving(true);

    try {
      const result = await sendEncryptedPost(data);

      setMessage(
        result.message ||
          (isEditing
            ? "Shared category updated successfully."
            : "Shared category created successfully.")
      );

      setForm(EMPTY_FORM);
      setMode("create");
      setShowForm(false);

      await fetchCategories({ clearMessages: false });
    } catch (err) {
      setError(err.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryStatus(item) {
    if (!isAdmin || !isDefaultCategory(item)) {
      setError("Only administrators can change shared category status.");
      return;
    }

    const categoryId = Number(getField(item, "category_id", "CATEGORY_ID"));

    const categoryName =
      getField(item, "category_name", "CATEGORY_NAME") ?? "this category";

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      setError("A valid category ID is required.");
      return;
    }

    const currentlyEnabled = isEnabled(item);
    const actionText = currentlyEnabled ? "deactivate" : "activate";

    if (
      !window.confirm(
        `Are you sure you want to ${actionText} "${categoryName}"?`
      )
    ) {
      return;
    }

    resetMessages();
    setSaving(true);

    try {
      const result = await sendEncryptedPost({
        action: "UpdateCategoryStatus",
        category_id: categoryId,
        enable_flag: currentlyEnabled ? "N" : "Y",
      });

      setMessage(
        result.message ||
          `Shared category ${
            currentlyEnabled ? "deactivated" : "activated"
          } successfully.`
      );

      await fetchCategories({ clearMessages: false });
    } catch (err) {
      setError(err.message || "Unable to change category status.");
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return categories.filter((item) => {
      if (!search) return true;

      const values = [
        getField(item, "category_id", "CATEGORY_ID"),
        getField(item, "category_name", "CATEGORY_NAME"),
        getField(item, "category_type", "CATEGORY_TYPE"),
        getField(item, "description", "DESCRIPTION"),
        isEnabled(item) ? "active" : "inactive",
      ];

      return values
        .filter((value) => value != null)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [categories, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCategories.length / pageSize)
  );

  const startIndex = (currentPage - 1) * pageSize;

  const paginatedCategories = filteredCategories.slice(
    startIndex,
    startIndex + pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeCount = categories.filter(isEnabled).length;
  const inactiveCount = categories.length - activeCount;

  if (!isAdmin) {
    return (
      <main className="cat-page">
        <header className="cat-header">
          <div className="cat-brand">
            <span className="cat-brand-icon">
              <FolderOpen size={22} />
            </span>
            <span>SpendWise</span>
          </div>
        </header>

        <div className="cat-content">
          <div className="cat-alert cat-alert-error" role="alert">
            <CircleAlert size={18} />
            <span>
              Access denied. This page is available to administrators only.
            </span>
          </div>

          <button type="button" onClick={() => navigate("/admin")}>
            <ArrowLeft size={17} />
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="cat-page">
      <header className="cat-header">
        <div className="cat-brand">
          <span className="cat-brand-icon">
            <FolderOpen size={22} />
          </span>
          <span>SpendWise</span>
        </div>

        <button
          type="button"
          className="cat-back-button"
          onClick={() => navigate("/admin")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </header>

      <div className="cat-content">
        <div className="cat-heading">
          <div>
            <p className="cat-eyebrow">ADMINISTRATION</p>
            <h1>Admin Categories</h1>
            <p>
              Manage shared default categories available to SpendWise users.
            </p>
          </div>

          <button type="button" onClick={startCreating} disabled={saving}>
            <Plus size={17} />
            Add Category
          </button>
        </div>

        {error && (
          <div className="cat-alert cat-alert-error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div className="cat-alert cat-alert-success" role="status">
            <CheckCircle2 size={18} />
            <span>{message}</span>
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="cat-summary-grid">
          <div className="cat-summary-card">
            <span>Total shared categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="cat-summary-card">
            <span>Active categories</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="cat-summary-card">
            <span>Inactive categories</span>
            <strong>{inactiveCount}</strong>
          </div>
        </section>

        {showForm && (
          <div
            className="cat-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget && !saving) {
                resetMessages();
                setForm(EMPTY_FORM);
                setMode("create");
                setShowForm(false);
              }
            }}
          >
            <section
              className="cat-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-category-modal-title"
            >
              <div className="cat-card-heading">
                <div>
                  <h2 id="admin-category-modal-title">
                    {mode === "edit"
                      ? "Edit shared category"
                      : "Create shared category"}
                  </h2>
                  <p>
                    {mode === "edit"
                      ? `Updating category ID ${form.category_id}`
                      : "Add a default category for income or expenses."}
                  </p>
                </div>

                <button
                  type="button"
                  className="cat-modal-close"
                  onClick={() => {
                    resetMessages();
                    setForm(EMPTY_FORM);
                    setMode("create");
                    setShowForm(false);
                  }}
                  disabled={saving}
                  aria-label="Close form"
                >
                  <X size={20} />
                </button>
              </div>

              <form className="cat-form" onSubmit={handleSubmit}>
                <label>
                  Category name
                  <input
                    name="category_name"
                    value={form.category_name}
                    onChange={updateField}
                    placeholder="e.g. Groceries"
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  Category type
                  <select
                    name="category_type"
                    value={form.category_type}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select category type</option>
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </label>

                <label className="cat-description-field">
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={updateField}
                    placeholder="Describe what this category is used for"
                    rows={3}
                    maxLength={255}
                  />
                </label>

                <div className="cat-form-actions">
                  <button
                    type="button"
                    className="cat-secondary-button"
                    onClick={() => {
                      resetMessages();
                      setForm(EMPTY_FORM);
                      setMode("create");
                      setShowForm(false);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button type="submit" disabled={saving}>
                    {saving
                      ? "Saving..."
                      : mode === "edit"
                      ? "Save changes"
                      : "Create category"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        <section className="cat-card">
          <div className="cat-card-heading">
            <div>
              <h2>Shared Categories</h2>
              <p>Search, edit, activate, or deactivate default categories.</p>
            </div>

            <button
              type="button"
              className="cat-secondary-button"
              onClick={() => fetchCategories()}
              disabled={loading || saving}
            >
              <RefreshCw size={16} className={loading ? "cat-spinning" : ""} />
              Refresh
            </button>
          </div>

          <div className="cat-table-toolbar">
            <label className="cat-search-field">
              <Search size={18} />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, type, ID, or status..."
                aria-label="Search shared categories"
              />
            </label>

            <span className="cat-results-count">
              {filteredCategories.length} of {categories.length} categories
            </span>
          </div>

          {loading && categories.length === 0 ? (
            <p className="cat-empty-state">Loading categories...</p>
          ) : filteredCategories.length === 0 ? (
            <div className="cat-empty-state">
              {categories.length === 0
                ? "No shared categories found. Create your first category above."
                : "No categories match your search."}
            </div>
          ) : (
            <div className="cat-table-wrapper">
              <table className="cat-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedCategories.map((item, index) => {
                    const active = isEnabled(item);
                    const categoryId = getField(
                      item,
                      "category_id",
                      "CATEGORY_ID"
                    );

                    return (
                      <tr key={categoryId}>
                        <td>{startIndex + index + 1}</td>
                        <td className="cat-table-name">
                          {getField(item, "category_name", "CATEGORY_NAME") ??
                            "—"}
                        </td>
                        <td>
                          <span className="cat-type-badge">
                            {getField(item, "category_type", "CATEGORY_TYPE") ??
                              "—"}
                          </span>
                        </td>
                        <td className="cat-table-description">
                          {getField(item, "description", "DESCRIPTION") ?? "—"}
                        </td>
                        <td>
                          <span
                            className={`cat-status ${
                              active
                                ? "cat-status-active"
                                : "cat-status-inactive"
                            }`}
                          >
                            {active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="cat-row-actions">
                            <button
                              type="button"
                              className="cat-secondary-button"
                              onClick={() => startEditing(item)}
                              disabled={saving}
                              title="Edit shared category"
                            >
                              <Pencil size={15} />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="cat-secondary-button"
                              onClick={() => toggleCategoryStatus(item)}
                              disabled={saving}
                              title={
                                active
                                  ? "Deactivate category"
                                  : "Activate category"
                              }
                            >
                              <Power size={15} />
                              {active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="cat-pagination">
                <div className="cat-page-size">
                  <label htmlFor="admin-category-page-size">
                    Rows per page:
                  </label>
                  <select
                    id="admin-category-page-size"
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(Number(event.target.value))
                    }
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <span className="cat-pagination-info">
                  {filteredCategories.length === 0
                    ? "0 records"
                    : `${startIndex + 1}–${Math.min(
                        startIndex + pageSize,
                        filteredCategories.length
                      )} of ${filteredCategories.length}`}
                </span>

                <div className="cat-pagination-buttons">
                  <button
                    type="button"
                    className="cat-secondary-button"
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
                    className="cat-secondary-button"
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

        <footer className="cat-footer">
          <span>© {new Date().getFullYear()} SpendWise</span>
          <button type="button" onClick={() => navigate("/admin")}>
            Back to dashboard
          </button>
        </footer>
      </div>
    </main>
  );
}

export default AdminCategory;
