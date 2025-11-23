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
let scanModeActive = true; // Mode scan activé par défaut
let quickAddMode = false; // Mode rajout rapide
let actionHistory = []; // Historique des actions (max 10)

// Scan caméra
let cameraStream = null;
let cameraAnimationFrame = null;
let cameraScanActive = false;
let cameraScansCount = 0;
let flashEnabled = false;
let continuousScanMode = false;
let recentScans = []; // 3 derniers scans

// Connexion
let connectionCheckInterval = null;
let lastConnectionCheck = Date.now();
let lastConnectionSuccess = Date.now();

// Tracking erreurs
let errorLog = [];

// Mode plein écran
let fullscreenMode = false;

// Barre mobile
let mobileBarCompact = false;
let mobileBarAutoHide = true;
let mobileBarHidden = false;
let lastScrollY = 0;

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
    console.log('Scan détecté:', value);

    // Détection du type de badge (correspondance exacte pour les modals)

    // FIGURANT - Incrémente directement
    if (value === 'FIGURANT' || value.startsWith('FIGURANT')) {
        incrementFigurant();
        showToast('✅ Figurant ajouté');
        return;
    }

    // RENFORT - Ouvre modal vide
    if (value === 'RENFORT' || value.startsWith('RENFORT')) {
        openScanModal('renforts');
        return;
    }

    // INVITE - Ouvre modal vide
    if (value === 'INVITE' || value.startsWith('INVITE')) {
        openScanModal('invites');
        return;
    }

    // SECURITE ou SÉCURITÉ - Ouvre modal vide
    if (value === 'SECURITE' || value === 'SÉCURITÉ' || value.startsWith('SECURITE') || value.startsWith('SÉCURITÉ')) {
        openScanModal('securite');
        return;
    }

    // CANTINE - Ouvre modal vide
    if (value === 'CANTINE' || value.startsWith('CANTINE')) {
        openScanModal('cantine');
        return;
    }

    // Sinon : Format équipe - Scanner de la liste technique
    handleEquipeScan(value);
}

