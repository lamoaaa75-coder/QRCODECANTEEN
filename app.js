// ========== CONFIGURATION ==========
const CONFIG = {
    STORAGE_KEYS: {
        POINTAGES: 'kraken::cantine::pointages',
        FIGURANTS: 'kraken::cantine::figurants',
        LISTE_TECHNIQUE: 'kraken::cantine::listeTechnique',
        PREFERENCES: 'kraken::cantine::preferences'
    },
    CATEGORIES: {
        EQUIPE: 'equipe',
        RENFORTS: 'renforts',
        INVITES: 'invites',
        SECURITE: 'securite',
        CANTINE: 'cantine',
        FIGURANTS: 'figurants'
    },
    SCAN_DELAY: 500, // Anti-doublon scan en ms
    REFOCUS_INTERVAL: 2000 // Refocus périodique en ms
};

// ========== ÉTAT GLOBAL ==========
let currentWorkingDate = null;
let currentCategory = 'equipe';
let listeTechnique = [];
let lastScanTime = 0;
let currentEditId = null;
let modalCategory = null;

// ========== UTILITAIRES ==========
function generateId() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayDate() {
    return formatDate(new Date());
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ========== STOCKAGE ==========
function loadPointagesFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.POINTAGES);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Erreur parsing localStorage pointages:', error);
        return {};
    }
}

function savePointagesToStorage(pointages) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.POINTAGES, JSON.stringify(pointages));
    } catch (error) {
        console.error('Erreur sauvegarde pointages:', error);
        showToast('❌ Impossible de sauvegarder', true);
    }
}

function getPointagesForDate(date) {
    const all = loadPointagesFromStorage();
    return all[date] || [];
}

function savePointagesForDate(date, pointages) {
    const all = loadPointagesFromStorage();
    all[date] = pointages;
    savePointagesToStorage(all);
}

function loadFigurantsFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.FIGURANTS);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Erreur parsing localStorage figurants:', error);
        return {};
    }
}

function saveFigurantsToStorage(figurants) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.FIGURANTS, JSON.stringify(figurants));
    } catch (error) {
        console.error('Erreur sauvegarde figurants:', error);
        showToast('❌ Impossible de sauvegarder', true);
    }
}

function getFigurantCountForDate(date) {
    const all = loadFigurantsFromStorage();
    return all[date] || 0;
}

function saveFigurantCountForDate(date, count) {
    const all = loadFigurantsFromStorage();
    all[date] = count;
    saveFigurantsToStorage(all);
}

function loadListeTechniqueFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.LISTE_TECHNIQUE);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Erreur parsing localStorage liste technique:', error);
        return [];
    }
}

function saveListeTechniqueToStorage(liste) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LISTE_TECHNIQUE, JSON.stringify(liste));
    } catch (error) {
        console.error('Erreur sauvegarde liste technique:', error);
        showToast('❌ Impossible de sauvegarder', true);
    }
}

function loadPreferencesFromStorage() {
    try {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.PREFERENCES);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error('Erreur parsing localStorage préférences:', error);
        return {};
    }
}

