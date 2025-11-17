# 🏗️ Architecture technique - KRAKEN Pointage Cantine

Documentation détaillée de l'architecture de l'application.

## 📁 Structure des fichiers

```
QRCODECANTEEN/
├── index.html                  # Interface utilisateur complète + CSS inline
├── app.js                      # Logique métier JavaScript
├── manifest.json               # Configuration PWA
├── sw.js                       # Service Worker pour mode offline
├── README.md                   # Guide d'installation
├── GUIDE_UTILISATION.md        # Mode d'emploi utilisateur
├── ARCHITECTURE.md             # Ce fichier
├── CHANGELOG.md                # Historique des versions
├── .gitignore                  # Fichiers à ignorer
└── exemple_liste_technique.csv # Exemple de CSV
```

## 🎨 index.html

**Rôle** : Interface utilisateur complète

### Structure HTML

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    - Meta tags (viewport, PWA, theme)
    - Manifest link
    - <style> inline (tout le CSS)
  </head>
  <body>
    - Header (titre, date, stats)
    - Scanner input (champ toujours actif)
    - Tabs navigation (6 onglets)
    - Tab contents (6 panneaux)
    - Modal saisie (formulaire dynamique)
    - Toast notifications
    - <script src="app.js">
  </body>
</html>
```

### CSS Architecture

**Design System avec variables CSS** :

```css
:root {
  /* Colors */
  --accent: #0088ff;
  --bg-primary: #121212;
  --text-primary: #ffffff;
  /* ... */
}

body.light-theme {
  /* Override pour thème clair */
}
```

**Organisation** :

1. Reset & Base
2. Variables CSS
3. Global styles
4. Accessibility
5. Header
6. Scanner section
7. Tabs
8. Tab contents
9. Components (dept-group, extra-list, etc.)
10. Modals
11. Toast
12. Responsive (@media queries)

**Principes** :

- Mobile-first (base 320px)
- Touch-friendly (min 44x44px)
- Transitions fluides (0.2s)
- Accessibilité ARIA complète

## ⚙️ app.js

**Rôle** : Toute la logique métier

### Architecture modulaire

```javascript
// ========== CONFIGURATION ==========
const CONFIG = { ... }

// ========== ÉTAT GLOBAL ==========
let currentWorkingDate = null
let listeTechnique = []
// ...

// ========== UTILITAIRES ==========
function generateId() { ... }
function formatDate() { ... }

// ========== STOCKAGE ==========
function loadPointagesFromStorage() { ... }
function savePointagesForDate() { ... }

// ========== GESTION DATE ==========
function initWorkingDate() { ... }
function setWorkingDate() { ... }

// ========== ANTI-DOUBLONS ==========
function isDuplicate() { ... }

// ========== GESTION DU SCAN ==========
function handleScanInput() { ... }
function processScan() { ... }

// ========== MODALS ==========
function configureModalFields() { ... }
function openScanModal() { ... }

// ========== GESTION ÉQUIPE ==========
function toggleEquipeMember() { ... }

// ========== GESTION FIGURANTS ==========
function incrementFigurant() { ... }

// ========== RENDER ==========
function renderAll() { ... }
function renderEquipeList() { ... }

// ========== IMPORT/EXPORT CSV ==========
function parseCSVListeTechnique() { ... }
function exportCSVForRange() { ... }

// ========== ACTIONS ==========
function resetCurrentDay() { ... }

// ========== ONGLETS ==========
function switchTab() { ... }

// ========== THÈME ==========
function toggleTheme() { ... }

// ========== FOCUS MANAGEMENT ==========
function refocusScannerInput() { ... }

// ========== EVENT LISTENERS ==========
function setupEventListeners() { ... }

// ========== INITIALISATION ==========
function init() { ... }
```

### Flux de données

```
┌─────────────────────────────────────────────┐
│            USER INTERACTION                  │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────▼──────────┐
    │  EVENT LISTENER     │
    │  (keydown, click)   │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  BUSINESS LOGIC     │
    │  (add, edit, etc.)  │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  VALIDATION         │
    │  (anti-doublon)     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  UPDATE DATA        │
    │  (LocalStorage)     │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  RENDER ALL         │
    │  (update UI)        │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────┐
    │  USER FEEDBACK      │
    │  (toast, counters)  │
    └─────────────────────┘
