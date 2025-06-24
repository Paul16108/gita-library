// Telegram Web App Integration
let tg = window.Telegram?.WebApp;

// Initialize Telegram Web App
if (tg) {
  tg.ready();
  tg.expand();
  tg.MainButton.hide();
  tg.BackButton.hide();
}

// Application State
const state = {
  verses: [],
  chapters: [],
  currentIndex: 0,
  currentChapter: 1,
  currentVerse: 1,
  currentBook: null,
  currentLang: 'ru',
  searchIndex: null,
  theme: 'auto',
  fontSize: 'medium',
  isLoading: false
};

// DOM Elements
const elements = {
  menuBtn: document.getElementById('menuBtn'),
  menuOverlay: document.getElementById('menu-overlay'),
  closeMenu: document.getElementById('close-menu'),
  langSwitch: document.getElementById('lang-switch'),
  themeSwitch: document.getElementById('theme-switch'),
  fontSizeSwitch: document.getElementById('font-size-switch'),
  bookSelector: document.getElementById('bookSelect'),
  verseSection: document.getElementById('verse-section'),
  verseTitle: document.getElementById('verse-title'),
  verseContent: document.getElementById('verse-content'),
  verseText: document.getElementById('verse-text'),
  sideNav: document.getElementById('side-nav'),
  prevBtn: document.getElementById('prev-verse'),
  nextBtn: document.getElementById('next-verse'),
  loadingSpinner: document.getElementById('loading-spinner')
};

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'auto';
  state.theme = savedTheme;
  elements.themeSwitch.value = savedTheme;
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'auto') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
  
  // Update Telegram theme
  if (tg) {
    const isDark = root.getAttribute('data-theme') === 'dark';
    tg.setHeaderColor(isDark ? '#1A1A1A' : '#FFFFFF');
    tg.setBackgroundColor(isDark ? '#1A1A1A' : '#FFFFFF');
  }
}

// Font Size Management
function initFontSize() {
  const savedFontSize = localStorage.getItem('fontSize') || 'medium';
  state.fontSize = savedFontSize;
  elements.fontSizeSwitch.value = savedFontSize;
  applyFontSize(savedFontSize);
}

function applyFontSize(fontSize) {
  const body = document.body;
  
  // Remove existing font size classes
  body.classList.remove('font-small', 'font-medium', 'font-large');
  
  // Add new font size class
  body.classList.add(`font-${fontSize}`);
}

// Loading State Management
function showLoading() {
  state.isLoading = true;
  elements.loadingSpinner.style.display = 'block';
}

function hideLoading() {
  state.isLoading = false;
  elements.loadingSpinner.style.display = 'none';
}

// Book Loading
async function loadBook(book, lang) {
  if (state.isLoading) return;
  
  showLoading();
  
  try {
    const path = `books/${book}/${lang}.md`;
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    
    const text = await response.text();
    
    // Parse chapters and verses
    parseBookContent(text);
    
    state.currentBook = book;
    state.currentLang = lang;
    
    // Build search index
    buildSearchIndex();
    
    // Show first verse
    showVerse();
    
    // Haptic feedback
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('light');
    }
    
  } catch (error) {
    console.error('Error loading book:', error);
    showError('Ошибка загрузки книги');
  } finally {
    hideLoading();
  }
}

