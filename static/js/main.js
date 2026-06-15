// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let state = {
    releases: [],
    selectedIds: new Set(),
    filters: {
        search: '',
        type: 'all',
        sort: 'newest'
    },
    currentTweetSource: {
        type: 'single', // 'single' or 'bulk'
        ids: []
    }
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const DOM = {
    btnRefresh: document.getElementById('btnRefresh'),
    refreshIcon: document.getElementById('refreshIcon'),
    syncStatus: document.getElementById('syncStatus'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    typeFilters: document.getElementById('typeFilters'),
    sortOrder: document.getElementById('sortOrder'),
    releasesList: document.getElementById('releasesList'),
    skeletonLoader: document.getElementById('skeletonLoader'),
    emptyState: document.getElementById('emptyState'),
    btnResetFilters: document.getElementById('btnResetFilters'),
    
    // Selection Banner
    selectionBanner: document.getElementById('selectionBanner'),
    selectedCountText: document.getElementById('selectedCountText'),
    selectedCountBadge: document.getElementById('selectedCountBadge'),
    btnCancelSelection: document.getElementById('btnCancelSelection'),
    btnTweetSelected: document.getElementById('btnTweetSelected'),
    
    // Tweet Modal
    tweetModal: document.getElementById('tweetModal'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelTweet: document.getElementById('btnCancelTweet'),
    btnPostTweet: document.getElementById('btnPostTweet'),
    tweetTextarea: document.getElementById('tweetTextarea'),
    charCounter: document.getElementById('charCounter'),
    optIncludeLink: document.getElementById('optIncludeLink'),
    optIncludeHashtags: document.getElementById('optIncludeHashtags'),
    mockTweetText: document.getElementById('mockTweetText'),
    mockCardPreview: document.getElementById('mockCardPreview'),
    
    // Toast Container
    toastContainer: document.getElementById('toastContainer')
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchReleases();
});

// ==========================================================================
// EVENT LISTENERS Setup
// ==========================================================================
function setupEventListeners() {
    // Refresh Button
    DOM.btnRefresh.addEventListener('click', () => {
        fetchReleases(true);
    });

    // Search Input with Debounce & Clear
    DOM.searchInput.addEventListener('input', debounce((e) => {
        state.filters.search = e.target.value.trim().toLowerCase();
        DOM.btnClearSearch.style.display = state.filters.search ? 'block' : 'none';
        renderReleases();
    }, 250));

    DOM.btnClearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.filters.search = '';
        DOM.btnClearSearch.style.display = 'none';
        renderReleases();
    });

    // Category Filter Pills
    DOM.typeFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Toggle Active Class
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');

        // Apply Filter
        state.filters.type = pill.dataset.type;
        renderReleases();
    });

    // Sort Order Selection
    DOM.sortOrder.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        renderReleases();
    });

    // Reset Filters Empty State Button
    DOM.btnResetFilters.addEventListener('click', resetFilters);

    // Selection Banner Actions
    DOM.btnCancelSelection.addEventListener('click', clearSelection);
    DOM.btnTweetSelected.addEventListener('click', () => {
        openTweetComposer('bulk', Array.from(state.selectedIds));
    });

    // Modal Events
    DOM.btnCloseModal.addEventListener('click', closeTweetModal);
    DOM.btnCancelTweet.addEventListener('click', closeTweetModal);
    DOM.btnPostTweet.addEventListener('click', shareOnTwitter);
    
    DOM.optIncludeLink.addEventListener('change', regenerateTweetText);
    DOM.optIncludeHashtags.addEventListener('change', regenerateTweetText);
    DOM.tweetTextarea.addEventListener('input', handleTextareaInput);

    // Close Modal on Backdrop Click
    DOM.tweetModal.addEventListener('click', (e) => {
        if (e.target === DOM.tweetModal) {
            closeTweetModal();
        }
    });
}

