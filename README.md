# 🎬 KRAKEN - Application de Pointage Cantine

Application web progressive (PWA) pour le pointage des repas sur le tournage du film KRAKEN.

## 📋 Caractéristiques

- **100% Offline** - Fonctionne sans connexion Internet
- **Vanilla JavaScript** - Pas de dépendances, pas de framework
- **PWA Installable** - Ajout à l'écran d'accueil
- **Scanner Bluetooth** - Compatible scanner 2D en mode clavier
- **Export CSV** - Pour la comptabilité
- **Multi-catégories** - Équipe, renforts, invités, sécurité, cantine, figurants

## 🚀 Installation

### Option 1 : Utilisation locale (sans serveur)

1. Téléchargez tous les fichiers :
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `sw.js`

2. Ouvrez simplement `index.html` dans votre navigateur

**Note** : Le Service Worker ne fonctionnera pas en `file://`. Pour une expérience PWA complète, utilisez un serveur local ou l'option 2.

### Option 2 : Serveur local (recommandé)

Si Python est installé :

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Puis ouvrir : `http://localhost:8000`

### Option 3 : Déploiement en ligne

#### Netlify (Recommandé)

1. Créez un compte sur [Netlify](https://netlify.com)
2. Glissez-déposez le dossier contenant les fichiers
3. L'application sera accessible via une URL HTTPS

#### GitHub Pages

1. Créez un repository GitHub
2. Uploadez tous les fichiers
3. Activez GitHub Pages dans Settings → Pages
4. Accédez à `https://votre-username.github.io/nom-repo`

## 📱 Installation sur iPhone

### Méthode 1 : Via navigateur Safari

1. Ouvrez l'application dans Safari
2. Appuyez sur le bouton "Partager" (icône carré avec flèche)
3. Sélectionnez "Sur l'écran d'accueil"
4. Nommez l'application "KRAKEN"
5. Appuyez sur "Ajouter"

L'icône 🎬 apparaîtra sur votre écran d'accueil.

### Méthode 2 : Via AirDrop (usage local)

1. Envoyez les fichiers via AirDrop vers l'iPhone
2. Ouvrez `index.html` dans Safari
3. Suivez la méthode 1 ci-dessus

## 🔧 Configuration du scanner Bluetooth

### Appairage

1. Allumez le scanner 2D Bluetooth
2. Sur iPhone : Réglages → Bluetooth
3. Activez le Bluetooth
4. Sélectionnez le scanner dans la liste
5. Attendez le message "Connecté"

### Configuration du scanner

Le scanner doit être configuré en **mode clavier** :

- ✅ Envoie le texte scanné
- ✅ Ajoute automatiquement "Enter" après le scan
- ✅ Fonctionne comme un clavier externe

**Test** : Ouvrez un éditeur de texte, scannez un badge. Le texte doit apparaître suivi d'un retour à la ligne automatique.

## 📊 Workflow d'utilisation

### 1. Importer la liste technique

1. Préparez un fichier CSV avec l'équipe :
   ```csv
   Nom_Prénom;Département;Poste
   Romain LE GRAND;PRODUCTION;Producteur
   Jean DUPONT;MACHINERIE;Chef machiniste
   ```

2. Dans l'onglet "Équipe", cliquez sur "📋 Charger la liste technique"
3. Sélectionnez votre fichier CSV
4. Vérifiez que les noms apparaissent groupés par département

### 2. Pointer les repas

#### Méthode 1 : Scanner QR

1. Assurez-vous que le champ de scan est actif (bordure bleue)
2. Scannez un badge :
   - **Badge équipe** → Ajout immédiat
   - **Badge RENFORT** → Fenêtre pour saisir le nom
   - **Badge INVITÉ** → Fenêtre pour saisir le nom
   - **Badge SÉCURITÉ** → Fenêtre pour saisir nom + société
   - **Badge CANTINE** → Fenêtre pour saisir le nom
   - **Badge FIGURANT** → Compteur +1 automatique

#### Méthode 2 : Saisie manuelle

1. Allez dans l'onglet correspondant (Renforts, Invités, etc.)
2. Cliquez sur "+ Ajouter..."
3. Remplissez les informations
4. Cliquez sur "Valider"

#### Méthode 3 : Liste équipe (toggle)

1. Onglet "Équipe"
2. Cliquez sur un nom pour cocher/décocher
3. Gestion visuelle rapide de toute l'équipe

### 3. Exporter les données

1. Allez dans l'onglet "Figurants"
2. Section "📊 Export CSV"
3. Sélectionnez la plage de dates (du → au)
4. Cliquez sur "Télécharger CSV"
5. Le fichier `KRAKEN_Pointage_YYYY-MM-DD_YYYY-MM-DD.csv` est téléchargé

### 4. Gérer les données

#### Changer de jour

- Utilisez le sélecteur de date en haut de l'écran
- Les pointages sont sauvegardés par jour

#### Modifier/Supprimer un pointage

- Dans chaque onglet, utilisez les boutons ✏️ (éditer) et 🗑️ (supprimer)

#### Réinitialiser

- **Réinitialiser ce jour** : Supprime tous les pointages du jour actuel
- **Réinitialiser toutes les données** : ⚠️ Supprime TOUT (confirmation double)

## 📂 Format du fichier CSV d'export

Le CSV exporté contient 10 colonnes :

```csv
date;categorie;nom;prenom;departement;poste;societe;invite_de;origine;quantite
2025-11-20;equipe;DUPONT;Jean;PRODUCTION;Directeur;;;qr;1
2025-11-20;renforts;MARTIN;;MACHINERIE;;;;manuel;1
2025-11-20;invites;BERNARD;;;;Invité de DUPONT;;manuel;1
2025-11-20;securite;DURAND;;;Société XYZ;;;qr;1
2025-11-20;cantine;LOPEZ;;;;;;;manuel;1
2025-11-20;figurants;;;;;;;compteur;35
```

**Utilisation** : Ouvrir dans Excel, Numbers, Google Sheets, ou importer dans un logiciel de comptabilité.

## 🎨 Thèmes

L'application propose 2 thèmes :

- **Thème sombre** (par défaut) - Optimisé pour économiser batterie
- **Thème clair** - Meilleure lisibilité en plein jour

Changez de thème en cliquant sur l'icône 🌙/☀️ en haut à droite.

## 💾 Stockage des données

Les données sont stockées dans le **LocalStorage** du navigateur :

- ✅ Pas de serveur requis
- ✅ Données persistantes (même après fermeture)
- ✅ Accessible hors ligne
- ⚠️ Limité à ~5-10 MB par domaine
- ⚠️ Peut être effacé si l'utilisateur vide le cache

**Important** : Exportez régulièrement vos données en CSV pour backup !

## 🔒 Compatibilité

### Navigateurs

- ✅ Safari iOS 15+ (iPhone 7)
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+

### Appareils

- ✅ iPhone 7 et supérieurs
- ✅ iPad
- ✅ Tablettes Android
- ✅ Ordinateurs de bureau

## 🐛 Dépannage

### Le scanner ne fonctionne pas

1. Vérifiez que le scanner est bien connecté (Bluetooth)
2. Vérifiez que le champ de scan est actif (bordure bleue)
3. Testez le scanner dans un éditeur de texte
4. Assurez-vous que le scanner envoie "Enter" automatiquement

### Les scans sont manqués

1. Réduisez la vitesse de scan (max 1 scan/seconde)
2. Vérifiez que le focus ne se perd pas (le champ doit rester bleu)
3. Rechargez la page si le problème persiste

### Les données ont disparu

1. Vérifiez que vous êtes sur la bonne date
2. Vérifiez le stockage du navigateur (Paramètres → Stockage)
3. Si effacement accidentel : restaurez depuis CSV

### L'export CSV ne fonctionne pas

1. Vérifiez que les dates sont valides
2. Vérifiez que "Du" est avant "Au"
3. Essayez un autre navigateur
4. Vérifiez les autorisations de téléchargement

## 📞 Support

Pour toute question ou problème :

1. Consultez la section Dépannage ci-dessus
2. Vérifiez la console du navigateur (F12 → Console)
3. Exportez vos données avant toute manipulation

## 📄 Licence

© 2025 KRAKEN Production - Tous droits réservés

Application développée pour le tournage du film KRAKEN par Marvelous Productions.

---

**Version** : 1.0.0
**Dernière mise à jour** : Novembre 2025
**Développeur** : Claude (Anthropic)