```

## 💾 Stockage LocalStorage

### 4 clés distinctes

#### 1. kraken::cantine::pointages

```javascript
{
  "2025-11-20": [
    {
      id: "id-123456789-abc",
      date: "2025-11-20",
      categorie: "equipe",
      nom: "DUPONT",
      prenom: "Jean",
      departement: "PRODUCTION",
      poste: "Directeur",
      societe: "",
      inviteDe: "",
      origine: "qr" // ou "manuel"
    },
    // ... autres pointages du jour
  ],
  "2025-11-21": [ ... ]
}
```

#### 2. kraken::cantine::figurants

```javascript
{
  "2025-11-20": 35,
  "2025-11-21": 42
}
```

#### 3. kraken::cantine::listeTechnique

```javascript
[
  {
    nom: "DUPONT",
    prenom: "Jean",
    departement: "PRODUCTION",
    poste: "Directeur de Production",
    qrCode: "Jean DUPONT PRODUCTION",
    categorie: "equipe",
    societe: null
  },
  // ... tous les membres équipe
]
```

#### 4. kraken::cantine::preferences

```javascript
{
  lastWorkingDate: "2025-11-20",
  theme: "dark" // ou "light"
}
```

### API Storage

```javascript
// Wrapper avec try/catch
function loadPointagesFromStorage() {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error(error)
    return {}
  }
}

// Sauvegarde sécurisée
function savePointagesForDate(date, pointages) {
  try {
    const all = loadPointagesFromStorage()
    all[date] = pointages
    localStorage.setItem(key, JSON.stringify(all))
  } catch (error) {
    console.error(error)
    showToast('❌ Impossible de sauvegarder', true)
  }
}
```

## 🔄 Workflow de scan

### Flux détaillé

```
1. USER : Scanner envoie "Jean DUPONT PRODUCTION" + Enter
   │
   ▼
2. EVENT : keydown Enter détecté sur #qrInput
   │
   ▼
3. CHECK : Anti-doublon temporel (500ms depuis dernier scan)
   │
   ▼
4. FEEDBACK : Afficher "⚡ Scan en cours..."
   │
   ▼
5. DELAY : 300ms pour laisser feedback visuel
   │
   ▼
6. PROCESS : Analyser le texte scanné
   │
   ├─ "RENFORT" → openScanModal('renforts')
   ├─ "INVITE" → openScanModal('invites')
   ├─ "SECURITE" → openScanModal('securite')
   ├─ "CANTINE" → openScanModal('cantine')
   ├─ "FIGURANT" → incrementFigurant()
   └─ Autre → handleEquipeScan(value)
   │
   ▼
7. ADD/UPDATE : Ajout en base (LocalStorage)
   │
   ▼
8. RENDER : Mise à jour UI (renderAll)
   │
   ▼
9. CLEAR : input.value = ''
   │
   ▼
10. REFOCUS : document.getElementById('qrInput').focus()
```

### Focus management

**Problème** : Le scanner ne fonctionne que si le champ input a le focus.

**Solutions** :

1. Focus initial au chargement
2. Refocus après chaque action (clic, validation, etc.)
3. Refocus périodique toutes les 2 secondes (sécurité)
4. Refocus après fermeture modal
5. Refocus après changement onglet
6. Pas de refocus si modal active

```javascript
function refocusScannerInput() {
  const modal = document.getElementById('inputModal')
  if (!modal.classList.contains('active')) {
    setTimeout(() => {
      document.getElementById('qrInput').focus()
    }, 100)
  }
}

// Refocus périodique
setInterval(() => {
  refocusScannerInput()
}, 2000)
```

## 📋 Import CSV

### Parser intelligent

**Détection automatique** :

1. Séparateur (`;`, `,`, `\t`)
2. Format colonnes ("Nom_Prénom" ou "Nom" + "Prénom")
3. Ordre des colonnes (flexible)

**Algorithme** :

```javascript
function parseCSVListeTechnique(csvText) {
  // 1. Split lignes
  const lines = csvText.split(/\r?\n/)

  // 2. Détecter séparateur
  const header = lines[0]
  let separator = ';'
  if (header.includes('\t')) separator = '\t'
  else if (header.includes(',') && !header.includes(';')) separator = ','

  // 3. Parser en-tête
  const headers = header.split(separator).map(h => h.trim().toLowerCase())

  // 4. Trouver indices colonnes
  let nomPrenomIndex = headers.findIndex(h => h.includes('nom') && h.includes('prenom'))
  let nomIndex = headers.findIndex(h => h.match(/^nom$/i))
  let prenomIndex = headers.findIndex(h => h.match(/^prenom$/i))
  // ...

  // 5. Parser chaque ligne
  for (ligne of lines) {
    const columns = ligne.split(separator)

    // Extraire données selon format
    if (nomPrenomIndex >= 0) {
      const parts = columns[nomPrenomIndex].split(' ')
      prenom = parts[0]
      nom = parts.slice(1).join(' ')
    } else {
      nom = columns[nomIndex]
      prenom = columns[prenomIndex]
    }

    // Construire objet
    data.push({ nom, prenom, departement, poste, qrCode })
  }

  return data
}
```

**Formats supportés** :

```csv
# Format 1 : Nom_Prénom combiné
Nom_Prénom;Département;Poste
Jean DUPONT;PRODUCTION;Directeur