function savePreferencesToStorage(prefs) {
    try {
        const existing = loadPreferencesFromStorage();
        const updated = { ...existing, ...prefs };
        localStorage.setItem(CONFIG.STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
    } catch (error) {
        console.error('Erreur sauvegarde préférences:', error);
    }
}

// ========== GESTION DATE ==========
function initWorkingDate() {
    const prefs = loadPreferencesFromStorage();
    currentWorkingDate = prefs.lastWorkingDate || getTodayDate();

    const dateInput = document.getElementById('workingDate');
    dateInput.value = currentWorkingDate;

    // Également initialiser les dates d'export
    document.getElementById('exportFromDate').value = currentWorkingDate;
    document.getElementById('exportToDate').value = currentWorkingDate;
}

function setWorkingDate(date) {
    currentWorkingDate = date;
    savePreferencesToStorage({ lastWorkingDate: date });
    renderAll();
}

// ========== ANTI-DOUBLONS ==========
function isDuplicate(newPointage, existingPointages) {
    const categorie = newPointage.categorie;

    for (const p of existingPointages) {
        if (p.categorie !== categorie) continue;

        // Équipe : nom + prénom
        if (categorie === CONFIG.CATEGORIES.EQUIPE) {
            if (p.nom === newPointage.nom && p.prenom === newPointage.prenom) {
                return true;
            }
        }
        // Renforts/Invités : nom seul
        else if (categorie === CONFIG.CATEGORIES.RENFORTS || categorie === CONFIG.CATEGORIES.INVITES) {
            if (p.nom === newPointage.nom) {
                return true;
            }
        }
        // Sécurité : nom + société
        else if (categorie === CONFIG.CATEGORIES.SECURITE) {
            if (p.nom === newPointage.nom && p.societe === newPointage.societe) {
                return true;
            }
        }
        // Cantine : pas de doublon (scan multiple autorisé)
    }

    return false;
}

// ========== GESTION DU SCAN ==========
function handleScanInput(e) {
    if (e.key !== 'Enter') return;

    const now = Date.now();
    if (now - lastScanTime < CONFIG.SCAN_DELAY) {
        return; // Anti-doublon temporel
    }
    lastScanTime = now;

    const input = e.target;
    const value = input.value.trim().toUpperCase();

    if (!value) return;

    // Afficher feedback
    const scanStatus = document.getElementById('scanStatus');
    scanStatus.textContent = '⚡ Scan en cours...';
    scanStatus.classList.add('active');

    setTimeout(() => {
        processScan(value);
        input.value = '';
        scanStatus.textContent = '';
        scanStatus.classList.remove('active');
        refocusScannerInput();
    }, 300);
}

function processScan(value) {
    // Détection du type de badge
    if (value === 'RENFORT') {
        openScanModal('renforts');
    } else if (value === 'INVITE') {
        openScanModal('invites');
    } else if (value === 'SECURITE') {
        openScanModal('securite');
    } else if (value === 'CANTINE') {
        openScanModal('cantine');
    } else if (value === 'FIGURANT') {
        incrementFigurant();
        showToast('✅ Figurant ajouté');
    } else {
        // Format équipe : "Prénom NOM DÉPARTEMENT"
        handleEquipeScan(value);
    }
}

function handleEquipeScan(value) {
    const parts = value.split(' ');
    if (parts.length < 2) {
        showToast('⚠️ Format de badge non reconnu', true);
        return;
    }

    // Essayer de trouver dans la liste technique
    const person = listeTechnique.find(p =>
        value.includes(p.nom.toUpperCase()) && value.includes(p.prenom.toUpperCase())
    );

    if (person) {
        addPointage({
            categorie: CONFIG.CATEGORIES.EQUIPE,
            nom: person.nom,
            prenom: person.prenom,
            departement: person.departement || '',
            poste: person.poste || '',
            societe: null,
            inviteDe: null,
            origine: 'qr'
        });
    } else {
        // Extraire nom/prénom du scan
        const prenom = parts[0];
        const nom = parts.slice(1, parts.findIndex(p => p === p.toUpperCase())).join(' ') || parts[1];
        const dept = parts.slice(2).join(' ');

        addPointage({
            categorie: CONFIG.CATEGORIES.EQUIPE,
            nom: nom,
            prenom: prenom,
            departement: dept,
            poste: '',
            societe: null,
            inviteDe: null,
            origine: 'qr'
        });
    }
}

function openScanModal(categorie) {
    modalCategory = categorie;
    currentEditId = null;
    configureModalFields(categorie);
    clearModalInputs();

    const titles = {
        'renforts': 'Ajouter un renfort',
        'invites': 'Ajouter un invité',
        'securite': 'Ajouter sécurité',
        'cantine': 'Ajouter cantine',
        'equipe': 'Ajouter équipe'
    };

    document.getElementById('modalTitle').textContent = titles[categorie] || 'Ajouter';
    document.getElementById('inputModal').classList.add('active');

    // Focus sur premier champ
    setTimeout(() => {
        document.getElementById('modalNom').focus();
    }, 100);
}

// ========== MODALS ==========
function configureModalFields(categorie) {
    const nomGroup = document.getElementById('nomGroup');
    const prenomGroup = document.getElementById('prenomGroup');
    const deptGroup = document.getElementById('deptGroup');
    const societeGroup = document.getElementById('societeGroup');
    const inviteDeGroup = document.getElementById('inviteDeGroup');

    const nomLabel = document.getElementById('nomLabel');
    const prenomLabel = document.getElementById('prenomLabel');

    // Tout masquer par défaut
    [prenomGroup, deptGroup, societeGroup, inviteDeGroup].forEach(g => g.classList.add('hidden'));
    [nomLabel, prenomLabel].forEach(l => l.classList.remove('required'));

    // NOM toujours requis (sauf cantine)
    if (categorie !== 'cantine') {
        nomLabel.classList.add('required');
    }

    // Afficher selon catégorie
    if (categorie === 'renforts') {
        deptGroup.classList.remove('hidden');
    } else if (categorie === 'invites') {
        inviteDeGroup.classList.remove('hidden');
    } else if (categorie === 'securite') {
        societeGroup.classList.remove('hidden');
    } else if (categorie === 'equipe') {
        prenomGroup.classList.remove('hidden');
        deptGroup.classList.remove('hidden');
        prenomLabel.classList.add('required');
    }
}

function clearModalInputs() {
    document.getElementById('modalNom').value = '';
    document.getElementById('modalPrenom').value = '';
    document.getElementById('modalDept').value = '';
    document.getElementById('modalSociete').value = '';
    document.getElementById('modalInviteDe').value = '';
}

function openManualModal(categorie) {
    openScanModal(categorie);
}

function closeInputModal() {
    document.getElementById('inputModal').classList.remove('active');
    currentEditId = null;
    modalCategory = null;
    refocusScannerInput();
}

function saveFromModal() {
    const nom = document.getElementById('modalNom').value.trim().toUpperCase();
    const prenom = document.getElementById('modalPrenom').value.trim();
    const dept = document.getElementById('modalDept').value.trim();
    const societe = document.getElementById('modalSociete').value.trim();
    const inviteDe = document.getElementById('modalInviteDe').value.trim();

    // Validation
    if (modalCategory !== 'cantine' && !nom) {
        showToast('⚠️ Le nom est obligatoire', true);
        return;
    }

    if (modalCategory === 'equipe' && !prenom) {
        showToast('⚠️ Le prénom est obligatoire', true);
        return;
    }

    const pointage = {
        categorie: modalCategory,
        nom: nom,
        prenom: prenom || '',
        departement: dept || '',
        poste: '',
        societe: societe || '',
        inviteDe: inviteDe || '',
        origine: 'manuel'
    };

    if (currentEditId) {
        // Mode édition
        updatePointage(currentEditId, pointage);
    } else {
        // Mode ajout
        addPointage(pointage);
    }

    closeInputModal();
}

function addPointage(pointage) {
    const pointages = getPointagesForDate(currentWorkingDate);

    // Vérifier doublon
    if (isDuplicate(pointage, pointages)) {
        showToast('⚠️ Déjà pointé aujourd\'hui', true);
        return false;
    }

    pointage.id = generateId();
    pointage.date = currentWorkingDate;
    pointages.push(pointage);
    savePointagesForDate(currentWorkingDate, pointages);

    const nom = pointage.prenom ? `${pointage.prenom} ${pointage.nom}` : pointage.nom;
    showToast(`✅ ${nom} pointé(e)`);

    renderAll();
    return true;
}

function updatePointage(id, updatedData) {
    const pointages = getPointagesForDate(currentWorkingDate);
    const index = pointages.findIndex(p => p.id === id);

    if (index !== -1) {
        pointages[index] = { ...pointages[index], ...updatedData };
        savePointagesForDate(currentWorkingDate, pointages);
        showToast('✅ Modifié');
        renderAll();
    }
}

function editPointage(id) {
    const pointages = getPointagesForDate(currentWorkingDate);
    const pointage = pointages.find(p => p.id === id);

    if (!pointage) return;

    currentEditId = id;
    modalCategory = pointage.categorie;

    configureModalFields(pointage.categorie);

    // Pré-remplir
    document.getElementById('modalNom').value = pointage.nom || '';
    document.getElementById('modalPrenom').value = pointage.prenom || '';
    document.getElementById('modalDept').value = pointage.departement || '';
    document.getElementById('modalSociete').value = pointage.societe || '';
    document.getElementById('modalInviteDe').value = pointage.inviteDe || '';

    const titles = {
        'renforts': 'Modifier le renfort',
        'invites': 'Modifier l\'invité',
        'securite': 'Modifier sécurité',
        'cantine': 'Modifier cantine',
        'equipe': 'Modifier équipe'
    };

    document.getElementById('modalTitle').textContent = titles[pointage.categorie] || 'Modifier';
    document.getElementById('inputModal').classList.add('active');

    setTimeout(() => {
        document.getElementById('modalNom').focus();
    }, 100);
}

function deletePointage(id) {
    const pointages = getPointagesForDate(currentWorkingDate);
    const index = pointages.findIndex(p => p.id === id);

    if (index === -1) return;

    const pointage = pointages[index];
    const nom = pointage.prenom ? `${pointage.prenom} ${pointage.nom}` : pointage.nom;

    if (confirm(`Supprimer ${nom} ?`)) {
        pointages.splice(index, 1);
        savePointagesForDate(currentWorkingDate, pointages);
        showToast(`❌ ${nom} retiré(e)`);
        renderAll();
    }
}

// ========== GESTION ÉQUIPE ==========
function toggleEquipeMember(nom, prenom) {
    const pointages = getPointagesForDate(currentWorkingDate);
    const index = pointages.findIndex(p =>
        p.nom === nom && p.prenom === prenom && p.categorie === CONFIG.CATEGORIES.EQUIPE
    );

    if (index !== -1) {
        // Déjà pointé → retirer
        pointages.splice(index, 1);
        showToast(`❌ ${prenom} ${nom} retiré(e)`);
    } else {
        // Pas pointé → ajouter
        const person = listeTechnique.find(p => p.nom === nom && p.prenom === prenom);

        const pointage = {
            id: generateId(),
            date: currentWorkingDate,
            categorie: CONFIG.CATEGORIES.EQUIPE,
            nom: nom,
            prenom: prenom,
            departement: person ? person.departement || '' : '',
            poste: person ? person.poste || '' : '',
            societe: null,
            inviteDe: null,
            origine: 'manuel'
        };

        pointages.push(pointage);
        showToast(`✅ ${prenom} ${nom} pointé(e)`);
    }

    savePointagesForDate(currentWorkingDate, pointages);
    renderAll();
}

function isAlreadyPointed(person) {
    const pointages = getPointagesForDate(currentWorkingDate);
    return pointages.some(p =>
        p.nom === person.nom && p.prenom === person.prenom && p.categorie === CONFIG.CATEGORIES.EQUIPE
    );
}

// ========== GESTION FIGURANTS ==========
function incrementFigurant() {
    const current = getFigurantCountForDate(currentWorkingDate);
    saveFigurantCountForDate(currentWorkingDate, current + 1);
    renderAll();
}

function decrementFigurant() {
    const current = getFigurantCountForDate(currentWorkingDate);
    if (current > 0) {
        saveFigurantCountForDate(currentWorkingDate, current - 1);
        renderAll();
    }
}

// ========== RENDER ==========
function renderAll() {
    renderEquipeList();
    renderRenfortsList();
    renderInvitesList();
    renderSecuriteList();
    renderCantineList();
    renderFigurantCount();
    updateTotalCounts();
}

function renderEquipeList() {
    const container = document.getElementById('equipeList');

    if (listeTechnique.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune liste technique chargée. Importez un fichier CSV.</div>';
        return;
    }

    // Grouper par département
    const byDept = {};
    listeTechnique.forEach(person => {
        const dept = person.departement || 'NON DÉFINI';
        if (!byDept[dept]) byDept[dept] = [];
        byDept[dept].push(person);
    });

    let html = '';
    Object.keys(byDept).sort().forEach(dept => {
        html += `<div class="dept-group">`;
        html += `<div class="dept-header">${dept}</div>`;
        html += `<ul class="name-list">`;

        byDept[dept].forEach(person => {
            const isChecked = isAlreadyPointed(person);
            html += `
                <li class="${isChecked ? 'checked' : ''}"
                    onclick="toggleEquipeMember('${person.nom}', '${person.prenom}')">
                    <span class="check-icon">${isChecked ? '✓' : ''}</span>
                    <span>${person.prenom} ${person.nom}</span>
                </li>
            `;
        });

        html += `</ul></div>`;
    });

    container.innerHTML = html;
}

function renderRenfortsList() {
    renderExtraList('renforts', 'renfortsList', 'renfortsTotal');
}

function renderInvitesList() {
    renderExtraList('invites', 'invitesList', 'invitesTotal');
}

function renderSecuriteList() {
    renderExtraList('securite', 'securiteList', 'securiteTotal');
}

function renderCantineList() {
    renderExtraList('cantine', 'cantineList', 'cantineTotal');
}

function renderExtraList(categorie, listId, totalId) {
    const pointages = getPointagesForDate(currentWorkingDate).filter(p => p.categorie === categorie);
    const container = document.getElementById(listId);
    const totalContainer = document.getElementById(totalId);

    if (pointages.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucun pointage</div>';
    } else {
        let html = '';
        pointages.forEach(p => {
            let detail = '';
            if (p.departement) detail = p.departement;
            else if (p.societe) detail = p.societe;
            else if (p.inviteDe) detail = `Invité de ${p.inviteDe}`;

            const displayName = p.prenom ? `${p.prenom} ${p.nom}` : p.nom;

            html += `
                <li class="extra-item">
                    <div class="extra-content">
                        <span class="extra-name">${displayName}</span>
                        ${detail ? `<span class="extra-detail">${detail}</span>` : ''}
                    </div>
                    <div class="extra-actions">
                        <button class="extra-edit-btn" onclick="editPointage('${p.id}')" aria-label="Éditer">✏️</button>
                        <button class="extra-delete-btn" onclick="deletePointage('${p.id}')" aria-label="Supprimer">🗑️</button>
                    </div>
                </li>
            `;
        });
        container.innerHTML = html;
    }

    totalContainer.textContent = `Total : ${pointages.length}`;
}

function renderFigurantCount() {
    const count = getFigurantCountForDate(currentWorkingDate);
    document.getElementById('figurantCount').textContent = count;
}

function updateTotalCounts() {
    const pointages = getPointagesForDate(currentWorkingDate);
    const figurantCount = getFigurantCountForDate(currentWorkingDate);

    const equipeCount = pointages.filter(p => p.categorie === CONFIG.CATEGORIES.EQUIPE).length;
    const totalCount = pointages.length + figurantCount;

    document.getElementById('statsEquipe').textContent = equipeCount;
    document.getElementById('statsFigurants').textContent = figurantCount;
    document.getElementById('statsTotal').textContent = totalCount;
}

// ========== IMPORT CSV ==========
function parseCSVListeTechnique(csvText) {
    console.log('=== PARSING CSV ===');

    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    console.log('Nombre de lignes:', lines.length);

    if (lines.length === 0) {
        showToast('⚠️ Fichier CSV vide', true);
        return;
    }

    // Détecter séparateur
    const header = lines[0];
    let separator = ';';
    if (header.includes('\t')) separator = '\t';
    else if (header.includes(',') && !header.includes(';')) separator = ',';

    console.log('Séparateur détecté:', separator);

    // Parser en-tête
    const headers = header.split(separator).map(h => h.trim().toLowerCase());
    console.log('En-têtes:', headers);

    // Trouver indices des colonnes
    let nomPrenomIndex = headers.findIndex(h => h.includes('nom') && h.includes('prenom'));
    let nomIndex = headers.findIndex(h => h.match(/^nom$/i));
    let prenomIndex = headers.findIndex(h => h.match(/^prenom$/i));
    let deptIndex = headers.findIndex(h => h.includes('departement') || h.includes('dept'));
    let posteIndex = headers.findIndex(h => h.includes('poste') || h.includes('fonction'));
    let qrIndex = headers.findIndex(h => h.includes('qr') || h.includes('code'));

    console.log('Indices:', { nomPrenomIndex, nomIndex, prenomIndex, deptIndex, posteIndex, qrIndex });

    const data = [];

    // Parser chaque ligne
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(separator).map(c => c.trim());

        let nom, prenom, departement, poste, qrCode;

        // Extraire nom/prénom
        if (nomPrenomIndex >= 0) {
            // Format "Prénom NOM" dans une colonne
            const parts = columns[nomPrenomIndex].split(' ');
            if (parts.length >= 2) {
                prenom = parts[0];
                nom = parts.slice(1).join(' ');
            }
        } else {
            // Colonnes séparées
            nom = nomIndex >= 0 ? columns[nomIndex] : '';
            prenom = prenomIndex >= 0 ? columns[prenomIndex] : '';
        }

        departement = deptIndex >= 0 ? columns[deptIndex] : '';
        poste = posteIndex >= 0 ? columns[posteIndex] : '';
        qrCode = qrIndex >= 0 ? columns[qrIndex] : `${prenom} ${nom} ${departement}`.trim();

        if (nom && prenom) {
            data.push({
                nom: nom.toUpperCase(),
                prenom: prenom,
                departement: departement,
                poste: poste,
                qrCode: qrCode,
                categorie: 'equipe',
                societe: null
            });
        }
    }

    console.log('Personnes parsées:', data.length);

    if (data.length === 0) {
        showToast('⚠️ Aucune donnée valide trouvée', true);
        return;
    }

    listeTechnique = data;
    saveListeTechniqueToStorage(data);
    showToast(`✅ ${data.length} personne(s) chargée(s) !`);
    renderAll();
}

