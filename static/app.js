
const $ = (id) => document.getElementById(id);

let authMode = "login";
let currentChatId = null;
let busy = false;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? {"Content-Type": "application/json"} : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) showAuth();
    throw new Error(data.detail || data.message || "Request failed");
  }

  return data;
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2600);
}

function showAuth() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");
}

function showApp(user) {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  $("userEmail").textContent = user.email || "ASMER User";
  $("settingsEmail").textContent = user.email || "Signed in";
  loadHistory();
}

function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create account";
  $("authMessage").textContent = "";
}

$("loginTab").onclick = () => setAuthMode("login");
$("signupTab").onclick = () => setAuthMode("signup");

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;
  const endpoint = authMode === "login"
    ? "/api/auth/login"
    : "/api/auth/signup";

  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait...";

  try {
    const result = await api(endpoint, {
      method: "POST",
      body: JSON.stringify({email, password})
    });

    if (authMode === "signup") {
      $("authMessage").textContent = result.message;
      if (result.message.includes("Check your email")) {
        toast("Check your email to confirm your account.");
      }
      return;
    }

    await checkSession();
  } catch (error) {
    $("authMessage").textContent = error.message;
  } finally {
    $("authSubmit").disabled = false;
  }
});

async function checkSession() {
  try {
    const result = await api("/api/auth/me");
    showApp(result.user);
  } catch {
    showAuth();
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", {method: "POST"});
  } catch {}
  currentChatId = null;
  showAuth();
}

$("logoutBtn").onclick = logout;
$("settingsLogout").onclick = logout;

// -------- Navigation --------

function showPage(page) {
  $("chatPage").classList.toggle("hidden", page !== "chat");
  $("memoryPage").classList.toggle("hidden", page !== "memory");
  $("settingsPage").classList.toggle("hidden", page !== "settings");

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("pageTitle").textContent = {
    chat: "AI Chat",
    memory: "Memory",
    settings: "Settings"
  }[page];

  if (page === "memory") loadMemory();
}

document.querySelectorAll(".nav-item").forEach(button => {
  button.onclick = () => {
    showPage(button.dataset.page);
    $("sidebar").classList.remove("open");
  };
});

$("openSidebar").onclick = () => $("sidebar").classList.add("open");
$("closeSidebar").onclick = () => $("sidebar").classList.remove("open");

// -------- Chat UI --------

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderMessage(role, content) {
 const welcome = $("welcome");
if (welcome) welcome.classList.add("hidden");

  const row = document.createElement("div");
  row.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "U" : "A";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "You" : "ASMER AI";

  const text = document.createElement("div");
  text.innerHTML = escapeHTML(content).replace(/\n/g, "<br>");

  body.append(name, text);
  row.append(avatar, body);
  $("chatMessages").appendChild(row);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

function resetChat() {
  currentChatId = null;
  $("chatMessages").innerHTML = "";
  const welcome = document.createElement("div");
  welcome.id = "welcome";
  welcome.className = "welcome";
  welcome.innerHTML = `
    <div class="welcome-icon">✦</div>
    <p class="eyebrow">WELCOME TO ASMER</p>
    <h1>What can I help<br><span>you build today?</span></h1>
    <p class="muted">Ask questions, explore ideas, or write code.</p>
    <div class="suggestions">
      <button class="suggestion" data-prompt="Help me build a professional website">✧ Build a website</button>
      <button class="suggestion" data-prompt="Explain artificial intelligence simply">◈ Learn something</button>
      <button class="suggestion" data-prompt="Write a Python application for me">⌘ Write code</button>
    </div>`;
  $("chatMessages").appendChild(welcome);
  attachSuggestions();
  showPage("chat");
}

function attachSuggestions() {
  document.querySelectorAll(".suggestion").forEach(button => {
    button.onclick = () => {
      $("messageInput").value = button.dataset.prompt;
      sendMessage();
    };
  });
}

async function loadHistory() {
  try {
    const result = await api("/api/chats");
    const list = $("historyList");
    list.innerHTML = "";

    result.chats.forEach(chat => {
      const button = document.createElement("button");
      button.className = "history-item";
      button.textContent = chat.title || "New chat";
      button.title = chat.title || "New chat";
      button.onclick = () => openChat(chat.id);
      list.appendChild(button);
    });
  } catch (error) {
    console.error(error);
  }
}

async function openChat(id) {
  try {
    const result = await api(`/api/chats/${id}`);
    currentChatId = id;
    $("chatMessages").innerHTML = "";
    $("welcome").classList.add("hidden");

    result.messages.forEach(message => {
      renderMessage(message.role, message.content);
    });

    showPage("chat");
    $("sidebar").classList.remove("open");
  } catch (error) {
    toast(error.message);
  }
}

async function sendMessage() {
  if (busy) return;

  const input = $("messageInput");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  input.style.height = "auto";
  renderMessage("user", message);

  busy = true;
  $("sendBtn").disabled = true;

  const waiting = document.createElement("div");
  waiting.className = "message";
  waiting.innerHTML = `
    <div class="message-avatar">A</div>
    <div class="message-body"><div class="message-name">ASMER AI</div>
    <div class="muted">Thinking...</div></div>`;
  $("chatMessages").appendChild(waiting);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        message,
        chat_id: currentChatId
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "AI request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    let newChatId = null;

    while (true) {
      const {value, done} = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, {stream: true});
      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const event of events) {
        const line = event.split("\n").find(x => x.startsWith("data: "));
        if (!line) continue;

        const payload = line.slice(6);
        if (payload === "[DONE]") continue;

        try {
          const data = JSON.parse(payload);
          answer += data.token || data.content || "";
          newChatId = data.chat_id || newChatId;
        } catch {}
      }
    }

    waiting.remove();
    if (newChatId) currentChatId = newChatId;
    renderMessage("assistant", answer || "I couldn't generate a response.");
    await loadHistory();

  } catch (error) {
    waiting.remove();
    renderMessage("assistant", "Error: " + error.message);
  } finally {
    busy = false;
    $("sendBtn").disabled = false;
    input.focus();
  }
}

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendMessage();
});

$("messageInput").addEventListener("input", event => {
  event.target.style.height = "auto";
  event.target.style.height = Math.min(event.target.scrollHeight, 180) + "px";
});

$("messageInput").addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

$("newChat").onclick = resetChat;
$("newChatTop").onclick = resetChat;
attachSuggestions();

// -------- Memory --------

async function loadMemory() {
  try {
    const result = await api("/api/memory");
    $("memoryInput").value = result.content || "";
  } catch (error) {
    $("memoryStatus").textContent = error.message;
  }
}

$("saveMemory").onclick = async () => {
  $("saveMemory").disabled = true;
  $("memoryStatus").textContent = "Saving...";

  try {
    await api("/api/memory", {
      method: "PUT",
      body: JSON.stringify({content: $("memoryInput").value})
    });
    $("memoryStatus").textContent = "Memory saved successfully.";
  } catch (error) {
    $("memoryStatus").textContent = error.message;
  } finally {
    $("saveMemory").disabled = false;
  }
};

// -------- Start --------

checkSession();
