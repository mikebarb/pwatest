// Your main application logic goes here
let num = 0;
let songs;
let currentSong = 1;
let activeArea = "songArea";  // which area is currently displayed - index, search, etc.
let fromArea = "";  // where the current display came from - index, search, etc.

// Routines for detecting swipes.
let startX, startY, endX, endY;

// Get DOM elements for scanner code

// Variables to hold the scanner instance and its state
let html5QrcodeScanner = null;
let isScannerActive = false;
let isPaused = false;
let capturedStream = null;
let isResuming = false;

//window.appGlobalMap = new Map(); // For browser
let songMapByNumber = new Map();

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    // Optional: Check for updates
                    registration.update();
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    } else {
        console.log('Service Workers are not supported in this browser.');
    }
}

// Example function
function initializeApp() {
    // Register Service Worker
    registerServiceWorker();

    // Add event listeners
    // the trigger for the search on the songs/index page
    document.getElementById('findButton').addEventListener('click', findButtonClick);
   // Handle Enter key in search text field - alternative to pressig the find button
    document.getElementById('myInput').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission if inside a form
            findButtonClick();
        }
    });
    // the two buttons at the top of the Lyrics page
    document.getElementById('indexButton').addEventListener('click', indexButtonClick);
    document.getElementById('searchButton').addEventListener('click', searchButtonClick);
    // the buttons to control the scanner
    document.getElementById('startBtn').addEventListener('click', startScanner);
    document.getElementById('pauseBtn').addEventListener('click', pauseScanner);
    document.getElementById('resumeBtn').addEventListener('click', resumeScanner);
    document.getElementById('stopBtn').addEventListener('click', stopScanner);

    // Notes:
    // event.target = element actually clicked
    // event.currentTarget = element where the event listener is
    // event.target.closest('.parent-class') = closest element going up the dom tree from target element
    document.addEventListener('click', function(event) {
        // In index area? - nearest ancestor with class 'item'
        let clickedElement = event.target.closest('.item');
        if (clickedElement) {
            fromArea = "songArea";
            handleIndexClick(clickedElement, event);
        }
        //in results area? - nearest ancestor with class 'search-result'
        clickedElement = event.target.closest('.search-result');
        if (clickedElement) {
            fromArea = "resultsArea";
            handleIndexClick(clickedElement, event);
        }
    });

    // Swipe detection
    document.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    document.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].clientX;
        endY = e.changedTouches[0].clientY;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        // Detect swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if(Math.abs(deltaX) > 10) {
                if (deltaX > 0) {
                    swipeRight();
                } else {
                    swipeLeft();
                }
            }
        }
    });

    // Scanner related code

    // Initialise the scanner
    function initScanner() {
        if (html5QrcodeScanner) return html5QrcodeScanner;
        
        html5QrcodeScanner = new Html5QrcodeScanner(
            "reader", 
            { 
                fps: 10,
                qrbox: 250,
                rememberLastUsedCamera: true,
                supportedFormats: [ 
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.UPC_A
                ]
            },
            false
        );
        
        return html5QrcodeScanner;
    }

    // Simplest working version
    async function startScanner() {
        try {
            if (isScannerActive && !isPaused) return;
            
            const scanner = initScanner();
            
            if (isPaused && capturedStream) {
                await resumeScanner();
                return;
            }

            // Just use regular render - let iOS handle camera selection
            scanner.render(onScanSuccess, onScanFailure);
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            isScannerActive = true;
            isPaused = false;
            updateButtonStates();
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            handleCameraError(error);
        }
    }

    // Resume scanner - FIXED for v2.3.8 compatibility
    async function resumeScanner() {
        if (!isPaused || isResuming) return;
        
        isResuming = true;
        updateButtonStates();
        
        try {
            // For v2.3.8, we need to recreate the scanner completely
            // but reuse the camera ID to avoid permission prompt
            
            // First, completely clean up
            if (html5QrcodeScanner) {
                try {
                    html5QrcodeScanner.clear();
                } catch (e) {
                    console.log('Cleanup during resume:', e.message);
                }
                html5QrcodeScanner = null;
            }

            // Create new scanner instance with remembered camera
            html5QrcodeScanner = new Html5QrcodeScanner(
                "reader", 
                { 
                    fps: 10,
                    qrbox: 250,
                    rememberLastUsedCamera: true,
                    supportedFormats: [ 
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.UPC_A
                    ]
                },
                false
            );

            // Use the library's built-in resume functionality
            // v2.3.8 will reuse the last camera without prompt if rememberLastUsedCamera is true
            html5QrcodeScanner.render(onScanSuccess, onScanFailure);
            
            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Capture the new stream for potential future pauses
            const videoElement = document.querySelector('#reader video');
            if (videoElement && videoElement.srcObject) {
                capturedStream = videoElement.srcObject;
                const tracks = capturedStream.getVideoTracks();
                if (tracks.length > 0) {
                    currentCameraId = tracks[0].getSettings().deviceId;
                }
            }
            
            isPaused = false;
            console.log('Scanner resumed using library rememberLastUsedCamera');
            
        } catch (error) {
            console.error('Error resuming scanner:', error);
            // Fallback to regular start if resume fails
            await stopScanner();
            await startScanner();
        } finally {
            isResuming = false;
            updateButtonStates();
        }
    }

    // Also update pauseScanner to be less aggressive
    async function pauseScanner() {
        if (!isScannerActive || isPaused || isResuming) return;
        
        try {
            // Just stop the scanning without interfering with the stream
            if (html5QrcodeScanner && html5QrcodeScanner._html5Qrcode) {
                await html5QrcodeScanner._html5Qrcode.stop();
            }
            
            // Optional: gently disable tracks without breaking library state
            const videoElement = document.querySelector('#reader video');
            if (videoElement && videoElement.srcObject) {
                const tracks = videoElement.srcObject.getTracks();
                tracks.forEach(track => {
                    track.enabled = false;
                });
            }
            
            isPaused = true;
            updateButtonStates();
            console.log('Scanner paused gently');
            
        } catch (error) {
            console.error('Error pausing scanner:', error);
            await stopScanner();
        }
    }

    // Stop scanner
    async function stopScanner() {
        try {
            // Stop all tracks properly
            if (capturedStream) {
                const tracks = capturedStream.getTracks();
                tracks.forEach(track => {
                    track.stop();
                });
                capturedStream = null;
            }

            // Clear scanner
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }

            // Clean up video element
            const videoElement = document.querySelector('#reader video');
            if (videoElement) {
                videoElement.srcObject = null;
                videoElement.remove();
            }
            
        } catch (error) {
            console.error('Error stopping scanner:', error);
        } finally {
            isScannerActive = false;
            isPaused = false;
            capturedStream = null;
            currentCameraId = null;
            updateButtonStates();
        }
    }

    // Update UI states - ADD THIS FUNCTION
    function updateButtonStates() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const stopBtn = document.getElementById('stopBtn');
        const statusElement = document.getElementById('scannerStatus');
        
        if (startBtn) startBtn.disabled = isScannerActive && !isPaused;
        if (pauseBtn) pauseBtn.disabled = !isScannerActive || isPaused || isResuming;
        if (resumeBtn) resumeBtn.disabled = !isPaused || isResuming;
        if (stopBtn) stopBtn.disabled = !isScannerActive && !isPaused;
        
        // Update status display
        if (statusElement) {
            if (isResuming) {
                statusElement.textContent = 'Status: Resuming...';
                statusElement.style.color = '#ff9800';
            } else if (isPaused) {
                statusElement.textContent = 'Status: Paused';
                statusElement.style.color = '#ff9800';
            } else if (isScannerActive) {
                statusElement.textContent = 'Status: Scanning';
                statusElement.style.color = '#4caf50';
            } else {
                statusElement.textContent = 'Status: Stopped';
                statusElement.style.color = '#f44336';
            }
        }
    }

    // Error handling
    function handleCameraError(error) {
        console.error('Camera error:', error);
        
        let userMessage = 'Camera error occurred';
        if (error.message.includes('Permission')) {
            userMessage = 'Camera access denied. Please check browser permissions.';
        } else if (error.message.includes('NotFound')) {
            userMessage = 'No camera found on this device';
        } else if (error.message.includes('NotReadable')) {
            userMessage = 'Camera is in use by another application';
        } else if (error.message.includes('Abort')) {
            userMessage = 'Camera connection was interrupted';
        }
        
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = userMessage;
            errorElement.style.display = 'block';
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
        
        isScannerActive = false;
        isPaused = false;
        updateButtonStates();
    }

    // Scan callbacks
    function onScanSuccess(decodedText, decodedResult) {
        const resultElement = document.getElementById('result');
        if (resultElement) {
            resultElement.textContent = decodedText;
        }
        if (navigator.vibrate) navigator.vibrate(50);
    }

    function onScanFailure(error) {
        // Expected errors - no action needed
    }

    // Initialize button states on load
    document.addEventListener('DOMContentLoaded', function() {
        updateButtonStates();
    });


    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (html5QrcodeScanner) {
            stopScanner();
        }
    });

    // Initial setup
    loadInitialData();
}