function loadCSVListeTechnique(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const csvText = e.target.result;
        parseCSVListeTechnique(csvText);
    };

    reader.onerror = () => {
        showToast('❌ Erreur lecture fichier', true);
    };

    reader.readAsText(file, 'UTF-8');
}

// ========== EXPORT CSV ==========
function exportCSVForRange(fromDate, toDate) {
    const allPointages = loadPointagesFromStorage();
    const allFigurants = loadFigurantsFromStorage();
    const exportData = [];

    // Itérer sur chaque date de la plage
    const from = new Date(fromDate);
    const to = new Date(toDate);

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const pointages = allPointages[dateStr] || [];
        const figurantCount = allFigurants[dateStr] || 0;

        // Ajouter pointages normaux
        pointages.forEach(p => {
            // Récupérer poste depuis liste technique si équipe
            let poste = p.poste || '';
            if (!poste && p.categorie === CONFIG.CATEGORIES.EQUIPE) {
                const person = listeTechnique.find(lt =>
                    lt.nom === p.nom && lt.prenom === p.prenom
                );
                if (person) poste = person.poste || '';
            }

            exportData.push({
                date: dateStr,
                categorie: p.categorie,
                nom: p.nom || '',
                prenom: p.prenom || '',
                departement: p.departement || '',
                poste: poste,
                societe: p.societe || '',
                inviteDe: p.inviteDe || '',
                origine: p.origine,
                quantite: 1
            });
        });

        // Ajouter ligne figurants
        if (figurantCount > 0) {
            exportData.push({
                date: dateStr,
                categorie: 'figurants',
                nom: '',
                prenom: '',
                departement: '',
                poste: '',
                societe: '',
                inviteDe: '',
                origine: 'compteur',
                quantite: figurantCount
            });
        }
    }

    // Trier
    exportData.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.categorie !== b.categorie) return a.categorie.localeCompare(b.categorie);
        if (a.departement !== b.departement) return a.departement.localeCompare(b.departement);
        if (a.nom !== b.nom) return a.nom.localeCompare(b.nom);
        return a.prenom.localeCompare(b.prenom);
    });

    // Générer CSV
    let csv = 'date;categorie;nom;prenom;departement;poste;societe;invite_de;origine;quantite\n';
    exportData.forEach(row => {
        csv += `${row.date};${row.categorie};${row.nom};${row.prenom};${row.departement};${row.poste};${row.societe};${row.inviteDe};${row.origine};${row.quantite}\n`;
    });

    // Télécharger
    downloadCSV(csv, `KRAKEN_Pointage_${fromDate}_${toDate}.csv`);
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('✅ CSV téléchargé');
}

