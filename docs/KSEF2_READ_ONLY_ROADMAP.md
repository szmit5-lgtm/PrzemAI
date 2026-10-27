# PrzemAI — KSeF 2.0: bezpieczna integracja tylko do odczytu

Stan: projekt techniczny, **nie jest to działający importer KSeF**.
Aktualizacja: 2026-10-27.

## Oficjalne źródła (Ministerstwo Finansów)

- Dokumentacja API i kontrakt OpenAPI: https://ksef.podatki.gov.pl/ksef-na-okres-obligatoryjny/wsparcie-dla-integratorow/
- API testowe: https://api-test.ksef.mf.gov.pl/v2
- API demonstracyjne: https://api-demo.ksef.mf.gov.pl/v2
- API produkcyjne: https://api.ksef.mf.gov.pl/v2

Kontrakty OpenAPI i wersje różnią się między środowiskami; przed implementacją należy sprawdzać aktualny kontrakt dla wybranego środowiska. Nie zakładać, że endpointy i schematy ze środowiska TEST są identyczne z produkcyjnymi.

## Zakres pierwszego etapu

1. **Tylko odbiór faktur**: brak wysyłania faktur, brak podpisywania w imieniu użytkownika, brak płatności.
2. Autoryzacja KSeF 2.0 przez oficjalny proces (challenge i certyfikat / dopuszczony mechanizm uwierzytelnienia). Access token krótkotrwały; odświeżanie i odwoływanie zgodnie z kontraktem.
3. Pobranie listy dokumentów, następnie szczegółów/XML FA(3), z rozróżnieniem faktur zakupowych i sprzedażowych.
4. Walidacja struktury i przypisanie do odpowiedniego użytkownika, firmy i projektu. Nie zgadywać projektu bez oznaczenia niepewności.
5. Zapis do FinancialDocument: source=KSEF, externalId=stabilny identyfikator KSeF, ksefNumber, invoiceNumber, issueDate, seller/buyer, amounts, status=NEW. Oryginał XML przechowywać osobno w bezpiecznym magazynie plików, nie w logach.
6. Deduplikacja po (userId, source, externalId) z istniejącego schematu. Synchronizacja przyrostowa z zakładką/checkpointem, ponowne odczytanie nakładającego się okresu i bezpieczne wznowienie.
7. Obsługa 401/403 (ponowna autoryzacja), 429 (Retry-After/backoff), 5xx (ograniczone retry), timeoutów i przerw sieciowych. Idempotencja po restarcie workera.

## Izolacja i bezpieczeństwo

- Środowisko staging używa wyłącznie testowego API i testowych danych. Produkcyjne tokeny/certyfikaty i faktury nie trafiają do staging.
- Sekretów i kluczy prywatnych nie wpisywać do GitHub, plików konfiguracyjnych, bazy danych ani logów. Używać bezpiecznego magazynu sekretów i ograniczyć dostęp do workera.
- Uprawnienia per użytkownik oraz per NIP; nie współdzielić sesji KSeF między spółkami ani użytkownikami.
- Przed pierwszym pobraniem sprawdzić uprawnienia certyfikatu i zgodę właściciela konta.
- Endpointy i parametry środowiska na allowliście, bez dowolnego URL z konfiguracji użytkownika.
- Audyt: czas synchronizacji, liczba faktur, ostatni poprawny checkpoint, kody błędów bez tokenów, danych faktur i kluczy.

## Plan wdrożenia

**Faza A — bez sekretów:** typowany klient HTTP tylko dla oficjalnego środowiska TEST, kontrakt OpenAPI, testy walidacji i obsługi błędów, mocki odpowiedzi.

**Faza B — autoryzacja TEST:** certyfikat testowy w bezpiecznym magazynie; test challenge, JWT, rotacji i odmowy dostępu.

**Faza C — import TEST:** pobieranie FA(3), mapowanie do FinancialDocument, checkpoint, deduplikacja, testy wznowienia po awarii i odseparowania użytkowników.

**Faza D — produkcja:** osobna zgoda na włączenie, osobne sekrety i konfiguracja, test minimalnych uprawnień, monitoring i procedura wyłączenia integracji.

## Aktualne blokady

- Brak zatwierdzonego użytkownika testowego na staging.
- Brak uwierzytelnienia KSeF TEST i uzgodnionego modelu przechowywania oryginałów XML.
- Obecny FinancialAgent pobiera jedynie **metadane załączników e-mail**. Nie odczytuje treści faktur i nie pobiera dokumentów z KSeF. Panel finansowy musi jasno odróżniać import metadanych od weryfikacji faktury.
