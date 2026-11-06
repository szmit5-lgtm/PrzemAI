"use strict";
const catalog=Object.freeze([["financial","FINANCIAL","Financial Agent","KSeF, faktury i finanse","Pobiera faktury z KSeF, zestawia wartości, terminy i kontrahentów, a także dopasowuje faktury do inwestycji.","Synchronizacja KSeF;Zestawienia VAT i kwot;Powiązanie z inwestycjami","Bez integracji bankowej nie potwierdza zapłaty.","LIVE_FINANCE",15],["sales","SALES","Sales Agent","Sprzedaż, CRM i kontakt z klientami","Przyjmuje zadania związane z pozyskiwaniem klientów, rozwojem sprzedaży, ofertami, follow-upem i obsługą lejka sprzedażowego.","Rejestr spraw i klientów;Projekty kontaktów;Follow-up i plan sprzedaży","Nie wysyła wiadomości, nie publikuje i nie przeszukuje sieci bez osobnej integracji.","TASK_DRAFT",15],["offer","OFFER","Offer Agent","Oferty budowlane i handlowe","Tworzy projekty ofert dla budownictwa, instalacji i schronów na podstawie podanych danych, zakresów oraz cen.","Szkice ofert;Zakresy prac;Lista pytań do wyceny","Nie wymyśla cen ani nie wysyła ofert klientom.","TASK_DRAFT",30],["task","TASK","Task Agent","Zadania i terminy","Rozbija zadane przedsięwzięcia na konkretne czynności, priorytety, terminy i osoby odpowiedzialne.","Plan działania;Checklisty;Priorytety i terminy","Automatyczne wpisy w zewnętrznym kalendarzu wymagają integracji.","TASK_DRAFT",30],["mail","MAIL","Mail Agent","E-maile i ponaglenia","Przygotowuje odpowiedzi na korespondencję, ponaglenia i profesjonalne wiadomości na podstawie przekazanej treści.","Szkice maili;Ponaglenia;Odpowiedzi handlowe","Nie wysyła i nie czyta automatycznie cudzych skrzynek.","TASK_DRAFT",30],["document","DOCUMENT","Document Agent","Umowy i dokumentacja","Analizuje wklejone dokumenty i tworzy streszczenia, listy ryzyk, projekt pism oraz zestawienia terminów.","Analiza tekstu;Ryzyka umów;Projekty pism","Pliki z zakładki Dokumenty nie są jeszcze automatycznie podłączane do zleceń tego agenta.","TASK_DRAFT",30],["meeting","MEETING","Meeting Agent","Spotkania i decyzje","Opracowuje przesłane notatki spotkań w protokół, decyzje i zadania z terminami.","Protokół spotkania;Decyzje;Zadania po spotkaniu","Nagrania dźwiękowe wgrywa się osobno w zakładce Spotkania.","TASK_DRAFT",30],["construction","CONSTRUCTION","Construction Agent","Budowy i wykonawcy","Tworzy raport postępu budowy, identyfikuje ryzyka, opóźnienia, braki i kolejność działań z otrzymanych informacji.","Raport budowy;Harmonogram działań;Lista ryzyk","Nie obserwuje placu budowy bez przekazanych danych.","TASK_DRAFT",30],["communication","COMMUNICATION","Communication Agent","WhatsApp i komunikacja","Redaguje wiadomości do klientów, partnerów, wspólników i dostawców po polsku i angielsku.","Wiadomości WhatsApp;Wersje PL/EN;Plan komunikacji","Wysyłka i odbiór WhatsApp wymagają osobnej autoryzowanej integracji.","TASK_DRAFT",30],["executive","EXECUTIVE","Executive Agent","Koordynacja firmy i decyzje","Porządkuje priorytety, ryzyka, decyzje i delegowane tematy; tworzy plan działania zarządu.","Plan priorytetów;Raport zarządczy;Lista decyzji","Nie wykonuje automatycznie przelewów ani działań w niepodłączonych usługach.","TASK_DRAFT",30,["investment","INVESTMENT","Investment Agent","Inwestycje, opłacalność i analizy nieruchomości","Analizuje projekty deweloperskie, opłacalność inwestycji, szacowane koszty, PUM i warianty finansowania na podstawie dostarczonych danych.","Analiza PUM i chłonności;Scenariusze kosztów i przychodów;Wykaz ryzyk inwestycji","Nie pobiera samodzielnie planów miejscowych, wycen rynkowych ani dokumentów z urzędów. Prognozy nie są gwarancją zysku.","TASK_DRAFT",30],["research","RESEARCH","Research Agent","Analizy rynku i dostawców","Przygotowuje plany badań rynku, porównania dostawców i listy pytań na podstawie informacji oraz źródeł przekazanych w zleceniu.","Porównywanie otrzymanych ofert;Plan poszukiwania klientów;Kryteria oceny dostawców","W obecnym trybie nie przeszukuje na żywo internetu i nie weryfikuje aktualnych danych o firmach.","TASK_DRAFT",30],["secretary","SECRETARY","Secretary Agent","Sekretariat, spotkania i organizacja","Porządkuje sprawy sekretariatu, przygotowuje harmonogram kontaktów, wiadomości, notatki oraz propozycje terminów spotkań.","Plan kontaktów i spotkań;Notatki i przypomnienia;Szkice zaproszeń","Nie dzwoni, nie wysyła wiadomości i nie rezerwuje terminów w kalendarzu bez integracji.","TASK_DRAFT",30],["legal","LEGAL","Legal Agent","Umowy, formalności i ryzyka prawne","Pomaga uporządkować postanowienia umów, terminy, brakujące załączniki, ryzyka formalne oraz przygotować robocze projekty pism.","Lista ryzyk w umowie;Terminy i formalności;Projekty pism i aneksów","Nie zastępuje radcy prawnego lub adwokata. Przepisy wymagają niezależnej weryfikacji aktualnego stanu prawnego.","TASK_DRAFT",30],["shopping","SHOPPING","Shopping Agent","Zakupy i porównywanie ofert","Zestawia otrzymane oferty produktów i usług, analizuje parametry i całkowite koszty zakupu, proponuje kryteria wyboru.","Tabele porównawcze ofert;Lista kryteriów i pytań;Analiza kosztów zakupu","Nie sprawdza bieżących cen ani stanów magazynowych i nie składa zamówień bez integracji.","TASK_DRAFT",30],["trading","TRADING","Trading Agent","Analiza rynków i scenariuszy","Porządkuje dane rynkowe dostarczone w zleceniu, przygotowuje scenariusze, analizę ryzyka i podsumowania strategii.","Scenariusze rynkowe;Analiza ekspozycji i ryzyka;Porównanie założeń strategii","Nie ma dostępu do notowań na żywo, nie wykonuje transakcji i nie daje gwarantowanych sygnałów inwestycyjnych.","TASK_DRAFT",30],["commerce","COMMERCE","Commerce AI (Allegro)","Sprzedaż internetowa i marketplace","Przygotowuje opisy produktów, tytuły ofert, zestawienia wariantów oraz plan obsługi sprzedaży na Allegro i podobnych platformach.","Treść kart produktowych;Plan publikacji i obsługi;Analiza przekazanych danych sprzedaży","Nie jest jeszcze połączony z Allegro, nie pobiera zamówień i nie publikuje ofert automatycznie.","TASK_DRAFT",30]]].map(([key,type,name,headline,description,caps,limitations,mode,intervalMinutes])=>Object.freeze({key,type,name,headline,description,capabilities:caps.split(";"),limitations,mode,intervalMinutes})));

