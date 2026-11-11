# WhatsApp Agent — półautomatyczny tryb PrzemAI

Status: zatwierdzona specyfikacja produktu (2026-11-11), **nie oznacza aktywnej integracji ani wdrożenia**.

## Cel
Obsługa uprawnionych konwersacji WhatsApp indywidualnych z zachowaniem obecnego numeru, historii i grup użytkownika, o ile zgodność z oficjalnymi zasadami WhatsApp Business Platform i kwalifikacja do Coexistence pozwalają na takie działanie. Nie migrować ani nie usuwać prywatnego konta bez osobnego, wyraźnego zatwierdzenia użytkownika. Istniejące grupy i prywatna historia nie są automatycznie dostępne przez API. Eksporty historii importować wyłącznie na polecenie użytkownika.

## Tryb domyślny: SEMI_AUTOMATIC
1. Agent może samodzielnie prowadzić rutynową, zatwierdzoną konwersację: pytać o ofertę, status, dokumenty i terminy, prosić o doprecyzowanie, wysyłać uprzejme przypomnienia oraz negocjować niewiążąco w ustalonych granicach.
2. Agent NIE może bez wyraźnej, jednorazowej akceptacji właściciela: zaakceptować ostatecznej ceny, udzielić rabatu, złożyć zamówienia, zawrzeć lub zmienić umowy, przyjąć zobowiązania finansowego, uzgodnić wiążącego terminu zapłaty, obiecać płatności, udostępnić poufnych dokumentów ani rozszerzać dostępu do danych.
3. W odpowiednim momencie agent jasno ujawnia, że działa jako asystent AI reprezentujący użytkownika; nie podszywa się pod człowieka.
4. Gdy stawka, kontekst lub intencja są niejasne, agent przechodzi do stanu NEEDS_APPROVAL lub HUMAN_HANDOFF; nie zgaduje.
5. Właściciel ma dostęp do pauzy globalnej i per konwersacja; ręczna odpowiedź właściciela przejmuje sterowanie, aby uniknąć wyścigu i podwójnych odpowiedzi.

## Zgody i ograniczenia komunikacji
- Wysyłka tylko do kontaktów z odpowiednią podstawą i zgodą na komunikację, zgodnie z obowiązującymi zasadami WhatsApp.
- Kontrolować 24-godzinne okno obsługi; poza nim używać wyłącznie dopuszczonych szablonów, jeżeli wymagane.
- Limity częstotliwości, deduplikacja, brak spamowania i respektowanie rezygnacji z kontaktu.
- Funkcje zależne od konkretnej integracji Meta/BSP muszą być zweryfikowane przed włączeniem.
- Nie wykorzystywać nieoficjalnej automatyzacji WhatsApp Web i nie przechowywać haseł, kodów SMS ani tokenów w kodzie.

## Zdarzenia, dane i uprawnienia
- Rejestrować inbound/outbound, czas, źródło, firmę, projekt, identyfikator konwersacji, wersję reguł i autora działania.
- Stany wiadomości: RECEIVED, DRAFTED, APPROVAL_REQUIRED, APPROVED, SENT, FAILED, HANDED_OFF.
- Akceptacja podpisana przez właściciela: identyfikator operatora, czas, treść dokładnie zatwierdzona, zakres i jednorazowość; zmiana treści unieważnia akceptację.
- Kontekst finansowy i prawny oznaczać jako wymagający zatwierdzenia niezależnie od pewności modelu.
- Minimalizacja danych, szyfrowanie w tranzycie i spoczynku, retencja, usuwanie, RBAC, separacja danych spółek.
- Bez publikacji treści konwersacji do logów i telemetryki; sekrety tylko w bezpiecznych zmiennych środowiskowych.
- Webhook: weryfikacja podpisu, idempotencja, odporność na ponowienie, kolejka i limit błędów.
- Raport: sprawy wymagające decyzji, terminy i brak odpowiedzi, z linkiem do rozmowy i pochodzeniem ustaleń.

## Wdrożenie etapowe
1. Backup i weryfikacja historii na iPhone; nie usuwać konta.
2. Weryfikacja możliwości przejścia do WhatsApp Business App na dotychczasowym numerze, a następnie kwalifikacji Coexistence u oficjalnego dostawcy. Nie zakładać automatycznej kwalifikacji.
3. Import wybranych eksportów czatów/grup i wydobywanie zadań (bez bieżącej synchronizacji prywatnych grup).
4. Oficjalne połączenie API/webhook dla obsługiwanych rozmów indywidualnych.
5. Najpierw dry-run, potem test z kontrolowanym kontaktem, dopiero potem ograniczone uruchomienie SEMI_AUTOMATIC.
6. Domyślne uprawnienie nowego kontaktu: tylko szkic / wymagana akceptacja. Samodzielna wysyłka wymaga jawnego dopuszczenia konwersacji lub reguły.

## Kryteria akceptacji
- Żadna wiadomość wymagająca akceptacji nie wychodzi bez zatwierdzenia dokładnej treści.
- Każda wiadomość wychodząca posiada ślad audytowy i regułę zezwalającą na wysyłkę.
- Pauza zatrzymuje wysyłanie; awaria webhooku nie powoduje dubli.
- Nie ma deklaracji obsługi grup w czasie rzeczywistym ani dostępu do prywatnej historii, którego API nie zapewnia.
- Brak aktywacji produkcyjnej przed testami i zgodą właściciela.
