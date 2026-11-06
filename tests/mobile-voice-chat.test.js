"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
async function loadVoiceHelpers(){
 const source=await fs.readFile(path.join(__dirname,"../frontend/src/lib/voiceInputPayload.js"),"utf8");
 return import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
}
test("voice dictation combines typed text with recognized Polish speech safely",async()=>{
 const {combineVoiceText}=await loadVoiceHelpers();
 assert.equal(combineVoiceText("  Spotkanie  "," w Mielnie  "),"Spotkanie w Mielnie");
 assert.equal(combineVoiceText("","  Proszę przygotować ofertę "), "Proszę przygotować ofertę");
 assert.equal(combineVoiceText(null,""),"");
});
test("automatic voice-send happens only with confirmed recognized speech",async()=>{
 const {shouldSubmitVoiceTurn}=await loadVoiceHelpers();
 const valid={autoSend:true,transcript:"Proszę pokaż faktury",cancelled:false,error:false};
 assert.equal(shouldSubmitVoiceTurn(valid),true);
 for(const change of [{transcript:" "},{autoSend:false},{cancelled:true},{error:true}])
   assert.equal(shouldSubmitVoiceTurn({...valid,...change}),false);
});
test("mobile assistant exposes large mic and safe-area composer while preserving voice fallback",async()=>{
 const ui=await fs.readFile(path.join(__dirname,"../frontend/src/app/chat/page.js"),"utf8");
 assert.match(ui,/aria-label="Nagraj wiadomość głosową"/);
 assert.match(ui,/min-h-14 min-w-14/);
 assert.match(ui,/env\(safe-area-inset-bottom/);
 assert.match(ui,/shouldSubmitVoiceTurn\(turn\)/);
 assert.match(ui,/recognition\.onend/);
 assert.match(ui,/if\(!BrowserRecognition\)/);
 assert.match(ui,/sendChatMessage\(text,activeConversationId\)/);
 assert.match(ui,/speechSynthesis/);
});

test("one tap enables spoken conversation and starts recognition in same user gesture",async()=>{
 const ui=await fs.readFile(path.join(__dirname,"../frontend/src/app/chat/page.js"),"utf8");
 assert.match(ui,/function startVoiceMode\(\)/);
 assert.match(ui,/voiceModeRef\.current=true;[\s\S]*?toggleMicrophone\(\);/);
 assert.match(ui,/aria-pressed=\{voiceMode\} onClick=\{startVoiceMode\}/);
 assert.match(ui,/onClick=\{\(\)=>send\(\)\} disabled=\{busy\|\|listening\|\|!message\.trim\(\)\}/);
});