function exportCSV() {
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;

    if (!fromDate || !toDate) {
        showToast('⚠️ Sélectionnez les dates', true);
        return;
    }

    if (fromDate > toDate) {
        showToast('⚠️ Date de début après date de fin', true);
        return;
    }

    exportCSVForRange(fromDate, toDate);
}

// ========== ACTIONS ==========
function resetCurrentDay() {
    if (!confirm(`Réinitialiser tous les pointages du ${currentWorkingDate} ?`)) {
        return;
    }

    savePointagesForDate(currentWorkingDate, []);
    saveFigurantCountForDate(currentWorkingDate, 0);
    showToast('✅ Jour réinitialisé');
    renderAll();
}

function resetAllData() {
    if (!confirm('⚠️ ATTENTION : Supprimer TOUTES les données (tous les jours) ?\n\nCette action est irréversible !')) {
        return;
    }

    if (!confirm('Êtes-vous VRAIMENT sûr ? Toutes les données seront perdues.')) {
        return;
    }

    localStorage.removeItem(CONFIG.STORAGE_KEYS.POINTAGES);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.FIGURANTS);
    showToast('✅ Toutes les données supprimées');
    renderAll();
}

// ========== ONGLETS ==========
function switchTab(tabName) {
    currentCategory = tabName;

    // Retirer active de tous les onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
    });

    // Ajouter active au bon onglet
    const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');
    }

    // Masquer tous les contenus
    document.querySelectorAll('.tab-content').forEach(content => {
        content.setAttribute('aria-hidden', 'true');
    });

    // Afficher le bon contenu
    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) {
        activeContent.setAttribute('aria-hidden', 'false');
    }

    refocusScannerInput();
}

