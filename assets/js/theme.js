// 1. Instantly check local storage BEFORE the page renders
if (localStorage.getItem('medcore_theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
} else {
    document.documentElement.setAttribute('data-theme', 'light');
}

// 2. The toggle function (Triggers when the button is clicked)
function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', target);
    localStorage.setItem('medcore_theme', target);
    
    updateThemeIcon(target);
}

// 3. Update the SVG icon visually (Moon for dark, Sun for light)
function updateThemeIcon(theme) {
    const icon = document.getElementById('themeIcon');
    if(!icon) return;
    
    if (theme === 'dark') {
        // Sun Icon (To switch back to light)
        icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
        // Moon Icon (To switch to dark)
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
}

// 4. Ensure the icon matches the state when the page finishes loading
document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('medcore_theme') === 'dark') {
        updateThemeIcon('dark');
    }
});