const langSel = document.getElementById('lang-switch');
const booksNav = document.getElementById('books');
const verseBox = document.getElementById('verse-text');
const searchInput = document.getElementById('search');
const prevBtn = document.getElementById('prev-verse');
const nextBtn = document.getElementById('next-verse');

let verses = [];
let currentIndex = 0;
let idx;

async function loadBook(book, lang) {
  const path = `books/${book}/${lang}.md`;
  const text = await fetch(path).then(r => r.text());
  verses = text.split(/\n##\s+\d+\.\d+\s*\n/).filter(t => t.trim() !== "");
  if (verses.length > 0 && text.startsWith('##')) {
    verses.unshift(''); // for first verse if text starts with ##
  }
  currentIndex = 0;
  showVerse();
  buildIndex(text);
}

function showVerse() {
  if (verses.length === 0) {
    verseBox.textContent = 'Нет данных.';
    return;
  }
  verseBox.textContent = verses[currentIndex] || '';
}

function buildIndex(text) {
  idx = lunr(function() {
    this.ref('id');
    this.field('body');
    text.split(/\n+/).forEach((p, i) => this.add({ id: i, body: p }));
  });
}

booksNav.addEventListener('click', e => {
  if (e.target.dataset.book) {
    loadBook(e.target.dataset.book, langSel.value);
  }
});

langSel.onchange = () => {
  const activeBtn = document.querySelector('[data-book].active');
  if (activeBtn) activeBtn.click();
};

prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    showVerse();
  }
};

nextBtn.onclick = () => {
  if (currentIndex < verses.length - 1) {
    currentIndex++;
    showVerse();
  }
};

searchInput.oninput = () => {
  if (!idx) return;
  const q = searchInput.value.trim();
  if (!q) {
    showVerse();
    return;
  }
  const res = idx.search(q);
  if (res.length > 0) {
    const lineId = res[0].ref;
    verseBox.textContent = res[0].matchData.metadata ? q : verses[lineId] || '';
  }
};
