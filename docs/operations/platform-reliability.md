# Wydajność i wdrażanie platformy

Dashboard WWW pobiera liczniki z `GET /api/executive/overview`. Odczyt agreguje osobiste zadania użytkownika w PostgreSQL. Pomija zadania spółek, delegacje General Agenta i pozycje inwestycyjne, także po odłączeniu inwestycji. Endpoint `/api/executive/dashboard` zachowuje dotychczasowy kontrakt. Otwarcie pulpitu korzysta z nowego odczytu bez briefingu AI.

## Kontrola kandydata

- Workflow Node tests na gałęzi `feature/platform-reliability` wykonuje natywne migracje Prisma, próbę zgodności poprzedniego API i workera, testy izolacji, testy WWW i Telegram oraz próbę dashboardu. Workflow Frontend build and smoke uruchamia produkcyjny build i test dymny Next.js.
- Uruchom `node scripts/testDashboardOverviewE2E.js` na lokalnej, zmigrowanej bazie `przemai_p0_e2e_*`. Skrypt sprawdza uwierzytelnienie i zakres użytkownika. Następnie raportuje medianę 11 pomiarów starej i nowej ścieżki oraz rozmiar zserializowanej odpowiedzi z 5000 syntetycznych zadań i 5000 wpisów historii. Stary briefing AI jest w teście zastąpiony stałą odpowiedzią.
- Na Railway stosuj warunki opisane w [procedurze wydania P0](railway-p0-release.md). Po wdrożeniu sprawdź logowanie oraz uwierzytelniony odczyt `/api/executive/overview` przez proxy frontendu. Sprawdź cykl workera i liczbę prób dla każdego syntetycznego zlecenia w zatwierdzonym stagingu z wyłączonymi integracjami zewnętrznymi.

## Worker i wycofanie

`WORKER_AGENT_CONCURRENCY` przyjmuje wartości od 1 do 6. Domyślna wartość to 1. W obrębie jednego procesu równolegle wykonują się wyłącznie zaplanowane zadania różnych użytkowników. Repliki nadal używają atomowego przejęcia konkretnego agenta w bazie. Limit równoległości dotyczy procesu. Ręczne uruchomienia, Kaldeva i próby z innej repliki mają osobne reguły wykonania. Przetestuj zwiększanie limitu od 1 w odizolowanym środowisku przed zmianą konfiguracji wdrożenia.

Komponenty pulpitu i workera z tej gałęzi nie dodają migracji. Przy problemach z równoległością wróć do jednego zadania na proces i zamknij poprzedni worker przed zastąpieniem go. Przy wycofaniu pulpitu wybierz wspólny zweryfikowany SHA API i frontendu. Starszy frontend kieruje odczyt do ścieżki briefingu, więc przed jego ponownym uruchomieniem uwzględnij limit wywołań zgodnie z procedurą P0.

## Stan integracji

Panel administracji pokazuje stan konfiguracji API i daty utrwalonych zdarzeń. Zdarzenia poczty i KSeF pochodzą z potwierdzonych synchronizacji, banki z importu, Telegram z przyjęcia żądania do przetworzenia, WhatsApp z zapisu przychodzącej wiadomości, a Kaldeva z zakończenia zadania. Uprawnienia spółek ograniczają źródła bankowe i WhatsApp. Monitor nie wywołuje usług dostawców. Liczniki kolejki obejmują konto administratora. Przy błędzie workera zidentyfikuj fazę i kod diagnostyczny przed oceną, czy poprzednia próba mogła wywołać skutki uboczne.

OpenAI korzysta z dotychczasowego wspólnego limitu 200 PLN. W przypadku Claude limit 50 PLN sprawdza konfigurację ręcznego skryptu. Claude nie jest uruchomiony w schedulerze i nie ma trwałego licznika rezerwacji. Brak potwierdzenia w monitorze nie jest dowodem awarii dostawcy.
