/* ─────────────────────────────────────────────────
   MEDCORE HMS · AUTHENTICATION LOGIC
   ───────────────────────────────────────────────── */

// 1. Role segmented control
function setRole(btn) {
    document.querySelectorAll('.seg-item').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    clearErrors(); 
}

// 2. Password visibility toggle
let pwVisible = false;
function togglePw() {
    pwVisible = !pwVisible;
    const inp = document.getElementById('password');
    inp.type = pwVisible ? 'text' : 'password';
}

// 3. Form validation
function clearErrors() {
    ['staffId', 'password'].forEach(id => {
        document.getElementById(id).classList.remove('err');
    });
    document.getElementById('err-id').style.display = 'none';
    document.getElementById('err-pw').style.display = 'none';
}

function handleLogin() {
    clearErrors();
    const id = document.getElementById('staffId').value.trim();
    const pw = document.getElementById('password').value;
    
    const activeRoleBtn = document.querySelector('.seg-item.active');
    const role = activeRoleBtn ? activeRoleBtn.textContent.trim() : '';

    let ok = true;

    if (!id) {
        document.getElementById('staffId').classList.add('err');
        document.getElementById('err-id').style.display = 'flex';
        document.getElementById('err-id-text').textContent = 'Please enter your Staff ID.';
        ok = false;
    }
    if (!pw) {
        document.getElementById('password').classList.add('err');
        document.getElementById('err-pw').style.display = 'flex';
        document.getElementById('err-pw-text').textContent = 'Please enter your password.';
        ok = false;
    }

    if (ok) {
        // Enforce Admin Only Logic
        if (!role.includes('Admin')) {
            document.getElementById('err-id').style.display = 'flex';
            document.getElementById('err-id-text').textContent = 'Access Restricted: Only Admin login is currently enabled.';
            return;
        }

        // Hardcoded Admin Credentials
        if (id.toLowerCase() !== 'admin' || pw !== 'admin') {
            document.getElementById('staffId').classList.add('err');
            document.getElementById('password').classList.add('err');
            document.getElementById('err-pw').style.display = 'flex';
            document.getElementById('err-pw-text').textContent = 'Invalid credentials. Please use "admin" for both.';
            return;
        }

        // Success Redirect
        const btn = document.getElementById('signInBtn');
        btn.textContent = 'Authenticating…';
        btn.disabled = true;

        setTimeout(() => {
            btn.textContent = 'Redirecting...';
            window.location.href = 'dashboard.html';
        }, 1200);
    }
}

// Allow Enter key to submit
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
});