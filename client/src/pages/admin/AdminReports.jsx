import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { FileText, RefreshCw, Search, Download, ArrowLeft } from "lucide-react";
import "./AdminReports.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function AdminReports() {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState("transactions");
  const [userId, setUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [endDate, setEndDate] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [monthlySummary, setMonthlySummary] = useState([]);
  const [categoryExpenses, setCategoryExpenses] = useState([]);
  const [budgetUtilization, setBudgetUtilization] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getHeaders = () => ({
    Authorization: `Bearer ${sessionStorage.getItem("access_token")}`,
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, "")}/users/getAllUsers`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      const result = await response.json();

      if (result.status === "SUCCESS" && Array.isArray(result.data)) {
        setUsers(result.data);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  const fetchReport = async (endpoint, params = {}) => {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        query.append(key, value);
      }
    });

    const url = `${API_BASE_URL}/dashboard/${endpoint}${
      query.toString() ? `?${query.toString()}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (response.status === 401) {
      sessionStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.detail || `Failed to load ${endpoint}`);
    }

    const result = await response.json();

    if (result.status && result.status !== "SUCCESS") {
      throw new Error(result.message || `Failed to load ${endpoint}`);
    }
    return result.data ?? [];
  };

  // const loadReports = async () => {
  const loadReports = async (filterOverrides = {}) => {
    setLoading(true);
    setError("");

    try {
      const filters = {
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        year,
        month,
        transaction_type: transactionType,
        category_id: categoryId,
        ...filterOverrides,
      };

      const commonParams = {
        user_id: filters.user_id,
        year: filters.year,
        month: filters.month,
      };

      const transactionParams = {
        ...filters,
      };
      const [transactionData, monthlyData, categoryData, budgetData] =
        await Promise.all([
          fetchReport("transactionReport", transactionParams),
          fetchReport("monthlySummary", commonParams),
          fetchReport("categoryExpenseBreakdown", commonParams),
          fetchReport("budgetUtilization", commonParams),
        ]);

      setTransactions(Array.isArray(transactionData) ? transactionData : []);

      setMonthlySummary(
        Array.isArray(monthlyData) ? monthlyData : [monthlyData]
      );
      setCategoryExpenses(Array.isArray(categoryData) ? categoryData : []);
      const categoryList = [
        ...new Map(
          (Array.isArray(categoryData) ? categoryData : [])
            .filter(
              (category) =>
                category.category_id != null && category.category_name
            )
            .map((category) => [
              String(category.category_id),
              {
                category_id: category.category_id,
                category_name: category.category_name,
              },
            ])
        ).values(),
      ];

      setCategories(categoryList);
      setBudgetUtilization(Array.isArray(budgetData) ? budgetData : []);
    } catch (err) {
      setError(err.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    loadReports();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [activeReport]);

  const filteredTransactions = transactions.filter((transaction) => {
    const value = search.trim().toLowerCase();

    if (!value) return true;

    return [
      //   transaction.user_id,
      transaction.user_email,
      transaction.transaction_id,
      transaction.category_name,
      transaction.transaction_type,
      transaction.description,
      transaction.payment_mode,
    ].some((item) =>
      String(item ?? "")
        .toLowerCase()
        .includes(value)
    );
  });
  //pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / pageSize)
  );

  const startIndex = (currentPage - 1) * pageSize;

  const paginatedTransactions = filteredTransactions.slice(
    startIndex,
    startIndex + pageSize
  );

  const startRecord = filteredTransactions.length === 0 ? 0 : startIndex + 1;

  const endRecord = Math.min(
    startIndex + pageSize,
    filteredTransactions.length
  );

  // Monthly Summary pagination
  const monthlyTotalPages = Math.max(
    1,
    Math.ceil(monthlySummary.length / pageSize)
  );
  const monthlyStartIndex = (currentPage - 1) * pageSize;
  const paginatedMonthlySummary = monthlySummary.slice(
    monthlyStartIndex,
    monthlyStartIndex + pageSize
  );
  const monthlyStartRecord =
    monthlySummary.length === 0 ? 0 : monthlyStartIndex + 1;
  const monthlyEndRecord = Math.min(
    monthlyStartIndex + pageSize,
    monthlySummary.length
  );

  // Category Expenses pagination
  const categoryTotalPages = Math.max(
    1,
    Math.ceil(categoryExpenses.length / pageSize)
  );
  const categoryStartIndex = (currentPage - 1) * pageSize;
  const paginatedCategoryExpenses = categoryExpenses.slice(
    categoryStartIndex,
    categoryStartIndex + pageSize
  );
  const categoryStartRecord =
    categoryExpenses.length === 0 ? 0 : categoryStartIndex + 1;
  const categoryEndRecord = Math.min(
    categoryStartIndex + pageSize,
    categoryExpenses.length
  );

  // Budget Utilization pagination
  const budgetTotalPages = Math.max(
    1,
    Math.ceil(budgetUtilization.length / pageSize)
  );
  const budgetStartIndex = (currentPage - 1) * pageSize;
  const paginatedBudgetUtilization = budgetUtilization.slice(
    budgetStartIndex,
    budgetStartIndex + pageSize
  );
  const budgetStartRecord =
    budgetUtilization.length === 0 ? 0 : budgetStartIndex + 1;
  const budgetEndRecord = Math.min(
    budgetStartIndex + pageSize,
    budgetUtilization.length
  );

  const exportCSV = () => {
    const rows = filteredTransactions;

    if (!rows.length) {
      setError("No transactions available to export.");
      return;
    }

    const columns = [
      "user_email",
      "transaction_id",
      "category_name",
      "transaction_type",
      "amount",
      "transaction_date",
      "description",
      "payment_mode",
      "enable_flag",
    ];

    const escapeCSV = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      columns.join(","),
      ...rows.map((row) =>
        columns.map((column) => escapeCSV(row[column])).join(",")
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "admin-transaction-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const formatAmount = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="admin-reports-page">
      <button
        type="button"
        onClick={() => navigate("/admin")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          marginBottom: "20px",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          background: "#fff",
          color: "#111827",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        <ArrowLeft size={16} />
        Back to Admin Dashboard
      </button>
      <header className="admin-reports-header">
        <div>
          <h1>
            <FileText size={25} /> Admin Reports
          </h1>
          <p>
            Review transactions, monthly summaries, category expenses, and
            budget utilization across users.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCurrentPage(1);
            loadReports();
          }}
          disabled={loading}
          className="admin-report-refresh"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <section className="admin-report-filters">
        <h2>Report Filters</h2>

        <div className="admin-report-filter-grid">
          <label>
            User Email
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.USER_ID} value={user.USER_ID}>
                  {user.EMAIL || user.USER_NAME || `User ${user.USER_ID}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            Year
            <input
              type="number"
              min="2000"
              max="9999"
              placeholder="All years"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            />
          </label>

          <label>
            Month
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {new Date(2000, index).toLocaleString("en", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </label>

          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            End Date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <label>
            Transaction Type
            <select
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
            >
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </label>
          <label>
            Category
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">All categories</option>

              {categories.map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.category_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {startDate && endDate && startDate > endDate && (
          <p className="admin-report-error">
            Start date cannot be after end date.
          </p>
        )}

        <div className="admin-report-filter-actions">
          <button
            type="button"
            // onClick={loadReports}
            onClick={() => {
              setCurrentPage(1);
              loadReports();
            }}
            disabled={
              loading || Boolean(startDate && endDate && startDate > endDate)
            }
          >
            Apply Filters
          </button>

          <button
            type="button"
            className="admin-report-secondary"
            onClick={() => {
              setUserId("");
              setStartDate("");
              setEndDate("");
              setYear("");
              setMonth("");
              setTransactionType("");
              setCategoryId("");
              setSearch("");
              setCurrentPage(1);

              loadReports({
                user_id: "",
                start_date: "",
                end_date: "",
                year: "",
                month: "",
                transaction_type: "",
                category_id: "",
              });
            }}
          >
            Clear Filters
          </button>
        </div>
      </section>

      {error && (
        <div className="admin-report-error" role="alert">
          {error}
        </div>
      )}

      <nav className="admin-report-tabs">
        {[
          ["transactions", "Transactions"],
          ["monthly", "Monthly Summary"],
          ["categories", "Category Expenses"],
          ["budgets", "Budget Utilization"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={activeReport === key ? "active" : ""}
            onClick={() => setActiveReport(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="admin-report-loading">Loading reports...</div>
      ) : (
        <>
          {activeReport === "transactions" && (
            <section className="admin-report-panel">
              <div className="admin-report-panel-header">
                <h2>Transaction Report</h2>

                <button type="button" onClick={exportCSV}>
                  <Download size={16} /> Export CSV
                </button>
              </div>

              <label className="admin-report-search">
                <Search size={17} />
                <input
                  type="search"
                  //   placeholder="Search transactions or user ID..."
                  placeholder="Search transactions or user email..."
                  value={search}
                  // onChange={(event) => setSearch(event.target.value)}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>

              <div className="admin-report-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>User Email</th>
                      <th>Transaction ID</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Payment Mode</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((item) => (
                      <tr key={item.transaction_id}>
                        {/* <td>{item.user_id ?? "-"}</td> */}
                        <td>{item.user_email ?? "-"}</td>
                        <td>{item.transaction_id}</td>
                        <td>
                          {item.transaction_date
                            ? String(item.transaction_date).slice(0, 10)
                            : "-"}
                        </td>
                        <td>{item.category_name ?? "-"}</td>
                        <td>{item.transaction_type ?? "-"}</td>
                        <td>{formatAmount(item.amount)}</td>
                        <td>{item.payment_mode ?? "-"}</td>
                        <td>
                          {item.enable_flag === "Y"
                            ? "Active"
                            : item.enable_flag === "N"
                            ? "Inactive"
                            : "-"}
                        </td>
                      </tr>
                    ))}

                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan="8" className="admin-report-empty">
                          No transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="cat-pagination">
                  <div className="cat-page-size">
                    <label htmlFor="report-page-size">Rows per page:</label>
                    <select
                      id="report-page-size"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>

                  <span className="cat-pagination-info">
                    Showing {startRecord}–{endRecord} of{" "}
                    {filteredTransactions.length}
                  </span>

                  <div className="cat-pagination-buttons">
                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((page) => page - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeReport === "monthly" && (
            <section className="admin-report-panel">
              <h2>Monthly Income and Expenses</h2>
              <div className="admin-report-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Month</th>
                      <th>Total Income</th>
                      <th>Total Expenses</th>
                      <th>Net Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMonthlySummary.map((item, index) => (
                      <tr key={`${item.year}-${item.month}-${index}`}>
                        <td>{item.year ?? "-"}</td>
                        <td>{item.month ?? "-"}</td>
                        <td>{formatAmount(item.total_income)}</td>
                        <td>{formatAmount(item.total_expenses)}</td>
                        <td>{formatAmount(item.net_balance)}</td>
                      </tr>
                    ))}
                    {monthlySummary.length === 0 && (
                      <tr>
                        <td colSpan="5" className="admin-report-empty">
                          No monthly summaries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="cat-pagination">
                  <div className="cat-page-size">
                    <label htmlFor="report-page-size">Rows per page:</label>
                    <select
                      id="report-page-size"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>

                  <span className="cat-pagination-info">
                    Showing {monthlyStartRecord}–{monthlyEndRecord} of{" "}
                    {monthlySummary.length}
                  </span>

                  <div className="cat-pagination-buttons">
                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((page) => page - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {currentPage} of {monthlyTotalPages}
                    </span>

                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage >= monthlyTotalPages}
                      onClick={() => setCurrentPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeReport === "categories" && (
            <section className="admin-report-panel">
              <h2>Category Expense Breakdown</h2>
              <div className="admin-report-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Year</th>
                      <th>Month</th>
                      <th>Total Expenses</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCategoryExpenses.map((item, index) => (
                      <tr
                        key={`${item.category_id}-${item.year}-${item.month}-${index}`}
                      >
                        <td>{item.category_name}</td>
                        <td>{item.year}</td>
                        <td>{item.month}</td>
                        <td>{formatAmount(item.total_expenses)}</td>
                        <td>{item.transaction_count}</td>
                      </tr>
                    ))}
                    {categoryExpenses.length === 0 && (
                      <tr>
                        <td colSpan="5" className="admin-report-empty">
                          No category expenses found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="cat-pagination">
                  <div className="cat-page-size">
                    <label htmlFor="report-page-size">Rows per page:</label>
                    <select
                      id="report-page-size"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>

                  <span className="cat-pagination-info">
                    Showing {categoryStartRecord}–{categoryEndRecord} of{" "}
                    {categoryExpenses.length}
                  </span>

                  <div className="cat-pagination-buttons">
                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((page) => page - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {currentPage} of {categoryTotalPages}
                    </span>

                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage >= categoryTotalPages}
                      onClick={() => setCurrentPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeReport === "budgets" && (
            <section className="admin-report-panel">
              <h2>Budget Utilization</h2>
              <div className="admin-report-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Year</th>
                      <th>Month</th>
                      <th>Budget Amount</th>
                      <th>Actual Expenses</th>
                      <th>Remaining</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBudgetUtilization.map((item) => (
                      <tr key={item.budget_id}>
                        <td>{item.category_name}</td>
                        <td>{item.year}</td>
                        <td>{item.month}</td>
                        <td>{formatAmount(item.budget_amount)}</td>
                        <td>{formatAmount(item.actual_expenses)}</td>
                        <td>{formatAmount(item.remaining_budget)}</td>
                        <td>{formatAmount(item.utilization_percentage)}%</td>
                      </tr>
                    ))}
                    {budgetUtilization.length === 0 && (
                      <tr>
                        <td colSpan="7" className="admin-report-empty">
                          No budget records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="cat-pagination">
                  <div className="cat-page-size">
                    <label htmlFor="report-page-size">Rows per page:</label>
                    <select
                      id="report-page-size"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                    </select>
                  </div>

                  <span className="cat-pagination-info">
                    Showing {budgetStartRecord}–{budgetEndRecord} of{" "}
                    {budgetUtilization.length}
                  </span>

                  <div className="cat-pagination-buttons">
                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((page) => page - 1)}
                    >
                      Previous
                    </button>

                    <span>
                      Page {currentPage} of {budgetTotalPages}
                    </span>

                    <button
                      type="button"
                      className="cat-secondary-button"
                      disabled={currentPage >= budgetTotalPages}
                      onClick={() => setCurrentPage((page) => page + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default AdminReports;