// ==========================================================================
// API CALLS (FETCHING DATA)
// ==========================================================================
async function fetchReleases(forceRefresh = false) {
    showLoading(true);
    updateSyncStatus('loading', forceRefresh ? 'Fetching fresh notes...' : 'Loading feed...');

    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            state.releases = data.releases;
            state.selectedIds.clear();
            updateSelectionBanner();
            
            // Format Last Synced Display
            const timeText = data.last_fetched ? `Last synced: ${formatSyncTime(data.last_fetched)}` : 'Synced';
            const sourceText = data.source === 'cache' ? ' (Cached)' : '';
            updateSyncStatus('success', `${timeText}${sourceText}`);
            
            if (forceRefresh) {
                showToast('Release notes successfully updated!', 'success');
            }
        } else {
            throw new Error(data.error || 'Unknown error occurred while parsing the feed.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        updateSyncStatus('error', 'Sync failed');
        showToast(`Error updating feed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
        renderReleases();
    }
}

// ==========================================================================
// RENDERING & FILTERING
// ==========================================================================
function renderReleases() {
    DOM.releasesList.innerHTML = '';
    
    // 1. Filter releases
    let filtered = state.releases.filter(item => {
        // Search Filter
        const matchesSearch = !state.filters.search || 
            item.title.toLowerCase().includes(state.filters.search) ||
            item.type.toLowerCase().includes(state.filters.search) ||
            item.content.toLowerCase().includes(state.filters.search);
        
        // Category Type Filter
        let matchesType = true;
        if (state.filters.type !== 'all') {
            if (state.filters.type === 'other') {
                matchesType = !['feature', 'deprecation', 'resolved', 'changed'].includes(item.type.toLowerCase());
            } else {
                matchesType = item.type.toLowerCase() === state.filters.type;
            }
        }

        return matchesSearch && matchesType;
    });

    // 2. Sort releases
    filtered.sort((a, b) => {
        const dateA = a.updated ? new Date(a.updated) : new Date(a.date);
        const dateB = b.updated ? new Date(b.updated) : new Date(b.date);
        
        if (state.filters.sort === 'newest') {
            return dateB - dateA;
        } else {
            return dateA - dateB;
        }
    });

    // 3. Toggle Empty State
    if (filtered.length === 0) {
        DOM.emptyState.style.display = 'block';
        DOM.releasesList.style.display = 'none';
        return;
    } else {
        DOM.emptyState.style.display = 'none';
        DOM.releasesList.style.display = 'flex';
    }

    // 4. Create Card Elements
    filtered.forEach(item => {
        const card = createCardElement(item);
        DOM.releasesList.appendChild(card);
    });
}

function createCardElement(item) {
    const card = document.createElement('div');
    card.className = `release-card ${state.selectedIds.has(item.id) ? 'selected' : ''}`;
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-type', item.type);

    // Escape or handle HTML content carefully. GCP content is trusted HTML, render via innerHTML
    const cleanContent = sanitizeHTML(item.content);

    card.innerHTML = `
        <div class="card-header-row">
            <div class="card-header-left">
                <div class="card-checkbox" title="Select this update to tweet">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div class="card-badges">
                    <span class="badge badge-date">${item.date}</span>
                    <span class="badge badge-type" data-type="${item.type}">${item.type}</span>
                </div>
            </div>
            <div class="card-header-right">
                <!-- Action to tweet immediately -->
            </div>
        </div>
        <div class="card-body">
            ${cleanContent}
        </div>
        <div class="card-footer-actions">
            <button class="card-btn card-btn-copy" data-action="copy" title="Copy update content to clipboard">
                <i class="fa-regular fa-copy"></i> Copy Note
            </button>
            <button class="card-btn card-btn-tweet" data-action="tweet" title="Compose a Tweet about this update">
                <i class="fa-brands fa-x-twitter"></i> Tweet Note
            </button>
        </div>
    `;

    // Click Event Handler
    card.addEventListener('click', (e) => {
        // Prevent trigger if clicking an interactive element
        const target = e.target;
        if (
            target.closest('a') || 
            target.closest('.card-btn') || 
            window.getSelection().toString() // don't toggle if selecting text
        ) {
            return;
        }
        
        toggleCardSelection(item.id, card);
    });

    // Button event listeners inside card
    card.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
        e.stopPropagation();
        copyCardContent(item);
    });

    card.querySelector('[data-action="tweet"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openTweetComposer('single', [item.id]);
    });

    return card;
}

// Toggle Selection State
function toggleCardSelection(id, cardElement) {
    if (state.selectedIds.has(id)) {
        state.selectedIds.delete(id);
        cardElement.classList.remove('selected');
    } else {
        state.selectedIds.add(id);
        cardElement.classList.add('selected');
    }
    updateSelectionBanner();
}

function updateSelectionBanner() {
    const count = state.selectedIds.size;
    if (count > 0) {
        DOM.selectedCountText.innerText = count;
        DOM.selectedCountBadge.innerText = count;
        DOM.selectionBanner.classList.add('show');
    } else {
        DOM.selectionBanner.classList.remove('show');
    }
}

function clearSelection() {
    state.selectedIds.clear();
    updateSelectionBanner();
    document.querySelectorAll('.release-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
    showToast('Selection cleared', 'success');
}

// ==========================================================================
// TWEET COMPOSER MODAL LOGIC
// ==========================================================================
function openTweetComposer(sourceType, ids) {
    state.currentTweetSource.type = sourceType;
    state.currentTweetSource.ids = ids;
    
    // Set checkboxes to default state
    DOM.optIncludeLink.checked = true;
    DOM.optIncludeHashtags.checked = true;

    regenerateTweetText();
    
    // Open Modal
    DOM.tweetModal.classList.add('show');
}

function closeTweetModal() {
    DOM.tweetModal.classList.remove('show');
}

function regenerateTweetText() {
    const ids = state.currentTweetSource.ids;
    const includeLink = DOM.optIncludeLink.checked;
    const includeHashtags = DOM.optIncludeHashtags.checked;
    
    const items = state.releases.filter(r => ids.includes(r.id));
    if (items.length === 0) return;

    let tweetText = '';
    const linkSuffix = includeLink ? '\n\nRead details: https://cloud.google.com/bigquery/docs/release-notes' : '';
    const hashtagsSuffix = includeHashtags ? '\n\n#BigQuery #GoogleCloud #DataEngineering' : '';
    
    if (state.currentTweetSource.type === 'single') {
        const item = items[0];
        // Clean text snippet from HTML content
        const textSnippet = extractTextFromHTML(item.content);
        
        // Base tweet construction
        const prefix = `BigQuery Update (${item.date})\n[${item.type}] `;
        
        // Calculate max allowed length for the text snippet
        const reservedLength = prefix.length + linkSuffix.length + hashtagsSuffix.length;
        const maxSnippetLength = 280 - reservedLength;
        
        let snippet = textSnippet;
        if (snippet.length > maxSnippetLength) {
            snippet = snippet.substring(0, maxSnippetLength - 4) + '...';
        }
        
        tweetText = `${prefix}${snippet}${linkSuffix}${hashtagsSuffix}`;
    } else {
        // Bulk Tweet construction
        const dateStr = items[0].date; // Use the date of the first item
        const prefix = `BigQuery Updates (${dateStr}):\n`;
        
        let bulletPoints = '';
        const reservedLength = prefix.length + linkSuffix.length + hashtagsSuffix.length;
        let availableLength = 280 - reservedLength;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const textSnippet = extractTextFromHTML(item.content);
            const rawBullet = `• [${item.type}] ${textSnippet}\n`;
            
            if (rawBullet.length > availableLength) {
                // Truncate bullet
                if (availableLength > 15) {
                    const truncatedBullet = rawBullet.substring(0, availableLength - 5) + '...\n';
                    bulletPoints += truncatedBullet;
                }
                break; // Stop adding more bullets
            } else {
                bulletPoints += rawBullet;
                availableLength -= rawBullet.length;
            }
        }
        
        tweetText = `${prefix}${bulletPoints.trim()}${linkSuffix}${hashtagsSuffix}`;
    }

    DOM.tweetTextarea.value = tweetText;
    updateTweetStats(tweetText);
}

function handleTextareaInput(e) {
    const text = e.target.value;
    updateTweetStats(text);
}

function updateTweetStats(text) {
    const length = text.length;
    DOM.charCounter.innerText = `${length} / 280`;
    
    // Style Counter depending on limits
    DOM.charCounter.className = 'char-counter';
    if (length > 250 && length <= 280) {
        DOM.charCounter.classList.add('warning');
    } else if (length > 280) {
        DOM.charCounter.classList.add('danger');
    }

    // Sync Live Preview Mock
    DOM.mockTweetText.innerText = text;
    DOM.mockCardPreview.style.display = DOM.optIncludeLink.checked ? 'flex' : 'none';
}

function shareOnTwitter() {
    const text = DOM.tweetTextarea.value;
    const length = text.length;
    
    if (length > 280) {
        showToast("Tweet exceeds the standard 280-character limit!", "error");
        return;
    }
    
    if (!text.trim()) {
        showToast("Tweet cannot be empty!", "error");
        return;
    }

    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
    showToast('Redirected to Twitter composer!', 'success');
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

function copyCardContent(item) {
    const textSnippet = extractTextFromHTML(item.content);
    const contentToCopy = `BigQuery Release Note - ${item.date}\nType: ${item.type}\n\n${textSnippet}\n\nSource: https://cloud.google.com/bigquery/docs/release-notes`;
    
    copyToClipboard(contentToCopy);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied note details to clipboard!', 'success');
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";  // Avoid scrolling to bottom
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast('Copied note details to clipboard!', 'success');
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showToast('Failed to copy to clipboard.', 'error');
    }
    document.body.removeChild(textArea);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' 
        ? '<i class="fa-solid fa-circle-check"></i>' 
        : '<i class="fa-solid fa-circle-exclamation"></i>';
        
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    // Force reflow and show
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

function showLoading(isLoading) {
    if (isLoading) {
        DOM.skeletonLoader.style.display = 'block';
        DOM.releasesList.style.display = 'none';
        DOM.emptyState.style.display = 'none';
        DOM.refreshIcon.classList.add('spinning');
        DOM.btnRefresh.disabled = true;
    } else {
        DOM.skeletonLoader.style.display = 'none';
        DOM.refreshIcon.classList.remove('spinning');
        DOM.btnRefresh.disabled = false;
    }
}

function updateSyncStatus(status, text) {
    const indicator = DOM.syncStatus.querySelector('.status-indicator');
    const statusText = DOM.syncStatus.querySelector('.status-text');
    
    statusText.innerText = text;
    
    indicator.className = 'status-indicator';
    if (status === 'loading') {
        indicator.classList.add('loading');
    } else if (status === 'error') {
        indicator.style.backgroundColor = '#f43f5e';
        indicator.style.boxShadow = '0 0 8px #f43f5e';
    } else {
        indicator.style.backgroundColor = '#34d399';
        indicator.style.boxShadow = '0 0 8px #34d399';
    }
}

function resetFilters() {
    DOM.searchInput.value = '';
    state.filters.search = '';
    DOM.btnClearSearch.style.display = 'none';
    
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-pill[data-type="all"]').classList.add('active');
    state.filters.type = 'all';
    
    DOM.sortOrder.value = 'newest';
    state.filters.sort = 'newest';
    
    renderReleases();
    showToast('Filters reset successfully', 'success');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Helpers to sanitize and clean HTML
function sanitizeHTML(html) {
    // GCP HTML contains <p>, <a>, <code>, <ul>, <li>, <strong>, etc.
    // Clean anything malicious if needed, but since we trust GCP feed, we just return it.
    // To ensure tags match correctly:
    return html;
}

function extractTextFromHTML(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Replace link texts to show anchor name
    const anchors = tempDiv.querySelectorAll('a');
    anchors.forEach(a => {
        // Replace link with text inside it
        a.replaceWith(a.textContent);
    });
    
    // Replace code elements with clean quotes or brackets
    const codes = tempDiv.querySelectorAll('code');
    codes.forEach(c => {
        c.replaceWith(`\`${c.textContent}\``);
    });

    let text = tempDiv.textContent || tempDiv.innerText || "";
    // Replace multiple spaces and newlines
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

function formatSyncTime(isoStr) {
    try {
        const dt = new Date(isoStr.replace(' ', 'T'));
        const hours = dt.getHours().toString().padStart(2, '0');
        const minutes = dt.getMinutes().toString().padStart(2, '0');
        const seconds = dt.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    } catch (e) {
        return isoStr;
    }
}
