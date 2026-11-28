// Requests stay on the frontend origin; Next.js proxies /api to API_PROXY_TARGET.
// Ignore legacy NEXT_PUBLIC_API_URL to avoid cross-origin browser requests.
const API_URL = "";

function handleExpiredSession() {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
    }
}

async function request(endpoint, options = {}) {
    const isCredentialRequest = ["/api/auth/login", "/api/auth/register", "/api/organizations/register"].includes(endpoint);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new Error("Brak połączenia z internetem. Spróbuj ponownie po odzyskaniu połączenia.");
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: "same-origin",
        cache: "no-store"
    });

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
        handleExpiredSession();
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

export async function logout() {
    return request("/api/auth/logout", { method: "POST" });
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

export function getDashboardOverview(signal) {
    return request("/api/executive/overview", { signal });
}

export async function getExecutiveDashboard() {
    return request("/api/executive/dashboard");
}

export async function sendChatMessage(
    message,
    conversationId = null,
    organizationId = null,
    requestId = null
) {
    return request("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message,
            conversationId,
            ...(organizationId && { organizationId }),
            ...(requestId && { requestId }),
            background: true
        })
    });
}

export function sendChatAttachment(file, message, conversationId, organizationId) {
    const body = new FormData();
    body.set("file", file);
    if (message) body.set("message", message);
    if (conversationId) body.set("conversationId", conversationId);
    if (organizationId) body.set("organizationId", organizationId);
    return request("/api/chat/attachment", { method: "POST", body });
}

export async function downloadChatReport(conversationId, messageId, format = "rtf") {
    if (!["rtf", "docx", "pdf", "xlsx"].includes(format)) throw new Error("Nieobsługiwany format raportu.");
    const path = "/api/chat/" + encodeURIComponent(conversationId) + "/report/" + encodeURIComponent(messageId) + "?format=" + format;
    const result = await fetch(path, { credentials: "same-origin", cache: "no-store" });
    if (result.status === 401) handleExpiredSession();
    if (!result.ok) throw new Error("Raport jest niedostępny.");
    const url = URL.createObjectURL(await result.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "raport-przemai." + format;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sendChatReportToTelegram(conversationId, messageId, confirm) {
    const path = "/api/chat/" + encodeURIComponent(conversationId) + "/telegram-report";
    const approval = await request(path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId })
    });
    if (!confirm()) return false;
    await request(path + "/" + encodeURIComponent(approval.data.id), { method: "POST" });
    return true;
}

export async function transcribeVoice(formData) {
  return request("/api/chat/transcribe", {
    method: "POST",
    body: formData
  });
}

export async function getConversations() {
    return request("/api/chat");
}

export async function getConversation(id, signal) {
    return request(`/api/chat/${id}`, { signal });
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

export async function getHomePlMailStatus(){
 return request("/api/agents/mail/status");
}
export async function getKsefHistoryStatus(){
 return request("/api/finance/history/status");
}
export async function getHomePlMailAlerts(){
 return request("/api/agents/mail/alerts");
}
export async function markHomePlMailAlertReviewed(id){
 return request("/api/agents/mail/alerts/"+encodeURIComponent(id)+"/review",
  {method:"PATCH"});
}
export async function getAgentMonitoring(){
 return request("/api/agents/monitor");
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

export async function retryAgentAssignment(key,id){
  return request("/api/agents/workspace/"+encodeURIComponent(key)+"/assignments/"+
    encodeURIComponent(id)+"/retry",{method:"POST"});
}
export async function replyToAgentAssignment(key,id,message) {
  return request("/api/agents/workspace/"+encodeURIComponent(key)+"/assignments/"+
    encodeURIComponent(id)+"/replies",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message})
    });
}

function investmentEndpoint(orgId, investmentId) {
    return "/api/organizations/" + encodeURIComponent(orgId) + "/investments/" + encodeURIComponent(investmentId);
}

export function getInvestmentPanel(orgId, investmentId, signal) {
    return request(investmentEndpoint(orgId, investmentId), { signal, cache: "no-store" });
}

