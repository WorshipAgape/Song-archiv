// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlkjVQFtFpMRFexAi6nBqEkIfjFlU5cDo",
  authDomain: "song-archive-389a6.firebaseapp.com",
  projectId: "song-archive-389a6",
  storageBucket: "song-archive-389a6.firebasestorage.app",
  messagingSenderId: "619735277668",
  appId: "1:619735277668:web:51d2684bd8d4444eaf3f71",
  measurementId: "G-Z6QYH5YD2E"
};


// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
// Добавьте orderBy, getDocs, where сюда, если их нет
import { getFirestore, collection, addDoc, query, onSnapshot, deleteDoc, doc, orderBy, getDocs, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Reference to the shared list collection
const sharedListCollection = collection(db, "sharedList");

const API_KEY = 'AIzaSyDO2gwifAnZzC3ooJ0A_4vAD76iYakwzlk'; // Ваш API-ключ
const SHEET_ID = '1C3gFjj9LAub_Nk9ogqKp3LKpdAxq6j8xlPAsc8OmM5s'; // Ваш ID таблицы
const SHEETS = {
    'Быстрые (вертикаль)': 'Быстрые (вертикаль)',
    'Быстрые (горизонталь)': 'Быстрые (горизонталь)',
    'Поклонение (вертикаль)': 'Поклонение (вертикаль)',
    'Поклонение (горизонталь)': 'Поклонение (горизонталь)'
};

const chords = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
let cachedData = {};
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// Объявление всех элементов DOM в начале файла
const sheetSelect = document.getElementById('sheet-select');
const songSelect = document.getElementById('song-select');
const songContent = document.getElementById('song-content');
const keySelect = document.getElementById('key-select');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const bpmDisplay = document.getElementById('bpm-display');
const holychordsButton = document.getElementById('holychords-button');
const favoriteButton = document.getElementById('favorite-button');
const loadingIndicator = document.getElementById('loading-indicator');
const splitTextButton = document.getElementById('split-text-button');
const favoritesPanel = document.getElementById('favorites-panel');
const toggleFavoritesButton = document.getElementById('toggle-favorites');
const favoritesList = document.getElementById('favorites-list');
const sharedSongsList = document.getElementById('shared-songs-list');


// Переменные для работы с аудио
let audioContext; // Переменная для хранения AudioContext
let audioBuffer; // Переменная для хранения аудиобуфера
let metronomeInterval = null;
let isMetronomeActive = false;
let currentBeat = 0;


// Настройка AudioContext
function setupAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext успешно создан.");
    }
}

// Функция для загрузки данных из Google Sheets
async function fetchSheetData(sheetName) {
    if (cachedData[sheetName]) return cachedData[sheetName];

    loadingIndicator.style.display = 'block'; // Показываем индикатор загрузки

    try {
        const range = `${sheetName}!A2:E`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        cachedData[sheetName] = data.values || [];
        return cachedData[sheetName];
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        return [];
    } finally {
        loadingIndicator.style.display = 'none'; // Скрываем индикатор загрузки
    }
}

// Функция для создания индекса поиска
function createSearchIndex() {
    searchIndex = [];
    
    allSheetsData.forEach(({sheetName, data}) => {
        data.forEach((row, index) => {
            if (row[0]) { // Проверяем, что название песни существует
                searchIndex.push({
                    name: row[0].toLowerCase(),
                    sheetName: sheetName,
                    index: index
                });
            }
        });
    });
    
    // Сортируем индекс для более быстрого поиска
    searchIndex.sort((a, b) => a.name.localeCompare(b.name));
}

