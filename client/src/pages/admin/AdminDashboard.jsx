import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  LayoutDashboard,
  Users,
  UserRound,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserX,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  FileText,
  Tags,
  ClipboardList,
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
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function AdminDashboard() {
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  let user = {};

  try {
    user = JSON.parse(sessionStorage.getItem("spendwise_user") || "{}");
  } catch {
    user = {};
  }

  const userName = user.user_name || "Admin";

  useEffect(() => {
    async function fetchAdminAnalytics() {
      try {
        setLoading(true);
        setError("");

        const token = sessionStorage.getItem("access_token");

        if (!token) {
          navigate("/login", { replace: true });
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/dashboard/adminAnalytics`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
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
          throw new Error(result.message || "Failed to load admin analytics.");
        }

        setAnalytics(result.data);
      } catch (err) {
        setError(err.message || "Unable to load dashboard analytics.");
      } finally {
        setLoading(false);
      }
    }

    fetchAdminAnalytics();
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const formatNumber = (number) =>
    new Intl.NumberFormat("en-IN").format(Number(number || 0));

  const users = analytics?.users || {};
  const transactions = analytics?.transactions || {};
  const monthly = analytics?.monthly || [];

  const statCards = [
    {
      title: "Total Users",
      value: users.total,
      icon: Users,
      description: "All registered users",
      color: "#2563eb",
    },
    {
      title: "Active Users",
      value: users.active,
      icon: UserCheck,
      description: "Currently active accounts",
      color: "#16a34a",
    },
    {
      title: "Inactive Users",
      value: users.inactive,
      icon: UserX,
      description: "Deactivated accounts",
      color: "#dc2626",
    },
    {
      title: "Total Transactions",
      value: transactions.total,
      icon: ReceiptText,
      description: "All recorded transactions",
      color: "#7c3aed",
    },
    {
      title: "Total Income",
      value: formatCurrency(transactions.income),
      icon: TrendingUp,
      description: "Income from active transactions",
      color: "#059669",
    },
    {
      title: "Total Expenses",
      value: formatCurrency(transactions.expenses),
      icon: TrendingDown,
      description: "Expenses from active transactions",
      color: "#ea580c",
    },
  ];

  const cardStyle = {
    padding: "22px",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
    minWidth: 0,
  };

  return (
    <div
      style={{
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <h1 style={{ margin: 0, color: "#111827" }}>
          <Wallet
            size={28}
            style={{ verticalAlign: "middle", marginRight: "8px" }}
          />
          SpendWise Admin
        </h1>

        {/* Header Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {/* My Profile */}
          <button
            type="button"
            onClick={() => navigate("/admin/profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <UserRound size={16} />
            My Profile
          </button>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <section style={{ marginTop: "40px" }}>
        <p style={{ color: "#64748b", fontWeight: 600 }}>
          <ShieldCheck
            size={18}
            style={{ verticalAlign: "middle", marginRight: "6px" }}
          />
          ADMIN WORKSPACE
        </p>

        <h2 style={{ color: "#111827" }}>Welcome, {userName}!</h2>

        <p style={{ color: "#64748b" }}>
          Manage SpendWise users and monitor application performance from one
          place.
        </p>
      </section>

      <section style={{ marginTop: "32px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <h2 style={{ margin: 0, color: "#111827" }}>
            <LayoutDashboard
              size={22}
              style={{ verticalAlign: "middle", marginRight: "8px" }}
            />
            Admin Overview
          </h2>

          <button
            onClick={() => window.location.reload()}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 14px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              background: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {loading && (
          <p style={{ color: "#64748b" }}>Loading dashboard analytics...</p>
        )}

        {!loading && error && (
          <div
            role="alert"
            style={{
              padding: "16px",
              marginBottom: "20px",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              background: "#fef2f2",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && analytics && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              {statCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article key={card.title} style={cardStyle}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                    >
                      <span style={{ color: "#64748b", fontSize: "14px" }}>
                        {card.title}
                      </span>

                      <Icon size={25} color={card.color} />
                    </div>

                    <h3
                      style={{
                        fontSize: "26px",
                        margin: "16px 0 8px",
                        color: "#111827",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {card.value === undefined
                        ? "—"
                        : typeof card.value === "number"
                        ? formatNumber(card.value)
                        : card.value}
                    </h3>

                    <p
                      style={{
                        margin: 0,
                        color: "#64748b",
                        fontSize: "13px",
                      }}
                    >
                      {card.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <article
              style={{
                ...cardStyle,
                marginTop: "24px",
                padding: "24px",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#111827" }}>
                Monthly Income vs Expenses
              </h3>

              <p style={{ color: "#64748b", fontSize: "14px" }}>
                Monthly totals for the available reporting period.
              </p>

              {monthly.length > 0 ? (
                <div style={{ width: "100%", height: "340px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={monthly}
                      margin={{
                        top: 15,
                        right: 20,
                        left: 15,
                        bottom: 10,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month_label" />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("en-IN", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(value)
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          formatCurrency(value),
                          name,
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="total_income"
                        name="Income"
                        fill="#16a34a"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="total_expenses"
                        name="Expenses"
                        fill="#ea580c"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ color: "#64748b" }}>
                  No monthly transaction data is available for this period.
                </p>
              )}
            </article>
          </>
        )}
      </section>

      <section
        style={{
          marginTop: "28px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        {/* User Management */}
        <article style={cardStyle}>
          <Users size={28} color="#2563eb" />

          <h3>User Management</h3>

          <p style={{ color: "#64748b" }}>
            View registered users, check account status, and activate or
            deactivate accounts.
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <UserRound size={16} />
            Manage Users
          </button>
        </article>

        {/* Reports */}
        <article style={cardStyle}>
          <FileText size={28} color="#2563eb" />

          <h3>Reports</h3>

          <p style={{ color: "#64748b" }}>
            View transactions, monthly summaries, category expenses, and budget
            utilization.
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin/reports")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <FileText size={16} />
            View Reports
          </button>
        </article>

        {/* Audit Logs */}
        <article style={cardStyle}>
          <ClipboardList size={28} color="#2563eb" />

          <h3>Audit Logs</h3>

          <p style={{ color: "#64748b" }}>
            Review user activity, data changes, and recorded application events.
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin/audit-logs")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <ClipboardList size={16} />
            View Audit Logs
          </button>
        </article>

        {/* Categories */}
        <article style={cardStyle}>
          <Tags size={28} color="#2563eb" />

          <h3>Categories</h3>

          <p style={{ color: "#64748b" }}>
            Manage default categories available to SpendWise users. Create,
            update, activate, or deactivate categories.
          </p>

          <button
            type="button"
            onClick={() => navigate("/admin/categories")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              border: "none",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <Tags size={16} />
            Manage Categories
          </button>
        </article>
      </section>
    </div>
  );
}

export default AdminDashboard;