export async function downloadInvestmentReport(orgId, investmentId, year, format) {
    const params = new URLSearchParams({ year, format });
    const response = await fetch(investmentEndpoint(orgId, investmentId) + "/report?" + params, {
        credentials: "same-origin", cache: "no-store"
    });
    if (response.status === 401) handleExpiredSession();
    const expected = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (!response.ok || !response.headers.get("content-type")?.startsWith(expected)) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || "Raport inwestycji jest niedostępny.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "raport-inwestycji-" + year + "." + format;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getInvestmentFinance(orgId, investmentId, year, offset, signal) {
    return request(investmentEndpoint(orgId, investmentId) + "/finance?" +
        new URLSearchParams({ year, offset }), { signal, cache: "no-store" });
}

export function attachInvestmentRecord(orgId, investmentId, recordId, kind) {
    return request(investmentEndpoint(orgId, investmentId) + "/records", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, kind })
    });
}

export function createInvestmentTask(orgId, investmentId, title) {
    return request(investmentEndpoint(orgId, investmentId) + "/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
    });
}

export function changeInvestmentTaskStatus(orgId, investmentId, taskId, status) {
    return request(investmentEndpoint(orgId, investmentId) + "/tasks/" + encodeURIComponent(taskId), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
}

export async function getOrganizationInvestments(orgId) {
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/investments");
}

export async function assignOrganizationInvestmentMembers(orgId, investmentId, userIds) {
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/investments/" + encodeURIComponent(investmentId) + "/assignees", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userIds })
  });
}

export async function createOrganizationInvestment(orgId, payload) {
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/investments", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateOrganizationInvestment(orgId, investmentId, payload) {
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/investments/" + encodeURIComponent(investmentId), {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getOrganizationDocuments(orgId) {
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/documents");
}

export async function uploadOrganizationDocument(orgId, file, investmentId, report = false) {
  const body = new FormData();
  body.append("file", file);
  const query = investmentId ? "?" + new URLSearchParams({ investmentId, report }) : "";
  return request("/api/organizations/" + encodeURIComponent(orgId) + "/documents" + query, {
    method: "POST", body
  });
}

export async function downloadOrganizationDocument(orgId, documentId, investmentId) {
  const response = await fetch("/api/organizations/" + encodeURIComponent(orgId) +
    "/documents/" + (investmentId ? "investment/" + encodeURIComponent(investmentId) + "/" : "") +
    encodeURIComponent(documentId) + "/download", {
    credentials: "same-origin", cache: "no-store"
  });
  if (response.status === 401) {
    handleExpiredSession();
    throw new Error("Sesja wygasła.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Nie można pobrać dokumentu.");
  }
  if (response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Serwer nie zwrócił pliku.");
  }
  return response.blob();
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
export async function getOrganizationInvestmentFinanceReport(orgId,year){
 return request("/api/organizations/"+encodeURIComponent(orgId)+
  "/finance/investments/"+encodeURIComponent(year));
}
export function getOrganizationSettlements(orgId,year){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/settlements/"+encodeURIComponent(year));
}
export function changeOrganizationSettlement(orgId,id,kind,value){
 const base="/api/organizations/"+encodeURIComponent(orgId)+"/finance/settlements/";
 if(kind==="undo"||kind==="undoCorrection")return request(base+
  (kind==="undo"?"payments/":"corrections/")+encodeURIComponent(id),{method:"DELETE"});
 return request(base+encodeURIComponent(id)+"/"+kind,{method:"POST",
  headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
}
export function getOrganizationBankActivity(orgId,year,month,params){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/activity/"+year+"/"+month+
  "?"+new URLSearchParams(params));
}
export async function getOrganizationBankKsefMatches(orgId,year){
 return request("/api/organizations/"+encodeURIComponent(orgId)+
  "/finance/bank-matches/"+encodeURIComponent(year));
}
export function getInvoiceDashboard(year, organizationId, signal) {
 return request("/api/organizations/invoice-dashboard/" + encodeURIComponent(year) +
  (organizationId ? "?" + new URLSearchParams({organizationId}) : ""), {signal, cache:"no-store"});
}
export async function getOrganizationFinanceAnnualReport(orgId,year){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/report/"+encodeURIComponent(year));
}
export async function getOrganizationFinanceDocuments(orgId,{offset=0,limit=50}={}){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/documents?"+
  new URLSearchParams({offset:String(offset),limit:String(limit)}).toString());
}
export async function assignOrganizationFinanceProject(orgId,documentId,projectId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/finance/documents/"+
  encodeURIComponent(documentId)+"/project",{method:"PATCH",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId})});
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

