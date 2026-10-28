# Agent Telefoniczny AI — wymagania (2026-10-28)

Status: plan, bez aktywnej telefonii ani połączeń.

## Cel
Agent wykonuje wychodzące połączenia do kontrahentów w celu wyjaśnienia faktur i dostaw, np. ustalenia, na którą inwestycję trafił towar. Współpracuje z Agentem Finansowym/KSeF i modułem projektów (Barwice, Zgorzelec, Mielno itd.).

## Przepływ MVP
1. Finance Agent wykrywa fakturę bez jednoznacznego przypisania do projektu.
2. Najpierw próbuje dopasować fakturę z zamówieniem, WZ, dostawą i korespondencją.
3. Generuje propozycję połączenia: kontrahent, zweryfikowany numer, cel, numer faktury, pytania, przewidywany koszt.
4. Użytkownik zatwierdza pojedyncze połączenie; system respektuje dozwolone godziny i budżet.
5. Provider telefonii zestawia połączenie, agent jawnie przedstawia się jako AI reprezentujące wskazaną firmę.
6. Agent pyta tylko o dane niezbędne do identyfikacji dostawy i faktury; nie przekazuje danych wrażliwych.
7. Po rozmowie zapisuje podsumowanie, źródło informacji, stopień pewności, ewentualny transkrypt tylko gdy legalnie dozwolony.
8. Finance Agent proponuje przypisanie do inwestycji; przypadki niejednoznaczne wymagają zatwierdzenia przez człowieka.

## Architektura
- Telephony provider adapter (SIP/VoIP, programmable outbound calls, webhooks, audio streaming); wybór operatora po analizie dostępności numerów PL, cen, RODO i jakości polskiego TTS/STT.
- Realtime speech pipeline, tool calling with strict scoped permissions, interruption handling, call timeouts, retry budget.
- CallRequest/CallSession/CallOutcome entities, tenantId and projectId, immutable audit logs and costs.
- No automatic mass dialing, no impersonation, no payments or binding commercial commitments without human approval.
- Verify recipient identity before discussing invoice details; opt-out and do-not-call controls.
- Consent/information requirements and recording policy reviewed for Polish/EU law before production.

## Acceptance tests
- Unapproved calls cannot start.
- Tenant A cannot access tenant B call records or trigger calls as B.
- Unknown numbers are never dialed automatically.
- Failed calls and voicemail do not falsely mark invoices as explained.
- A disputed project assignment is flagged for human review.
