# PrzemAI P0 na Railway

Procedura dla operatora po zatwierdzeniu wdrożenia. Kandydat to konkretny SHA z gałęzi `release/przemai-p0-integration`. Wydanie obejmuje API WWW, webhook Telegram, workera i frontend Next.js.

## Przed wdrożeniem

1. Potwierdź identyfikatory projektu, środowiska, usług API, workera, frontendu i klastra PostgreSQL. Sprawdź zgodność połączeń API oraz workera z tym samym klastrem bez ujawniania wartości zmiennych. Nazwa środowiska Railway sama nie potwierdza izolacji.

   Na odizolowanej usłudze staging wskazanej w `scripts/check-staging-isolation.js` uruchom `node scripts/check-staging-isolation.js` i `node scripts/staging-schema-probe.js`. Oba polecenia muszą zakończyć się kodem 0. Wynik dotyczy tylko sprawdzonego połączenia. Oddzielnie potwierdź identyfikator klastra używanego przez stagingowego workera. Historyczne usługi z nazwą „staging” w środowisku Railway „production” wymagają odrębnej weryfikacji.
2. Zapisz bieżące SHA i identyfikatory wdrożeń wszystkich usług. Zabezpiecz punkt przywracania PostgreSQL i przećwicz odtworzenie na odizolowanej kopii.
3. Zbuduj backend i frontend z ustalonego SHA. Użyj `npm ci` oraz `npm run prisma:generate` w katalogu głównym i `npm ci && npm run build` w `frontend`. Ustaw docelowy URL API przez `API_PROXY_TARGET` przed buildem Next.js. Zweryfikuj sumy kontrolne pobieranych silników Prisma. Uruchom `npm audit --omit=dev` w obu katalogach.
4. Na oddzielnej bazie o nazwie `przemai_p0_e2e_*` na loopbacku wykonaj `npx prisma migrate deploy`, testy `npm test` w obu katalogach oraz skrypty `testGeneralAgentE2E.js`, `testTelegramChatE2E.js`, `testFinancialAgentE2E.js` i `testReleaseIntegrationE2E.js` z katalogu `scripts`. Testy przeglądarkowe wymagają Playwright i Chromium. Używają lokalnego mocka AI i syntetycznych rekordów.
5. Sprawdź `npx prisma migrate status` oraz zgodność historii migracji. Jeżeli baza zawiera wcześniejszy wariant migracji panelu, zatrzymaj wydanie i uzgodnij naprawę do przodu. Zweryfikuj `confdeltype = 'n'` dla `Task_investmentId_fkey` i `OrganizationDocument_investmentId_fkey`. Sprawdź też istnienie `Task.investmentScoped`, `ChatConversation.channel` i tabel `OpenAIRequestBudget` oraz `OpenAIMonthlyBudget`.
6. Ustal wspólny dzienny limit wywołań i miesięczny limit w PLN dla wszystkich replik. Miesięczne maksimum to 200 PLN. Zobacz warunki w sekcji „Budżet AI”.

## Budżet AI

- `OPENAI_MONTHLY_BUDGET_PLN` akceptuje kwotę od 0 do 200 PLN i domyślnie wynosi 200. W pierwszym miesiącu ustaw najwyżej kwotę pozostałą po dotychczasowym zużyciu wybranego projektu OpenAI.
- `OPENAI_PRICE_BOUNDS_JSON` mapuje nazwę modelu na pola `input`, `output`, `validUntil`. Dwie pierwsze wartości to całkowite mikro-PLN za token, zaokrąglone w górę i uwzględniające taryfę, kurs walutowy z marginesem oraz podatek. Termin ważności to ISO 8601 z godziną i strefą. Brak aktualnego, potwierdzonego cennika zamyka wywołania modelu.
- Limit obejmuje wspólne rezerwacje aplikacji w miesiącu kalendarzowym UTC. Rezerwacja następuje przed siecią i pozostaje po błędzie lub timeout. Obsługiwane są tekstowe wywołania Responses API z ograniczoną liczbą tokenów odpowiedzi. Transkrypcja i skany PDF są blokowane, dopóki nie da się dla nich obliczyć bezpiecznej ceny maksymalnej.
- Do porównywania z fakturą dostawcy używaj oddzielnego projektu OpenAI. Inne aplikacje, opłaty stałe i zmiany taryfy lub kursu poza zatwierdzonym zakresem nie przechodzą przez aplikacyjny licznik. Jeśli nie można potwierdzić założeń cenowych albo początkowego salda, ustaw 0 PLN. `OPENAI_DAILY_REQUEST_LIMIT=0` dodatkowo zamyka wywołania również we wcześniejszym buildzie P0.


