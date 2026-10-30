// Requests stay on the frontend origin; Next.js proxies /api to API_PROXY_TARGET.
// Ignore legacy NEXT_PUBLIC_API_URL to avoid cross-origin browser requests.
const API_URL = "";

function getToken() {
    if (typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem("token");
}

async function request(endpoint, options = {}) {
    // A failed login is not an expired authenticated session.
    const isCredentialRequest = endpoint === "/api/auth/login" || endpoint === "/api/auth/register";
    const token = isCredentialRequest ? null : getToken();

    const headers = {
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const contentType =
        response.headers.get("content-type") || "";

    // Preserve HTTP status handling when an upstream proxy returns invalid JSON.
    // A 2xx HTML page or broken JSON must never look like a successful empty result.
    let data = null;
    let invalidResponse = false;
    if (contentType.includes("application/json")) {
        try {
            data = await response.json();
        } catch {
            invalidResponse = true;
        }
    } else if (response.status !== 204 && response.status !== 205) {
        invalidResponse = true;
    }

    if (response.status === 401 && !isCredentialRequest) {
        if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            if (!window.location.pathname.startsWith("/login")) {
                window.location.href = "/login";
            }
        }
        throw new Error("Sesja wygasła.");
    }

    if (!response.ok) {
        throw new Error(
            data?.error ||
            `Błąd serwera (${response.status}).`
        );
    }

    if (invalidResponse) {
        throw new Error("Nieprawidłowa odpowiedź serwera.");
    }

    // Some upstream endpoints report an application failure with HTTP 200.
    // Never present that response as a completed agent action.
    if (data?.success === false) {
        throw new Error(data.error || data.message || "Operacja nie powiodła się.");
    }

    return data;
}

export async function register(email, password) {
    return request("/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    });
}

export async function login(email, password) {
    return request("/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            password
        })
    });
}

export async function getProfile() {
    return request("/api/auth/me");
}

export async function changePassword(
    currentPassword,
    newPassword
) {
    return request("/api/auth/password", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            currentPassword,
            newPassword
        })
    });
}

export async function uploadDocument(formData) {
    return request("/api/document", {
        method: "POST",
        body: formData
    });
}

export async function uploadMeeting(formData) {
    return request("/api/meeting", {
        method: "POST",
        body: formData
    });
}

export async function getHistory() {
    return request("/api/history");
}

export async function getHistoryItem(id) {
    return request(`/api/history/${id}`);
}

export async function deleteHistoryItem(id) {
    return request(`/api/history/${id}`, {
        method: "DELETE"
    });
}

export async function getTasks() {
    return request("/api/tasks");
}

export async function createTask(task) {
    return request("/api/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(task)
    });
}

export async function updateTask(id, task) {
    return request(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(task)
    });
}

export async function completeTask(id) {
    return request(`/api/tasks/${id}/complete`, {
        method: "PATCH"
    });
}

export async function deleteTask(id) {
    return request(`/api/tasks/${id}`, {
        method: "DELETE"
    });
}

export async function getExecutiveDashboard() {
    return request("/api/executive/dashboard");
}

export async function sendChatMessage(
    message,
    conversationId = null
) {
    return request("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message,
            conversationId
        })
    });
}

export async function getConversations() {
    return request("/api/chat");
}

export async function getConversation(id) {
    return request(`/api/chat/${id}`);
}

export async function deleteConversation(id) {
    return request(`/api/chat/${id}`, {
        method: "DELETE"
    });
}

export async function getMemories() {
    return request("/api/memory");
}

export async function getMemory(id) {
    return request(`/api/memory/${id}`);
}

export async function createMemory(memory) {
    return request("/api/memory", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(memory)
    });
}

export async function updateMemory(id, memory) {
    return request(`/api/memory/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(memory)
    });
}

export async function archiveMemory(id) {
    return request(`/api/memory/${id}`, {
        method: "DELETE"
    });
}

export async function getSettings() {
    return request("/api/settings");
}

export async function updateSettings(settings) {
    return request("/api/settings", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
    });
}

export async function getAgents() {
    return request("/api/agents");
}

export async function runAgent(id) {
    return request(`/api/agents/${id}/run`, {
        method: "POST"
    });
}

export async function setAgentEnabled(id, enabled) {
    return request(`/api/agents/${id}/enabled`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled })
    });
}

export async function getIntegrations() {
    return request("/api/agents/integrations/list");
}

export async function setIntegrationEnabled(id, enabled) {
    return request(`/api/agents/integrations/${id}/enabled`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled })
    });
}

export async function getFinancialDocuments(params = {}) {
    const query = new URLSearchParams();

    if (params.status) {
        query.set("status", params.status);
    }

    if (params.source) {
        query.set("source", params.source);
    }

    if (params.limit) {
        query.set("limit", String(params.limit));
    }

    if (params.offset !== undefined && params.offset !== null) {
        query.set("offset", String(params.offset));
    }

    const suffix = query.toString()
        ? `?${query.toString()}`
        : "";

    return request(`/api/finance/documents${suffix}`);
}

export async function getFinanceSummary() {
    return request("/api/finance/summary");
}
