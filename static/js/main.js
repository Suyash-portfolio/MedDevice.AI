/**
 * MedDevice.AI - Frontend Engine (Version 4)
 * Full-featured: Auth, Chatbot, Voice, Terminal, Logistics, User Dashboard, Pages
 */

// --- 1. CONFIGURATION & STATE ---
const SUPABASE_URL = (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.url) || "";
const SUPABASE_ANON_KEY = (window.__SUPABASE_CONFIG__ && window.__SUPABASE_CONFIG__.anonKey) || "";

let supabaseClient = null;
let currentUser = null;
let ephemeralGuestHistory = [];
let recognitionInstance = null;
let chatHistory = [];
let messageIdCounter = 0;
let lastUserQuery = "";

const AppState = {
    isAuthenticated: false,
    currentMode: 'floating',
    voiceActive: false,
    chatbotInitialized: false,
    isMaximized: false
};

document.addEventListener("DOMContentLoaded", async () => {
    initializeSupabase();
    await checkSessionState();
    setupGlobalDOMEvents();
    renderGlobalChatbotWidget();
    setupMobileMenu();
    setupDeviceSearch();
    setupContactForm();
    if (document.getElementById('user-dashboard-root')) {
        loadUserDashboard();
    }
});

// --- 2. AUTHENTICATION ---
function initializeSupabase() {
    if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
}

async function checkSessionState() {
    if (!supabaseClient) { updateAuthUIElements(false); return; }
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session && !error) {
        currentUser = session.user;
        AppState.isAuthenticated = true;
        setAuthCookie(session.access_token, 1);
        updateAuthUIElements(true);
    } else {
        currentUser = null;
        AppState.isAuthenticated = false;
        clearAuthCookie();
        updateAuthUIElements(false);
    }
}

function setAuthCookie(token, days) {
    const d = new Date(); d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `sb-access-token=${token}; expires=${d.toUTCString()}; path=/; SameSite=Lax;`;
}

function clearAuthCookie() {
    document.cookie = "sb-access-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "sb-user-email=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

function updateAuthUIElements(authenticated) {
    const elements = {
        'nav-auth-btn': null, 'nav-dashboard-link': null, 'nav-profile-link': null,
        'nav-user-link': null, 'user-display-name': null,
        'mobile-nav-auth-btn': null, 'mobile-nav-profile-link': null, 'mobile-nav-user-link': null,
        'mobile-user-display': null
    };
    Object.keys(elements).forEach(id => { elements[id] = document.getElementById(id); });

    if (authenticated && currentUser) {
        if (elements['nav-auth-btn']) elements['nav-auth-btn'].innerText = "Sign Out";
        if (elements['nav-profile-link']) elements['nav-profile-link'].classList.remove("hidden");
        if (elements['nav-user-link']) elements['nav-user-link'].classList.remove("hidden");
        if (elements['mobile-nav-profile-link']) elements['mobile-nav-profile-link'].classList.remove("hidden");
        if (elements['mobile-nav-user-link']) elements['mobile-nav-user-link'].classList.remove("hidden");
        if (elements['user-display-name']) {
            elements['user-display-name'].innerText = currentUser.email;
            elements['user-display-name'].classList.remove("hidden");
        }
        if (elements['mobile-user-display']) {
            elements['mobile-user-display'].innerText = currentUser.email;
            elements['mobile-user-display'].classList.remove("hidden");
        }
        if (elements['mobile-nav-auth-btn']) elements['mobile-nav-auth-btn'].innerText = "Sign Out";
        const pe = document.getElementById('profile-email-field');
        if (pe) pe.innerText = currentUser.email;
    } else {
        if (elements['nav-auth-btn']) elements['nav-auth-btn'].innerText = "Sign In";
        if (elements['nav-profile-link']) elements['nav-profile-link'].classList.add("hidden");
        if (elements['nav-user-link']) elements['nav-user-link'].classList.add("hidden");
        if (elements['mobile-nav-profile-link']) elements['mobile-nav-profile-link'].classList.add("hidden");
        if (elements['mobile-nav-user-link']) elements['mobile-nav-user-link'].classList.add("hidden");
        if (elements['user-display-name']) elements['user-display-name'].classList.add("hidden");
        if (elements['mobile-user-display']) elements['mobile-user-display'].classList.add("hidden");
        if (elements['mobile-nav-auth-btn']) elements['mobile-nav-auth-btn'].innerText = "Sign In";
    }
}

// --- 3. MOBILE MENU ---
function setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    const hamburger = document.getElementById('hamburger-icon');
    const closeIcon = document.getElementById('close-icon');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
        if (hamburger) hamburger.classList.toggle('hidden');
        if (closeIcon) closeIcon.classList.toggle('hidden');
    });
    menu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            menu.classList.add('hidden');
            if (hamburger) hamburger.classList.remove('hidden');
            if (closeIcon) closeIcon.classList.add('hidden');
        });
    });
}

// --- 4. NOTIFICATION SYSTEM ---
function showNotification(message, type) {
    const existing = document.querySelector('.app-notification');
    if (existing) existing.remove();
    const notif = document.createElement('div');
    notif.className = `app-notification ${type === 'error' ? 'notif-error' : 'notif-success'}`;
    notif.innerHTML = `<span class="notif-icon">${type === 'error' ? '\u2716' : '\u2714'}</span><span class="notif-text">${message}</span>`;
    document.body.appendChild(notif);
    requestAnimationFrame(() => notif.classList.add('notif-visible'));
    setTimeout(() => {
        notif.classList.remove('notif-visible');
        setTimeout(() => { if (notif.parentNode) notif.remove(); }, 300);
    }, 4000);
}

// --- 5. DASHBOARD TERMINAL ---
function submitWorkspaceQuery() {
    const input = document.getElementById('workspace-query-input');
    const logStream = document.getElementById('workspace-log-stream');
    if (!input || !logStream) return;
    const query = input.value.trim();
    if (!query) return;
    input.disabled = true;

    const steps = [
        { msg: '[SYSTEM] Initializing Model... \u23F3', delay: 0 },
        { msg: '[SYSTEM] Searching Dataset... \u23F3', delay: 300 },
        { msg: '[SYSTEM] Running Logistic Regression... \u23F3', delay: 700 },
        { msg: '[SYSTEM] Calculating Confidence... \u23F3', delay: 1100 },
        { msg: '[SYSTEM] Generating Response... \u23F3', delay: 1500 }
    ];

    let stepIndex = 0;
    const statusElements = [];

    function showNextStep() {
        if (stepIndex >= steps.length) {
            executeTerminalQuery(query, logStream, statusElements, input);
            return;
        }
        const step = steps[stepIndex];
        const el = document.createElement('div');
        el.className = 'text-amber-400/80 border-b border-white/5 pb-2 pt-1';
        el.textContent = step.msg;
        logStream.appendChild(el);
        logStream.scrollTop = logStream.scrollHeight;
        statusElements.push(el);
        stepIndex++;
        setTimeout(showNextStep, step.delay);
    }
    showNextStep();
}