// Parse Book Content
function parseBookContent(text) {
  const lines = text.split('\n');
  const chapters = [];
  let currentChapter = null;
  let currentVerse = '';
  let verseNumber = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Chapter header (Russian)
    if (line.startsWith('# Глава ')) {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      const chapterNum = line.match(/# Глава (\d+)/)?.[1];
      currentChapter = {
        number: parseInt(chapterNum),
        title: `Глава ${chapterNum}`,
        verses: []
      };
    }
    
    // Chapter header (English)
    else if (line.startsWith('## Chapter ')) {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      const chapterNum = line.match(/## Chapter (\d+)/)?.[1];
      currentChapter = {
        number: parseInt(chapterNum),
        title: `Chapter ${chapterNum}`,
        verses: []
      };
    }
    
    // Verse header (Russian)
    else if (line.match(/^## \d+\.\d+/)) {
      if (currentVerse && verseNumber && currentChapter) {
        currentChapter.verses.push({
          number: verseNumber,
          content: currentVerse.trim()
        });
      }
      
      verseNumber = line.replace('## ', '');
      currentVerse = '';
    }
    
    // Verse header (English)
    else if (line.match(/^### \d+\.\d+/)) {
      if (currentVerse && verseNumber && currentChapter) {
        currentChapter.verses.push({
          number: verseNumber,
          content: currentVerse.trim()
        });
      }
      
      verseNumber = line.replace('### ', '');
      currentVerse = '';
    }
    
    // Verse content
    else if (currentChapter && verseNumber) {
      currentVerse += line + '\n';
    }
  }
  
  // Add last verse
  if (currentVerse && verseNumber && currentChapter) {
    currentChapter.verses.push({
      number: verseNumber,
      content: currentVerse.trim()
    });
  }
  
  // Add last chapter
  if (currentChapter) {
    chapters.push(currentChapter);
  }
  
  state.chapters = chapters;
  
  // Flatten verses for search
  state.verses = [];
  chapters.forEach(chapter => {
    chapter.verses.forEach(verse => {
      state.verses.push(verse.content);
    });
  });
}

// Search Index Building
function buildSearchIndex() {
  if (!window.lunr || state.verses.length === 0) return;
  
  try {
    state.searchIndex = lunr(function() {
      this.ref('id');
      this.field('body');
      
      state.verses.forEach((verse, index) => {
        if (verse.trim()) {
          this.add({ id: index, body: verse });
        }
      });
    });
  } catch (error) {
    console.error('Error building search index:', error);
  }
}

// Verse Display
function showVerse() {
  if (!state.currentChapter || state.chapters.length === 0) {
    elements.verseText.textContent = 'Нет данных.';
    return;
  }
  
  const chapter = state.chapters.find(ch => ch.number === state.currentChapter);
  if (!chapter || !chapter.verses[state.currentIndex]) {
    elements.verseText.textContent = 'Стих не найден.';
    return;
  }
  
  const verse = chapter.verses[state.currentIndex];
  
  // Set verse title in format "chapter.verse"
  const verseTitle = document.getElementById('verse-title');
  if (verseTitle) {
    verseTitle.textContent = `${state.currentChapter}.${state.currentIndex + 1}`;
  }
  
  // Clean content - remove "# Chapter X" lines
  let content = verse.content;
  content = content.replace(/^# Chapter \d+\s*\n?/gm, '');
  content = content.replace(/^# Глава \d+\s*\n?/gm, '');
  
  elements.verseText.textContent = content;
  
  updateNavigation();
  updateNavigationButtons();
  
  // Scroll to top
  elements.verseContent.scrollTop = 0;
}

// Navigation
function updateNavigationButtons() {
  if (!state.currentChapter || state.chapters.length === 0) {
    elements.prevBtn.disabled = true;
    elements.nextBtn.disabled = true;
    return;
  }
  
  const chapter = state.chapters.find(ch => ch.number === state.currentChapter);
  if (!chapter) {
    elements.prevBtn.disabled = true;
    elements.nextBtn.disabled = true;
    return;
  }
  
  elements.prevBtn.disabled = state.currentIndex <= 0;
  elements.nextBtn.disabled = state.currentIndex >= chapter.verses.length - 1;
}

function goToPreviousVerse() {
  if (state.currentIndex <= 0) return;
  
  state.currentIndex--;
  showVerse();
  
  // Haptic feedback
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }
}

function goToNextVerse() {
  const chapter = state.chapters.find(ch => ch.number === state.currentChapter);
  if (!chapter || state.currentIndex >= chapter.verses.length - 1) return;
  
  state.currentIndex++;
  showVerse();
  
  // Haptic feedback
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }
}

// Search Functionality
function performSearch(query) {
  if (!state.searchIndex || !query.trim()) {
    showVerse();
    return;
  }
  
  try {
    const results = state.searchIndex.search(query);
    
    if (results.length > 0) {
      const verseId = parseInt(results[0].ref, 10);
      if (verseId >= 0 && verseId < state.verses.length) {
        elements.verseText.textContent = state.verses[verseId] || '';
        
        // Highlight search terms
        highlightSearchTerms(query);
      }
    } else {
      elements.verseText.textContent = 'Ничего не найдено.';
    }
  } catch (error) {
    console.error('Search error:', error);
    showVerse();
  }
}

function highlightSearchTerms(query) {
  const text = elements.verseText.textContent;
  const terms = query.toLowerCase().split(/\s+/);
  
  let highlightedText = text;
  
  terms.forEach(term => {
    if (term.length > 2) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
  });
  
  if (highlightedText !== text) {
    elements.verseText.innerHTML = highlightedText;
  }
}

// Show current verse
function showVerse() {
  const chapter = state.chapters.find(ch => ch.number === state.currentChapter);
  if (!chapter || !chapter.verses[state.currentIndex]) {
    elements.verseText.textContent = 'Загрузка...';
    return;
  }
  
  const verse = chapter.verses[state.currentIndex];
  elements.verseTitle.textContent = verse.number;
  elements.verseText.innerHTML = verse.content;
  
  updateNavigationButtons();
}

// Update navigation buttons
function updateNavigationButtons() {
  const chapter = state.chapters.find(ch => ch.number === state.currentChapter);
  if (!chapter) {
    elements.prevBtn.disabled = true;
    elements.nextBtn.disabled = true;
    return;
  }
  
  elements.prevBtn.disabled = state.currentIndex <= 0;
  elements.nextBtn.disabled = state.currentIndex >= chapter.verses.length - 1;
}
  state.currentView = 'verses';
  state.currentChapter = chapterNumber;
  elements.searchSection.style.display = 'block';
  elements.chaptersSection.style.display = 'none';
  elements.versesSection.style.display = 'block';
  elements.verseSection.style.display = 'none';
  elements.sideNav.style.display = 'none';
  
  renderVerses(chapterNumber);
  
  if (tg) {
    tg.BackButton.show();
  }
}

function showVerseView(chapterNumber, verseIndex) {
  state.currentView = 'verse';
  state.currentChapter = chapterNumber;
  state.currentIndex = verseIndex;
  elements.searchSection.style.display = 'none';
  elements.chaptersSection.style.display = 'none';
  elements.versesSection.style.display = 'none';
  elements.verseSection.style.display = 'block';
  elements.sideNav.style.display = 'block';
  
  showVerse();
  
  if (tg) {
    tg.BackButton.show();
  }
}

// Render Functions
function renderChapters() {
  elements.chaptersGrid.innerHTML = '';
  
  state.chapters.forEach(chapter => {
    const chapterCard = document.createElement('div');
    chapterCard.className = 'chapter-card';
    chapterCard.innerHTML = `
      <div class="chapter-number">Глава ${chapter.number}</div>
    `;
    
    chapterCard.addEventListener('click', () => {
      showVersesView(chapter.number);
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    });
    
    elements.chaptersGrid.appendChild(chapterCard);
  });
}

function renderVerses(chapterNumber) {
  elements.versesList.innerHTML = '';
  
  const chapter = state.chapters.find(ch => ch.number === chapterNumber);
  if (!chapter) return;
  
  chapter.verses.forEach((verse, index) => {
    const verseItem = document.createElement('div');
    verseItem.className = 'verse-item';
    
    // Get preview text (first few lines)
    const lines = verse.content.split('\n');
    const preview = lines.slice(0, 3).join(' ').substring(0, 100) + '...';
    
    verseItem.innerHTML = `
      <div class="verse-number">Стих ${verse.number}</div>
      <div class="verse-preview">${preview}</div>
    `;
    
    verseItem.addEventListener('click', () => {
      showVerseView(chapterNumber, index);
      
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
      }
    });
    
    elements.versesList.appendChild(verseItem);
  });
}

// Menu Management
function openMenu() {
  elements.menuOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Haptic feedback
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred('light');
  }
}