function displayScreen(){
    if (activeArea === "songArea"){      // index area - list of songs
        //document.getElementById('inputContainer').classList.remove("hideme");
        showSearch();
        document.getElementById('songArea').classList.remove("hideme");
        document.getElementById('resultsArea').classList.add("hideme") ;
        document.getElementById('lyricsArea').classList.add("hideme");
        const thisElement = document.getElementById('s' + currentSong);
        if(thisElement){
            viewElement(thisElement);
        }
    }else if (activeArea === "resultsArea"){   // search results
        //document.getElementById('inputContainer').classList.remove("hideme");
        showSearch();
        document.getElementById('songArea').classList.add("hideme");
        document.getElementById('resultsArea').classList.remove("hideme");
        document.getElementById('lyricsArea').classList.add("hideme");
    }else if (activeArea === "lyricsArea"){
        //document.getElementById('inputContainer').classList.add("hideme");
        hideSearch();
        document.getElementById('songArea').classList.add("hideme");
        document.getElementById('resultsArea').classList.add("hideme");
        document.getElementById('lyricsArea').classList.remove("hideme");
        const element = document.getElementById('myElement');
        if (document.getElementById('results').children.length > 0) {   // Search results has content
            document.getElementById('searchButton').classList.remove("hidemekeepspace");
        }else{
            document.getElementById('searchButton').classList.add("hidemekeepspace");
        }
    }
}

