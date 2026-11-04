# PrzemAI — etap pilotażowy Dekonica (decyzja 2026-11-04)

## Zakres aktualnej bety
- Obecny serwis przemai.pl obsługuje na początku jedną firmę: Dekonica.
- Priorytet: działający asystent konwersacyjny, dokumenty, spotkania, zadania i agenci; następnie integracja KSeF w trybie odczytu.
- Zmiana brandingu na Dekonica i firmowa domena nastąpią dopiero po weryfikacji działania.
- PrzemAI docelowo będzie nadrzędnym panelem właściciela, łączącym osobne przestrzenie spółek.

## Niezmienniki bezpieczeństwa przyszłego modelu wielospółkowego
1. Każdy rekord biznesowy jest przypisany do organizacji (tenant/company ID), a dostęp wymaga autoryzowanego członkostwa.
2. Nie wolno polegać wyłącznie na filtrowaniu po stronie przeglądarki; serwer sprawdza przynależność i rolę przy każdym odczycie i zapisie.
3. Integracje KSeF, banków, poczty oraz poświadczenia są izolowane per organizacja; nie trafiają do repozytorium ani logów.
4. Konto właściciela może mieć dostęp do wielu spółek, ale wybór spółki nie omija kontroli uprawnień.
5. Raporty grupowe agregują wyłącznie dane spółek, do których użytkownik ma dostęp.
6. Nie włączamy migracji produkcyjnej bazy ani zmian produkcyjnego backendu bez odrębnej zgody i planu migracji.

## Kryteria akceptacji pilotażu Dekonica
- Logowanie i sesja działają, a odświeżenie strony nie ujawnia danych innego użytkownika.
- Asystent odpowiada w panelu; błędy integracji są jawnie sygnalizowane.
- Dokumenty i nagrania można przesłać, przeanalizować i odnaleźć w historii.
- Agent finansowy pobiera faktury Dekoniki z KSeF dopiero po bezpiecznym podłączeniu uprawnień odczytu.
- Raport finansowy odróżnia dane rzeczywiste od przykładowych i brakujących.
- Testy regresyjne i wdrożenie staging są zielone przed publikacją produkcyjną.

Ten dokument jest specyfikacją zakresu i bezpieczeństwa, nie potwierdzeniem implementacji funkcji.
