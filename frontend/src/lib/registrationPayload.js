// HTTP 2xx alone does not prove an account was created for this email.
export function parseRegistrationResponse(response, requestedEmail) {
    const user = response?.user;
    if (response?.success !== true ||
        !user || typeof user !== "object" || Array.isArray(user) ||
        typeof user.id !== "string" || !user.id.trim() ||
        typeof user.email !== "string" || !user.email.trim() ||
        typeof user.role !== "string" || !user.role.trim() ||
        typeof requestedEmail !== "string" ||
        user.email.trim().toLowerCase() !== requestedEmail.trim().toLowerCase()) {
        throw new Error("Serwer nie potwierdził utworzenia konta.");
    }
    return user;
}
