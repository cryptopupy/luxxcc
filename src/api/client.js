async function apiRequest(path, options = {}) {
  const baseUrl = import.meta.env.VITE_API_URL || "";
  const response = await fetch(`${baseUrl}/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => apiRequest(path),
  post: (path, body) =>
    apiRequest(path, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),
  put: (path, body) =>
    apiRequest(path, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    }),
  delete: (path) =>
    apiRequest(path, {
      method: "DELETE",
    }),
};
