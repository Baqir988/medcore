/* ─────────────────────────────────────────────────
   MEDCORE HMS · PATIENT DIRECTORY LOGIC
   ───────────────────────────────────────────────── */

function toggleDetails(rowId) {
    const detailRow = document.getElementById(rowId);
    if (detailRow.classList.contains('show')) {
        detailRow.classList.remove('show');
    } else {
        const allExpanded = document.querySelectorAll('.expanded-row.show');
        allExpanded.forEach(row => row.classList.remove('show'));
        detailRow.classList.add('show');
    }
}

let currentTabFilter = 'all';

function setTabFilter(tabName, btnElement) {
    const buttons = document.querySelectorAll('#statusFilterControl .seg-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    btnElement.classList.add('active');
    
    currentTabFilter = tabName;
    applyFilters();
}

function applyFilters() {
    const searchInput = document.getElementById("searchInput").value.toLowerCase();
    const physicianFilter = document.getElementById("physicianFilter").value;
    
    const table = document.getElementById("patientTable");
    const tbody = table.getElementsByTagName("tbody")[0];
    const rows = tbody.children;

    let visibleCount = 0;

    for (let i = 0; i < rows.length; i++) {
        if (rows[i].classList.contains('main-patient-row')) {
            const mainRow = rows[i];
            const noteRow = rows[i + 1]; 
            
            const textMatch = mainRow.textContent.toLowerCase().includes(searchInput);
            
            const rowPhysician = mainRow.getAttribute('data-physician');
            const physMatch = (physicianFilter === 'all') || (rowPhysician === physicianFilter);
            
            let tabMatch = true;
            if (currentTabFilter === 'recent') {
                tabMatch = mainRow.getAttribute('data-recent') === 'true';
            } else if (currentTabFilter === 'active') {
                tabMatch = mainRow.getAttribute('data-active') === 'true';
            }

            if (textMatch && physMatch && tabMatch) {
                mainRow.style.display = "";
                visibleCount++;
            } else {
                mainRow.style.display = "none";
                if (noteRow && noteRow.classList.contains('expanded-row')) {
                    noteRow.classList.remove('show');
                }
            }
        }
    }

    const counterText = document.getElementById('visibleCountText');
    if (visibleCount === 0) {
        counterText.innerText = "No patients found";
    } else {
        counterText.innerText = `Showing 1-${visibleCount} of ${visibleCount} patients`;
    }
}