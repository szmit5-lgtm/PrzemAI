# PrzemAI — MetaTrader 5 DEMO (read-only)

## Stan (2026-11-15)
Pierwszy odizolowany element integracji inwestycyjnej. **Niepołączony z rzeczywistym kontem** i **nieuruchomiony na produkcji**. Wymaga lokalnego terminala MT5 dla Windows i opcjonalnej biblioteki Python `MetaTrader5` (instalacja tylko po potwierdzeniu wersji i zgody użytkownika). Przy rachunku rzeczywistym skrypt celowo odmawia działania.

## Co robi
- Odczytuje wyłącznie konto DEMO, saldo, equity, margin, margin free oraz podsumowanie otwartych pozycji.
- Zwraca JSON bez loginu, nazwy właściciela, serwera brokera, numerów rachunków i danych identyfikujących.
- Nie składa zleceń, nie zarządza pozycjami, nie otwiera połączeń do serwera PrzemAI ani do usług zewnętrznych.
- Dane rynkowe i wyniki demo nie prognozują wyniku inwestycji na rachunku realnym.

## Testy offline
```powershell
python -m unittest discover -s tests -p test_mt5_demo_snapshot.py -v
```
5 fikcyjnych przypadków: poprawny rachunek demo, brak PII, odrzucenie real, brak połączenia, błędna pozycja i nadmierna liczba pozycji.

## Uruchomienie lokalne dopiero po potwierdzeniu wersji MT5 i rachunku DEMO
Otwórz MetaTrader 5 na Windows i zaloguj się na rachunek Admirals DEMO (nie wpisuj loginów i haseł w czacie).
Po zainstalowaniu przez użytkownika oficjalnego pakietu `MetaTrader5`:
```powershell
python scripts/mt5_demo_snapshot.py
```
Wynik może zawierać informacje finansowe (bez danych identyfikujących); nie przesyłać publicznie. Nie wolno podłączać rachunku realnego w tym etapie.

## Etapy następne
1. Potwierdzić MT4/MT5 oraz czy dostępne jest demo.
2. Przetestować odczyt rachunku DEMO na komputerze użytkownika.
3. Dopiero później zaprojektować autoryzowaną, szyfrowaną transmisję minimalnych danych do PrzemAI i dashboard z raportem P&L/ryzykiem.
4. Następnie strategie na danych historycznych i test paper trading z uwzględnieniem kosztów, spreadów i poślizgów.
5. Transakcje live nie są objęte tym MVP; każde ryzykowne działanie wymaga osobnej analizy, testów i zgody.

Dokumentacja producenta: https://www.mql5.com/en/docs/python_metatrader5
Admirals: https://admiralmarkets.com/pl/trading-platforms/metatrader-5