async function executeTerminalQuery(query, logStream, statusElements, input) {
    let authHeaderValue = "";
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) authHeaderValue = `Bearer ${session.access_token}`;
    }
    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeaderValue },
            body: JSON.stringify({ message: query, session_id: "v2_dynamic_session" })
        });
        const data = await response.json();
        if (statusElements.length > 0) {
            const last = statusElements[statusElements.length - 1];
            last.textContent = '[SYSTEM] Response Generated \u2705';
            last.className = 'text-emerald-400/80 border-b border-white/5 pb-2 pt-1';
        }
        if (data.status === "success") {
            const isFallback = !data.device && data.confidence < 0.3;
            const resultDiv = document.createElement('div');
            resultDiv.className = 'text-xs space-y-1 border-t border-indigo-500/20 pt-3 mt-2';
            if (isFallback) {
                resultDiv.innerHTML = `<div class="text-slate-400">[RESULT] \u26A0\uFE0F Low confidence (${(data.confidence * 100).toFixed(1)}%) \u2014 no reliable answer</div><div class="text-slate-400 italic">${data.answer}</div><div class="text-slate-500 text-[10px] mt-1">Response: ${data.response_time}ms</div>`;
            } else {
                resultDiv.innerHTML = `<div class="text-indigo-300 font-semibold">[RESULT] \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</div><div class="text-white"><span class="text-slate-400">Device:</span> ${data.device || 'N/A'}</div><div class="text-slate-300"><span class="text-slate-400">Category:</span> ${data.category}</div><div class="text-slate-300"><span class="text-slate-400">Confidence:</span> ${(data.confidence * 100).toFixed(2)}%</div><div class="text-slate-300"><span class="text-slate-400">Response Time:</span> ${data.response_time}ms</div><div class="text-emerald-300/80 border-t border-white/5 pt-2 mt-1">${data.answer}</div><div class="text-indigo-300 font-semibold mt-1">\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500</div>`;
            }
            logStream.appendChild(resultDiv);
        } else {
            const errDiv = document.createElement('div');
            errDiv.className = 'text-rose-400/80 pt-2';
            errDiv.textContent = `[ERROR] ${data.message || 'Processing failed'}`;
            logStream.appendChild(errDiv);
        }
    } catch (err) {
        if (statusElements.length > 0) {
            const last = statusElements[statusElements.length - 1];
            last.textContent = '[SYSTEM] Processing Failed \u274C';
            last.className = 'text-rose-400/80 border-b border-white/5 pb-2 pt-1';
        }
        const errDiv = document.createElement('div');
        errDiv.className = 'text-rose-400/80 pt-2';
        errDiv.textContent = '[ERROR] Network failure connecting to backend.';
        logStream.appendChild(errDiv);
    }
    logStream.scrollTop = logStream.scrollHeight;
    input.disabled = false;
    input.value = '';
    input.focus();
}

function clearWorkspaceLogs() {
    const logStream = document.getElementById('workspace-log-stream');
    if (!logStream) return;
    logStream.innerHTML = '<div class="text-slate-500 border-b border-white/5 pb-2">--- System Initialized. TF-IDF Weights Loaded. Ready for Stream Input ---</div>';
}

// --- 6. VOICE RECOGNITION (FIXED) ---
let workspaceRecognition = null;

function toggleVoiceLogging() {
    const btn = document.getElementById('voice-recognition-toggle');
    if (!btn) return;

    if (AppState.voiceActive) {
        if (workspaceRecognition) {
            workspaceRecognition.abort();
            workspaceRecognition = null;
        }
        AppState.voiceActive = false;
        btn.style.borderColor = '';
        btn.style.background = '';
        btn.innerHTML = '\uD83C\uDFA4';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showNotification("Voice input is not supported in this browser. Please use Chrome or Edge.", "error");
        return;
    }

    try {
        workspaceRecognition = new SpeechRecognition();
        workspaceRecognition.lang = 'en-US';
        workspaceRecognition.interimResults = true;
        workspaceRecognition.continuous = false;

        workspaceRecognition.onstart = () => {
            AppState.voiceActive = true;
            btn.style.borderColor = 'rgba(244, 63, 94, 0.6)';
            btn.style.background = 'rgba(244, 63, 94, 0.15)';
            btn.innerHTML = '\uD83C\uDFA4 <span class="text-[10px] ml-1">Listening...</span>';
            showNotification("Microphone active - speak now", "success");
        };

        workspaceRecognition.onerror = (event) => {
            AppState.voiceActive = false;
            workspaceRecognition = null;
            btn.style.borderColor = '';
            btn.style.background = '';
            btn.innerHTML = '\uD83C\uDFA4';
            if (event.error === 'not-allowed') {
                showNotification("Microphone permission denied. Please allow microphone access in browser settings.", "error");
            } else if (event.error === 'no-speech') {
                showNotification("No speech detected. Please try again.", "error");
            } else if (event.error === 'audio-capture') {
                showNotification("No microphone found. Please check your device.", "error");
            } else {
                showNotification("Voice recognition error: " + event.error, "error");
            }
        };

        workspaceRecognition.onend = () => {
            AppState.voiceActive = false;
            workspaceRecognition = null;
            btn.style.borderColor = '';
            btn.style.background = '';
            btn.innerHTML = '\uD83C\uDFA4';
        };

        workspaceRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            const input = document.getElementById('workspace-query-input');
            if (input) {
                if (finalTranscript) {
                    input.value = finalTranscript;
                    input.focus();
                    setTimeout(() => submitWorkspaceQuery(), 300);
                } else if (interimTranscript) {
                    input.value = interimTranscript;
                }
            }
        };

        workspaceRecognition.start();
    } catch (err) {
        AppState.voiceActive = false;
        btn.style.borderColor = '';
        btn.innerHTML = '\uD83C\uDFA4';
        showNotification("Failed to start voice recognition: " + err.message, "error");
    }
}

// --- 7. LOGISTICS PIPELINE ---
function dispatchProcurementOrder() {
    const deviceIdInput = document.getElementById('procure-device-id');
    const prioritySelect = document.getElementById('procure-priority');
    if (!deviceIdInput || !prioritySelect) return;
    const deviceId = deviceIdInput.value.trim();
    const priority = prioritySelect.value;
    if (!deviceId) {
        showNotification("Please enter a Device Tag ID.", "error");
        deviceIdInput.focus();
        return;
    }
    const btn = document.querySelector('button[onclick="dispatchProcurementOrder()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

    const makeRequest = async () => {
        let authHeaderValue = "";
        if (supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) authHeaderValue = `Bearer ${session.access_token}`;
        }
        try {
            const response = await fetch("/api/dispatch", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": authHeaderValue },
                body: JSON.stringify({ device_id: deviceId, priority: priority })
            });
            const data = await response.json();
            if (data.status === "success") {
                showNotification(data.message, "success");
                deviceIdInput.value = '';
                prioritySelect.value = 'routine';
            } else {
                showNotification(data.message || "Dispatch failed.", "error");
            }
        } catch (err) {
            showNotification("Network error processing dispatch.", "error");
        }
        if (btn) { btn.disabled = false; btn.textContent = 'Dispatch Order Request Token'; }
    };
    makeRequest();
}