// Модифицированная функция поиска
// Функция для поиска песен по названию
async function searchSongs(query) {
    const lowerQuery = query.trim().toLowerCase(); // Приводим запрос к нижнему регистру и удаляем лишние пробелы
    if (!lowerQuery) {
        searchResults.innerHTML = ''; // Очищаем результаты, если запрос пустой
        return;
    }

    // Получаем данные со всех листов
    const allRows = Object.values(SHEETS).flatMap(sheetName => cachedData[sheetName] || []);

    // Фильтруем песни по запросу
    const matchingSongs = allRows.filter(row => {
        const name = row[0]?.trim().toLowerCase(); // Приводим название песни к нижнему регистру
        return name && name.includes(lowerQuery); // Проверяем, содержит ли название запрос
    });

    // Очищаем предыдущие результаты
    searchResults.innerHTML = '';

    if (matchingSongs.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }

    // Отображаем результаты поиска
    matchingSongs.forEach((song, index) => {
        const resultItem = document.createElement('div');
        resultItem.textContent = song[0]; // Название песни
        resultItem.className = 'search-result';
        resultItem.addEventListener('click', () => {
            // Находим лист, к которому относится песня
            const sheetName = Object.keys(SHEETS).find(sheet =>
                cachedData[SHEETS[sheet]]?.some(row => row[0] === song[0])
            );

            if (sheetName) {
                sheetSelect.value = sheetName; // Выбираем соответствующий лист
                loadSheetSongs().then(() => {
                    const songIndex = cachedData[SHEETS[sheetName]].findIndex(row => row[0] === song[0]);
                    if (songIndex !== -1) {
                        songSelect.value = songIndex; // Выбираем песню
                        displaySongDetails(song, songIndex);
                        searchResults.innerHTML = ''; // Очищаем результаты поиска
                    }
                });
            }
        });
        searchResults.appendChild(resultItem);
    });
}

// Функция отображения результатов поиска
function displaySearchResults(results) {
    searchResults.innerHTML = ''; // Очищаем предыдущие результаты

    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
        return;
    }

    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.textContent = result.name; // Название песни
        resultItem.className = 'search-result'; // Добавляем класс для стилизации

        resultItem.addEventListener('click', () => {
            // Логика выбора песни
            sheetSelect.value = result.sheetName; // Выбираем соответствующий лист
            loadSheetSongs().then(() => {
                songSelect.value = result.index; // Выбираем песню
                displaySongDetails(cachedData[result.sheetName][result.index], result.index);
                searchResults.innerHTML = ''; // Очищаем результаты поиска
            });
        });

        searchResults.appendChild(resultItem); // Добавляем элемент в контейнер
    });
}


function getTransposition(originalKey, newKey) {
    const originalIndex = chords.indexOf(originalKey);
    const newIndex = chords.indexOf(newKey);
    if (originalIndex === -1 || newIndex === -1) return 0; // Если тональности не найдены, возвращаем 0
    return newIndex - originalIndex;
}

function transposeChord(chord, transposition) {
    let chordType = '';
    let baseChord = chord;
    let bassNote = '';

    const suffixes = ['maj7', 'm7', '7', 'm', 'dim', 'aug', 'sus2', 'sus4', 'add9', 'dim7', 'aug7', 'sus'];

    if (chord.includes('/')) {
        [baseChord, bassNote] = chord.split('/');
    }

    for (let suffix of suffixes) {
        if (baseChord.endsWith(suffix)) {
            baseChord = baseChord.slice(0, -suffix.length);
            chordType = suffix;
            break;
        }
    }

    const currentIndex = chords.indexOf(baseChord);
    if (currentIndex === -1) return chord; // Если аккорд не найден, возвращаем его без изменений

    const newIndex = (currentIndex + transposition + chords.length) % chords.length;
    const transposedBaseChord = chords[newIndex] + chordType;

    if (bassNote) {
        const bassIndex = chords.indexOf(bassNote);
        if (bassIndex !== -1) {
            const newBassIndex = (bassIndex + transposition + chords.length) % chords.length;
            return `${transposedBaseChord}/${chords[newBassIndex]}`;
        }
    }

    return transposedBaseChord;
}

function cleanChord(chord) {
    return chord.replace(/\s+/g, ''); // Удаляет все пробелы внутри аккорда
}

