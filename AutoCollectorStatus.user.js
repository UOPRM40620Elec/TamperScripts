// ==UserScript==
// @name         Auto post collector cri
// @namespace    https://github.com/UOPRM40620Elec/TamperScripts/tree/main
// @version      4.0
// @description  Surcouche planner
// @author       Cedric GEORGES
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
    /*box-shadow: 0 0 5px rgb(255, 115, 0), 0 0 5px rgb(255, 115, 0), 0 0 5px rgb(255, 115, 0);
*/
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
    /*background: rgba(0, 0, 0, 0.35);*/
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

        const labelsEligibles = [
            'ELECTRONIQUE - 00 - EN ATTENTE',
            'ELECTRONIQUE - 15 - RETOUR SST - PROD',
            'ELECTRONIQUE - 16 - RETOUR RT',
            'ELECTRONIQUE - 155 - RETOUR COMPOSANT',
            'ELECTRONIQUE - 168 - RETOUR REBUT',
            'ELECTRONIQUE - 165 - RETOUR SUPPORT',
            'ELECTRONIQUE - 011 - RETOUR NORIA LOG',
            'ELECTRONIQUE - 001 - A NORIER',
            'ELECTRONIQUE - 167 - RETOUR CONTROLE QUALITE'
        ].map(normaliserLabel);

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

    function lancerModeAutoCollector() {
        const progressContainer = document.querySelector('.autocollector__progress');
        const progressText = progressContainer.querySelector('.autocollector__progress-text');

        const labelsEligibles = [
            'ELECTRONIQUE - 00 - EN ATTENTE',
            'ELECTRONIQUE - 15 - RETOUR SST - PROD',
            'ELECTRONIQUE - 16 - RETOUR RT',
            'ELECTRONIQUE - 155 - RETOUR COMPOSANT',
            'ELECTRONIQUE - 168 - RETOUR REBUT',
            'ELECTRONIQUE - 165 - RETOUR SUPPORT',
            'ELECTRONIQUE - 011 - RETOUR NORIA LOG',
            'ELECTRONIQUE - 001 - A NORIER',
            'ELECTRONIQUE - 167 - RETOUR CONTROLE QUALITE'
        ].map(normaliserLabel);

        const tachesAFaire = donneesTaches.filter(t =>
                                                  labelsEligibles.includes(normaliserLabel(t.label))
                                                 );

        if (tachesAFaire.length === 0) {
            // Mode debug : activer pour simuler l'envoi de 3 tâches exemple au webhook
            const DEBUG_MODE = false; // False pour désactiver le mode debug
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
        let refreshTermines = 0; // Compteur pour les rafraîchissements terminés

        // Réinitialiser la liste des liens traités au début de chaque traitement
        liensTraites = [];

        function updateProgress() {
            progressText.textContent = `${done}/${total}${erreurs > 0 ? ` (${erreurs} erreur${erreurs > 1 ? 's' : ''})` : ''}`;
        }

        updateProgress();
        postEnCours = total;
        updateAutoCollectorButtonState();

        tachesAFaire.forEach(tache => {
            let url = '';
            let payload = null;

            const labelNormalise = normaliserLabel(tache.label);

            if (labelNormalise === 'ELECTRONIQUE - 00 - EN ATTENTE') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26056',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 15 - RETOUR SST - PROD') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '22771',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 16 - RETOUR RT') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '22772',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 155 - RETOUR COMPOSANT') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26068',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 165 - RETOUR SUPPORT') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26060',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 168 - RETOUR REBUT') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26069',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 011 - RETOUR NORIA LOG') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26055',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 001 - A NORIER') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26039',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            } else if (labelNormalise === 'ELECTRONIQUE - 167 - RETOUR CONTROLE QUALITE') {
                url = 'https://prod.cloud-collectorplus.mt.sncf.fr/Prm/Reparation/ProcessTransition';
                payload = new URLSearchParams({
                    transition_id: '26067',
                    fromForm: false,
                    idUser: tache.idUser,
                    current_repair_id: tache.numeroReparation
                }).toString();
            }
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: payload,
                onload: res => {
                    if (res.status === 200) {
                        done++;
                        // Stocker le lien de la tâche
                        liensTraites.push(tache.lien);
                    } else {
                        erreurs++;
                    }
                    postRestants--;
                    updateProgress();
                    if (postRestants === 0) {
                        console.log('🎯 Toutes les requêtes POST terminées. Rafraîchissement en cours...');
                        console.log('📋 Liste des liens traités avec succès:', liensTraites);

                        // Préparer le rafraîchissement avec compteur
                        const tachesARefresh = tachesAFaire.filter(tache => liensTraites.includes(tache.lien));
                        refreshEnCours = tachesARefresh.length;
                        totalRefreshAttendu = tachesARefresh.length;

                        // Si aucune tâche à rafraîchir, vérifier s'il faut appeler le webhook
                        if (tachesARefresh.length === 0) {
                            console.log('🎯 Aucune tâche à rafraîchir.');
                            console.log('📋 Liens traités avec succès:', liensTraites);

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookPowerAutomate(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }

                            postEnCours = 0;
                            updateAutoCollectorButtonState();
                            return;
                        }

                        // Rafraîchissement des tâches
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
                    postEnCours--;
                    updateAutoCollectorButtonState();
                },
                onerror: () => {
                    erreurs++;
                    postRestants--;
                    updateProgress();
                    if (postRestants === 0) {
                        console.log('🎯 Toutes les requêtes POST terminées (avec erreurs). Rafraîchissement en cours...');
                        console.log('📋 Liste des liens traités avec succès:', liensTraites);

                        // Préparer le rafraîchissement avec compteur
                        const tachesARefresh = tachesAFaire.filter(tache => liensTraites.includes(tache.lien));
                        refreshEnCours = tachesARefresh.length;
                        totalRefreshAttendu = tachesARefresh.length;

                        // Si aucune tâche à rafraîchir, vérifier s'il faut appeler le webhook
                        if (tachesARefresh.length === 0) {
                            console.log('🎯 Aucune tâche à rafraîchir (erreurs).');
                            console.log('📋 Liens traités avec succès:', liensTraites);

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookPowerAutomate(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }

                            postEnCours = 0;
                            updateAutoCollectorButtonState();
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
                                    testerLienHttp(tache.lien, taskCard, 1, true); // true = mode rafraîchissement
                                }
                            });
                        }, 1000);
                    }
                    postEnCours--;
                    updateAutoCollectorButtonState();
                }
            });
        });
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

            // Simuler l'appel GM_xmlhttpRequest pour extraire les données
            GM_xmlhttpRequest({
                method: 'GET',
                url: lien,
                onload: function (response) {
                    console.log(`🐛 DEBUG - Réponse pour ${lien}: Status ${response.status}`);

                    let tacheSimulee;
                    if (response.status === 200) {
                        // Extraire vraiment les données comme dans le script de base
                        const html = response.responseText;
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        const label = doc.querySelector('span.label-success');
                        const texteLabel = label?.textContent?.trim() || 'non trouvé';

                        // Récupération du numéro OF (même logique que le script de base)
                        const ofElements = doc.querySelectorAll('span.labelsPRM');
                        let numOF = 'non trouvé';

                        // Chercher le span qui contient exactement "N° OF :"
                        for (const element of ofElements) {
                            if (element.textContent.includes('N° OF :')) {
                                // Chercher la div suivante qui contient le numéro OF
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

                        // Récupération du nom complet utilisateur
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

                        console.log(`🐛 DEBUG - Tâche extraite depuis HTML réel:`);
                        console.log(`   🔧 Réparation : ${tacheSimulee.numeroReparation}`);
                        console.log(`   🏷️ Label      : ${tacheSimulee.label}`);
                        console.log(`   🆔 idSymbole  : ${tacheSimulee.idSymbole}`);
                        console.log(`   👤 idUser     : ${tacheSimulee.idUser}`);
                        console.log(`   📋 N° OF      : ${tacheSimulee.numOF}`);
                        console.log(`   🔗 Lien       : ${tacheSimulee.lien}`);

                        tachesSimulees.push(tacheSimulee);
                    } else {
                        console.log(`🐛 DEBUG - Erreur HTTP ${response.status} pour ${lien}`);
                    }

                    compteurSimulation++;

                    // Quand toutes les simulations GET sont terminées, appeler le webhook
                    if (compteurSimulation === liensExemples.length) {
                        if (tachesSimulees.length > 0) {
                            console.log('🐛 DEBUG - Simulation terminée, appel du webhook avec les tâches simulées');
                            console.log('📋 Tâches simulées envoyées au webhook:', tachesSimulees);
                            appelWebhookPowerAutomate(tachesSimulees);
                        } else {
                            console.log('🐛 DEBUG - Aucune tâche simulée réussie, pas d\'appel webhook');
                        }
                    }
                },
                onerror: function (error) {
                    console.log(`🐛 DEBUG - Erreur réseau simulée pour ${lien}:`, error);
                    compteurSimulation++;

                    if (compteurSimulation === liensExemples.length) {
                        if (tachesSimulees.length > 0) {
                            console.log('🐛 DEBUG - Simulation terminée avec erreurs, appel du webhook');
                            appelWebhookPowerAutomate(tachesSimulees);
                        } else {
                            console.log('🐛 DEBUG - Aucune tâche simulée réussie, pas d\'appel webhook');
                        }
                    }
                }
            });
        });
    }

    function appelWebhookPowerAutomate(tachesTraitees) {
        // Flag pour utiliser le nom complet au lieu de l'ID utilisateur
        const idName = true; // Passe à false pour utiliser idUser au lieu du nom complet

        // Préparer les données selon le schéma Power Automate
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
                    console.log('✅ Webhook Power Automate appelé avec succès:', response.status);
                    console.log('📋 Réponse:', response.responseText);
                } else {
                    console.error('❌ Erreur lors de l\'appel du webhook:', response.status, response.responseText);
                }
            },
            onerror: error => {
                console.error('❌ Erreur réseau lors de l\'appel du webhook:', error);
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
                console.log(`🔄 Scroll ${essais}... ${currentCount}/${totalAttendu} tâches visibles`);
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

                    // Chercher le span qui contient exactement "N° OF :"
                    for (const element of ofElements) {
                        if (element.textContent.includes('N° OF :')) {
                            // Chercher la div suivante qui contient le numéro OF
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

                    // Récupération du nom complet utilisateur
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
                        console.log(`♻️ Tâche ${numeroReparation} mise à jour`);
                    } else {
                        donneesTaches.push(nouvelleTache);
                        console.log(`➕ Nouvelle tâche ${numeroReparation} ajoutée`);
                    }

                    updateProgressBarFromDonneesTaches();

                    console.log(`✅ Tâche analysée :`);
                    console.log(`   🔧 Réparation : ${numeroReparation}`);
                    console.log(`   🏷️ Label      : ${texteLabel}`);
                    console.log(`   🆔 idSymbole  : ${symbole}`);
                    console.log(`   👤 idUser     : ${idUser}`);
                    console.log(`   � N° OF      : ${numOF}`);
                    console.log(`   �🔗 Lien       : ${lien}`);

                    if (overlay) {
                        overlay.querySelector('.text-collector').textContent = texteLabel;
                        overlay.querySelector('.text-numeroreparation').textContent = numeroReparation;
                        overlay.classList.remove('http-error');
                    }

                    // Fin du traitement réussi
                    liensEnCours = Math.max(0, liensEnCours - 1);

                    // Si c'est un rafraîchissement, décrémenter le compteur
                    if (modeRefresh) {
                        refreshEnCours--;
                        console.log(`🔄 Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} terminé`);

                        // Si tous les rafraîchissements sont terminés, vérifier s'il faut appeler le webhook
                        if (refreshEnCours === 0) {
                            console.log('🎯 Tous les rafraîchissements terminés !');
                            console.log('📋 Liens traités avec succès:', liensTraites);

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookPowerAutomate(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }
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
                        console.warn(`❌ Échec après ${maxTentatives} tentatives pour ${lien}`);
                        liensEnCours = Math.max(0, liensEnCours - 1);

                        // Si c'est un rafraîchissement, décrémenter le compteur même en cas d'erreur
                        if (modeRefresh) {
                            refreshEnCours--;
                            console.log(`❌ Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} échoué`);

                            // Si tous les rafraîchissements sont terminés (même avec erreurs), vérifier s'il faut appeler le webhook
                            if (refreshEnCours === 0) {
                                console.log('🎯 Tous les rafraîchissements terminés (avec erreurs) !');
                                console.log('📋 Liens traités avec succès:', liensTraites);

                                if (liensTraites.length > 0) {
                                    const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                    console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                    appelWebhookPowerAutomate(tachesTraitees);
                                } else {
                                    console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                                }
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
                    console.error(`❌ Échec réseau après ${maxTentatives} tentatives :`, error);
                    liensEnCours = Math.max(0, liensEnCours - 1);

                    // Si c'est un rafraîchissement, décrémenter le compteur même en cas d'erreur réseau
                    if (modeRefresh) {
                        refreshEnCours--;
                        console.log(`❌ Rafraîchissement ${totalRefreshAttendu - refreshEnCours}/${totalRefreshAttendu} échoué (réseau)`);

                        // Si tous les rafraîchissements sont terminés (même avec erreurs), vérifier s'il faut appeler le webhook
                        if (refreshEnCours === 0) {
                            console.log('🎯 Tous les rafraîchissements terminés (avec erreurs réseau) !');
                            console.log('📋 Liens traités avec succès:', liensTraites);

                            if (liensTraites.length > 0) {
                                const tachesTraitees = donneesTaches.filter(t => liensTraites.includes(t.lien));
                                console.log('📋 Tâches envoyées au webhook:', tachesTraitees);
                                appelWebhookPowerAutomate(tachesTraitees);
                            } else {
                                console.log('❌ Aucune tâche traitée avec succès. Pas d\'appel webhook.');
                            }
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

        // 🔍 Vérifie si cette section est dans une colonne à exclure
        const colonne = section.closest('.columnContent');
        const titreColonne = colonne?.querySelector('h3')?.textContent?.trim().toUpperCase();
        if (titreColonne === 'INTROUVABLE' || titreColonne === 'MAUVAIS SYMBOLE') {
            //console.warn(`⛔ Colonne "${titreColonne}" ignorée`);
            return;
        }

        const estOuvert = bouton.getAttribute('aria-expanded') === 'true';

        if (estOuvert && !processedSections.get(section)) {
            console.log('✅ Section "Tâches terminées" OUVERTE → En attente du rendu...');
            processedSections.set(section, true);
            forcerChargementCompletDesTaches(section);
            observerAjoutTachesDansSection(section);

            // Attendre un court instant pour que les tâches se chargent
            setTimeout(() => {
                const taches = section.querySelectorAll('div.taskBoardCard');

                if (!taches.length) {
                    console.warn('⚠️ Aucune tâche trouvée dans cette section. Peut-être encore en chargement ou vide.');
                    return;
                }

                taches.forEach(tache => {
                    const taskCard = tache.querySelector('div.taskCard');
                    if (!taskCard) {
                        console.warn('❌ taskCard manquant pour une tâche détectée.');
                        return;
                    }

                    const lienElement = taskCard.querySelector('a.referencePreviewDescription');
                    let lien = lienElement?.getAttribute('title')?.trim();
                    if (lien && !lien.endsWith('.html')) {
                        lien += '.html';
                    }

                    if (lien) {
                        console.log('📝 Tâche détectée avec lien :', lien);
                        const numeroReparation = lien.match(/\/(\d+)(?:\.html)?$/)?.[1] || 'inconnu';
                        ajouterOverlayTaskCard(taskCard, numeroReparation, 'Chargement...');
                        testerLienHttp(lien, taskCard);
                    } else {
                        console.warn('❌ Lien manquant (balise <a> absente ou invalide) dans cette taskCard.');
                    }
                });
            }, 500); // ← délai ajustable (500ms est souvent suffisant)
        }

        if (!estOuvert && processedSections.get(section)) {
            console.log('🔁 Section refermée. Réinitialisation autorisée.');
            processedSections.set(section, false);
        }
    }



    function ajouterOverlayTaskCard(taskCard, numeroReparation, texteLabel = 'Chargement...') {
        const thumbnail = taskCard.querySelector('.thumbnail.placeholder');
        if (!thumbnail) return;

        // Supprime s’il existe déjà (évite doublons)
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

        thumbnail.style.position = 'relative'; // obligatoire pour absolute
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
                            console.log('🗑️ Section "Tâches terminées" retirée du DOM');

                            // Supprimer toutes les tâches associées à cette section
                            const cards = node.querySelectorAll('div.taskBoardCard');
                            cards.forEach(card => {
                                const lien = card.querySelector('span.previewCaption')?.textContent?.trim();
                                const numero = lien?.match(/\/(\d+)\.html$/)?.[1];
                                if (numero) {
                                    const index = donneesTaches.findIndex(t => t.numeroReparation === numero);
                                    if (index !== -1) {
                                        donneesTaches.splice(index, 1);
                                        console.log(`🗑️ Tâche ${numero} supprimée (section supprimée)`);
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

        console.log('👁️ Observer global actif pour suppression de sections "Tâches terminées".');
    }


    function observerAjoutTachesDansSection(section) {
        const container = section.querySelector('.listWrapper');
        if (!container) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {

                // ✅ Tâches ajoutées dynamiquement
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
                            console.log('🆕 Nouvelle tâche ajoutée dynamiquement :', lien);
                            ajouterOverlayTaskCard(taskCard, numeroReparation, 'Chargement...');
                            testerLienHttp(lien, taskCard);
                        }
                    }
                });

                // 🗑️ Tâches supprimées dynamiquement
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

        console.log('👀 Observer actif sur ajouts/suppressions dynamiques dans cette section "Tâches terminées".');
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

        console.log('[Planner Script] Observer actif pour surveiller les ouvertures.');
    }

    setTimeout(() => {
        observerOuvertureSections();
        observerDisparitionSectionsTachesTerminees();
    }, 2000);

})();