## Kolejność wydania

1. W uzgodnionym oknie wstrzymaj przyjmowanie nowych zleceń i pozwól workerowi zakończyć bieżący cykl przez SIGTERM. Zanotuj stan kolejki i ostatnie audyty.
2. Uruchom `npx prisma migrate deploy` **raz** jako krok migracji dla zweryfikowanej bazy. Jeżeli migracja się nie powiedzie, zatrzymaj kolejne wdrożenia i zabezpiecz logi. Pomijanie migracji albo automatyczne czyszczenie bazy byłoby niedopuszczalne.
3. Wdróż API z wybranego SHA. Potwierdź `/health`, odczyt sesji, dostęp do panelu i separację kanału Telegram za pomocą wcześniej zatwierdzonych, bezkosztowych prób.
4. Wdróż frontend z tego samego SHA i sprawdź `/login`, routing `/api/*` oraz odczyt przypisanej inwestycji. Włącz workera dopiero po potwierdzeniu API i schematu. Zweryfikuj bieżący cykl i kolejkę bez wymuszania odczytu KSeF ani poczty.
5. Obserwuj odpowiedzi 5xx, błędy webhooka, przyrost licznika AI, zlecenia RUNNING i duplikaty. Próby dzienne i rezerwacje miesięczne można odczytać z `OpenAIRequestBudget` i `OpenAIMonthlyBudget`. Audytuj przyczyny nowych błędów, zanim ponowisz zlecenia z integracjami.

## Wycofanie

- Przy wzroście 5xx, utracie izolacji, podwójnych uruchomieniach lub nieoczekiwanym zużyciu AI wstrzymaj ruch i workera. Zachowaj SHA, znaczniki czasu, stan migracji i audyty bez kopiowania treści użytkowników.
- Wycofaj frontend do wcześniej zweryfikowanego builda. Wycofuj API i workera tylko do wersji, która obsługuje obecny schemat, autoryzację zakresów inwestycji i izolację kanału Telegram oraz zapewnia równoważny limit dostawcy. Bazowy backend sprzed P0 może pokazać wiadomości Telegram w WWW lub zadania inwestycji w ogólnej przestrzeni spółki. Wariant awaryjny to poprzedni build P0 `45b4fcd61a4a4794c04b061011549a1974a56ae1` na bazie po migracji, z `OPENAI_DAILY_REQUEST_LIMIT=0` ustawionym przed startem API i workera. Utrzymaj wstrzymanie ruchu do czasu sprawdzenia odczytu WWW, izolacji historii Telegram i inicjalizacji workera. Wcześniejszy build P0 nie korzysta z licznika miesięcznego, dlatego wywołania AI pozostają niedostępne do czasu powrotu do nowej wersji.
- Potwierdź SHA faktycznie działającego workera. Próba CI uruchamia wskazany wcześniejszy build P0 na schemacie po migracji. Jeżeli działający worker pochodzi z innego commita, przećwicz ten konkretny build na izolowanej kopii przed wdrożeniem.
- Zachowaj schemat i dane po migracji. Unikaj cofania SQL przez usuwanie kolumn lub tabel. Odtworzenie wymaga potwierdzonej kopii, oceny utraty zapisów po punkcie przywrócenia oraz osobnej decyzji operatora.
- Przed wznowieniem ruchu powtórz smoke i potwierdź, że przerwane zadania oczekują na decyzję o ponowieniu, a zakończone zlecenia nie są wykonywane drugi raz.
