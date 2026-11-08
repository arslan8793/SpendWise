import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  RefreshCw,
  Search,
  ShieldCheck,
  Eye,
  X,
} from "lucide-react";
import { encryptRequest } from "../../utils/encryption";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUDIT_API = `${API_BASE_URL?.replace(/\/$/, "")}/audit-logs`;

function AdminAudit() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [pageSize, setPageSize] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");

    const token = sessionStorage.getItem("access_token");

    if (!token) {
      handleUnauthorized();
      setLoading(false);
      return;
    }

    if (!API_BASE_URL) {
      setError("VITE_API_BASE_URL is missing from client/.env.");
      setLoading(false);
      return;
    }

    try {
      // Encrypt only the action, following the existing GET API pattern.
      const encrypted = await encryptRequest({
        data: { action: "GetAuditLog" },
      });

      // Send encrypted values as query parameters.
      const url = new URL(`${AUDIT_API}/getAuditLog`);
      url.searchParams.set("nonce", encrypted.nonce);
      url.searchParams.set("ciphertext", encrypted.ciphertext);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (response.status === 403) {
        throw new Error("You do not have permission to view audit logs.");
      }

      if (!response.ok || result.status === "FAILED") {
        throw new Error(
          result.detail ||
            result.message ||
            `Request failed with status ${response.status}.`
        );
      }

      setLogs(Array.isArray(result.data) ? result.data : []);
      setMessage(result.message || "Audit logs retrieved successfully.");
    } catch (err) {
      setError(err.message || "Unable to retrieve audit logs.");
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const getValue = (row, lower, upper) => row?.[lower] ?? row?.[upper] ?? null;

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      const action = String(getValue(log, "action_code", "ACTION_CODE") ?? "");
      const table = String(getValue(log, "table_name", "TABLE_NAME") ?? "");

      const matchesSearch =
        !term ||
        [
          getValue(log, "audit_log_id", "AUDIT_LOG_ID"),
          getValue(log, "user_id", "USER_ID"),
          action,
          table,
          getValue(log, "record_id", "RECORD_ID"),
          getValue(log, "description", "DESCRIPTION"),
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term)
        );

      const matchesAction = !actionFilter || action === actionFilter;

      const matchesTable = !tableFilter || table === tableFilter;

      return matchesSearch && matchesAction && matchesTable;
    });
  }, [logs, search, actionFilter, tableFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  const startIndex = (currentPage - 1) * pageSize;

  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, actionFilter, tableFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const actions = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => getValue(log, "action_code", "ACTION_CODE"))
            .filter(Boolean)
        ),
      ].sort(),
    [logs]
  );

  const tables = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => getValue(log, "table_name", "TABLE_NAME"))
            .filter(Boolean)
        ),
      ].sort(),
    [logs]
  );

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString("en-IN");
  };

  const formatJson = (value) => {
    if (value == null || value === "") return "—";

    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }

    return JSON.stringify(value, null, 2);
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "18px",
  };

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "9px 13px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "28px",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 8px" }}>
            <ClipboardList
              size={27}
              style={{ verticalAlign: "middle", marginRight: "9px" }}
            />
            Audit Logs
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            Review recorded activity across SpendWise.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft size={16} />
            Admin Dashboard
          </button>

          <button
            type="button"
            style={buttonStyle}
            onClick={fetchAuditLogs}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <section
        style={{
          ...cardStyle,
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <ShieldCheck size={30} color="#2563eb" />
        <div>
          <div style={{ color: "#64748b", fontSize: "14px" }}>
            Matching audit records
          </div>
          <strong style={{ fontSize: "25px" }}>{filteredLogs.length}</strong>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            ...cardStyle,
            marginBottom: "18px",
            borderColor: "#fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
          }}
        >
          {error}
        </div>
      )}

      {message && !error && !loading && (
        <p role="status" style={{ color: "#166534" }}>
          {message}
        </p>
      )}

      <section style={cardStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>
              Search logs
            </span>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "12px",
                  color: "#64748b",
                }}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ID, user, action, table..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 10px 10px 34px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                }}
              />
            </div>
          </label>

          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>
              Action
            </span>
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "#fff",
              }}
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>Table</span>
            <select
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "#fff",
              }}
            >
              <option value="">All tables</option>
              {tables.map((table) => (
                <option key={table} value={table}>
                  {table}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading audit logs...</p>
        ) : filteredLogs.length === 0 ? (
          <p style={{ color: "#64748b" }}>No audit logs match your filters.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  {[
                    "Audit ID",
                    "User ID",
                    "Action",
                    "Table",
                    "Record ID",
                    "Description",
                    "Created Date",
                    "Details",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #e5e7eb",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginatedLogs.map((log, index) => {
                  const id = getValue(log, "audit_log_id", "AUDIT_LOG_ID");

                  return (
                    <tr
                      key={id ?? index}
                      style={{ borderBottom: "1px solid #e5e7eb" }}
                    >
                      <td style={{ padding: "12px" }}>{id ?? "—"}</td>
                      <td style={{ padding: "12px" }}>
                        {getValue(log, "user_id", "USER_ID") ?? "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {getValue(log, "action_code", "ACTION_CODE") ?? "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {getValue(log, "table_name", "TABLE_NAME") ?? "—"}
                      </td>
                      <td style={{ padding: "12px" }}>
                        {getValue(log, "record_id", "RECORD_ID") ?? "—"}
                      </td>
                      <td style={{ padding: "12px", minWidth: "180px" }}>
                        {getValue(log, "description", "DESCRIPTION") ?? "—"}
                      </td>
                      <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                        {formatDate(
                          getValue(log, "created_date", "CREATED_DATE")
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <button
                          type="button"
                          style={buttonStyle}
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={15} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <label htmlFor="audit-page-size">Rows per page:</label>

            <select
              id="audit-page-size"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              style={{
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                background: "#fff",
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          <span>
            {filteredLogs.length === 0
              ? "0 records"
              : `${startIndex + 1}–${Math.min(
                  startIndex + pageSize,
                  filteredLogs.length
                )} of ${filteredLogs.length}`}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              style={buttonStyle}
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
              style={buttonStyle}
              onClick={() => setCurrentPage((page) => page + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedLog(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px",
          }}
        >
          <section
            style={{
              width: "min(700px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              boxSizing: "border-box",
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <h2 id="audit-detail-title">Audit Record Details</h2>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => setSelectedLog(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </header>

            {[
              ["Audit ID", "audit_log_id", "AUDIT_LOG_ID"],
              ["User ID", "user_id", "USER_ID"],
              ["Action", "action_code", "ACTION_CODE"],
              ["Table", "table_name", "TABLE_NAME"],
              ["Record ID", "record_id", "RECORD_ID"],
              ["Description", "description", "DESCRIPTION"],
              ["Created Date", "created_date", "CREATED_DATE"],
            ].map(([label, lower, upper]) => (
              <p key={label}>
                <strong>{label}:</strong>{" "}
                {label === "Created Date"
                  ? formatDate(getValue(selectedLog, lower, upper))
                  : getValue(selectedLog, lower, upper) ?? "—"}
              </p>
            ))}

            <h3>Old Value</h3>
            <pre
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#f8fafc",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {formatJson(getValue(selectedLog, "old_value", "OLD_VALUE"))}
            </pre>

            <h3>New Value</h3>
            <pre
              style={{
                padding: "12px",
                borderRadius: "8px",
                background: "#f8fafc",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {formatJson(getValue(selectedLog, "new_value", "NEW_VALUE"))}
            </pre>
          </section>
        </div>
      )}
    </main>
  );
}

export default AdminAudit;
