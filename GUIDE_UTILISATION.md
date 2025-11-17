# 🎬 KRAKEN - Guide d'utilisation simplifié

**Pour Henri et l'équipe de production**

## 🚀 Démarrage rapide

### Premier lancement

1. Ouvrez l'application dans Safari sur votre iPhone
2. L'icône 🎬 KRAKEN s'affiche
3. Assurez-vous que le scanner Bluetooth est connecté

### Chaque jour de tournage

1. **Vérifiez la date** en haut de l'écran
2. **Scannez les badges** des personnes qui mangent
3. **Exportez** les données en fin de service

## 📱 Interface principale

```
┌─────────────────────────────┐
│  🎬 KRAKEN            🌙     │  ← Titre + bouton thème
│                              │
│  Date : [2025-11-20]    ▼   │  ← Sélecteur de date
│                              │
│  Équipe: 45  Figurants: 12  │  ← Compteurs en temps réel
│  Total: 57                   │
├─────────────────────────────┤
│  [Scannez un badge QR...]   │  ← Champ de scan (toujours actif)
│  ⚡ Prêt                     │
├─────────────────────────────┤
│ [Équipe][Renforts][Invités] │  ← Onglets
│ [Sécurité][Cantine][Figurants]
├─────────────────────────────┤
│                              │
│  Contenu de l'onglet actif  │
│                              │
└─────────────────────────────┘
```

## 🔄 Workflow quotidien

### ÉTAPE 1 : Préparation (une seule fois)

```
1. Importer la liste de l'équipe technique
   └─ Onglet "Équipe"
   └─ Cliquer "📋 Charger la liste technique"
   └─ Sélectionner le fichier CSV
   └─ Vérifier que tous les noms apparaissent
```

### ÉTAPE 2 : Service cantine

```
PENDANT LE SERVICE :

1. Positionnez le scanner près de la caisse
2. Demandez aux personnes de présenter leur badge
3. Scannez chaque badge :

   ✅ BADGE ÉQUIPE    → Bip + Nom affiché → Suivant
   ✅ BADGE RENFORT   → Fenêtre → Saisir NOM → Valider
   ✅ BADGE INVITÉ    → Fenêtre → Saisir NOM → Valider
   ✅ BADGE SÉCURITÉ  → Fenêtre → Saisir NOM + Société → Valider
   ✅ BADGE CANTINE   → Fenêtre → Saisir NOM → Valider
   ✅ BADGE FIGURANT  → Bip + Compteur +1 → Suivant

4. Surveillez les compteurs en haut :
   - Total en temps réel
   - Si doublon : message "⚠️ Déjà pointé"
```

### ÉTAPE 3 : Fin de service

```
1. Onglet "Figurants"
2. Section "📊 Export CSV"
3. Vérifier les dates (Du/Au)
4. Cliquer "Télécharger CSV"
5. Fichier téléchargé → Envoi compta
```

## 📋 Les 6 catégories

| Badge scanné | Ce qui se passe | Saisie requise |
|--------------|-----------------|----------------|
| **Prénom NOM DEPT** | ✅ Ajout immédiat équipe | - |
| **RENFORT** | Fenêtre s'ouvre | NOM + Département (opt) |
| **INVITE** | Fenêtre s'ouvre | NOM + Invité de (opt) |
| **SECURITE** | Fenêtre s'ouvre | NOM + Société (opt) |
| **CANTINE** | Fenêtre s'ouvre | NOM (opt) |
| **FIGURANT** | ✅ Compteur +1 | - |

## 🎯 Cas d'usage fréquents

### Scanner ne répond pas

```
1. Vérifier : champ bleu en haut actif ?
2. Cliquer n'importe où dans l'app
3. Re-scanner
```

### Personne scannée 2 fois par erreur

```
L'app refuse automatiquement :
"⚠️ Déjà pointé aujourd'hui"
→ Pas d'action nécessaire
```

### Corriger une erreur de saisie

```
1. Aller dans l'onglet concerné (Renforts, Invités...)
2. Trouver la personne
3. Cliquer sur ✏️ à droite
4. Corriger
5. Valider
```

### Retirer une personne

```
1. Aller dans l'onglet concerné
2. Trouver la personne
3. Cliquer sur 🗑️ à droite
4. Confirmer
```

### Ajouter sans scanner

```
1. Aller dans l'onglet voulu
2. Cliquer "+ Ajouter..."
3. Remplir le formulaire
4. Valider
```

### Gérer l'équipe technique rapidement

```
1. Onglet "Équipe"
2. Cliquer sur un nom pour cocher/décocher
3. ✓ = pointé
4. Vide = pas pointé
```

### Ajuster le compteur figurants

```
1. Onglet "Figurants"
2. Utiliser les boutons + et −
   OU
   Scanner des badges FIGURANT
```

## 📊 Export et comptabilité

### Exporter une journée

```
1. Onglet "Figurants"
2. "Du" : 2025-11-20
3. "Au" : 2025-11-20
4. Télécharger CSV
```

### Exporter une semaine

```
1. "Du" : 2025-11-18  (lundi)
2. "Au" : 2025-11-22  (vendredi)
3. Télécharger CSV
```

