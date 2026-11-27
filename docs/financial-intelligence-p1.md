# Financial Intelligence P1

Widok **Finanse → Możliwe rozliczenia faktur** pokazuje stan faktur, zweryfikowane operacje, prognozę, należności, zobowiązania i koszty stałe. Podpowiedzi są odczytowe. Właściciel spółki będący właścicielem powiązania KSeF może potwierdzić lub cofnąć powiązanie istniejącej operacji. Każda operacja jest przypisywana do jednej faktury. Kilka operacji może spłacać tę samą fakturę, a kwota przypisana jako VAT nie może przekroczyć VAT faktury po korektach. Sugerowane dopasowania częściowe i VAT wymagają numeru faktury w opisie lub identyfikatorze operacji.

Każdą korektę przypisuje się do jednej faktury tej samej spółki, waluty i kontrahenta. Powiązana korekta wpływa na saldo faktury oraz na wynik inwestycji przypisanej do faktury pierwotnej. Rozliczenie zwrotu wymaga zarejestrowanej nadpłaty. Salda przeterminowane wynikają z daty wymagalności i pozostałej kwoty.

Prognoza obejmuje wyłącznie zaimportowane salda i operacje oraz scenariusz spłaty otwartych faktur wymagalnych do końca bieżącego miesiąca. Raport podaje daty ostatnich sald źródłowych. Część rzeczywistych przepływów może być jeszcze poza importem lub KSeF. Wynik inwestycji opiera się na przypisanych fakturach netto, oddzielnie dla każdej waluty.

KSeF klasyfikuje nieprawidłowy XML jako zbyt duży, pusty, niepoprawnie zakodowany lub niepoprawny strukturalnie. Raport nie zawiera treści XML ani danych autoryzacji. Po prawidłowym pobraniu informacja o ponowieniach jest usuwana.

## Test lokalny

Zastosuj migracje do nowej, izolowanej bazy PostgreSQL na `127.0.0.1` o nazwie `przemai_p0_e2e_*` i ustaw jej `DATABASE_URL`. Uruchom `node scripts/testFinancialIntelligenceE2E.js`. Opcja `PRZEMAI_P1_BROWSER=true` dodatkowo sprawdza kliknięcie słupka wykresu w Chromium przy uruchomionym lokalnie Next.js na porcie 3041. Wymaga Playwright i zainstalowanych zależności frontendu. Lokalny adapter Prisma opisano w [instrukcji General Agenta](general-agent-p0.md).
