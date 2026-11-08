import { encryptRequest } from "./encryption";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUDIT_API = `${API_BASE_URL?.replace(/\/$/, "")}/audit-logs`;

export async function createAuditLog({
  actionCode,
  tableName,
  recordId = null,
  oldValue = null,
  newValue = null,
  description,
}) {
  const token = sessionStorage.getItem("access_token");

  if (!token) {
    throw new Error("Authentication token is missing.");
  }

  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is missing from client/.env.");
  }

  const encrypted = await encryptRequest({
    data: {
      action: "CreateAuditLog",
      audit_log_id: null,
      user_id: null,
      action_code: actionCode,
      table_name: tableName,
      record_id: recordId,
      old_value: oldValue,
      new_value: newValue,
      ip_address: null,
      description,
    },
  });

  const response = await fetch(`${AUDIT_API}/manageAuditLog`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(encrypted),
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("spendwise_user");
    window.location.assign("/login");
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok || result.status === "FAILED") {
    throw new Error(
      result.detail ||
        result.message ||
        `Audit log request failed with status ${response.status}.`
    );
  }

  return result;
}
