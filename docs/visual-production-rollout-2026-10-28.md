# PrzemAI — bezpieczne uruchomienie nowego interfejsu na przemai.pl

Data przygotowania: 2026-10-28. Zakres: **wyłącznie frontend**, bez zmian w `main`, produkcyjnym `api.przemai.pl` ani produkcyjnej bazie danych.

## Potwierdzony stan infrastruktury

- GitHub: rozwój na `feature/agent-runtime-finance-mail`.
- Railway: frontend `PrzemAI-frontend-staging` (`062e25de-e89f-42b5-bb1d-11ddbbf6ed47`), obecnie na `przemai-frontend-staging-production.up.railway.app`. Konfiguracja: `/frontend`, Next.js, healthcheck `/login`, obserwacja zmian `/frontend/**`.
- Railway: backend `PrzemAI-staging` (`c38b4872-2d7c-4ec6-9422-cc560eb329fd`), adres `przemai-staging-production.up.railway.app`.
- Produkcyjny backend `PrzemAI` (`8473a177-7172-4eb1-9d6f-96fe1df3f73d`) jest na `main` i obsługuje `api.przemai.pl`; **nie ruszać**.
- DNS `przemai.pl` jest obsługiwany przez nameserwery `dns.home.pl`, `dns2.home.pl`, `dns3.home.pl` (sprawdzenie 2026-10-28). Nie stwierdzono własności domeny w podłączonym koncie Vercel. Zmiana DNS wymaga uprawnionego administratora domeny.

## Minimalny bezpieczny plan

1. **Weryfikacja staging**: status wdrożenia frontend = SUCCESS, `/preview` i `/login` odpowiadają, brak błędów kompilacji; sprawdzić mobilnie i na komputerze. Publiczny `/preview` jest demonstracją bez danych firmy.
2. **Weryfikacja połączenia z API**: sprawdzić faktyczną wartość `API_PROXY_TARGET` w Railway (tylko administrator, bez kopiowania sekretów), aby nie kierować testów staging do produkcyjnego API. `NEXT_PUBLIC_REGISTRATION_ENABLED` zgodnie z polityką dostępu. Testy logowania, `/api/auth/me`, odczytu dokumentów, zadań, agentów i finansów na osobnym koncie testowym.
3. **Izolacja danych**: przed testami zapisu potwierdzić, że staging korzysta z osobnej bazy lub nie wykonać operacji mutujących. Nie uruchamiać importu maili/KSeF bez świadomej zgody i właściwego właściciela skrzynki.
4. **Oddzielny frontend produkcyjny**: przygotować dedykowaną usługę frontendową (lub odpowiedni, kontrolowany routing), bez przepinania `api.przemai.pl` i bez automatycznego wypychania niezakończonej gałęzi do `main`. Zmienna `API_PROXY_TARGET` powinna wskazywać właściwy produkcyjny backend tylko dla wdrożenia produkcyjnego.
5. **DNS i TLS**: dopiero po testach i przygotowaniu rollbacku dodać `przemai.pl` jako domenę do docelowego hostingu, otrzymać od dostawcy wymagany rekord A/CNAME, zmienić odpowiedni rekord w panelu home.pl, zweryfikować certyfikat HTTPS i działanie `www` (jeśli używane). **Nie zgadywać wartości rekordów**.
6. **Smoke test po przełączeniu**: HTTPS, logowanie, sesja, dokumenty, spotkania, zadania, tryb prosty/zaawansowany, obsługa 401, mobile, brak błędów 5xx. Jeśli testy nie przechodzą — przywrócić poprzedni rekord DNS / poprzednie wdrożenie.
7. **Odrębny rollout agentów**: nowe integracje home.pl i KSeF pozostają wyłączone do czasu testów, przypisania uprawnień i zgody na synchronizację.

## Kryteria gotowości i blokady

- **Go**: potwierdzony build frontend, test logowania z właściwym API, przetestowany rollback, dostęp do DNS home.pl i zgoda na publikację nowego wyglądu.
- **No-go**: nieznany `API_PROXY_TARGET`, brak potwierdzenia izolacji danych testowych, nieudany build, brak planu rollbacku, niepotwierdzona konfiguracja domeny.
- Zgoda użytkownika dotyczy **wdrożenia wizualnego po testach**, nie automatycznego włączenia integracji ani modyfikacji produkcyjnego backendu.

## Notatka o błędzie budowania backendu staging

Próba wdrożenia `736f9a63-29b8-47fa-8dae-60e996a4acb9` zakończyła się statusem FAILED; wcześniejszy log `8fc7125a-b825-4240-b2e4-bc90ca4b9c46` wskazuje na zerwane połączenie z daemonem BuildKit (`buildkitd.sock`). To wskazówka problemu infrastruktury buildera, nie dowód błędu kodu. Wymagana ponowna próba i sprawdzenie pełnych logów; nie wykonywać rollbacku produkcji z tego powodu.
