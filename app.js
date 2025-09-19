// Your main application logic goes here
let num = 0;
let songs;
let currentSong;

// Initialize with your data
const fuzzyData = [
    "JavaScript Programming for everyone",
    "Python Development for the image processing",
    "Web Development for the average user",
    "Machine Learning as a specialist area",
    "Data Science for the academics",
    "React Framework for specialised programmers",
    "Node.js Runtime for your computer",
    "TypeScript Language if you want to simplify javascript",
];

//window.appGlobalMap = new Map(); // For browser
let songMapByNumber = new Map();

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('SW registered successfully: ', registration);
                    
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
    console.log('App initialized!');
    
    // Register Service Worker
    registerServiceWorker();

    // Add event listeners
    document.getElementById('findButton').addEventListener('click', findButtonClick);

    // Notes:
    // event.target = element actually clicked
    // event.currentTarget = element where the event listener is
    // event.target.closest('.parent-class') = closest element going up the dom tree from target element
    document.addEventListener('click', function(event) {
        // Check if the clicked element has the target class or is inside such an element
        const clickedElement = event.target.closest('.item');
        if (clickedElement) {
            // Now you know exactly which element with the class was clicked
            //console.log('Triggering element:', clickedElement);
            //console.log('Element ID:', clickedElement.id);
            handleIndexClick(clickedElement, event);
        }
    });

    // Initial setup
    loadInitialData();

    // Populate the index area
    //populateIndex();
}

function handleIndexClick(element, event) {
    let thisSong = songMapByNumber.get(element.id.slice(1));
    addLyricElement(thisSong);
}

function findButtonClick() {
    const inputVal = myInput.value;
    if (isInteger(inputVal)){    // check if input is numberic
        // Create a Map for rapid lookup by ID
        //const songMapByNumber = new Map();
        //songs.forEach(song => songMapByNumber.set(song.number, song));
        // Now get any user by ID instantly
        let thisSong = songMapByNumber.get(inputVal);
        if (!(thisSong === undefined)) {    // song is found
            addLyricElement(thisSong);
        }else{
            showToast("There is no song number " + inputVal + ".");
            return;
        }
    }else{
        // do nothing   - will ultimately be a text search
        // we have a string to search for
        const searcher = new FuzzySearchHighlighter(fuzzyData);

        // Perform search
        const results = searcher.search(inputVal, {
            threshold: 0.2,
            maxResults: 5
        });

        displayResults(results);

        return;
    }
}

// Display results
function displayResults(results) {
    const container = document.getElementById('results');
    container.innerHTML = '';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'search-result';
        div.innerHTML = `
            <div>${result.highlighted}</div>
            <small>Score: ${result.score.toFixed(2)}</small>
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
    newElement1.textContent = 'new Item: ' + thisSong.number;
    newElement.appendChild(newElement1);
    const newElement2 = document.createElement('p');
    newElement2.textContent = 'new First Line: ' + thisSong.firstLine;
    newElement.appendChild(newElement2);
    newElement.className = 'item';
    newElement.id = "s" + thisSong.number;
    return newElement;
}

function swipeRight(){
    console.log('Swiped right - go to previous song');
    const indexThisSong = songs.findIndex(song => song.number === currentSong);
    console.log('Index of current song:', indexThisSong);   
    if (indexThisSong > 0){
        let nextSong = songs[indexThisSong - 1]; // get the previous song
        console.log('Next song:', nextSong);
        addLyricElement(nextSong);
        currentSong =nextSong.number; 
        console.log('Current song number:', currentSong);
    }else{
        showToast("This is the first song.");
    }
}

function swipeLeft(){
    console.log('Swiped left - go to next song');  
    const indexThisSong = songs.findIndex(song => song.number === currentSong);
    if (indexThisSong < songs.length - 1){
        let previousSong = songs[indexThisSong + 1];
        addLyricElement(previousSong);
    }else{
        showToast("This is the last song.");
    }       
}

function addLyricElement(thisSong) {
    console.log(thisSong);
    currentSong = thisSong.number;
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
    console.log('Loading initial data...');
    fetch('./test.json')
        .then(response => response.json())
        .then(data => {
            songs = data;
            console.log('Loaded songs:', songs);
            populateIndex();
            // Create a Map for rapid lookup by ID
            // so then you can get any user by ID instantly
            songs.forEach(song => songMapByNumber.set(song.number, song));
        })
        .catch(error => console.error('Error loading JSON:', error));
}

// Routines for detecting swipes.
let startX, startY, endX, endY;

document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    //console.log('Touch start:', startX, startY);
});

document.addEventListener('touchend', (e) => {
    endX = e.changedTouches[0].clientX;
    endY = e.changedTouches[0].clientY;
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    //console.log('Touch end - Delta X:', deltaX, 'Delta Y:', deltaY);
    
    // Detect swipe direction
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if(Math.abs(deltaX) > 10) {
            if (deltaX > 0) {
                console.log('Right swipe');
                swipeRight();
            } else {
                console.log('Left swipe');
                swipeLeft();
            }
        }
    } else {
        if(Math.abs(deltaY) > 10) {
            if (deltaY > 0) {
                console.log('Down swipe');
            } else {
                console.log('Up swipe');
            }
        }
    }
});

// Toast notification
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}


class FuzzySearchHighlighter {
    constructor(items) {
        this.items = items;
    }
    // Levenshtein distance calculation
    levenshteinDistance(a, b) {
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
    // Find best match positions for highlighting
    findMatchPositions(searchTerm, target) {
        const searchLower = searchTerm.toLowerCase();
        const targetLower = target.toLowerCase();
        const positions = [];
        // Exact match
        if (targetLower.includes(searchLower)) {
            const start = targetLower.indexOf(searchLower);
            positions.push({ start, end: start + searchLower.length });
            return positions;
        }
        // Find character matches for fuzzy highlighting
        let searchIndex = 0;
        for (let i = 0; i < targetLower.length && searchIndex < searchLower.length; i++) {
            if (targetLower[i] === searchLower[searchIndex]) {
                positions.push({ start: i, end: i + 1 });
                searchIndex++;
            }
        }
        return positions;
    }
    // Highlight matches in text
    highlightMatches(text, positions) {
        if (positions.length === 0) return text;
        let result = '';
        let lastIndex = 0;
        positions.forEach(({ start, end }) => {
            // Add text before match
            result += text.substring(lastIndex, start);
            // Add highlighted match
            result += `<span class="highlight">${text.substring(start, end)}</span>`;
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
            includeOriginal = false
        } = options;

        const queryLower = query.toLowerCase();
        const results = [];

        this.items.forEach(item => {
            const itemLower = item.toLowerCase();
            let score = 0;
            // Quick exact match
            if (itemLower === queryLower) {
                score = 1.0;
            }
            // Contains match
            else if (itemLower.includes(queryLower)) {
                score = 0.8 + (queryLower.length / itemLower.length) * 0.2;
            }
            // Fuzzy match
            else {
                const distance = this.levenshteinDistance(queryLower, itemLower);
                const maxLength = Math.max(queryLower.length, itemLower.length);
                score = 1 - (distance / maxLength);
            }
            if (score >= threshold) {
                const matchPositions = this.findMatchPositions(query, item);
                const highlighted = this.highlightMatches(item, matchPositions);

                results.push({
                    original: item,
                    highlighted,
                    score,
                    matchPositions
                });
            }
        });
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }
}

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);