// --- 8. CHATBOT WIDGET ---
function renderGlobalChatbotWidget() {
    const rootTarget = document.getElementById("global-chatbot-root");
    if (!rootTarget) return;
    rootTarget.classList.remove("pointer-events-none");

    const dashboardCanvas = document.getElementById("dashboard-embedded-chat-anchor");
    if (dashboardCanvas) {
        AppState.currentMode = 'dashboard';
        dashboardCanvas.appendChild(buildChatDOMStructure());
    } else {
        AppState.currentMode = 'floating';
        rootTarget.appendChild(buildFloatingShellDOMStructure());
    }
    attachChatEngineListeners();
    if (!AppState.chatbotInitialized) {
        AppState.chatbotInitialized = true;
        fetchChatSuggestions();
    }
}

function getTimestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function buildFloatingShellDOMStructure() {
    const container = document.createElement("div");
    container.className = "relative flex flex-col items-end";
    container.innerHTML = `
        <button id="chat-trigger-fab" class="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl flex items-center justify-center text-xl font-bold transition-all duration-300 hover:scale-105 active:scale-95 pointer-events-auto">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="w-7 h-7">
                <rect x="3" y="7" width="18" height="12" rx="2" ry="2"/>
                <rect x="7" y="9" width="2" height="2" rx="1" fill="currentColor" stroke="none"/>
                <rect x="15" y="9" width="2" height="2" rx="1" fill="currentColor" stroke="none"/>
                <path d="M9 16h6"/>
                <path d="M12 5V3"/>
                <path d="M8 3h8"/>
                <circle cx="12" cy="3" r="0.5" fill="currentColor" stroke="none"/>
            </svg>
        </button>
        <div id="floating-chat-window" class="glass-card w-[360px] sm:w-[400px] h-[550px] rounded-2xl mt-4 flex flex-col overflow-hidden hidden transition-all duration-300 opacity-0 scale-95 origin-bottom-right shadow-2xl pointer-events-auto">
            <div class="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span class="text-sm font-bold text-white tracking-wide">MedDevice Copilot</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="maximize-chat-btn" class="text-slate-400 hover:text-white transition text-sm p-1" title="Maximize">\u26F6</button>
                    <button id="clear-chat-btn" class="text-slate-400 hover:text-rose-400 transition text-xs p-1" title="Clear Chat">\uD83D\uDDD1\uFE0F</button>
                    <button id="close-chat-window" class="text-slate-400 hover:text-white transition text-xs p-1">\u2715</button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" id="chat-messages-container">
                <div class="chat-msg-system bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-200">
                    System active. Ask me about medical hardware safety thresholds, manuals, or standard parameters.
                </div>
            </div>
            <div id="chat-suggestions" class="px-4 pb-2 flex flex-wrap gap-2 flex-shrink-0"></div>
            <div id="chat-input-footer" class="p-3 border-t border-white/10 bg-slate-950/20 flex-shrink-0"></div>
            <div id="order-popup-overlay" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                <div class="glass-card p-6 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4" onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center sticky top-0 bg-slate-900/80 pb-2">
                        <h3 class="text-sm font-bold text-white">\uD83D\uDCE6 New Device Order</h3>
                        <button id="close-order-popup" class="text-slate-400 hover:text-white text-lg">\u2715</button>
                    </div>
                    <div class="text-xs space-y-4" id="order-form-container">
                        <div class="space-y-2">
                            <h4 class="text-indigo-300 font-semibold text-xs uppercase tracking-wider">Device Details</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-slate-400 mb-1">Device Name *</label><input type="text" id="order-device-name" placeholder="e.g. Siemens Multix Fusion" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Category</label><input type="text" id="order-category" placeholder="e.g. X-Ray" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Model</label><input type="text" id="order-model" placeholder="Model number" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Manufacturer</label><input type="text" id="order-manufacturer" placeholder="e.g. GE Healthcare" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Quantity *</label><input type="number" id="order-quantity" value="1" min="1" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Priority</label><select id="order-priority" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div>
                                <div class="col-span-2"><label class="block text-slate-400 mb-1">Purpose</label><input type="text" id="order-purpose" placeholder="e.g. Department upgrade" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-indigo-300 font-semibold text-xs uppercase tracking-wider">Hospital Information</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="col-span-2"><label class="block text-slate-400 mb-1">Hospital Name *</label><input type="text" id="order-hospital-name" placeholder="Full hospital name" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Department</label><input type="text" id="order-department" placeholder="e.g. Radiology" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Ward / ICU</label><input type="text" id="order-ward" placeholder="e.g. ICU-2" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Doctor Name *</label><input type="text" id="order-doctor-name" placeholder="Attending physician" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Contact Person</label><input type="text" id="order-contact-person" placeholder="Contact person name" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Phone Number *</label><input type="tel" id="order-phone" placeholder="+1 (555) 123-4567" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Email</label><input type="email" id="order-email" placeholder="email@hospital.com" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-indigo-300 font-semibold text-xs uppercase tracking-wider">Patient Information</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div><label class="block text-slate-400 mb-1">Patient Name</label><input type="text" id="order-patient-name" placeholder="Patient name" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Patient ID</label><input type="text" id="order-patient-id" placeholder="ID number" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Age</label><input type="number" id="order-patient-age" placeholder="Age" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Gender</label><select id="order-patient-gender" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                                <div class="col-span-2"><label class="block text-slate-400 mb-1">Diagnosis / Medical Condition</label><input type="text" id="order-diagnosis" placeholder="Diagnosis or condition" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Emergency Level</label><select id="order-emergency" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-indigo-300 font-semibold text-xs uppercase tracking-wider">Delivery Information</h4>
                            <div class="grid grid-cols-2 gap-2">
                                <div class="col-span-2"><label class="block text-slate-400 mb-1">Hospital Address</label><input type="text" id="order-address" placeholder="Street address" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">City</label><input type="text" id="order-city" placeholder="City" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">State</label><input type="text" id="order-state" placeholder="State" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Postal Code</label><input type="text" id="order-zip" placeholder="Postal code" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                                <div><label class="block text-slate-400 mb-1">Country</label><input type="text" id="order-country" placeholder="Country" value="United States" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></div>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <h4 class="text-indigo-300 font-semibold text-xs uppercase tracking-wider">Additional Notes</h4>
                            <textarea id="order-notes" rows="2" placeholder="Clinical remarks or special instructions..." class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition"></textarea>
                        </div>
                        <div id="order-form-errors" class="text-rose-400 text-xs hidden"></div>
                        <button id="submit-device-order" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl text-white transition tracking-wide shadow-md text-sm">Submit Order</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    container.querySelector("#chat-input-footer").appendChild(buildInputElementArray());
    return container;
}

function buildChatDOMStructure() {
    const panel = document.createElement("div");
    panel.className = "glass-card w-full h-[600px] rounded-2xl flex flex-col overflow-hidden";
    panel.innerHTML = `
        <div class="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <span class="text-sm font-bold text-white tracking-wide">Console Terminal Diagnostics</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="clear-chat-btn" class="text-slate-400 hover:text-rose-400 transition text-xs p-1" title="Clear Chat">\uD83D\uDDD1\uFE0F</button>
            </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" id="chat-messages-container"></div>
        <div id="chat-suggestions" class="px-4 pb-2 flex flex-wrap gap-2 flex-shrink-0"></div>
        <div class="p-4 border-t border-white/10 bg-slate-950/20 flex-shrink-0" id="chat-input-footer"></div>
    `;
    panel.querySelector("#chat-input-footer").appendChild(buildInputElementArray());
    return panel;
}

function buildInputElementArray() {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center gap-2";
    wrapper.innerHTML = `
        <button id="chat-voice-btn" class="glass-btn p-2.5 rounded-xl text-slate-400 hover:text-white transition text-sm" title="Voice Input Mode">\uD83C\uDFA4</button>
        <input type="text" id="chat-text-input" placeholder="Query device telemetry specs..." class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition">
        <button id="chat-send-btn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white transition">Send</button>
    `;
    return wrapper;
}

// --- 9. CHAT ENGINE ---
function attachChatEngineListeners() {
    const triggerBtn = document.getElementById("chat-trigger-fab");
    const windowFrame = document.getElementById("floating-chat-window");
    const closeBtn = document.getElementById("close-chat-window");
    const sendBtn = document.getElementById("chat-send-btn");
    const inputField = document.getElementById("chat-text-input");
    const voiceBtn = document.getElementById("chat-voice-btn");
    const closeOrderPopup = document.getElementById("close-order-popup");
    const submitOrder = document.getElementById("submit-device-order");
    const maximizeBtn = document.getElementById("maximize-chat-btn");
    const clearBtn = document.getElementById("clear-chat-btn");

    if (triggerBtn && windowFrame) {
        triggerBtn.addEventListener("click", () => {
            const isHidden = windowFrame.classList.contains("hidden");
            if (isHidden) {
                windowFrame.classList.remove("hidden");
                requestAnimationFrame(() => {
                    windowFrame.classList.remove("opacity-0", "scale-95");
                    appendChatSuggestions();
                });
            } else {
                windowFrame.classList.add("opacity-0", "scale-95");
                setTimeout(() => windowFrame.classList.add("hidden"), 300);
            }
        });
    }

    if (closeBtn && windowFrame) {
        closeBtn.addEventListener("click", () => {
            windowFrame.classList.add("opacity-0", "scale-95");
            setTimeout(() => windowFrame.classList.add("hidden"), 300);
        });
    }

    // Maximize / Minimize
    if (maximizeBtn && windowFrame) {
        maximizeBtn.addEventListener("click", () => {
            AppState.isMaximized = !AppState.isMaximized;
            if (AppState.isMaximized) {
                windowFrame.classList.add('chat-maximized');
                maximizeBtn.textContent = '\u26F6';
                maximizeBtn.title = 'Minimize';
            } else {
                windowFrame.classList.remove('chat-maximized');
                maximizeBtn.textContent = '\u26F6';
                maximizeBtn.title = 'Maximize';
            }
        });
    }

    // Clear chat
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            if (confirm("Clear all chat messages?")) {
                const container = document.getElementById("chat-messages-container");
                if (container) {
                    container.innerHTML = '<div class="chat-msg-system bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-200">System active. Ask me about medical hardware safety thresholds, manuals, or standard parameters.</div>';
                    chatHistory = [];
                }
                const suggestions = document.getElementById("chat-suggestions");
                if (suggestions) suggestions.innerHTML = '';
                AppState.chatbotInitialized = false;
                AppState.chatbotInitialized = true;
                fetchChatSuggestions();
                showNotification("Chat history cleared.", "success");
            }
        });
    }

    const dispatchSubmission = () => {
        const queryText = inputField.value.trim();
        if (queryText) {
            executeOutboundQuery(queryText);
            inputField.value = "";
        }
    };

    if (sendBtn) sendBtn.addEventListener("click", dispatchSubmission);
    if (inputField) {
        inputField.addEventListener("keydown", (e) => {
            if (e.key === "Enter") dispatchSubmission();
        });
    }

    if (voiceBtn) voiceBtn.addEventListener("click", () => toggleChatVoiceRecognition(inputField));

    if (closeOrderPopup) {
        closeOrderPopup.addEventListener("click", closeOrderPopupOverlay);
    }

    if (submitOrder) {
        submitOrder.addEventListener("click", submitDeviceOrder);
    }

    // Close order overlay on backdrop click
    const overlay = document.getElementById("order-popup-overlay");
    if (overlay) {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeOrderPopupOverlay();
        });
    }
}

// --- 10. CHATBOT VOICE (FIXED) ---
let chatRecognition = null;

function toggleChatVoiceRecognition(targetInput) {
    const voiceBtn = document.getElementById("chat-voice-btn");
    if (!voiceBtn) return;

    if (AppState.voiceActive) {
        if (chatRecognition) {
            chatRecognition.abort();
            chatRecognition = null;
        }
        AppState.voiceActive = false;
        voiceBtn.classList.remove("bg-rose-500/20", "text-rose-400");
        voiceBtn.innerHTML = '\uD83C\uDFA4';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showNotification("Voice input is not supported. Please use Chrome or Edge.", "error");
        return;
    }

    try {
        chatRecognition = new SpeechRecognition();
        chatRecognition.lang = 'en-US';
        chatRecognition.interimResults = true;
        chatRecognition.continuous = false;

        chatRecognition.onstart = () => {
            AppState.voiceActive = true;
            voiceBtn.classList.add("bg-rose-500/20", "text-rose-400");
            voiceBtn.innerHTML = '\uD83C\uDFA4 <span class="text-[10px]">...\uD83C\uDFA4</span>';
        };

        chatRecognition.onerror = (event) => {
            AppState.voiceActive = false;
            chatRecognition = null;
            voiceBtn.classList.remove("bg-rose-500/20", "text-rose-400");
            voiceBtn.innerHTML = '\uD83C\uDFA4';
            if (event.error === 'not-allowed') {
                showNotification("Microphone permission denied. Please allow in browser settings.", "error");
            } else if (event.error === 'no-speech') {
                showNotification("No speech detected. Try again.", "error");
            } else {
                showNotification("Voice error: " + event.error, "error");
            }
        };

        chatRecognition.onend = () => {
            AppState.voiceActive = false;
            chatRecognition = null;
            voiceBtn.classList.remove("bg-rose-500/20", "text-rose-400");
            voiceBtn.innerHTML = '\uD83C\uDFA4';
        };

        chatRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalTranscript += t;
                else interimTranscript += t;
            }
            if (targetInput) {
                if (finalTranscript) {
                    targetInput.value = finalTranscript;
                    targetInput.focus();
                    setTimeout(() => {
                        executeOutboundQuery(finalTranscript);
                        targetInput.value = '';
                    }, 300);
                } else if (interimTranscript) {
                    targetInput.value = interimTranscript;
                }
            }
        };

        chatRecognition.start();
    } catch (err) {
        AppState.voiceActive = false;
        voiceBtn.classList.remove("bg-rose-500/20", "text-rose-400");
        voiceBtn.innerHTML = '\uD83C\uDFA4';
        showNotification("Failed to start voice: " + err.message, "error");
    }
}

// --- 11. CHAT SUGGESTIONS ---
function appendChatSuggestions() {
    const container = document.getElementById('chat-suggestions');
    if (!container) return;
    const cards = container.querySelectorAll('.suggestion-card');
    if (cards.length > 0) return;
    fetchChatSuggestions();
}

async function fetchChatSuggestions() {
    try {
        const response = await fetch("/api/suggestions");
        const data = await response.json();
        if (data.status === "success" && data.suggestions) {
            renderSuggestionCards(data.suggestions);
        }
    } catch (err) {
        console.error("Failed to fetch suggestions:", err);
    }
}

function renderSuggestionCards(suggestions) {
    const container = document.getElementById('chat-suggestions');
    if (!container) return;
    container.innerHTML = '';
    suggestions.forEach((text) => {
        const card = document.createElement('button');
        card.className = 'suggestion-card text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/10 text-slate-300 hover:text-white transition cursor-pointer';
        card.textContent = text.length > 40 ? text.substring(0, 40) + '...' : text;
        card.title = text;
        card.addEventListener('click', () => handleSuggestionClick(text));
        container.appendChild(card);
    });
    const orderCard = document.createElement('button');
    orderCard.className = 'suggestion-card text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition cursor-pointer';
    orderCard.textContent = '\uD83D\uDCE6 Order Device';
    orderCard.addEventListener('click', openOrderPopupOverlay);
    container.appendChild(orderCard);
}

function handleSuggestionClick(text) {
    const input = document.getElementById('chat-text-input');
    if (input) {
        input.value = text;
        executeOutboundQuery(text);
        input.value = '';
    }
}

// --- 12. ORDER POPUP ---
function openOrderPopupOverlay() {
    const overlay = document.getElementById('order-popup-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
    }
}

function closeOrderPopupOverlay() {
    const overlay = document.getElementById('order-popup-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function validateOrderForm() {
    const fields = {
        'order-device-name': 'Device Name',
        'order-hospital-name': 'Hospital Name',
        'order-doctor-name': 'Doctor Name',
        'order-phone': 'Phone Number'
    };
    const errors = [];
    for (const [id, label] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            errors.push(label + ' is required');
        }
    }
    return errors;
}

async function submitDeviceOrder() {
    const errContainer = document.getElementById('order-form-errors');
    const submitBtn = document.getElementById('submit-device-order');

    const errors = validateOrderForm();
    if (errors.length > 0) {
        if (errContainer) {
            errContainer.textContent = errors.join('; ');
            errContainer.classList.remove('hidden');
        }
        return;
    }
    if (errContainer) errContainer.classList.add('hidden');

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

    const formData = {
        device_name: document.getElementById('order-device-name')?.value?.trim() || '',
        category: document.getElementById('order-category')?.value?.trim() || '',
        model: document.getElementById('order-model')?.value?.trim() || '',
        manufacturer: document.getElementById('order-manufacturer')?.value?.trim() || '',
        quantity: parseInt(document.getElementById('order-quantity')?.value) || 1,
        priority: document.getElementById('order-priority')?.value || 'normal',
        purpose: document.getElementById('order-purpose')?.value?.trim() || '',
        hospital_name: document.getElementById('order-hospital-name')?.value?.trim() || '',
        department: document.getElementById('order-department')?.value?.trim() || '',
        ward: document.getElementById('order-ward')?.value?.trim() || '',
        doctor_name: document.getElementById('order-doctor-name')?.value?.trim() || '',
        contact_person: document.getElementById('order-contact-person')?.value?.trim() || '',
        phone: document.getElementById('order-phone')?.value?.trim() || '',
        email: document.getElementById('order-email')?.value?.trim() || '',
        patient_name: document.getElementById('order-patient-name')?.value?.trim() || '',
        patient_id: document.getElementById('order-patient-id')?.value?.trim() || '',
        patient_age: document.getElementById('order-patient-age')?.value || '',
        patient_gender: document.getElementById('order-patient-gender')?.value || '',
        diagnosis: document.getElementById('order-diagnosis')?.value?.trim() || '',
        emergency_level: document.getElementById('order-emergency')?.value || 'routine',
        address: document.getElementById('order-address')?.value?.trim() || '',
        city: document.getElementById('order-city')?.value?.trim() || '',
        state: document.getElementById('order-state')?.value?.trim() || '',
        zip: document.getElementById('order-zip')?.value?.trim() || '',
        country: document.getElementById('order-country')?.value?.trim() || '',
        notes: document.getElementById('order-notes')?.value?.trim() || ''
    };

    let authHeaderValue = "";
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) authHeaderValue = `Bearer ${session.access_token}`;
    }

    try {
        const response = await fetch("/api/order-device", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeaderValue },
            body: JSON.stringify(formData)
        });

        if (response.status === 401) {
            closeOrderPopupOverlay();
            showNotification("Please sign in to place an order.", "error");
            setTimeout(() => { window.location.href = '/login'; }, 1500);
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Order'; }
            return;
        }

        const data = await response.json();
        if (data.status === "success") {
            closeOrderPopupOverlay();
            document.querySelectorAll('#order-form-container input, #order-form-container textarea, #order-form-container select').forEach(el => {
                if (el.type === 'number') el.value = el.id === 'order-quantity' ? '1' : '';
                else if (el.tagName === 'SELECT') el.selectedIndex = 0;
                else el.value = '';
            });
            if (document.getElementById('order-country')) document.getElementById('order-country').value = 'United States';
            appendChatMessage("assistant", `\u2705 ${data.message}`, true);
            showNotification("Order submitted successfully!", "success");
            trackOrder();
            const ordersList = JSON.parse(localStorage.getItem('md_orders_list') || '[]');
            ordersList.push(`${data.order_id} - ${formData.device_name} (${formData.hospital_name})`);
            localStorage.setItem('md_orders_list', JSON.stringify(ordersList));
        } else {
            if (errContainer) { errContainer.textContent = data.message; errContainer.classList.remove('hidden'); }
            showNotification(data.message || "Order failed.", "error");
        }
    } catch (err) {
        showNotification("Network error placing order.", "error");
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Order'; }
}

// --- 13. EXECUTE OUTBOUND QUERY ---
async function executeOutboundQuery(promptString) {
    lastUserQuery = promptString;
    appendChatMessage("user", promptString);

    const loadingId = showChatLoading();

    let authHeaderValue = "";
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) authHeaderValue = `Bearer ${session.access_token}`;
    }

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": authHeaderValue },
            body: JSON.stringify({ message: promptString, session_id: "v2_dynamic_session" })
        });
        const data = await response.json();
        removeChatLoading(loadingId);

        if (data.status === "success") {
            const answerText = (data.device && data.confidence >= 0.3)
                ? `${data.answer}\n\n\u2699\uFE0F *Device: ${data.device} | Confidence: ${(data.confidence * 100).toFixed(1)}% | Response: ${data.response_time}ms*`
                : data.answer;
            appendChatMessage("assistant", answerText, true);
            if (!data.history_retained) {
                ephemeralGuestHistory.push({ prompt: promptString, response: data.answer });
            }
            // Add follow-up suggestions
            setTimeout(() => addFollowUpSuggestions(promptString), 500);
        } else {
            appendChatMessage("assistant", "System encountered errors evaluating matching array tokens.", true);
        }
    } catch (err) {
        removeChatLoading(loadingId);
        console.error("Pipeline failure:", err);
        appendChatMessage("assistant", "Network failure connecting to backend execution framework.", true);
    }
}

function addFollowUpSuggestions(previousQuery) {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;
    // Remove existing follow-up suggestions
    const existing = container.querySelector('.follow-up-container');
    if (existing) existing.remove();

    const suggestions = generateFollowUps(previousQuery);
    if (!suggestions.length) return;

    const div = document.createElement('div');
    div.className = 'follow-up-container flex flex-wrap gap-2 mr-auto';
    suggestions.forEach(text => {
        const btn = document.createElement('button');
        btn.className = 'text-xs px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 hover:text-white transition cursor-pointer';
        btn.textContent = text.length > 35 ? text.substring(0, 35) + '...' : text;
        btn.title = text;
        btn.addEventListener('click', () => handleSuggestionClick(text));
        div.appendChild(btn);
    });
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function generateFollowUps(query) {
    const q = query.toLowerCase();
    const all = [
        "Tell me about Siemens Multix Fusion",
        "What is the price of GE Definium Tempo?",
        "Which machine has the highest accuracy?",
        "Best MRI machine?",
        "What are the features of Philips EPIQ Elite?",
        "Which CT scanner is cheapest?",
        "Tell me about Philips Incisive CT",
        "Which ultrasound machine has AI features?",
        "What is the accuracy of Canon Vantage Orian?",
        "Tell me about GE Revolution Apex",
        "Which patient monitor is recommended for ICU?",
        "Best ECG machine?"
    ];
    // Pick 3 random that differ from the current query
    const filtered = all.filter(s => s.toLowerCase() !== q);
    const shuffled = filtered.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
}

// --- 14. CHAT MESSAGE RENDERING ---
function showChatLoading() {
    const targetBox = document.getElementById("chat-messages-container");
    if (!targetBox) return null;
    const id = 'loading-' + Date.now();
    const loader = document.createElement("div");
    loader.id = id;
    loader.className = "flex items-start mr-auto";
    loader.innerHTML = `
        <div class="p-3 rounded-2xl glass-card text-slate-400 rounded-bl-none flex items-center gap-2 text-sm">
            <span class="chat-loader-spinner"></span>
            <span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
    `;
    targetBox.appendChild(loader);
    targetBox.scrollTop = targetBox.scrollHeight;
    return id;
}

function removeChatLoading(id) {
    if (!id) return;
    const loader = document.getElementById(id);
    if (loader) loader.remove();
}

function appendChatMessage(sender, text, isBot = false) {
    const targetBox = document.getElementById("chat-messages-container");
    if (!targetBox) return;

    // Remove welcome message if it's still there and this is a real message
    const welcome = targetBox.querySelector('.chat-msg-system');
    if (welcome && !isBot) {
        welcome.remove();
    }

    const msgId = 'msg-' + (messageIdCounter++);
    const timestamp = getTimestamp();

    const msg = document.createElement("div");
    msg.id = msgId;
    msg.className = `flex flex-col max-w-[85%] chat-message ${sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'} animate-fade-in`;

    let extraActions = '';
    if (isBot) {
        extraActions = `
            <div class="flex items-center gap-2 mt-1 ${sender === 'user' ? 'justify-end' : 'justify-start'}">
                <button class="chat-action-btn copy-btn text-slate-500 hover:text-white transition" title="Copy response" data-text="${encodeURIComponent(text)}">\uD83D\uDCCB</button>
                <button class="chat-action-btn regenerate-btn text-slate-500 hover:text-white transition" title="Regenerate">\uD83D\uDD04</button>
                <button class="chat-action-btn like-btn text-slate-500 hover:text-emerald-400 transition" title="Like">\uD83D\uDC4D</button>
                <button class="chat-action-btn dislike-btn text-slate-500 hover:text-rose-400 transition" title="Dislike">\uD83D\uDC4E</button>
                <span class="text-[10px] text-slate-600">${timestamp}</span>
            </div>
        `;
    } else {
        extraActions = `
            <div class="flex items-center gap-2 mt-1 justify-end">
                <span class="text-[10px] text-slate-600">${timestamp}</span>
            </div>
        `;
    }

    msg.innerHTML = `
        <div class="p-3 rounded-2xl text-sm leading-relaxed chat-bubble ${sender === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'glass-card text-slate-200 rounded-bl-none'}">
            ${text.replace(/\n/g, '<br>')}
        </div>
        ${extraActions}
    `;

    targetBox.appendChild(msg);
    targetBox.scrollTop = targetBox.scrollHeight;

    // Store in history
    chatHistory.push({ id: msgId, sender, text, timestamp });

    // Attach action listeners
    if (isBot) {
        const copyBtn = msg.querySelector('.copy-btn');
        const regenBtn = msg.querySelector('.regenerate-btn');
        const likeBtn = msg.querySelector('.like-btn');
        const dislikeBtn = msg.querySelector('.dislike-btn');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const txt = decodeURIComponent(copyBtn.dataset.text);
                navigator.clipboard.writeText(txt).then(() => {
                    showNotification("Response copied to clipboard!", "success");
                }).catch(() => {
                    // Fallback
                    const ta = document.createElement('textarea');
                    ta.value = txt;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                    showNotification("Response copied!", "success");
                });
            });
        }

        if (regenBtn) {
            regenBtn.addEventListener('click', () => {
                if (lastUserQuery) {
                    // Remove this message
                    msg.remove();
                    executeOutboundQuery(lastUserQuery);
                }
            });
        }

        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                likeBtn.classList.toggle('text-emerald-400');
                likeBtn.classList.toggle('text-slate-500');
                showNotification("Thanks for your feedback!", "success");
            });
        }

        if (dislikeBtn) {
            dislikeBtn.addEventListener('click', () => {
                dislikeBtn.classList.toggle('text-rose-400');
                dislikeBtn.classList.toggle('text-slate-500');
                showNotification("Feedback recorded.", "success");
            });
        }
    }
}

