const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000";

function getToken() {

    if (typeof window === "undefined") {
        return null;
    }

    return localStorage.getItem("token");

}

async function request(endpoint, options = {}) {

    const token = getToken();

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

    if (response.status === 401) {

        localStorage.removeItem("token");

        if (
            typeof window !== "undefined" &&
            !window.location.pathname.startsWith("/login")
        ) {

            window.location.href = "/login";

        }

        throw new Error("Sesja wygasła.");

    }

    const contentType =
        response.headers.get("content-type") || "";

    const data =
        contentType.includes("application/json")
            ? await response.json()
            : null;

    if (!response.ok) {

        throw new Error(
            data?.error ||
            `Błąd serwera (${response.status}).`
        );

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