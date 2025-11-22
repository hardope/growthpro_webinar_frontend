class Messenger {
    constructor () {
        this.apiBaseUrl = "https://growthpro-whisper-backend.onrender.com/api";
        this.currentUser = null; // { id, username }
        this.messages = [];
        this.mode = 'signup'; // 'signup' | 'inbox' | 'send'
        this.paramRecipient = null; // username from ?to=
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.detectModeFromQuery();
        this.restoreSession();
        this.render();
    }

    cacheElements() {
        this.el = {
            signupCard: document.getElementById('signupCard'),
            signupForm: document.getElementById('signupForm'),
            signupUsername: document.getElementById('signupUsername'),
            signupStatus: document.getElementById('signupStatus'),
            dashboardCard: document.getElementById('dashboardCard'),
            badgeUsername: document.getElementById('badgeUsername'),
            shareLinkInput: document.getElementById('shareLinkInput'),
            copyLinkBtn: document.getElementById('copyLinkBtn'),
            copyStatus: document.getElementById('copyStatus'),
            messagesList: document.getElementById('messagesList'),
            messageCount: document.getElementById('messageCount'),
            emptyState: document.getElementById('emptyState'),
            refreshBtn: document.getElementById('refreshBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            dividerInbox: document.getElementById('dividerInbox'),
            sendCard: document.getElementById('sendCard'),
            sendRecipientLabel: document.getElementById('sendRecipientLabel'),
            sendForm: document.getElementById('sendForm'),
            sendMessageInput: document.getElementById('sendMessageInput'),
            sendStatus: document.getElementById('sendStatus'),
            appTagline: document.getElementById('appTagline')
        };
    }

    bindEvents() {
        if (this.el.signupForm) {
            this.el.signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.signup();
            });
        }
        if (this.el.copyLinkBtn) {
            this.el.copyLinkBtn.addEventListener('click', () => this.copyShareLink());
        }
        if (this.el.refreshBtn) {
            this.el.refreshBtn.addEventListener('click', () => this.fetchMessages());
        }
        if (this.el.logoutBtn) {
            this.el.logoutBtn.addEventListener('click', () => this.logout());
        }
        if (this.el.sendForm) {
            this.el.sendForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendAnonymousMessage();
            });
        }
    }

    detectModeFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const to = params.get('to');
        if (to) {
            this.mode = 'send';
            this.paramRecipient = to.trim().toLowerCase();
        }
    }

    restoreSession() {
        const raw = localStorage.getItem('whisper_user');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                if (data && data.username && data.id) {
                    this.currentUser = data;
                    if (this.mode !== 'send') {
                        this.mode = 'inbox';
                    }
                }
            } catch (_) {}
        }
    }

    setStatus(el, msg, type = '') {
        if (!el) return;
        el.textContent = msg;
        el.className = 'status' + (type ? ' ' + type : '');
    }

    async signup() {
        const username = this.el.signupUsername.value.trim().toLowerCase();
        if (!username) return this.setStatus(this.el.signupStatus, 'Username required', 'error');
        this.setStatus(this.el.signupStatus, 'Creating...', '');
        try {
            const res = await fetch(`${this.apiBaseUrl}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            if (data && data.user) {
                this.currentUser = data.user;
                localStorage.setItem('whisper_user', JSON.stringify(this.currentUser));
                this.mode = 'inbox';
                this.setStatus(this.el.signupStatus, 'Signup successful! 🎉', 'success');
                await this.fetchMessages();
                this.render();
            } else {
                this.setStatus(this.el.signupStatus, data.message || 'Unable to signup', 'error');
            }
        } catch (e) {
            this.setStatus(this.el.signupStatus, 'Network error', 'error');
        }
    }

    buildShareLink() {
        if (!this.currentUser) return '';
        const origin = window.location.origin;
        return `${origin}/?to=${encodeURIComponent(this.currentUser.username)}`;
    }

    async fetchMessages() {
        if (!this.currentUser) return;
        try {
            const res = await fetch(`${this.apiBaseUrl}/messages/${this.currentUser.id}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                this.messages = data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
        } catch (e) {
            // ignore errors
        }
        this.renderMessages();
    }

    renderMessages() {
        if (!this.el.messagesList) return;
        this.el.messagesList.innerHTML = '';
        if (!this.messages.length) {
            this.el.emptyState.classList.remove('hidden');
            this.el.messageCount.textContent = '0';
            return;
        }
        this.el.emptyState.classList.add('hidden');
        this.el.messageCount.textContent = String(this.messages.length);
        this.messages.forEach(m => {
            const wrapper = document.createElement('div');
            wrapper.className = 'message-item';
            const p = document.createElement('p');
            p.textContent = m.message;
            const meta = document.createElement('span');
            meta.textContent = this.timeAgo(m.createdAt);
            wrapper.appendChild(p);
            wrapper.appendChild(meta);
            this.el.messagesList.appendChild(wrapper);
        });
    }

    timeAgo(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const diff = (Date.now() - date.getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
        return date.toLocaleDateString();
    }

    async sendAnonymousMessage() {
        const message = this.el.sendMessageInput.value.trim();
        if (!message) return this.setStatus(this.el.sendStatus, 'Message required', 'error');
        if (!this.paramRecipient) return this.setStatus(this.el.sendStatus, 'Recipient missing', 'error');
        this.setStatus(this.el.sendStatus, 'Sending...', '');
        try {
            const res = await fetch(`${this.apiBaseUrl}/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.paramRecipient, message })
            });
            const data = await res.json();
            if (data.message === 'messaged stored') {
                this.el.sendMessageInput.value = '';
                this.setStatus(this.el.sendStatus, 'Sent ✅', 'success');
            } else if (data.message === 'cannot find user') {
                this.setStatus(this.el.sendStatus, 'User not found', 'error');
            } else {
                this.setStatus(this.el.sendStatus, 'Error sending message', 'error');
            }
        } catch (e) {
            this.setStatus(this.el.sendStatus, 'Network error', 'error');
        }
    }

    copyShareLink() {
        const link = this.buildShareLink();
        if (!link) return;
        navigator.clipboard.writeText(link).then(() => {
            this.setStatus(this.el.copyStatus, 'Copied ✅', 'success');
            setTimeout(() => this.setStatus(this.el.copyStatus, ''), 2000);
        }).catch(() => {
            this.setStatus(this.el.copyStatus, 'Unable to copy', 'error');
        });
    }

    logout() {
        localStorage.removeItem('whisper_user');
        this.currentUser = null;
        this.messages = [];
        this.mode = 'signup';
        this.render();
    }

    render() {
        // Modes visibility
        if (this.mode === 'signup') {
            this.show(this.el.signupCard);
            this.show(this.el.dividerInbox);
            this.hide(this.el.dashboardCard);
            this.hide(this.el.sendCard);
            this.el.appTagline.textContent = 'Receive anonymous messages from anyone';
        } else if (this.mode === 'inbox') {
            this.hide(this.el.signupCard);
            this.hide(this.el.dividerInbox);
            this.show(this.el.dashboardCard);
            this.hide(this.el.sendCard);
            if (this.currentUser) {
                this.el.badgeUsername.textContent = `@${this.currentUser.username}`;
                this.el.shareLinkInput.value = this.buildShareLink();
                this.el.appTagline.textContent = 'Your anonymous inbox';
            }
            this.renderMessages();
        } else if (this.mode === 'send') {
            this.hide(this.el.signupCard);
            this.hide(this.el.dividerInbox);
            this.hide(this.el.dashboardCard);
            this.show(this.el.sendCard);
            this.el.sendRecipientLabel.textContent = `Sending to @${this.paramRecipient}`;
            this.el.appTagline.textContent = `Leave an anonymous message for @${this.paramRecipient}`;
        }
    }

    show(el) { if (el) el.classList.remove('hidden'); }
    hide(el) { if (el) el.classList.add('hidden'); }
}

document.addEventListener("DOMContentLoaded", () => {
    new Messenger();
});