### Exporter tout le tournage

```
1. "Du" : 2025-11-01  (premier jour)
2. "Au" : 2025-12-15  (dernier jour)
3. Télécharger CSV
```

### Format du fichier

Le CSV contient 10 colonnes utilisables dans Excel/Numbers :

- **date** : Date du repas
- **categorie** : equipe, renforts, invites, securite, cantine, figurants
- **nom** : NOM en majuscules
- **prenom** : Prénom
- **departement** : Département (si applicable)
- **poste** : Poste (si équipe technique)
- **societe** : Société (si sécurité)
- **invite_de** : Invité de (si invité)
- **origine** : qr (scanné) ou manuel (saisi) ou compteur (figurants)
- **quantite** : Toujours 1 sauf figurants (total du jour)

## 🔧 Paramètres et actions

### Changer de thème

```
Bouton 🌙 / ☀️ en haut à droite

🌙 = Mode sombre (économie batterie)
☀️ = Mode clair (lisibilité jour)
```

### Réinitialiser un jour

```
⚠️ ATTENTION : Supprime tous les pointages du jour

1. Onglet "Figurants"
2. Section "⚙️ Actions"
3. "🔄 Réinitialiser ce jour"
4. Confirmer
```

### Réinitialiser tout

```
⚠️⚠️ DANGER : Supprime TOUTES les données

1. Onglet "Figurants"
2. "⚠️ Réinitialiser toutes les données"
3. Confirmer 2 fois
```

## 💡 Astuces professionnelles

### Optimiser la vitesse de scan

- Maintenez le scanner à 15-20cm du badge
- Scannez à un rythme régulier (1 badge/seconde max)
- Ne pas scanner trop vite (l'app a besoin de 500ms entre scans)

### Éviter les pertes de données

- ✅ Exportez le CSV chaque soir
- ✅ Gardez les exports CSV en backup
- ✅ Ne videz jamais le cache Safari
- ✅ Ne désinstallez pas l'app pendant le tournage

### Gérer les cas particuliers

**Invité d'un membre de l'équipe :**
```
Badge INVITE → NOM → Invité de : DUPONT
```

**Société de sécurité :**
```
Badge SECURITE → NOM → Société : SECURITAS
```

**Renfort d'un autre département :**
```
Badge RENFORT → NOM → Département : ÉLECTRICITÉ
```

**Personnel de la cantine :**
```
Badge CANTINE → NOM (ou laisser vide pour anonyme)
```

### Workflow 2 personnes

Si vous êtes deux à gérer la cantine :

```
PERSONNE 1 (Caisse)          PERSONNE 2 (Scan)
└─ Encaissement              └─ Scan des badges
                             └─ Gestion des fenêtres
                             └─ Vérification compteurs
```

## 📱 Installation sur iPhone (mémo)

```
1. Ouvrir l'app dans Safari
2. Bouton Partager (carré avec flèche ↑)
3. "Sur l'écran d'accueil"
4. Nommer "KRAKEN"
5. Ajouter
6. Icône 🎬 apparaît
```

## 🔍 Vérifications quotidiennes

### Avant le service

- [ ] Scanner Bluetooth connecté
- [ ] Date du jour sélectionnée
- [ ] Champ de scan actif (bleu)
- [ ] Liste technique chargée (si premier jour)

### Pendant le service

- [ ] Compteurs s'incrémentent
- [ ] Pas de messages d'erreur
- [ ] Scanner répond au scan

### Après le service

- [ ] Export CSV réussi
- [ ] Fichier téléchargé
- [ ] Envoi au service compta
- [ ] Backup du CSV

## ❓ Questions fréquentes

**Q : Combien de personnes puis-je pointer par jour ?**
R : Illimité. L'app peut gérer plusieurs centaines de pointages.

**Q : Puis-je pointer pour hier ou demain ?**
R : Oui. Utilisez le sélecteur de date en haut.

**Q : Les données sont-elles sauvegardées automatiquement ?**
R : Oui. Chaque scan/ajout est immédiatement sauvegardé.

**Q : Puis-je utiliser l'app sans réseau ?**
R : Oui. L'app fonctionne 100% hors ligne.

**Q : Que se passe-t-il si je ferme l'app ?**
R : Rien. Toutes les données sont conservées.

**Q : Puis-je modifier un pointage plusieurs jours après ?**
R : Oui. Sélectionnez la date, allez dans l'onglet, éditez.

**Q : Comment savoir si quelqu'un est déjà pointé ?**
R : Message "⚠️ Déjà pointé aujourd'hui" lors du scan.

**Q : Le CSV est compatible avec quoi ?**
R : Excel, Numbers, Google Sheets, LibreOffice, logiciels compta.

## 📞 En cas de problème

1. **Recharger la page** (Safari : swipe down)
2. **Vérifier le scanner** (connecté ? testé dans Notes ?)
3. **Exporter les données** (CSV backup)
4. **Redémarrer Safari**
5. **Redémarrer l'iPhone** (dernier recours)

---

**Bon tournage ! 🎬**

Application KRAKEN Pointage Cantine v1.0
