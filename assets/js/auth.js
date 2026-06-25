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
        const btn = document.getElementById('signInBtn');
        btn.textContent = 'Authenticating…';
        btn.disabled = true;

        // ── PHP Backend Authentication ──
        const formData = new FormData();
        formData.append('action', 'login');
        formData.append('staff_id', id);
        formData.append('password', pw);
        formData.append('role', role);

        fetch('api/auth.php', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    btn.textContent = 'Redirecting...';
                    window.location.href = 'dashboard.html';
                } else {
                    document.getElementById('staffId').classList.add('err');
                    document.getElementById('password').classList.add('err');
                    document.getElementById('err-pw').style.display = 'flex';
                    document.getElementById('err-pw-text').textContent = data.error || 'Invalid credentials. Please try again.';
                    btn.textContent = 'Sign In';
                    btn.disabled = false;
                }
            })
            .catch(() => {
                // Fallback to demo mode if backend unavailable
                if (id.toLowerCase() === 'admin' && pw === 'admin') {
                    btn.textContent = 'Redirecting...';
                    window.location.href = 'dashboard.html';
                } else {
                    document.getElementById('err-pw').style.display = 'flex';
                    document.getElementById('err-pw-text').textContent = 'Server error. Use admin/admin for demo mode.';
                    btn.textContent = 'Sign In';
                    btn.disabled = false;
                }
            });
    }
}

// Allow Enter key to submit
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
});