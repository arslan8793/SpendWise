import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
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
import "./Budget.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const BUDGET_API = `${API_BASE_URL?.replace(/\/$/, "")}/budgets`;
const CATEGORY_API = `${API_BASE_URL?.replace(/\/$/, "")}/categories`;

const currentDate = new Date();

const emptyForm = {
  budget_id: "",
  category_id: "",
  budget_amount: "",
  budget_month: String(currentDate.getMonth() + 1),
  budget_year: String(currentDate.getFullYear()),
};

function normalizeRecord(record = {}) {
  return {
    budget_id: record.budget_id ?? record.BUDGET_ID ?? "",
    user_id: record.user_id ?? record.USER_ID ?? "",
    category_id: record.category_id ?? record.CATEGORY_ID ?? "",
    category_name: record.category_name ?? record.CATEGORY_NAME ?? "",
    budget_amount: Number(record.budget_amount ?? record.BUDGET_AMOUNT ?? 0),
    budget_month: Number(record.budget_month ?? record.BUDGET_MONTH ?? 0),
    budget_year: Number(record.budget_year ?? record.BUDGET_YEAR ?? 0),
    enable_flag: String(
      record.enable_flag ?? record.ENABLE_FLAG ?? "Y"
    ).toUpperCase(),
  };
}

function getRecords(result) {
  if (Array.isArray(result?.data)) {
    return result.data.map(normalizeRecord);
  }

  if (Array.isArray(result?.data?.[0])) {
    return result.data[0].map(normalizeRecord);
  }

  return result?.data ? [normalizeRecord(result.data)] : [];
}

