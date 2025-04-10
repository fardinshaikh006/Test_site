document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const pokedexGrid = document.getElementById('pokedex-grid');
    const searchInput = document.getElementById('searchInput');
    const paginationContainer = document.getElementById('pagination');
    const modal = document.getElementById('pokemonDetailModal');
    const modalBody = document.getElementById('modalBody');
    const closeModalButton = document.querySelector('.close-button');
    const loaderTemplate = `<div class="loader">Loading Cyber-Specimens...</div>`; // Template for loader

    // --- API and State Variables ---
    const POKE_API_BASE = 'https://pokeapi.co/api/v2/';
    const LIMIT = 30; // Pokémon per page
    let offset = 0; // Current starting point for fetching
    let totalPokemonCount = 0; // Total number of Pokémon available from API
    let allPokemonNames = []; // Stores {name, url} for all Pokémon (for search)
    let currentPokemonList = []; // Stores detailed data for currently displayed Pokémon
    let searchTimeout; // For debouncing search input

    // --- Helper Functions ---

    /** Creates a standard error message element */
    function createErrorElement(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message cyberpunk-panel'; // Use cyberpunk panel style for errors
        errorDiv.textContent = message;
        return errorDiv;
    }

    /** Displays the loading indicator */
    function showLoader() {
        pokedexGrid.innerHTML = loaderTemplate; // Clear grid and show loader
        paginationContainer.style.display = 'none'; // Hide pagination
    }

    /** Hides the loading indicator */
    function hideLoader() {
        const loaderElement = pokedexGrid.querySelector('.loader');
        if (loaderElement) {
            loaderElement.remove();
        }
        // Only show pagination if there's content or potential content
        if (totalPokemonCount > 0 || currentPokemonList.length > 0) {
             paginationContainer.style.display = 'flex';
        }
    }

    /** Displays an error message in the grid area */
    function displayError(message) {
        pokedexGrid.innerHTML = ''; // Clear previous content/loader
        pokedexGrid.appendChild(createErrorElement(message));
        paginationContainer.style.display = 'none'; // Hide pagination on error
    }

    // --- API Fetching Functions ---

    /** Fetches a list of Pokémon names and URLs */
    async function fetchPokemonList(limit, offset) {
        showLoader();
        try {
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=${limit}&offset=${offset}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            totalPokemonCount = data.count; // Update total count

            // Fetch detailed data for each Pokémon in the list
            const pokemonPromises = data.results.map(p => fetchPokemonDetails(p.url));
            const detailedPokemonList = await Promise.all(pokemonPromises);

            // Filter out any null results from failed individual fetches
            currentPokemonList = detailedPokemonList.filter(p => p !== null);

            hideLoader();
            return currentPokemonList;

        } catch (error) {
            console.error("Failed to fetch Pokémon list:", error);
            displayError("Could not load Pokémon data. Network issue or API down?");
            // No need to hideLoader here, displayError clears the grid
            return []; // Return empty array on failure
        }
    }

    /** Fetches detailed data for a single Pokémon by URL or ID/Name */
    async function fetchPokemonDetails(identifier) {
        const url = typeof identifier === 'string' && identifier.startsWith('http')
            ? identifier
            : `${POKE_API_BASE}pokemon/${identifier}`;
        try {
            const response = await fetch(url);
            // Handle 404 Not Found specifically
            if (response.status === 404) {
                 console.warn(`Pokémon not found at ${url}`);
                 return null; // Indicate not found
            }
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            return data; // Returns detailed data
        } catch (error) {
            console.error(`Failed to fetch details for ${identifier}:`, error);
            // Don't display a major error here, as it might be one failed fetch among many
            return null; // Return null if a single fetch fails
        }
    }

    /** Fetches all Pokémon names and URLs for the search functionality */
    async function fetchAllPokemonNames() {
        try {
            // Fetch a large limit to get most/all Pokémon names+URLs at once
            const response = await fetch(`${POKE_API_BASE}pokemon?limit=10000`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            allPokemonNames = data.results;
            console.log(`Fetched ${allPokemonNames.length} Pokémon names for search.`);
        } catch (error) {
            console.error("Failed to fetch all Pokémon names:", error);
            // Display a non-blocking warning, search might be impaired
             searchInput.placeholder = "Search unavailable...";
             searchInput.disabled = true;
        }
    }

    // --- Display Functions ---

    /** Renders the grid of Pokémon cards */
    function displayPokemonGrid(pokemonList) {
        pokedexGrid.innerHTML = ''; // Clear previous grid or loader/error

        if (!pokemonList || pokemonList.length === 0) {
            // Check if search input has value to differentiate between "no results" and initial empty state
             if (searchInput.value.trim() !== '') {
                 pokedexGrid.appendChild(createErrorElement(`No Pokémon found matching "${searchInput.value}".`));
             } else if (totalPokemonCount > 0) {
                // This case might occur if all fetches in a page failed, unlikely but possible
                 pokedexGrid.appendChild(createErrorElement("Failed to display Pokémon on this page."));
             } else {
                 // Initial load state before total count is known, or actual error
                 // The loader or error from fetchPokemonList should handle this
             }
            return;
        }

        const fragment = document.createDocumentFragment(); // Use fragment for performance
        pokemonList.forEach(pokemon => {
            if (!pokemon) return; // Skip if fetch failed for this one

            const card = document.createElement('div');
            card.classList.add('pokemon-card');
            card.dataset.pokemonId = pokemon.id; // Store ID for modal lookup

            // Safely access sprite, provide fallback
            const spriteUrl = pokemon.sprites?.front_default || 'assets/placeholder.png'; // Ensure you have a placeholder image

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

    /** Renders pagination controls */
    function displayPagination() {
        paginationContainer.innerHTML = '';
        if (totalPokemonCount <= LIMIT && searchInput.value.trim() === '') return; // No pagination if only one page and not searching

         // Don't show pagination if search is active and returned results
         if (searchInput.value.trim() !== '') {
            paginationContainer.style.display = 'none';
            return;
         } else {
            paginationContainer.style.display = 'flex';
         }


        const totalPages = Math.ceil(totalPokemonCount / LIMIT);
        const currentPage = Math.floor(offset / LIMIT) + 1;

        // Previous Button
        const prevButton = document.createElement('button');
        prevButton.textContent = '<< Prev';
        prevButton.disabled = offset === 0;
        prevButton.addEventListener('click', () => {
            offset -= LIMIT;
            loadPage();
        });
        paginationContainer.appendChild(prevButton);

        // Page Info
        const pageInfo = document.createElement('span');
        // Handle potential NaN if totalPokemonCount is 0 initially
        pageInfo.textContent = `Page ${currentPage} of ${totalPages > 0 ? totalPages : 1}`;
        paginationContainer.appendChild(pageInfo);

        // Next Button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next >>';
        nextButton.disabled = offset + LIMIT >= totalPokemonCount;
        nextButton.addEventListener('click', () => {
            offset += LIMIT;
            loadPage();
        });
        paginationContainer.appendChild(nextButton);
    }

    // --- Modal Functions ---

    /** Fetches data if needed and displays the Pokémon details modal */
    async function openModal(pokemonId) {
        // Try to find the Pokémon data in the currently displayed list first
        let pokemon = currentPokemonList.find(p => p && p.id === pokemonId);

        modal.style.display = 'block'; // Show modal container immediately
        modalBody.innerHTML = loaderTemplate; // Show loader inside modal

        // If not found in current list (e.g., from search result), fetch it directly
        if (!pokemon) {
            pokemon = await fetchPokemonDetails(pokemonId);
        }

        // If still no Pokémon data (fetch failed or invalid ID)
        if (!pokemon) {
            modalBody.innerHTML = ''; // Clear loader
            modalBody.appendChild(createErrorElement("Could not load details for this Pokémon."));
            return;
        }

        // --- Build Modal Content ---
        const officialArt = pokemon.sprites?.other?.['official-artwork']?.front_default;
        const defaultSprite = pokemon.sprites?.front_default;
        const imageUrl = officialArt || defaultSprite || 'assets/placeholder.png';

        const typesHtml = pokemon.types.map(typeInfo =>
            `<span class="pokemon-type type-${typeInfo.type.name}">${typeInfo.type.name}</span>`
        ).join(' '); // Space separated for inline display

        const abilitiesHtml = pokemon.abilities.map(abilityInfo =>
            `<li>${abilityInfo.ability.name.replace('-', ' ')} ${abilityInfo.is_hidden ? '<span class="hidden-ability">(Hidden)</span>' : ''}</li>`
        ).join('');

        const statsHtml = pokemon.stats.map(statInfo => `
            <div class="stat-item">
                <span class="stat-label">${statInfo.stat.name.replace('-', ' ')}</span>
                <div class="stat-bar-container">
                    <div class="stat-bar" style="width: 0%;" data-value="${statInfo.base_stat}">
                         <span class="stat-value">${statInfo.base_stat}</span>
                    </div>
                </div>
            </div>
        `).join('');

        modalBody.innerHTML = `
            <h2>${pokemon.name} (#${String(pokemon.id).padStart(3, '0')})</h2>
            <div class="modal-image-container">
                 <img src="${imageUrl}" alt="${pokemon.name}">
            </div>
            <div class="pokemon-details-section">
                 <h3>Info</h3>
                 <p><strong>Types:</strong> ${typesHtml}</p>
                 <p><strong>Height:</strong> ${pokemon.height / 10} m</p>
                 <p><strong>Weight:</strong> ${pokemon.weight / 10} kg</p>

                 <h3>Abilities</h3>
                 <ul>${abilitiesHtml}</ul>

                 <h3>Base Stats</h3>
                 <div class="stats-container">
                     ${statsHtml}
                 </div>
                 <!-- TODO: Add Evolution Chain, Flavor Text etc. here -->
            </div>
        `;

        // Animate stat bars after content is rendered
        requestAnimationFrame(() => {
             const statBars = modalBody.querySelectorAll('.stat-bar');
             statBars.forEach(bar => {
                 const value = parseInt(bar.dataset.value, 10);
                 // Assuming max base stat around 255 for percentage calculation
                 const percentage = Math.min((value / 255) * 100, 100);
                 bar.style.width = `${percentage}%`;
             });
         });
    }

    /** Closes the Pokémon details modal */
    function closeModal() {
        modal.style.animation = 'fadeOut 0.4s ease forwards'; // Add fadeOut animation if defined in CSS
        modal.querySelector('.modal-content').style.animation = 'slideOut 0.4s ease forwards'; // Add slideOut if defined

        // Wait for animation to finish before hiding and clearing
        setTimeout(() => {
            modal.style.display = 'none';
            modalBody.innerHTML = ''; // Clear content
            // Reset animations so they can play again next time
            modal.style.animation = '';
            modal.querySelector('.modal-content').style.animation = '';
        }, 400); // Match animation duration
    }

    // --- Search Functionality ---

    /** Handles input in the search bar with debouncing */
    function handleSearch() {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(async () => {
            const searchTerm = searchInput.value.toLowerCase().trim();

            if (searchTerm === '') {
                // If search is cleared, reset offset and load the first page
                offset = 0;
                loadPage(); // This will fetch, display grid, and display pagination
                return;
            }

            showLoader(); // Show loader while searching
            paginationContainer.style.display = 'none'; // Hide pagination during search

            // Filter the full list of names/URLs (case-insensitive)
            const filteredPokemonInfo = allPokemonNames.filter(p =>
                p.name.toLowerCase().includes(searchTerm) || String(p.url.split('/').slice(-2)[0]).includes(searchTerm) // Allow searching by ID too
            );


            if (filteredPokemonInfo.length === 0) {
                 hideLoader();
                displayPokemonGrid([]); // Pass empty array to show "No Pokémon found" message
                return;
            }

            // Fetch details ONLY for the filtered Pokémon
            try {
                // Limit number of search results fetched at once if necessary
                // const limitedResults = filteredPokemonInfo.slice(0, 50); // Example limit
                const pokemonPromises = filteredPokemonInfo.map(p => fetchPokemonDetails(p.url));

                const searchResults = await Promise.all(pokemonPromises);
                currentPokemonList = searchResults.filter(p => p !== null); // Update current list

                hideLoader();
                displayPokemonGrid(currentPokemonList);
                // Keep pagination hidden for search results
            } catch (error) {
                console.error("Error fetching search results:", error);
                displayError("Error performing search.");
                 hideLoader();
            }
        }, 300); // Debounce time in milliseconds (e.g., 300ms)
    }


    // --- Initialization and Event Listeners ---

    /** Loads the current page of Pokémon */
    async function loadPage() {
        const pokemonData = await fetchPokemonList(LIMIT, offset);
        // fetchPokemonList handles showing loader and errors internally
        if (pokemonData.length > 0 || offset === 0) { // Display grid even if empty on first load attempt
             displayPokemonGrid(pokemonData);
             displayPagination(); // Display pagination based on total count
        }
        // If fetchPokemonList failed, an error message is already shown.
    }

    /** Initializes the Pokedex application */
    async function initializeApp() {
        showLoader(); // Show loader immediately
        await fetchAllPokemonNames(); // Fetch names for search first
        await loadPage();          // Load the initial page of Pokémon
        // Initial load might have errors handled by loadPage/fetchPokemonList
    }

    // --- Attach Event Listeners ---
    searchInput.addEventListener('input', handleSearch);
    closeModalButton.addEventListener('click', closeModal);

    // Close modal if clicking on the background overlay
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Check if the click was directly on the modal background
            closeModal();
        }
    });

    // Close modal with the Escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    // --- Start the App ---
    initializeApp();

});