function closeMenu() {
  elements.menuOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Error Handling
function showError(message) {
  // Simple error display - could be enhanced with a toast system
  alert(message);
}

// Event Listeners
function initEventListeners() {
  // Menu
  elements.menuBtn.addEventListener('click', openMenu);
  elements.closeMenu.addEventListener('click', closeMenu);
  elements.menuOverlay.addEventListener('click', (e) => {
    if (e.target === elements.menuOverlay) {
      closeMenu();
    }
  });
  
  // Book Selector
  elements.bookSelector.addEventListener('change', (e) => {
    const book = e.target.value;
    if (book && book !== state.currentBook) {
      loadBook(book, state.currentLang);
    }
  });
  
  // Language Switch
  elements.langSwitch.addEventListener('change', (e) => {
    const newLang = e.target.value;
    if (state.currentBook && newLang !== state.currentLang) {
      loadBook(state.currentBook, newLang);
    }
    localStorage.setItem('language', newLang);
  });
  
  // Theme Switch
  elements.themeSwitch.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    state.theme = newTheme;
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  });
  
  // Font Size Switch
  elements.fontSizeSwitch.addEventListener('change', (e) => {
    const newFontSize = e.target.value;
    state.fontSize = newFontSize;
    applyFontSize(newFontSize);
    localStorage.setItem('fontSize', newFontSize);
  });
  
  // Search
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(e.target.value);
    }, 300);
  });
  
  // Navigation
  elements.prevBtn.addEventListener('click', goToPreviousVerse);
  elements.nextBtn.addEventListener('click', goToNextVerse);
  
  // Keyboard Navigation
  document.addEventListener('keydown', (e) => {
    if (state.currentView === 'verse') {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPreviousVerse();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextVerse();
          break;
        case 'Escape':
          if (elements.menuOverlay.classList.contains('active')) {
            closeMenu();
          } else {
            handleBackNavigation();
          }
          break;
      }
    }
  });
  
  // System Theme Change
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') {
      applyTheme('auto');
    }
  });
  
  // Telegram Back Button
  if (tg) {
    tg.BackButton.onClick(handleBackNavigation);
  }
}

// Handle Back Navigation
function handleBackNavigation() {
  switch (state.currentView) {
    case 'verse':
      showVersesView(state.currentChapter);
      break;
    case 'verses':
      showChaptersView();
      break;
    case 'chapters':
      // Already at top level
      break;
  }
}

// Initialization
function init() {
  // Load saved preferences
  const savedLang = localStorage.getItem('language') || 'ru';
  state.currentLang = savedLang;
  elements.langSwitch.value = savedLang;
  
  // Initialize theme and font size
  initTheme();
  initFontSize();
  
  // Initialize event listeners
  initEventListeners();
  
  // Auto-load Bhagavad Gita and show first verse
  loadBook('gita', state.currentLang);
  
  // Telegram-specific initialization
  if (tg) {
    // Set initial colors
    applyTheme(state.theme);
    
    // Handle viewport changes
    tg.onEvent('viewportChanged', () => {
      // Handle viewport changes if needed
    });
  }
  
  console.log('Gita Telegram App initialized');
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && tg) {
    // Refresh theme when page becomes visible
    applyTheme(state.theme);
  }
});

// Export for debugging
window.GitaApp = {
  state,
  loadBook,
  showVerse,
  performSearch
};