// hide and show the search fields and allow page content to use all the page.
//function toggleHeader() {
//    const body = document.body;
//    body.classList.toggle('header-hidden');
//}

// Alternative: Hide header container completely
function hideSearch() {
    //const headerContainer = document.getElementById('headerContainer');
    //const contentContainer = document.getElementById('contentContainer');
    //document.getElementById('headerContainer').style.display = 'none';
    document.getElementById('headerContainer').classList.add("hideme");
    document.getElementById('contentContainer').style.marginTop = '0';
}

function showSearch() {
    //const headerContainer = document.getElementById('headerContainer');
    //const contentContainer = document.getElementById('contentContainer');
    //document.getElementById('headerContainer').style.display = 'block';
    document.getElementById('headerContainer').classList.remove("hideme");
    document.getElementById('contentContainer').style.marginTop = '500px'; // Adjust to header height
}

//const element = document.getElementById('myElement');
//element.scrollIntoView();
// Bring this element to be viewable on the screen
//viewElement(thisElement);

// With options for smooth scrolling and positioning
function viewElement(element){
    element.scrollIntoView({
        behavior: 'smooth', // 'auto' or 'smooth'
        block: 'center',    // 'start', 'center', 'end', or 'nearest'
        inline: 'nearest'   // 'start', 'center', 'end', or 'nearest'
    });
}

function setCurrentSong(num){
    document.getElementById('s' + currentSong).classList.remove("highlightme");
    let resultElement = document.getElementById('r' + currentSong);
    if (resultElement) {
        resultElement.classList.remove("highlightme");
    }
    currentSong = num;
    document.getElementById('s' + currentSong).classList.add("highlightme");
    resultElement = document.getElementById('r' + currentSong);
    if (resultElement) {
        resultElement.classList.add("highlightme");
    }
}

function handleIndexClick(element, event) {
    // Extract the song number from the ID (assuming ID format is 's<number>')
    // Use the Map for rapid lookup by ID - map created during data initialisation
    let thisSong = songs[songMapByNumber.get(element.id.slice(1))];
    addLyricElement(thisSong);
    fromArea = activeArea;
    activeArea = "lyricsArea";
    setCurrentSong(thisSong.number);
    displayScreen();
}

function indexButtonClick() {
    fromArea = activeArea;
    activeArea = "songArea";
    displayScreen();
}

function searchButtonClick() { 
    fromArea = activeArea;
    activeArea = "resultsArea";
    displayScreen();
}