// --- 15. USER DASHBOARD ---
function loadUserDashboard() {
    const greeting = document.getElementById('user-dashboard-greeting');
    if (greeting && currentUser) {
        const name = (currentUser.email || '').split('@')[0];
        greeting.textContent = `Welcome back, ${name}`;
    }

    // Load stats from localStorage
    const queryCount = parseInt(localStorage.getItem('md_queries') || '0');
    const favCount = parseInt(localStorage.getItem('md_favorites') || '0');
    const orderCount = parseInt(localStorage.getItem('md_orders') || '0');
    const avgConf = localStorage.getItem('md_avg_confidence') || '--';

    const elQuery = document.getElementById('stat-queries');
    const elFav = document.getElementById('stat-favorites');
    const elOrd = document.getElementById('stat-orders');
    const elAcc = document.getElementById('stat-accuracy');

    if (elQuery) elQuery.textContent = queryCount;
    if (elFav) elFav.textContent = favCount;
    if (elOrd) elOrd.textContent = orderCount;
    if (elAcc) elAcc.textContent = avgConf;

    // Recently viewed
    const recent = JSON.parse(localStorage.getItem('md_recent') || '[]');
    const recentEl = document.getElementById('recent-devices');
    if (recentEl) {
        if (recent.length > 0) {
            recentEl.innerHTML = recent.slice(0, 5).map(d =>
                `<div class="flex items-center gap-2 p-2 rounded-lg bg-white/5 mb-1 text-slate-300">${d}</div>`
            ).join('');
        } else {
            recentEl.textContent = 'No devices viewed yet.';
        }
    }

    // Favorites
    const favs = JSON.parse(localStorage.getItem('md_favs') || '[]');
    const favEl = document.getElementById('favorite-devices');
    if (favEl) {
        if (favs.length > 0) {
            favEl.innerHTML = favs.map(d =>
                `<div class="flex items-center gap-2 p-2 rounded-lg bg-white/5 mb-1 text-slate-300">⭐ ${d}</div>`
            ).join('');
        } else {
            favEl.textContent = 'No favorites yet. Browse devices to add some.';
        }
    }

    // Orders
    const orders = JSON.parse(localStorage.getItem('md_orders_list') || '[]');
    const ordEl = document.getElementById('order-history');
    if (ordEl) {
        if (orders.length > 0) {
            ordEl.innerHTML = orders.slice(-5).reverse().map(o =>
                `<div class="flex items-center gap-2 p-2 rounded-lg bg-white/5 mb-1 text-xs text-slate-300">📦 ${o}</div>`
            ).join('');
        } else {
            ordEl.textContent = 'No orders placed yet.';
        }
    }

    // Activity timeline
    const activity = JSON.parse(localStorage.getItem('md_activity') || '[]');
    const actEl = document.getElementById('activity-timeline');
    if (actEl) {
        if (activity.length > 0) {
            actEl.innerHTML = activity.slice(-10).reverse().map(a =>
                `<div class="flex items-start gap-2 text-xs text-slate-400 border-l-2 border-indigo-500/30 pl-3 py-1">${a}</div>`
            ).join('');
        } else {
            actEl.innerHTML = '<div class="text-slate-500">No recent activity.</div>';
        }
    }

    // Saved searches
    const searches = JSON.parse(localStorage.getItem('md_searches') || '[]');
    const searchEl = document.getElementById('saved-searches');
    if (searchEl) {
        if (searches.length > 0) {
            searchEl.innerHTML = searches.slice(-5).reverse().map(s =>
                `<div class="p-2 rounded-lg bg-white/5 mb-1 text-xs text-slate-300">🔍 ${s}</div>`
            ).join('');
        } else {
            searchEl.textContent = 'No saved searches.';
        }
    }

    // Personalized suggestions
    loadUserSuggestions();
}