const integratedModules=Object.freeze([
  Object.freeze({
    key:"general",name:"General",headline:"Asystent ogólny i rozmowy",
    description:"Prowadzi ogólne rozmowy i pomaga porządkować sprawy w czacie PrzemAI.",
    mode:"INTEGRATED",href:"/chat",linkedTo:"Czat PrzemAI",
    limitations:"To funkcja czatu, a nie dodatkowy niezależny worker."
  }),
  Object.freeze({
    key:"ksef",name:"KSeF",headline:"Faktury i integracja z Krajowym Systemem e-Faktur",
    description:"Pobieranie faktur, XML, metadanych i ich klasyfikacja jest obsługiwana przez Financial Agent.",
    mode:"INTEGRATED",href:"/finance",linkedTo:"Financial Agent",
    limitations:"Nie powielamy dostępu do KSeF w osobnym workerze."
  }),
  Object.freeze({
    key:"personal",name:"Personal Assistant",headline:"Osobisty asystent i rozmowy",
    description:"Osobista przestrzeń rozmów oraz przygotowywania poleceń i codziennych zadań.",
    mode:"INTEGRATED",href:"/chat",linkedTo:"Asystent PrzemAI",
    limitations:"Pełne integracje kalendarza i komunikacji wymagają oddzielnego podłączenia."
  })
]);
const examples=Object.freeze({
  financial:["Pokaż faktury bez przypisanej inwestycji","Jakie faktury otrzymaliśmy w tym kwartale?"],
  sales:["Przygotuj follow-up do zainteresowanego inwestora","Rozpisz kolejne kroki sprzedaży schronów"],
  offer:["Przygotuj projekt oferty na prefabrykację","Wypisz pytania do wyceny instalacji"],
  task:["Zrób checklistę odbiorów w Mielnie","Rozpisz harmonogram prac"],
  mail:["Przygotuj odpowiedź na reklamację","Napisz grzeczne ponaglenie"],
  document:["Przeanalizuj przekazaną umowę","Wypisz ryzyka i terminy z aneksu"],
  meeting:["Zrób protokół z notatek spotkania","Wypisz decyzje ze spotkania"],
  construction:["Przygotuj raport postępu w Zgorzelcu","Uporządkuj zaległe odbiory"],
  communication:["Przygotuj wiadomość WhatsApp","Napisz krótką wiadomość po angielsku"],
  executive:["Uporządkuj priorytety na jutro","Przygotuj listę decyzji dla zarządu"],
  investment:["Policz warianty rentowności projektu","Porównaj scenariusze PUM i kosztów"],
  research:["Porównaj dostawców na podstawie trzech ofert","Przygotuj plan badania rynku schronów"],
  secretary:["Zaplanuj kolejność kontaktów na jutro","Przygotuj zaproszenie na spotkanie"],
  legal:["Wypisz ryzyka z otrzymanej umowy","Przygotuj roboczy projekt wezwania"],
  shopping:["Porównaj trzy otrzymane oferty","Wybierz kryteria oceny sprzętu"],
  trading:["Przeanalizuj scenariusze ryzyka","Uporządkuj założenia strategii"],
  commerce:["Napisz tytuł i opis aukcji Allegro","Przygotuj listę danych do karty produktu"]
});

const getAgentDefinition=key=>catalog.find(a=>a.key===key)||null;
module.exports={catalog,getAgentDefinition,integratedModules,examples};

