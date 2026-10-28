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


## Obieg finansowy po zatwierdzeniu technicznym
1. APPROVED_TECHNICALLY uruchamia kalkulację kosztu z zatwierdzonych stawek umownych, pozycji kosztorysu lub ręcznie zweryfikowanej wyceny. System zapisuje źródło każdej stawki, ilość, jednostkę, VAT, sumę netto i brutto, walutę oraz ważność oferty. Brak wiarygodnych danych = COST_REVIEW_REQUIRED, bez zgadywania kwoty.
2. Po przygotowaniu wyceny i wskazaniu adresata system generuje e-mail: identyfikator zmiany, inwestycja, opis i uzasadnienie, rysunek przed/po, zdjęcia, ilości, pozycje kosztowe, kwota netto/VAT/brutto, wpływ na termin, termin odpowiedzi, link do bezpiecznego zatwierdzenia.
3. Automatyczna wysyłka jest dozwolona tylko do wcześniej skonfigurowanych uprawnionych odbiorców i po potwierdzeniu wyceny przez uprawnioną osobę po stronie wykonawcy. W przeciwnym razie powstaje szkic do zatwierdzenia. Wszystkie wysyłki są audytowane i idempotentne.
4. Odbiorca wybiera ACCEPT_PRICE / NEGOTIATE / REJECT_PRICE. Odpowiedź e-mail nie jest traktowana jako autoryzowana akceptacja bez potwierdzenia tożsamości; preferowany bezpieczny link z uwierzytelnieniem. System rejestruje osobę, czas, wersję i zatwierdzoną kwotę.
5. Dopiero ACCEPT_PRICE powoduje aktualizację rejestru robót dodatkowych i prognozy budżetu. Nie oznacza automatycznie prawa do wystawienia faktury ani zgody na wykonanie robót, jeśli umowa wymaga odrębnego zlecenia lub aneksu.
6. Zmiana kwoty po wysyłce tworzy nową wersję i ponowną akceptację; poprzednie zatwierdzenie nie przenosi się automatycznie.

Stany finansowe: NOT_PRICED -> COST_REVIEW_REQUIRED -> PRICE_READY -> PRICE_SENT -> PRICE_ACCEPTED | PRICE_REJECTED | PRICE_NEGOTIATION.
Dodatkowe pola: costEstimateVersion, costLines, netAmount, vatAmount, grossAmount, currency, pricingSource, costApprovedBy, costApprovedAt, recipientUserId, recipientEmail, emailSentAt, priceDecisionAt, priceDecisionBy, priceDecisionComment, contractualBasis, scheduleImpactDays.
Testy: brak stawek, błędny VAT, nieuprawniony adresat, powtórne wysłanie, ponowna akceptacja zmienionej kwoty, błędny token akceptacji, odmowa, brak podstawy umownej.


## Wymagany dwustopniowy obieg akceptacji (ustalenie biznesowe)
1. Pracownik zgłasza zmianę; agent przygotowuje raport, rysunek z adnotacją, zakres robót oraz kosztorys.
2. Uprawniona osoba po stronie Dekonica zatwierdza **zarówno zakres, jak i kwotę** (INTERNAL_SCOPE_AND_PRICE_APPROVED). Wcześniejsza akceptacja techniczna, jeśli wymagana, jest osobnym krokiem.
3. **Bezpośrednio po tej wewnętrznej akceptacji** system automatycznie wysyła klientowi e-mail z prośbą o zatwierdzenie **zakresu prac oraz kwoty**. Nie wymaga dodatkowego ręcznego kliknięcia „Wyślij”, jeżeli adresat jest wcześniej zatwierdzony i konfiguracja wysyłki jest aktywna.
4. E-mail zawiera: inwestycję, numer zgłoszenia, opis i dokładny zakres, zdjęcia, rysunek z oznaczeniem, wycenę netto/VAT/brutto, wpływ na termin, termin odpowiedzi i jednoznaczną prośbę o potwierdzenie zakresu oraz ceny. Załączniki i link akceptacyjny powinny być dostępne wyłącznie uprawnionym odbiorcom.
5. Klient może: ACCEPT_SCOPE_AND_PRICE, REQUEST_CHANGES lub REJECT. Odpowiedź rejestrowana jest z identyfikacją osoby, datą i wersją dokumentów. Sama dostawa wiadomości nie oznacza zgody; brak odpowiedzi również nie jest zgodą.
6. Dopiero akceptacja klienta obu elementów pozwala oznaczyć zmianę jako CLIENT_APPROVED i przekazać do realizacji zgodnie z warunkami umowy (np. po wymaganym aneksie lub zleceniu). Odrzucenie lub zmiana zakresu/kwoty wymaga ponownej wewnętrznej akceptacji i ponownego wysłania do klienta.
7. E-mail wysyłany jest przez kolejkę z retry i kluczem idempotencji per wersja zmiany + klient, aby uniknąć duplikatów. Błąd wysyłki daje status DELIVERY_FAILED i alert do osoby prowadzącej; nie zmienia statusu na „zaakceptowane”.

Przykładowe stany: INTERNAL_REVIEW -> INTERNAL_SCOPE_AND_PRICE_APPROVED -> CLIENT_APPROVAL_EMAIL_QUEUED -> CLIENT_APPROVAL_REQUESTED -> CLIENT_APPROVED | CLIENT_REJECTED | CLIENT_CHANGES_REQUESTED.
