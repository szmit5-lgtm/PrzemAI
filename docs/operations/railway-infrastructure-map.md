# Mapa infrastruktury PrzemAI i odtworzenie P0

Stan informacji przekazanych przez operatora na 27 listopada 2026.

| Rola | Projekt Railway | Środowisko lub usługa | Identyfikator lub nazwa |
| --- | --- | --- | --- |
| Produkcyjna baza danych | respectful-light | Postgres | Klaster PostgreSQL `7673220878021664822` |
| Produkcyjne procesy aplikacyjne | passionate-freedom | API i worker | Korzystają z produkcyjnego klastra w respectful-light |
| Izolowany klaster prób | passionate-freedom | staging → Postgres-Vycl | Prywatny host `postgres-vycl.railway.internal`. Identyfikator klastra staging należy potwierdzić w sesji operatorskiej. |
| Baza próbnego odtworzenia | passionate-freedom | staging → Postgres-Vycl | Docelowa baza logiczna `przemai_p0_rehearsal` |

Operator zgłosił przesłanie kopii produkcyjnej do staging i sprawdzenie SHA256. Operator potwierdził zakończenie odtworzenia jako `RESTORE_OK`. Zgodność sumy potwierdza integralność pliku kopii. Odtworzenie potwierdzają wynik programu odtwarzającego i kontrola bazy docelowej. Zapisuj status tych etapów oddzielnie.

## Potwierdzenie odtworzenia przed migracjami

1. W Railway potwierdź projekt `passionate-freedom`, środowisko `staging` i usługę `Postgres-Vycl`. Wybierz zatwierdzony dostęp do odczytu, przypisany wyłącznie do `przemai_p0_rehearsal`. Sprawdź tożsamość klastra z inwentarzem Railway i porównaj ją z identyfikatorem produkcji. Jeżeli tożsamość klastra jest nieznana lub zgodna z produkcją, zakończ próbę.
2. Potwierdź zakończenie odtwarzania z kodem 0 i sprawdź, czy raport narzędzia potwierdza docelową bazę, przywrócenie schematu i danych oraz brak pominiętych tabel. Wynik porównaj z oczekiwanym zakresem zweryfikowanej kopii. Dane dostępowe i zapis kopii pozostają w narzędziach operatorskich.
3. Przez sesję z ustawioną bazą `przemai_p0_rehearsal` sprawdź poniższe metadane w transakcji tylko do odczytu. Funkcja `pg_control_system()` wymaga odpowiednich uprawnień. Jeśli jej odczyt jest niedostępny, operator poświadcza identyfikator na podstawie zaufanego inwentarza i wyniku z autoryzowanej sesji. Zakończ weryfikację, jeśli baza, tożsamość klastra lub stan migracji odbiegają od oczekiwanego stanu kopii.

   ```sql
   BEGIN READ ONLY;
   SELECT current_database() AS database_name, current_setting('transaction_read_only') AS read_only;
   SELECT system_identifier::text AS cluster_identifier FROM pg_control_system();
   SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_migration_history,
          to_regclass('public."User"') IS NOT NULL AS has_users,
          to_regclass('public."Organization"') IS NOT NULL AS has_organizations;
   ROLLBACK;
   ```

4. Porównaj wyłącznie metadane i uzgodnione agregaty z referencją kopii, w tym status najnowszej oczekiwanej migracji i kompletność przywróconych tabel. Zapisz identyfikator kopii, SHA256, odtworzoną bazę, porę weryfikacji oraz wynik. Dostęp do rzeczywistych danych ogranicz do zatwierdzonych operatorów.
5. Potwierdź izolację procesów przed uruchomieniem prób. Próba migracji korzysta wyłącznie z `przemai_p0_rehearsal` i ma wyłączone rzeczywiste wywołania dostawców AI, KSeF, poczty, WhatsApp oraz Telegrama. Instrukcje migracji i rollbacku opisuje [runbook P0](railway-p0-release.md).

Obecny `scripts/check-staging-isolation.js` jest przypisany do stagingowego API i domyślnej bazy logicznej `railway`. Jego wynik dotyczy jedynie tego połączenia. Weryfikacja bazy odtworzonej wymaga osobnego sprawdzenia jej nazwy i identyfikatora klastra.

## Automatyczna kontrola gotowości odtworzenia

W tym samym odizolowanym środowisku użyj połączenia skonfigurowanego do bazy `przemai_p0_rehearsal` i uruchom `node scripts/check-rehearsal-restore.js /bezpieczna/sciezka/restore-attestation.json`. Polecenie wymaga klienta Prisma i operatora z dostępem do `pg_control_system()` oraz historii migracji. Poświadczenie z rzeczywistego przebiegu powinno zawierać:

| Pole | Wartość |
| --- | --- |
| `database` | `przemai_p0_rehearsal` |
| `cluster` | Oczekiwany identyfikator klastra staging w postaci tekstowej, z zaufanego inwentarza |
| `archiveSha256` | Zweryfikowana suma SHA256 pliku kopii |
| `restoredArchiveSha256` | Suma SHA256 pliku użytego przez rzeczywiste odtworzenie |
| `restoreExitCode` | Kod zakończenia odtwarzania |
| `schemaAndDataComplete` | Wartość `true` po sprawdzeniu kompletności zgodnie z raportem odtworzenia i referencją kopii |
| `latestMigration` | Nazwa ostatniej ukończonej migracji oczekiwanej w kopii |

Przechowuj plik poświadczenia poza repozytorium. Sonda najpierw sprawdza środowisko i poświadczenie, a następnie w transakcji tylko do odczytu weryfikuje bazę docelową, identyfikator klastra i stan historii migracji. Kod 0 oznacza zgodność odczytanych metadanych z poświadczeniem operatora. Kod 1 wstrzymuje próbę migracji. Poświadczenie pozostaje dowodem operatora, a odczyt metadanych nie sprawdza ponownie zawartości archiwum.

## Migracja na już odtworzonej bazie

Operator potwierdził zakończenie odtworzenia jako `RESTORE_OK`. Użyj istniejącego poświadczenia. Próba nie tworzy kopii ani nie powtarza odtwarzania.

W zatwierdzonej usłudze staging uruchom z katalogu czystego checkoutu kandydata:

```sh
node scripts/rehearse-restored-migrations.js /bezpieczna/sciezka/restore-attestation.json <pelny-SHA> --check
node scripts/rehearse-restored-migrations.js /bezpieczna/sciezka/restore-attestation.json <pelny-SHA> --apply
```

Tryb odczytu sprawdza SHA, nazwę bazy, instancję PostgreSQL, stan odtworzenia i sumy ukończonych migracji. Tryb zapisu powtarza kontrole, wykonuje natywne `prisma migrate deploy`, `prisma migrate status` i odczyt katalogu PostgreSQL. Używa połączenia przeznaczonego wyłącznie do bazy próbnej. Po niepowodzeniu zachowaj historię migracji i ocenę operatora przed ponowieniem. Próbę przerwij, jeśli środowisko ma aktywne integracje zewnętrzne.