function handleEquipeScan(value) {
    console.log('Scan équipe:', value);

    // Essayer de matcher avec le QR code de la liste technique
    let person = listeTechnique.find(p => {
        // Comparaison exacte avec qrCode
        if (p.qrCode && p.qrCode.toUpperCase() === value) {
            return true;
        }
        // Comparaison flexible : le scan contient nom ET prénom
        const nomUpper = p.nom.toUpperCase();
        const prenomUpper = p.prenom.toUpperCase();
        return value.includes(nomUpper) && value.includes(prenomUpper);
    });

    if (person) {
        console.log('✅ Trouvé dans liste technique:', person.prenom, person.nom);

        // Vérifier si déjà pointé
        const pointages = getPointagesForDate(currentWorkingDate);
        const alreadyPointed = pointages.some(p =>
            p.nom === person.nom &&
            p.prenom === person.prenom &&
            p.categorie === CONFIG.CATEGORIES.EQUIPE
        );

        if (alreadyPointed) {
            showToast(`⚠️ ${person.prenom} ${person.nom} déjà pointé(e)`, true);
            return;
        }

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
        console.log('❌ Non trouvé dans liste technique');

        // Parser le scan pour extraire les données
        const parts = value.split(' ').filter(p => p.trim());

        if (parts.length < 2) {
            showToast('⚠️ Format de badge non reconnu', true);
            return;
        }

        // Premier mot = prénom, deuxième = nom (ou plus si nom composé)
        const prenom = parts[0];
        const nom = parts[1];
        const dept = parts.slice(2).join(' ');

        console.log('Ajout scan brut:', { prenom, nom, dept });

        addPointage({
            categorie: CONFIG.CATEGORIES.EQUIPE,
            nom: nom.toUpperCase(),
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
    openScanModalWithData(categorie, {});
}

function openScanModalWithData(categorie, data = {}) {
    modalCategory = categorie;
    currentEditId = null;
    configureModalFields(categorie);
    clearModalInputs();

    // Pré-remplir avec les données scannées
    if (data.nom) {
        document.getElementById('modalNom').value = data.nom.toUpperCase();
    }
    if (data.prenom) {
        document.getElementById('modalPrenom').value = data.prenom;
    }
    if (data.departement) {
        document.getElementById('modalDept').value = data.departement;
    }
    if (data.societe) {
        document.getElementById('modalSociete').value = data.societe;
    }
    if (data.inviteDe) {
        document.getElementById('modalInviteDe').value = data.inviteDe;
    }

    const titles = {
        'renforts': 'Ajouter un renfort',
        'invites': 'Ajouter un invité',
        'securite': 'Ajouter sécurité',
        'cantine': 'Ajouter cantine',
        'equipe': 'Ajouter équipe'
    };

    document.getElementById('modalTitle').textContent = titles[categorie] || 'Ajouter';
    document.getElementById('inputModal').classList.add('active');

    // Focus sur premier champ vide ou sur le bouton Valider si tout est rempli
    setTimeout(() => {
        if (!data.nom) {
            document.getElementById('modalNom').focus();
        } else if (categorie === 'renforts' && !data.departement) {
            document.getElementById('modalDept').focus();
        } else if (categorie === 'securite' && !data.societe) {
            document.getElementById('modalSociete').focus();
        } else if (categorie === 'invites' && !data.inviteDe) {
            document.getElementById('modalInviteDe').focus();
        } else {
            // Tout est rempli, focus sur bouton Valider
            document.querySelector('.btn-primary').focus();
        }
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
    quickAddMode = false; // Désactiver le mode rajout rapide à la fermeture
    document.getElementById('quickAddCheckbox').checked = false; // Reset checkbox
    refocusScannerInput();
}

function toggleQuickAddMode() {
    quickAddMode = document.getElementById('quickAddCheckbox').checked;
    if (quickAddMode) {
        showToast('⚡ Mode rajout rapide activé');
    } else {
        showToast('Mode normal activé');
    }
}

function clearModalInputs() {
    document.getElementById('modalNom').value = '';
    document.getElementById('modalPrenom').value = '';
    document.getElementById('modalDept').value = '';
    document.getElementById('modalSociete').value = '';
    document.getElementById('modalInviteDe').value = '';
}

// ========== SAISIE ASSISTÉE ==========
function autoCompleteFromListeTechnique(nom, prenom) {
    // Chercher dans la liste technique
    const matches = listeTechnique.filter(p => {
        const nomMatch = p.nom.toUpperCase() === nom.toUpperCase();
        const prenomMatch = !prenom || p.prenom.toLowerCase() === prenom.toLowerCase();
        return nomMatch && prenomMatch;
    });

    if (matches.length === 1) {
        // Un seul match : auto-compléter
        const person = matches[0];
        document.getElementById('modalPrenom').value = person.prenom;
        if (document.getElementById('modalDept').parentElement.style.display !== 'none') {
            document.getElementById('modalDept').value = person.departement || '';
        }
        showToast(`✓ Auto-complété depuis liste technique`, false);
        return person;
    } else if (matches.length > 1) {
        // Homonymes détectés
        showToast(`⚠️ ${matches.length} homonymes trouvés dans la liste`, true);
        return null;
    }
    return null;
}

function detectDuplicatesInOtherDates(pointage) {
    // Vérifier si existe dans d'autres dates
    const allPointages = loadPointagesFromStorage();
    const duplicates = [];

    Object.keys(allPointages).forEach(date => {
        if (date !== currentWorkingDate) {
            allPointages[date].forEach(p => {
                if (p.nom === pointage.nom && p.prenom === pointage.prenom && p.categorie === pointage.categorie) {
                    duplicates.push(date);
                }
            });
        }
    });

    return duplicates;
}

function addToHistory(action) {
    actionHistory.unshift({
        id: generateId(),
        timestamp: Date.now(),
        date: currentWorkingDate,
        action: action.type,
        data: action.data
    });

    // Garder seulement les 10 dernières actions
    if (actionHistory.length > 10) {
        actionHistory = actionHistory.slice(0, 10);
    }

    updateHistoryDisplay();
}

function undoLastAction() {
    if (actionHistory.length === 0) {
        showToast('⚠️ Aucune action à annuler', true);
        return;
    }

    const lastAction = actionHistory.shift();

    // Annuler selon le type d'action
    if (lastAction.action === 'add') {
        // Retirer le pointage ajouté
        const pointages = getPointagesForDate(lastAction.date);
        const index = pointages.findIndex(p => p.id === lastAction.data.id);
        if (index !== -1) {
            pointages.splice(index, 1);
            savePointagesForDate(lastAction.date, pointages);
            showToast('✅ Action annulée');
            renderAll();
        }
    } else if (lastAction.action === 'delete') {
        // Restaurer le pointage supprimé
        const pointages = getPointagesForDate(lastAction.date);
        pointages.push(lastAction.data);
        savePointagesForDate(lastAction.date, pointages);
        showToast('✅ Suppression annulée');
        renderAll();
    } else if (lastAction.action === 'edit') {
        // Restaurer l'ancienne valeur
        const pointages = getPointagesForDate(lastAction.date);
        const index = pointages.findIndex(p => p.id === lastAction.data.id);
        if (index !== -1) {
            pointages[index] = lastAction.data.oldValue;
            savePointagesForDate(lastAction.date, pointages);
            showToast('✅ Modification annulée');
            renderAll();
        }
    }

    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.disabled = actionHistory.length === 0;
    }
    console.log('Historique:', actionHistory.length, 'actions');
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

    // Auto-compléter poste depuis liste technique si équipe
    if (modalCategory === 'equipe' && !pointage.poste) {
        const match = listeTechnique.find(p =>
            p.nom.toUpperCase() === nom && p.prenom.toLowerCase() === prenom.toLowerCase()
        );
        if (match) {
            pointage.poste = match.poste || '';
        }
    }

    if (currentEditId) {
        // Mode édition
        updatePointage(currentEditId, pointage);
    } else {
        // Mode ajout
        const success = addPointage(pointage);

        if (success && quickAddMode) {
            // Mode rajout rapide : vider et refocus
            clearModalInputs();
            setTimeout(() => {
                document.getElementById('modalNom').focus();
            }, 100);
            return; // Ne pas fermer la modal
        }
    }

    if (!quickAddMode) {
        closeInputModal();
    }
}

function addPointage(pointage) {
    const pointages = getPointagesForDate(currentWorkingDate);

    // Vérifier doublon jour actuel
    if (isDuplicate(pointage, pointages)) {
        showToast('⚠️ Déjà pointé aujourd\'hui', true);
        return false;
    }

    // Détecter doublons dans autres dates (alerte info)
    const duplicatesInOtherDates = detectDuplicatesInOtherDates(pointage);
    if (duplicatesInOtherDates.length > 0) {
        console.log('⚠️ Personne déjà pointée les:', duplicatesInOtherDates.join(', '));
        showToast(`ℹ️ Déjà pointé(e) le ${duplicatesInOtherDates[0]}`, false);
    }

    pointage.id = generateId();
    pointage.date = currentWorkingDate;
    pointage.timestamp = new Date().toISOString(); // Horodatage
    pointages.push(pointage);
    savePointagesForDate(currentWorkingDate, pointages);

    // Ajouter à l'historique
    addToHistory({
        type: 'add',
        data: { ...pointage }
    });

    const nom = pointage.prenom ? `${pointage.prenom} ${pointage.nom}` : pointage.nom;
    showToast(`✅ ${nom} pointé(e)`);

    renderAll();
    return true;
}

function updatePointage(id, updatedData) {
    const pointages = getPointagesForDate(currentWorkingDate);
    const index = pointages.findIndex(p => p.id === id);

    if (index !== -1) {
        const oldValue = { ...pointages[index] };

        pointages[index] = { ...pointages[index], ...updatedData };
        savePointagesForDate(currentWorkingDate, pointages);

        // Ajouter à l'historique
        addToHistory({
            type: 'edit',
            data: { id, oldValue, newValue: { ...pointages[index] } }
        });

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
        // Ajouter à l'historique AVANT la suppression
        addToHistory({
            type: 'delete',
            data: { ...pointage }
        });

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

function renderEquipeList(searchFilter = '') {
    const container = document.getElementById('equipeList');

    if (listeTechnique.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune liste technique chargée. Importez un fichier CSV.</div>';
        return;
    }

    // Filtrer selon la recherche
    const filter = searchFilter.toLowerCase();
    const filteredList = filter
        ? listeTechnique.filter(person => {
            const fullName = `${person.prenom} ${person.nom}`.toLowerCase();
            const dept = (person.departement || '').toLowerCase();
            return fullName.includes(filter) || dept.includes(filter);
        })
        : listeTechnique;

    if (filteredList.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucun résultat pour cette recherche</div>';
        return;
    }

    // Grouper par département
    const byDept = {};
    filteredList.forEach(person => {
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

function filterEquipeList() {
    const searchInput = document.getElementById('equipeSearch');
    const searchValue = searchInput.value.trim();
    const clearBtn = document.getElementById('searchClearBtn');

    // Afficher/masquer le bouton clear
    if (searchValue) {
        clearBtn.style.display = 'flex';
    } else {
        clearBtn.style.display = 'none';
    }

    // Filtrer la liste
    renderEquipeList(searchValue);
}

function clearEquipeSearch() {
    const searchInput = document.getElementById('equipeSearch');
    searchInput.value = '';
    filterEquipeList();

    // Refocus sur l'input si en mode manuel
    if (!scanModeActive) {
        searchInput.focus();
    }
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

    // Extras = Renforts + Invités + Sécurité + Cantine
    const extrasCount = pointages.filter(p =>
        p.categorie === CONFIG.CATEGORIES.RENFORTS ||
        p.categorie === CONFIG.CATEGORIES.INVITES ||
        p.categorie === CONFIG.CATEGORIES.SECURITE ||
        p.categorie === CONFIG.CATEGORIES.CANTINE
    ).length;

    const totalCount = equipeCount + extrasCount + figurantCount;

    document.getElementById('statsEquipe').textContent = equipeCount;
    document.getElementById('statsExtras').textContent = extrasCount;
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
    // Détecter colonne combinée "Nom_Prénom" ou "Nom complet" ou "Nom Prénom" etc.
    let nomPrenomIndex = headers.findIndex(h =>
        (h.includes('nom') && h.includes('prenom')) ||
        h.includes('nom_prenom') ||
        h.includes('prenom_nom') ||
        h.includes('prénom_nom') ||
        h.includes('nom_prénom') ||
        h.includes('nom complet') ||
        h.includes('nom_complet') ||
        h.includes('nomcomplet') ||
        (h.includes('nom') && h.includes('complet'))
    );

    let nomIndex = headers.findIndex(h => h === 'nom');
    let prenomIndex = headers.findIndex(h => h === 'prenom' || h === 'prénom');
    let deptIndex = headers.findIndex(h => h.includes('departement') || h.includes('département') || h.includes('dept'));
    let posteIndex = headers.findIndex(h => h.includes('poste') || h.includes('fonction'));
    let qrIndex = headers.findIndex(h => h.includes('qr') || h.includes('code') || h.includes('#qr'));

    console.log('Indices:', { nomPrenomIndex, nomIndex, prenomIndex, deptIndex, posteIndex, qrIndex });

    const data = [];

    // Parser chaque ligne
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; // Ignorer lignes vides

        const columns = line.split(separator).map(c => c.trim());
        console.log(`Ligne ${i}:`, columns);

        let nom = '';
        let prenom = '';
        let departement = '';
        let poste = '';
        let qrCode = '';

        // Extraire nom/prénom
        if (nomPrenomIndex >= 0 && columns[nomPrenomIndex]) {
            // Format "Prénom NOM" ou "Romain LE GRAND" dans une colonne
            const fullName = columns[nomPrenomIndex];
            const parts = fullName.split(' ').filter(p => p.trim());

            if (parts.length >= 2) {
                // Premier mot = prénom, reste = nom
                prenom = parts[0];
                nom = parts.slice(1).join(' ');
            } else if (parts.length === 1) {
                // Un seul mot, on le met dans nom
                nom = parts[0];
                prenom = nom; // On duplique pour passer la validation
            }
        } else {
            // Colonnes séparées
            nom = nomIndex >= 0 && columns[nomIndex] ? columns[nomIndex] : '';
            prenom = prenomIndex >= 0 && columns[prenomIndex] ? columns[prenomIndex] : '';
        }

        departement = deptIndex >= 0 && columns[deptIndex] ? columns[deptIndex] : '';
        poste = posteIndex >= 0 && columns[posteIndex] ? columns[posteIndex] : '';
        qrCode = qrIndex >= 0 && columns[qrIndex] ? columns[qrIndex] : `${prenom} ${nom} ${departement}`.trim();

        // Validation plus permissive : au moins un nom OU un prénom
        if (nom || prenom) {
            // Si seulement l'un des deux, copier dans l'autre
            if (!nom && prenom) nom = prenom;
            if (!prenom && nom) prenom = nom;

            console.log(`✅ Ajout: ${prenom} ${nom}`);
            data.push({
                nom: nom.toUpperCase(),
                prenom: prenom,
                departement: departement,
                poste: poste,
                qrCode: qrCode,
                categorie: 'equipe',
                societe: null
            });
        } else {
            console.log(`❌ Ignoré (pas de nom/prénom):`, columns);
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

// ========== EXPORT PREVIEW ==========
let currentExportData = null;

function showExportPreview() {
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

    // Générer les données d'export
    currentExportData = generateExportData(fromDate, toDate);

    // Calculer statistiques
    const stats = calculateExportStats(currentExportData);

    // Détecter doublons
    const duplicates = detectExportDuplicates(currentExportData);

    // Remplir le modal
    document.getElementById('exportStatsTotal').textContent = stats.total;
    document.getElementById('exportStatsUnique').textContent = stats.unique;
    document.getElementById('exportStatsPeriod').textContent = `${fromDate} → ${toDate}`;

    // Breakdown par catégorie
    const breakdownHtml = Object.entries(stats.byCategory)
        .map(([cat, count]) => `
            <div class="export-breakdown-item">
                <span class="export-breakdown-category">${cat}</span>
                <span class="export-breakdown-count">${count}</span>
            </div>
        `).join('');
    document.getElementById('exportBreakdown').innerHTML = breakdownHtml;

    // Afficher doublons s'il y en a
    const duplicatesEl = document.getElementById('exportDuplicates');
    if (duplicates.length > 0) {
        duplicatesEl.classList.remove('hidden');
        const duplicatesHtml = duplicates.map(d => `
            <div class="export-duplicate-item">
                ${d.nom} ${d.prenom} (${d.categorie}) - ${d.dates.join(', ')}
            </div>
        `).join('');
        document.getElementById('exportDuplicatesList').innerHTML = duplicatesHtml;
    } else {
        duplicatesEl.classList.add('hidden');
    }

    // Table de prévisualisation (premières 20 lignes)
    const previewRows = currentExportData.slice(0, 20);
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Département</th>
                    <th>Poste</th>
                    <th>Société</th>
                    <th>Invité de</th>
                    <th>Origine</th>
                    <th>Quantité</th>
                </tr>
            </thead>
            <tbody>
                ${previewRows.map(row => `
                    <tr>
                        <td>${row.date}</td>
                        <td>${row.categorie}</td>
                        <td>${row.nom}</td>
                        <td>${row.prenom}</td>
                        <td>${row.departement}</td>
                        <td>${row.poste}</td>
                        <td>${row.societe}</td>
                        <td>${row.inviteDe}</td>
                        <td>${row.origine}</td>
                        <td>${row.quantite}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('exportPreviewTable').innerHTML = tableHtml;

    // Afficher le modal
    document.getElementById('exportPreviewModal').classList.add('active');
}

function generateExportData(fromDate, toDate) {
    const allPointages = loadPointagesFromStorage();
    const allFigurants = loadFigurantsFromStorage();
    const exportData = [];

    const from = new Date(fromDate);
    const to = new Date(toDate);

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const pointages = allPointages[dateStr] || [];
        const figurantCount = allFigurants[dateStr] || 0;

        pointages.forEach(p => {
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
                timestamp: p.timestamp || '',
                quantite: 1
            });
        });

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
                timestamp: '',
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

    return exportData;
}

function calculateExportStats(exportData) {
    const stats = {
        total: exportData.length,
        unique: 0,
        byCategory: {}
    };

    // Compter personnes uniques (par nom+prenom)
    const uniquePeople = new Set();
    exportData.forEach(row => {
        if (row.nom || row.prenom) {
            uniquePeople.add(`${row.nom}|${row.prenom}`);
        }

        // Compter par catégorie
        stats.byCategory[row.categorie] = (stats.byCategory[row.categorie] || 0) + 1;
    });

    stats.unique = uniquePeople.size;

    return stats;
}

function detectExportDuplicates(exportData) {
    const duplicates = [];
    const seen = {};

    exportData.forEach(row => {
        if (row.nom || row.prenom) {
            const key = `${row.nom}|${row.prenom}|${row.categorie}`;
            if (!seen[key]) {
                seen[key] = {
                    nom: row.nom,
                    prenom: row.prenom,
                    categorie: row.categorie,
                    dates: []
                };
            }
            if (!seen[key].dates.includes(row.date)) {
                seen[key].dates.push(row.date);
            }
        }
    });

    // Garder seulement ceux qui apparaissent plusieurs fois
    Object.values(seen).forEach(item => {
        if (item.dates.length > 1) {
            duplicates.push(item);
        }
    });

    return duplicates;
}

function closeExportPreview() {
    document.getElementById('exportPreviewModal').classList.remove('active');
    currentExportData = null;
}

function confirmExport() {
    if (!currentExportData || currentExportData.length === 0) {
        showToast('⚠️ Aucune donnée à exporter', true);
        return;
    }

    const encoding = document.getElementById('exportEncoding').value;
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;

    // Générer CSV
    let csv = 'date;categorie;nom;prenom;departement;poste;societe;invite_de;origine;quantite\n';
    currentExportData.forEach(row => {
        csv += `${row.date};${row.categorie};${row.nom};${row.prenom};${row.departement};${row.poste};${row.societe};${row.inviteDe};${row.origine};${row.quantite}\n`;
    });

    // Télécharger avec encodage
    downloadCSVWithEncoding(csv, `KRAKEN_Pointage_${fromDate}_${toDate}.csv`, encoding);

    // Fermer le modal
    closeExportPreview();
}

function downloadCSVWithEncoding(csvContent, filename, encoding = 'utf-8') {
    let blob;

    if (encoding === 'windows-1252') {
        // Pour Windows-1252, on utilise l'encodage latin1
        const bytes = new Uint8Array(csvContent.length);
        for (let i = 0; i < csvContent.length; i++) {
            bytes[i] = csvContent.charCodeAt(i) & 0xff;
        }
        blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252;' });
    } else {
        // UTF-8 par défaut
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    }

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
    // Ne refocus que si mode scan activé
    if (!scanModeActive) return;

    const modal = document.getElementById('inputModal');
    if (!modal.classList.contains('active')) {
        setTimeout(() => {
            document.getElementById('qrInput').focus();
        }, 100);
    }
}

function toggleScanMode() {
    scanModeActive = !scanModeActive;

    const btn = document.getElementById('scanModeToggle');
    const scanStatus = document.getElementById('scanStatus');

    if (scanModeActive) {
        btn.textContent = '📷 Mode Scan';
        btn.classList.add('active');
        scanStatus.textContent = '✓ Mode scan activé';
        scanStatus.style.color = 'var(--accent)';
        // Refocus immédiatement
        refocusScannerInput();
        showToast('✅ Mode scan activé');
    } else {
        btn.textContent = '✋ Mode Manuel';
        btn.classList.remove('active');
        scanStatus.textContent = '✓ Mode manuel activé';
        scanStatus.style.color = 'var(--text-secondary)';
        // Blur l'input pour ne plus recevoir les scans
        document.getElementById('qrInput').blur();
        showToast('✅ Mode manuel activé');
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

    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        // Escape : fermer modals
        if (e.key === 'Escape') {
            closeInputModal();
            closeExportPreview();
        }

        // Ctrl+Z : annuler dernière action
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undoLastAction();
        }

        // Ctrl+1 à Ctrl+6 : basculer entre onglets
        if (e.ctrlKey && e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const tabs = ['equipe', 'renforts', 'invites', 'securite', 'cantine', 'figurants'];
            switchTab(tabs[parseInt(e.key) - 1]);
        }
    });

    // Modal : clic hors contenu pour fermer
    document.getElementById('inputModal').addEventListener('click', (e) => {
        if (e.target.id === 'inputModal') {
            closeInputModal();
        }
    });

    document.getElementById('exportPreviewModal').addEventListener('click', (e) => {
        if (e.target.id === 'exportPreviewModal') {
            closeExportPreview();
        }
    });

    // Auto-complétion depuis liste technique (sur input nom)
    let autoCompleteTimeout;
    document.getElementById('modalNom').addEventListener('input', (e) => {
        clearTimeout(autoCompleteTimeout);
        autoCompleteTimeout = setTimeout(() => {
            const nom = e.target.value.trim().toUpperCase();
            const prenom = document.getElementById('modalPrenom').value.trim();

            // Seulement auto-compléter si on a au moins 2 caractères et que c'est l'onglet équipe
            if (nom.length >= 2 && modalCategory === 'equipe' && listeTechnique.length > 0) {
                autoCompleteFromListeTechnique(nom, prenom);
            }
        }, 500); // Debounce de 500ms
    });

    // Refocus périodique sur scanner
    setInterval(() => {
        refocusScannerInput();
    }, CONFIG.REFOCUS_INTERVAL);
}

// ========== SCAN CAMÉRA ==========
async function toggleCameraMode() {
    if (cameraScanActive) {
        stopCameraScanning();
    } else {
        await startCameraScanning();
    }
}

async function startCameraScanning() {
    try {
        // Vérifier si jsQR est disponible
        if (typeof jsQR === 'undefined') {
            showToast('⚠️ Bibliothèque de scan QR non chargée', true);
            return;
        }

        // Demander accès caméra
        const constraints = {
            video: {
                facingMode: 'environment', // Caméra arrière sur mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

        const video = document.getElementById('cameraScanVideo');
        video.srcObject = cameraStream;

        // Afficher le panneau caméra
        document.getElementById('cameraScanner').style.display = 'block';
        cameraScanActive = true;
        cameraScansCount = 0;

        // Vérifier support flash/lampe
        const track = cameraStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            document.getElementById('toggleFlash').style.display = 'block';
        }

        // Démarrer le scan en boucle
        video.onloadedmetadata = () => {
            scanQRFromCamera();
        };

        showToast('📸 Scan caméra activé');
        vibrate(50);

    } catch (error) {
        console.error('Erreur accès caméra:', error);

        if (error.name === 'NotAllowedError') {
            showToast('⚠️ Accès caméra refusé. Utilisez le lecteur 2D.', true);
        } else if (error.name === 'NotFoundError') {
            showToast('⚠️ Aucune caméra trouvée', true);
        } else {
            showToast('⚠️ Erreur caméra. Mode lecteur 2D activé.', true);
        }

        cameraScanActive = false;
    }
}

function scanQRFromCamera() {
    if (!cameraScanActive) return;

    const video = document.getElementById('cameraScanVideo');
    const canvas = document.getElementById('cameraScanCanvas');
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
        });

        if (code) {
            // QR code détecté !
            vibrate([50, 100, 50]); // Pattern vibration

            // Jouer un son (optionnel)
            playBeep();

            // Traiter le scan
            const value = code.data.trim().toUpperCase();
            handleScanInput({ key: 'Enter', target: { value } });

            cameraScansCount++;
            document.getElementById('cameraCounterValue').textContent = cameraScansCount;

            // Ajouter aux scans récents
            addToRecentScans(value);

            if (!continuousScanMode) {
                // Arrêter après un scan si mode normal
                stopCameraScanning();
                return;
            } else {
                // Petite pause pour éviter le double scan
                setTimeout(() => {
                    cameraAnimationFrame = requestAnimationFrame(scanQRFromCamera);
                }, 500);
                return;
            }
        }
    }

    cameraAnimationFrame = requestAnimationFrame(scanQRFromCamera);
}

function stopCameraScanning() {
    cameraScanActive = false;

    if (cameraAnimationFrame) {
        cancelAnimationFrame(cameraAnimationFrame);
        cameraAnimationFrame = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    document.getElementById('cameraScanner').style.display = 'none';
    flashEnabled = false;

    // Réinitialiser scans récents
    recentScans = [];
    updateRecentScansDisplay();

    // Réinitialiser mode rafale
    if (continuousScanMode) {
        continuousScanMode = false;
        document.getElementById('continuousBtnText').textContent = '🔁 Rafale OFF';
        document.getElementById('cameraBadgeContinuous').style.display = 'none';
    }

    showToast('📸 Scan caméra arrêté');
}

async function toggleFlash() {
    if (!cameraStream) return;

    try {
        const track = cameraStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        if (capabilities.torch) {
            flashEnabled = !flashEnabled;
            await track.applyConstraints({
                advanced: [{ torch: flashEnabled }]
            });

            const btn = document.getElementById('toggleFlash');
            btn.textContent = flashEnabled ? '🔦 Flash ON' : '💡 Flash';
            vibrate(30);
        }
    } catch (error) {
        console.error('Erreur flash:', error);
        showToast('⚠️ Flash non disponible', true);
    }
}

function playBeep() {
    // Son de confirmation (optionnel, utilise Web Audio API)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        // Silencieux si erreur
    }
}

function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

function toggleContinuousMode() {
    continuousScanMode = !continuousScanMode;

    const btn = document.getElementById('continuousBtnText');
    const badge = document.getElementById('cameraBadgeContinuous');

    if (continuousScanMode) {
        btn.textContent = '🔁 Rafale ON';
        badge.style.display = 'block';
        showToast('🔁 Mode rafale activé');
    } else {
        btn.textContent = '🔁 Rafale OFF';
        badge.style.display = 'none';
        showToast('Mode normal activé');
    }

    vibrate(30);
}

function addToRecentScans(value) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Ajouter au début du tableau
    recentScans.unshift({
        value: value,
        time: timeStr,
        timestamp: now.getTime()
    });

    // Garder seulement les 3 derniers
    recentScans = recentScans.slice(0, 3);

    // Mettre à jour l'affichage
    updateRecentScansDisplay();
}

function updateRecentScansDisplay() {
    const listEl = document.getElementById('cameraRecentList');

    if (recentScans.length === 0) {
        listEl.textContent = 'Aucun scan';
        return;
    }

    listEl.innerHTML = recentScans.map(scan => `
        <div class="camera-recent-item">
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${scan.value}</span>
            <span class="camera-recent-time">${scan.time}</span>
        </div>
    `).join('');
}

// ========== PANNEAU EXPORT LATÉRAL ==========
function openExportPanel() {
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

    // Générer les données
    currentExportData = generateExportData(fromDate, toDate);
    const stats = calculateExportStats(currentExportData);
    const duplicates = detectExportDuplicates(currentExportData);

    // Construire le contenu du panneau
    let html = `
        <!-- Stats rapides -->
        <div class="export-stats" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">
            <div class="export-stat-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">TOTAL</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${stats.total}</div>
            </div>
            <div class="export-stat-item" style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">UNIQUES</div>
                <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${stats.unique}</div>
            </div>
        </div>

        <!-- Période -->
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px;">PÉRIODE</div>
            <div style="font-weight: 600;">${fromDate} → ${toDate}</div>
        </div>

        <!-- Breakdown -->
        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">PAR CATÉGORIE</div>
            ${Object.entries(stats.byCategory).map(([cat, count]) => `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px;">
                    <span>${cat}</span>
                    <span style="color: var(--accent); font-weight: 700;">${count}</span>
                </div>
            `).join('')}
        </div>

        ${duplicates.length > 0 ? `
            <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <div style="font-weight: 700; color: #ff9800; margin-bottom: 8px;">⚠️ ${duplicates.length} Doublons détectés</div>
                <div style="font-size: 13px; max-height: 120px; overflow-y: auto;">
                    ${duplicates.slice(0, 10).map(d => `
                        <div style="padding: 4px 0; border-bottom: 1px solid rgba(255, 193, 7, 0.2);">
                            ${d.nom} ${d.prenom} (${d.categorie})<br>
                            <span style="font-size: 11px; color: var(--text-secondary);">${d.dates.join(', ')}</span>
                        </div>
                    `).join('')}
                    ${duplicates.length > 10 ? `<div style="padding: 8px 0; font-size: 12px; color: var(--text-secondary);">... et ${duplicates.length - 10} autres</div>` : ''}
                </div>
            </div>
        ` : ''}

        <!-- Aperçu tableau (10 lignes) -->
        <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: var(--text-secondary);">APERÇU (10 lignes)</div>
            <div style="background: var(--bg-secondary); border-radius: 8px; overflow: hidden; font-size: 12px;">
                ${currentExportData.slice(0, 10).map((row, i) => `
                    <div style="padding: 8px; ${i % 2 === 0 ? 'background: rgba(0, 136, 255, 0.05);' : ''}">
                        <div style="font-weight: 600;">${row.nom} ${row.prenom}</div>
                        <div style="font-size: 11px; color: var(--text-secondary);">${row.date} · ${row.categorie} ${row.departement ? '· ' + row.departement : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Format export -->
        <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">FORMAT</label>
            <select id="exportFormat" class="form-input" style="width: 100%;">
                <option value="csv">CSV (Excel)</option>
                <option value="json">JSON</option>
            </select>
        </div>

        <!-- Encodage (seulement pour CSV) -->
        <div id="encodingSection" style="margin-bottom: 16px;">
            <label style="font-size: 12px; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 8px;">ENCODAGE</label>
            <select id="exportEncodingPanel" class="form-input" style="width: 100%;">
                <option value="utf-8">UTF-8</option>
                <option value="windows-1252">Windows-1252</option>
            </select>
        </div>

        <!-- Boutons -->
        <div style="display: grid; gap: 12px;">
            <button class="btn btn-primary" onclick="confirmExportFromPanel()" style="width: 100%;">
                📥 Télécharger
            </button>
            <button class="btn btn-cancel" onclick="closeExportPanel()" style="width: 100%;">
                Annuler
            </button>
        </div>
    `;

    document.getElementById('exportPanelContent').innerHTML = html;
    document.getElementById('exportPanel').classList.add('active');
    document.getElementById('exportPanelOverlay').classList.add('active');

    // Listener pour cacher section encodage si JSON
    setTimeout(() => {
        const formatSelect = document.getElementById('exportFormat');
        formatSelect.addEventListener('change', () => {
            const encodingSection = document.getElementById('encodingSection');
            encodingSection.style.display = formatSelect.value === 'csv' ? 'block' : 'none';
        });
    }, 100);

    vibrate(30);
}

function closeExportPanel() {
    document.getElementById('exportPanel').classList.remove('active');
    document.getElementById('exportPanelOverlay').classList.remove('active');
    currentExportData = null;
}

function confirmExportFromPanel() {
    if (!currentExportData || currentExportData.length === 0) {
        showToast('⚠️ Aucune donnée à exporter', true);
        return;
    }

    const format = document.getElementById('exportFormat').value;
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;

    if (format === 'json') {
        // Export JSON
        const jsonData = {
            meta: {
                export_date: new Date().toISOString(),
                period_start: fromDate,
                period_end: toDate,
                total_entries: currentExportData.length
            },
            data: currentExportData
        };

        const jsonString = JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `KRAKEN_Pointage_${fromDate}_${toDate}.json`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('✅ JSON téléchargé');
    } else {
        // Export CSV
        const encoding = document.getElementById('exportEncodingPanel').value;

        let csv = 'date;categorie;nom;prenom;departement;poste;societe;invite_de;origine;horodatage;quantite\n';
        currentExportData.forEach(row => {
            const timestamp = row.timestamp || '';
            csv += `${row.date};${row.categorie};${row.nom};${row.prenom};${row.departement};${row.poste};${row.societe};${row.inviteDe};${row.origine};${timestamp};${row.quantite}\n`;
        });

        downloadCSVWithEncoding(csv, `KRAKEN_Pointage_${fromDate}_${toDate}.csv`, encoding);
    }

    closeExportPanel();
    vibrate(50);
}

// ========== BADGE STATUT CONNEXION ==========
function initConnectionMonitor() {
    updateConnectionBadge();

    // Vérifier toutes les 5 secondes
    connectionCheckInterval = setInterval(() => {
        updateConnectionBadge();
    }, 5000);

    // Écouter les événements online/offline
    window.addEventListener('online', updateConnectionBadge);
    window.addEventListener('offline', updateConnectionBadge);
}

function updateConnectionBadge() {
    const badge = document.getElementById('connectionBadge');
    const text = badge.querySelector('.connection-text');
    const now = Date.now();

    if (navigator.onLine) {
        // En ligne, mais vérifier si connexion stable
        const timeSinceLastCheck = now - lastConnectionCheck;

        if (timeSinceLastCheck > 10000) {
            badge.classList.remove('disconnected');
            badge.classList.add('offline');
            text.textContent = 'Instable';
        } else {
            badge.classList.remove('offline', 'disconnected');
            text.textContent = 'Connecté';
            lastConnectionSuccess = now;
        }

        lastConnectionCheck = now;
    } else {
        badge.classList.remove('offline');
        badge.classList.add('disconnected');
        text.textContent = 'Hors ligne';
    }

    // Mettre à jour tooltip avec timestamp
    const timeSinceSuccess = Math.floor((now - lastConnectionSuccess) / 1000);
    let tooltipText = '';

    if (timeSinceSuccess < 60) {
        tooltipText = `Dernier succès : il y a ${timeSinceSuccess}s`;
    } else if (timeSinceSuccess < 3600) {
        tooltipText = `Dernier succès : il y a ${Math.floor(timeSinceSuccess / 60)}min`;
    } else {
        tooltipText = `Dernier succès : il y a ${Math.floor(timeSinceSuccess / 3600)}h`;
    }

    badge.setAttribute('title', tooltipText);
}

// ========== BOUTONS TACTILES MOBILES ==========
function cycleTabs() {
    const tabs = ['equipe', 'renforts', 'invites', 'securite', 'cantine', 'figurants'];
    const currentIndex = tabs.indexOf(currentCategory);
    const nextIndex = (currentIndex + 1) % tabs.length;
    const nextTab = tabs[nextIndex];

    switchTab(nextTab);

    // Mettre à jour le label
    const label = document.getElementById('currentTabLabel');
    const tabNames = {
        'equipe': 'Équipe',
        'renforts': 'Renforts',
        'invites': 'Invités',
        'securite': 'Sécurité',
        'cantine': 'Cantine',
        'figurants': 'Figurants'
    };
    label.textContent = tabNames[nextTab];

    vibrate(30);
}

function toggleFullscreenMode() {
    fullscreenMode = !fullscreenMode;

    if (fullscreenMode) {
        document.body.classList.add('fullscreen-mode');
        showToast('⛶ Mode plein écran activé');
    } else {
        document.body.classList.remove('fullscreen-mode');
        showToast('⛶ Mode normal');
    }

    vibrate(50);
}

function toggleCompactMode() {
    mobileBarCompact = !mobileBarCompact;

    const bar = document.getElementById('mobileActions');

    if (mobileBarCompact) {
        bar.classList.add('compact');
        showToast('📏 Mode compact activé');
    } else {
        bar.classList.remove('compact');
        showToast('📏 Mode normal');
    }

    vibrate(30);
}

function toggleMobileAdvanced() {
    const advanced = document.getElementById('mobileActionsAdvanced');
    const isVisible = advanced.style.display !== 'none';

    if (isVisible) {
        advanced.style.display = 'none';
    } else {
        advanced.style.display = 'grid';
    }

    vibrate(20);
}

function updatePreferencesReminder() {
    const reminder = document.getElementById('preferencesReminder');
    if (!reminder) return;

    const prefs = loadPreferencesFromStorage();
    let parts = [];

    // Mode scan
    if (cameraScanActive) {
        parts.push('📸 Scan Caméra');
    } else {
        parts.push('📷 Scan 2D');
    }

    // Format export par défaut
    parts.push('📊 Export CSV');

    // Dernier backup
    if (prefs.lastBackup) {
        const backupDate = new Date(prefs.lastBackup);
        const now = new Date();
        const diffHours = Math.floor((now - backupDate) / (1000 * 60 * 60));

        if (diffHours < 24) {
            parts.push(`💾 Backup: il y a ${diffHours}h`);
        } else {
            const diffDays = Math.floor(diffHours / 24);
            parts.push(`💾 Backup: il y a ${diffDays}j`);
        }
    } else {
        parts.push('💾 Aucun backup');
    }

    reminder.textContent = parts.join(' · ');
}

function initMobileBarAutoHide() {
    window.addEventListener('scroll', () => {
        if (!mobileBarAutoHide) return;

        const currentScrollY = window.scrollY;
        const bar = document.getElementById('mobileActions');

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scroll vers le bas : cacher
            bar.classList.add('hidden');
            mobileBarHidden = true;
        } else {
            // Scroll vers le haut : afficher
            bar.classList.remove('hidden');
            mobileBarHidden = false;
        }

        lastScrollY = currentScrollY;
    });

    // Afficher au focus d'un input
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const bar = document.getElementById('mobileActions');
            bar.classList.add('hidden');
            mobileBarHidden = true;
        }
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const bar = document.getElementById('mobileActions');
            bar.classList.remove('hidden');
            mobileBarHidden = false;
        }
    });
}

// ========== SAUVEGARDE & RESTAURATION ==========
let pendingRestoreData = null;
let lastExportedFile = null;

function saveFullBackup() {
    const backup = {
        version: '1.0',
        export_date: new Date().toISOString(),
        data: {
            pointages: loadPointagesFromStorage(),
            figurants: loadFigurantsFromStorage(),
            listeTechnique: loadListeTechniqueFromStorage(),
            preferences: loadPreferencesFromStorage()
        }
    };

    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `KRAKEN_Backup_${formatDate(new Date())}_${Date.now()}.json`;

    // Sauvegarder référence pour partage
    lastExportedFile = { blob, filename };

    // Télécharger
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Mettre à jour l'info
    updateLastBackupInfo();

    // Afficher bouton partager
    document.getElementById('shareBtn').style.display = 'block';

    showToast('✅ Sauvegarde créée');
    vibrate(50);
}

function restoreFromBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);

            // Validation basique
            if (!backup.data || !backup.data.pointages) {
                throw new Error('Format de sauvegarde invalide');
            }

            // Stocker temporairement
            pendingRestoreData = backup;

            // Afficher preview
            showRestorePreview(backup);

        } catch (error) {
            console.error('Erreur lecture backup:', error);
            showToast('⚠️ Fichier de sauvegarde invalide', true);
        }
    };

    reader.readAsText(file);

    // Reset input
    event.target.value = '';
}

function showRestorePreview(backup) {
    const data = backup.data;

    // Compter éléments
    const pointagesCount = Object.keys(data.pointages || {}).reduce((sum, date) => {
        return sum + (data.pointages[date] || []).length;
    }, 0);

    const figurantsCount = Object.keys(data.figurants || {}).length;
    const listeTechniqueCount = (data.listeTechnique || []).length;

    // Dates de pointages
    const dates = Object.keys(data.pointages || {}).sort();
    const dateRange = dates.length > 0 ? `${dates[0]} → ${dates[dates.length - 1]}` : 'Aucune';

    const html = `
        <div style="padding: 16px;">
            <div style="background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <strong style="color: #ff9800;">⚠️ Attention</strong><br>
                <span style="font-size: 14px;">Cette opération écrasera toutes les données actuelles.</span>
            </div>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h4 style="margin-bottom: 12px;">Contenu de la sauvegarde :</h4>
                <div style="display: grid; gap: 8px; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>📅 Date sauvegarde :</span>
                        <strong>${new Date(backup.export_date).toLocaleString('fr-FR')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>📊 Pointages :</span>
                        <strong>${pointagesCount} entrées</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>📅 Période :</span>
                        <strong>${dateRange}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>🎭 Figurants :</span>
                        <strong>${figurantsCount} jours</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>👥 Liste technique :</span>
                        <strong>${listeTechniqueCount} personnes</strong>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
                <h4 style="margin-bottom: 12px;">Données actuelles :</h4>
                <div style="display: grid; gap: 8px; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>📊 Pointages :</span>
                        <strong>${Object.keys(loadPointagesFromStorage()).reduce((sum, date) => sum + loadPointagesFromStorage()[date].length, 0)} entrées</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>👥 Liste technique :</span>
                        <strong>${listeTechnique.length} personnes</strong>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('restorePreviewContent').innerHTML = html;
    document.getElementById('restorePreviewModal').classList.add('active');
}

function closeRestorePreview() {
    document.getElementById('restorePreviewModal').classList.remove('active');
    pendingRestoreData = null;
}

function confirmRestore() {
    if (!pendingRestoreData) {
        showToast('⚠️ Aucune donnée à restaurer', true);
        return;
    }

    const data = pendingRestoreData.data;

    // Restaurer chaque élément
    localStorage.setItem(CONFIG.STORAGE_KEYS.POINTAGES, JSON.stringify(data.pointages || {}));
    localStorage.setItem(CONFIG.STORAGE_KEYS.FIGURANTS, JSON.stringify(data.figurants || {}));
    localStorage.setItem(CONFIG.STORAGE_KEYS.LISTE_TECHNIQUE, JSON.stringify(data.listeTechnique || []));
    if (data.preferences) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.PREFERENCES, JSON.stringify(data.preferences));
    }

    closeRestorePreview();
    showToast('✅ Données restaurées. Rechargement...');
    vibrate(50);

    // Recharger la page après 1 seconde
    setTimeout(() => {
        location.reload();
    }, 1000);
}

function updateLastBackupInfo() {
    const info = document.getElementById('lastBackupInfo');
    const now = new Date().toLocaleString('fr-FR');
    info.textContent = `Dernière sauvegarde : ${now}`;

    // Sauvegarder dans préférences
    const prefs = loadPreferencesFromStorage();
    prefs.lastBackup = new Date().toISOString();
    savePreferencesToStorage(prefs);
}

// ========== WEB SHARE API ==========
async function shareLastExport() {
    if (!lastExportedFile) {
        showToast('⚠️ Aucun fichier à partager', true);
        return;
    }

    const { blob, filename } = lastExportedFile;

    // Vérifier support Web Share API Level 2 (fichiers)
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename)] })) {
        try {
            const file = new File([blob], filename, { type: 'application/json' });

            await navigator.share({
                title: 'KRAKEN - Sauvegarde',
                text: 'Sauvegarde complète des données KRAKEN',
                files: [file]
            });

            showToast('✅ Fichier partagé');
            vibrate(30);

        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Erreur partage:', error);
                showToast('⚠️ Erreur lors du partage', true);
            }
        }
    } else {
        // Fallback : télécharger à nouveau
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('📥 Téléchargement lancé (partage non supporté)');
    }
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

    // Initialiser le mode scan (message de statut)
    const scanStatus = document.getElementById('scanStatus');
    scanStatus.textContent = '✓ Mode scan activé';
    scanStatus.style.color = 'var(--accent)';

    // Initialiser le bouton undo (désactivé au départ)
    updateHistoryDisplay();

    // Initialiser le badge de connexion
    initConnectionMonitor();

    // Initialiser auto-hide barre mobile
    initMobileBarAutoHide();

    // Mettre à jour rappel préférences
    updatePreferencesReminder();

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