// Обработка текста с аккордами и транспонирование
function transposeLyrics(lyrics, transposition) {
    return lyrics.split('\n').map(line => {
        // Разделяем строку на слова и пробелы
        return line.split(/(\S+)/).map(word => {
            // Если слово — это аккорд, транспонируем его
            if (chords.some(ch => word.startsWith(ch))) {
                return transposeChord(cleanChord(word), transposition);
            }
            // Иначе оставляем слово без изменений
            return word;
        }).join('');
    }).join('\n');
}


// Функция для обработки строк с аккордами и уменьшения пробелов
function processLyrics(lyrics) {
    return lyrics.split('\n').map(line => {
        return line.replace(/ {2,}/g, match => ' '.repeat(Math.ceil(match.length / 2)));
    }).join('\n');
}


function displayFavorites() {
    const favoritesContainer = document.createElement('div');
    favoritesContainer.id = 'favorites-container';
    favoritesContainer.innerHTML = '<h2>Избранное</h2>';

    favorites.forEach(fav => {
        const favoriteItem = document.createElement('div');
        favoriteItem.textContent = fav.name;
        favoriteItem.className = 'favorite-item';
        favoriteItem.addEventListener('click', () => {
            sheetSelect.value = fav.sheet;
            songSelect.value = fav.index;
            displaySongDetails(cachedData[fav.sheet][fav.index], fav.index);
        });
        favoritesContainer.appendChild(favoriteItem);
    });

    document.body.appendChild(favoritesContainer);
}