function findButtonClick() {
    const inputVal = document.getElementById('myInput').value;
    if (isInteger(inputVal)){    // check if input is numberic
        // Clear previous text search results
        const container = document.getElementById('results');
        container.innerHTML = '';
        // Create a Map for rapid lookup by ID - done during data initialisation
        //const songMapByNumber = new Map();
        //songs.forEach((song,index) => {songMapByNumber.set(song.number, index)});
        // Now get any song by song number instantly
        let thisSong = songs[songMapByNumber.get(inputVal)];
        if (!(thisSong === undefined)) {    // song is found
            addLyricElement(thisSong);
            activeArea = "songArea"
            displayScreen();
        }else{
            showToast("There is no song number " + inputVal + ".");
            return;
        }
    }else{       // text search
        // Initialize with array and default search field
        const searcher = new FuzzySearchHighlighter(songs, 'firstLine');
        // Perform search
        const results = searcher.search(inputVal, {
            threshold: 0.2,
            maxResults: 5
        });
        displaySearchResults(results);
        activeArea = "resultsArea"
        displayScreen();
        return;
    }
}

// Display text search results
function displaySearchResults(results) {
    // Clear previous results
    const container = document.getElementById('results');
    container.innerHTML = '';
    // ensure something was found
    if (results.length === 0) {
        showToast("No matching songs found.");
        return;
    }
    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.id = 'r' + result.item.number;  
        div.innerHTML = `
            <div>Song: ${result.item.number}</div>
            <div>${result.highlighted}</div>
            `;
        container.appendChild(div);
    });
}

function isInteger(str) {
    return /^-?\d+$/.test(str.trim());
}

function populateIndex(){
    for (const song of songs) {
        addIndexElement(song);
    }
}

function addIndexElement(thisSong) {
    const newElement = createIndexElement(thisSong)
    document.getElementById('songs').appendChild(newElement);
}

function createIndexElement(thisSong) {
    const newElement = document.createElement('div');
    const newElement1 = document.createElement('p');
    newElement1.textContent = thisSong.number;
    newElement.appendChild(newElement1);
    const newElement2 = document.createElement('p');
    newElement2.textContent = thisSong.firstLine;
    newElement.appendChild(newElement2);
    newElement.className = 'item';
    newElement.id = "s" + thisSong.number;
    return newElement;
}

function swipeRight(){
    const indexThisSong = songs.findIndex(song => song.number === currentSong); 
    if (indexThisSong > 0){
        let nextSong = songs[indexThisSong - 1]; // get the previous song
        addLyricElement(nextSong);
        setCurrentSong(nextSong.number);
    }else{
        showToast("This is the first song.");
    }
}

function swipeLeft(){
    const indexThisSong = songs.findIndex(song => song.number === currentSong);
    if (indexThisSong < songs.length - 1){
        let previousSong = songs[indexThisSong + 1];
        addLyricElement(previousSong);
        setCurrentSong(previousSong.number);
    }else{
        showToast("This is the last song.");
    }       
}

function addLyricElement(thisSong) {
    //currentSong = thisSong.number;
    setCurrentSong(thisSong.number);
    const newElement = createLyricElement(thisSong);
    document.getElementById('lyrics').innerHTML = '';  // Clear previous lyrics
    document.getElementById('lyrics').appendChild(newElement);    
}

function createLyricElement(thisSong) {
    const newElement = document.createElement('div');
    var thisElement = document.createElement('h1');
    thisElement.textContent = thisSong.number; // add the verse line
    newElement.appendChild(thisElement);
    for (const thisVerse of thisSong.verses) {
        for (const thisLine of thisVerse) {
            var thisElement = document.createElement('p');
            thisElement.textContent = thisLine; // add the verse line
            newElement.appendChild(thisElement);
        }
        newElement.lastElementChild.className = 'verseLastLine';  // put  margin below this.
    }
    newElement.className = 'verses';
    return newElement;
}

function loadInitialData() {
    // Load initial content or make API calls
    fetch('./test.json')
        .then(response => response.json())
        .then(data => {
            songs = data;
            populateIndex();
            displayScreen();
            // Create a Map for rapid lookup by ID
            // so then you can get any user by ID instantly
            songs.forEach((song,index) => {songMapByNumber.set(song.number, index)});
        })
        .catch(error => console.error('Error loading JSON:', error));
}

// Routines for detecting swipes.

// Toast notification
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// Fuzzy Search and Highlighting Class
// Handles an array of hashes
class FuzzySearchHighlighter {
    constructor(items, searchField = 'name') {
        this.items = items;
        this.searchField = searchField;
    }

