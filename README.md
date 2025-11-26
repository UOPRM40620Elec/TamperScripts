# 🐵 Comment installer et mettre à jour ce script avec Tampermonkey

Ce guide vous explique étape par étape comment ajouter ce script (`.js`) à votre navigateur via l'extension **Tampermonkey** et comment le maintenir à jour.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé l'extension **Tampermonkey** sur votre navigateur.

  * [Tampermonkey pour Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  * [Tampermonkey pour Firefox](https://addons.mozilla.org/fr/firefox/addon/tampermonkey/)
  * [Tampermonkey pour Edge](https://www.google.com/search?q=https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
  * [Tampermonkey pour Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089)

-----

## 🚀 Installation du script (Première fois)

Il existe deux méthodes pour installer le script. Choisissez celle qui vous convient le mieux.

### Méthode 1 : Installation automatique (Recommandé)

1.  Allez sur la page du fichier `.js` dans ce dépôt GitHub (par exemple `mon-script.js`).

2.  Cliquez sur le bouton **"Raw"** en haut à droite du cadre de code.

3.  Tampermonkey devrait détecter automatiquement le fichier et ouvrir un nouvel onglet.

4.  Cliquez sur le bouton **Installer** (ou "Install").

### Méthode 2 : Copier-Coller Manuel

Si l'installation automatique ne fonctionne pas :

1.  Ouvrez le fichier `.js` sur GitHub et copiez tout le code (Ctrl+A puis Ctrl+C).

2.  Cliquez sur l'icône de **Tampermonkey** dans votre navigateur.

3.  Sélectionnez **"Ajouter un nouveau script"** (Dashboard \> "+" tab).

4.  Effacez tout le code contenu dans l'éditeur.

5.  Collez le code que vous avez copié (Ctrl+V).

6.  Faites **Fichier \> Enregistrer** ou appuyez sur `Ctrl+S`.

-----

## 🔄 Comment mettre à jour le script

Si une nouvelle version du script est disponible sur ce GitHub, voici comment l'obtenir :

### Option A : Mise à jour automatique (Si configuré)

Par défaut, Tampermonkey vérifie les mises à jour périodiquement si le script contient une URL de mise à jour (`@updateURL`).

1.  Ouvrez le **Tableau de bord** de Tampermonkey.
2.  Cochez la case à côté du script.
3.  Cliquez sur **"Démarrer la vérification de mise à jour"** (souvent dans le menu déroulant "Actions").

### Option B : Forcer la mise à jour manuelle

C'est la méthode la plus sûre pour avoir la dernière version immédiatement :

1.  Retournez sur la page du fichier `.js` dans ce dépôt GitHub.

2.  Cliquez à nouveau sur le bouton **"Raw"**.

3.  Tampermonkey va s'ouvrir et vous montrera la différence entre votre version actuelle et la nouvelle.

4.  Cliquez sur le bouton **Mettre à jour** (ou "Update") qui remplace le bouton "Installer".

    > **Note :** Si le bouton indique "Réinstaller" (Reinstall), cela signifie que vous avez déjà la dernière version.

-----

## 🐞 Problèmes fréquents

  * **Le script ne s'active pas ?** Vérifiez que l'interrupteur "Activé" est bien au vert dans le menu Tampermonkey quand vous êtes sur le site concerné.
  * **Problème d'affichage ?** Essayez de rafraîchir la page (`F5`) ou de vider le cache de votre navigateur.

-----

### Souhaitez-vous que j'ajoute une section spécifique pour expliquer comment configurer les paramètres du script (variables en haut du fichier) si votre code en contient ?