export async function getOrganizationBankFiles(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/files");
}
export async function uploadOrganizationBankFile(orgId,file){
 const data=new FormData();data.append("file",file);
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/files",{
  method:"POST",body:data
 });
}
export async function deleteOrganizationBankFile(orgId,fileId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+
  "/bank/files/"+encodeURIComponent(fileId),{method:"DELETE"});
}
export async function downloadOrganizationBankFile(orgId,fileId){
 const response=await fetch("/api/organizations/"+encodeURIComponent(orgId)+
  "/bank/files/"+encodeURIComponent(fileId)+"/download",{
  credentials:"same-origin",cache:"no-store"
 });
 if(response.status===401){
  handleExpiredSession();
  throw new Error("Sesja wygasła.");
 }
 if(!response.ok){
  const body=await response.json().catch(()=>null);
  throw new Error(body?.error||"Nie udało się pobrać wyciągu.");
 }
 return response.blob();
}
export async function getOrganizationBankMonthlyReport(orgId,year){
 return request("/api/organizations/"+encodeURIComponent(orgId)+
  "/bank/monthly/"+encodeURIComponent(year));
}
export async function getOrganizationBankSummary(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/summary");
}

export async function activateOrganizationMember(orgId,membershipId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/members/"+encodeURIComponent(membershipId)+"/activate",{method:"POST"});
}

export async function importOrganizationBankStatement(orgId,payload){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/statements",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
 });
}
export async function getOrganizationBankStatements(orgId){
 return request("/api/organizations/"+encodeURIComponent(orgId)+"/bank/statements");
}

export async function createTelegramLinkCode(){
 return request("/api/telegram/link-code",{method:"POST"});
}

export function searchWorkspace(query, organizationId) {
    return request("/api/workspace/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, organizationId: organizationId || undefined })
    });
}

export function getPersonalExport() {
    return request("/api/workspace/personal-export");
}

export function getSystemAiUsage() {
    return request("/api/admin/ai-usage");
}

export function getTelegramStatus(signal) {
 return request("/api/telegram/status", { signal });
}

export function changeWhatsAppHistoryLink(organizationId, conversationId, contact, action) {
    return request("/api/whatsapp/organizations/" + encodeURIComponent(organizationId) + "/history-link" + (action === "status" ? "/status" : ""), {
        method: action === "unlink" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, contact })
    });
}

export function getSystemIntegrationHealth(signal) {
    return request("/api/admin/integration-health", { signal });
}

export function getOwnerBriefing(signal) {
    return request("/api/executive/owner-briefing", { signal });
}

export function updateOwnerAlert(alertId, status) {
    return request("/api/executive/owner-briefing/alerts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, status })
    });
}

export function getBusinessMemories(orgId, signal) {
    return request("/api/organizations/" + encodeURIComponent(orgId) + "/business-memory", { signal });
}

export function saveBusinessMemory(orgId, id, entry) {
    return request("/api/organizations/" + encodeURIComponent(orgId) + "/business-memory" + (id ? "/" + encodeURIComponent(id) : ""), {
        method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
    });
}

export function removeBusinessMemory(orgId, id) {
    return request("/api/organizations/" + encodeURIComponent(orgId) + "/business-memory/" + encodeURIComponent(id), { method: "DELETE" });
}

export function updateOwnerBriefingSchedule(time) {
    return request("/api/executive/owner-briefing/schedule", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time })
    });
}
