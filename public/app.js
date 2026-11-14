const $ = selector => document.querySelector(selector);
const state = { chats: loadChats(), activeId: null, busy: false, view: "chat" };
const STORAGE_KEY = "asmer-ai-v59-chats";
function loadChats() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveChats() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.chats.slice(0, 40))); }
function activeChat() { return state.chats.find(chat => chat.id === state.activeId); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char])); }
function renderHistory() { $("#history").innerHTML = state.chats.map(chat => '<button class="history-entry" data-chat="' + escapeHtml(chat.id) + '">' + escapeHtml(chat.title) + "</button>").join(""); }
function renderMessages() {
  const messages = activeChat()?.messages || [];
  $("#welcome").hidden = messages.length > 0;
  $("#messages").innerHTML = messages.map(message => '<article class="message ' + (message.role === "user" ? "user" : "assistant") + '"><div class="avatar">' + (message.role === "user" ? "U" : "A") + '</div><div class="bubble">' + escapeHtml(message.content) + "</div></article>").join("");
  $("#messages").scrollTop = $("#messages").scrollHeight;
}
function newChat() { const chat = { id: crypto.randomUUID(), title: "New conversation", messages: [] }; state.chats.unshift(chat); state.activeId = chat.id; saveChats(); renderHistory(); renderMessages(); }
function setView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach(node => node.classList.remove("active"));
  $("#view-" + view)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(node => node.classList.toggle("active", node.dataset.view === view));
  $("#pageTitle").textContent = ({chat:"AI Workspace",projects:"Projects",tools:"Plugins & Tools",research:"Research",settings:"Settings"})[view] || "AI Workspace";
  $("#sidebar").classList.remove("open");
}
function addMessage(role, content) {
  const chat = activeChat(); if (!chat) return;
  chat.messages.push({ role, content });
  if (role === "user" && chat.title === "New conversation") chat.title = content.slice(0,38) || "New conversation";
  saveChats(); renderHistory(); renderMessages();
}
async function sendMessage(text) {
  const prompt = text.trim(); if (!prompt || state.busy) return;
  if (!activeChat()) newChat();
  addMessage("user", prompt); $("#prompt").value = "";
  state.busy = true; $("#sendButton").disabled = true;
  const pending = document.createElement("div"); pending.className = "message"; pending.innerHTML = '<div class="avatar">A</div><div class="bubble typing">ASMER is thinking…</div>'; $("#messages").appendChild(pending);
  try {
    const chat = activeChat();
    const response = await fetch("/api/chat", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({messages:chat.messages.map(({role,content})=>({role,content}))}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "The request failed.");
    addMessage("assistant", data.reply);
  } catch (error) { addMessage("assistant", "I couldn't complete that request: " + error.message); }
  finally { pending.remove(); state.busy = false; $("#sendButton").disabled = false; $("#prompt").focus(); }
}
async function loadTools() {
  try {
    const response = await fetch("/api/tools"); const data = await response.json();
    $("#toolGrid").innerHTML = (data.tools || []).map(tool => {
      const runnable = ["calculator","summarize","data-preview","github-search","weather","python-analyze"].includes(tool.id);
      return '<article class="tool-card"><h3>' + escapeHtml(tool.name) + '</h3><p>' + escapeHtml(tool.description) + '</p><div class="tool-meta"><span>' + escapeHtml(tool.category) + '</span><em>' + escapeHtml(tool.status.toUpperCase()) + '</em></div>' +
        (runnable ? '<button class="tool-run" data-tool="' + escapeHtml(tool.id) + '">Run tool →</button>' : "") + '</article>';
    }).join("");
  } catch { $("#toolGrid").textContent = "Could not load the tool catalogue."; }
}
async function runTool(tool) {
  const labels = {calculator:"Enter a calculation (example: (12 + 8) * 3):",summarize:"Paste the text you want summarized:", "data-preview":'Paste JSON rows (example: [{"sales":10},{"sales":20}]):',"github-search":"Enter GitHub repository keywords:","weather":"Enter a city name:","python-analyze":"Paste JSON rows for the hosted Python service:"};
  const input = prompt(labels[tool]); if (!input?.trim()) return;
  const button = document.querySelector('[data-tool="' + tool + '"]');
  if (button) { button.disabled = true; button.textContent = "Running…"; }
  try {
    const plugin = ["github-search","weather","python-analyze"].includes(tool);
    const response = await fetch(plugin ? "/api/plugins/run" : "/api/tools/run", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(plugin ? {plugin,input} : {tool,input})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Tool failed.");
    const output = data.result !== undefined ? (typeof data.result === "string" ? data.result : JSON.stringify(data.result,null,2)) : JSON.stringify(data,null,2);
    if (!activeChat()) newChat();
    addMessage("user", "[Run tool: " + tool + "]\n" + input);
    addMessage("assistant", output);
    setView("chat");
  } catch (error) { alert("Tool error: " + error.message); }
  finally { if (button) { button.disabled = false; button.textContent = "Run tool →"; } }
}
$("#chatForm").addEventListener("submit", event => { event.preventDefault(); sendMessage($("#prompt").value); });
$("#prompt").addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); $("#chatForm").requestSubmit(); } });
$("#newChat").addEventListener("click", newChat);
$("#clearHistory").addEventListener("click", () => { if (!confirm("Clear all conversations saved in this browser?")) return; state.chats=[]; state.activeId=null; saveChats(); renderHistory(); renderMessages(); });
$("#history").addEventListener("click", event => { const button=event.target.closest("[data-chat]"); if(button){state.activeId=button.dataset.chat;setView("chat");renderMessages();} });
document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click",()=>setView(button.dataset.view)));
document.querySelectorAll(".suggestion").forEach(button=>button.addEventListener("click",()=>sendMessage(button.dataset.prompt)));
$("#toolGrid").addEventListener("click",event=>{const button=event.target.closest("[data-tool]");if(button)runTool(button.dataset.tool);});
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#exportChat").addEventListener("click",()=>{
  const chat=activeChat(); if(!chat?.messages.length)return alert("There is no conversation to export yet.");
  const content="# "+chat.title+"\n\n"+chat.messages.map(message=>"**"+message.role+"**\n\n"+message.content).join("\n\n---\n\n");
  const blob=new Blob([content],{type:"text/markdown"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download="asmer-conversation.md";link.click();URL.revokeObjectURL(link.href);
});

$("#researchForm").addEventListener("submit", async event => {
  event.preventDefault();
  const query = $("#researchQuery").value.trim(); if (!query) return;
  $("#researchButton").disabled = true; $("#researchButton").textContent = "Searching…";
  $("#researchStatus").textContent = "Searching with your configured provider…"; $("#researchResults").innerHTML = "";
  try {
    const response = await fetch("/api/research", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Research failed.");
    $("#researchStatus").textContent = "Results from " + data.provider + ". Open the original sources to verify details.";
    $("#researchResults").innerHTML = (data.results || []).map(item => '<article class="research-result"><a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title) + '</a><p>' + escapeHtml(item.snippet) + '</p></article>').join("") || "<p>No results found.</p>";
  } catch(error) { $("#researchStatus").textContent = error.message; }
  finally { $("#researchButton").disabled = false; $("#researchButton").textContent = "Search web"; }
});

async function checkHealth(){try{const response=await fetch("/api/health");const data=await response.json();$("#connectionLabel").textContent=data.aiConfigured?"AI service connected":"App online · AI setup needed";}catch{$("#connectionLabel").textContent="API unavailable";}}
if(state.chats.length)state.activeId=state.chats[0].id;
renderHistory();renderMessages();loadTools();checkHealth();
