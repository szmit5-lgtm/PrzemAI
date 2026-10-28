# PrzemAI — dostęp do agentów per użytkownik (RBAC)

Status: wymaganie zaakceptowane biznesowo; implementacja do wykonania na stagingu. Bez zmian produkcyjnej bazy/API.

## Cel
Administrator przypisuje każdej osobie wybranych agentów (np. Trader AI tylko administratorowi; Construction AI pracownikom budowy; Finance/KSeF księgowości). Brak dostępu oznacza brak widoczności i brak możliwości użycia API.

## Model uprawnień
- User, Organization/Company, OrganizationMembership (role: OWNER/ADMIN/MEMBER), AgentDefinition, UserAgentGrant (userId, agentKey, organizationId, grantedBy, createdAt, revokedAt), AgentActionGrant (opcjonalnie READ/RUN/CONFIGURE/APPROVE).
- Domyślnie brak dostępu (deny by default); dostęp administratora do konfiguracji tylko w jego organizacji. Unikać globalnego ADMIN bez kontekstu organizacji.
- Agenty i dane odseparowane między organizacjami. Uprawnienie do agenta nie daje automatycznie dostępu do wszystkich faktur, projektów, korespondencji czy kont finansowych.
- Trading: oddzielić podgląd analiz od składania zleceń; jakiekolwiek operacje finansowe wymagają osobnych uprawnień i jawnych potwierdzeń.

## UI
- Admin -> Użytkownicy -> wybór osoby -> lista agentów z przełącznikami; opcjonalnie role/szablony (budowa, księgowość, zarząd).
- Zapis i audit: kto nadał/cofnął dostęp i kiedy. Po cofnięciu natychmiast zablokować API i trwające zadania wrażliwe.
- Nawigacja użytkownika pokazuje wyłącznie przydzielonych agentów. Próba wejścia bez dostępu: 403, nie wyciek danych.

## Backend
- Middleware requireAgentAccess(agentKey, action) na wszystkich trasach agenta, jobach, webhookach i zadaniach workera; nie polegać na ukrywaniu UI.
- Każdy job zapisuje ownerUserId, organizationId i agentKey; worker weryfikuje uprawnienia przed wykonaniem.
- Bezpieczna migracja z istniejących User/AgentConfig, zgodność wsteczna dla administratora; żadne uprawnienia nie powinny zostać przypadkowo rozszerzone.
- Testy: dwa konta w jednej organizacji, izolacja między organizacjami, cofnięcie uprawnienia, bezpośrednie wywołanie API, worker, brak dostępu do Trader AI.

## Kryteria odbioru
1. Admin może nadać i cofnąć dostęp do każdego agenta indywidualnie.
2. Użytkownik widzi tylko przydzielonych agentów.
3. Bez uprawnienia nie można uruchomić agenta ani odczytać jego danych przez API.
4. Każda zmiana uprawnień trafia do dziennika audytu.
5. Produkcyjne API i baza pozostają bez zmian do osobnego zatwierdzenia migracji.
