import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  Search,
  FileBarChart,
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./Reports.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CATEGORY_COLORS = [
  "#159b78",
  "#4d8de0",
  "#f3a23b",
  "#9270d9",
  "#e777a8",
  "#22b8bd",
  "#8b9baa",
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function Reports() {
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [transactionType, setTransactionType] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateErrors, setDateErrors] = useState({
    startDate: "",
    endDate: "",
  });

  const [monthlySummary, setMonthlySummary] = useState([]);
  const [categoryReport, setCategoryReport] = useState([]);
  const [budgetReport, setBudgetReport] = useState([]);

  const monthlyChartData = monthlySummary.map((item) => ({
    month: `${item.month}/${item.year}`,
    income: Number(item.total_income) || 0,
    expenses: Number(item.total_expenses) || 0,
    balance: Number(item.net_balance) || 0,
  }));

  const categoryChartData = categoryReport.map((item) => ({
    name: item.category_name || "Uncategorized",
    amount: Number(item.total_expenses) || 0,
    transactions: Number(item.transaction_count) || 0,
  }));

  // Load transactions using the existing API.
  async function loadTransactions(fromDate, toDate) {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    if (!API_BASE_URL) {
      setError("API base URL is not configured.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (fromDate) {
        params.set("start_date", fromDate);
      }

      if (toDate) {
        params.set("end_date", toDate);
      }

      // Reports should include enabled transactions only.
      params.set("enable_flag", "Y");

      const baseUrl = API_BASE_URL.replace(/\/+$/, "");

      const response = await fetch(
        `${baseUrl}/dashboard/transactionReport?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
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

      if (!response.ok) {
        throw new Error(
          result.detail ||
            result.message ||
            "Failed to load transaction report."
        );
      }

      if (result.status !== "SUCCESS") {
        throw new Error(result.message || "Failed to load transaction report.");
      }

      setTransactions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error("Reports API error:", err);
      setError(err.message || "Unable to load report data.");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  // Load all transactions initially; date filters are optional.
  useEffect(() => {
    loadTransactions("", "");
  }, []);

  function handleApplyFilters(event) {
    event.preventDefault();

    const errors = {
      startDate: "",
      endDate: "",
    };

    if (startDate && endDate && startDate > endDate) {
      errors.endDate = "End date must be on or after start date.";
    }

    setDateErrors(errors);

    if (errors.startDate || errors.endDate) {
      return;
    }

    loadTransactions(startDate, endDate);
  }

  // Populate categories from the currently loaded transactions.
  const categories = [
    ...new Map(
      transactions
        .filter((item) => item.category_id != null && item.category_name)
        .map((item) => [
          String(item.category_id),
          {
            id: String(item.category_id),
            name: item.category_name,
          },
        ])
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Apply transaction type and category filters.
  const reportTransactions = transactions.filter((item) => {
    const matchesType =
      transactionType === "ALL" ||
      String(item.transaction_type || "").toUpperCase() === transactionType;

    const matchesCategory =
      category === "ALL" || String(item.category_id) === category;

    return matchesType && matchesCategory;
  });

  // Search affects the transaction table and CSV export.
  const filteredTransactions = reportTransactions.filter((item) => {
    const searchableText = [
      item.description,
      item.category_name,
      item.transaction_type,
      item.payment_mode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search.trim().toLowerCase());
  });

  // Summary cards use the loaded transactions and selected filters.
  const totalIncome = reportTransactions.reduce((total, item) => {
    return String(item.transaction_type || "").toUpperCase() === "INCOME"
      ? total + (Number(item.amount) || 0)
      : total;
  }, 0);

  const totalExpenses = reportTransactions.reduce((total, item) => {
    return String(item.transaction_type || "").toUpperCase() === "EXPENSE"
      ? total + (Number(item.amount) || 0)
      : total;
  }, 0);

  const netBalance = totalIncome - totalExpenses;

  function handleExportCSV() {
    if (filteredTransactions.length === 0) {
      window.alert("There are no transactions to export.");
      return;
    }

    const headers = [
      "Date",
      "Description",
      "Category",
      "Type",
      "Payment Mode",
      "Amount",
    ];

    const escapeCSV = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = filteredTransactions.map((item) => [
      item.transaction_date,
      item.description,
      item.category_name,
      item.transaction_type,
      item.payment_mode,
      item.amount,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `spendwise-report-${startDate}-to-${endDate}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // Load existing monthly, category and budget reports.
  const loadAdditionalReports = useCallback(async () => {
    const token = sessionStorage.getItem("access_token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!API_BASE_URL) {
      console.error("API base URL is not configured.");
      return;
    }

    const baseUrl = API_BASE_URL.replace(/\/+$/, "");

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };

    const fetchReport = async (endpoint) => {
      const response = await fetch(`${baseUrl}/dashboard/${endpoint}`, {
        method: "GET",
        headers,
      });

      if (response.status === 401) {
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("spendwise_user");
        navigate("/login", { replace: true });
        throw new Error("Your session has expired.");
      }

      const result = await response.json();

      if (!response.ok || result?.status === "FAILED") {
        throw new Error(result?.message || `Unable to load ${endpoint}`);
      }

      return result?.data;
    };

    try {
      const [monthly, categoriesData, budgets] = await Promise.all([
        fetchReport("monthlySummary"),
        fetchReport("categoryExpenseBreakdown"),
        fetchReport("budgetUtilization"),
      ]);

      setMonthlySummary(
        Array.isArray(monthly) ? monthly : monthly ? [monthly] : []
      );

      setCategoryReport(Array.isArray(categoriesData) ? categoriesData : []);

      setBudgetReport(Array.isArray(budgets) ? budgets : []);
    } catch (err) {
      console.error("Unable to load additional reports:", err);
    }
  }, [navigate]);

  useEffect(() => {
    loadAdditionalReports();
  }, [loadAdditionalReports]);

  return (
    <div className="sw-reports">
      {/* Navigation header */}
      <header className="tx-header">
        <div className="tx-brand">
          <div className="tx-brand-icon">
            <Wallet size={22} />
          </div>
          <span>SpendWise</span>
        </div>

        <button
          type="button"
          className="tx-back-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </header>

      <main className="sw-report-content">
        <header className="sw-reports-heading">
          <div>
            <span className="sw-reports-eyebrow">FINANCIAL ANALYTICS</span>
            <h1>Reports</h1>
            <p>Explore your income, expenses, and transaction history.</p>
          </div>

          <button
            type="button"
            className="sw-report-export"
            onClick={handleExportCSV}
            disabled={loading}
          >
            <Download size={17} />
            Export CSV
          </button>
        </header>

        {/* Report filters */}
        <section className="sw-report-filters">
          <div className="sw-report-section-heading">
            <Filter size={18} />
            <h2>Filter report</h2>
          </div>

          <form onSubmit={handleApplyFilters} className="sw-report-filter-form">
            <label>
              Start date
              <input
                type="date"
                value={startDate}
                className={dateErrors.startDate ? "date-input-error" : ""}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setDateErrors((prev) => ({
                    ...prev,
                    startDate: "",
                    endDate: "",
                  }));
                }}
              />
              {dateErrors.startDate && (
                <span className="date-validation-error">
                  {dateErrors.startDate}
                </span>
              )}
            </label>

            <label>
              End date
              <input
                type="date"
                value={endDate}
                className={dateErrors.endDate ? "date-input-error" : ""}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setDateErrors((prev) => ({
                    ...prev,
                    startDate: "",
                    endDate: "",
                  }));
                }}
              />
              {dateErrors.endDate && (
                <span className="date-validation-error">
                  {dateErrors.endDate}
                </span>
              )}
            </label>

            <label>
              Transaction type
              <select
                value={transactionType}
                onChange={(event) => setTransactionType(event.target.value)}
              >
                <option value="ALL">All types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </label>

            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="ALL">All categories</option>

                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="sw-report-apply"
              disabled={loading}
            >
              <CalendarDays size={17} />
              {loading ? "Loading..." : "Apply filters"}
            </button>
          </form>
        </section>

        {error && (
          <div role="alert" className="sw-report-error">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <section className="sw-report-summary">
          <article className="sw-report-summary-card">
            <div className="sw-report-summary-icon income">
              <TrendingUp size={21} />
            </div>
            <p>Total income</p>
            <h2>{formatCurrency(totalIncome)}</h2>
            <span>For the selected period and filters</span>
          </article>

          <article className="sw-report-summary-card">
            <div className="sw-report-summary-icon expense">
              <TrendingDown size={21} />
            </div>
            <p>Total expenses</p>
            <h2>{formatCurrency(totalExpenses)}</h2>
            <span>For the selected period and filters</span>
          </article>

          <article className="sw-report-summary-card">
            <div className="sw-report-summary-icon balance">
              <Wallet size={21} />
            </div>
            <p>Net balance</p>
            <h2>{formatCurrency(netBalance)}</h2>
            <span>Income minus expenses</span>
          </article>
        </section>

        {/* 1. Monthly Income vs. Expenses */}
        <section className="sw-report-panel">
          <div className="sw-report-panel-heading">
            <div>
              <h2>Monthly Income vs. Expenses</h2>
              <p>Compare income and spending over time.</p>
            </div>
          </div>

          <div className="sw-report-chart">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyChartData}
                  onClick={() => scrollToSection("transaction-report")}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#159b78" />
                  <Bar dataKey="expenses" name="Expenses" fill="#e77770" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="sw-report-no-data">No monthly summary available.</p>
            )}
          </div>
        </section>

        {/* 2. Category-wise Expenses */}
        <section className="sw-report-panel">
          <div className="sw-report-panel-heading">
            <div>
              <h2>Category-wise Expenses</h2>
              <p>See where your money is going.</p>
            </div>
          </div>

          <div className="sw-report-category-layout">
            <div className="sw-report-pie">
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onClick={() => scrollToSection("category-details")}>
                    <Pie
                      data={categoryChartData}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      label
                    >
                      {categoryChartData.map((item, index) => (
                        <Cell
                          key={`${item.name}-${index}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="sw-report-no-data">
                  No category expenses available.
                </p>
              )}
            </div>

            <div className="sw-report-table-wrap">
              <table className="sw-report-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Transactions</th>
                    <th className="amount-column">Total expenses</th>
                  </tr>
                </thead>

                <tbody>
                  {categoryChartData.map((item, index) => (
                    <tr key={`${item.name}-${index}`}>
                      <td>{item.name}</td>
                      <td>{item.transactions}</td>
                      <td className="amount-column">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}

                  {!categoryChartData.length && (
                    <tr>
                      <td colSpan={3} className="sw-report-empty">
                        No category data found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. Budget Performance */}
        <section className="sw-report-panel">
          <div className="sw-report-panel-heading">
            <div>
              <h2>Budget Performance</h2>
              <p>Compare your budget with actual spending.</p>
            </div>
          </div>

          <div className="sw-report-table-wrap">
            <table className="sw-report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Budget</th>
                  <th>Spent</th>
                  <th>Remaining</th>
                  <th>Utilization</th>
                </tr>
              </thead>

              <tbody>
                {budgetReport.map((item, index) => {
                  const percentage = Number(item.utilization_percentage) || 0;

                  return (
                    <tr
                      key={item.budget_id ?? index}
                      id={`budget-row-${item.budget_id ?? index}`}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{item.category_name || "Uncategorized"}</td>
                      <td>{formatCurrency(item.budget_amount)}</td>
                      <td>{formatCurrency(item.actual_expenses)}</td>
                      <td>{formatCurrency(item.remaining_budget)}</td>
                      <td>
                        <div className="sw-report-budget-progress">
                          <div>
                            <span
                              style={{
                                width: `${Math.min(
                                  Math.max(percentage, 0),
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <small>{percentage.toFixed(1)}%</small>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!budgetReport.length && (
                  <tr>
                    <td colSpan={5} className="sw-report-empty">
                      No budget performance data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Transaction Report */}
        <section id="transaction-report" className="sw-report-transactions">
          <div className="sw-report-table-heading">
            <div>
              <h2>Transaction report</h2>
              <p>
                {loading
                  ? "Loading transactions..."
                  : `${filteredTransactions.length} records found`}
              </p>
            </div>

            <label className="sw-report-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search transactions..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div id="category-details" className="sw-report-table-wrap">
            <table className="sw-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Payment mode</th>
                  <th>Type</th>
                  <th className="amount-column">Amount</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="sw-report-empty">
                      Loading report data...
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((item, index) => (
                    <tr key={item.transaction_id ?? index}>
                      <td>
                        {item.transaction_date
                          ? new Date(
                              item.transaction_date.replace(" ", "T")
                            ).toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      <td>{item.description || "—"}</td>
                      <td>{item.category_name || "Uncategorized"}</td>
                      <td>{item.payment_mode || "—"}</td>

                      <td>
                        <span
                          className={`sw-report-type ${
                            String(
                              item.transaction_type || ""
                            ).toUpperCase() === "INCOME"
                              ? "income"
                              : "expense"
                          }`}
                        >
                          {item.transaction_type || "—"}
                        </span>
                      </td>

                      <td className="amount-column">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="sw-report-empty">
                      <FileBarChart size={28} />
                      <strong>No report data found</strong>
                      <span>
                        Try another date range or change your filters.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Reports;