# Format 2 : Colonnes séparées
Nom;Prénom;Département;Poste
DUPONT;Jean;PRODUCTION;Directeur

# Format 3 : Ordre quelconque
Poste;Département;Prénom;Nom
Directeur;PRODUCTION;Jean;DUPONT
```

## 📊 Export CSV

### Format de sortie

**10 colonnes** :

1. `date` : YYYY-MM-DD
2. `categorie` : equipe, renforts, invites, securite, cantine, figurants
3. `nom` : NOM en majuscules
4. `prenom` : Prénom
5. `departement` : Département (si applicable)
6. `poste` : Poste (si équipe)
7. `societe` : Société (si sécurité)
8. `invite_de` : Invité de (si invité)
9. `origine` : qr, manuel, ou compteur
10. `quantite` : 1 pour personnes, N pour figurants

### Algorithme

```javascript
function exportCSVForRange(fromDate, toDate) {
  const exportData = []

  // 1. Itérer sur chaque date
  for (let d = new Date(fromDate); d <= new Date(toDate); d++) {
    const dateStr = formatDate(d)

    // 2. Récupérer pointages du jour
    const pointages = allPointages[dateStr] || []
    const figurantCount = allFigurants[dateStr] || 0

    // 3. Ajouter pointages normaux
    pointages.forEach(p => {
      exportData.push({
        date: dateStr,
        categorie: p.categorie,
        nom: p.nom,
        prenom: p.prenom,
        // ...
        quantite: 1
      })
    })

    // 4. Ajouter ligne figurants
    if (figurantCount > 0) {
      exportData.push({
        date: dateStr,
        categorie: 'figurants',
        quantite: figurantCount
      })
    }
  }

  // 5. Trier
  exportData.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    if (a.categorie !== b.categorie) return a.categorie.localeCompare(b.categorie)
    // ...
  })

  // 6. Générer CSV
  let csv = 'date;categorie;nom;prenom;...\n'
  exportData.forEach(row => {
    csv += `${row.date};${row.categorie};...\n`
  })

  // 7. Télécharger
  downloadCSV(csv, filename)
}
```

## 🎭 Modal dynamique

### Configuration des champs

```javascript
function configureModalFields(categorie) {
  // Masquer tous les champs
  allGroups.forEach(g => g.classList.add('hidden'))
  allLabels.forEach(l => l.classList.remove('required'))

  // Afficher selon catégorie
  switch (categorie) {
    case 'renforts':
      nomGroup.classList.remove('hidden')
      nomLabel.classList.add('required')
      deptGroup.classList.remove('hidden')
      break

    case 'invites':
      nomGroup.classList.remove('hidden')
      nomLabel.classList.add('required')
      inviteDeGroup.classList.remove('hidden')
      break

    case 'securite':
      nomGroup.classList.remove('hidden')
      nomLabel.classList.add('required')
      societeGroup.classList.remove('hidden')
      break

    case 'cantine':
      nomGroup.classList.remove('hidden')
      // Nom optionnel
      break

    case 'equipe':
      nomGroup.classList.remove('hidden')
      nomLabel.classList.add('required')
      prenomGroup.classList.remove('hidden')
      prenomLabel.classList.add('required')
      deptGroup.classList.remove('hidden')
      break
  }
}
```

## 🚀 PWA & Service Worker

### manifest.json

```json
{
  "name": "KRAKEN - Pointage Cantine",
  "short_name": "KRAKEN",
  "start_url": "./index.html",
  "display": "standalone",  // Plein écran sans barre navigateur
  "orientation": "portrait" // Force mode portrait
}
```

### Service Worker - Stratégie Cache-First

```javascript
// sw.js

// INSTALL : Mettre en cache les ressources
self.addEventListener('install', event => {
  caches.open(CACHE_NAME).then(cache => {
    cache.addAll(['./index.html', './app.js', './manifest.json'])
  })
})

