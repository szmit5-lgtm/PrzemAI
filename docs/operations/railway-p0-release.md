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
- Uruchom `node scripts/check-ai-release-budget.js` w środowisku kandydata po potwierdzeniu tożsamości bazy i utworzeniu tabel budżetowych. Kontrola nie wypisuje wartości konfiguracji i nie kontaktuje się z OpenAI. Sprawdza obecność klucza, limity, ważność wyceny dla `gpt-5.5` i zapas na trzy reprezentatywne żądania planu według aktualnych liczników bazy. Porównaj limity i wycenę w API i workerze przez ustawienia Railway. Koszt dłuższych kontekstów zależy od faktycznych danych wejściowych. Aktywację AI zatwierdź po potwierdzeniu faktury i ceny przez operatora.
- Do porównywania z fakturą dostawcy używaj oddzielnego projektu OpenAI. Inne aplikacje, opłaty stałe i zmiany taryfy lub kursu poza zatwierdzonym zakresem nie przechodzą przez aplikacyjny licznik. Jeśli nie można potwierdzić założeń cenowych albo początkowego salda, ustaw 0 PLN. `OPENAI_DAILY_REQUEST_LIMIT=0` dodatkowo zamyka wywołania również we wcześniejszym buildzie P0.


## Próba przełączenia dla PR #107

Operator potwierdził w Railway produkcyjny worker `729ef733d114a2ab7d611e9139394867873cc34d`, API `d2e9833e828fc78ee89d3aac5616543ead443b7f` oraz staging API `ee7015abbf76bd6f879b94609a913493e7a67f16` z prywatnym hostem Postgres-Vycl. Przed wydaniem potwierdź, że te wersje i identyfikatory klastrów nadal obowiązują, w tym tożsamość bazy stagingowego workera.

`scripts/testProductionCutover.sh` instaluje klientów Prisma z lockfile obu produkcyjnych SHA. Odtwarza syntetyczny stan poprzedniego API w odrębnym PostgreSQL 16, zrzuca go przez `pg_dump`, odtwarza przez `pg_restore` w pustej bazie i porównuje zachowanie danych oraz rejestr migracji. Następnie wykonuje natywne migracje P0, uruchamia poprzednie komponenty bez integracji i porównuje ich zachowanie z kandydatem. Przed produkcją powtórz odtworzenie **bieżącej kopii produkcyjnej** w odizolowanym klastrze, z wyłączonymi integracjami, i zapisz czas odtworzenia oraz status migracji. Syntetyczna próba CI nie dowodzi stanu rzeczywistej kopii.

## Kolejność wydania

1. W uzgodnionym oknie wstrzymaj przyjmowanie zleceń WWW i Telegram oraz harmonogramy. Zanotuj stan zadań oczekujących, rozpoczętych i zakończonych oraz audyty prób zewnętrznych. Zatrzymaj stare API i wszystkie repliki starego workera. Wyślij SIGTERM i pozostaw co najmniej 25 sekund na domknięcie cyklu. Potwierdź w Railway zamknięcie procesów oraz brak automatycznego restartu przed migracją. Jeżeli przekroczono czas zamknięcia, ustal skutki przerwanego cyklu na podstawie audytu. Pozostaw oczekujące zadania w kolejce, a przerwane oceń przed ręcznym ponowieniem.
2. Uruchom `npx prisma migrate deploy` **raz** jako krok migracji dla zweryfikowanej bazy. Jeżeli migracja się nie powiedzie, zatrzymaj kolejne wdrożenia i zabezpiecz logi. Pomijanie migracji albo automatyczne czyszczenie bazy byłoby niedopuszczalne.
3. Wdróż API z wybranego SHA. Potwierdź `/health`, odczyt sesji, dostęp do panelu i separację kanału Telegram za pomocą wcześniej zatwierdzonych, bezkosztowych prób.
4. Wdróż frontend z tego samego SHA i sprawdź `/login`, routing `/api/*` oraz odczyt przypisanej inwestycji. Włącz wyłącznie workera z SHA kandydata, początkowo jedną replikę. Zweryfikuj pierwszy cykl, kolejkę i brak duplikatów przed przywróceniem harmonogramów, bez wymuszania odczytu KSeF ani poczty.
5. Obserwuj odpowiedzi 5xx, błędy webhooka, przyrost licznika AI, zlecenia RUNNING i duplikaty. Próby dzienne i rezerwacje miesięczne można odczytać z `OpenAIRequestBudget` i `OpenAIMonthlyBudget`. Audytuj przyczyny nowych błędów, zanim ponowisz zlecenia z integracjami.

## Wycofanie

- Przy wzroście 5xx, utracie izolacji, podwójnych uruchomieniach lub nieoczekiwanym zużyciu AI wstrzymaj ruch i workera. Zachowaj SHA, znaczniki czasu, stan migracji i audyty bez kopiowania treści użytkowników.
- Wycofaj frontend do wcześniej zweryfikowanego builda. Wycofuj API i workera tylko do wersji, która obsługuje obecny schemat, autoryzację zakresów inwestycji i izolację kanału Telegram oraz zapewnia równoważny limit dostawcy. Bazowy backend sprzed P0 może pokazać wiadomości Telegram w WWW lub zadania inwestycji w ogólnej przestrzeni spółki. Wariant awaryjny to poprzedni build P0 `45b4fcd61a4a4794c04b061011549a1974a56ae1` na bazie po migracji, z `OPENAI_DAILY_REQUEST_LIMIT=0` ustawionym przed startem API i workera. Utrzymaj wstrzymanie ruchu do czasu sprawdzenia odczytu WWW, izolacji historii Telegram i inicjalizacji workera. Wcześniejszy build P0 nie korzysta z licznika miesięcznego, dlatego wywołania AI pozostają niedostępne do czasu powrotu do nowej wersji.
- Po migracji nie przywracaj API `d2e9833`. Odczytuje historię Telegram w WWW i nie oddziela zadań nieprzydzielonych inwestycji od ogólnego obszaru spółki. Worker `729ef73` może odczytać schemat, lecz nie rozlicza porzuconych szkiców po przerwaniu. Zastąp go workerem P0 bez okresu wspólnej pracy. Przy awarii pozostaw ruch i harmonogramy wstrzymane, a po próbie na bieżącej odizolowanej kopii użyj awaryjnego zestawu P0 opisanego powyżej albo naprawy do przodu.
- Zachowaj schemat i dane po migracji. Unikaj cofania SQL przez usuwanie kolumn lub tabel. Odtworzenie wymaga potwierdzonej kopii, oceny utraty zapisów po punkcie przywrócenia oraz osobnej decyzji operatora.
- Przed wznowieniem ruchu powtórz smoke i potwierdź, że przerwane zadania oczekują na decyzję o ponowieniu, a zakończone zlecenia nie są wykonywane drugi raz.
