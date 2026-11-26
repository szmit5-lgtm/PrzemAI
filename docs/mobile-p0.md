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

`mobile/` zawiera projekty Capacitor, wersjonowane zależności, identyfikator `com.dekonica.przemai`, ikony i opisy uprawnień. Wariant z adresem HTTPS służy do testów na odizolowanym stagingu. Capacitor dokumentuje `server.url` jako tryb deweloperski. Przed publikacją trzeba wybrać dystrybucję z lokalnie spakowanym interfejsem i mobilną sesją API albo natywny interfejs. Przy dystrybucji Android z utrzymaniem PWA można rozważyć Trusted Web Activity z Digital Asset Links. Na iOS trzeba zweryfikować wymagania App Store dotyczące minimalnej funkcjonalności aplikacji.

```sh
cd mobile
npm ci
npm test
PRZEMAI_MOBILE_STAGING_ORIGIN=https://staging.example.test npm run sync
(cd android && ./gradlew assembleDebug)
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

Android wymaga JDK 21 i Android SDK API 36. iOS wymaga macOS z obsługiwanym Xcode. `npm run sync` bez zmiennej zapisuje w projektach lokalny ekran informacyjny. Adres stagingu, klucze podpisu i profile dystrybucji są ustawieniami lokalnymi. Przed publikacją potwierdź identyfikator pakietu, obsługę aparatu i mikrofonu na urządzeniach, podpisywanie oraz informacje o prywatności w obu sklepach.
