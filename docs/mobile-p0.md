# PrzemAI Mobile P0

PWA uruchamia istniejący frontend Next.js i współdzielone API. Pulpit, General Agent, finanse, inwestycje i dokumenty używają tych samych ról i reguł dostępu co aplikacja webowa. PWA można zainstalować z przeglądarki Androida i dodać do ekranu początkowego w Safari na iOS. Taki wariant zachowuje routing serwerowy Next.js i sesję w jednej domenie.

## Praca lokalna

Użyj istniejącego checkoutu w chmurowym środowisku zadania. W katalogu głównym uruchom `npm ci`, `npm run prisma:generate` i `npm test`. Backend korzysta z odizolowanej bazy PostgreSQL i wymaga `DATABASE_URL` oraz `JWT_SECRET`. Procedurę uruchomienia bazy i testów integracyjnych opisuje [runbook P0](operations/railway-p0-release.md).

Po uruchomieniu API na porcie 3000, w katalogu `frontend` wykonaj `npm ci`, `npm test`, `npm run build` i `npm run start -- -p 3001`. Jeżeli API ma inny adres, ustaw `API_PROXY_TARGET` zarówno podczas budowania, jak i uruchamiania Next.js. Dla przeglądarek bez nagłówka Fetch Metadata backend musi mieć `FRONTEND_URL` ustawiony na dokładny adres origin frontendu.

## Sesja, nagrywanie i dokumenty

- Next.js zapisuje sesję w ciasteczku `HttpOnly`, `SameSite=Strict` i `Secure` w buildzie produkcyjnym. Backend weryfikuje istniejący JWT i odrzuca zapisy z ciasteczkiem pochodzące spoza originu aplikacji. Klienci API z nagłówkiem Bearer zachowują dotychczasową obsługę. Przy pierwszym otwarciu nowej wersji użytkownik loguje się ponownie. Wylogowanie usuwa ciasteczko na urządzeniu. Backend sprawdza jego podpis i czas ważności.
- Asystent korzysta z istniejącego rozpoznawania głosu w przeglądarce i rezerwowego nagrania przez MediaRecorder z transkrypcją w API. Aparat otwiera się z biblioteki dokumentów uprawnionej spółki. Zdjęcie jest konwertowane lokalnie do PDF i wysyłane po zatwierdzeniu. Plik pozostaje w przestrzeni tej spółki. Konwersja tworzy PDF ze zdjęciem, bez OCR.
- Po utracie sieci otwarty ekran sygnalizuje brak połączenia. Pełna nawigacja offline pokazuje ogólny ekran ponowienia. Service worker przechowuje tylko ten ekran. Dane uwierzytelnione, dokumenty i żądania API pozostają poza pamięcią service workera. Aplikacja nie wznawia automatycznie operacji zapisu.

## Android i iOS

Katalog mobile zawiera lokalnie pakowany interfejs oraz projekty Capacitor z identyfikatorem com.dekonica.przemai. Build sklepowy łączy się z jednym skonfigurowanym originem HTTPS API Express. Tryb zdalnej strony pozostaje dostępny przez npm run sync w testach stagingowych. Polecenie prepare:store odrzuca ten tryb.

    cd mobile
    npm ci
    npm test
    PRZEMAI_MOBILE_API_ORIGIN=https://api.example.test npm run prepare:store
    (cd android && ./gradlew assembleDebug bundleRelease)
    xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build

Zastąp przykładowy origin zatwierdzonym adresem API. Android wymaga JDK 21 i SDK API 36. iOS wymaga macOS i Xcode. Do aktualizacji zachowaj identyfikator i klucz podpisu oraz zwiększ numery kompilacji i wersje widoczne dla użytkownika. PWA pozwala odświeżyć aplikację po pobraniu nowej wersji service workera.

Token aplikacji natywnej istnieje tylko w pamięci procesu. Ponowne uruchomienie i bezczynność wymagają ponownego logowania. Zmiana spółki rozpoczyna osobną rozmowę. Powiadomienia lokalne zapisuje użytkownik dla przyszłego terminu zadania. Mają ogólną treść, a wylogowanie usuwa oczekujące przypomnienia. Dostarczanie zależy od uprawnień systemowych i ograniczeń zasilania.

Dokumenty natywne są widoczne na liście i można je przesyłać z systemowego selektora plików. Przed publikacją trzeba sprawdzić przesyłanie plików, wygaszanie sesji i powiadomienia na urządzeniach oraz przygotować podpisy i deklaracje prywatności. Zdalne FCM/APNs wymaga osobnej konfiguracji. Załączniki P1 i głos pozostają do rozbudowy klienta natywnego.

## Zgodność modułów

Endpoint dashboardu KSeF liczy netto i brutto z zapisanych kwot, w tym korekt, według kontraktu #108. Natywny General Agent korzysta z tekstowego kontraktu API używanego też w #110. Połączenie gałęzi #108 i #110 ze sobą wymaga uzgodnienia zmian w GeneralAgentService.js i GeneralAgentSources.js.
