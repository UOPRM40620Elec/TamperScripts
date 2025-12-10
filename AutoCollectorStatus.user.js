// ==UserScript==
// @name         Auto post collector cri
// @namespace    https://github.com/UOPRM40620Elec/TamperScripts/tree/main
// @version      4.5
// @description  Surcouche planner avec gestion redondance SST
// @author       Cedric GEORGE & Teddy CORBILLON
// @match        https://planner.cloud.microsoft/webui/plan/MxiCj9OWB02LWJYhINLPe5YAEB8_/view/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      prod.cloud-collectorplus.mt.sncf.fr
// @connect      10b4c86e6b534f8298e70036f83a50.ff.environment.api.powerplatform.com
// @connect      *.ff.environment.api.powerplatform.com
// @connect      *.api.powerplatform.com
// @updateURL    https://raw.githubusercontent.com/UOPRM40620Elec/TamperScripts/refs/heads/main/AutoCollectorStatus.user.js
// @downloadURL  https://raw.githubusercontent.com/UOPRM40620Elec/TamperScripts/refs/heads/main/AutoCollectorStatus.user.js
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

    // Configuration des IDs de transition par Label
    const configTransitions = {
        'ELECTRONIQUE - 00 - EN ATTENTE': '26056',
        'ELECTRONIQUE - 14 - RETOUR SST': '22766', // ID Principal (fallback sur 22767)
        'ELECTRONIQUE - 16 - RETOUR RT': '22772',
        'ELECTRONIQUE - 155 - RETOUR COMPOSANT': '26068',
        'ELECTRONIQUE - 165 - RETOUR SUPPORT': '26060',
        'ELECTRONIQUE - 168 - RETOUR REBUT': '26069',
        'ELECTRONIQUE - 011 - RETOUR NORIA LOG': '26055',
        'ELECTRONIQUE - 001 - A NORIER': '26039',
        'ELECTRONIQUE - 167 - RETOUR CONTROLE QUALITE': '26067'
    };


    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ajouterBoutonAutoCollector);
    } else {
        ajouterBoutonAutoCollector();
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

.autocollector {
    position: absolute;
    bottom: 10px;
    right: 10px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    flex-direction: column;
    row-gap: 10px;
}

.autocollector__button {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 25px;
    border: 2px solid rgb(250, 90, 26);
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    padding: 5px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    cursor: grab;
}

.autocollector__button:hover {
    transform: scale(1.05);
}

.autocollector__button-icon {
    display: block;
    position: relative;
    padding: 0px 4px 0px 2px;
    margin: 0;
    width: 25px;
    height: 20px;
    border-radius: 0px;
    overflow: hidden;
}

.autocollector__button-text {
    padding-right: 5px;
    color: antiquewhite;
    font-family: 'Montserrat', sans-serif;
    font-weight: 400;
    font-size: 1rem;
}

.autocollector__progress {
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 25px;
    border: 2px solid rgb(250, 90, 26);
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
        if (!document.getElementById('font')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css?family=Montserrat:300,400,700,900&display=swap';
            link.id = 'font';
            document.head.appendChild(link);
            console.log('🔤 Police Montserrat injectée.');
        }
    }

    function normaliserLabel(label) {
        return label?.trim().replace(/\s+/g, ' ').normalize('NFKC');
    }

    function updateProgressBarFromDonneesTaches() {
        const progressContainer = document.querySelector('.autocollector__progress');
        const progressText = progressContainer?.querySelector('.autocollector__progress-text');
        if (!progressContainer || !progressText) return;

        const labelsEligibles = Object.keys(configTransitions).map(normaliserLabel);

        const total = donneesTaches.filter(t =>
                                           labelsEligibles.includes(normaliserLabel(t.label))
                                          );
        if (total === 0) {
            progressContainer.classList.add('hidden');
        } else {
            progressContainer.classList.remove('hidden');
        }

        progressText.textContent = `0/${total.length}`;
    }


    function ajouterBoutonAutoCollector() {
        const container = document.createElement('div');
        container.className = 'autocollector';

        container.innerHTML = `
        <div class="autocollector__progress hidden">
            <span class="autocollector__progress-text">0/0</span>
        </div>
        <div class="autocollector__button">
            <img src="https://prod.cloud-collectorplus.mt.sncf.fr/assets/images/sprite_src/pictos/Collector_accueil.png"
                 alt="Icon"
                 class="autocollector__button-icon">
            <span class="autocollector__button-text">Lancer mode auto collector</span>
        </div>
    `;

        document.body.appendChild(container);

        // Clic sur le bouton : lancer le traitement automatique
        container.querySelector('.autocollector__button').addEventListener('click', () => {
            lancerModeAutoCollector();
        });
    }

    // ==========================================
    // CŒUR DU SCRIPT : Logique de traitement
    // ==========================================

    function lancerModeAutoCollector() {
        const progressContainer = document.querySelector('.autocollector__progress');
        const progressText = progressContainer.querySelector('.autocollector__progress-text');

        const labelsEligibles = Object.keys(configTransitions).map(normaliserLabel);

        const tachesAFaire = donneesTaches.filter(t =>
                                                  labelsEligibles.includes(normaliserLabel(t.label))
                                                 );

        if (tachesAFaire.length === 0) {
            // Mode debug
            const DEBUG_MODE = false;
            if (DEBUG_MODE) {
                alert('Mode debug activé : aucune tâche éligible trouvée, simulation de 3 tâches.');
                simulerModeDebug();
            } else {
                alert('Aucune tâche éligible trouvée.');
            }
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
        updateAutoCollectorButtonState();

        // Fonction pour finaliser le traitement d'une tâche (après succès ou échec final)
        function finaliserTraitementRequete(isSuccess, tache) {
            if (isSuccess) {
                done++;
                liensTraites.push(tache.lien);
            } else {
                erreurs++;
            }
            postRestants--;
            updateProgress();

            if (postRestants === 0) {
                lancerPhaseRafraichissement(tachesAFaire);
            }
            postEnCours--;
            updateAutoCollectorButtonState();
        }

        // --- Boucle sur les tâches ---
        tachesAFaire.forEach(tache => {
            const labelNormalise = normaliserLabel(tache.label);
            const initialId = configTransitions[labelNormalise];
            const url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';

            // Fonction récursive pour tenter l'envoi avec gestion du fallback SST
            const tenterEnvoiPost = (transitionId, isRetry = false) => {
                const payload = new URLSearchParams({
                    transition_id: transitionId,
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: url,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: payload,
                    onload: res => {
                        // Gestion du cas spécifique RETOUR SST (si échec sur le premier ID, tenter le second)
                        if (res.status !== 200 && labelNormalise === 'ELECTRONIQUE - 14 - RETOUR SST' && !isRetry) {
                            console.warn(`⚠️ Échec SST avec ID 22766 pour ${tache.numeroReparation}. Tentative auto avec 22767...`);
                            tenterEnvoiPost('22767', true); // Retry avec l'ID secondaire
                            return; // On sort pour ne pas compter l'erreur tout de suite
                        }

                        // Succès ou Échec définitif
                        if (res.status === 200) {
                            finaliserTraitementRequete(true, tache);
                        } else {
                            console.error(`❌ Erreur POST pour ${tache.numeroReparation} (ID: ${transitionId}) : Status ${res.status}`);
                            finaliserTraitementRequete(false, tache);
                        }
                    },
                    onerror: () => {
                        // Même logique pour erreur réseau sur SST
                        if (labelNormalise === 'ELECTRONIQUE - 14 - RETOUR SST' && !isRetry) {
                            console.warn(`⚠️ Erreur réseau SST avec ID 22766. Tentative avec 22767...`);
                            tenterEnvoiPost('22767', true);
                            return;
                        }
                        console.error(`❌ Erreur Réseau POST pour ${tache.numeroReparation}`);
                        finaliserTraitementRequete(false, tache);
                    }
                });
            };

            // Lancement de la première tentative
            if (initialId) {
                tenterEnvoiPost(initialId);
            } else {
                finaliserTraitementRequete(false, tache);
            }
        });
    }

    // Gestion de la phase de rafraîchissement des cartes
    function lancerPhaseRafraichissement(tachesAFaire) {
        console.log('🎯 Toutes les requêtes POST terminées. Analyse pour rafraîchissement...');
        console.log('📋 Liste des liens traités avec succès:', liensTraites);

        const tachesARefresh = tachesAFaire.filter(tache => liensTraites.includes(tache.lien));
        refreshEnCours = tachesARefresh.length;
        totalRefreshAttendu = tachesARefresh.length;

        // Si aucune tâche à rafraîchir
        if (tachesARefresh.length === 0) {
            traiterFinDeCycle();
            return;
        }

        // Lancer les rafraîchissements
        setTimeout(() => {
            tachesARefresh.forEach(tache => {
                const taskCard = document.querySelector(`#idreparation-status-${tache.numeroReparation}`)?.closest('.taskCard');
                if (taskCard) {
                    const overlay = taskCard.querySelector(`#idreparation-status-${tache.numeroReparation}`);
                    if (overlay) {
                        overlay.querySelector('.text-collector').textContent = 'Rafraîchissement...';
                    }
                    testerLienHttp(tache.lien, taskCard, 1, true); // true = mode rafraîchissement
                }
            });
        }, 1000);
    }

    // Gestion de la fin de cycle (Webhook)
    function traiterFinDeCycle() {
        if (liensTraites.length > 0) {
            const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
            console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
            appelWebhookPowerAutomate(tachesTraitees);
        } else {
            console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
        }
        postEnCours = 0;
        updateAutoCollectorButtonState();
    }


    console.log('[Planner Script] Démarrage avec requêtes GET...');

    function simulerModeDebug() {
        console.log('🐛 Mode debug activé - Simulation de 3 tâches');

        const liensExemples = [
            'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/3817764.html',
            'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/2812975.html',
            'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/3626010.html'
        ];

        const tachesSimulees = [];
        let compteurSimulation = 0;

        liensExemples.forEach((lien, index) => {
            const numeroReparation = lien.match(/\/(\d+)\.html$/)?.[1] || 'inconnu';

            console.log(`🐛 Simulation GET pour ${lien}`);

            GM_xmlhttpRequest({
                method: 'GET',
                url: lien,
                onload: function (response) {
                    let tacheSimulee;
                    if (response.status === 200) {
                        const html = response.responseText;
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        const label = doc.querySelector('span.label-success');
                        const texteLabel = label?.textContent?.trim() || 'non trouvé';

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

                        tacheSimulee = {
                            lien: lien,
                            numeroReparation: numeroReparation,
                            label: texteLabel,
                            idSymbole: symbole,
                            idUser: idUser,
                            userName: userName,
                            numOF: numOF
                        };
                        tachesSimulees.push(tacheSimulee);
                    }
                    compteurSimulation++;
                    if (compteurSimulation === liensExemples.length) {
                        if (tachesSimulees.length > 0) {
                            appelWebhookPowerAutomate(tachesSimulees);
                        }
                    }
                },
                onerror: function (error) {
                    compteurSimulation++;
                    if (compteurSimulation === liensExemples.length) {
                         if (tachesSimulees.length > 0) appelWebhookPowerAutomate(tachesSimulees);
                    }
                }
            });
        });
    }

    function appelWebhookPowerAutomate(tachesTraitees) {
        const idName = true;
        const uniqueUsers = [...new Set(tachesTraitees.map(t => idName ? t.userName : t.idUser))]
            .filter(user => user && user !== 'non trouvé' && user.trim() !== '')
            .map(user => user.trim());

        const uniqueOFs = [...new Set(tachesTraitees.map(t => t.numOF))]
            .filter(of => of && of !== 'non trouvé' && of.trim() !== '')
            .map(of => {
                const cleaned = of.trim();
                return cleaned.startsWith('OF') ? cleaned : `OF${cleaned}`;
            });

        const payload = {
            user: uniqueUsers.length > 0 ? uniqueUsers.map(userId => ({ id: userId })) : [{ id: "utilisateur_inconnu" }],
            OF: uniqueOFs.length > 0 ? uniqueOFs.map(ofId => ({
                id: ofId
            })) : [{ id: "OF_inconnu" }]
        };

        console.log('📤 Envoi des données au webhook Power Automate:', payload);

        GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://10b4c86e6b534f8298e70036f83a50.ff.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/8032c1367fa74db58a5dee07d8efea60/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=WmQOf1IYOCvsIwXe3KyQyFvvJUwbAa7BWV-GqBfj-o0',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    console.log('✅ Webhook Power Automate appelé avec succès');
                } else {
                    console.error('❌ Erreur lors de l\'appel du webhook:', response.status);
                }
            }
        });
    }

    function updateAutoCollectorButtonState() {
        const btn = document.querySelector('.autocollector__button');
        const label = btn?.querySelector('.autocollector__button-text');
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
            label.textContent = 'Lancer mode auto collector';
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
            }
        }, 600);
    }




    function testerLienHttp(lien, taskCard, tentative = 1, modeRefresh = false) {
        liensEnCours++;
        updateAutoCollectorButtonState();

        const maxTentatives = 5;
        const numeroReparation = lien.match(/\/(\d+)\.html$/)?.[1] || 'inconnu';

        GM_xmlhttpRequest({
            method: 'GET',
            url: lien,
            onload: function (response) {
                const overlay = taskCard.querySelector(`#idreparation-status-${numeroReparation}`);

                if (response.status === 200) {
                    const html = response.responseText;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');

                    const label = doc.querySelector('span.label-success');
                    const texteLabel = label?.textContent?.trim() || 'non trouvé';

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

                    const index = donneesTaches.findIndex(t => t.numeroReparation === numeroReparation);
                    const nouvelleTache = {
                        lien,
                        numeroReparation,
                        label: texteLabel,
                        idSymbole: symbole,
                        idUser: idUser,
                        userName: userName,
                        numOF: numOF
                    };

                    if (index !== -1) {
                        donneesTaches[index] = nouvelleTache;
                    } else {
                        donneesTaches.push(nouvelleTache);
                    }

                    updateProgressBarFromDonneesTaches();

                    if (overlay) {
                        overlay.querySelector('.text-collector').textContent = texteLabel;
                        overlay.querySelector('.text-numeroreparation').textContent = numeroReparation;
                        overlay.classList.remove('http-error');
                    }

                    liensEnCours = Math.max(0, liensEnCours - 1);

                    // Si c'est un rafraîchissement
                    if (modeRefresh) {
                        refreshEnCours--;
                        if (refreshEnCours === 0) {
                            console.log('🎯 Rafraîchissement terminé. Passage au Webhook.');
                            traiterFinDeCycle();
                        }
                    }
                    updateAutoCollectorButtonState();

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
                        liensEnCours = Math.max(0, liensEnCours - 1);
                        if (modeRefresh) {
                            refreshEnCours--;
                            if (refreshEnCours === 0) {
                                traiterFinDeCycle();
                            }
                        }
                        updateAutoCollectorButtonState();
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
                    liensEnCours = Math.max(0, liensEnCours - 1);
                    if (modeRefresh) {
                        refreshEnCours--;
                        if (refreshEnCours === 0) {
                            traiterFinDeCycle();
                        }
                    }
                    updateAutoCollectorButtonState();
                }
            }
        });
    }


    function extraireTachesDepuisSection(section) {
        const bouton = section.querySelector('button.sectionToggleButton');
        const titre = bouton?.querySelector('h4.toggleText');

        if (titre?.textContent?.trim() !== 'Tâches terminées') return;

        const colonne = section.closest('.columnContent');
        const titreColonne = colonne?.querySelector('h3')?.textContent?.trim().toUpperCase();
        if (titreColonne === 'INTROUVABLE' || titreColonne === 'MAUVAIS SYMBOLE') {
            return;
        }

        const estOuvert = bouton.getAttribute('aria-expanded') === 'true';

        if (estOuvert && !processedSections.get(section)) {
            console.log('✅ Section "Tâches terminées" OUVERTE → En attente du rendu...');
            processedSections.set(section, true);
            forcerChargementCompletDesTaches(section);
            observerAjoutTachesDansSection(section);

            setTimeout(() => {
                const taches = section.querySelectorAll('div.taskBoardCard');
                if (!taches.length) return;

                taches.forEach(tache => {
                    const taskCard = tache.querySelector('div.taskCard');
                    if (!taskCard) return;

                    const lienElement = taskCard.querySelector('a.referencePreviewDescription');
                    let lien = lienElement?.getAttribute('title')?.trim();
                    if (lien && !lien.endsWith('.html')) {
                        lien += '.html';
                    }

                    if (lien) {
                        const numeroReparation = lien.match(/\/(\d+)(?:\.html)?$/)?.[1] || 'inconnu';
                        ajouterOverlayTaskCard(taskCard, numeroReparation, 'Chargement...');
                        testerLienHttp(lien, taskCard);
                    }
                });
            }, 500);
        }

        if (!estOuvert && processedSections.get(section)) {
            processedSections.set(section, false);
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

    function observerDisparitionSectionsTachesTerminees() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.removedNodes.forEach(node => {
                    if (
                        node.nodeType === 1 &&
                        node.matches('.secondarySection')
                    ) {
                        const titre = node.querySelector('h4.toggleText')?.textContent?.trim();
                        if (titre === 'Tâches terminées') {
                            const cards = node.querySelectorAll('div.taskBoardCard');
                            cards.forEach(card => {
                                const lien = card.querySelector('span.previewCaption')?.textContent?.trim();
                                const numero = lien?.match(/\/(\d+)\.html$/)?.[1];
                                if (numero) {
                                    const index = donneesTaches.findIndex(t => t.numeroReparation === numero);
                                    if (index !== -1) {
                                        donneesTaches.splice(index, 1);
                                    }
                                }
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
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
                        if (lien && !lien.endsWith('.html')) lien += '.html';
                        const numeroReparation = lien?.match(/\/(\d+)\.html$/)?.[1];

                        if (numeroReparation) {
                            const index = donneesTaches.findIndex(t => t.numeroReparation === numeroReparation);
                            if (index !== -1) {
                                donneesTaches.splice(index, 1);
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
    }

    function observerOuvertureSections() {
        const cible = document.body;

        const observer = new MutationObserver(() => {
            const sections = document.querySelectorAll('div.secondarySection');

            sections.forEach(section => {
                const bouton = section.querySelector('button.sectionToggleButton');
                const titre = bouton?.querySelector('h4.toggleText');

                if (titre?.textContent?.trim() === 'Tâches terminées') {
                    extraireTachesDepuisSection(section);
                }
            });
        });

        observer.observe(cible, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-expanded'],
        });
    }

    setTimeout(() => {
        observerOuvertureSections();
        observerDisparitionSectionsTachesTerminees();
    }, 2000);

})();
