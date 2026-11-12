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
    const isCredentialRequest = ["/api/auth/login", "/api/auth/register", "/api/organizations/register"].includes(endpoint);
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
    const isJsonContentType = /^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType.trim());
    if (isJsonContentType && response.status !== 204 && response.status !== 205) {
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
        const error = new Error("Sesja wygasła.");
        error.status = 401;
        throw error;
    }

    if (!response.ok) {
        const error = new Error(
            data?.error || data?.detail || data?.message || data?.title ||
            `Błąd serwera (${response.status}).`
        );
        error.status = response.status;
        throw error;
    }

    // A successful API response must contain a JSON object or array, except for
    // explicit no-content responses. JSON null and primitives are not API payloads.
    if (response.status !== 204 && response.status !== 205 &&
        (data === null || typeof data !== "object")) {
        invalidResponse = true;
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

export async function getFinancialDocument(id) {
    if (typeof id !== "string" || !id.trim()) throw new Error("Nieprawidłowy identyfikator faktury.");
    return request("/api/finance/documents/" + encodeURIComponent(id));
}

export async function getFinanceProjects() {
    return request("/api/finance/projects");
}

export async function createFinanceProject(project) {
    return request("/api/finance/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
    });
}

export async function assignFinanceProject(id, projectId) {
    return request("/api/finance/documents/" + encodeURIComponent(id) + "/project", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
    });
}

export async function queueKsefHistoryImport() {
    return request("/api/finance/history/import", { method: "POST" });
}

export async function getFinanceSummary() {
    return request("/api/finance/summary");
}

export async function getOrganizations() {
    return request("/api/organizations");
}

export async function createOrganization(organization) {
    return request("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(organization)
    });
}

export async function registerOrganization(company) {
    return request("/api/organizations/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company)
    });
}

export async function getAgentAssignments(key) {
  return request("/api/agents/workspace/" + encodeURIComponent(key) + "/assignments");
}
export async function createAgentAssignment(key,payload) {
  return request("/api/agents/workspace/" + encodeURIComponent(key) + "/assignments",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
}
export async function setAgentAssignmentStage(key,id,stage) {
  return request("/api/agents/workspace/" + encodeURIComponent(key) +
    "/assignments/" + encodeURIComponent(id) + "/stage",{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({stage})
    });
}

export async function getFinancePeriodReport(year) {
  return request("/api/finance/reports/periods?year="+encodeURIComponent(year));
}
export async function classifyFinanceExpense(id,payload) {
  return request("/api/finance/documents/"+encodeURIComponent(id)+"/accounting",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
}

export async function replyToAgentAssignment(key,id,message) {
  return request("/api/agents/workspace/"+encodeURIComponent(key)+"/assignments/"+
    encodeURIComponent(id)+"/replies",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message})
    });
}

export async function getOrganization(id) {
  return request("/api/organizations/"+encodeURIComponent(id));
}
export async function updateOrganizationBrand(id,payload) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/branding",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
}
export async function requestOrganizationDomain(id,hostname) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/domains",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({hostname})
  });
}
export async function getOrganizationDomainInstructions(id,domainId) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/domains/"+encodeURIComponent(domainId));
}
export async function verifyOrganizationDomain(id,domainId) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/domains/"+
    encodeURIComponent(domainId)+"/verify",{method:"POST"});
}
export async function getOrganizationMembers(id) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/members");
}
export async function inviteOrganizationMember(id,payload) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/invitations",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
}
export async function getOrganizationInvitations() {
  return request("/api/organizations/invitations");
}
export async function acceptOrganizationInvitation(id) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/invitations/accept",
    {method:"POST"});
}
export async function revokeOrganizationMember(id,membershipId) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/members/"+
    encodeURIComponent(membershipId),{method:"DELETE"});
}
export async function getOrganizationWorkspace(id) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/workspace");
}
export async function createOrganizationTask(id,payload) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/workspace/tasks",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
}
export async function changeOrganizationTaskStatus(id,taskId,status) {
  return request("/api/organizations/"+encodeURIComponent(id)+"/workspace/tasks/"+
    encodeURIComponent(taskId),{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({status})
    });
}

export async function getOrganizationFinanceStatus(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/status");
}
export async function linkOrganizationKsef(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/link",{method:"POST"});
}
export async function getOrganizationFinanceSummary(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/summary");
}
export async function getOrganizationFinanceDocuments(orgId,{offset=0,limit=50}={}){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/documents?"+
  new URLSearchParams({offset:String(offset),limit:String(limit)}).toString());
}
export async function getOrganizationFinanceProjects(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/projects");
}
export async function getOrganizationFinanceMembers(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/members");
}
export async function changeOrganizationFinancePermission(orgId,membershipId,financeAccess){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/members/"+
  encodeURIComponent(membershipId),{method:"PATCH",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({financeAccess})});
}

export async function getSystemUsers(cursor=null) {
  const query=cursor?"?cursor="+encodeURIComponent(cursor):"";
  return request("/api/admin/users"+query);
}

export async function updateSystemUser(id,payload) {
  return request("/api/admin/users/"+encodeURIComponent(id),{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
}

export async function getOrganizationBankSummary(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/summary");
}
