// Estendi Day.js con il plugin
dayjs.extend(dayjs_plugin_customParseFormat);

// Namespace della libreria vis.js
const { DataSet, Timeline } = vis;

// Elementi DOM
const timelineContainer = document.getElementById('timeline-container');
const loadingEl = document.getElementById('loading');
const modalEl = document.getElementById('event-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalCloseBtn = document.getElementById('modal-close');

// Elementi del Modal
const modalTitle = document.getElementById('modal-title');
const modalTime = document.getElementById('modal-time');
const modalLocation = document.getElementById('modal-location');
const modalTrack = document.getElementById('modal-track');
const modalDescription = document.getElementById('modal-description');
const modalSpeakers = document.getElementById('modal-speakers');

// Elementi del filtro
const trackFilterContainer = document.getElementById('track-filter-container');
const trackFilter = document.getElementById('track-filter');

// Dati della timeline
let timeline;
const timelineGroups = new DataSet();
const timelineItems = new DataSet();

// --- INIZIALIZZAZIONE ---

document.addEventListener('DOMContentLoaded', () => {
    // Le icone sono SVG inline, non serve inizializzazione

    // Carica i dati
    loadEvents();

    // Listener per chiudere il modal
    modalCloseBtn.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', hideModal);

    // Listener per il filtro dei track
    trackFilter.addEventListener('change', onTrackFilterChange);
});

// --- CARICAMENTO E PARSING DATI ---

/**
 * Carica il file JSON degli eventi
 */
async function loadEvents() {
    try {
        // Assicurati che 'events.json' sia nella stessa cartella di questo file html
        const response = await fetch('websummit_schedule.json');
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        const events = await response.json();

        // Processa i dati e ottieni il primo giorno per centrare la timeline
        const { firstEventDate } = processEvents(events);

        // Inizializza la timeline
        initializeTimeline(firstEventDate);

    } catch (error) {
        console.error("Error loading websummit_schedule.json:", error);
        loadingEl.innerHTML = `<span class="text-red-600">Error loading events.</span>`;
    } finally {
        // Nascondi il loading (o lo lascia in stato di errore)
        if (loadingEl.innerHTML.includes('loading')) {
            loadingEl.style.display = 'none';
        }
    }
}

// --- INIZIO MODIFICA RICHIESTA: Funzioni helper per l'ordinamento delle location ---

/**
 * Assegna un "rango" e un "numero" a una location per l'ordinamento.
 */
function getLocationRank(name) {
    let match;

    // 1. Centre Stage
    if (name === 'Centre Stage') {
        return { rank: 1, number: 0 };
    }

    // 2. Stage {number}
    match = name.match(/^Stage (\d+)$/);
    if (match) {
        return { rank: 2, number: parseInt(match[1]) };
    }

    // 3. Masterclass {number}
    match = name.match(/^Masterclass (\d+)$/);
    if (match) {
        return { rank: 3, number: parseInt(match[1]) };
    }

    // 4. Meetup {number}
    match = name.match(/^Meetup (\d+)$/);
    if (match) {
        return { rank: 4, number: parseInt(match[1]) };
    }

    // 5. Altre location "Meetup"
    if (name.includes('Meetup')) {
        return { rank: 5, number: 0 };
    }

    // 6. Community Space
    if (name === 'Community Space') {
        return { rank: 6, number: 0 };
    }

    // 7. Contains Networking
    if (name.includes('Networking')) {
        return { rank: 7, number: 0 };
    }

    // 8. Podcast Booth
    if (name === 'Podcast Booth') {
        return { rank: 8, number: 0 };
    }

    // 9. Meo Arena
    if (name.includes('MEO Arena')) {
        return { rank: 9, number: 0 };
    }

    // 10. Location E{number}
    match = name.match(/E(\d{3})/);
    if (match) {
        return { rank: 10, number: parseInt(match[1]) };
    }

    // 11. Tutto il resto
    return { rank: 11, number: 0 };
}

/**
 * Funzione di comparazione per l'ordinamento
 */
function sortLocations(a, b) {
    const rankA = getLocationRank(a);
    const rankB = getLocationRank(b);

    // Compara per rango principale
    if (rankA.rank !== rankB.rank) {
        return rankA.rank - rankB.rank;
    }

    // Se il rango è uguale, compara per numero (per Stage, Masterclass, ecc.)
    if (rankA.number !== rankB.number) {
        return rankA.number - rankB.number;
    }

    // Come fallback, usa l'ordinamento alfabetico
    return a.localeCompare(b);
}

// --- FINE MODIFICA ---

/**
 * Converte i dati JSON in formato vis.js (Groups e Items)
 */
function processEvents(events) {
    const locations = new Set();
    const tracks = new Set();
    let firstEventDate = null;

    // 1. Prima passa: Raccogli tutte le locations e i tracks unici
    events.forEach(event => {
        const locationName = event.location?.name || 'Sede Sconosciuta';
        locations.add(locationName);

        const trackName = event.schedule_track?.name;
        if (trackName) {
            tracks.add(trackName);
        }
    });

    // 2. Ordina le locations e aggiungile ai Gruppi
    const sortedLocations = Array.from(locations).sort(sortLocations);
    sortedLocations.forEach(locationName => {
        timelineGroups.add({
            id: locationName,
            content: locationName
        });
    });

    // Popola il filtro dei track
    populateTrackFilter(tracks);

    // 3. Seconda passa: Processa e aggiungi gli eventi (Items)
    events.forEach(event => {
        const { start, end } = parseEventDate(event);

        if (start && end) {
            // Aggiorna la data del primo evento per centrare la vista
            if (!firstEventDate || start < firstEventDate) {
                firstEventDate = start;
            }

            // Aggiungi Evento (Item)
            timelineItems.add({
                id: event.id,
                group: event.location?.name || 'Sede Sconosciuta', // Usa lo stesso nome
                content: event.title,
                start: start,
                end: end,
                className: 'event-item', // Classe CSS base
                eventData: event // Salva i dati originali per il modal
            });
        }
    });

    return { firstEventDate };
}


/**
 * Helper per il parsing di date e ore
 * "November 10" + "6.35PM" + "lis25" -> ISODate
 */
function parseEventDate(event) {
    try {
        // Estrai l'anno da "lis25" -> "2025"
        const year = event.conferenceSlug ? "20" + event.conferenceSlug.replace(/\D/g, '') : new Date().getFullYear();

        // Formato: "MMMM D YYYY h.mmA" (es. "November 10 2025 6.35PM")
        const format = "MMMM D YYYY h.mmA";

        // Crea le stringhe complete
        const startStr = `${event.date} ${year} ${event.starts_at}`;
        const endStr = `${event.date} ${year} ${event.ends_at}`;

        // Esegui il parsing (forzando 'en' per "November", "PM", ecc.)
        const start = dayjs(startStr, format, 'en').toISOString();
        const end = dayjs(endStr, format, 'en').toISOString();

        // Gestisci casi in cui l'orario di fine è dopo mezzanotte
        if (dayjs(end).isBefore(dayjs(start))) {
            return { start, end: dayjs(end).add(1, 'day').toISOString() };
        }

        return { start, end };
    } catch (e) {
        console.warn("Data non valida per l'evento:", event.title, e);
        return { start: null, end: null };
    }
}

// --- GESTIONE TIMELINE ---

/**
 * Inizializza l'oggetto Timeline di vis.js
 */
function initializeTimeline(firstEventDate) {
    const options = {
        // Imposta la vista iniziale al primo giorno dell'evento
        start: dayjs(firstEventDate).startOf('day').add(15, 'hour').toISOString(), // Inizia alle 7 del mattino
        end: dayjs(firstEventDate).add(1, 'day').startOf('day').add(12, 'hour').toISOString(), // Finisce alle 22

        // Assi
        orientation: 'top', // Asse del tempo in alto

        // Interazione
        editable: false, // Non permette di muovere gli eventi
        zoomable: true,
        moveable: true,

        // Stile
        stack: false, // Impila eventi sovrapposti
        stackSubgroups: false,

        // Mostra linea rossa ora attuale
        showCurrentTime: true,

        // Altezza
        height: '100%',

        // Limiti di zoom (da 1 ora a 3 giorni)
        zoomMin: 1000 * 60 * 60,
        zoomMax: 1000 * 60 * 60 * 24 * 3,

        // Formattazione ora
        format: {
            minorLabels: {
                minute: 'h:mma',
                hour: 'hA'
            }
        },

    };

    timeline = new Timeline(timelineContainer, timelineItems, timelineGroups, options);

    // Aggiungi listener per il click sugli eventi
    timeline.on('click', onEventClick);

    // Avvia l'aggiornamento per gli eventi attivi
    setInterval(updateActiveEvents, 30000); // Ogni 30 secondi
    updateActiveEvents(); // Esegui subito
}

/**
 * Popola il dropdown per filtrare i track
 * @param {Set<string>} tracks 
 */
function populateTrackFilter(tracks) {
    const tracksArray = Array.from(tracks);

    // Filtra i track che contengono "Summit" ma non sono "Night Summit"
    const summitTracks = tracksArray.filter(track => track.includes("Summit") && track !== "Night Summit");

    // Ordina alfabeticamente i summit tracks
    summitTracks.sort((a, b) => a.localeCompare(b));

    // Filtra i restanti track
    const otherTracks = tracksArray.filter(track => !track.includes("Summit") || track === "Night Summit");

    // Ordina alfabeticamente gli altri track
    otherTracks.sort((a, b) => a.localeCompare(b));

    // Combina: prima summit tracks, poi altri
    const sortedTracks = summitTracks.concat(otherTracks);

    // Opzione di default
    trackFilter.innerHTML = `<option value="all">Tutti i Tracks</option>`;

    sortedTracks.forEach(trackName => {
        const option = document.createElement('option');
        option.value = trackName;
        option.textContent = trackName;
        trackFilter.appendChild(option);
    });

    // Mostra il filtro
    trackFilterContainer.classList.remove('hidden');
}

/**
 * Gestisce il cambio di selezione nel filtro dei track
 */
function onTrackFilterChange() {
    const selectedTrack = trackFilter.value;
    const allItems = timelineItems.get({
        // Ottieni tutti i campi per non perderli durante l'update
        fields: ['id', 'className', 'eventData'] 
    });

    const itemsToUpdate = [];

    allItems.forEach(item => {
        const trackName = item.eventData.schedule_track?.name;
        let currentClasses = item.className.split(' ').filter(c => c !== 'event-highlighted');
        
        // Aggiungi la classe highlight se il track corrisponde e non è "tutti"
        if (selectedTrack !== 'all' && trackName === selectedTrack) {
            currentClasses.push('event-highlighted');
        }

        const newClassName = currentClasses.join(' ');

        // Aggiorna solo se la classe è cambiata
        if (item.className !== newClassName) {
            itemsToUpdate.push({ id: item.id, className: newClassName });
        }
    });

    if (itemsToUpdate.length > 0) {
        timelineItems.update(itemsToUpdate);
    }
}

/**
 * Aggiorna la classe CSS per gli eventi attualmente attivi
 */
function updateActiveEvents() {
    const now = new Date();
    const selectedTrack = trackFilter.value;
    const allItems = timelineItems.get({
        fields: ['id', 'className', 'start', 'end', 'eventData'] 
    });

    const itemsToUpdate = [];

    allItems.forEach(item => {
        const isActive = dayjs(now).isAfter(dayjs(item.start)) && dayjs(now).isBefore(dayjs(item.end));
        let newClassName;

        if (isActive) {
            // L'evento attivo ha la priorità massima
            newClassName = 'event-item event-active';
        } else {
            // Se non è attivo, controlla se deve essere evidenziato dal filtro
            const eventTrack = item.eventData.schedule_track?.name;
            if (selectedTrack !== 'all' && eventTrack === selectedTrack) {
                newClassName = 'event-item event-highlighted';
            } else {
                // Altrimenti, classe di default
                newClassName = 'event-item';
            }
        }

        // Aggiorna solo se la classe è cambiata
        if (item.className !== newClassName) {
            itemsToUpdate.push({ id: item.id, className: newClassName });
        }
    });

    if (itemsToUpdate.length > 0) {
        timelineItems.update(itemsToUpdate);
    }
}

/**
 * Chiamato al click su un evento
 */
function onEventClick(props) {
    // Se è stato cliccato un item (evento)
    if (props.item) {
        const eventId = props.item;
        const event = timelineItems.get(eventId);

        if (event && event.eventData) {
            showModal(event.eventData, event.start, event.end);
        }
    }
}

// --- GESTIONE MODAL ---

/**
 * Mostra il modal con i dettagli dell'evento
 */
function showModal(eventData, start, end) {
    // Popola i campi
    modalTitle.textContent = eventData.title;

    // Formattazione data e ora
    const timeFormat = "h:mmA";
    const dateFormat = "dddd, MMMM D";
    const startDay = dayjs(start);
    const endDay = dayjs(end);

    modalTime.textContent = `${startDay.format(dateFormat)}  •  ${startDay.format(timeFormat)} - ${endDay.format(timeFormat)}`;
    if (eventData.location?.name) {
        const locationUrl = `https://map.websummit.com/${eventData.conferenceSlug}?location=${eventData.location.name}&location_id=${eventData.location.id}`;
        modalLocation.innerHTML = `📍 <a href="${locationUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${eventData.location.name} <img src="open-link.svg" alt="Map Pin" class="inline-block w-3 h-3"></a>`;
    } else {
        modalLocation.textContent = '📍 Sconosciuto';
    }

    // Aggiungi il track
    if (eventData.schedule_track?.name) {
        modalTrack.textContent = `Track: ${eventData.schedule_track.name}`;
        modalTrack.style.display = 'inline-block';
    } else {
        modalTrack.style.display = 'none';
    }

    modalDescription.innerHTML = eventData.description.replace(/\n/g, '<br>'); // Gestisce a-capo

    // Popola gli speaker
    modalSpeakers.innerHTML = ''; // Pulisci
    if (eventData.timeslot_participations && eventData.timeslot_participations.length > 0) {
        eventData.timeslot_participations.forEach(speaker => {
            const formattedName = speaker.name.toLowerCase().replace(/\s+/g, '-');
            const speakerUrl = `https://websummit.com/attendees/${eventData.conferenceSlug}/${speaker.attendance_id}/${formattedName}`;

            const speakerHtml = `
                        <a href="${speakerUrl}" target="_blank" rel="noopener noreferrer" class="block hover:bg-gray-50 p-2 rounded-lg transition-colors duration-150">
                            <div class="flex items-center space-x-3">
                                <img 
                                    src="${speaker.avatar_urls.thumb}" 
                                    alt="${speaker.name}" 
                                    class="w-16 h-16 rounded-full object-cover bg-gray-200 border border-gray-100"
                                    onerror="this.src='https://placehold.co/100x100/e0e0e0/757575?text=${speaker.name.charAt(0)}'"
                                >
                                <div>
                                    <p class="font-semibold text-gray-800">${speaker.name}</p>
                                    <p class="text-sm text-gray-600">${speaker.job_title || ''}</p>
                                    <p class="text-sm text-gray-500">${speaker.company_name || ''}</p>
                                </div>
                            </div>
                        </a>
                    `;
            modalSpeakers.innerHTML += speakerHtml;
        });
    } else {
        modalSpeakers.innerHTML = '<p class="text-sm text-gray-500">Nessuno speaker annunciato per questo evento.</p>';
    }

    // Mostra il modal
    modalEl.classList.remove('modal-hidden');
    document.body.style.overflow = 'hidden'; // Blocca scroll pagina
}

/**
 * Nasconde il modal
 */
function hideModal() {
    modalEl.classList.add('modal-hidden');
    document.body.style.overflow = ''; // Riattiva scroll
}
