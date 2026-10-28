# PrzemAI — daty dokumentów finansowych z poczty

Aktualizacja: 2026-10-28. Zakres: staging, gałąź `feature/agent-runtime-finance-mail`.

## Rozdzielenie dat

Poczta IMAP podaje datę wiadomości, **nie datę wystawienia faktury**. Od tej zmiany Financial Agent zapisuje `FinancialDocument.issueDate = null` dla nowo wykrytych załączników PDF/XML, a prawidłową datę wiadomości jako ISO 8601 w `rawData.receivedAt`. Niepoprawna lub brakująca data wiadomości daje `receivedAt = null`, bez błędu importu.

Panel finansów pokazuje datę wystawienia, jeśli została zweryfikowana i zapisana; w przeciwnym razie dla dokumentów z poczty może pokazać datę otrzymania wiadomości, z wyjaśnieniem w podpowiedzi. **Samo wykrycie załącznika nie oznacza odczytania faktury, jej zaksięgowania ani ustalenia terminu płatności.**

## Dane historyczne

Wcześniejsze importy MAIL mogły zapisać datę wiadomości w polu `issueDate`. Nie należy automatycznie przepisywać tych rekordów ani zakładać, że są poprawne. Przed wykorzystaniem daty do księgowania, windykacji lub obliczenia opóźnienia należy porównać ją z oryginalną fakturą.

Po uruchomieniu zweryfikowanego parsera faktur można w osobnym, audytowanym procesie ustawić `issueDate` na rzeczywistą datę wystawienia i zachować `rawData.receivedAt` jako niezależny ślad pochodzenia. Nie wykonywać migracji historycznych danych bez zgody i kopii bezpieczeństwa.

## Testy i bezpieczeństwo

Test `tests/financial-mail-provenance.test.js` symuluje wiadomości bez połączenia z prawdziwą skrzynką. Sprawdza rozdzielenie dat, nieprawidłowe znaczniki czasu, duplikaty i brak dostępu do skrzynki nieautoryzowanego użytkownika.

Integracja home.pl pozostaje wyłączona do czasu autoryzacji właściciela i świadomego włączenia. Żadna zmiana w tym zakresie nie wymaga ani nie zapisuje haseł w repozytorium.

## Awaria pojedynczej skrzynki (2026-10-28)

Financial Agent przetwarza autoryzowane integracje MAIL niezależnie. Błąd połączenia IMAP, parsowania lub zapisu dla jednej integracji **nie zatrzymuje** skanowania pozostałych skrzynek. Dla nieudanej integracji nie aktualizuje `lastSyncAt`; prawidłowo przetworzone załączniki z innych skrzynek pozostają zapisane z ochroną przed duplikatami (`userId`, `source`, `externalId`).

Jeżeli co najmniej jedna integracja zakończy się błędem, całe uruchomienie agenta ma status `FAILED` i stosuje dotychczasowy harmonogram ponowienia, zamiast fałszywie zgłaszać pełen sukces. Komunikat błędu jest ogólny — nie przechowujemy ani nie logujemy treści błędu IMAP, która mogłaby zawierać dane wiadomości lub poświadczenia. W przypadku utrzymującego się błędu sprawdź konfigurację skrzynki i status połączenia na Railway bez kopiowania sekretów do logów lub zgłoszeń.

Test regresyjny: `tests/financial-mail-provenance.test.js` symuluje jedną niedostępną skrzynkę i drugą działającą, sprawdza brak przesunięcia `lastSyncAt` dla pierwszej oraz brak wycieku sekretu w komunikacie i logu.

## Izolacja danych użytkowników

Każde uruchomienie Financial Agent wymaga niepustego, jednoznacznego `userId` przekazanego przez zaufany runtime. Brak identyfikatora powoduje błąd **przed** wykonaniem zapytania Prisma. Jest to konieczne, ponieważ Prisma może pominąć filtr o wartości `undefined`; bez walidacji agent mógłby odczytać integracje innych użytkowników. Test regresyjny sprawdza, że dla pustych lub niepoprawnych identyfikatorów nie wykonuje się żadnego zapytania do integracji ani połączenia IMAP.
