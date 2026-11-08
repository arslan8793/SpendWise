import api from "./api";
import { encryptRequest } from "../utils/encryption";

export async function loginUser(email, password) {
  const encryptedPayload = await encryptRequest({
    data: {
      email,
      password,
    },
  });

  const response = await api.post("/auth/login", encryptedPayload);

  return response.data;
}

export async function registerUser(userName, email, password) {
  const encryptedPayload = await encryptRequest({
    data: {
      action: "RegisterUser",
      user_name: userName,
      email,
      password,
    },
  });

  const response = await api.post("/users/register", encryptedPayload);

  return response.data;
}

// forgetpassword
export async function resetPassword(email, newPassword) {
  const encryptedPayload = await encryptRequest({
    data: {
      action: "ResetPassword",
      email,
      new_password: newPassword,
    },
  });

  const response = await api.post("/users/forgot-password", encryptedPayload);

  return response.data;
}
