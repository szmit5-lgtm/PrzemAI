# Import wyciągów bankowych – etap 1

Przygotowano prototyp odczytu wyciągu PDF banku Erste/Santander dla Dekonica (styczeń–październik 2026). Na dostarczonym dokumencie: 112 stron, 14 wyciągów, 1 068 operacji; wszystkie salda i sumy wyciągów uzgodnione.

## Docelowe zasady implementacji

- Import przypisany do `organizationId` i rachunku IBAN, bez możliwości łączenia danych różnych spółek.
- Wersja 1: upload PDF/CSV/MT940, walidacja sald, wykrywanie duplikatów po rachunku, numerze wyciągu i identyfikatorze operacji.
- Zachować oryginalny opis operacji oraz tytuł przelewu, kontrahenta i daty; wyciągi PDF mogą łamać tytuły między wierszami.
- Dopasowanie do KSeF wyłącznie po zgodnym NIP/kontrahencie, numerze faktury i kwocie; wiele faktur na jeden przelew oraz płatności częściowe wymagają osobnego rozliczenia.
- Rachunek VAT (split payment) to osobne saldo: nie sumować transferów między rachunkiem bieżącym i VAT jako przychodów/kosztów.
- Status `PAID` nadawać dopiero po pewnym dopasowaniu; wątpliwe dopasowania trafiają do ręcznej weryfikacji.
- Nie wyliczać należnego VAT wyłącznie z salda rachunku VAT.
- Przed produkcją: migracja Prisma, endpoint uploadu z autoryzacją firmową, testy i zabezpieczenia dostępu.

Nie dodano do repozytorium wyciągu ani danych bankowych klienta.
