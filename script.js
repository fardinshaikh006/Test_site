document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const pokedexGrid = document.getElementById('pokedex-grid');
    const searchInput = document.getElementById('searchInput');
    const paginationContainer = document.getElementById('pagination');
    const modal = document.getElementById('pokemonDetailModal');
    const modalContent = modal.querySelector('.modal-content'); // Select modal content for animation
    const modalBody = document.getElementById('modalBody');
    const closeModalButton = document.querySelector('.close-button');
    const loaderTemplate = `<div class="loader">Initializing Datastream...</div>`; // Updated loader text

    // --- API and State Variables ---
    const POKE_API_BASE = 'https://pokeapi.co/api/v2/';
    const LIMIT = 30;
    let offset = 0;
    let totalPokemonCount = 0;
    let allPokemonNames = [];
    let currentPokemonList = [];
    let searchTimeout;

    // --- Helper Functions ---

    /** Creates a standard error message element */
    function createErrorElement(message) {
        const errorDiv = document.createElement('div');
        // Removed cyberpunk-panel class as error styling is handled by text color/shadow
        errorDiv.className = 'error-message loader'; // Re-use loader styles for similar appearance
        errorDiv.textContent = message;
        errorDiv.style.animation = 'none'; // Prevent pulsing on error messages
        errorDiv.style.color = 'var(--accent-secondary)'; // Use violet for errors
        return errorDiv;
    }

    /** Displays the loading indicator */
    function showLoader() {
        pokedexGrid.innerHTML = loaderTemplate;
        paginationContainer.style.display = 'none';
    }

    /** Hides the loading indicator */
    function hideLoader() {
        const loaderElement = pokedexGrid.querySelector('.loader');
        if (loaderElement) {
            loaderElement.remove();
        }
        if (totalPokemonCount > 0 || currentPokemonList.length > 0) {
            paginationContainer.style.display = 'flex';
        }
    }

    /** Displays an error message in the grid area */
    function displayError(message) {
        pokedexGrid.innerHTML = '';
        pokedexGrid.appendChild(createErrorElement(message));
        paginationContainer.style.display = 'none';
    }

    // --- API Fetching Functions --- (Identical to previous correct version)

    async function fetchPokemonList(limit, offset) {
        showLoader();
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=${limit}&offset=${offset}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            totalPokemonCount = data.count;

            const pokemonPromises = data.results.map(p => fetchPokemonDetails(p.url));
            const detailedPokemonList = await Promise.all(pokemonPromises);
            currentPokemonList = detailedPokemonList.filter(p => p !== null);

            hideLoader();
            return currentPokemonList;

        } catch (error) {
            console.error("Failed to fetch Pokémon list:", error);
            displayError("Could not load Pokémon data. Network issue or API down?");
            return [];
        }
    }

    async function fetchPokemonDetails(identifier) {
        const url = typeof identifier === 'string' && identifier.startsWith('http')
            ? identifier
            : `${POKE_API_BASE}pokemon/${identifier}`;
        try {
            const response = await fetch(url);
            if (response.status === 404) {
                 console.warn(`Pokémon not found at ${url}`);
                 return null;
            }
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Failed to fetch details for ${identifier}:`, error);
            return null;
        }
    }

    async function fetchAllPokemonNames() {
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=10000`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            allPokemonNames = data.results;
            console.log(`Fetched ${allPokemonNames.length} Pokémon names for search.`);
             searchInput.disabled = false;
             searchInput.placeholder = "Search ID or Name...";

        } catch (error) {
            console.error("Failed to fetch all Pokémon names:", error);
            searchInput.placeholder = "Search unavailable...";
            searchInput.disabled = true;
        }
    }

    // --- Display Functions --- (Identical to previous correct version)

    function displayPokemonGrid(pokemonList) {
        pokedexGrid.innerHTML = '';

        if (!pokemonList || pokemonList.length === 0) {
            if (searchInput.value.trim() !== '') {
                 pokedexGrid.appendChild(createErrorElement(`No results for "${searchInput.value}".`));
             } else if (totalPokemonCount > 0) {
                 pokedexGrid.appendChild(createErrorElement("Failed to display Pokémon."));
             }
            return;
        }

        const fragment = document.createDocumentFragment();
        pokemonList.forEach(pokemon => {
            if (!pokemon) return;

            const card = document.createElement('div');
            card.classList.add('pokemon-card');
            card.dataset.pokemonId = pokemon.id;

            const spriteUrl = pokemon.sprites?.front_default || 'assets/placeholder.png';

            const typesHtml = pokemon.types.map(typeInfo =>
                `<span class="pokemon-type type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
            ).join('');

            card.innerHTML = `
                <img src="${spriteUrl}" alt="${pokemon.name}" loading="lazy">
                <p class="pokemon-id">#${String(pokemon.id).padStart(3, '0')}</p>
                <h3>${pokemon.name}</h3>
                <div class="pokemon-types">
                    ${typesHtml}
                </div>
            `;
            card.addEventListener('click', () => openModal(pokemon.id));
            fragment.appendChild(card);
        });
        pokedexGrid.appendChild(fragment);
    }

    function displayPagination() {
        paginationContainer.innerHTML = '';
         if (searchInput.value.trim() !== '' || totalPokemonCount <= LIMIT) {
            paginationContainer.style.display = 'none';
            return;
         } else {
            paginationContainer.style.display = 'flex';
         }


        const totalPages = Math.ceil(totalPokemonCount / LIMIT);
        const currentPage = Math.floor(offset / LIMIT) + 1;

        const prevButton = document.createElement('button');
        prevButton.textContent = '<< Prev';
        prevButton.disabled = offset === 0;
        prevButton.addEventListener('click', () => {
            offset -= LIMIT;
            loadPage();
             window.scrollTo(0, 0); // Scroll top on page change
        });
        paginationContainer.appendChild(prevButton);

        const pageInfo = document.createElement('span');
        pageInfo.textContent = `Page ${currentPage} of ${totalPages > 0 ? totalPages : 1}`;
        paginationContainer.appendChild(pageInfo);

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next >>';
        nextButton.disabled = offset + LIMIT >= totalPokemonCount;
        nextButton.addEventListener('click', () => {
            offset += LIMIT;
            loadPage();
            window.scrollTo(0, 0); // Scroll top on page change
        });
        paginationContainer.appendChild(nextButton);
    }


    // --- Modal Functions ---

    /** Fetches data if needed and displays the Pokémon details modal */
    async function openModal(pokemonId) {
        let pokemon = currentPokemonList.find(p => p && p.id === pokemonId);

        modal.style.display = 'block';
        // Clear previous content and show loader immediately
        modalBody.innerHTML = `<div class="loader" style="grid-column: 1 / -1;">Loading Details...</div>`;


        if (!pokemon) {
            pokemon = await fetchPokemonDetails(pokemonId);
        }

        if (!pokemon) {
             modalBody.innerHTML = ''; // Clear loader
            modalBody.appendChild(createErrorElement("Could not load details."));
            return;
        }

        // --- Build Modal Content (matches new CSS structure) ---
        const officialArt = pokemon.sprites?.other?.['official-artwork']?.front_default;
        const defaultSprite = pokemon.sprites?.front_default;
        const imageUrl = officialArt || defaultSprite || 'assets/placeholder.png';

        const typesHtml = pokemon.types.map(typeInfo =>
            `<span class="pokemon-type type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
        ).join(' ');

        const abilitiesHtml = pokemon.abilities.map(abilityInfo => {
            const abilityName = abilityInfo.ability.name.replace('-', ' ');
            const hiddenTag = abilityInfo.is_hidden ? '<span class="hidden-ability">(Hidden)</span>' : '';
            return `<li>${abilityName} ${hiddenTag}</li>`;
        }).join('');

        // Format stats matching the new grid layout in CSS
        const statsHtml = pokemon.stats.map(statInfo => `
            <div class="stat-item">
                <span class="stat-label">${statInfo.stat.name.replace('-', ' ')}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar" style="width: 0%;" data-value="${statInfo.base_stat}"></div>
                </div>
                <span class="stat-value">${statInfo.base_stat}</span>
            </div>
        `).join('');


        // Update modalBody HTML structure
        modalBody.innerHTML = `
            <h2 style="grid-column: 1 / -1;">${pokemon.name} (#${String(pokemon.id).padStart(3, '0')})</h2>

            <div class="modal-image-container" style="text-align: center;"> <!-- Wrapper for image -->
                 <img src="${imageUrl}" alt="${pokemon.name}">
            </div>

            <div class="pokemon-details-section"> <!-- Section for text details -->
                 <h3>Info</h3>
                 <p><strong>Types:</strong> <span>${typesHtml}</span></p>
                 <p><strong>Height:</strong> <span>${pokemon.height / 10} m</span></p>
                 <p><strong>Weight:</strong> <span>${pokemon.weight / 10} kg</span></p>

                 <h3>Abilities</h3>
                 <ul>${abilitiesHtml}</ul>

                 <h3>Base Stats</h3>
                 <div class="stats-container">
                     ${statsHtml}
                 </div>
                 <!-- TODO: Add Evolution Chain, Flavor Text etc. -->
            </div>
        `;

        // Trigger stat bar animation AFTER content is rendered
        requestAnimationFrame(() => {
             const statBars = modalBody.querySelectorAll('.stat-bar');
             statBars.forEach(bar => {
                 const value = parseInt(bar.dataset.value, 10);
                 const maxStat = 255; // Common assumption for max base stat
                 const percentage = Math.min((value / maxStat) * 100, 100);
                 bar.style.width = `${percentage}%`;
             });
         });
    }

    /** Closes the Pokémon details modal */
    function closeModal() {
        modal.style.animation = 'fadeOut 0.4s ease forwards';
        if(modalContent) { // Check if modalContent exists
             modalContent.style.animation = 'slideOut 0.4s ease forwards';
        }

        setTimeout(() => {
            modal.style.display = 'none';
            modalBody.innerHTML = ''; // Clear content
            // Reset animations
            modal.style.animation = '';
             if(modalContent) {
                modalContent.style.animation = '';
             }
        }, 400); // Match animation duration
    }


    // --- Search Functionality --- (Identical to previous correct version)

    function handleSearch() {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(async () => {
            const searchTerm = searchInput.value.toLowerCase().trim();

            if (searchTerm === '') {
                offset = 0;
                loadPage();
                return;
            }

            showLoader();
            paginationContainer.style.display = 'none';

            // Include ID search (extracting ID from URL reliably)
            const filteredPokemonInfo = allPokemonNames.filter(p => {
                 const pokemonId = p.url.split('/').filter(Boolean).pop(); // Gets last part of URL path
                 return p.name.toLowerCase().includes(searchTerm) || pokemonId === searchTerm;
            });


            if (filteredPokemonInfo.length === 0) {
                hideLoader();
                displayPokemonGrid([]); // Show no results message
                return;
            }

            try {
                // Consider limiting simultaneous fetches for large search results if needed
                // const MAX_SEARCH_RESULTS = 50;
                // const resultsToFetch = filteredPokemonInfo.slice(0, MAX_SEARCH_RESULTS);
                // const pokemonPromises = resultsToFetch.map(p => fetchPokemonDetails(p.url));
                const pokemonPromises = filteredPokemonInfo.map(p => fetchPokemonDetails(p.url));


                const searchResults = await Promise.all(pokemonPromises);
                currentPokemonList = searchResults.filter(p => p !== null);

                hideLoader();
                displayPokemonGrid(currentPokemonList);

            } catch (error) {
                console.error("Error fetching search results:", error);
                displayError("Error performing search.");
                 hideLoader();
            }
        }, 350); // Slightly longer debounce
    }

    // --- Initialization and Event Listeners ---

    /** Loads the current page of Pokémon */
    async function loadPage() {
        const pokemonData = await fetchPokemonList(LIMIT, offset);
        if (pokemonData.length > 0 || offset === 0) {
            displayPokemonGrid(pokemonData);
            displayPagination();
        }
    }

    /** Initializes the Pokedex application */
    async function initializeApp() {
        showLoader();
        await fetchAllPokemonNames();
        await loadPage();
    }

    // --- Attach Event Listeners ---
    searchInput.addEventListener('input', handleSearch);
    closeModalButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        // Close if clicking directly on the modal overlay (background)
        if (event.target === modal) {
            closeModal();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    // --- Start the App ---
    initializeApp();
});