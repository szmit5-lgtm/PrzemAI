# Construction Drawing AI — agent zmian na budowie

Status: PLANOWANY / specyfikacja MVP. Właściciel: PrzemAI. Nie jest to funkcja wdrożona.

## Cel
Pracownik na budowie wysyła zdjęcia, opis tekstowy lub nagranie głosowe. System przygotowuje raport zmiany, oznacza jej proponowane położenie na **kopii** właściwego rysunku i przesyła do uprawnionej osoby do weryfikacji. Żadna propozycja AI nie staje się dokumentacją obowiązującą bez zatwierdzenia.

## Przepływ
1. Przyjęcie zgłoszenia z panelu WWW lub w przyszłości Telegram/WhatsApp: inwestycja, autor, czas, zdjęcia, audio, opis, opcjonalnie numer pomieszczenia, kondygnacja, branża.
2. Transkrypcja audio, ekstrakcja treści, powiązanie z inwestycją i rysunkiem/rewizją. Gdy identyfikacja jest niepewna, status NEEDS_CLARIFICATION; brak automatycznego zgadywania położenia.
3. Raport: opis stanu istniejącego i proponowanej zmiany, przyczyna, zdjęcia, miejsce na rysunku, wpływ na inne branże, ryzyka, pytania do zatwierdzającego.
4. Naniesienie **adnotacji** na kopię PDF/obrazu (chmurka rewizyjna, numer zgłoszenia, strzałka, legenda), zachowanie oryginału i historii wersji. Edycja DWG/IFC dopiero po osobnym sprawdzeniu formatów i zgodności.
5. Przekazanie do wyznaczonego zatwierdzającego: ACCEPT / REJECT / REQUEST_INFO; powiadomienie i przypomnienia bez automatycznej akceptacji.
6. Po akceptacji: archiwizacja decyzji, raportu i zatwierdzonej adnotacji; formalna zmiana projektu wyłącznie przez osobę z wymaganymi uprawnieniami.

## Stany
RECEIVED -> PROCESSING -> NEEDS_CLARIFICATION | PENDING_APPROVAL -> APPROVED | REJECTED | REQUEST_INFO.
Po REQUEST_INFO kolejne materiały wracają do PROCESSING, z zachowaniem historii.

## Minimalne dane
ChangeReport: id, projectId, createdByUserId, createdAt, sourceChannel, description, transcript, discipline, buildingLevel, room, drawingId, drawingRevision, proposedAnnotationFileId, status, confidence, assignedReviewerUserId, reviewedAt, reviewComment, version.
Attachment: id, reportId, mimeType, originalName, objectStorageKey, sha256, createdAt.
AuditEvent: id, reportId, actorUserId, action, timestamp, metadata (bez sekretów).

## Bezpieczeństwo i jakość
- Uprawnienia per inwestycja i rola, odrębne role zgłaszającego i zatwierdzającego.
- Antywirus/skanowanie i limity rozmiaru plików; walidacja MIME, retencja i bezpieczne przechowywanie.
- Dane osobowe na zdjęciach i nagraniach: minimalizacja, ograniczony dostęp, zgodna z polityką retencja.
- Odporność na duplikaty (idempotency key), kolejka/retry, brak podwójnych powiadomień.
- Wersjonowanie rysunków, jednoznaczne oznaczenie „PROPOZYCJA — NIEZATWIERDZONE”.
- Gdy brak rysunku lub pewnej lokalizacji, raport bez nanoszenia zmian i prośba o uzupełnienie.
- Log zdarzeń, terminów i decyzji. Zmiany konstrukcyjne/instalacyjne wymagają weryfikacji przez właściwego specjalistę.

## MVP / kryteria akceptacji
- Pracownik zgłasza zmianę przez WWW z 1 zdjęciem i opisem lub audio.
- AI generuje edytowalny raport; użytkownik wybiera poprawny rysunek PDF i wskazuje miejsce.
- System zapisuje adnotację na kopii, wysyła powiadomienie do wybranego zatwierdzającego.
- Zatwierdzający akceptuje, odrzuca lub prosi o uzupełnienie; wszystkie decyzje są audytowane.
- Testy: brak uprawnień, zły format pliku, nieznany rysunek, duplikat, konflikt wersji, ponowienie zadania, odmowa akceptacji.

## Kolejne etapy
Automatyczne rozpoznawanie pomieszczenia na rysunku; porównanie rewizji; integracje CAD/BIM (DWG/IFC), obieg zmian z projektantem i kierownikiem budowy; raporty dzienne i kosztowe.
