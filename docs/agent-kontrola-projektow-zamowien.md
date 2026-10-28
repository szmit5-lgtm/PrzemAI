# Agent Techniczny — kontrola projektu i zamówień

Status: wymagania zatwierdzone kierunkowo; funkcja nie jest jeszcze wdrożona.

## Cel
Dla inwestycji (np. Zgorzelec) użytkownik wgrywa pełną dokumentację projektową. Każde zamówienie materiałów jest weryfikowane względem obowiązującej rewizji projektu, przed wysłaniem do hurtowni.

## Dane wejściowe
- Dokumentacja PDF/DWG/IFC (obsługa formatów etapami), przedmiary, zestawienia, specyfikacje, rewizje, zatwierdzone zamienniki.
- Zamówienie materiałowe: pozycja, ilość, jednostka, producent/model, parametry, inwestycja, osoba zamawiająca.
- Historia zamówień, WZ, faktury, dostawy i stan magazynowy, jeśli dostępny.

## Walidacje
- Czy pozycja występuje w obowiązującej dokumentacji i jest przeznaczona dla danej inwestycji?
- Czy ilość i jednostka są zgodne z zestawieniem, uwzględniając wcześniejsze zamówienia, dostawy, straty i uzasadnione zapasy?
- Czy parametry (np. DN, PN, moc, materiał, średnica, typ urządzenia) są zgodne?
- Czy zamiennik został zatwierdzony? Czy zamówienie nie jest duplikatem?
- Czy dokumentacja jest kompletna i czy nie ma nowszej rewizji?

## Wynik
- ZGODNE / ROZBIEŻNOŚĆ / BRAK DANYCH / WYMAGA DECYZJI.
- Raport pozycji z odnośnikami do strony/rysunku/rewizji projektu oraz wskazaniem źródła weryfikacji.
- Domyślnie tryb doradczy: bez automatycznego wysłania zamówienia.
- Rozbieżności i zamienniki do akceptacji przez osobę odpowiedzialną; agent nie zatwierdza zmian projektowych.

## Architektura i bezpieczeństwo
- ProjectDocument + Revision + ExtractedItem + PurchaseOrder + PurchaseOrderLine + VerificationResult.
- Tenant-scoped i project-scoped dostęp; nie mieszać projektów ani firm.
- Ekstrakcja z rysunków może być niepewna: brak danych nie jest zgodnością.
- Idempotentna kontrola, audyt, wersjonowanie i ponowna kontrola po zmianie dokumentacji.

## MVP
1. PDF + zestawienie XLSX/CSV, ręcznie wgrywane zamówienie.
2. Porównanie pozycji, parametrów i ilości z cytowaniem źródła.
3. Historia zamówień i wykrywanie duplikatów.
4. Dopiero potem integracja ERP/hurtownie oraz DWG/IFC.

## Ustalenie formatu wejściowego (2026-10-28)
Użytkownik potwierdził, że zamówienia przychodzą w różnych formatach, najczęściej Excel (XLS/XLSX) i PDF. MVP powinno przyjmować oba formaty równorzędnie, zachowywać oryginały, normalizować pozycje do wspólnej struktury i oznaczać niepewne odczyty do ręcznej kontroli. Nie zakładać, że PDF zawiera tekst możliwy do skopiowania; skany wymagają osobnej ścieżki odczytu.

## Potwierdzone formaty zamówień (2026-10-28)
Zamówienia wpływają najczęściej jako pliki Excel (XLS/XLSX), PDF oraz treść wiadomości e-mail; e-mail może również zawierać załączniki. MVP powinno obsługiwać wszystkie trzy kanały, bez narzucania pracownikom jednego formularza.

### Reguły importu
- Normalizuj pozycje do wspólnego schematu: inwestycja, materiał, jednostka, ilość, parametry, źródło (wiadomość/plik/arkusz/wiersz), wersja.
- Wykrywaj duplikaty między treścią e-maila a załącznikami oraz między kolejnymi przesyłkami.
- Zachowuj odnośniki do oryginalnego źródła i dokumentacji projektowej.
- Jeżeli nie da się wiarygodnie rozpoznać inwestycji, jednostki lub pozycji, oznacz jako BRAK DANYCH i poproś o weryfikację.
- Nie wysyłaj zamówień do dostawcy bez odpowiedniego zatwierdzenia.