function Budget() {
  const navigate = useNavigate();

  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState("create");

  const [searchTerm, setSearchTerm] = useState("");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  async function sendEncryptedPost(data) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!API_BASE_URL) {
      throw new Error("VITE_API_BASE_URL is missing from client/.env.");
    }

    const encrypted = await encryptRequest({ data });

    const response = await fetch(`${BUDGET_API}/manageBudget`, {
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

  async function sendEncryptedGet(endpoint, data) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!API_BASE_URL) {
      throw new Error("VITE_API_BASE_URL is missing from client/.env.");
    }

    const encrypted = await encryptRequest({ data });
    const url = new URL(`${BUDGET_API}/${endpoint}`);

    url.searchParams.set("nonce", encrypted.nonce);
    url.searchParams.set("ciphertext", encrypted.ciphertext);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    return parseResponse(response);
  }

  const fetchBudgets = useCallback(
    async (clearMessages = false) => {
      if (clearMessages) resetMessages();

      setLoading(true);

      try {
        const result = await sendEncryptedGet("getBudget", {
          action: "GetBudget",
        });

        setBudgets(getRecords(result));
      } catch (err) {
        setError(err.message || "Unable to retrieve budgets.");
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  const fetchCategories = useCallback(async () => {
    try {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        handleUnauthorized();
        return;
      }

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

      setCategories(
        records.filter(
          (item) =>
            String(
              item.enable_flag ?? item.ENABLE_FLAG ?? "Y"
            ).toUpperCase() === "Y"
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load categories.");
    }
  }, [navigate]);

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
  }, [fetchBudgets, fetchCategories]);

  function openCreateForm() {
    resetMessages();
    setForm({
      ...emptyForm,
      budget_month: String(currentDate.getMonth() + 1),
      budget_year: String(currentDate.getFullYear()),
    });
    setMode("create");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEditForm(budget) {
    resetMessages();
    setForm({
      budget_id: String(budget.budget_id),
      category_id: String(budget.category_id),
      budget_amount: String(budget.budget_amount),
      budget_month: String(budget.budget_month),
      budget_year: String(budget.budget_year),
    });
    setMode("edit");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setMode("create");
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    resetMessages();

    const categoryId = Number(form.category_id);
    const amount = Number(form.budget_amount);
    const month = Number(form.budget_month);
    const year = Number(form.budget_year);

    if (
      !categoryId ||
      !categories.some(
        (category) =>
          Number(category.category_id ?? category.CATEGORY_ID) === categoryId
      )
    ) {
      setError("Please select a valid category.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Budget amount must be greater than zero.");
      return;
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      setError("Please select a valid month.");
      return;
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setError("Please enter a valid year.");
      return;
    }

    const isEditing = mode === "edit";

    const data = {
      action: isEditing ? "UpdateBudget" : "CreateBudget",
      category_id: categoryId,
      budget_amount: amount,
      budget_month: month,
      budget_year: year,
      last_update_login: null,
    };

    if (isEditing) {
      data.budget_id = Number(form.budget_id);
    }

    setSaving(true);

    try {
      const result = await sendEncryptedPost(data);
      setMessage(
        result.message ||
          (isEditing
            ? "Budget updated successfully."
            : "Budget created successfully.")
      );

      closeForm();
      await fetchBudgets(false);
    } catch (err) {
      setError(err.message || "Unable to save budget.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBudgetStatus(budget) {
    resetMessages();

    const nextFlag = budget.enable_flag === "Y" ? "N" : "Y";
    const actionLabel = nextFlag === "Y" ? "activate" : "deactivate";

    if (
      !window.confirm(`Are you sure you want to ${actionLabel} this budget?`)
    ) {
      return;
    }

    setStatusUpdatingId(budget.budget_id);

    try {
      const result = await sendEncryptedPost({
        action: "UpdateBudgetStatus",
        budget_id: Number(budget.budget_id),
        enable_flag: nextFlag,
        last_update_login: null,
      });

      setMessage(
        result.message ||
          `Budget ${
            nextFlag === "Y" ? "activated" : "deactivated"
          } successfully.`
      );

      await fetchBudgets(false);
    } catch (err) {
      setError(err.message || "Unable to update budget status.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  const filteredBudgets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return budgets.filter((budget) => {
      const categoryName = String(budget.category_name || "").toLowerCase();

      const matchesSearch =
        !query ||
        categoryName.includes(query) ||
        String(budget.budget_amount).includes(query) ||
        String(budget.budget_month).includes(query) ||
        String(budget.budget_year).includes(query);

      const matchesMonth =
        monthFilter === "ALL" ||
        Number(budget.budget_month) === Number(monthFilter);

      const matchesYear =
        yearFilter === "ALL" ||
        Number(budget.budget_year) === Number(yearFilter);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && budget.enable_flag === "Y") ||
        (statusFilter === "INACTIVE" && budget.enable_flag !== "Y");

      return matchesSearch && matchesMonth && matchesYear && matchesStatus;
    });
  }, [budgets, searchTerm, monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, monthFilter, yearFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedBudgets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBudgets.slice(start, start + pageSize);
  }, [filteredBudgets, currentPage, pageSize]);

  const activeBudgets = budgets.filter((item) => item.enable_flag === "Y");
  const inactiveBudgets = budgets.length - activeBudgets.length;

  const totalBudgetAmount = activeBudgets.reduce(
    (total, item) => total + item.budget_amount,
    0
  );

  const availableYears = [
    ...new Set(budgets.map((item) => item.budget_year).filter(Boolean)),
  ].sort((a, b) => b - a);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }

  function getCategoryName(budget) {
    if (budget.category_name) return budget.category_name;

    const category = categories.find(
      (item) =>
        Number(item.category_id ?? item.CATEGORY_ID) ===
        Number(budget.category_id)
    );

    return (
      category?.category_name ?? category?.CATEGORY_NAME ?? "Unknown category"
    );
  }

  return (
    <main className="budget-page">
      {/* Top navigation */}
      <header className="budget-header">
        <div className="budget-brand">
          <div className="budget-brand-icon">
            <Wallet size={22} />
          </div>
          <span>SpendWise</span>
        </div>

        <button
          type="button"
          className="budget-back-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </header>

      <div className="budget-content">
        <section className="budget-page-heading">
          <div>
            <p className="budget-eyebrow">YOUR FINANCES</p>
            <h1>Budget</h1>
            <p className="budget-subtitle">
              Plan and manage your monthly spending limits.
            </p>
          </div>

          <div className="budget-header-actions">
            <button
              type="button"
              className="budget-button budget-button-secondary"
              onClick={() => fetchBudgets(true)}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? "budget-spinning" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              className="budget-button budget-button-primary"
              onClick={openCreateForm}
            >
              <Plus size={17} />
              Create Budget
            </button>
          </div>
        </section>

        {error && (
          <div className="budget-alert budget-alert-error" role="alert">
            <CircleAlert size={18} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div className="budget-alert budget-alert-success" role="status">
            <CheckCircle2 size={18} />
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="budget-summary-grid">
          <article className="budget-summary-card">
            <span className="budget-summary-label">Total active budget</span>
            <strong>{formatCurrency(totalBudgetAmount)}</strong>
            <span className="budget-summary-footnote">
              Sum of active budget records
            </span>
          </article>

          <article className="budget-summary-card">
            <span className="budget-summary-label">Active budgets</span>
            <strong>{activeBudgets.length}</strong>
            <span className="budget-summary-footnote">Currently enabled</span>
          </article>

          <article className="budget-summary-card">
            <span className="budget-summary-label">Inactive budgets</span>
            <strong>{inactiveBudgets}</strong>
            <span className="budget-summary-footnote">Currently disabled</span>
          </article>

          <article className="budget-summary-card">
            <span className="budget-summary-label">Budget records</span>
            <strong>{budgets.length}</strong>
            <span className="budget-summary-footnote">
              All retrieved records
            </span>
          </article>
        </section>

        {showForm && (
          <section className="budget-form-card">
            <div className="budget-section-heading">
              <div>
                <h2>{mode === "edit" ? "Edit budget" : "Create a budget"}</h2>
                <p>
                  {mode === "edit"
                    ? "Update the category, amount, or budget period."
                    : "Set a spending limit for a category and month."}
                </p>
              </div>

              <button
                type="button"
                className="budget-icon-button"
                onClick={closeForm}
                aria-label="Close form"
              >
                <X size={19} />
              </button>
            </div>

            <form className="budget-form-grid" onSubmit={handleSubmit}>
              <label className="budget-field">
                <span>
                  Category <b>*</b>
                </span>
                <select
                  name="category_id"
                  value={form.category_id}
                  onChange={updateField}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => {
                    const id = category.category_id ?? category.CATEGORY_ID;
                    const name =
                      category.category_name ?? category.CATEGORY_NAME;

                    return (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="budget-field">
                <span>
                  Budget amount (₹) <b>*</b>
                </span>
                <input
                  name="budget_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10000"
                  value={form.budget_amount}
                  onChange={updateField}
                  required
                />
              </label>

              <label className="budget-field">
                <span>
                  Month <b>*</b>
                </span>
                <select
                  name="budget_month"
                  value={form.budget_month}
                  onChange={updateField}
                  required
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="budget-field">
                <span>
                  Year <b>*</b>
                </span>
                <input
                  name="budget_year"
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.budget_year}
                  onChange={updateField}
                  required
                />
              </label>

              <div className="budget-form-actions">
                <button
                  type="button"
                  className="budget-button budget-button-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="budget-button budget-button-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : mode === "edit"
                    ? "Save changes"
                    : "Create budget"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="budget-list-card">
          <div className="budget-section-heading budget-list-heading">
            <div>
              <h2>Budgets</h2>
              <p>Search, filter, edit, and manage your budget records.</p>
            </div>
            <span className="budget-record-count">
              {filteredBudgets.length} records
            </span>
          </div>

          <div className="budget-toolbar">
            <div className="budget-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search category, amount, or period..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <select
              aria-label="Filter by month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="ALL">All months</option>
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="ALL">All years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="budget-table-wrapper">
            <table className="budget-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Category</th>
                  <th>Budget period</th>
                  <th>Budget amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="budget-table-message">
                      Loading budgets...
                    </td>
                  </tr>
                ) : paginatedBudgets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="budget-table-message">
                      No budgets found. Create a budget to get started.
                    </td>
                  </tr>
                ) : (
                  paginatedBudgets.map((budget, index) => (
                    <tr
                      key={
                        budget.budget_id ||
                        `${budget.category_id}-${budget.budget_year}-${budget.budget_month}`
                      }
                    >
                      <td>{(currentPage - 1) * pageSize + index + 1}</td>
                      <td>
                        <span className="budget-category-name">
                          {getCategoryName(budget)}
                        </span>
                      </td>
                      <td>
                        {monthNames[budget.budget_month - 1] ||
                          budget.budget_month}{" "}
                        {budget.budget_year}
                      </td>
                      <td className="budget-amount-cell">
                        {formatCurrency(budget.budget_amount)}
                      </td>
                      <td>
                        <span
                          className={`budget-status ${
                            budget.enable_flag === "Y"
                              ? "is-active"
                              : "is-inactive"
                          }`}
                        >
                          {budget.enable_flag === "Y" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="budget-row-actions">
                          <button
                            type="button"
                            className="budget-icon-button"
                            title="Edit budget"
                            aria-label="Edit budget"
                            onClick={() => openEditForm(budget)}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className={`budget-icon-button ${
                              budget.enable_flag === "Y"
                                ? "budget-deactivate-button"
                                : "budget-activate-button"
                            }`}
                            title={
                              budget.enable_flag === "Y"
                                ? "Deactivate budget"
                                : "Activate budget"
                            }
                            aria-label={
                              budget.enable_flag === "Y"
                                ? "Deactivate budget"
                                : "Activate budget"
                            }
                            disabled={statusUpdatingId === budget.budget_id}
                            onClick={() => handleBudgetStatus(budget)}
                          >
                            <Power size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="budget-pagination">
            <div className="budget-page-size">
              <span>Rows per page</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>
                {filteredBudgets.length === 0
                  ? "0 records"
                  : `${(currentPage - 1) * pageSize + 1}–${Math.min(
                      currentPage * pageSize,
                      filteredBudgets.length
                    )} of ${filteredBudgets.length}`}
              </span>
            </div>

            <div className="budget-pagination-buttons">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default Budget;