function highlightChords(lyrics) {
    return lyrics.split('\n').map(line => {
        return line.replace(/([A-H][#b]?(?:maj7|m7|7|m|dim|aug|sus2|sus4|add9|dim7|aug7|sus)?(?:\/[A-H][#b]?)?)/g, '<span class="chord">$1</span>');
    }).join('\n');
}

// Функция обновления транспонированного текста
function updateTransposedLyrics() {
    const index = keySelect.dataset.index;
    if (!index) return;

    const sheetName = SHEETS[sheetSelect.value];
    if (!sheetName) return;

    const songData = cachedData[sheetName][index];
    if (!songData) return;

    const originalKey = songData[2]; // Тональность из столбца C
    const lyrics = songData[1] || ''; // Текст песни из столбца B
    const newKey = keySelect.value;

    // Вычисляем транспозицию
    const transposition = getTransposition(originalKey, newKey);

    // Транспонируем текст песни
    const transposedLyrics = transposeLyrics(lyrics, transposition);

    // Обрабатываем текст для корректного отображения
    const processedLyrics = processLyrics(transposedLyrics);

// Выделяем аккорды
    const highlightedLyrics = highlightChords(processedLyrics);


    // Обновляем содержимое страницы
    songContent.innerHTML = `
        <h2>${songData[0]} — ${newKey}</h2>
        <pre>${highlightedLyrics}</pre>
    `;
}

sheetSelect.addEventListener('change', async () => {
    const sheetName = SHEETS[sheetSelect.value];
    if (!sheetName) return;

    const rows = await fetchSheetData(sheetName);
    songSelect.innerHTML = '<option value="">-- Выберите песню --</option>';
    rows.forEach((row, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = row[0];
        songSelect.appendChild(option);
    });

    songSelect.disabled = rows.length === 0;
    searchInput.value = ''; // Сбрасываем поле поиска
    searchResults.innerHTML = ''; // Очищаем результаты поиска
});

// Обработчики событий
searchInput.addEventListener('input', () => searchSongs(searchInput.value));
sheetSelect.addEventListener('change', loadSheetSongs);
songSelect.addEventListener('change', () => {
    const sheetName = SHEETS[sheetSelect.value];
    if (!sheetName || !cachedData[sheetName]) return;
    
    const songIndex = parseInt(songSelect.value); // Преобразуем в число
    if (isNaN(songIndex)) return;

    displaySongDetails(cachedData[sheetName][songIndex], songIndex);
});


// Добавляем отсутствующую функцию loadSheetSongs
async function loadSheetSongs() {
    const sheetName = SHEETS[sheetSelect.value];
    if (!sheetName) return;

    const rows = await fetchSheetData(sheetName);
    songSelect.innerHTML = ''; // Очищаем предыдущие опции

    rows.forEach((row, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = row[0]; // Название песни
        songSelect.appendChild(option);
    });

    songSelect.disabled = rows.length === 0;
}


// Функция для отображения текста песни
function displaySongDetails(songData, index, key) {
    if (!songData) return;

    const originalKey = key || songData[2]; // Используем сохраненную тональность, если она передана
    const bpm = songData[4] || 'N/A';
    const lyrics = songData[1] || '';
    const sourceUrl = songData[3] || '#';

// Обновляем BPM
    updateBPM(bpm);

    bpmDisplay.textContent = bpm;

    // Обновляем ссылку для кнопки Holychords
    if (sourceUrl && sourceUrl.trim() !== '') {
        holychordsButton.href = sourceUrl; // Устанавливаем ссылку
        holychordsButton.style.display = 'inline-block'; // Показываем кнопку
    } else {
        holychordsButton.href = '#'; // Если ссылки нет, делаем её неактивной
        holychordsButton.style.display = 'none'; // Скрываем кнопку
    }

    // Обрабатываем и выделяем аккорды
    const highlightedLyrics = highlightChords(processLyrics(lyrics));

    // Обновляем содержимое страницы
    songContent.innerHTML = `
        ${songData[0]} — ${originalKey}
${highlightedLyrics}
    `;

    keySelect.value = originalKey;
    keySelect.dataset.index = index;

    // Вызываем функцию для транспонирования аккордов
    updateTransposedLyrics();
}

// Обработчик кнопки Holychords
holychordsButton.addEventListener('click', (event) => {
    if (holychordsButton.href === '#' || holychordsButton.href === '') {
        event.preventDefault(); // Предотвращаем переход, если ссылка пустая
        alert('Ссылка на Holychords отсутствует для этой песни.');
    }
});

keySelect.addEventListener('change', () => {
    updateTransposedLyrics();
});

// Функционал кнопки "Разделить текст"
if (!splitTextButton || !songContent) {
    console.error('Не удалось найти элементы с id "split-text-button" или "song-content".');
} else {
    splitTextButton.addEventListener('click', () => {
        const lyricsElement = document.querySelector('#song-content pre');
        if (!lyricsElement || !lyricsElement.textContent.trim()) {
            alert('Текст песни отсутствует или пуст.');
            return;
        }

        songContent.classList.toggle('split-columns');

        if (songContent.classList.contains('split-columns')) {
            splitTextButton.textContent = 'Объединить текст';
        } else {
            splitTextButton.textContent = 'Разделить текст';
        }
    });
}

// Добавьте массив для хранения данных всех листов
let allSheetsData = [];
let searchIndex = [];

// Функция для загрузки данных со всех листов
async function loadAllSheetsData() {
    loadingIndicator.style.display = 'block';
    
    try {
        // Получаем все листы параллельно
        const sheetPromises = Object.values(SHEETS).map(sheetName => fetchSheetData(sheetName));
        const results = await Promise.all(sheetPromises);
        
        // Сохраняем данные всех листов
        allSheetsData = results.map((data, index) => ({
            sheetName: Object.keys(SHEETS)[index],
            data: data
        }));
        
        // Создаем индекс для поиска
        createSearchIndex();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

let currentFontSize = 10; // Начальный размер шрифта (фиксированное значение)

// Убираем функцию getInitialFontSize

document.getElementById('zoom-in').addEventListener('click', () => {
    currentFontSize += 2;
    updateFontSize();
});

document.getElementById('zoom-out').addEventListener('click', () => {
    if (currentFontSize > 8) { // Минимальный размер шрифта
        currentFontSize -= 2;
        updateFontSize();
    }
});

function updateFontSize() {
    const lyricsElement = document.querySelector('#song-content pre');
    if (lyricsElement) {
        lyricsElement.style.fontSize = `${currentFontSize}px`;
    }
}

// Дополнительная функция для сброса размера шрифта к начальному значению
function resetFontSize() {
    currentFontSize = 10; // Возвращаемся к начальному размеру
    updateFontSize();
}


// Функция для загрузки избранных песен из localStorage
// Функция для загрузки избранных песен из localStorage
function loadFavorites(container = document.getElementById('favorites-list')) {
    // ... (код для очистки контейнера и проверки на пустоту) ...

    favorites.forEach(fav => {
        const favoriteItem = document.createElement('div');
        favoriteItem.textContent = `${fav.name} — ${fav.key}`; // Добавляем тональность
        favoriteItem.className = 'favorite-item';

        // Кнопка удаления (ваш код кнопки) ...
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌';
        removeBtn.className = 'remove-button';
        removeBtn.addEventListener('click', () => {
            removeFromFavorites(fav);
        });
        favoriteItem.appendChild(removeBtn);

        // Обработчик клика по песне
        favoriteItem.addEventListener('click', async (e) => {
            if (e.target.tagName === 'BUTTON') return; // Игнорируем клик на кнопке

            const sheetName = fav.sheet;
            const songIndex = fav.index;

            // Устанавливаем выбранный лист
            sheetSelect.value = Object.keys(SHEETS).find(key => SHEETS[key] === sheetName);

            // Загружаем данные листа, если они ещё не загружены
            if (!cachedData[sheetName]) {
                await fetchSheetData(sheetName);
            }

            // Обновляем выпадающий список песен
            await loadSheetSongs();

            // Устанавливаем выбранную песню
            songSelect.value = songIndex;

            // Отображаем детали песни
            displaySongDetails(cachedData[sheetName][songIndex], songIndex, fav.key);

            // Обновляем транспонирование аккордов (уже вызывается в displaySongDetails, можно убрать дубль)
            // updateTransposedLyrics();

            // >>>>> ВОТ ЭТА СТРОКА: Закрываем панель <<<<<
            if (favoritesPanel) {
                 favoritesPanel.classList.remove('open');
            }
            // >>>>> КОНЕЦ ДОБАВЛЕННОЙ СТРОКИ <<<<<
        });

        container.appendChild(favoriteItem);
    });
}

// Функция для добавления песни в избранное
favoriteButton.addEventListener('click', () => {
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;

    if (!sheetName || !songIndex) return;

    const songData = cachedData[sheetName][songIndex];
    if (!songData) return;

    const song = {
        name: songData[0],
        sheet: sheetName,
        index: songIndex,
        key: keySelect.value // Сохраняем текущую тональность
    };

    let storedFavorites = JSON.parse(localStorage.getItem('favorites')) || [];

    if (!storedFavorites.some(fav => fav.name === song.name && fav.sheet === song.sheet && fav.index === song.index)) {
        storedFavorites.push(song);
        localStorage.setItem('favorites', JSON.stringify(storedFavorites));
        favorites = storedFavorites; // Обновляем массив favorites в памяти
        loadFavorites(); // Перезагружаем список избранного
    } else {
        alert('Песня уже в избранном!');
    }
});


// Функция для удаления песни из избранного
function removeFromFavorites(fav) {
    const index = favorites.findIndex(item => item.name === fav.name && item.sheet === fav.sheet && item.index === fav.index);
    if (index !== -1) {
        favorites.splice(index, 1);
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }

    loadGroupPanel(); // Перезагружаем панель "Группа"
}

// Переключение видимости панели
toggleFavoritesButton.addEventListener('click', () => {
    favoritesPanel.classList.toggle('open');
    loadFavorites(); // Загружаем избранные песни при открытии панели
});








// Функция для добавления песни в общий список
// Функция для добавления песни в общий список (с проверками лимита и дублей)
async function addToSharedList(songData) { // Делаем функцию асинхронной
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;

    // Проверка, что все нужные данные существуют
    if (!sheetName || !songIndex || !songData || !songData[0]) {
         console.error("addToSharedList: Данные для добавления песни отсутствуют или некорректны.");
         alert("Не удалось добавить песню: недостаточно данных. Выберите песню.");
         return;
    }

    const song = {
        name: songData[0],
        sheet: sheetName,
        index: songIndex, // <- Убедитесь, что index здесь строка
        key: keySelect.value,
        timestamp: new Date().toISOString()
    };

    console.log("addToSharedList: Попытка добавить песню:", song); // Выводим объект песни

    const maxSongs = 8;

    try {
        // --- ПРОВЕРКА 1: Лимит количества песен ---
        console.log("addToSharedList: Проверка лимита...");
        const countQuery = query(sharedListCollection);
        const countSnapshot = await getDocs(countQuery);
        console.log(`addToSharedList: Текущий размер списка: ${countSnapshot.size}`); // Выводим размер

        if (countSnapshot.size >= maxSongs) {
            console.log("addToSharedList: ПРОВЕРКА ЛИМИТА НЕ ПРОЙДЕНА.");
            alert(`В общем списке уже ${countSnapshot.size} песен. Достигнут лимит (${maxSongs}).`);
            return;
        }
        console.log("addToSharedList: Проверка лимита ПРОЙДЕНА.");

        // --- ПРОВЕРКА 2: Дубликаты ---
        console.log(`addToSharedList: Проверка дубликатов для sheet: ${song.sheet}, index: ${song.index} (тип ${typeof song.index})`);
        const duplicateQuery = query(sharedListCollection,
                                     where("sheet", "==", song.sheet),
                                     where("index", "==", song.index)); // Сравниваем sheet и index
        const duplicateSnapshot = await getDocs(duplicateQuery);
        console.log(`addToSharedList: Найдено дубликатов: ${duplicateSnapshot.size}`); // Выводим кол-во найденных дублей

        if (!duplicateSnapshot.empty) { // duplicateSnapshot.empty это true, если size = 0
            console.log("addToSharedList: ПРОВЕРКА ДУБЛИКАТОВ НЕ ПРОЙДЕНА.");
            alert(`Песня "${song.name}" уже есть в общем списке.`);
            return;
        }
        console.log("addToSharedList: Проверка дубликатов ПРОЙДЕНА.");


        // --- ДОБАВЛЕНИЕ ПЕСНИ ---
        console.log("addToSharedList: Добавляем песню в Firestore...");
        await addDoc(sharedListCollection, song);
        console.log(`addToSharedList: Песня "${song.name}" успешно добавлена.`);

    } catch (error) {
        // Выводим ошибку, если что-то пошло не так внутри try
        console.error("addToSharedList: Ошибка при проверке или добавлении:", error);
        alert("Произошла ошибка при добавлении песни. Пожалуйста, попробуйте еще раз.");
    }
}

// Обработчик кнопки "Добавить в список"
// Обработчик кнопки "Добавить в список" (ОБНОВЛЕННЫЙ)
document.getElementById('add-to-list-button').addEventListener('click', () => {
    const sheetName = SHEETS[sheetSelect.value];
    const songIndex = songSelect.value;

    // Улучшенная проверка перед вызовом
    if (!sheetName || !songIndex || !cachedData[sheetName] || !cachedData[sheetName][songIndex]) {
         alert("Сначала выберите песню для добавления.");
         return;
    }

    const songData = cachedData[sheetName][songIndex];
    addToSharedList(songData); // Просто вызываем async функцию
    // loadGroupPanel(); // <-- УБРАЛИ ЭТУ СТРОКУ
});


// Функция для загрузки и отображения общего списка песен
function loadSharedList(container = document.getElementById('shared-songs-list')) {
    if (!container) {
        console.error("Контейнер для общего списка песен не найден.");
        return;
    }

    container.innerHTML = ''; // Можно очистить здесь для первоначального состояния

    // >>>>> ВОТ ЭТА СТРОКА ДОЛЖНА БЫТЬ <<<<<
    // Создаем запрос к коллекции sharedList.
    // Если нужна сортировка, добавьте ее сюда, например:
    // Было: const q = query(sharedListCollection);
// Стало (сортировка по возрастанию timestamp - старые вверху):
const q = query(sharedListCollection, orderBy("timestamp", "asc"));

    // Устанавливаем слушатель изменений в реальном времени
    onSnapshot(q, (snapshot) => {
        // Очищаем контейнер ПЕРЕД добавлением обновленных данных
        container.innerHTML = '';

        // Проверяем, пуст ли список (более современный способ)
        if (snapshot.empty) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = 'Нет песен в общем списке';
            emptyMessage.className = 'empty-message';
            container.appendChild(emptyMessage);
            return; // Выходим, если список пуст
        }

        // Перебираем документы из снимка
        snapshot.docs.forEach((doc) => {
            const song = doc.data();
            const docId = doc.id;

            const listItem = document.createElement('div');
            listItem.className = 'shared-item';

            // Отображаем название песни и тональность
            const songNameElement = document.createElement('span');
            songNameElement.textContent = `${song.name} — ${song.key}`;
            songNameElement.className = 'song-name';

            // Обработчик клика по названию песни (с закрытием панели)
            songNameElement.addEventListener('click', async () => {
                const sheetName = song.sheet;
                const songIndex = song.index;

                // Устанавливаем выбранный лист
                sheetSelect.value = Object.keys(SHEETS).find(key => SHEETS[key] === sheetName);

                // Загружаем данные листа, если они ещё не загружены
                if (!cachedData[sheetName]) {
                    await fetchSheetData(sheetName);
                }

                // Обновляем выпадающий список песен
                await loadSheetSongs();

                // Устанавливаем выбранную песню
                songSelect.value = songIndex;

                // Отображаем детали песни
                displaySongDetails(cachedData[sheetName][songIndex], songIndex, song.key);

                // Закрываем панель
                if (favoritesPanel) {
                     favoritesPanel.classList.remove('open');
                }
            });

            // Кнопка удаления
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '❌';
            deleteButton.className = 'delete-button';
            deleteButton.addEventListener('click', () => {
                if (confirm(`Удалить песню "${song.name}" из общего списка?`)) {
                    deleteFromSharedList(docId);
                    // Перезагрузка списка здесь не нужна, onSnapshot сам обновит интерфейс
                }
            });

            listItem.appendChild(songNameElement);
            listItem.appendChild(deleteButton);
            container.appendChild(listItem); // Добавляем элемент в контейнер
        });

    }, (error) => { // Добавляем обработчик ошибок для самого onSnapshot
        console.error("Ошибка при получении данных общего списка:", error);
        container.innerHTML = '<div class="empty-message">Не удалось загрузить общий список.</div>';
    });
}

function loadGroupPanel() {
    const myFavoritesContainer = document.getElementById('favorites-list');
    const sharedSongsContainer = document.getElementById('shared-songs-list');

    if (!myFavoritesContainer || !sharedSongsContainer) {
        console.error("Контейнеры для списков не найдены.");
        return;
    }

    // Очищаем предыдущие результаты
    myFavoritesContainer.innerHTML = '';
    sharedSongsContainer.innerHTML = '';

    // Загружаем "Мой список"
    loadFavorites(myFavoritesContainer);

    // Загружаем "Общий список"
    loadSharedList(sharedSongsContainer);
}

// Функция для удаления песни из общего списка
async function deleteFromSharedList(docId) {
    try {
        await deleteDoc(doc(db, "sharedList", docId));
    } catch (error) {
        console.error("Ошибка при удалении песни:", error);
        alert("Не удалось удалить песню. Попробуйте еще раз.");
    }

    loadGroupPanel(); // Перезагружаем панель "Группа"
}


// Загрузка списка при старте
document.addEventListener('DOMContentLoaded', () => {
    const toggleFavoritesButton = document.getElementById('toggle-favorites');
    const favoritesPanel = document.getElementById('favorites-panel');

    if (!toggleFavoritesButton || !favoritesPanel) {
        console.error("Элементы 'toggle-favorites' или 'favorites-panel' не найдены.");
        return;
    }

    toggleFavoritesButton.addEventListener('click', () => {
        favoritesPanel.classList.toggle('open');

        if (favoritesPanel.classList.contains('open')) {
            loadGroupPanel(); // Загружаем содержимое панели
        }
    });

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация метронома
    const metronomeButton = document.getElementById('metronome-button');
    if (metronomeButton) {
        metronomeButton.addEventListener('click', () => {
            const bpmDisplay = document.getElementById('bpm-display');
            const bpm = parseInt(bpmDisplay.textContent, 10);

            if (!isNaN(bpm) && bpm > 0) {
                toggleMetronome(bpm);
            } else {
                alert('BPM не указан или некорректен.');
            }
        });
    }
});

    loadAllSheetsData(); // Загружаем данные при старте
    loadFavorites(); // Загружаем избранные песни
    loadSharedList(); // Загружаем общий список песен
});


document.getElementById('toggle-favorites').addEventListener('click', () => {
    const panel = document.getElementById('favorites-panel');
    if (!panel) {
        console.error("Элемент 'favorites-panel' не найден.");
        return;
    }
    console.log("Переключение класса 'open'");
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        console.log("Панель открыта, загружаем данные.");
        loadGroupPanel();
    } else {
        console.log("Панель закрыта.");
    }
});







// Возобновление AudioContext при пользовательском действии
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext успешно возобновлен.');
        }).catch((error) => {
            console.error('Ошибка возобновления AudioContext:', error);
        });
    }
}

