# iBiznes24 Connect — integracja rachunku korporacyjnego Dekonica

Status: **oczekiwanie na akceptację wniosku przez bank** (zgłoszone 2026-11-09). Dokument projektowy; połączenie nie jest aktywne.

## Cel MVP
- Odczyt salda i historii operacji jednego rachunku korporacyjnego firmy Dekonica.
- Przypisanie danych do `companyId` i ograniczenie dostępu do uprawnionych użytkowników.
- Raporty dzienne, miesięczne i kwartalne; w późniejszym etapie uzgadnianie transakcji z KSeF.
- Brak inicjowania przelewów i brak możliwości zmiany danych w banku.

## Warunki uruchomienia
1. Bank zatwierdza iBiznes24 Connect i dostarcza aktualną dokumentację interfejsu, zakres uprawnień, wymagania certyfikatowe i taryfę opłat.
2. Potwierdzamy, że usługa obsługuje **saldo i historię transakcji w trybie tylko do odczytu**. Jeśli nie, nie aktywujemy integracji w tym wariancie.
3. Potwierdzamy izolację środowiska staging i produkcji przed wdrożeniem jakichkolwiek zmian wymagających migracji.
4. Certyfikaty i klucze prywatne przechowujemy wyłącznie w bezpiecznym magazynie sekretów; nie zapisujemy ich w repozytorium, logach ani w czacie.

## Kontrakt wewnętrzny (projekt, nie API banku)
```ts
interface BankReadOnlyProvider {
  getBalances(connectionId: string): Promise<Array<{
    accountRef: string; currency: string; amount: string; asOf: string;
  }>>;
  listTransactions(connectionId: string, from: string, to: string, cursor?: string): Promise<{
    items: Array<{
      externalId: string; accountRef: string; bookedAt: string;
      amount: string; currency: string; description?: string;
      counterparty?: string;
    }>;
    nextCursor?: string;
  }>;
}
```

## Wymagania bezpieczeństwa i jakości
- Połączenie i wszystkie rekordy przypisane do jednej spółki; w każdym odczycie kontrola `companyId` i uprawnień.
- Idempotentny import transakcji według identyfikatora z banku i rachunku; obsługa korekt, duplikatów, stronicowania i ponawiania żądań.
- Daty w UTC z zachowaniem strefy raportowania, kwoty jako Decimal/string (nie float).
- Brak ujawniania numerów rachunków, danych kontrahentów, tokenów i certyfikatów w logach.
- Audyt połączenia, synchronizacji, błędów i odwołania dostępu.
- Testy: izolacja spółek, odmowa bez uprawnień, brak metod płatniczych, deduplikacja, paginacja, odnowienie po błędzie, mapowanie salda.

## Kolejność implementacji
1. Po otrzymaniu dokumentacji banku potwierdzić metody read-only i sposób uwierzytelnienia.
2. Dodać adapter bankowy z mockowanym transportem i testami, bez sekretów i bez połączenia produkcyjnego.
3. Dodać model połączenia i import transakcji dopiero po weryfikacji izolacji baz.
4. Zintegrować z panelem finansowym i uzgadnianiem faktur KSeF.
5. Uruchomić odczyt produkcyjny dopiero po oddzielnej zgodzie właściciela.

**Nie mylić:** „Zgoda na potwierdzenie dostępności środków” dotyczy sprawdzania dostępności środków przez dostawców usług płatniczych; sama w sobie nie zapewnia dostępu do salda ani historii.
