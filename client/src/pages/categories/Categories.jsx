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
import { createAuditLog } from "../../utils/auditLog";
import "./Categories.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const CATEGORY_API = `${API_BASE_URL?.replace(/\/$/, "")}/categories`;

const emptyForm = {
  category_id: "",
  category_name: "",
  category_type: "",
  description: "",
};

function Categories() {
  const navigate = useNavigate();

  const currentUser = JSON.parse(
    sessionStorage.getItem("spendwise_user") || "{}"
  );

  const currentUserId = Number(currentUser.user_id ?? currentUser.id);

  const currentUserRole = String(
    currentUser.role_code ?? currentUser.role ?? ""
  ).toUpperCase();

  function canManageCategory(item) {
    const isDefault =
      String(item.is_default ?? item.IS_DEFAULT ?? "").toUpperCase() === "Y";

    const categoryUserId = item.user_id ?? item.USER_ID;

    const isOwnCustomCategory =
      String(item.is_default ?? item.IS_DEFAULT ?? "").toUpperCase() === "N" &&
      categoryUserId != null &&
      Number(categoryUserId) === currentUserId;

    if (currentUserRole === "ADMIN") {
      return isDefault;
    }

    return isOwnCustomCategory;
  }

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [mode, setMode] = useState("create");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 2000);

    return () => clearTimeout(timer);
  }, [message]);

  function resetMessages() {
    setError("");
    setMessage("");
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleUnauthorized() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }

  async function parseResponse(response) {
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
  }

  // GET: Retrieve all categories using the existing GetCategory action.
  const fetchCategories = useCallback(
    async ({ clearMessages = true } = {}) => {
      if (clearMessages) {
        resetMessages();
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

        setCategories(records);
      } catch (err) {
        setError(err.message || "Unable to retrieve categories.");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // POST: Create, update, activate, or deactivate a category.
  async function sendEncryptedPost(data) {
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
  }

  function startCreating() {
    resetMessages();
    setForm(emptyForm);
    setMode("create");
    setShowForm(true);
  }

  function startEditing(item) {
    resetMessages();

    const categoryId = item.category_id ?? item.CATEGORY_ID;

    if (
      categoryId === null ||
      categoryId === undefined ||
      String(categoryId).trim() === "" ||
      !Number.isInteger(Number(categoryId)) ||
      Number(categoryId) <= 0
    ) {
      setError("Category ID is missing from the selected category record.");
      return;
    }

    setForm({
      category_id: String(categoryId),
      category_name: item.category_name ?? item.CATEGORY_NAME ?? "",
      category_type: item.category_type ?? item.CATEGORY_TYPE ?? "EXPENSE",
      description: item.description ?? item.DESCRIPTION ?? "",
    });

    setMode("edit");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    resetMessages();
    setForm(emptyForm);
    setMode("create");
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    resetMessages();

    const categoryName = form.category_name.trim();

    if (!categoryName) {
      setError("Please enter a category name.");
      return;
    }

    const isEditing = mode === "edit";

    const data = {
      action: isEditing ? "UpdateCategory" : "CreateCategory",
      category_name: form.category_name.trim(),
      category_type: form.category_type,
      description: form.description.trim() || null,
      last_updated_by: 0,
      last_update_login: null,
    };

    if (isEditing) {
      const categoryId = Number(form.category_id);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        setError("A valid category ID is required to update a category.");
        return;
      }

      console.log("Updating category:", {
        mode,
        formCategoryId: form.category_id,
        categoryId,
        requestData: data,
      });

      data.category_id = categoryId;
    } else {
      data.created_by = 0;
    }

    setSaving(true);

    try {
      const result = await sendEncryptedPost(data);
      setMessage(
        result.message ||
          (isEditing
            ? "Category updated successfully."
            : "Category created successfully.")
      );

      setForm(emptyForm);
      setMode("create");
      setShowForm(false);

      // Refresh the full table after a successful change.
      await fetchCategories({ clearMessages: false });
    } catch (err) {
      setError(err.message || "Unable to save category.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategoryStatus(item) {
    const categoryName =
      item.category_name ?? item.CATEGORY_NAME ?? "this category";

    const isCategoryEnabled =
      String(item.enable_flag ?? item.ENABLE_FLAG ?? "Y").toUpperCase() === "Y";

    const action = isCategoryEnabled ? "deactivate" : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${categoryName}"?`
    );

    if (!confirmed) {
      return;
    }

    resetMessages();

    // Support lowercase and uppercase field names.
    const rawCategoryId = item.category_id ?? item.CATEGORY_ID;
    const categoryId = Number(rawCategoryId);

    // Validate the ID before calling the API.
    if (
      rawCategoryId === null ||
      rawCategoryId === undefined ||
      String(rawCategoryId).trim() === "" ||
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      console.error("Invalid category record:", item);
      setError(
        "Invalid category ID. Please refresh the categories and try again."
      );
      return;
    }

    const currentlyEnabled =
      String(item.enable_flag ?? item.ENABLE_FLAG ?? "Y").toUpperCase() === "Y";

    setSaving(true);

    try {
      console.log("Updating category status:", {
        action: "UpdateCategoryStatus",
        category_id: categoryId,
        enable_flag: currentlyEnabled ? "N" : "Y",
      });

      const result = await sendEncryptedPost({
        action: "UpdateCategoryStatus",
        category_id: categoryId,
        enable_flag: currentlyEnabled ? "N" : "Y",
        last_updated_by: 0,
        last_update_login: null,
      });

      setMessage(
        result.message ||
          `Category ${
            currentlyEnabled ? "deactivated" : "activated"
          } successfully.`
      );

      await fetchCategories({ clearMessages: false });
    } catch (err) {
      console.error("Category status update failed:", err);
      setError(err.message || "Unable to change category status.");
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return categories;
    }

    return categories.filter((item) => {
      const isActive =
        String(item.enable_flag ?? item.ENABLE_FLAG ?? "Y").toUpperCase() ===
        "Y";

      const searchableText = [
        item.category_id ?? item.CATEGORY_ID,
        item.category_name ?? item.CATEGORY_NAME,
        item.category_type ?? item.CATEGORY_TYPE,
        item.description ?? item.DESCRIPTION,
        isActive ? "active" : "inactive",
        isActive ? "y" : "n",
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
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
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeCount = categories.filter(
    (item) =>
      String(item.enable_flag ?? item.ENABLE_FLAG ?? "Y").toUpperCase() === "Y"
  ).length;

  const inactiveCount = categories.length - activeCount;

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
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </header>

      <div className="cat-content">
        <div className="cat-heading">
          <div>
            <p className="cat-eyebrow">FINANCIAL ORGANIZATION</p>
            <h1>Categories</h1>
            <p>Manage the categories used to organize your transactions.</p>
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
            <span>Total categories</span>
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
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving) {
                closeForm();
              }
            }}
          >
            <section
              className="cat-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cat-modal-title"
            >
              <div className="cat-card-heading">
                <div>
                  <h2 id="cat-modal-title">
                    {mode === "edit" ? "Edit category" : "Create a category"}
                  </h2>

                  <p>
                    {mode === "edit"
                      ? `Updating category ID ${form.category_id}`
                      : "Add a category for income or expenses."}
                  </p>
                </div>

                <button
                  type="button"
                  className="cat-modal-close"
                  onClick={closeForm}
                  disabled={saving}
                  aria-label="Close popup"
                >
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="cat-alert cat-alert-error" role="alert">
                  <CircleAlert size={18} />
                  <span>{error}</span>
                </div>
              )}

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
                    onClick={closeForm}
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
              <h2>All Categories</h2>
              <p>View, search, edit, activate, or deactivate categories.</p>
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
                aria-label="Search categories"
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
                ? "No categories found. Create your first category above."
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
                    const isActive =
                      String(
                        item.enable_flag ?? item.ENABLE_FLAG ?? "Y"
                      ).toUpperCase() === "Y";

                    return (
                      <tr key={item.category_id ?? item.CATEGORY_ID}>
                        {/* <td>{item.category_id ?? item.CATEGORY_ID}</td> */}
                        <td>{startIndex + index + 1}</td>

                        <td className="cat-table-name">
                          {item.category_name ?? item.CATEGORY_NAME ?? "—"}
                        </td>

                        <td>
                          <span className="cat-type-badge">
                            {item.category_type ?? item.CATEGORY_TYPE ?? "—"}
                          </span>
                        </td>

                        <td className="cat-table-description">
                          {item.description ?? item.DESCRIPTION ?? "—"}
                        </td>

                        <td>
                          <span
                            className={`cat-status ${
                              isActive
                                ? "cat-status-active"
                                : "cat-status-inactive"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td>
                          <div className="cat-row-actions">
                            {canManageCategory(item) && (
                              <>
                                <button
                                  type="button"
                                  className="cat-secondary-button"
                                  onClick={() => startEditing(item)}
                                  disabled={saving}
                                  title="Edit category"
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
                                    isActive
                                      ? "Deactivate category"
                                      : "Activate category"
                                  }
                                >
                                  <Power size={15} />
                                  {isActive ? "Deactivate" : "Activate"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="cat-pagination">
                <div className="cat-page-size">
                  <label htmlFor="category-page-size">Rows per page:</label>
                  <select
                    id="category-page-size"
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
          <button type="button" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </footer>
      </div>
    </main>
  );
}

export default Categories;