// Загрузка аудиофайла
async function loadAudioFile() {
    if (!audioContext) {
        setupAudioContext();
    }

    const fileUrl = 'https://firebasestorage.googleapis.com/v0/b/song-archive-389a6.firebasestorage.app/o/metronome-85688%20(mp3cut.net).mp3?alt=media&token=97b66349-7568-43eb-80c3-c2278ff38c10';
    try {
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log("Аудиофайл успешно загружен.");
    } catch (error) {
        console.error('Ошибка загрузки аудиофайла:', error);
    }
}

// Воспроизведение щелчка метронома
function playClick() {
    if (!audioContext || !audioBuffer) {
        console.error("Аудиофайл не загружен.");
        return;
    }

    resumeAudioContext(); // Возобновляем AudioContext, если он приостановлен

    const timeSignature = document.getElementById('time-signature').value;
    const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    // Настройка громкости: акцент на первый удар
    const gainNode = audioContext.createGain();
    gainNode.gain.value = currentBeat % beatsPerMeasure === 0 ? 1 : 0.5;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start();
    currentBeat = (currentBeat + 1) % beatsPerMeasure;
}

// Переключение метронома
function toggleMetronome(bpm) {
    if (isMetronomeActive) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        isMetronomeActive = false;
        document.getElementById('metronome-button').textContent = '▶️ Включить метроном';
    } else {
        const timeSignature = document.getElementById('time-signature').value;
        const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10);
        const interval = (60000 / bpm) * (4 / beatsPerMeasure);

        metronomeInterval = setInterval(playClick, interval);
        isMetronomeActive = true;
        document.getElementById('metronome-button').textContent = '⏹️ Выключить метроном';
    }
}


// Обработчик кнопки метронома
document.getElementById('metronome-button').addEventListener('click', async () => {
    // Инициализируем AudioContext при первом клике
    if (!audioContext) {
        setupAudioContext();
    }

    // Загружаем аудиофайл, если он еще не загружен
    if (!audioBuffer) {
        await loadAudioFile();
    }

    resumeAudioContext(); // Возобновляем AudioContext

    const bpmDisplay = document.getElementById('bpm-display');
    const bpm = parseInt(bpmDisplay.textContent, 10);

    if (!isNaN(bpm) && bpm > 0) {
        toggleMetronome(bpm);
    } else {
        alert('BPM не указан или некорректен.');
    }
});

// Обновление BPM
document.getElementById('bpm-display').addEventListener('blur', () => {
    const newBPM = parseInt(document.getElementById('bpm-display').textContent, 10);

    if (!isNaN(newBPM) && newBPM > 0) {
        updateBPM(newBPM);
    } else {
        alert('Введите корректное значение BPM.');
        document.getElementById('bpm-display').textContent = '-';
    }
});

function updateBPM(newBPM) {
    document.getElementById('bpm-display').textContent = newBPM || '-';

    if (isMetronomeActive) {
        toggleMetronome(newBPM);
    }
}