async function loadUserSuggestions() {
    const container = document.getElementById('user-suggestions');
    if (!container) return;
    try {
        const response = await fetch("/api/suggestions");
        const data = await response.json();
        if (data.status === "success" && data.suggestions) {
            container.innerHTML = data.suggestions.map(s =>
                `<button class="text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-slate-300 hover:text-white transition text-xs" onclick="window.location.href='/dashboard'; localStorage.setItem('md_pending_query','${s.replace(/'/g, "\\'")}')">💡 ${s.length > 50 ? s.substring(0, 50) + '...' : s}</button>`
            ).join('');
        }
    } catch (err) {
        container.innerHTML = '<div class="text-slate-500">Could not load suggestions.</div>';
    }
}

// Track user activity helpers
function trackQuery() {
    const count = parseInt(localStorage.getItem('md_queries') || '0');
    localStorage.setItem('md_queries', count + 1);
    addActivity('Asked: ' + (lastUserQuery || 'a question'));
}

function trackOrder() {
    const count = parseInt(localStorage.getItem('md_orders') || '0');
    localStorage.setItem('md_orders', count + 1);
}

function addActivity(text) {
    const activity = JSON.parse(localStorage.getItem('md_activity') || '[]');
    activity.push(text + ' at ' + new Date().toLocaleTimeString());
    localStorage.setItem('md_activity', JSON.stringify(activity));
}

