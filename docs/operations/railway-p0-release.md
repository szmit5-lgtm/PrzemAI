# PrzemAI P0 na Railway

Procedura dla operatora po zatwierdzeniu wdrożenia. Kandydat to konkretny SHA z gałęzi `release/przemai-p0-integration`. Wydanie obejmuje API WWW, webhook Telegram, workera i frontend Next.js.

## Przed wdrożeniem

1. Potwierdź identyfikatory projektu, środowiska, usług API, workera, frontendu i klastra PostgreSQL. Sprawdź zgodność połączeń API oraz workera z tym samym klastrem bez ujawniania wartości zmiennych. Nazwa środowiska Railway sama nie potwierdza izolacji.
2. Zapisz bieżące SHA i identyfikatory wdrożeń wszystkich usług. Zabezpiecz punkt przywracania PostgreSQL i przećwicz odtworzenie na odizolowanej kopii.
3. Zbuduj backend i frontend z ustalonego SHA. Użyj `npm ci` oraz `npm run prisma:generate` w katalogu głównym i `npm ci && npm run build` w `frontend`. Ustaw docelowy URL API przez `API_PROXY_TARGET` przed buildem Next.js. Zweryfikuj sumy kontrolne pobieranych silników Prisma. Uruchom `npm audit --omit=dev` w obu katalogach.
4. Na oddzielnej bazie o nazwie `przemai_p0_e2e_*` na loopbacku wykonaj `npx prisma migrate deploy`, testy `npm test` w obu katalogach oraz skrypty `testGeneralAgentE2E.js`, `testTelegramChatE2E.js`, `testFinancialAgentE2E.js` i `testReleaseIntegrationE2E.js` z katalogu `scripts`. Testy przeglądarkowe wymagają Playwright i Chromium. Używają lokalnego mocka AI i syntetycznych rekordów.
5. Sprawdź `npx prisma migrate status` oraz zgodność historii migracji. Jeżeli baza zawiera wcześniejszy wariant migracji panelu, zatrzymaj wydanie i uzgodnij naprawę do przodu. Zweryfikuj `confdeltype = 'n'` dla `Task_investmentId_fkey` i `OrganizationDocument_investmentId_fkey`. Sprawdź też istnienie `Task.investmentScoped`, `ChatConversation.channel` i tabeli `OpenAIRequestBudget`.
6. Ustal wspólny `OPENAI_DAILY_REQUEST_LIMIT` dla wszystkich replik API i workera. Domyślnie jest to 250 prób na dobę UTC, a `0` zamyka dostęp do OpenAI. Budżet ogranicza liczbę prób. Rozliczenia kosztów zależą także od modelu, wejścia i ceny dostawcy. Właściciel projektu OpenAI powinien sprawdzić dostępne limity i alerty rozliczeniowe. Zachowaj dotychczasowe przełączniki integracji.

## Kolejność wydania

1. W uzgodnionym oknie wstrzymaj przyjmowanie nowych zleceń i pozwól workerowi zakończyć bieżący cykl przez SIGTERM. Zanotuj stan kolejki i ostatnie audyty.
2. Uruchom `npx prisma migrate deploy` **raz** jako krok migracji dla zweryfikowanej bazy. Jeżeli migracja się nie powiedzie, zatrzymaj kolejne wdrożenia i zabezpiecz logi. Pomijanie migracji albo automatyczne czyszczenie bazy byłoby niedopuszczalne.
3. Wdróż API z wybranego SHA. Potwierdź `/health`, odczyt sesji, dostęp do panelu i separację kanału Telegram za pomocą wcześniej zatwierdzonych, bezkosztowych prób.
4. Wdróż frontend z tego samego SHA i sprawdź `/login`, routing `/api/*` oraz odczyt przypisanej inwestycji. Włącz workera dopiero po potwierdzeniu API i schematu. Zweryfikuj bieżący cykl i kolejkę bez wymuszania odczytu KSeF ani poczty.
5. Obserwuj odpowiedzi 5xx, błędy webhooka, przyrost licznika AI, zlecenia RUNNING i duplikaty. Zużycie można odczytać z `OpenAIRequestBudget` według dnia UTC. Audytuj przyczyny nowych błędów, zanim ponowisz zlecenia z integracjami.

## Wycofanie

- Przy wzroście 5xx, utracie izolacji, podwójnych uruchomieniach lub nieoczekiwanym zużyciu AI wstrzymaj ruch i workera. Zachowaj SHA, znaczniki czasu, stan migracji i audyty bez kopiowania treści użytkowników.
- Wycofaj frontend do wcześniej zweryfikowanego builda. Wycofuj API i workera tylko do wersji, która obsługuje obecny schemat, autoryzację zakresów inwestycji i izolację kanału Telegram oraz zapewnia równoważny limit dostawcy. Bazowy backend sprzed P0 może pokazać wiadomości Telegram w WWW lub zadania inwestycji w ogólnej przestrzeni spółki. Gdy brak zgodnego SHA, utrzymaj blokadę ruchu i przygotuj poprawkę do przodu.
- Zachowaj schemat i dane po migracji. Unikaj cofania SQL przez usuwanie kolumn lub tabel. Odtworzenie wymaga potwierdzonej kopii, oceny utraty zapisów po punkcie przywrócenia oraz osobnej decyzji operatora.
- Przed wznowieniem ruchu powtórz smoke i potwierdź, że przerwane zadania oczekują na decyzję o ponowieniu, a zakończone zlecenia nie są wykonywane drugi raz.
