import { useCallback, useEffect, useMemo, useState } from "react";
import { encryptRequest } from "../../utils/encryption";
import { useNavigate } from "react-router-dom";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  ArrowLeft,
  Wallet,
  CircleAlert,
  Plus,
  Pencil,
  Power,
  X,
  CheckCircle2,
} from "lucide-react";
import "./Transactions.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const TRANSACTION_API = `${API_BASE_URL?.replace(/\/$/, "")}/transactions`;
const CATEGORY_API = `${API_BASE_URL?.replace(/\/$/, "")}/categories`;

const EMPTY_TRANSACTION = {
  transaction_id: "",
  category_id: "",
  transaction_type: "",
  amount: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  description: "",
  payment_mode: "",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRecords(response) {
  let records = response?.data;

  // Support nested stored-procedure result sets.
  if (!Array.isArray(records) && Array.isArray(records?.data)) {
    records = records.data;
  }

  if (!Array.isArray(records)) {
    return [];
  }

  records = records.flat(Infinity);

  // Convert uppercase database keys to the lowercase keys
  return records
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      transaction_id: record.TRANSACTION_ID ?? record.transaction_id,
      user_id: record.USER_ID ?? record.user_id,
      category_id: record.CATEGORY_ID ?? record.category_id,
      transaction_type:
        record.TRANSACTION_TYPE ?? record.transaction_type ?? "",
      amount: record.AMOUNT ?? record.amount ?? 0,
      transaction_date: record.TRANSACTION_DATE ?? record.transaction_date,
      description: record.DESCRIPTION ?? record.description ?? "",
      payment_mode: record.PAYMENT_MODE ?? record.payment_mode ?? "",
      enable_flag: record.ENABLE_FLAG ?? record.enable_flag,
      created_at: record.CREATED_AT ?? record.created_at,
      last_updated_date: record.LAST_UPDATED_DATE ?? record.last_updated_date,
    }));
}