// Intercept query to track
const originalExecute = executeOutboundQuery;
executeOutboundQuery = function(promptString) {
    trackQuery();
    return originalExecute.apply(this, arguments);
};

// --- 16. DEVICES PAGE ---
function setupDeviceSearch() {
    const searchInput = document.getElementById('device-search-input');
    const searchBtn = document.getElementById('device-search-btn');
    const grid = document.getElementById('device-cards-grid');
    const loading = document.getElementById('devices-loading');
    const categoryBtns = document.querySelectorAll('[data-category]');

    if (!grid) return;

    // Load devices
    let allDevices = [];

    fetch('/api/devices')
        .then(r => r.json())
        .then(data => {
            if (data.status === "success") {
                allDevices = data.devices;
                if (loading) loading.remove();
                renderDevices(allDevices);
            }
        })
        .catch(() => {
            if (loading) loading.textContent = 'Failed to load devices.';
        });

    function renderDevices(devices) {
        if (devices.length === 0) {
            grid.innerHTML = '<div class="text-slate-500 text-center py-8 col-span-full">No devices found.</div>';
            return;
        }
        grid.innerHTML = devices.map(d => `
            <div class="glass-card p-4 rounded-2xl space-y-2 cursor-pointer hover:border-indigo-500/30 transition device-card" data-device='${JSON.stringify(d).replace(/'/g, "&#39;")}'>
                <div class="text-xs font-bold text-white">${d.name}</div>
                <div class="text-[10px] text-indigo-300">${d.category}</div>
                <div class="text-[10px] text-slate-400">${d.manufacturer}</div>
                <div class="text-[10px] text-slate-500 mt-1">${d.description.substring(0, 80)}${d.description.length > 80 ? '...' : ''}</div>
                <button class="text-[10px] mt-2 px-2 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50 transition view-detail-btn">View Details</button>
            </div>
        `).join('');

        // Attach detail modal handlers
        grid.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.device-card');
                if (card) {
                    try {
                        const deviceData = JSON.parse(card.dataset.device);
                        showDeviceDetail(deviceData);
                    } catch (err) {
                        showNotification("Could not load device details.", "error");
                    }
                }
            });
        });
    }

    function showDeviceDetail(device) {
        const modal = document.getElementById('device-detail-modal');
        if (!modal) return;
        modal.innerHTML = `
            <div class="glass-card p-6 rounded-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto custom-scrollbar space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-bold text-white">${device.name}</h3>
                    <button class="close-modal text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                <div class="space-y-2 text-xs">
                    <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-slate-400">Category</span><span class="text-slate-200">${device.category}</span></div>
                    <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-slate-400">Manufacturer</span><span class="text-slate-200">${device.manufacturer}</span></div>
                    <div class="pt-2 text-slate-300">${device.description}</div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        modal.querySelector('.close-modal').addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    }

    // Search
    function filterDevices() {
        const query = (searchInput?.value || '').toLowerCase();
        const activeCat = document.querySelector('[data-category].active')?.dataset.category || 'all';
        const filtered = allDevices.filter(d => {
            const matchesSearch = !query || d.name.toLowerCase().includes(query) || d.manufacturer.toLowerCase().includes(query) || d.description.toLowerCase().includes(query);
            const matchesCat = activeCat === 'all' || d.category === activeCat;
            return matchesSearch && matchesCat;
        });
        renderDevices(filtered);
    }

    if (searchInput) searchInput.addEventListener('input', filterDevices);
    if (searchBtn) searchBtn.addEventListener('click', filterDevices);

    // Category buttons
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active', 'bg-indigo-600/30', 'text-white'));
            btn.classList.add('active', 'bg-indigo-600/30', 'text-white');
            filterDevices();
        });
    });
}

// --- 17. CONTACT FORM ---
function setupContactForm() {
    const form = document.getElementById('contact-form');
    const status = document.getElementById('contact-message-status');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('contact-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

        const data = {
            name: document.getElementById('contact-name')?.value || '',
            email: document.getElementById('contact-email')?.value || '',
            subject: document.getElementById('contact-subject')?.value || '',
            message: document.getElementById('contact-message')?.value || ''
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.status === 'success') {
                if (status) {
                    status.textContent = result.message;
                    status.className = 'text-sm text-center text-emerald-400';
                }
                form.reset();
                showNotification(result.message, 'success');
            } else {
                if (status) {
                    status.textContent = result.message;
                    status.className = 'text-sm text-center text-rose-400';
                }
            }
        } catch (err) {
            if (status) {
                status.textContent = 'Network error. Please try again.';
                status.className = 'text-sm text-center text-rose-400';
            }
        }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; }
    });
}

// --- 18. GLOBAL CONTROLS ---
function setupGlobalDOMEvents() {
    const authBtn = document.getElementById("nav-auth-btn");
    const logoutBtn = document.getElementById("logout-trigger-btn");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");
    const authMessage = document.getElementById("auth-message");

    const showMessage = (message, isError = false) => {
        if (authMessage) {
            authMessage.textContent = message;
            authMessage.className = `rounded-xl border p-4 text-sm ${isError ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-white/10 bg-white/5 text-slate-300'}`;
        }
    };

    const triggerSignOut = async (e) => {
        if (e) e.preventDefault();
        if (supabaseClient && (AppState.isAuthenticated || currentUser)) {
            try { await supabaseClient.auth.signOut(); } catch (err) { console.error(err); }
        }
        clearAuthCookie();
        currentUser = null;
        AppState.isAuthenticated = false;
        updateAuthUIElements(false);
        window.location.href = "/";
    };

    if (authBtn) {
        authBtn.addEventListener("click", async (e) => {
            if (AppState.isAuthenticated) { await triggerSignOut(e); }
            else if (window.location.pathname !== '/login') { window.location.href = '/login'; }
        });
    }

    if (logoutBtn) logoutBtn.addEventListener("click", triggerSignOut);

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) { showMessage("Supabase not configured.", true); return; }
            const email = document.getElementById("login-email")?.value || "";
            const password = document.getElementById("login-password")?.value || "";
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) { showMessage(error.message, true); return; }
                currentUser = data.user;
                AppState.isAuthenticated = true;
                setAuthCookie(data.session.access_token, 1);
                document.cookie = `sb-user-email=${encodeURIComponent(data.user.email || "")}; path=/; SameSite=Lax;`;
                updateAuthUIElements(true);
                showMessage(`Welcome back, ${data.user.email}.`);
                window.location.href = "/dashboard";
            } catch (err) { showMessage("Unable to sign in right now.", true); console.error(err); }
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!supabaseClient) { showMessage("Supabase not configured.", true); return; }
            const email = document.getElementById("signup-email")?.value || "";
            const password = document.getElementById("signup-password")?.value || "";
            try {
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                if (error) { showMessage(error.message, true); return; }
                currentUser = data.user;
                AppState.isAuthenticated = true;
                if (data.session) {
                    setAuthCookie(data.session.access_token, 1);
                    document.cookie = `sb-user-email=${encodeURIComponent(data.user.email || "")}; path=/; SameSite=Lax;`;
                }
                updateAuthUIElements(true);
                showMessage("Account created. You can now access the dashboard.");
                window.location.href = "/dashboard";
            } catch (err) { showMessage("Unable to create an account.", true); console.error(err); }
        });
    }

    // Check for pending query from user suggestions
    const pending = localStorage.getItem('md_pending_query');
    if (pending) {
        localStorage.removeItem('md_pending_query');
        setTimeout(() => {
            const input = document.getElementById('workspace-query-input');
            if (input) {
                input.value = pending;
                submitWorkspaceQuery();
            }
        }, 500);
    }
}
