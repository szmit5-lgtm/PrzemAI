// A successful HTTP response is not enough to establish an authenticated session.
// The /api/auth/me endpoint must confirm the user whose session was checked.
export function parseAuthenticatedProfile(response) {
    const user = response?.user;
    if (response?.success !== true ||
        !user || typeof user !== "object" || Array.isArray(user) ||
        typeof user.id !== "string" || !user.id.trim() ||
        typeof user.email !== "string" || !user.email.trim()) {
        throw new Error("Nie udało się potwierdzić sesji.");
    }
    return user;
}
