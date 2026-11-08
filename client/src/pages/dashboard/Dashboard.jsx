// import { useNavigate } from "react-router-dom";
// import { Wallet, LogOut } from "lucide-react";

// function Dashboard() {
//   const navigate = useNavigate();

//   const user = JSON.parse(sessionStorage.getItem("spendwise_user") || "{}");

//   function handleLogout() {
//     sessionStorage.removeItem("access_token");
//     sessionStorage.removeItem("spendwise_user");
//     navigate("/login", { replace: true });
//   }

//   return (
//     <main style={{ padding: "32px" }}>
//       <header
//         style={{
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "space-between",
//           gap: "16px",
//         }}
//       >
//         <h1>
//           <Wallet size={24} style={{ verticalAlign: "middle" }} /> SpendWise
//         </h1>

//         <button onClick={handleLogout}>
//           <LogOut size={16} /> Sign out
//         </button>
//       </header>

//       <h2>Welcome, {user.user_name || "User"}!</h2>
//       <p>You have successfully logged in to SpendWise.</p>
//       <p>Email: {user.email || "Not available"}</p>
//       <p>Role: {user.role_code || "Not available"}</p>
//     </main>
//   );
// }

// export default Dashboard;
import { useCallback, useEffect, useState } from "react";
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
  Bell,
  Search,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ShoppingCart,
  BriefcaseBusiness,
  Zap,
  CarFront,
  Coffee,
  RefreshCw,
  CircleAlert,
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

