"use client";

import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {
  ArrowLeft,Bot,ChevronRight,Clock3,Headphones,LoaderCircle,Menu,
  MessageCircle,MessageSquare,MessageSquarePlus,Mic,MicOff,Send,
  ShieldCheck,Sparkles,Trash2,Volume2,VolumeX,X
} from "lucide-react";
import WhatsAppHistoryLink from "./WhatsAppHistoryLink";
import Navbar from "../components/Navbar";
import UserMenu from "../components/UserMenu";
import {
  parseChatListResponse,parseChatDetailResponse, mergePendingChatMessages,
  parseChatSendResponse,parseChatArchiveResponse
} from "@/lib/chatDashboardPayload";
import {
  sendChatMessage,getConversations,getConversation,deleteConversation,transcribeVoice,getOrganizations,
  sendChatAttachment,downloadChatReport,sendChatReportToTelegram,getInvestmentPanel
} from "@/lib/api";
import {combineVoiceText,shouldSubmitVoiceTurn} from "@/lib/voiceInputPayload";

const welcomeMessage={
 role:"assistant",
 content:"Cześć! Jestem Asystentem AI PrzemAI. Pomogę Ci uporządkować zadania, dokumenty, spotkania i sprawy firmy. Możemy też wspólnie przygotować polecenie dla konkretnego agenta. W czym mogę pomóc?"
};
const starters=[
 "Pomóż mi ustalić priorytety na dziś",
 "Przygotuj plan rozmowy z klientem",
 "Podsumuj zadania i sprawy do załatwienia"
];
export default function ChatPage(){
 const [conversations,setConversations]=useState([]);
 const [activeConversationId,setActiveConversationId]=useState(null);
 const [messages,setMessages]=useState([welcomeMessage]);
 const [message,setMessage]=useState("");
 const [attachment,setAttachment]=useState(null);
 const [sharedId,setSharedId]=useState(false);
 const [reportStatus,setReportStatus]=useState("");
 const [organizations,setOrganizations]=useState([]);
 const [organizationId,setOrganizationId]=useState("");
 const selectedScope=organizations.some(org=>org.id===organizationId)?organizationId:"";
 const [loading,setLoading]=useState(false);
 const [loadingConversations,setLoadingConversations]=useState(true);
 const [loadingConversation,setLoadingConversation]=useState(false);
 const [conversationsError,setConversationsError]=useState(false);
 const [error,setError]=useState("");
 const [sidebarOpen,setSidebarOpen]=useState(false);
 const [listening,setListening]=useState(false);
 const [voiceSupported,setVoiceSupported]=useState(false);
 const [speakReplies,setSpeakReplies]=useState(false);
 const [voiceError,setVoiceError]=useState("");
 const [voiceMode,setVoiceMode]=useState(false);
 const [transcribing,setTranscribing]=useState(false);
 const messagesEndRef=useRef(null);
 const recognitionRef=useRef(null);
 const recorderRef=useRef(null);
 const recorderFallbackRef=useRef(false);
 const transcribingRef=useRef(false);
 const speakRepliesRef=useRef(false);
 const voiceModeRef=useRef(false);
 const voiceTurnRef=useRef(null);
 const loadingRef=useRef(false);
 const pendingRequestRef=useRef(null);

 const hasPending=messages.some(item=>item.pending);
 useEffect(()=>{
   if(!activeConversationId||!hasPending)return;
   const cancellation = new AbortController();
   let timer;
   let delay = 2500;
   async function poll() {
     if (cancellation.signal.aborted) return;
     if (document.visibilityState === "visible" && navigator.onLine) {
       try {
         const response = await getConversation(activeConversationId, cancellation.signal);
         const data = parseChatDetailResponse(response, activeConversationId);
         if (!cancellation.signal.aborted) setMessages(items => mergePendingChatMessages(items, data.messages));
         delay = 2500;
       } catch {
         delay = Math.min(delay * 2, 30000);
       }
     }
     if (!cancellation.signal.aborted) timer = setTimeout(poll, delay);
   }
   timer = setTimeout(poll, delay);
   return () => { cancellation.abort(); clearTimeout(timer); };
 },[activeConversationId,hasPending]);

 useEffect(()=>{
   let active=true;
   getOrganizations().then(result=>{
     if(active&&Array.isArray(result?.data))setOrganizations(result.data.filter(org=>org.status==="ACTIVE"));
   }).catch(()=>{});
   return ()=>{active=false;};
 },[]);
 useEffect(()=>{
   // Even where Web Speech API is absent, MediaRecorder can capture short turns
   // for transcription by PrzemAI's existing backend.
   setVoiceSupported(Boolean(window.SpeechRecognition||window.webkitSpeechRecognition||
     (window.MediaRecorder&&navigator.mediaDevices?.getUserMedia)));
   return()=>{
     if(voiceTurnRef.current)voiceTurnRef.current.cancelled=true;
     recognitionRef.current?.abort();
     if(recorderRef.current){
       recorderRef.current.turn.cancelled=true;
       clearTimeout(recorderRef.current.timer);
       if(recorderRef.current.recorder.state==="recording")recorderRef.current.recorder.stop();
       recorderRef.current.stream.getTracks().forEach(track=>track.stop());
       recorderRef.current=null;
     }
     window.speechSynthesis?.cancel();
   };
 },[]);
 useEffect(()=>{
   const params=new URLSearchParams(window.location.search);
   const organizationId=params.get("organizationId"),investmentId=params.get("investmentId");
   if(!organizationId||!investmentId)return;
   const controller=new AbortController();
   getInvestmentPanel(organizationId,investmentId,controller.signal).then(({data})=>{
     if(controller.signal.aborted)return;
     const prompt=params.get("focus")==="finance"
       ? "Przygotuj pytanie dla Financial Agenta o faktury i koszty inwestycji "
       : "Pomóż mi podsumować stan prac inwestycji ";
     setOrganizationId(organizationId);
     setMessage(current=>current||prompt+JSON.stringify(data.investment.name)+".");
   }).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
   return()=>controller.abort();
 },[]);
 useEffect(()=>{
   loadConversations();
 },[]);
 useEffect(()=>{
   messagesEndRef.current?.scrollIntoView({behavior:"smooth",block:"end"});
 },[messages,loading,loadingConversation]);
 useEffect(()=>{
   speakRepliesRef.current=speakReplies;
 },[speakReplies]);

 function cancelListening(){
   if(voiceTurnRef.current)voiceTurnRef.current.cancelled=true;
   recognitionRef.current?.abort();
   recognitionRef.current=null;
   if(recorderRef.current){
     const active=recorderRef.current;
     active.turn.cancelled=true;
     clearTimeout(active.timer);
     if(active.recorder.state==="recording")active.recorder.stop();
     active.stream.getTracks().forEach(track=>track.stop());
     recorderRef.current=null;
   }
   setListening(false);
 }
 async function startRecorder(){
   if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){
     setVoiceError("Ta przeglądarka nie obsługuje nagrywania dźwięku. Spróbuj Chrome lub Safari.");
     return;
   }
   window.speechSynthesis?.cancel();
   setVoiceError("");
   let stream;
   try{
     stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
     const mimeTypes=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"];
     const preferred=mimeTypes.find(mime=>window.MediaRecorder.isTypeSupported?.(mime));
     const recorder=preferred?new window.MediaRecorder(stream,{mimeType:preferred}):new window.MediaRecorder(stream);
     const mime=(recorder.mimeType||preferred||"").toLowerCase();
     const ext=mime.includes("mp4")?"m4a":mime.includes("ogg")?"ogg":mime.includes("wav")?"wav":"webm";
     const chunks=[];
     const turn={autoSend:voiceModeRef.current,prefix:message,transcript:"",cancelled:false,error:false};
     const active={recorder,stream,turn,timer:null};
     voiceTurnRef.current=turn;
     recorderRef.current=active;
     recorder.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
     recorder.onerror=()=>{
       turn.error=true;
       setVoiceError("Nagrywanie zostało przerwane. Sprawdź dostęp do mikrofonu.");
       setListening(false);
     };
     recorder.onstop=async()=>{
       clearTimeout(active.timer);
       stream.getTracks().forEach(track=>track.stop());
       if(recorderRef.current===active)recorderRef.current=null;
       setListening(false);
       if(turn.cancelled||turn.error){if(voiceTurnRef.current===turn)voiceTurnRef.current=null;return;}
       const blob=new Blob(chunks,{type:mime||"audio/webm"});
       if(blob.size<12||blob.size>2*1024*1024){
         setVoiceError("Nagranie jest puste lub zbyt długie (limit 2 MB). Spróbuj ponownie.");
         return;
       }
       const formData=new FormData();
       formData.append("file",blob,"voice."+ext);
       transcribingRef.current=true;
       setTranscribing(true);
       try{
         const result=await transcribeVoice(formData);
         if(turn.cancelled)return;
         const transcript=typeof result?.transcript==="string"?result.transcript.trim():"";
         if(!transcript)throw Error("Nie rozpoznano wypowiedzi.");
         turn.transcript=transcript;
         const finalText=combineVoiceText(turn.prefix,transcript);
         setMessage(finalText);
         if(shouldSubmitVoiceTurn(turn))send(finalText);
       }catch(error){
         if(!turn.cancelled)setVoiceError(error?.message||"Nie udało się rozpoznać nagrania.");
       }finally{
         if(voiceTurnRef.current===turn)voiceTurnRef.current=null;
         transcribingRef.current=false;
         setTranscribing(false);
       }
     };
     recorder.start(1000);
     setListening(true);
     // Hard stop bounds each transcription cost and prevents unattended audio.
     active.timer=setTimeout(()=>{
       if(recorder.state==="recording")recorder.stop();
     },30000);
   }catch(error){
     stream?.getTracks().forEach(track=>track.stop());
     if(recorderRef.current?.stream===stream)recorderRef.current=null;
     setListening(false);
     setVoiceError(error?.name==="NotAllowedError"?
       "Zezwól PrzemAI na dostęp do mikrofonu w ustawieniach telefonu lub przeglądarki.":
       "Nie udało się rozpocząć nagrywania. Sprawdź mikrofon lub wpisz tekst.");
   }
 }
 function startVoiceMode(){
   if(!voiceSupported||loadingRef.current||loadingConversation)return;
   if(voiceModeRef.current){
     toggleVoiceMode();
     return;
   }
   // One real tap both switches to voice replies and opens the microphone.
   // Keep recognition.start() inside this user gesture for mobile browsers.
   voiceModeRef.current=true;
   setVoiceMode(true);
   setVoiceError("");
   toggleMicrophone();
 }
 function toggleVoiceMode(){
   if(listening)cancelListening();
   const next=!voiceModeRef.current;
   voiceModeRef.current=next;
   setVoiceMode(next);
   setVoiceError("");
   if(next && !window.speechSynthesis)
     setVoiceError("Twoja przeglądarka może nie odczytywać odpowiedzi głosowo.");
   if(!next)window.speechSynthesis?.cancel();
 }
 async function loadConversations(){
   try{
     const result=parseChatListResponse(await getConversations());
     setConversations(result);
     setConversationsError(false);
   }catch(err){
     setConversationsError(true);
     setError(err?.message||"Nie udało się pobrać listy rozmów.");
   }finally{
     setLoadingConversations(false);
   }
 }
 function startNewConversation(){
   if(loadingRef.current||loadingConversation)return;
   cancelListening();
   window.speechSynthesis?.cancel();
   setActiveConversationId(null);
   setAttachment(null);
   setReportStatus("");
   setSharedId(false);
   setMessages([welcomeMessage]);
   setMessage("");
   setError("");
   setSidebarOpen(false);
 }
 async function openConversation(id){
   if(loadingRef.current||loadingConversation||id===activeConversationId)return;
   cancelListening();
   window.speechSynthesis?.cancel();
   setLoadingConversation(true);
   setError("");
   try{
     const result=parseChatDetailResponse(await getConversation(id),id);
     setActiveConversationId(result.id);
     setAttachment(null);
     setReportStatus("");
     setSharedId(false);
     const lastScope=result.messages.findLast(item=>item.role==="user")?.metadata?.organizationId;
     setOrganizationId(lastScope||"");
     setMessages(result.messages?.length?result.messages.map(m=>({
       id:m.id,role:m.role,content:m.content,pending:Boolean(m.metadata?.pending),
       restricted:Boolean(m.metadata?.restricted), organizationId:m.metadata?.organizationId, origin:m.metadata?.origin, sources:m.metadata?.sources
     })):[welcomeMessage]);
     setSidebarOpen(false);
   }catch(err){setError(err?.message||"Nie udało się otworzyć rozmowy.");}
   finally{setLoadingConversation(false);}
 }
 async function archiveConversation(event,id){
   event?.preventDefault?.();
   event?.stopPropagation?.();
   if(!window.confirm("Archiwizować tę rozmowę?"))return;
   setError("");
   try{
     parseChatArchiveResponse(await deleteConversation(id));
     setConversations(current=>current.filter(x=>x.id!==id));
     if(activeConversationId===id)startNewConversation();
   }catch(err){setError(err?.message||"Nie udało się zarchiwizować rozmowy.");}
 }
 function toggleMicrophone(){
   if(listening){
     if(recorderRef.current?.recorder?.state==="recording")recorderRef.current.recorder.stop();
     else recognitionRef.current?.stop();
     return;
   }
   if(loadingRef.current||loadingConversation||transcribingRef.current)return;
   const BrowserRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!BrowserRecognition||recorderFallbackRef.current){
     startRecorder();
     return;
   }
   window.speechSynthesis?.cancel();
   setVoiceError("");
   const recognition=new BrowserRecognition();
   const turn={
     autoSend:voiceModeRef.current,prefix:message,transcript:"",
     cancelled:false,error:false
   };
   voiceTurnRef.current=turn;
   recognition.lang="pl-PL";
   recognition.continuous=false;
   recognition.interimResults=false;
   recognition.onresult=event=>{
     if(turn.cancelled)return;
     const transcript=Array.from(event.results)
       .filter(result=>result.isFinal!==false)
       .map(result=>result[0]?.transcript||"").join(" ").trim();
     if(!transcript)return;
     turn.transcript=transcript;
     setMessage(combineVoiceText(turn.prefix,transcript));
   };
   recognition.onerror=event=>{
     turn.error=true;
     const reason=event.error;
     if(["network","service-not-allowed","audio-capture"].includes(reason)&&
       window.MediaRecorder&&navigator.mediaDevices?.getUserMedia){
       recorderFallbackRef.current=true;
     }
     if(reason!=="aborted"){
       setVoiceError(reason==="not-allowed"||reason==="service-not-allowed"
         ?"Włącz dostęp do mikrofonu w ustawieniach przeglądarki."
         :reason==="no-speech"?"Nie usłyszałem wiadomości. Dotknij mikrofonu i spróbuj ponownie."
         :recorderFallbackRef.current?"Rozpoznawanie w przeglądarce nie działa. Dotknij mikrofonu ponownie — użyję nagrywania.":"Nie udało się rozpoznać mowy. Spróbuj ponownie lub wpisz tekst.");
     }
     setListening(false);
   };
   recognition.onend=()=>{
     if(recognitionRef.current===recognition)recognitionRef.current=null;
     setListening(false);
     if(voiceTurnRef.current===turn)voiceTurnRef.current=null;
     if(shouldSubmitVoiceTurn(turn)){
       // In conversation mode one tap starts recognition, which then sends
       // after speech ends; we deliberately do not auto-reopen a microphone
       // without another user gesture (mobile browser restrictions).
       send(combineVoiceText(turn.prefix,turn.transcript));
     }
   };
   recognitionRef.current=recognition;
   try{recognition.start();setListening(true);}
   catch{
     turn.cancelled=true;
     recognitionRef.current=null;
     setListening(false);
     recorderFallbackRef.current=true;
     if(window.MediaRecorder&&navigator.mediaDevices?.getUserMedia)startRecorder();
     else setVoiceError("Nie udało się uruchomić mikrofonu. Sprawdź uprawnienia lub wpisz tekst.");
   }
 }
 function readAnswer(answer){
   if(!(speakRepliesRef.current||voiceModeRef.current)||!window.speechSynthesis ||
     typeof window.SpeechSynthesisUtterance!=="function")return;
   window.speechSynthesis.cancel();
   const utterance=new window.SpeechSynthesisUtterance(answer);
   utterance.lang="pl-PL";
   utterance.rate=1;
   try{window.speechSynthesis.speak(utterance);}
   catch{setVoiceError("Nie można odtworzyć odpowiedzi. Jej treść jest widoczna w rozmowie.");}
 }
 async function send(textInput){
   const text=typeof textInput==="string"?textInput.trim():message.trim();
   if((!text&&!attachment)||loadingRef.current||loadingConversation)return;
   loadingRef.current=true;
   setLoading(true);
   setError("");
   const temporaryId="temporary-"+Date.now();
   setMessages(current=>[...current,{
     id:temporaryId,role:"user",content:text || attachment.name
   }]);
   setMessage("");
   try{
     const fingerprint=JSON.stringify([text,activeConversationId,selectedScope]);
     if(pendingRequestRef.current?.fingerprint!==fingerprint){
       const bytes=window.crypto.getRandomValues(new Uint8Array(16));
       const id=Array.from(bytes,byte=>byte.toString(16).padStart(2,"0")).join("");
       pendingRequestRef.current={fingerprint,id};
     }
     const requestId=pendingRequestRef.current.id;
     const result=attachment
       ?parseChatSendResponse(await sendChatAttachment(attachment,text,activeConversationId,selectedScope))
       :parseChatSendResponse(await sendChatMessage(text,activeConversationId,selectedScope,requestId));
     setAttachment(null);
     pendingRequestRef.current=null;
     setActiveConversationId(result.conversationId);
     setMessages(current=>[...current,{
       id:result.message?.id||"answer-"+Date.now(),role:"assistant",content:result.answer,pending:Boolean(result.pending),
       organizationId:selectedScope, sources:result.message?.metadata?.sources
     }]);
     readAnswer(result.answer);
     await loadConversations();
   }catch(err){
     setError(err?.message||"Nie udało się wysłać wiadomości.");
     setMessage(text);
     setMessages(current=>current.filter(x=>x.id!==temporaryId));
   }finally{setLoading(false);loadingRef.current=false;}
 }
 async function reportAction(item, action){
   setReportStatus("");
   try{
     if(action==="telegram"){
       const sent=await sendChatReportToTelegram(activeConversationId,item.id,
         ()=>window.confirm("Wysłać ten raport na Twoje powiązane konto Telegram?"));
       if(sent)setReportStatus("Raport wysłany na Telegram.");
     } else await downloadChatReport(activeConversationId,item.id,action);
   }catch(error){setReportStatus(error.message);}
 }
 function handleKeyDown(event){
   if(event.key==="Enter"&&!event.shiftKey){
     event.preventDefault();
     if(!listening)send();
   }
 }
 const busy=loading||loadingConversation||transcribing;
 const voiceReady=voiceSupported&&!busy;
 const displayTitle=conversations.find(c=>c.id===activeConversationId)?.title;
 return <main className="h-[calc(100dvh-82px-env(safe-area-inset-bottom))] min-h-[320px] min-w-0 overflow-hidden bg-[#080e20] text-slate-100 lg:h-auto lg:min-h-screen lg:overflow-x-clip">
  <div className="mx-auto flex h-full min-h-0 w-full max-w-[1900px] min-w-0 flex-col px-0 pb-0 pt-0 sm:px-6 sm:pt-4 lg:h-auto lg:min-h-screen lg:pb-6 lg:px-8">
   <header className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#111c35] px-3 py-2 sm:gap-3 sm:rounded-2xl sm:border sm:px-5 sm:py-3">
    <div className="flex min-w-0 items-center gap-3">
     <Link href="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 font-black text-white">P</Link>
     <div className="min-w-0"><p className="truncate text-base font-extrabold">Przem<span className="text-violet-300">AI</span></p>
      <p className="truncate text-xs text-slate-400">Asystent AI · Centrum rozmów</p>
     </div>
    </div>
    <UserMenu/>
   </header>
   <div className="shrink-0 px-3 sm:px-0 [&>div]:!mb-2 [&>div]:!mt-2"><Navbar/></div>
   <div className="relative mt-0 grid min-h-0 min-w-0 flex-1 overflow-hidden border-y border-white/10 bg-[#101a33] shadow-[0_25px_65px_rgba(0,0,0,.28)] sm:mt-3 sm:rounded-[24px] sm:border lg:h-[min(840px,calc(100dvh-200px))] lg:min-h-[580px] lg:flex-none lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
    {sidebarOpen&&<button type="button" onClick={()=>setSidebarOpen(false)} aria-label="Zamknij panel rozmów" className="absolute inset-0 z-20 bg-black/60 lg:hidden"/>}
    <aside className={(sidebarOpen?"flex":"hidden")+" absolute inset-y-0 left-0 z-30 w-[min(86vw,320px)] min-h-0 min-w-0 flex-col border-r border-white/10 bg-[#0d1730] shadow-2xl lg:static lg:z-auto lg:flex lg:w-auto lg:shadow-none"}>
     <div className="border-b border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
       <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Twoje rozmowy</p>
       <button type="button" onClick={()=>setSidebarOpen(false)} aria-label="Zamknij historię rozmów" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"><X size={18}/></button>
      </div>
      <button type="button" onClick={startNewConversation} disabled={busy}
       className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">
       <MessageSquarePlus size={18}/> Nowa rozmowa
      </button>
     </div>
     <div className="max-h-[38vh] min-h-0 flex-1 space-y-1 overflow-y-auto p-3 lg:max-h-[calc(100dvh-300px)] lg:min-h-[400px]">
      {loadingConversations&&<p className="flex items-center gap-2 p-3 text-xs text-slate-400"><LoaderCircle size={16} className="animate-spin"/> Ładowanie rozmów…</p>}
      {!loadingConversations&&conversationsError&&<p role="alert" className="p-3 text-xs text-rose-300">Lista rozmów jest obecnie niedostępna.</p>}
      {!loadingConversations&&!conversationsError&&conversations.length===0&&<p className="p-3 text-sm text-slate-400">Brak zapisanych rozmów. Zacznij od nowej wiadomości.</p>}
      {conversations.map(c=><div key={c.id} className={"group flex min-w-0 items-center rounded-xl border "+(c.id===activeConversationId?"border-violet-400/30 bg-violet-500/15":"border-transparent hover:border-white/10 hover:bg-white/[.045]")}>
       <button type="button" onClick={()=>openConversation(c.id)} disabled={busy}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 text-left disabled:opacity-60">
        <MessageSquare size={16} className={c.id===activeConversationId?"shrink-0 text-violet-300":"shrink-0 text-slate-500"}/>
        <span className="min-w-0 flex-1">
         <span className="block truncate text-sm font-semibold text-slate-200">{c.title||"Nowa rozmowa"}</span>
         <span className="mt-1 block text-[11px] text-slate-500">{c._count?.messages||0} wiadomości</span>
        </span>
       </button>
       <button type="button" onClick={event=>archiveConversation(event,c.id)} title="Archiwizuj rozmowę" aria-label={"Archiwizuj "+(c.title||"rozmowę")}
        className="mr-1 rounded-lg p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300">
        <Trash2 size={15}/>
       </button>
      </div>)}
     </div>
     <div className="hidden border-t border-white/10 p-4 text-xs leading-5 text-slate-400 lg:block">
      <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-emerald-300"/> Rozmowy są przypisane do Twojego konta.</div>
     </div>
    </aside>
    <section className="flex h-full min-h-0 min-w-0 flex-col">
     <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
       <button type="button" onClick={()=>setSidebarOpen(x=>!x)} aria-label="Pokaż historię rozmów"
        className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-200 lg:hidden"><Menu size={21}/></button>
       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15"><Sparkles className="text-violet-300" size={21}/></div>
       <div className="min-w-0">
        <h1 className="truncate text-base font-extrabold sm:text-lg">{displayTitle||"Asystent AI PrzemAI"}</h1>
        <p className="text-[11px] text-slate-400">Rozmawiaj, planuj i zlecaj pracę agentom</p>
       </div>
      </div>
      {organizations.length>0&&<label className="flex items-center gap-2 text-xs text-slate-300">
       Zakres
       <select value={selectedScope} onChange={event=>setOrganizationId(event.target.value)}
        disabled={busy||listening} className="max-w-48 rounded-xl border border-white/15 bg-[#18243f] px-2 py-2 text-slate-100">
        <option value="">Osobisty</option>
        {organizations.map(org=><option key={org.id} value={org.id}>{org.displayName||org.name}</option>)}
       </select>
      </label>}
      {activeConversationId&&<button type="button" onClick={()=>setSharedId(value=>!value)}
       className="text-xs text-violet-200">Wątek na Telegramie</button>}
      <Link href="/agents" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-400/15">
       <Bot size={15}/> Wszyscy agenci <ChevronRight size={13}/>
      </Link>
     </div>
     {sharedId&&activeConversationId&&<p className="break-all px-4 py-2 text-xs text-slate-300">
      Na powiązanym koncie wybierz ten sam zakres poleceniem /spolka, a potem wpisz /watek {activeConversationId} i swoją wiadomość.
     </p>}
     {reportStatus&&<p role="status" className="px-4 py-2 text-xs text-slate-300">{reportStatus}</p>}
     {error&&<p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200 sm:mx-6">{error}</p>}
     <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[radial-gradient(ellipse_at_top,rgba(79,70,229,.06),transparent_58%)] px-3 py-4 sm:px-7 sm:py-6" role="log" aria-label="Historia rozmowy z asystentem">
      {loadingConversation?<div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400"><LoaderCircle size={20} className="animate-spin"/> Ładowanie rozmowy…</div>:
       <>
        {messages.length===1&&!activeConversationId&&<div className="mx-auto max-w-2xl pb-3 pt-4 text-center">
         <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/15"><Sparkles size={28} className="text-violet-300"/></div>
         <h2 className="mt-4 text-2xl font-extrabold">W czym mogę pomóc?</h2>
         <p className="mt-2 text-sm leading-6 text-slate-400">Twój asystent do spraw firmowych, organizacji pracy i kontaktu z agentami.</p>
         <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {starters.map((prompt,i)=><button key={i} type="button" disabled={busy} onClick={()=>send(prompt)}
           className="min-h-16 rounded-xl border border-white/10 bg-[#1a2746] p-3 text-left text-xs leading-5 text-slate-200 hover:border-violet-400/40 hover:bg-[#223459] disabled:opacity-50">{prompt}</button>)}
         </div>
        </div>}
        {messages.map((item,index)=><div key={item.id||item.role+"-"+index} className={"flex min-w-0 items-start gap-2 sm:gap-3 "+(item.role==="user"?"flex-row-reverse":"")}>
         <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-xl "+(item.role==="user"?"bg-blue-500/20 text-blue-200":"bg-violet-500/20 text-violet-300")}>
          {item.role==="user"?<MessageCircle size={16}/>:<Sparkles size={16}/>}
         </span>
         <div className={"max-w-[min(95%,850px)] min-w-0 break-words whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-7 sm:px-5 "+(item.role==="user"?"border-blue-400/20 bg-[#244b9e] text-white":"border-white/10 bg-[#18243f] text-slate-100")}>
          {item.origin==="WHATSAPP"&&<span className="mb-1 block text-xs font-semibold text-blue-100">WhatsApp</span>}
          {item.content}
          {Array.isArray(item.sources) && item.sources.length > 0 && !item.restricted && (
            <ul aria-label="Źródła danych" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {item.sources.filter(source => source && typeof source.label === "string" &&
                typeof source.href === "string" && /^\/(?:[a-zA-Z0-9%-]+\/)*[a-zA-Z0-9%-]+$/.test(source.href))
                .map(source => <li key={source.href}><Link href={source.href} className="text-violet-200 underline">{source.label}</Link></li>)}
            </ul>
          )}
          {activeConversationId&&item.role==="assistant"&&item.id&&!item.pending&&!item.restricted&&
           <div className="mt-2 flex flex-wrap gap-3 text-xs text-violet-200">
            <div role="group" aria-label="Pobierz raport" className="flex flex-wrap gap-2">
             {[["docx","Word"],["pdf","PDF"],["xlsx","Excel"]].map(([format,label])=>
              <button key={format} type="button" onClick={()=>reportAction(item,format)}
               className="min-h-9 rounded-lg border border-violet-400/30 px-2 hover:bg-violet-500/20">
               Pobierz {label}
              </button>)}
            </div>
            {!item.organizationId&&<button type="button" onClick={()=>reportAction(item,"telegram")}>Wyślij na Telegram</button>}
           </div>}
          {item.pending&&<p role="status" className="text-xs text-violet-200">Sprawdzam postęp zlecenia…</p>}
         </div>
        </div>)}
        {loading&&<div className="flex items-center gap-3 text-sm text-slate-300"><LoaderCircle size={19} className="animate-spin text-violet-300"/> PrzemAI przygotowuje odpowiedź…</div>}
        <div ref={messagesEndRef}/>
       </>}
     </div>
     <div className="min-w-0 shrink-0 border-t border-white/10 bg-[#101a33] px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 sm:px-6 sm:pb-4 sm:pt-4">
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
       {messages.some(item=>item.origin==="WHATSAPP"&&item.organizationId===organizationId)&&
        <button type="button" disabled={busy||Boolean(message.trim())}
         onClick={()=>setMessage("Przygotuj szkic odpowiedzi na ostatnią wiadomość z WhatsApp w tej rozmowie. Uwzględnij kontekst rozmowy i pozostaw odpowiedź do mojej akceptacji.")}
         className="min-h-11 rounded-xl border border-emerald-400/30 px-3 text-sm text-emerald-100 disabled:opacity-40">
         Szkic odpowiedzi WhatsApp
        </button>}
       <button type="button" aria-pressed={voiceMode} onClick={startVoiceMode}
        disabled={!voiceSupported||busy}
        className={"inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold disabled:opacity-40 sm:flex-none "+(voiceMode
         ?"border-violet-300/40 bg-violet-500/20 text-violet-100"
         :"border-violet-400/20 bg-violet-400/10 text-violet-200")}>
        <Mic size={19}/>{voiceMode?"Rozmowa głosowa: WŁ.":"Włącz rozmowę głosową"}
       </button>
       <button type="button" onClick={()=>{setSpeakReplies(value=>!value);window.speechSynthesis?.cancel();}}
        aria-pressed={speakReplies||voiceMode} disabled={voiceMode}
        title={voiceMode?"Odczyt jest włączony w trybie rozmowy głosowej":"Włącz odczyt odpowiedzi"}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-slate-200 disabled:opacity-50">
        {(speakReplies||voiceMode)?<Volume2 size={18}/>:<VolumeX size={18}/>}
        <span className="hidden sm:inline">{(speakReplies||voiceMode)?"Odczyt włączony":"Odczytaj odpowiedzi"}</span>
       </button>
      </div>
      {voiceError&&<p role="alert" className="mb-2 text-xs text-rose-300">{voiceError}</p>}
      {!voiceSupported&&<p className="mb-2 text-xs text-slate-400">Mikrofon niedostępny w tej przeglądarce — możesz pisać normalnie.</p>}
      {voiceMode&&voiceSupported&&<p role="status" className="mb-2 text-xs leading-5 text-violet-200">
       {transcribing?"Przetwarzam nagranie…":listening?"Słucham… Po zakończeniu mówienia wyślę wiadomość automatycznie."
        :"Dotknij dużego mikrofonu i mów. Po zakończeniu wypowiedzi asystent odpowie także głosowo."}
      </p>}
      {messages.some(item=>item.pending&&(item.organizationId||"")===selectedScope)&&
       <div className="flex flex-wrap gap-2">
       <button type="button" disabled={busy||listening||Boolean(attachment)} onClick={()=>send("Status")}
        className="mb-2 text-xs text-violet-200">Sprawdź lub wznów zlecenie</button>
        <button type="button" disabled={busy||listening||Boolean(attachment)} onClick={()=>send("Zatrzymaj plan")}
          className="min-h-11 rounded-xl border border-rose-400/40 px-3 text-sm text-rose-100 disabled:opacity-40">Zatrzymaj plan</button>
       </div>}
      {activeConversationId && <details className="text-xs text-slate-300">
       <summary className="cursor-pointer text-violet-200">Kontynuuj w Telegramie</summary>
       <p className="mt-2">Na powiązanym koncie wybierz ten sam zakres i użyj polecenia z własną wiadomością.</p>
       <code className="block select-all break-all">{"/watek " + activeConversationId + " Twoja wiadomość"}</code>
      </details>}
      {selectedScope && activeConversationId &&
       <WhatsAppHistoryLink key={selectedScope + ":" + activeConversationId}
        organizationId={selectedScope} conversationId={activeConversationId} />}
      <label className="mb-2 block text-xs text-slate-300">
       Załącz PDF, DOCX, XLSX lub zdjęcie (do 4 MB)
       <input type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg" disabled={busy||listening}
        onChange={event=>{setAttachment(event.target.files?.[0]||null);event.target.value="";}}
        className="ml-2 max-w-full"/>
      </label>
      {attachment&&<button type="button" onClick={()=>setAttachment(null)} className="mb-2 text-xs text-violet-200">
       Usuń załącznik {attachment.name}
      </button>}
      <div className="flex min-w-0 items-end gap-2 rounded-2xl border border-white/15 bg-[#0b152c] p-2 focus-within:border-violet-400/50">
       <button type="button" onClick={toggleMicrophone} disabled={!voiceReady}
        aria-label="Nagraj wiadomość głosową" aria-pressed={listening}
        title={listening?"Zakończ dyktowanie":"Dotknij i mów do PrzemAI"}
        className={"inline-flex min-h-14 min-w-14 shrink-0 items-center justify-center rounded-xl border disabled:opacity-40 "+(listening
         ?"animate-pulse border-rose-300/40 bg-rose-500/20 text-rose-100"
         :"border-violet-300/30 bg-violet-500/20 text-violet-100 hover:bg-violet-500/30")}>
        {listening?<MicOff size={27}/>:<Mic size={27}/>}
       </button>
       <textarea rows={1} value={message} onChange={event=>setMessage(event.target.value)}
        onKeyDown={handleKeyDown} disabled={busy}
        placeholder={listening?"Słucham Twojej wypowiedzi…":"Napisz lub dotknij mikrofonu"}
        aria-label="Wiadomość do asystenta"
        className="max-h-32 min-h-14 min-w-0 flex-1 resize-y bg-transparent px-1 py-3 text-base leading-7 text-white outline-none placeholder:text-slate-500 disabled:opacity-50 sm:px-3"/>
       <button type="button" onClick={()=>send()} disabled={busy||listening||(!message.trim()&&!attachment)}
        aria-label="Wyślij wiadomość"
        className="inline-flex min-h-14 min-w-14 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-2 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-40 sm:px-5">
        {loading?<LoaderCircle size={20} className="animate-spin"/>:<Send size={21}/>}
        <span className="hidden sm:inline">{loading?"Wysyłam…":"Wyślij"}</span>
       </button>
      </div>
      <p className="mt-2 hidden text-[11px] leading-5 text-slate-500 sm:block">
       Dotknij mikrofonu i mów. Jeżeli rozpoznawanie w przeglądarce zawiedzie, PrzemAI nagra maksymalnie 30 sekund i prześle nagranie do transkrypcji przez API OpenAI (opłata według użycia). Nagrania nie zapisujemy w Historii.
      </p>
     </div>
    </section>
   </div>
   <footer className="mt-5 hidden text-xs text-slate-500 sm:block">PrzemAI · Asystent AI · Historia rozmów jest dostępna wyłącznie na Twoim koncie</footer>
  </div>
 </main>;
}
