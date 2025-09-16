// ==UserScript==
// @name         Auto Retour LOG
// @namespace    https://github.com/UOPRM40620Elec/TamperScripts/tree/main
// @version      1.1
// @description  Script pour rebasculer les pièces du compartiment Retour LOG avec webhook
// @author       Teddy CORBILLON
// @match        https://planner.cloud.microsoft/webui/plan/MxiCj9OWB02LWJYhINLPe5YAEB8_/view/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      prod.cloud-collectorplus.mt.sncf.fr
// @connect      10b4c86e6b534f8298e70036f83a50.ff.environment.api.powerplatform.com
// @connect      *.ff.environment.api.powerplatform.com
// @connect      *.api.powerplatform.com
// @updateURL    https://raw.githubusercontent.com/UOPRM40620Elec/TamperScripts/refs/heads/main/RetourLog.user.js
// @downloadURL  https://raw.githubusercontent.com/UOPRM40620Elec/TamperScripts/refs/heads/main/RetourLog.user.js
// ==/UserScript==

(function () {
    'use strict';

    const processedSections = new WeakMap();
    const donneesTaches = []; // tableau global pour stocker les infos extraites
    let liensEnCours = 0;
    let postEnCours = 0;
    let liensTraites = []; // tableau pour stocker les liens des tâches traitées avec succès
    let refreshEnCours = 0; // variable globale pour tracker les rafraîchissements
    let totalRefreshAttendu = 0; // total des rafraîchissements attendus

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ajouterBoutonRetourLOG);
    } else {
        ajouterBoutonRetourLOG();
    }

    GM_addStyle(`
.autoelement {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    width: 100%;
    border-radius: 5px !important;
    border: 1px solid rgb(62, 68, 70) !important;
    background: rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(5px);
    padding: 5px;
}
.autoelement__img__container {
    display: block;
    position: relative;
    padding: 4px 4px 4px 4px;
    margin: 0;
    width: auto;
    height: auto;
    border-radius: 50px;
    overflow: hidden;
}
.autoelement__img__source {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 25px !important;
    height: 20px !important;
    overflow: hidden;
}
.autoelement__text {
    padding-right: 5px;
    color: rgb(204,204,204) !important;
    font-family: 'Montserrat', sans-serif;
    font-weight: 400;
    font-size: 0.8rem;
}

.http-co-error {
    animation: soundwave 2s ease infinite;
    border: 1px solid red !important;
}

.hidden {
    display: none;
}

.retourlog {
    position: absolute;
    bottom: 10px;
    left: 300px;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    flex-direction: column;
    row-gap: 10px;
}

.retourlog__button {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 25px;
    border: 2px solid rgb(26, 90, 250);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    padding: 5px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: grab;
}

.retourlog__button:hover {
    transform: scale(1.05);
}

.retourlog__button-icon {
    display: block;
    position: relative;
    padding: 0px 4px 0px 2px;
    margin: 0;
    width: 25px;
    height: 20px;
    border-radius: 0px;
    overflow: hidden;
}

.retourlog__button-text {
    padding-right: 5px;
    color: antiquewhite;
    font-family: 'Montserrat', sans-serif;
    font-weight: 400;
    font-size: 1rem;
}

.retourlog__progress {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 25px;
    border: 2px solid rgb(26, 90, 250);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    padding: 5px;
    color: antiquewhite;
    font-family: 'Montserrat', sans-serif;
    font-weight: 400;
    font-size: 0.8rem;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: not-allowed;
}

@keyframes soundwave {
    0% {
        box-shadow: 0 0 0 0px rgba(255, 0, 0, 0.75);
    }
    100% {
        box-shadow: 0 0 0 25px rgba(255, 255, 255, 0);
    }
}
    `);
    injecterPoliceMontserrat();

    function injecterPoliceMontserrat() {
        if (!document.getElementById('font-retourlog')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css?family=Montserrat:300,400,700,900&display=swap';
            link.id = 'font-retourlog';
            document.head.appendChild(link);
            console.log('🔤 Police Montserrat injectée pour Retour LOG.');
        }
    }

    function normaliserLabel(label) {
        return label?.trim().replace(/\s+/g, ' ').normalize('NFKC');
    }

    function updateProgressBarFromDonneesTaches() {
        const progressContainer = document.querySelector('.retourlog__progress');
        const progressText = progressContainer?.querySelector('.retourlog__progress-text');
        if (!progressContainer || !progressText) return;

        // Compter toutes les tâches NON terminées dans le compartiment Retour LOG
        const total = donneesTaches.filter(t => t.compartiment === 'RETOUR LOG' && !t.estTerminee);

        if (total.length === 0) {
            progressContainer.classList.add('hidden');
        } else {
            progressContainer.classList.remove('hidden');
        }

        progressText.textContent = `0/${total.length}`;
    }

    function ajouterBoutonRetourLOG() {
        const container = document.createElement('div');
        container.className = 'retourlog';

        container.innerHTML = `
        <div class="retourlog__progress hidden">
            <span class="retourlog__progress-text">0/0</span>
        </div>
        <div class="retourlog__button">
            <img src="https://prod.cloud-collectorplus.mt.sncf.fr/assets/images/sprite_src/pictos/Collector_accueil.png"
                 alt="Icon"
                 class="retourlog__button-icon">
            <span class="retourlog__button-text">Retour LOG Auto</span>
        </div>
    `;

        document.body.appendChild(container);

        // Clic sur le bouton : lancer le traitement automatique
        container.querySelector('.retourlog__button').addEventListener('click', () => {
            lancerModeRetourLOG();
        });
    }

    function lancerModeRetourLOG() {
        const progressContainer = document.querySelector('.retourlog__progress');
        const progressText = progressContainer.querySelector('.retourlog__progress-text');

        // Filtrer les tâches du compartiment Retour LOG qui ne sont PAS terminées
        const tachesAFaire = donneesTaches.filter(t =>
            t.compartiment === 'RETOUR LOG' && !t.estTerminee
        );

        if (tachesAFaire.length === 0) {
            alert('Aucune tâche non terminée trouvée dans le compartiment Retour LOG.');
            return;
        }

        progressContainer.classList.remove('hidden');
        let total = tachesAFaire.length;
        let done = 0;
        let erreurs = 0;
        let postRestants = total;

        // Réinitialiser la liste des liens traités au début de chaque traitement
        liensTraites = [];

        function updateProgress() {
            progressText.textContent = `${done}/${total}${erreurs > 0 ? ` (${erreurs} erreur${erreurs > 1 ? 's' : ''})` : ''}`;
        }

        updateProgress();
        postEnCours = total;
        updateRetourLOGButtonState();

        tachesAFaire.forEach(tache => {
            // Fonction pour effectuer la deuxième requête OngletChangerEtat
            function effectuerOngletChangerEtat() {
                const url2 = `https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/OngletChangerEtat?idUser=${tache.idUser}&current_repair_id=${tache.numeroReparation}`;
                console.log(`🔗 [DEBUG] 2ème requête URL POST pour ${tache.numeroReparation}: ${url2}`);

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url2,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: '',
                    onload: res2 => {
                        if (res2.status === 200) {
                            done++;
                            liensTraites.push(tache.lien);

                            // Stocker le statut précédent pour le webhook
                            tache.statutPrecedent = tache.label;
                            // Le nouveau statut sera récupéré après le rafraîchissement

                            console.log(`✅ Retour LOG complet réussi pour ${tache.numeroReparation}`);
                        } else {
                            erreurs++;
                            console.error(`❌ Erreur HTTP ${res2.status} sur OngletChangerEtat pour ${tache.numeroReparation}`);
                        }
                        postRestants--;
                        updateProgress();

                        if (postRestants === 0) {
                            console.log('🎯 Toutes les requêtes Retour LOG terminées. Rafraîchissement en cours...');
                            console.log('📋 Liste des liens traités avec succès:', liensTraites);

                            const tachesARefresh = tachesAFaire.filter(tache => liensTraites.includes(tache.lien));
                            refreshEnCours = tachesARefresh.length;
                            totalRefreshAttendu = tachesARefresh.length;

                            if (tachesARefresh.length === 0) {
                                console.log('🎯 Aucune tâche à rafraîchir.');

                                if (liensTraites.length > 0) {
                                    const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                    console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                    appelWebhookRetourLOG(tachesTraitees);
                                }

                                postEnCours = 0;
                                updateRetourLOGButtonState();
                                return;
                            }

                            setTimeout(() => {
                                tachesARefresh.forEach(tache => {
                                    const taskCard = document.querySelector(`#idreparation-status-${tache.numeroReparation}`)?.closest('.taskCard');
                                    if (taskCard) {
                                        const overlay = taskCard.querySelector(`#idreparation-status-${tache.numeroReparation}`);
                                        if (overlay) {
                                            overlay.querySelector('.text-collector').textContent = 'Rafraîchissement...';
                                        }
                                        testerLienHttp(tache.lien, taskCard, 1, true);
                                    }
                                });
                            }, 1000);
                        }
                        postEnCours--;
                        updateRetourLOGButtonState();
                    },
                    onerror: () => {
                        erreurs++;
                        postRestants--;
                        console.error(`❌ Erreur réseau sur OngletChangerEtat pour ${tache.numeroReparation}`);
                        updateProgress();

                        if (postRestants === 0) {
                            console.log('🎯 Toutes les requêtes Retour LOG terminées (avec erreurs). Rafraîchissement en cours...');
                            console.log('📋 Liste des liens traités avec succès:', liensTraites);

                            const tachesARefresh = tachesAFaire.filter(tache => liensTraites.includes(tache.lien));
                            refreshEnCours = tachesARefresh.length;
                            totalRefreshAttendu = tachesARefresh.length;

                            if (tachesARefresh.length === 0) {
                                console.log('🎯 Aucune tâche à rafraîchir (erreurs).');

                                if (liensTraites.length > 0) {
                                    const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                    console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                    appelWebhookRetourLOG(tachesTraitees);
                                }

                                postEnCours = 0;
                                updateRetourLOGButtonState();
                                return;
                            }

                            setTimeout(() => {
                                tachesARefresh.forEach(tache => {
                                    const taskCard = document.querySelector(`#idreparation-status-${tache.numeroReparation}`)?.closest('.taskCard');
                                    if (taskCard) {
                                        const overlay = taskCard.querySelector(`#idreparation-status-${tache.numeroReparation}`);
                                        if (overlay) {
                                            overlay.querySelector('.text-collector').textContent = 'Rafraîchissement...';
                                        }
                                        testerLienHttp(tache.lien, taskCard, 1, true);
                                    }
                                });
                            }, 1000);
                        }
                        postEnCours--;
                        updateRetourLOGButtonState();
                    }
                });
            }

            // Première requête previousStep
            const url1 = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/previousStep';
            const payload1 = new URLSearchParams({
                idReparation: tache.numeroReparation,
                idUser: tache.idUser,
                current_repair_id: tache.numeroReparation
            }).toString();

            console.log(`🔗 [DEBUG] 1ère requête URL POST pour ${tache.numeroReparation}: ${url1}`);
            console.log(`🔗 [DEBUG] Payload: ${payload1}`);

            GM_xmlhttpRequest({
                method: 'POST',
                url: url1,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: payload1,
                onload: res => {
                    if (res.status === 200) {
                        console.log(`✅ PreviousStep réussi pour ${tache.numeroReparation}, lancement OngletChangerEtat...`);
                        // Si la première requête réussit, lancer la deuxième
                        effectuerOngletChangerEtat();
                    } else {
                        erreurs++;
                        postRestants--;
                        console.error(`❌ Erreur HTTP ${res.status} sur previousStep pour ${tache.numeroReparation}`);
                        updateProgress();

                        if (postRestants === 0) {
                            console.log('🎯 Toutes les requêtes Retour LOG terminées (avec erreurs previousStep).');

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookRetourLOG(tachesTraitees);
                            }

                            postEnCours = 0;
                            updateRetourLOGButtonState();
                        } else {
                            postEnCours--;
                            updateRetourLOGButtonState();
                        }
                    }
                },
                onerror: () => {
                    erreurs++;
                    postRestants--;
                    console.error(`❌ Erreur réseau sur previousStep pour ${tache.numeroReparation}`);
                    updateProgress();

                    if (postRestants === 0) {
                        console.log('🎯 Toutes les requêtes Retour LOG terminées (avec erreurs réseau previousStep).');

                        if (liensTraites.length > 0) {
                            const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                            console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                            appelWebhookRetourLOG(tachesTraitees);
                        }

                        postEnCours = 0;
                        updateRetourLOGButtonState();
                    } else {
                        postEnCours--;
                        updateRetourLOGButtonState();
                    }
                }
            });
        });
    }

    function appelWebhookRetourLOG(tachesTraitees) {
        // Flag pour utiliser le nom complet au lieu de l'ID utilisateur
        const idName = true; // Passe à false pour utiliser idUser au lieu du nom complet

        // Préparer les données selon le schéma Power Automate avec informations de statut
        const uniqueUsers = [...new Set(tachesTraitees.map(t => idName ? t.userName : t.idUser))]
            .filter(user => user && user !== 'non trouvé' && user.trim() !== '')
            .map(user => user.trim());

        const uniqueOFs = [...new Set(tachesTraitees.map(t => t.numOF))]
            .filter(of => of && of !== 'non trouvé' && of.trim() !== '')
            .map(of => {
                const cleaned = of.trim();
                // S'assurer que l'OF commence par "OF"
                return cleaned.startsWith('OF') ? cleaned : `OF${cleaned}`;
            });

        // Créer la liste des pièces avec leurs informations de changement de statut
        const pieces = tachesTraitees.map(tache => ({
            numeroReparation: tache.numeroReparation,
            idSymbole: tache.idSymbole,
            statutPrecedent: tache.statutPrecedent || 'statut_precedent_inconnu',
            nouveauStatut: tache.label, // Le nouveau statut récupéré après rafraîchissement
            numOF: tache.numOF && tache.numOF !== 'non trouvé' ?
                   (tache.numOF.trim().startsWith('OF') ? tache.numOF.trim() : `OF${tache.numOF.trim()}`) :
                   'OF_inconnu'
        }));

        const payload = {
            user: uniqueUsers.length > 0 ? uniqueUsers.map(userId => ({ id: userId })) : [{ id: "utilisateur_inconnu" }],
            OF: uniqueOFs.length > 0 ? uniqueOFs.map(ofId => ({
                id: ofId
            })) : [{ id: "OF_inconnu" }],
            pieces: pieces,
            action: "retour_log",
            timestamp: new Date().toISOString()
        };

        console.log('📤 Envoi des données au webhook Retour LOG Power Automate:', payload);

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://10b4c86e6b534f8298e70036f83a50.ff.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/c344062e0c554569abd8986fef824e76/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=cuFJYf9coRJJjRfo-3F--fV2iOT3F8GIoGnY-FdqiKo',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    console.log('✅ Webhook Retour LOG Power Automate appelé avec succès:', response.status);
                    console.log('📋 Réponse:', response.responseText);
                } else {
                    console.error('❌ Erreur lors de l\'appel du webhook Retour LOG:', response.status, response.responseText);
                }
            },
            onerror: error => {
                console.error('❌ Erreur réseau lors de l\'appel du webhook Retour LOG:', error);
            }
        });
    }

    function updateRetourLOGButtonState() {
        const btn = document.querySelector('.retourlog__button');
        const label = btn?.querySelector('.retourlog__button-text');
        if (!btn || !label) return;

        if (postEnCours > 0) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            label.textContent = 'En cours...';
        } else if (liensEnCours > 0) {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            label.textContent = 'Analyse en cours...';
        } else {
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            label.textContent = 'Retour LOG Auto';
        }
    }

    function forcerChargementCompletDesTaches(section) {
        const scrollable = section.closest('.scrollable[data-can-drag-to-scroll="true"]');
        const listBox = section.querySelector('.listBoxGroup');
        const compteurElement = section.querySelector('.sectionItemCount');

        if (!scrollable || !listBox || !compteurElement) return;

        const totalAttendu = parseInt(compteurElement.textContent.trim(), 10) || 0;
        let previousCount = 0;
        let essais = 0;
        const maxEssais = 30;

        console.log(`🔽 Scroll auto lancé — Objectif : ${totalAttendu} tâches`);

        const interval = setInterval(() => {
            scrollable.scrollTop = scrollable.scrollHeight;

            const currentCount = listBox.querySelectorAll('.taskBoardCard').length;
            essais++;

            if (currentCount >= totalAttendu) {
                clearInterval(interval);
                console.log(`✅ Chargement complet : ${currentCount}/${totalAttendu} tâches visibles.`);
            } else if (currentCount === previousCount || essais >= maxEssais) {
                clearInterval(interval);
                console.warn(`⚠️ Arrêt forcé : ${currentCount}/${totalAttendu} tâches visibles après ${essais} essais.`);
            } else {
                previousCount = currentCount;
                console.log(`🔄 Scroll ${essais}... ${currentCount}/${totalAttendu} tâches visibles`);
            }
        }, 600);
    }

    function testerLienHttp(lien, taskCard, tentative = 1, modeRefresh = false) {
        liensEnCours++;
        updateRetourLOGButtonState();

        const maxTentatives = 5;
        const numeroReparation = lien.match(/\/(\d+)\.html$/)?.[1] || 'inconnu';

        GM_xmlhttpRequest({
            method: 'GET',
            url: lien,
            onload: function (response) {
                console.log(`🔍 Tentative ${tentative} pour [${lien}] → Status HTTP: ${response.status}`);

                const overlay = taskCard.querySelector(`#idreparation-status-${numeroReparation}`);

                if (response.status === 200) {
                    const html = response.responseText;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    const label = doc.querySelector('span.label-success');
                    const texteLabel = label?.textContent?.trim() || 'non trouvé';

                    // Récupération du numéro OF
                    const ofElements = doc.querySelectorAll('span.labelsPRM');
                    let numOF = 'non trouvé';

                    for (const element of ofElements) {
                        if (element.textContent.includes('N° OF :')) {
                            const parentDiv = element.closest('div');
                            const nextDiv = parentDiv?.nextElementSibling;
                            numOF = nextDiv?.textContent?.trim() || 'non trouvé';
                            break;
                        }
                    }

                    const input = doc.getElementById('idSymbole');
                    const symbole = input?.value?.trim() || 'non trouvé';

                    const inputUser = doc.getElementById('idUser');
                    const idUser = inputUser?.value?.trim() || 'non trouvé';

                    const userSpan = doc.querySelector('span.user.ellipsis');
                    const userName = userSpan?.getAttribute('title')?.replace(/&nbsp;/g, ' ')?.trim() || 'non trouvé';

                    // Déterminer le compartiment et si la tâche est terminée
                    const colonne = taskCard.closest('.columnContent');
                    const titreColonne = colonne?.querySelector('h3')?.textContent?.trim().toUpperCase() || '';
                    const estTerminee = taskCard.closest('.secondarySection')?.querySelector('h4.toggleText')?.textContent?.trim() === 'Tâches terminées';

                    const index = donneesTaches.findIndex(t => t.numeroReparation === numeroReparation);
                    const nouvelleTache = {
                        lien,
                        numeroReparation,
                        label: texteLabel,
                        idSymbole: symbole,
                        idUser: idUser,
                        userName: userName,
                        numOF: numOF,
                        compartiment: titreColonne,
                        estTerminee: estTerminee
                    };

                    if (index !== -1) {
                        // En mode rafraîchissement, conserver le statut précédent s'il existe
                        if (modeRefresh && donneesTaches[index].statutPrecedent) {
                            nouvelleTache.statutPrecedent = donneesTaches[index].statutPrecedent;
                        }
                        donneesTaches[index] = nouvelleTache;
                        console.log(`♻️ Tâche ${numeroReparation} mise à jour`);
                    } else {
                        donneesTaches.push(nouvelleTache);
                        console.log(`➕ Nouvelle tâche ${numeroReparation} ajoutée`);
                    }

                    updateProgressBarFromDonneesTaches();

                    console.log(`✅ Tâche analysée :`);
                    console.log(`   🔧 Réparation : ${numeroReparation}`);
                    console.log(`   🏷️ Label      : ${texteLabel}`);
                    console.log(`   📦 Compartiment: ${titreColonne}`);
                    console.log(`   ✅ Terminée   : ${estTerminee}`);
                    console.log(`   🔗 Lien       : ${lien}`);

                    if (overlay) {
                        overlay.querySelector('.text-collector').textContent = texteLabel;
                        overlay.querySelector('.text-numeroreparation').textContent = numeroReparation;
                        overlay.classList.remove('http-error');
                    }

                    liensEnCours = Math.max(0, liensEnCours - 1);

                    if (modeRefresh) {
                        refreshEnCours--;
                        console.log(`🔄 Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} terminé`);

                        if (refreshEnCours === 0) {
                            console.log('🎯 Tous les rafraîchissements terminés !');
                            console.log('📋 Liens traités avec succès:', liensTraites);

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookRetourLOG(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }
                        }
                    }

                    updateRetourLOGButtonState();

                } else {
                    if (overlay) {
                        if (tentative >= maxTentatives) {
                            overlay.querySelector('.text-collector').textContent = `Erreur ${response.status}`;
                            overlay.classList.add('http-co-error');
                        } else {
                            overlay.querySelector('.text-collector').textContent = `Erreur ${response.status} (tentative ${tentative})`;
                        }
                    }

                    if (tentative < maxTentatives) {
                        setTimeout(() => {
                            testerLienHttp(lien, taskCard, tentative + 1, modeRefresh);
                        }, 2000);
                    } else {
                        console.warn(`❌ Échec après ${maxTentatives} tentatives pour ${lien}`);
                        liensEnCours = Math.max(0, liensEnCours - 1);

                        if (modeRefresh) {
                            refreshEnCours--;
                            console.log(`❌ Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} échoué`);
                            if (refreshEnCours === 0) {
                                console.log('🎯 Tous les rafraîchissements terminés (avec erreurs) !');

                                if (liensTraites.length > 0) {
                                    const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                    console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                    appelWebhookRetourLOG(tachesTraitees);
                                } else {
                                    console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                                }
                            }
                        }

                        updateRetourLOGButtonState();
                    }
                }
            },
            onerror: function (error) {
                const overlay = taskCard.querySelector(`#idreparation-status-${numeroReparation}`);

                if (overlay) {
                    if (tentative >= maxTentatives) {
                        overlay.querySelector('.text-collector').textContent = `Erreur réseau`;
                        overlay.classList.add('http-error');
                    } else {
                        overlay.querySelector('.text-collector').textContent = `Erreur réseau (tentative ${tentative})`;
                    }
                }

                if (tentative < maxTentatives) {
                    setTimeout(() => {
                        testerLienHttp(lien, taskCard, tentative + 1, modeRefresh);
                    }, 2000);
                } else {
                    console.error(`❌ Échec réseau après ${maxTentatives} tentatives :`, error);
                    liensEnCours = Math.max(0, liensEnCours - 1);

                    if (modeRefresh) {
                        refreshEnCours--;
                        console.log(`❌ Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} échoué (réseau)`);
                        if (refreshEnCours === 0) {
                            console.log('🎯 Tous les rafraîchissements terminés (avec erreurs réseau) !');

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookRetourLOG(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }
                        }
                    }

                    updateRetourLOGButtonState();
                }
            }
        });
    }

    function extraireTachesDepuisCompartiment(section) {
        // Vérifier si on est dans le compartiment "Retour LOG"
        const colonne = section.closest('.columnContent');
        const titreColonne = colonne?.querySelector('h3')?.textContent?.trim().toUpperCase();

        if (titreColonne !== 'RETOUR LOG') return;

        // Pour ce script, on s'intéresse à TOUTES les sections du compartiment Retour LOG
        // pas seulement "Tâches terminées"

        if (!processedSections.get(section)) {
            console.log('✅ Section dans compartiment Retour LOG détectée → Analyse...');
            processedSections.set(section, true);
            forcerChargementCompletDesTaches(section);
            observerAjoutTachesDansSection(section);

            setTimeout(() => {
                const taches = section.querySelectorAll('div.taskBoardCard');

                if (!taches.length) {
                    console.warn('⚠️ Aucune tâche trouvée dans cette section.');
                    return;
                }

                taches.forEach(tache => {
                    const taskCard = tache.querySelector('div.taskCard');
                    if (!taskCard) return;

                    const lienElement = taskCard.querySelector('a.referencePreviewDescription');
                    let lien = lienElement?.getAttribute('title')?.trim();
                    if (lien && !lien.endsWith('.html')) {
                        lien += '.html';
                    }

                    if (lien) {
                        console.log('📝 Tâche détectée dans Retour LOG avec lien :', lien);
                        const numeroReparation = lien.match(/\/(\d+)(?:\.html)?$/)?.[1] || 'inconnu';
                        ajouterOverlayTaskCard(taskCard, numeroReparation, 'Chargement...');
                        testerLienHttp(lien, taskCard);
                    }
                });
            }, 500);
        }
    }

    function ajouterOverlayTaskCard(taskCard, numeroReparation, texteLabel = 'Chargement...') {
        const thumbnail = taskCard.querySelector('.thumbnail.placeholder');
        if (!thumbnail) return;

        const existing = thumbnail.querySelector('.autoelement');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = 'autoelement';
        container.id = `idreparation-status-${numeroReparation}`;
        container.style.position = 'absolute';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '10';
        container.style.background = 'rgba(255,255,255,0.95)';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '6px';
        container.style.padding = '5px 10px';
        container.style.fontSize = '12px';
        container.style.maxWidth = '160px';

        container.innerHTML = `
        <div class="autoelement__img__container" style="text-align:center;">
            <img src="https://prod.cloud-collectorplus.mt.sncf.fr/assets/images/sprite_src/pictos/Collector_accueil.png"
                 alt="Icon"
                 class="autoelement__img__source"
                 style="width: 24px; height: 24px;">
        </div>
        <span class="autoelement__text text-numeroreparation" style="display:block; font-weight:bold; margin-top:4px;">
            ${numeroReparation}
        </span>
        <span class="autoelement__text text-collector" style="display:block; color: #333;">
            ${texteLabel}
        </span>
    `;

        thumbnail.style.position = 'relative';
        thumbnail.appendChild(container);
    }

    function observerAjoutTachesDansSection(section) {
        const container = section.querySelector('.listWrapper');
        if (!container) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('.taskBoardCard')) {
                        const taskCard = node.querySelector('div.taskCard');
                        if (!taskCard) return;

                        const lienElement = taskCard.querySelector('a.referencePreviewDescription');
                        let lien = lienElement?.getAttribute('title')?.trim();
                        if (lien && !lien.endsWith('.html')) {
                            lien += '.html';
                        }
                        const numeroReparation = lien?.match(/\/(\d+)\.html$/)?.[1];

                        if (lien && numeroReparation) {
                            console.log('🆕 Nouvelle tâche ajoutée dynamiquement dans Retour LOG :', lien);
                            ajouterOverlayTaskCard(taskCard, numeroReparation, 'Chargement...');
                            testerLienHttp(lien, taskCard);
                        }
                    }
                });

                mutation.removedNodes.forEach(node => {
                    if (node.nodeType === 1 && node.matches('.taskBoardCard')) {
                        const taskCard = node.querySelector('div.taskCard');
                        if (!taskCard) return;

                        const lienElement = taskCard.querySelector('a.referencePreviewDescription');
                        let lien = lienElement?.getAttribute('title')?.trim();
                        if (lien && !lien.endsWith('.html')) {
                            lien += '.html';
                        }
                        const numeroReparation = lien?.match(/\/(\d+)\.html$/)?.[1];

                        if (numeroReparation) {
                            const index = donneesTaches.findIndex(t => t.numeroReparation === numeroReparation);
                            if (index !== -1) {
                                donneesTaches.splice(index, 1);
                                console.log(`🗑️ Tâche retirée : ${numeroReparation} supprimée de donneesTaches`);
                            }
                        }
                    }
                });
            });
        });

        observer.observe(container, {
            childList: true,
            subtree: true
        });

        console.log('👀 Observer actif sur ajouts/suppressions dynamiques dans cette section Retour LOG.');
    }

    function observerSections() {
        const cible = document.body;

        const observer = new MutationObserver(() => {
            // Observer toutes les sections dans le compartiment Retour LOG
            const sections = document.querySelectorAll('div.secondarySection, div.primarySection');

            sections.forEach(section => {
                extraireTachesDepuisCompartiment(section);
            });
        });

        observer.observe(cible, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-expanded'],
        });

        console.log('[Retour LOG Script] Observer actif pour surveiller le compartiment Retour LOG.');
    }

    setTimeout(() => {
        observerSections();
    }, 2000);

})();