import "./Dashboard.css";

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

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatShortCurrency(value) {
  const amount = Number(value) || 0;

  if (Math.abs(amount) >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  if (Math.abs(amount) >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}k`;
  }

  return formatCurrency(amount);
}

function getRecords(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (response?.data && typeof response.data === "object") {
    return [response.data];
  }
  return [];
}

function getSummary(response) {
  if (response?.data && !Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response?.data)) {
    return response.data[0] || {};
  }

  return {};
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

/*
 * Encrypts requests using the same AES-GCM request-key convention
 * as the existing SpendWise frontend.
 *
 * Expected encrypted request body:
 * { nonce: "...", ciphertext: "..." }
 */
function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function encryptRequest(payload) {
  const rawKey = import.meta.env.VITE_REQUEST_AES_KEY;

  if (!rawKey) {
    throw new Error("VITE_REQUEST_AES_KEY is not configured in client/.env");
  }

  const keyBytes = new TextEncoder().encode(rawKey);

  if (![16, 24, 32].includes(keyBytes.length)) {
    throw new Error("VITE_REQUEST_AES_KEY must be 16, 24, or 32 UTF-8 bytes.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const nonce = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );

  return {
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

async function apiRequest(path, { method = "GET", params, body } = {}) {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured in client/.env");
  }

  const token = sessionStorage.getItem("access_token");

  if (!token) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const url = new URL(
    `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  );

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const options = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    window.location.replace("/login");
    throw new Error("Your session expired. Please sign in again.");
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `The server returned an invalid response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      result?.message || `Request failed with status ${response.status}.`
    );
  }

  if (result?.status === "FAILED") {
    throw new Error(result.message || "The API request failed.");
  }

  return result;
}

function SummaryCard({ label, value, icon: Icon, color, description }) {
  return (
    <article className="sw-summary-card">
      <div className="sw-summary-top">
        <div className={`sw-summary-icon ${color}`}>
          <Icon size={21} />
        </div>
      </div>

      <p className="sw-card-label">{label}</p>
      <h2>{formatCurrency(value)}</h2>
      <p className="sw-card-description">{description}</p>
    </article>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState("month");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [budgetData, setBudgetData] = useState([]);
  const [transactionData, setTransactionData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  let user = {};

  try {
    user = JSON.parse(sessionStorage.getItem("spendwise_user") || "{}");
  } catch {
    user = {};
  }

  const userName = user.user_name || "User";
  const firstName = userName.trim().split(/\s+/)[0] || "User";

  const selectedDate = new Date();
  if (period === "lastMonth") {
    selectedDate.setMonth(selectedDate.getMonth() - 1);
  }

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * These use the existing dashboard endpoints.
       */
      const encryptedCategoryBody = await encryptRequest({
        data: { year, month },
      });

      const [
        summaryResponse,
        categoryResponse,
        budgetResponse,
        transactionResponse,
      ] = await Promise.all([
        apiRequest("/dashboard/monthlySummary", {
          params: { year, month },
        }),
        apiRequest("/dashboard/categoryExpenseBreakdown", {
          params: { year, month },
        }),
        apiRequest("/dashboard/budgetUtilization", {
          params: { year, month },
        }),
        apiRequest("/dashboard/transactionReport", {
          params: { year, month },
        }),
      ]);

      setSummary(getSummary(summaryResponse));
      setCategoryData(getRecords(categoryResponse));
      setBudgetData(getRecords(budgetResponse));
      setTransactionData(getRecords(transactionResponse));
    } catch (err) {
      setError(err.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, [year, month, refreshKey]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleLogout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }

  function handleNavigation(path) {
    setSidebarOpen(false);

    if (path === "/dashboard") {
      navigate(path);
      return;
    }

    // Other pages will be implemented separately.
    navigate(path);
  }

  const filteredTransactions = transactionData.filter((item) => {
    const searchable = [
      item.description,
      item.category_name,
      item.transaction_type,
      item.payment_mode,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchable.includes(search.toLowerCase());
  });

  const totalIncome = Number(summary?.total_income) || 0;
  const totalExpenses = Number(summary?.total_expenses) || 0;
  const netBalance =
    summary?.net_balance !== undefined && summary?.net_balance !== null
      ? Number(summary.net_balance)
      : totalIncome - totalExpenses;

  const chartCategories = categoryData.map((item) => ({
    name: item.category_name || "Uncategorized",
    amount: Number(item.total_expenses) || 0,
    transactions: Number(item.transaction_count) || 0,
  }));

  const chartBudgets = budgetData.map((item) => ({
    ...item,
    budget_amount: Number(item.budget_amount) || 0,
    actual_expenses: Number(item.actual_expenses) || 0,
    remaining_budget: Number(item.remaining_budget) || 0,
    utilization_percentage: Number(item.utilization_percentage) || 0,
  }));

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
                className={`sw-nav-link ${
                  path === "/dashboard" ? "active" : ""
                }`}
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
                className="sw-nav-link"
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
              <span>Workspace</span>
              <span>/</span>
              <strong>Dashboard</strong>
            </div>
          </div>

          <div className="sw-topbar-right">
            <label className="sw-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search transactions..."
                aria-label="Search transactions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="sw-profile">
              <div className="sw-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="sw-profile-text">
                <strong>{userName}</strong>
                <span>{user.role_code || "USER"}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="sw-content">
          <section className="sw-page-heading">
            <div>
              <div className="sw-eyebrow">YOUR FINANCIAL OVERVIEW</div>
              <h1>Welcome back, {firstName} 👋</h1>
              <p>Here's what's happening with your money.</p>
            </div>

            <label className="sw-period-select">
              <CalendarDays size={17} />
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Select reporting period"
              >
                <option value="month">This month</option>
                <option value="lastMonth">Last month</option>
              </select>
            </label>
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

          {loading && (
            <div className="sw-loading" role="status">
              <span className="sw-spinner" />
              Loading your financial data…
            </div>
          )}

          <section className="sw-summary-grid" aria-label="Financial summary">
            <SummaryCard
              label="Net Balance"
              value={netBalance}
              icon={Wallet}
              color="green"
              description="Income minus expenses"
            />
            <SummaryCard
              label="Total Income"
              value={totalIncome}
              icon={TrendingUp}
              color="blue"
              description="Income for selected period"
            />
            <SummaryCard
              label="Total Expenses"
              value={totalExpenses}
              icon={TrendingDown}
              color="red"
              description="Expenses for selected period"
            />
            <SummaryCard
              label="Budget Remaining"
              value={chartBudgets.reduce(
                (sum, item) => sum + item.remaining_budget,
                0
              )}
              icon={PiggyBank}
              color="purple"
              description="Remaining across returned budgets"
            />
          </section>

          <section className="sw-analytics-grid">
            <article className="sw-panel">
              <div className="sw-panel-heading">
                <div>
                  <h2>Income vs. expenses</h2>
                  <p>
                    Financial summary for{" "}
                    {selectedDate.toLocaleDateString("en-IN", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className="sw-refresh-button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  title="Refresh dashboard"
                  aria-label="Refresh dashboard"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="sw-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: "Selected period",
                        income: totalIncome,
                        expenses: totalExpenses,
                      },
                    ]}
                    margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e9eef2"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#7d8b97", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={62}
                      tickFormatter={formatShortCurrency}
                      tick={{ fill: "#7d8b97", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#159b78"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={64}
                    />
                    <Bar
                      dataKey="expenses"
                      name="Expenses"
                      fill="#ef716a"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={64}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="sw-panel">
              <div className="sw-panel-heading">
                <div>
                  <h2>Spending by category</h2>
                  <p>Expense distribution for the selected month</p>
                </div>
              </div>

              {chartCategories.length > 0 ? (
                <div className="sw-category-content">
                  <div className="sw-donut-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartCategories}
                          dataKey="amount"
                          nameKey="name"
                          innerRadius="65%"
                          outerRadius="95%"
                          paddingAngle={2}
                        >
                          {chartCategories.map((item, index) => (
                            <Cell
                              key={`${item.name}-${index}`}
                              fill={
                                CATEGORY_COLORS[index % CATEGORY_COLORS.length]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="sw-category-legend">
                    {chartCategories.map((item, index) => (
                      <div
                        className="sw-category-row"
                        key={`${item.name}-${index}`}
                      >
                        <i
                          className="sw-legend-dot"
                          style={{
                            background:
                              CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                          }}
                        />
                        <span title={item.name}>{item.name}</span>
                        <strong>{formatShortCurrency(item.amount)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sw-empty-panel">
                  No category expense data for this period.
                </div>
              )}
            </article>
          </section>

          <section className="sw-bottom-grid">
            <article className="sw-panel sw-transactions-panel">
              <div className="sw-panel-heading">
                <div>
                  <h2>Recent transactions</h2>
                  <p>Your latest financial activity</p>
                </div>
                <span className="sw-result-count">
                  {filteredTransactions.length} records
                </span>
              </div>

              <div className="sw-table-wrap">
                <table className="sw-transactions-table">
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Date</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((item, index) => {
                      const isIncome =
                        String(item.transaction_type || "").toLowerCase() ===
                        "income";
                      const Icon = isIncome
                        ? BriefcaseBusiness
                        : [ShoppingCart, Zap, CarFront, Coffee][index % 4];

                      return (
                        <tr key={item.transaction_id ?? index}>
                          <td>
                            <div className="sw-transaction-name">
                              <div
                                className={`sw-transaction-icon ${
                                  isIncome ? "green" : "blue"
                                }`}
                              >
                                <Icon size={17} />
                              </div>
                              <div>
                                <strong>
                                  {item.description ||
                                    item.category_name ||
                                    "Transaction"}
                                </strong>
                                <span>
                                  {item.category_name ||
                                    item.transaction_type ||
                                    "—"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="sw-transaction-date">
                            {formatDate(item.transaction_date)}
                          </td>
                          <td
                            className={`sw-transaction-amount ${
                              isIncome ? "positive" : ""
                            }`}
                          >
                            {isIncome ? "+" : "−"} {formatCurrency(item.amount)}
                          </td>
                        </tr>
                      );
                    })}

                    {!loading && filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="sw-empty-state">
                          {search
                            ? "No transactions match your search."
                            : "No transactions found for this period."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="sw-panel sw-budgets-panel">
              <div className="sw-panel-heading">
                <div>
                  <h2>Budget overview</h2>
                  <p>Track your spending against budgets</p>
                </div>
              </div>

              {chartBudgets.length > 0 ? (
                <div className="sw-budget-list">
                  {chartBudgets.map((item, index) => {
                    const percentage = Math.max(
                      0,
                      Math.min(100, item.utilization_percentage)
                    );

                    return (
                      <div
                        className="sw-budget-item"
                        key={item.budget_id ?? index}
                      >
                        <div className="sw-budget-top">
                          <strong>{item.category_name || "Budget"}</strong>
                          <span>{percentage.toFixed(0)}%</span>
                        </div>
                        <div className="sw-budget-values">
                          <span>{formatCurrency(item.actual_expenses)}</span>
                          <span>of {formatCurrency(item.budget_amount)}</span>
                        </div>
                        <div
                          className="sw-budget-track"
                          role="progressbar"
                          aria-label={`${
                            item.category_name || "Budget"
                          } utilization`}
                          aria-valuenow={percentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span
                            className={percentage >= 100 ? "over-budget" : ""}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        {item.remaining_budget < 0 && (
                          <p className="sw-over-budget-message">
                            Over budget by{" "}
                            {formatCurrency(Math.abs(item.remaining_budget))}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="sw-empty-panel">
                  No budgets found for this period.
                </div>
              )}
            </article>
          </section>

          <footer className="sw-footer">
            <span>© {new Date().getFullYear()} SpendWise</span>
            <span>Take control of your finances.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