function Transactions() {
  const navigate = useNavigate();

  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [period, setPeriod] = useState("current");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [form, setForm] = useState(EMPTY_TRANSACTION);
  const [categoriesList, setCategoriesList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!error) return;

    const timer = window.setTimeout(() => {
      setError("");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [error]);

  const selectedDate = new Date();
  if (period === "previous") {
    selectedDate.setMonth(selectedDate.getMonth() - 1);
  }

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const token = sessionStorage.getItem("access_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      if (!API_BASE_URL) {
        throw new Error("VITE_API_BASE_URL is missing from client/.env.");
      }

      // GET /transactions/getTransaction
      // sendEncryptedGet handles the Bearer token,
      // encrypted request parameters, and 401 responses.
      const result = await sendEncryptedGet("getTransaction", {
        action: "GetTransaction",
      });

      const records = getRecords(result);

      setTransactions(records);
    } catch (err) {
      setError(err.message || "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  }, [navigate, refreshKey]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    loadCategories();
  }, []);

  const filteredTransactions = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return transactions.filter((item) => {
      // Filter by transaction status
      const transactionStatus = String(item.enable_flag ?? "Y").toUpperCase();

      if (statusFilter !== "ALL" && transactionStatus !== statusFilter) {
        return false;
      }
      const transactionType = String(item.transaction_type || "").toUpperCase();

      // Filter by transaction type
      if (type !== "ALL" && transactionType !== type) {
        return false;
      }

      // Filter by category ID
      if (
        categoryId !== "ALL" &&
        String(item.category_id) !== String(categoryId)
      ) {
        return false;
      }

      // Filter by selected period
      const transactionDate = item.transaction_date
        ? new Date(item.transaction_date)
        : null;

      if (transactionDate && !Number.isNaN(transactionDate.getTime())) {
        if (
          transactionDate.getMonth() !== selectedDate.getMonth() ||
          transactionDate.getFullYear() !== selectedDate.getFullYear()
        ) {
          return false;
        }
      }

      // Filter by search text
      const text = [
        item.description,
        item.transaction_type,
        item.payment_mode,
        item.transaction_id,
        item.category_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(searchText);
    });
  }, [
    transactions,
    search,
    type,
    categoryId,
    statusFilter,
    selectedDate.getMonth(),
    selectedDate.getFullYear(),
  ]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (result, item) => {
        const amount = Number(item.amount) || 0;
        const transactionType = String(
          item.transaction_type || ""
        ).toLowerCase();

        if (transactionType === "income") {
          result.income += amount;
        } else if (transactionType === "expense") {
          result.expenses += amount;
        }

        return result;
      },
      { income: 0, expenses: 0 }
    );
  }, [filteredTransactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / pageSize)
  );

  const startIndex = (currentPage - 1) * pageSize;

  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + pageSize
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, type, categoryId, period, pageSize, transactions.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function goToDashboard() {
    navigate("/dashboard");
  }

  // Handle expired login sessions.
  function handleUnauthorized() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }

  // Parse API responses and handle errors.
  async function parseApiResponse(response) {
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

  // POST: Create, update, or change transaction status.
  async function sendEncryptedPost(endpoint, data) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      throw new Error("Please log in again.");
    }

    if (!API_BASE_URL) {
      throw new Error("VITE_API_BASE_URL is missing from client/.env.");
    }

    const encrypted = await encryptRequest({ data });

    const response = await fetch(`${TRANSACTION_API}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify(encrypted),
    });

    return parseApiResponse(response);
  }

  // GET: Retrieve transaction records.
  async function sendEncryptedGet(endpoint, data) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      throw new Error("Please log in again.");
    }

    if (!API_BASE_URL) {
      throw new Error("VITE_API_BASE_URL is missing from client/.env.");
    }

    const encrypted = await encryptRequest({ data });

    const url = new URL(`${TRANSACTION_API}/${endpoint}`);
    url.searchParams.set("nonce", encrypted.nonce);
    url.searchParams.set("ciphertext", encrypted.ciphertext);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    return parseApiResponse(response);
  }

  // Load categories for the transaction form.
  async function loadCategories() {
    try {
      const result = await (async () => {
        const token = sessionStorage.getItem("access_token");

        if (!token) {
          handleUnauthorized();
          throw new Error("Please log in again.");
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

        return parseApiResponse(response);
      })();

      const resultData = result.data ?? result.categories ?? result;

      const categoryRows = Array.isArray(resultData)
        ? resultData.flat(Infinity)
        : Array.isArray(resultData?.data)
        ? resultData.data.flat(Infinity)
        : [];

      console.log("Category API response:", result);
      console.log("Category rows:", categoryRows);

      setCategoriesList(
        categoryRows
          .filter((category) => category && typeof category === "object")
          .map((category) => ({
            category_id: category.category_id ?? category.CATEGORY_ID,
            category_name: category.category_name ?? category.CATEGORY_NAME,
            category_type: String(
              category.category_type ?? category.CATEGORY_TYPE ?? ""
            )
              .trim()
              .toUpperCase(),
            enable_flag: category.enable_flag ?? category.ENABLE_FLAG,
          }))
          .filter(
            (category) =>
              category.category_id != null &&
              (category.enable_flag == null ||
                String(category.enable_flag).toUpperCase() === "Y")
          )
      );
    } catch (err) {
      setError(err.message || "Unable to load categories.");
    }
  }

  async function handleCreateTransaction(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const amount = Number(form.amount);

      if (!form.category_id) {
        throw new Error("Please select a category.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      if (!form.transaction_date) {
        throw new Error("Please select a transaction date.");
      }

      const result = await sendEncryptedPost("createTransaction", {
        action: "CreateTransaction",
        category_id: Number(form.category_id),
        transaction_type: form.transaction_type,
        amount,
        transaction_date: form.transaction_date,
        description: form.description.trim(),
        payment_mode: form.payment_mode || null,
      });

      setSuccessMessage(result.message || "Transaction created successfully.");

      setShowForm(false);
      setForm(EMPTY_TRANSACTION);
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(err.message || "Unable to create transaction.");
    } finally {
      setSaving(false);
    }
  }

  function openCreateForm() {
    setForm(EMPTY_TRANSACTION);
    setFormMode("create");
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(transaction) {
    setError("");
    setSuccessMessage("");

    setForm({
      transaction_id: String(
        transaction.transaction_id ?? transaction.TRANSACTION_ID ?? ""
      ),
      category_id: String(
        transaction.category_id ?? transaction.CATEGORY_ID ?? ""
      ),
      transaction_type:
        transaction.transaction_type ??
        transaction.TRANSACTION_TYPE ??
        "EXPENSE",
      amount: String(transaction.amount ?? transaction.AMOUNT ?? ""),
      transaction_date: String(
        transaction.transaction_date ?? transaction.TRANSACTION_DATE ?? ""
      ).slice(0, 10),
      description: transaction.description ?? transaction.DESCRIPTION ?? "",
      payment_mode: transaction.payment_mode ?? transaction.PAYMENT_MODE ?? "",
    });

    setFormMode("edit");
    setShowForm(true);
  }

  async function handleUpdateTransaction(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const amount = Number(form.amount);

      if (!form.transaction_id) {
        throw new Error("Transaction ID is required.");
      }

      if (!form.category_id) {
        throw new Error("Please select a category.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }

      if (!form.transaction_date) {
        throw new Error("Please select a transaction date.");
      }

      const result = await sendEncryptedPost("createTransaction", {
        action: "UpdateTransaction",
        transaction_id: Number(form.transaction_id),
        category_id: Number(form.category_id),
        transaction_type: form.transaction_type,
        amount,
        transaction_date: form.transaction_date,
        description: form.description.trim(),
        payment_mode: form.payment_mode || null,
      });

      setSuccessMessage(result.message || "Transaction updated successfully.");

      setShowForm(false);
      setForm(EMPTY_TRANSACTION);
      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(err.message || "Unable to update transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTransactionStatus(transaction) {
    const transactionId =
      transaction.transaction_id ?? transaction.TRANSACTION_ID;

    const currentFlag =
      transaction.enable_flag ?? transaction.ENABLE_FLAG ?? "Y";

    const nextFlag = String(currentFlag).toUpperCase() === "Y" ? "N" : "Y";

    const actionLabel = nextFlag === "Y" ? "activate" : "deactivate";

    if (!transactionId) {
      setError("Transaction ID is missing.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to ${actionLabel} this transaction?`
      )
    ) {
      return;
    }

    try {
      setStatusUpdatingId(transactionId);
      setError("");
      setSuccessMessage("");

      const result = await sendEncryptedPost("createTransaction", {
        action: "UpdateTransactionStatus",
        transaction_id: Number(transactionId),
        enable_flag: nextFlag,
      });

      setSuccessMessage(
        result.message || `Transaction ${actionLabel}d successfully.`
      );

      setRefreshKey((previous) => previous + 1);
    } catch (err) {
      setError(err.message || "Unable to update transaction status.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  return (
    <main className="tx-page">
      <header className="tx-header">
        <div className="tx-brand">
          <div className="tx-brand-icon">
            <Wallet size={22} />
          </div>
          <span>SpendWise</span>
        </div>

        <button className="tx-back-button" onClick={goToDashboard}>
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </header>

      <div className="tx-content">
        <section className="tx-page-heading">
          <div className="tx-heading-actions">
            <button
              className="tx-add-button"
              onClick={openCreateForm}
              type="button"
            >
              <Plus size={16} />
              Add Transaction
            </button>
          </div>
        </section>

        {successMessage && (
          <div className="tx-success" role="status">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="tx-error" role="alert">
            <CircleAlert size={19} />
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

        {showForm && (
          <section
            className="tx-modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget && !saving) {
                setError("");
                setShowForm(false);
              }
            }}
          >
            <div
              className="tx-form-panel tx-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transaction-modal-title"
            >
              <div className="tx-form-heading">
                <div>
                  <h2 id="transaction-modal-title">
                    {formMode === "edit"
                      ? "Edit transaction"
                      : "Create a transaction"}
                  </h2>
                  <p>Enter the transaction details below.</p>
                </div>

                <button
                  type="button"
                  className="tx-icon-button"
                  // onClick={() => setShowForm(false)}
                  onClick={() => {
                    setError("");
                    setShowForm(false);
                  }}
                  aria-label="Close transaction form"
                  disabled={saving}
                >
                  <X size={20} />
                </button>
              </div>

              <form
                className="tx-form"
                onSubmit={
                  formMode === "create"
                    ? handleCreateTransaction
                    : handleUpdateTransaction
                }
              >
                <label>
                  Transaction type
                  <select
                    value={form.transaction_type}
                    onChange={(event) =>
                      setForm({ ...form, transaction_type: event.target.value })
                    }
                    required
                  >
                    <option value="">Select transaction type</option>
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </label>
                <label>
                  Category
                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      setForm({ ...form, category_id: event.target.value })
                    }
                    required
                    disabled={!form.transaction_type}
                  >
                    <option value="">Select category</option>

                    {categoriesList
                      .filter(
                        (category) =>
                          !category.category_type ||
                          category.category_type === form.transaction_type
                      )
                      .map((category) => (
                        <option
                          key={category.category_id}
                          value={String(category.category_id)}
                        >
                          {category.category_name ||
                            `Category ${category.category_id}`}
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Amount (₹)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) =>
                      setForm({ ...form, amount: event.target.value })
                    }
                    placeholder="Enter amount"
                    required
                  />
                </label>

                <label>
                  Transaction date
                  <input
                    type="date"
                    value={form.transaction_date}
                    onChange={(event) =>
                      setForm({ ...form, transaction_date: event.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Payment mode
                  <select
                    value={form.payment_mode}
                    onChange={(event) =>
                      setForm({ ...form, payment_mode: event.target.value })
                    }
                  >
                    <option value="">Select payment mode</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="tx-form-full">
                  Description
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Enter transaction description"
                    rows={3}
                    maxLength={500}
                  />
                </label>

                <div className="tx-form-actions">
                  <button
                    type="button"
                    className="tx-cancel-button"
                    onClick={() => {
                      setError("");
                      setShowForm(false);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="tx-submit-button"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : formMode === "edit"
                      ? "Save changes"
                      : "Create transaction"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        <section className="tx-summary-grid">
          <article className="tx-summary-card">
            <div className="tx-summary-icon tx-income-icon">
              <ArrowDownLeft size={20} />
            </div>
            <span>Total income</span>
            <strong>{formatCurrency(totals.income)}</strong>
          </article>

          <article className="tx-summary-card">
            <div className="tx-summary-icon tx-expense-icon">
              <ArrowUpRight size={20} />
            </div>
            <span>Total expenses</span>
            <strong>{formatCurrency(totals.expenses)}</strong>
          </article>

          <article className="tx-summary-card">
            <div className="tx-summary-icon tx-count-icon">
              <Wallet size={20} />
            </div>
            <span>Transactions</span>
            <strong>{filteredTransactions.length}</strong>
          </article>
        </section>

        <section className="tx-panel">
          <div className="tx-filter-row">
            <label className="tx-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search description, category, payment..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              aria-label="Select period"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="current">This month</option>
              <option value="previous">Last month</option>
            </select>

            <select
              aria-label="Filter by transaction type"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="ALL">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>

            <select
              aria-label="Filter by category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="ALL">All categories</option>

              {categoriesList.map((category) => (
                <option
                  key={category.category_id}
                  value={String(category.category_id)}
                >
                  {category.category_name}
                </option>
              ))}
            </select>
          </div>

          <div className="tx-table-heading">
            <div>
              <h2>All transactions</h2>
              <p>
                {selectedDate.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="tx-table-heading-actions">
              <span>{filteredTransactions.length} records</span>
            </div>
          </div>

          {loading ? (
            <div className="tx-state">
              <span className="tx-spinner" />
              Loading transactions...
            </div>
          ) : (
            <div className="tx-table-scroll">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Description</th>
                    {/* <th>Category</th> */}
                    <th>Transaction Date</th>
                    <th>Payment mode</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="tx-amount-column">Amount</th>
                    <th className="tx-actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((item, index) => {
                    const isIncome =
                      String(item.transaction_type || "").toLowerCase() ===
                      "income";

                    const isActive =
                      String(item.enable_flag ?? "Y").toUpperCase() === "Y";

                    return (
                      // <tr key={item.transaction_id ?? index}>
                      <tr key={item.transaction_id ?? item.TRANSACTION_ID}>
                        <td>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td>
                          <strong className="tx-description">
                            {item.description || "—"}
                          </strong>
                        </td>

                        <td>{formatDate(item.transaction_date)}</td>
                        <td>{item.payment_mode || "—"}</td>

                        <td>
                          <span
                            className={`tx-type ${
                              isIncome ? "income" : "expense"
                            }`}
                          >
                            {item.transaction_type || "Unknown"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`tx-status-badge ${
                              isActive ? "active" : "inactive"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td
                          className={`tx-amount ${isIncome ? "positive" : ""}`}
                        >
                          {isIncome ? "+" : "−"} {formatCurrency(item.amount)}
                        </td>

                        <td className="tx-actions-cell">
                          <button
                            type="button"
                            className="tx-icon-button"
                            onClick={() => openEditForm(item)}
                            title="Edit transaction"
                            aria-label="Edit transaction"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="tx-icon-button"
                            onClick={() => handleTransactionStatus(item)}
                            disabled={statusUpdatingId === item.transaction_id}
                            title={
                              isActive
                                ? "Deactivate transaction"
                                : "Activate transaction"
                            }
                          >
                            <Power size={16} />
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="tx-empty">
                        {transactions.length === 0
                          ? "No transactions found."
                          : "No transactions match your search."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="cat-pagination">
                <div className="cat-page-size">
                  <label htmlFor="transaction-page-size">Rows per page:</label>

                  <select
                    id="transaction-page-size"
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
                  {filteredTransactions.length === 0
                    ? "0 records"
                    : `${startIndex + 1}–${Math.min(
                        startIndex + pageSize,
                        filteredTransactions.length
                      )} of ${filteredTransactions.length}`}
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

        <footer className="tx-footer">
          <span>© {new Date().getFullYear()} SpendWise</span>
          <button onClick={goToDashboard}>Back to dashboard</button>
        </footer>
      </div>
    </main>
  );
}
export default Transactions;
