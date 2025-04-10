document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const pokedexGrid = document.getElementById('pokedex-grid');
    const searchInput = document.getElementById('searchInput');
    const paginationContainer = document.getElementById('pagination');
    const modal = document.getElementById('pokemonDetailModal');
    const modalBackgroundLayer = modal.querySelector('.modal-background-layer');
    const modalContent = modal.querySelector('.modal-content');
    const modalBodyWrapper = modal.querySelector('.modal-body-wrapper'); // Get wrapper
    const modalBodyContainer = document.getElementById('modalBody'); // Grid container
    const modalLoader = modalContent.querySelector('.modal-loader'); // Specific Loader
    const closeModalButton = modal.querySelector('.close-button');

    // Modal Content Fields
    const modalPokemonNameEl = document.getElementById('modalPokemonName');
    const modalPokemonTypesEl = document.getElementById('modalPokemonTypes');
    const modalImageEl = modalContent.querySelector('.modal-image-container img');
    const modalActionBtnContainer = document.getElementById('modalActionContainer');
    const modalLoreContainer = document.getElementById('modalLore');
    const modalStatsContainer = document.getElementById('modalStats');
    const modalAbilitiesContainer = document.getElementById('modalAbilities');
    const modalEvolutionContainer = document.getElementById('modalEvolution');

    // Comparison Elements
    const comparisonStatusBar = document.getElementById('comparisonStatusBar');
    const compareSlot1 = document.getElementById('compareSlot1');
    const compareSlot2 = document.getElementById('compareSlot2');
    const clearComparisonBtn = document.getElementById('clearComparisonBtn');
    const comparisonOverlay = document.getElementById('comparisonOverlay');
    const comparisonBackgroundLayer = comparisonOverlay.querySelector('.comparison-background-layer');
    const closeComparisonOverlayBtn = document.getElementById('closeComparisonOverlayBtn');
    const comparePokemonDisplay1 = document.getElementById('comparePokemonDisplay1');
    const comparePokemonDisplay2 = document.getElementById('comparePokemonDisplay2');

    // --- API and State Variables ---
    const POKE_API_BASE = 'https://pokeapi.co/api/v2/';
    const LIMIT = 24; // Adjust limit based on new card size/layout if needed
    let offset = 0;
    let totalPokemonCount = 0;
    let allPokemonNames = [];
    let currentPokemonList = []; // Stores detailed data for current page
    let currentFetchedDetails = {}; // Cache fetched details { id: data }
    let searchTimeout;
    let pokemonToCompare1 = null;
    let pokemonToCompare2 = null;
    const DEFAULT_SPRITE = 'assets/placeholder.png'; // Default fallback sprite

    // --- Helper Functions ---

    /** Creates a standard error message element */
    function createErrorElement(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `ERROR: ${message}`; // Make error more obvious
        return errorDiv;
    }

     /** Updates a comparison slot UI */
    function updateComparisonSlotUI(slotElement, pokemonData) {
        const placeholder = slotElement.querySelector('.slot-placeholder');
        const img = slotElement.querySelector('.slot-image');
        const name = slotElement.querySelector('.slot-name');
        if (pokemonData) {
            placeholder.style.display = 'none';
            // Use consistent sprite logic, prefer static/pixelated for small slot
            img.src = getPokemonSprite(pokemonData, false, true); // preferAnimated=false, preferPixelated=true
            img.style.display = 'block';
            name.textContent = pokemonData.name;
            name.style.display = 'block';
        } else {
            placeholder.style.display = 'block';
            img.style.display = 'none'; name.style.display = 'none';
            name.textContent = ''; img.src = ''; // Clear data
        }
    }

     /** Updates the entire comparison status bar */
    function updateComparisonBar() {
        if (pokemonToCompare1 || pokemonToCompare2) {
            comparisonStatusBar.classList.add('visible');
        } else {
            comparisonStatusBar.classList.remove('visible');
        }
        updateComparisonSlotUI(compareSlot1, pokemonToCompare1);
        updateComparisonSlotUI(compareSlot2, pokemonToCompare2);
    }

     /** Resets the comparison state and UI */
    function resetComparison() {
        pokemonToCompare1 = null; pokemonToCompare2 = null;
        updateComparisonBar();
        hideComparisonView(); // Use animated hide
    }

     /** Displays the loading indicator in the grid */
    function showGridLoader() {
        pokedexGrid.innerHTML = `<div class="loader">LOADING SYSTEM...</div>`;
        paginationContainer.style.display = 'none';
    }

    /** Hides the grid loading indicator */
    function hideGridLoader() {
        const loaderElement = pokedexGrid.querySelector('.loader');
        if (loaderElement) loaderElement.remove();
        // Show pagination if applicable
        if (searchInput.value.trim() === '' && totalPokemonCount > LIMIT) {
            paginationContainer.style.display = 'flex';
        } else {
            paginationContainer.style.display = 'none';
        }
    }

     /** Displays an error message in the grid area */
    function displayGridError(message) {
        pokedexGrid.innerHTML = '';
        pokedexGrid.appendChild(createErrorElement(message));
        paginationContainer.style.display = 'none';
    }

     /** Sets the blurred background image on an element */
    function setBlurredBackground(element, imageUrl) {
        if (element && imageUrl && imageUrl !== DEFAULT_SPRITE) {
            element.style.backgroundImage = `url('${imageUrl}')`;
        } else if (element) {
            element.style.backgroundImage = 'none';
        }
    }

    /** Hides the comparison overlay with animation */
    function hideComparisonView() {
        if (!comparisonOverlay.classList.contains('visible')) return;
        comparisonOverlay.classList.remove('visible'); // Trigger fadeOut animation
        setTimeout(() => {
            comparisonOverlay.style.display = 'none';
            setBlurredBackground(comparisonBackgroundLayer, null);
            // Clear content? Maybe not necessary if shown again quickly
            // comparePokemonDisplay1.innerHTML = ''; comparePokemonDisplay2.innerHTML = '';
        }, 500); // Match CSS transition duration
    }

     /** Hides the Pokemon detail modal with animation */
    function closeModal() {
        if (!modal.classList.contains('visible')) return;
        modal.classList.remove('visible'); // Trigger fade/scale out animations
        setTimeout(() => {
             modal.style.display = 'none';
             // Clear potentially large content
             [modalEvolutionContainer, modalLoreContainer, modalStatsContainer, modalAbilitiesContainer, modalPokemonNameEl, modalPokemonTypesEl, modalActionBtnContainer].forEach(el => { if(el) el.innerHTML = ''; });
             if(modalImageEl) modalImageEl.src = DEFAULT_SPRITE;
             setBlurredBackground(modalBackgroundLayer, null);
             // Reset scroll position for next open
             if (modalBodyWrapper) modalBodyWrapper.scrollTop = 0;
        }, 500); // Match CSS animation duration
    }

    /** MODIFIED: Gets the desired sprite URL with fallback logic */
    function getPokemonSprite(pokemon, preferAnimated = false, preferPixelated = false) {
        if (!pokemon || !pokemon.sprites) return DEFAULT_SPRITE;
        let spriteUrl = null;

        // Preference 1: Animated Pixel Sprite (Gen 5)
        if (preferAnimated && pokemon.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default) {
            spriteUrl = pokemon.sprites.versions['generation-v']['black-white'].animated.front_default;
        }
        // Preference 2: Official Artwork (High-Res Static) - Only if not preferring pixelated or animated failed
        else if (!preferPixelated && pokemon.sprites.other?.['official-artwork']?.front_default) {
            spriteUrl = pokemon.sprites.other['official-artwork'].front_default;
        }
        // Preference 3: Regular Pixel Sprite (Front Default)
        else if (preferPixelated && pokemon.sprites.front_default) {
             spriteUrl = pokemon.sprites.front_default;
        }
         // Fallback 1: Official Artwork if previous failed
         else if (pokemon.sprites.other?.['official-artwork']?.front_default){
             spriteUrl = pokemon.sprites.other['official-artwork'].front_default;
         }
         // Fallback 2: Regular front default
         else if (pokemon.sprites.front_default){
            spriteUrl = pokemon.sprites.front_default;
         }
        // Fallback 3: Placeholder
        return spriteUrl || DEFAULT_SPRITE;
    }

    /** NEW: Finds the best English flavor text */
    function findEnglishFlavorText(flavorTextEntries) {
        if (!flavorTextEntries) return "No description available in the database.";
        let englishText = null;
        // Prioritize recent versions known for more flavourful text
        const preferredVersions = ['sword', 'shield', 'scarlet', 'violet', 'legends-arceus', 'ultra-sun', 'ultra-moon', 'sun', 'moon','black','white'];
        for (const version of preferredVersions) {
            const entry = flavorTextEntries.find(ft => ft.language.name === 'en' && ft.version.name === version);
            if (entry) {
                englishText = entry.flavor_text;
                break;
            }
        }
        // Fallback to any English entry if no preferred found
        if (!englishText) {
            const entry = flavorTextEntries.find(ft => ft.language.name === 'en');
            if (entry) englishText = entry.flavor_text;
        }
        // Clean up text (remove form feeds, newlines etc.)
        return englishText ? englishText.replace(/[\u000c\n]/g, ' ').replace(/­/g, '') : "No English description found.";
    }


    /** NEW: Fetches species data */
    async function fetchSpeciesData(url) {
        if (!url) return null;
        // Simple cache check for species URL
        if (currentFetchedDetails[url]) return currentFetchedDetails[url];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Species fetch failed: ${response.status}`);
            const data = await response.json();
            currentFetchedDetails[url] = data; // Cache species data
            return data;
        } catch (error) {
            console.error(`Failed to fetch species data from ${url}:`, error);
            return null;
        }
    }

    /** NEW: Fetches evolution chain data */
    async function fetchEvolutionChain(url) {
        if (!url) return null;
        if (currentFetchedDetails[url]) return currentFetchedDetails[url];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Evolution chain fetch failed: ${response.status}`);
             const data = await response.json();
             currentFetchedDetails[url] = data; // Cache evolution chain
             return data;
        } catch (error) {
            console.error(`Failed to fetch evolution chain from ${url}:`, error);
            return null;
        }
    }

    /** NEW: Recursively parses evolution chain and prepares display elements */
     async function parseAndDisplayEvolutionChain(chainData, containerElement) {
        if (!chainData || !containerElement) {
            containerElement.innerHTML = '<p class="evolution-error">Evolution data unavailable.</p>'; return;
        }
        containerElement.innerHTML = ''; // Clear previous
        const evolutionStages = []; // To hold elements in order
        const spriteFetchPromises = []; // To fetch sprites concurrently

        let currentStageData = chainData.chain;

        while (currentStageData) {
            const speciesName = currentStageData.species.name;
            const speciesUrl = currentStageData.species.url;
            const pokemonId = speciesUrl.split('/').filter(Boolean).pop(); // Extract ID

            // Create stage elements immediately
            const stageDiv = document.createElement('div');
            stageDiv.className = 'evolution-stage';
            stageDiv.dataset.pokemonId = pokemonId; // Store ID for potential click
            stageDiv.innerHTML = `<img src="${DEFAULT_SPRITE}" alt="${speciesName}" loading="lazy"><p>${speciesName}</p>`;
             // Make stage clickable to open that Pokemon's modal
             stageDiv.addEventListener('click', () => {
                 closeModal(); // Close current modal first
                 // Add small delay to allow close animation before opening new
                 setTimeout(() => openModal(pokemonId), 150);
             });

            // Add separator if not the first stage
            if (evolutionStages.length > 0) {
                 const separator = document.createElement('span');
                 separator.className = 'evolution-separator';
                 separator.innerHTML = '▶';
                 evolutionStages.push(separator);
            }
            evolutionStages.push(stageDiv); // Add stage element to the ordered list

            // Prepare promise to fetch sprite (use cache!)
            spriteFetchPromises.push(
                fetchPokemonDetails(pokemonId).then(details => { // Ensure details are fetched/cached
                    const spriteUrl = getPokemonSprite(details, false, true); // Prefer pixelated for evolution chain
                    const imgElement = stageDiv.querySelector('img');
                    if(imgElement) imgElement.src = spriteUrl;
                })
            );

            // Move to the next stage (handles only the first evolution path if branching)
            if (currentStageData.evolves_to.length > 0) {
                currentStageData = currentStageData.evolves_to[0];
                // TODO: Add logic here to handle multiple evolves_to entries for branching display
            } else {
                currentStageData = null; // End of this path
            }
        }

        // Append all stages/separators to the container in order
        evolutionStages.forEach(el => containerElement.appendChild(el));

        // Wait for all sprite fetches to complete (updates placeholders)
        await Promise.all(spriteFetchPromises);
    }

    // --- API Fetching Functions ---

    async function fetchPokemonList(limit, offset) {
        showGridLoader(); // Use new loader func
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=${limit}&offset=${offset}`);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();
            totalPokemonCount = data.count; // Assuming API provides total count

            // Fetch details concurrently for pokemon not already cached
             const detailPromises = data.results.map(p => {
                const id = p.url.split('/').filter(Boolean).pop();
                return currentFetchedDetails[id] ? Promise.resolve(currentFetchedDetails[id]) : fetchPokemonDetails(p.url);
             });

            const pokemonDetailsList = await Promise.all(detailPromises);
            currentPokemonList = pokemonDetailsList.filter(p => p !== null); // Filter out any failed fetches

            // Update cache with newly fetched details
             currentPokemonList.forEach(detail => {
                if (detail && !currentFetchedDetails[detail.id]) {
                     currentFetchedDetails[detail.id] = detail;
                }
             });

            hideGridLoader(); // Use new hide func
            return currentPokemonList;
        } catch (error) {
            console.error("Failed to fetch Pokémon list:", error);
            displayGridError("Could not load Pokédex data. Network issue?"); // Use new error func
            return [];
        }
    }

    async function fetchPokemonDetails(urlOrId) {
         const isUrl = typeof urlOrId === 'string' && urlOrId.startsWith('http');
         const id = isUrl ? urlOrId.split('/').filter(Boolean).pop() : urlOrId;

         // Return from cache if available
        if (currentFetchedDetails[id]) {
             return currentFetchedDetails[id];
         }

         const url = isUrl ? urlOrId : `${POKE_API_BASE}pokemon/${id}`;
         try {
             const response = await fetch(url);
             if (response.status === 404) { console.warn(`Pokémon not found: ${urlOrId}`); return null; }
             if (!response.ok) throw new Error(`Detail fetch failed: ${response.statusText}`);
             const data = await response.json();
             currentFetchedDetails[data.id] = data; // Cache the result
             return data;
         } catch (error) {
             console.error(`Failed to fetch details for ${urlOrId}:`, error);
             // Do not cache failures
             return null;
         }
    }

    async function fetchAllPokemonNames() {
        // Function remains useful for quick search filtering before detailed fetch
        searchInput.placeholder = "Loading names..."; searchInput.disabled = true;
        try {
             // Limit fetch for performance, or fetch all if required (up to ~1300)
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=1300`);
            if (!response.ok) throw new Error(`Failed to fetch names list: ${response.statusText}`);
            const data = await response.json();
            allPokemonNames = data.results; // Store {name, url}
            searchInput.disabled = false; searchInput.placeholder = "Search ID or Name...";
            console.log(`Fetched ${allPokemonNames.length} Pokémon names for search.`);
        } catch (error) {
            console.error("Failed to fetch all Pokémon names:", error);
            searchInput.placeholder = "Search unavailable...";
            // Maybe keep search disabled or allow trying anyway?
        }
    }


    // --- Display Functions ---

    function displayPokemonGrid(pokemonList) {
        pokedexGrid.innerHTML = ''; // Clear previous content/loader
        if (!pokemonList || pokemonList.length === 0) {
            if (searchInput.value.trim() !== '') {
                 pokedexGrid.appendChild(createErrorElement(`No results found for "${searchInput.value}".`));
             } else {
                 // Don't show error if just empty (might be loading initial page)
                 // Show loader maybe? Or handle in loadPage func.
                 console.warn("displayPokemonGrid called with empty list and no search term.");
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        pokemonList.forEach((pokemon, index) => {
            if (!pokemon) return; // Skip if fetch failed for this one

            const card = document.createElement('div');
            card.classList.add('pokemon-card');
            card.dataset.pokemonId = pokemon.id;

            // Use new sprite logic (prefer animated? False for less distracting grid)
            const spriteUrl = getPokemonSprite(pokemon, true, false); // animated = true, pixelated=false (official art)
            const imgClass = spriteUrl.includes('animated') ? 'animated-sprite' : ''; // Add class for specific styling
            const typesHtml = pokemon.types.map(t => `<span class="pokemon-type type-${t.type.name}">${t.type.name}</span>`).join('');

            card.innerHTML = `
                 <img src="${spriteUrl}" class="${imgClass}" alt="${pokemon.name}" loading="lazy">
                 <h3>${pokemon.name}</h3>
                 <p class="pokemon-id">#${String(pokemon.id).padStart(4, '0')}</p>
                 <div class="pokemon-types">${typesHtml}</div>
             `;
            card.style.animationDelay = `${index * 0.04}s`; // Faster stagger
            card.addEventListener('click', () => openModal(pokemon.id));
            fragment.appendChild(card);
        });

        pokedexGrid.appendChild(fragment);
    }

     function displayPagination() {
        paginationContainer.innerHTML = '';
        if (searchInput.value.trim() !== '' || totalPokemonCount <= LIMIT) {
             paginationContainer.style.display = 'none'; return;
        }
         paginationContainer.style.display = 'flex';

        const totalPages = Math.ceil(totalPokemonCount / LIMIT);
        const currentPage = Math.floor(offset / LIMIT) + 1;
        // Keep buttons simple or use icons with tooltips?
        const prevButton = document.createElement('button');
         prevButton.textContent = '< PREV'; prevButton.disabled = offset === 0;
        prevButton.addEventListener('click', () => { offset -= LIMIT; loadPage(); window.scrollTo(0, 0); });

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;

        const nextButton = document.createElement('button');
         nextButton.textContent = 'NEXT >'; nextButton.disabled = (offset + LIMIT) >= totalPokemonCount;
        nextButton.addEventListener('click', () => { offset += LIMIT; loadPage(); window.scrollTo(0, 0); });

        paginationContainer.appendChild(prevButton);
        paginationContainer.appendChild(pageInfo);
        paginationContainer.appendChild(nextButton);
    }


    // --- Modal Functions (Heavily Modified) ---

    async function openModal(pokemonId) {
        // --- Stage 1: Setup & Show Loading ---
        modal.style.display = 'flex'; // Make modal container visible for animations
        if (modalLoader) modalLoader.classList.add('visible'); // Show internal loader
        modalBodyContainer.style.opacity = '0'; // Hide content area while loading
        modalBodyContainer.scrollTop = 0; // Reset scroll

        // Clear previous content *carefully*
        [modalEvolutionContainer, modalLoreContainer, modalStatsContainer, modalAbilitiesContainer, modalActionBtnContainer, modalPokemonNameEl, modalPokemonTypesEl].forEach(el => {if (el) el.innerHTML = '';});
        if (modalImageEl) modalImageEl.src = DEFAULT_SPRITE;
        setBlurredBackground(modalBackgroundLayer, null); // Clear old background immediately


        // --- Stage 2: Fetch Core Data ---
        const pokemon = await fetchPokemonDetails(pokemonId);

        // Handle fetch failure for primary Pokemon
        if (!pokemon) {
            if(modalLoader) modalLoader.classList.remove('visible');
            modalBodyContainer.style.opacity = '1';
            modalPokemonNameEl.innerHTML = `<span class="error-message">Error Loading #${pokemonId}</span>`;
             modalLoreContainer.innerHTML = '<p class="error-message">Could not retrieve data. Please check the ID or network connection.</p>';
            requestAnimationFrame(()=> modal.classList.add('visible')); // Ensure modal itself is visible
            return;
        }

        // --- Stage 3: Fetch Secondary Data (Species/Evolution) ---
        // Fetch concurrently after getting the base data
        const speciesPromise = fetchSpeciesData(pokemon.species.url);
        const evolutionPromise = speciesPromise.then(speciesData => {
             return speciesData ? fetchEvolutionChain(speciesData.evolution_chain.url) : null;
        });
        // Await both secondary fetches
        const [speciesData, evolutionChainData] = await Promise.all([speciesPromise, evolutionPromise]);


        // --- Stage 4: Populate Content ---
        // Get Sprite (Prioritize animated for modal)
        const spriteUrl = getPokemonSprite(pokemon, true, false); // animated=true, pixelated=false
        modalImageEl.src = spriteUrl;
        modalImageEl.alt = pokemon.name;
        modalImageEl.classList.toggle('animated-sprite', spriteUrl.includes('animated'));

        // Set blurred background (Use high-res static if available)
         const bgImageUrl = pokemon.sprites?.other?.['official-artwork']?.front_default || getPokemonSprite(pokemon, false); // Fallback to non-animated default
        setBlurredBackground(modalBackgroundLayer, bgImageUrl);

        // Populate basic info
         modalPokemonNameEl.textContent = `${pokemon.name} #${String(pokemon.id).padStart(4, '0')}`;
         modalPokemonTypesEl.innerHTML = pokemon.types.map(t => `<span class="pokemon-type type-${t.type.name}">${t.type.name}</span>`).join(' ');

         // Populate Lore
         modalLoreContainer.textContent = speciesData ? findEnglishFlavorText(speciesData.flavor_text_entries) : "Description not available.";

         // Populate Abilities
         modalAbilitiesContainer.innerHTML = pokemon.abilities.map(a => {
             const abilityName = a.ability.name.replace('-', ' ');
             const hiddenTag = a.is_hidden ? '<span class="hidden-ability">(HIDDEN)</span>' : '';
             return `<li><span class="ability-name">${abilityName}</span> ${hiddenTag}</li>`;
         }).join('');

        // Populate Stats
        const statsHtml = pokemon.stats.map(s => `
            <div class="stat-item">
                <span class="stat-label">${s.stat.name.replace('-', ' ')}</span>
                <div class="stat-bar-container"><div class="stat-bar" data-value="${s.base_stat}"></div></div>
                <span class="stat-value">${s.base_stat}</span>
            </div>`).join('');
        modalStatsContainer.innerHTML = statsHtml;

        // Populate Comparison Button
        let compareButtonHtml = '';
        const isInCompare1 = pokemonToCompare1?.id === pokemon.id;
        const isInCompare2 = pokemonToCompare2?.id === pokemon.id;
            if (isInCompare1 || isInCompare2) {
                compareButtonHtml = `<button class="modal-action-button" disabled>Selected</button>`;
            } else if (!pokemonToCompare1 || !pokemonToCompare2) {
                 compareButtonHtml = `<button class="modal-action-button add-to-compare-btn" data-pokemon-id="${pokemon.id}">Compare</button>`;
             } else {
                compareButtonHtml = `<button class="modal-action-button" disabled title="Comparison slots full">Compare Full</button>`;
             }
        modalActionBtnContainer.innerHTML = compareButtonHtml;
        const compareBtn = modalActionBtnContainer.querySelector('.add-to-compare-btn');
        if (compareBtn) {
            compareBtn.addEventListener('click', () => handleAddToCompareClick(pokemon));
        }

         // Populate Evolution Chain (async function handles its own sprite loading)
        if (evolutionChainData && modalEvolutionContainer) {
            parseAndDisplayEvolutionChain(evolutionChainData, modalEvolutionContainer);
         } else if (modalEvolutionContainer) {
            modalEvolutionContainer.innerHTML = '<p class="evolution-error">No evolution data found.</p>';
        }


        // --- Stage 5: Reveal Content & Animate ---
         if(modalLoader) modalLoader.classList.remove('visible'); // Hide loader
         modalBodyContainer.style.opacity = '1'; // Fade in content area

         requestAnimationFrame(() => {
             modal.classList.add('visible'); // Trigger main modal visibility animation

             // Animate stat bars shortly after
             setTimeout(() => {
                  modalStatsContainer.querySelectorAll('.stat-bar').forEach(bar => {
                      const value = parseInt(bar.dataset.value, 10);
                      const maxStatValue = 255; // Max possible base stat
                      const percentage = Math.min(Math.max((value / maxStatValue) * 100, 0), 100);
                      bar.style.width = `${percentage}%`;
                  });
             }, 400); // Adjust delay to match modal animation timing
         });
    }


    // --- Comparison Functions ---

     function handleAddToCompareClick(pokemonData) {
         if (pokemonToCompare1?.id === pokemonData.id || pokemonToCompare2?.id === pokemonData.id) return; // Already added

         if (!pokemonToCompare1) {
             pokemonToCompare1 = pokemonData;
         } else if (!pokemonToCompare2) {
             pokemonToCompare2 = pokemonData;
         } else {
            // Maybe flash a message? For now, button is disabled.
            return;
         }

        updateComparisonBar();
        closeModal(); // Close modal after adding

         // If both slots are now full, show the comparison view
         if (pokemonToCompare1 && pokemonToCompare2) {
             // Slight delay to allow modal close animation to start
             setTimeout(showComparisonView, 300);
         }
    }

    function showComparisonView() {
        if (!pokemonToCompare1 || !pokemonToCompare2) return;

         // Set BG using artwork from both? Blend? Use first one? Simple approach: First pokemon.
         const bg1 = pokemonToCompare1.sprites?.other?.['official-artwork']?.front_default;
         setBlurredBackground(comparisonBackgroundLayer, bg1 || getPokemonSprite(pokemonToCompare1));


        const generateCompareHtml = (pokemon) => {
            if (!pokemon) return '<div class="error-message">Pokémon data missing</div>';
             // Use animated sprites in comparison view too?
            const spriteUrl = getPokemonSprite(pokemon, true, false); // animated=true, pixelated=false
            const imgClass = spriteUrl.includes('animated') ? 'animated-sprite' : '';
             const typesHtml = pokemon.types.map(t => `<span class="pokemon-type type-${t.type.name}">${t.type.name}</span>`).join(' ');
             const statsHtml = pokemon.stats.map(s => `
                <div class="stat-item">
                    <span class="stat-label">${s.stat.name.replace('-', ' ')}</span>
                    <div class="stat-bar-container"><div class="stat-bar" data-value="${s.base_stat}"></div></div>
                    <span class="stat-value">${s.base_stat}</span>
                </div>`).join('');
            // Using retro class for name here too
            return `
                 <h2 class="retro-heading-alt">${pokemon.name}</h2>
                 <p class="pokemon-id">#${String(pokemon.id).padStart(4, '0')}</p>
                 <img src="${spriteUrl}" class="${imgClass}" alt="${pokemon.name}" loading="lazy">
                 <div class="pokemon-types">${typesHtml}</div>
                 <h3>// Base Stats</h3>
                 <div class="stats-container">${statsHtml}</div>`;
        };

        comparePokemonDisplay1.innerHTML = generateCompareHtml(pokemonToCompare1);
        comparePokemonDisplay2.innerHTML = generateCompareHtml(pokemonToCompare2);

        comparisonOverlay.style.display = 'flex'; // Make parent visible first

        requestAnimationFrame(() => {
             comparisonOverlay.classList.add('visible'); // Trigger animations

             // Animate stats after overlay animation starts
            setTimeout(() => {
                 const animateBars = (container) => {
                    if (!container) return;
                     container.querySelectorAll('.stat-bar').forEach(bar => {
                        const value = parseInt(bar.dataset.value, 10);
                        bar.style.width = `${Math.min(Math.max((value / 255) * 100, 0), 100)}%`;
                     });
                 }
                 animateBars(comparePokemonDisplay1);
                 animateBars(comparePokemonDisplay2);
            }, 500); // Match main transition duration
        });
    }


    // --- Search Functionality ---

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
             paginationContainer.style.display = 'none'; // Hide pagination during search

             // If search is cleared, reload the current page view
             if (searchTerm === '') { loadPage(); return; }

             showGridLoader(); // Show loader while searching

             // Filter names locally first (faster)
             const filteredPokemonInfo = allPokemonNames.filter(p => {
                 const pokemonId = p.url.split('/').filter(Boolean).pop();
                 return p.name.toLowerCase().includes(searchTerm) || pokemonId === searchTerm;
             });

             if (filteredPokemonInfo.length === 0) {
                 hideGridLoader();
                 displayPokemonGrid([]); // Show no results message via display function
                 return;
            }

             // Fetch details for the filtered results (leveraging cache)
             try {
                 const detailPromises = filteredPokemonInfo.map(p => fetchPokemonDetails(p.url));
                 const searchResults = await Promise.all(detailPromises);
                 const validResults = searchResults.filter(p => p !== null);
                 // Don't update currentPokemonList here, as it conflicts with pagination state
                 // Just display the search results directly. Modal will fetch/cache as needed.
                 hideGridLoader();
                 displayPokemonGrid(validResults);
            } catch (error) {
                 console.error("Error fetching search results:", error);
                 displayGridError("Error during search.");
                 hideGridLoader();
            }
        }, 350); // Debounce search input
    }

    // --- Initialization and Event Listeners ---

    async function loadPage() {
         // This function now mainly orchestrates fetching and displaying for pagination
         // No cache clearing here unless specifically needed for memory management
         const pokemonData = await fetchPokemonList(LIMIT, offset);
         displayPokemonGrid(pokemonData);
         displayPagination(); // displayPagination hides itself if results are empty
    }

    async function initializeApp() {
         showGridLoader();
         // Fetch names first for responsive search
         await fetchAllPokemonNames();
         // Then load the initial page
         await loadPage();
         updateComparisonBar(); // Initialize comparison bar state
         hideGridLoader(); // Hide loader after initial load
     }

    // --- Attach Event Listeners ---
    searchInput.addEventListener('input', handleSearch);
    closeModalButton.addEventListener('click', closeModal);

     // Close modal by clicking outside content or pressing Escape
    modal.addEventListener('click', (e) => {
        // Check if the click is directly on the modal backdrop, not the content
        if (e.target === modal) { closeModal(); }
     });
     window.addEventListener('keydown', (e) => {
         if (e.key === 'Escape') {
             if (modal.classList.contains('visible')) closeModal();
             else if (comparisonOverlay.classList.contains('visible')) hideComparisonView();
         }
     });

    // Comparison listeners
    clearComparisonBtn.addEventListener('click', resetComparison);
    closeComparisonOverlayBtn.addEventListener('click', hideComparisonView);
     comparisonOverlay.addEventListener('click', (e) => {
         if (e.target === comparisonOverlay) hideComparisonView();
    });

    // --- Start the App ---
    initializeApp();
});
