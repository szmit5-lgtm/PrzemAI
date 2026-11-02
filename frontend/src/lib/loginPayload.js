// A 2xx response is not proof that authentication succeeded.
export function parseLoginResponse(response) {
  const token = response?.token;
  if (response?.success !== true ||
      typeof token !== "string" || !token.trim()) {
    throw new Error("Nie udało się rozpocząć sesji.");
  }
  return token;
}