// FETCH : Servir depuis cache d'abord
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request) // Chercher en cache
      .then(response => response || fetch(event.request)) // Sinon réseau
  )
})
```

**Avantages** :

- Fonctionne 100% offline après premier chargement
- Chargement instantané (depuis cache)
- Résilient aux problèmes réseau

## 🎨 Render pipeline

### Stratégie

**Single Render Function** :

```javascript
function renderAll() {
  renderEquipeList()
  renderRenfortsList()
  renderInvitesList()
  renderSecuriteList()
  renderCantineList()
  renderFigurantCount()
  updateTotalCounts()
}
```

**Optimisation** : Render batching avec requestAnimationFrame

```javascript
let renderScheduled = false

function renderAll() {
  if (renderScheduled) return
  renderScheduled = true

  requestAnimationFrame(() => {
    // Faire tous les renders
    renderScheduled = false
  })
}
```

### Pattern de render

```javascript
function renderEquipeList() {
  const container = document.getElementById('equipeList')

  // Générer HTML
  let html = ''
  listeTechnique.forEach(person => {
    html += `<li>${person.prenom} ${person.nom}</li>`
  })

  // Injecter une seule fois
  container.innerHTML = html
}
```

## 🔒 Sécurité

### Validation inputs

```javascript
// Toujours valider avant ajout
if (!nom) {
  showToast('⚠️ Le nom est obligatoire', true)
  return
}

// Normaliser données
nom = nom.trim().toUpperCase()
```

### Protection LocalStorage

```javascript
// Try/catch systématique
try {
  localStorage.setItem(key, value)
} catch (error) {
  // Quota exceeded ou autre
  console.error(error)
  showToast('❌ Impossible de sauvegarder', true)
}
```

### Échappement HTML

Les données utilisateur sont injectées via `innerHTML` mais :

1. Elles sont stockées en LocalStorage (pas d'XSS externe)
2. Elles viennent du scanner ou de l'utilisateur lui-même
3. Pas de risque réel car pas de serveur

Si nécessaire dans future version :

```javascript
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
```

## ⚡ Performance

### Optimisations

1. **CSS inline** : Pas de requête HTTP supplémentaire
2. **Pas de framework** : Pas de bundle lourd
3. **Event delegation** : Un listener pour toute la liste
4. **Debounce** : Éviter appels répétés
5. **RequestAnimationFrame** : Synchroniser renders avec navigateur
6. **LocalStorage** : Accès synchrone rapide

### Métriques cibles

- **First Paint** : < 500ms
- **Interactive** : < 1s
- **Render** : < 16ms (60 FPS)
- **Taille bundle** : ~68 KB

## 🧪 Tests manuels

### Checklist de validation

- [ ] Import CSV fonctionne (plusieurs formats)
- [ ] Scan QR fonctionne (équipe, extras, figurants)
- [ ] Anti-doublons fonctionnent
- [ ] Export CSV produit bon format
- [ ] Modals s'ouvrent/ferment correctement
- [ ] Focus scanner reste actif
- [ ] Compteurs se mettent à jour
- [ ] Thème clair/sombre fonctionne
- [ ] Changement de date fonctionne
- [ ] Édition/suppression fonctionnent
- [ ] Réinitialisation fonctionne
- [ ] PWA installable sur iOS
- [ ] Mode offline fonctionne
- [ ] Aucune erreur console

## 📱 Compatibilité iOS

### Spécificités iPhone

**Meta tags requis** :

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KRAKEN">
<link rel="apple-touch-icon" href="...">
```

**Limitations** :

- Service Worker nécessite HTTPS (sauf localhost)
- Pas de push notifications
- Pas de background sync

**Workarounds** :

- Utiliser LocalStorage pour tout
- Pas de dépendance réseau

## 🔮 Évolutions futures

### Phase 2 (potentielle)

1. **Sync cloud** : Firebase Realtime Database
2. **Multi-device** : Sync temps réel entre appareils
3. **Auth** : Login/password pour plusieurs utilisateurs
4. **Photos** : Capture photo badge
5. **Stats** : Graphiques avec Chart.js
6. **PDF** : Export PDF formaté
7. **Email** : Envoi auto des exports

### Phase 3 (potentielle)

1. **API REST** : Intégration logiciel compta
2. **Backend** : Node.js + PostgreSQL
3. **Admin panel** : Gestion des productions
4. **Multi-production** : Plusieurs tournages
5. **Analytics** : Dashboard statistiques

---

**Document version** : 1.0
**Dernière mise à jour** : 17 novembre 2025
