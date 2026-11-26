# General Agent P0

W czacie WWW wybierz zakres osobisty lub spółkę. Polecenie „Porównaj faktury, dokumenty i postęp inwestycji” uruchamia dostępnych agentów z tych trzech obszarów. „Status” lub „Wyniki” odczytuje ostatni plan w tej rozmowie i tym samym zakresie. „A jakie ryzyka?” kontynuuje plan, korzystając ze świeżych rekordów i wcześniejszego wyniku danego agenta.

Zlecenia powstają atomowo w istniejącym dispatcherze. Wykonanie odczytu i analizy odbywa się równolegle w żądaniu czatu. Nie uruchamia synchronizacji KSeF, poczty ani innych integracji. Po przerwaniu żądania „Status” może podjąć zlecenia, których jeszcze nie rozpoczęto. Zlecenia pozostające w toku ponad 90 sekund przechodzą w błąd przy sprawdzeniu statusu. Żądanie ponowione z tym samym identyfikatorem korzysta z zapisanego planu. W przesuwającym się oknie minuty użytkownik może zlecić do 12 analiz i uruchomić do 12 oczekujących zleceń. Plan obejmuje maksymalnie trzy zlecenia, każde z limitem 1000 tokenów wyjściowych. Wywołanie modelu ma limit 15 sekund i wyłączone automatyczne ponawianie. Nowa wiadomość zlecająca analizę tworzy nowy plan.

Wejściem dla adapterów kanałów jest `ChatService.chat(userId, message, conversationId, { organizationId, requestId })`. Adapter ustala `userId` z uwierzytelnionej sesji lub własnego, zweryfikowanego powiązania konta, a identyfikator zdarzenia dostawcy deduplikuje przed wywołaniem czatu. Identyfikator spółki jest wyborem rozmówcy, który usługa sprawdza ponownie przy pobieraniu danych i wyników. Numer telefonu lub identyfikator kontaktu nie stanowi dowodu uprawnień. W P0 z tego wejścia korzysta WWW. Adaptery Telegram i WhatsApp nie przekazują jeszcze wiadomości do General Agenta.

Finanse obejmują do 25 ostatnich zapisanych faktur z powiązanego KSeF. Biblioteka spółki udostępnia tekst do czterech wybranych dokumentów PDF, DOCX lub TXT o rozmiarze do 2 MB każdy. Skan PDF bez warstwy tekstowej jest oznaczany jako dokument bez dostępnego tekstu. W zakresie osobistym agent dokumentowy korzysta z zapisanych analiz, jeśli użytkownik włączył historię. Dane każdej spółki są pobierane osobno.

Test z lokalnym mockiem OpenAI uruchamia się poleceniem `node --test tests/general-agent-p0.test.js`. Test używa syntetycznych rekordów i lokalnej atrapy repozytorium. Sprawdzenie backendu z PostgreSQL wymaga wygenerowanego klienta Prisma.

## Lokalny test przeglądarkowy

Utwórz pustą bazę PostgreSQL na `127.0.0.1` o nazwie `przemai_p0_e2e_*` i zastosuj migracje. Ustaw `DATABASE_URL` tej bazy, zainstaluj zależności backendu i frontendu oraz udostępnij Playwright i Chromium (domyślnie `/usr/bin/chromium`). `node scripts/testGeneralAgentE2E.js` zaludnia bazę danymi syntetycznymi oraz uruchamia lokalny backend, Next.js i mock Responses API. Porty 3031 i 3034 muszą być wolne. Test sprawdza logowanie, zakresy spółek, utratę uprawnień, równoległe żądania i wznowienie kolejki po restarcie.

Gdy natywny silnik Prisma jest niedostępny, migracje można wykonać przez `psql -X -1 -v ON_ERROR_STOP=1 -f <plik>` w kolejności katalogów, wyłącznie na tej pustej bazie testowej. Do lokalnego testu można wygenerować klienta z silnikiem JavaScript. Katalog narzędzi musi znajdować się poza checkoutem:

```bash
export PRZEMAI_E2E_PRISMA_TOOLS=/workspace/.przemai/prisma-lab
npm --prefix "$PRZEMAI_E2E_PRISMA_TOOLS" install --save-exact @prisma/internals@6.19.3 @prisma/adapter-pg@6.19.3
node scripts/localPrismaE2E.cjs
NODE_OPTIONS="--require=$PWD/scripts/localPrismaE2E.cjs" node scripts/testGeneralAgentE2E.js
```

Klient testowy jest zapisywany w ignorowanym `node_modules/.prisma/client`. Skrypt użyty jako preload odrzuca adresy spoza izolowanej bazy lokalnej. Standardowy klient można przywrócić przez `npm run prisma:generate` po odblokowaniu pobierania silnika.