// ========== THÈME ==========
function initTheme() {
    const prefs = loadPreferencesFromStorage();
    const theme = prefs.theme || 'dark';

    if (theme === 'light') {
        document.body.classList.add('light-theme');
        document.querySelector('.theme-toggle').textContent = '☀️';
    } else {
        document.querySelector('.theme-toggle').textContent = '🌙';
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    const theme = isLight ? 'light' : 'dark';

    document.querySelector('.theme-toggle').textContent = isLight ? '☀️' : '🌙';

    savePreferencesToStorage({ theme });
}

// ========== FOCUS MANAGEMENT ==========
function refocusScannerInput() {
    const modal = document.getElementById('inputModal');
    if (!modal.classList.contains('active')) {
        setTimeout(() => {
            document.getElementById('qrInput').focus();
        }, 100);
    }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Scanner input
    document.getElementById('qrInput').addEventListener('keydown', handleScanInput);

    // Date de travail
    document.getElementById('workingDate').addEventListener('change', (e) => {
        setWorkingDate(e.target.value);
    });

    // Onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });

    // Import CSV
    document.getElementById('csvFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            loadCSVListeTechnique(file);
        }
        e.target.value = ''; // Reset pour permettre re-sélection du même fichier
    });

    // Modal : Escape pour fermer
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInputModal();
        }
    });

    // Modal : clic hors contenu pour fermer
    document.getElementById('inputModal').addEventListener('click', (e) => {
        if (e.target.id === 'inputModal') {
            closeInputModal();
        }
    });

    // Refocus périodique sur scanner
    setInterval(() => {
        refocusScannerInput();
    }, CONFIG.REFOCUS_INTERVAL);
}

// ========== INITIALISATION ==========
function init() {
    console.log('🎬 KRAKEN - Pointage Cantine - Initialisation...');

    // Charger données
    listeTechnique = loadListeTechniqueFromStorage();

    // Initialiser date
    initWorkingDate();

    // Initialiser thème
    initTheme();

    // Event listeners
    setupEventListeners();

    // Render initial
    renderAll();

    // Focus initial
    refocusScannerInput();

    // Enregistrer Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('✅ Service Worker enregistré'))
            .catch(err => console.error('❌ Service Worker erreur:', err));
    }

    console.log('✅ Initialisation terminée');
}

// Lancement
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