    // Levenshtein distance calculation
    levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = a[j - 1] === b[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    // Calculate similarity score between two strings
    calculateSimilarity(searchTerm, target) {
        const searchLower = searchTerm.toLowerCase();
        const targetLower = target.toLowerCase();

        // Exact match
        if (targetLower === searchLower) return 1.0;
        
        // Contains match
        if (targetLower.includes(searchLower)) {
            return 0.9 + (searchLower.length / targetLower.length) * 0.1;
        }

        // Levenshtein distance based similarity
        const distance = this.levenshteinDistance(searchLower, targetLower);
        const maxLength = Math.max(searchLower.length, targetLower.length);
        return 1 - (distance / maxLength);
    }

    // Find match positions for highlighting
    findMatchPositions(searchTerm, targetText) {
        const searchLower = searchTerm.toLowerCase();
        const targetLower = targetText.toLowerCase();
        const positions = [];

        // Try exact substring match first
        if (targetLower.includes(searchLower)) {
            const start = targetLower.indexOf(searchLower);
            return [{ start, end: start + searchLower.length }];
        }

        // Fuzzy character matching
        let searchIndex = 0;
        for (let i = 0; i < targetLower.length && searchIndex < searchLower.length; i++) {
            if (targetLower[i] === searchLower[searchIndex]) {
                positions.push({ start: i, end: i + 1 });
                searchIndex++;
            }
        }

        return positions;
    }

    // Highlight text with match positions
    highlightText(text, positions) {
        if (positions.length === 0) return text;

        let result = '';
        let lastIndex = 0;

        positions.forEach(({ start, end }) => {
            // Add text before match
            result += text.substring(lastIndex, start);
            // Add highlighted match
            result += `<span class="fuzzy-highlight">${text.substring(start, end)}</span>`;
            lastIndex = end;
        });

        // Add remaining text
        result += text.substring(lastIndex);
        return result;
    }

    // Main search method
    search(query, options = {}) {
        const {
            threshold = 0.3,
            maxResults = 10,
            minScore = 0.1,
            searchFields = null // Optional: override default search field
        } = options;

        if (!query || query.trim() === '') {
            return this.items.map((item, index) => ({
                index,
                item,
                score: 1,
                highlighted: item[this.searchField],
                matchPositions: []
            }));
        }

        const results = [];
        const queryLower = query.toLowerCase().trim();

        this.items.forEach((item, index) => {
            // Determine which fields to search
            const fieldsToSearch = searchFields || [this.searchField];
            let maxFieldScore = 0;
            let bestField = '';
            let bestMatchPositions = [];

            // Calculate score for each field
            fieldsToSearch.forEach(field => {
                if (item[field] && typeof item[field] === 'string') {
                    const fieldText = item[field];
                    const score = this.calculateSimilarity(queryLower, fieldText);
                    
                    if (score > maxFieldScore) {
                        maxFieldScore = score;
                        bestField = field;
                        bestMatchPositions = this.findMatchPositions(queryLower, fieldText);
                    }
                }
            });

            if (maxFieldScore >= threshold) {
                const highlighted = this.highlightText(
                    item[bestField], 
                    bestMatchPositions
                );

                results.push({
                    index,
                    item,
                    score: maxFieldScore,
                    highlighted,
                    matchField: bestField,
                    matchPositions: bestMatchPositions,
                    originalText: item[bestField]
                });
            }
        });

        // Sort by score and limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }

    // Batch search multiple queries
    batchSearch(queries, options = {}) {
        return queries.map(query => this.search(query, options));
    }

    // Get item by index with highlighting
    getItemWithHighlight(index, query, options = {}) {
        if (index < 0 || index >= this.items.length) {
            throw new Error('Index out of bounds');
        }

        const item = this.items[index];
        const queryLower = query.toLowerCase().trim();
        const fieldsToSearch = options.searchFields || [this.searchField];

        let maxScore = 0;
        let bestField = '';
        let bestMatchPositions = [];

        fieldsToSearch.forEach(field => {
            if (item[field] && typeof item[field] === 'string') {
                const score = this.calculateSimilarity(queryLower, item[field]);
                if (score > maxScore) {
                    maxScore = score;
                    bestField = field;
                    bestMatchPositions = this.findMatchPositions(queryLower, item[field]);
                }
            }
        });

        return {
            index,
            item,
            score: maxScore,
            highlighted: this.highlightText(item[bestField], bestMatchPositions),
            matchField: bestField,
            matchPositions: bestMatchPositions
        };
    }
}



// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);
