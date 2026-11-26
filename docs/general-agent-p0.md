# General Agent P0

W czacie WWW wybierz zakres osobisty lub spółkę. Polecenie „Porównaj faktury, dokumenty i postęp inwestycji” uruchamia dostępnych agentów z tych trzech obszarów. „Status” lub „Wyniki” odczytuje ostatni plan w tej rozmowie i tym samym zakresie. „A jakie ryzyka?” kontynuuje plan, korzystając ze świeżych rekordów i wcześniejszego wyniku danego agenta.

Zlecenia powstają atomowo w istniejącym dispatcherze. Wykonanie odczytu i analizy odbywa się równolegle w żądaniu czatu. Nie uruchamia synchronizacji KSeF, poczty ani innych integracji. Po przerwaniu żądania „Status” może podjąć zlecenia, których jeszcze nie rozpoczęto. Zlecenia pozostające w toku ponad 90 minut przechodzą w błąd przy sprawdzeniu statusu. Nowa wiadomość zlecająca analizę tworzy nowy plan.

Wejściem dla adapterów kanałów jest `ChatService.chat(userId, message, conversationId, { organizationId })`. Adapter ustala `userId` z uwierzytelnionej sesji lub własnego, zweryfikowanego powiązania konta, a identyfikator zdarzenia dostawcy deduplikuje przed wywołaniem czatu. Identyfikator spółki jest wyborem rozmówcy, który usługa sprawdza ponownie przy pobieraniu danych i wyników. Numer telefonu lub identyfikator kontaktu nie stanowi dowodu uprawnień. W P0 z tego wejścia korzysta WWW. Adaptery Telegram i WhatsApp nie przekazują jeszcze wiadomości do General Agenta.

Finanse obejmują do 25 ostatnich zapisanych faktur z powiązanego KSeF. Biblioteka spółki udostępnia tekst do czterech wybranych dokumentów PDF, DOCX lub TXT o rozmiarze do 2 MB każdy. Skan PDF bez warstwy tekstowej jest oznaczany jako dokument bez dostępnego tekstu. W zakresie osobistym agent dokumentowy korzysta z zapisanych analiz, jeśli użytkownik włączył historię. Dane każdej spółki są pobierane osobno.

Test z lokalnym mockiem OpenAI uruchamia się poleceniem `node --test tests/general-agent-p0.test.js`. Test używa syntetycznych rekordów i lokalnej atrapy repozytorium. Sprawdzenie backendu z PostgreSQL wymaga wygenerowanego klienta Prisma.
