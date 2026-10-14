(() => {

        // Global Application State Variables
        let questionsData = [];
        let generatedVersions = {}; // Holds { 'Version A': [...], 'Version B': [...] }
        let activeVersionKey = 'Version A';
        let currentSlideIndex = 0;
        let timerInterval = null;
        let timerSeconds = 0;
        let classroomFontSize = 24; // Default font size in pixels for classroom presentation mode
        let peerFontSize = 26; // Default font size in pixels for peer checking mode
        let peerCheckingSlideIndex = 0;
        let peerCheckingViewMode = 'slide'; // 'slide' or 'grid'
        let peerAnswerVisible = false; // Default: hidden until teacher/students guess and click reveal
        let isNavCollapsed = false; // State variable for collapsible navigation header

        // Function to toggle auto-hiding navigation bar & top header
        function toggleHeaderNav() {
            const header = document.getElementById('mainHeader');
            const mainTabs = document.getElementById('mainTabs');
            const navBar = document.getElementById('mainNavBar');
            const icon = document.getElementById('toggleNavIcon');

            isNavCollapsed = !isNavCollapsed;

            if (isNavCollapsed) {
                header.classList.add('hidden');
                mainTabs.classList.add('hidden');
                navBar.classList.remove('top-16');
                navBar.classList.add('top-0');
                if (icon) {
                    icon.setAttribute('data-lucide', 'chevron-down');
                }
            } else {
                header.classList.remove('hidden');
                mainTabs.classList.remove('hidden');
                navBar.classList.remove('top-0');
                navBar.classList.add('top-16');
                if (icon) {
                    icon.setAttribute('data-lucide', 'chevron-up');
                }
            }
            if (window.lucide) {
                lucide.createIcons();
            }
        }

        // Default Sample Data Initialization
        const sampleQuestions = [
            {
                id: 1,
                question: "Which of the following cellular organelles is primarily responsible for ATP energy production?",
                type: "Multiple Choice",
                choices: ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"],
                correctAnswer: "Mitochondria"
            },
            {
                id: 2,
                question: "Photosynthesis takes place predominantly in which part of the plant cell?",
                type: "Multiple Choice",
                choices: ["Chloroplast", "Vacuole", "Golgi Body", "Cell Wall"],
                correctAnswer: "Chloroplast"
            },
            {
                id: 3,
                question: "Deoxyribonucleic acid (DNA) possesses a double-helix structure.",
                type: "True/False",
                choices: ["True", "False"],
                correctAnswer: "True"
            },
            {
                id: 4,
                question: "What is the term given to the process by which liquid water changes into water vapor?",
                type: "Identification",
                choices: [],
                correctAnswer: "Evaporation"
            }
        ];

        // Local Storage Persistence
        // A single namespaced key keeps this application's saved data separate from other websites.
        const STORAGE_KEY = 'examShufflePro.v1.state';
        const HEADER_INPUT_IDS = [
            'inputSchoolName',
            'inputDepartment',
            'inputExamTitle',
            'inputSubject',
            'inputTeacher',
            'inputTerm',
            'inputInstructions',
            'inputLeftLogoUrl',
            'inputLogoUrl'
        ];

        // Save the current question bank, exam header, and generated exam versions.
        // Storage failures (for example, a full browser quota or private browsing restrictions)
        // are handled gracefully so the application can still be used in the current session.
        function saveApplicationState() {
            try {
                const headerInputs = {};
                HEADER_INPUT_IDS.forEach(id => {
                    const input = document.getElementById(id);
                    if (input) headerInputs[id] = input.value;
                });

                const state = {
                    schemaVersion: 1,
                    savedAt: new Date().toISOString(),
                    questionsData: questionsData,
                    headerInputs: headerInputs,
                    generatedVersions: generatedVersions,
                    activeVersionKey: activeVersionKey,
                    toggleShuffleChoices: document.getElementById('toggleShuffleChoices')?.checked ?? true,
                    toggleIncludeAnswerKey: document.getElementById('toggleIncludeAnswerKey')?.checked ?? true,
                    selectVersionCount: document.getElementById('selectVersionCount')?.value ?? '1'
                };

                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                return true;
            } catch (error) {
                console.warn('Unable to save ExamShuffle Pro state to localStorage.', error);
                return false;
            }
        }

        // Read saved state safely and reject malformed data rather than breaking initialization.
        function loadApplicationState() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) return null;

                const state = JSON.parse(saved);
                if (!state || state.schemaVersion !== 1 ||
                    !Array.isArray(state.questionsData) ||
                    typeof state.generatedVersions !== 'object' ||
                    state.generatedVersions === null ||
                    Array.isArray(state.generatedVersions)) {
                    return null;
                }

                return state;
            } catch (error) {
                console.warn('Unable to read saved ExamShuffle Pro state. Starting with defaults.', error);
                return null;
            }
        }

        // Restore the saved state and redraw the parts of the interface that depend on it.
        function restoreApplicationState(state) {
            if (!state) return false;

            questionsData = state.questionsData;
            generatedVersions = state.generatedVersions;

            if (!Object.keys(generatedVersions).length) {
                generatedVersions['Version A'] = JSON.parse(JSON.stringify(questionsData));
            }

            activeVersionKey = generatedVersions[state.activeVersionKey]
                ? state.activeVersionKey
                : (Object.keys(generatedVersions)[0] || 'Version A');

            HEADER_INPUT_IDS.forEach(id => {
                const input = document.getElementById(id);
                if (input && state.headerInputs && Object.prototype.hasOwnProperty.call(state.headerInputs, id)) {
                    input.value = String(state.headerInputs[id] ?? '');
                }
            });

            const shuffleToggle = document.getElementById('toggleShuffleChoices');
            const answerToggle = document.getElementById('toggleIncludeAnswerKey');
            const versionCount = document.getElementById('selectVersionCount');

            if (shuffleToggle && typeof state.toggleShuffleChoices === 'boolean') {
                shuffleToggle.checked = state.toggleShuffleChoices;
            }
            if (answerToggle && typeof state.toggleIncludeAnswerKey === 'boolean') {
                answerToggle.checked = state.toggleIncludeAnswerKey;
            }
            if (versionCount && state.selectVersionCount) {
                versionCount.value = state.selectVersionCount;
            }

            return true;
        }

        // Clear only this application's cache and restore its original starting values.
        function clearCache() {
            const confirmed = window.confirm(
                'Clear the saved ExamShuffle Pro cache? This will remove saved questions and generated versions, and restore the original exam header values.'
            );
            if (!confirmed) return;

            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.warn('Unable to remove ExamShuffle Pro localStorage cache.', error);
            }

            questionsData = JSON.parse(JSON.stringify(sampleQuestions));
            generatedVersions = {
                'Version A': JSON.parse(JSON.stringify(questionsData))
            };
            activeVersionKey = 'Version A';
            currentSlideIndex = 0;
            peerCheckingSlideIndex = 0;
            peerAnswerVisible = false;

            HEADER_INPUT_IDS.forEach(id => {
                const input = document.getElementById(id);
                if (input) input.value = input.defaultValue;
            });

            const shuffleToggle = document.getElementById('toggleShuffleChoices');
            const answerToggle = document.getElementById('toggleIncludeAnswerKey');
            const versionCount = document.getElementById('selectVersionCount');
            if (shuffleToggle) shuffleToggle.checked = true;
            if (answerToggle) answerToggle.checked = true;
            if (versionCount) versionCount.value = '1';

            renderHeaderPreview();
            renderQuestionsEditor();
            updateGlobalStats();
            renderVersionTabs();
            renderExamPreview();
            showToast('Saved cache cleared. Original defaults have been restored.', 'success');
            saveApplicationState();
        }

        // Initialize Application
        window.addEventListener('DOMContentLoaded', () => {
            const restored = restoreApplicationState(loadApplicationState());

            if (!restored) {
                questionsData = JSON.parse(JSON.stringify(sampleQuestions));
                generatedVersions = {
                    'Version A': JSON.parse(JSON.stringify(questionsData))
                };
                activeVersionKey = 'Version A';
            }

            updateHeaderPreviewListeners();
            // Both linked logos update the preview and printed examination header independently.
            ['inputLeftLogoUrl', 'inputLogoUrl'].forEach(logoInputId => {
                const logoInput = document.getElementById(logoInputId);
                if (logoInput) {
                    logoInput.addEventListener('input', renderLogoPreview);
                    logoInput.addEventListener('change', renderLogoPreview);
                }
            });
            renderHeaderPreview();
            renderQuestionsEditor();
            updateGlobalStats();
            setupDragAndDrop();

            // Save header edits immediately, and save other interface edits after user interaction.
            HEADER_INPUT_IDS.forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('input', scheduleApplicationStateSave);
                    input.addEventListener('change', scheduleApplicationStateSave);
                }
            });

            document.addEventListener('input', scheduleApplicationStateSave, true);
            document.addEventListener('change', scheduleApplicationStateSave, true);
            document.addEventListener('click', scheduleApplicationStateSave, true);

            // Periodic backup catches state changes made by existing functions without altering their logic.
            window.setInterval(saveApplicationState, 1500);
            saveApplicationState();

            // Re-initialize Lucide Icons
            if (window.lucide) lucide.createIcons();
        });

        let saveStateTimeout = null;

        // Debounce repeated UI events to avoid writing to localStorage excessively.
        function scheduleApplicationStateSave() {
            window.clearTimeout(saveStateTimeout);
            saveStateTimeout = window.setTimeout(saveApplicationState, 150);
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            
            // Reset all tab styling to sleek dark mode base style
            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.id === 'btn-tab-peer-checking') {
                    btn.className = "tab-btn flex items-center space-x-2.5 px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl whitespace-nowrap transition-all duration-200 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-2 border-amber-300 opacity-90 hover:opacity-100";
                } else if (btn.id === 'btn-tab-quiz-bee') {
                    btn.className = "tab-btn flex items-center space-x-2.5 px-4 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl whitespace-nowrap transition-all duration-200 bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white border-2 border-fuchsia-300 opacity-90 hover:opacity-100";
                } else {
                    btn.className = "tab-btn flex items-center space-x-2.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl whitespace-nowrap transition-all duration-200 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700";
                }
            });

            // Unhide selected content block
            document.getElementById(tabId).classList.remove('hidden');
            
            // Apply vibrant, conspicuous active highlighting
            const activeBtn = document.getElementById(`btn-${tabId}`);
            if (activeBtn) {
                if (tabId === 'tab-peer-checking') {
                    activeBtn.className = "tab-btn flex items-center space-x-2.5 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl whitespace-nowrap transition-all duration-200 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/40 ring-4 ring-amber-300/80 border-2 border-amber-200 scale-105 z-10";
                } else {
                    activeBtn.className = "tab-btn flex items-center space-x-2.5 px-4 py-2.5 text-xs sm:text-sm font-black rounded-xl whitespace-nowrap transition-all duration-200 bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-4 ring-indigo-400/80 border-2 border-indigo-300 scale-105 z-10";
                }
            }

            if (tabId === 'tab-randomize') {
                renderVersionTabs();
                renderExamPreview();
            } else if (tabId === 'tab-classroom') {
                initClassroomMode();
            } else if (tabId === 'tab-peer-checking') {
                initPeerCheckingMode();
            } else if (tabId === 'tab-quiz-bee') {
                renderQuizBeeQuestion();
            }
        }

        function updateHeaderPreviewListeners() {
            const inputs = ['SchoolName', 'Department', 'ExamTitle', 'Subject', 'Teacher', 'Term', 'Instructions'];
            inputs.forEach(id => {
                const el = document.getElementById(`input${id}`);
                if (el) {
                    el.addEventListener('input', renderHeaderPreview);
                }
            });
        }

        function renderHeaderPreview() {
            document.getElementById('prevSchool').innerText = document.getElementById('inputSchoolName').value || 'SCHOOL NAME';
            document.getElementById('prevDept').innerText = document.getElementById('inputDepartment').value || '';
            document.getElementById('prevTitle').innerText = document.getElementById('inputExamTitle').value || 'EXAMINATION';
            document.getElementById('prevSubj').innerText = document.getElementById('inputSubject').value || '';
            document.getElementById('prevTeacher').innerText = document.getElementById('inputTeacher').value || '';
            document.getElementById('prevTerm').innerText = document.getElementById('inputTerm').value || '';
            document.getElementById('prevInstructions').innerText = document.getElementById('inputInstructions').value || '';
            document.getElementById('prevTotalItems').innerText = questionsData.length;
            renderLogoPreview();
        }

        // Display both linked logos in the live preview and keep broken images from appearing.
        // The left logo is intentionally positioned close to the school/exam heading.
        function renderLogoPreview() {
            const logoPairs = [
                { inputId: 'inputLeftLogoUrl', imageId: 'prevLeftLogo', placeholderId: 'prevLeftLogoPlaceholder', label: 'LEFT LOGO' },
                { inputId: 'inputLogoUrl', imageId: 'prevLogo', placeholderId: 'prevLogoPlaceholder', label: 'RIGHT LOGO' }
            ];

            logoPairs.forEach(pair => {
                const input = document.getElementById(pair.inputId);
                const logo = document.getElementById(pair.imageId);
                const placeholder = document.getElementById(pair.placeholderId);
                if (!input || !logo || !placeholder) return;

                const url = input.value.trim();
                logo.onerror = () => {
                    logo.classList.add('hidden');
                    placeholder.classList.remove('hidden');
                    placeholder.innerHTML = 'IMAGE<br>NOT FOUND';
                };
                logo.onload = () => {
                    logo.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                };

                if (!url) {
                    logo.removeAttribute('src');
                    logo.classList.add('hidden');
                    placeholder.classList.remove('hidden');
                    placeholder.innerHTML = pair.label.replace(' ', '<br>');
                } else if (logo.src !== url) {
                    logo.src = url;
                }
            });

            renderExamPreview();
        }

        function setupDragAndDrop() {
            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');

            dropZone.addEventListener('click', () => fileInput.click());

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
                if (e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                }
            });
        }

        function handleFileUpload(file) {
            const fileName = file.name.toLowerCase();
            showToast(`Uploading ${file.name}...`, 'info');

            if (fileName.endsWith('.docx')) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    mammoth.extractRawText({ arrayBuffer: event.target.result })
                        .then(result => {
                            parseTextContent(result.value);
                            showToast('Word document parsed successfully!', 'success');
                        })
                        .catch(err => {
                            showToast('Error reading Word document file.', 'error');
                            console.error(err);
                        });
                };
                reader.readAsArrayBuffer(file);
            } else if (fileName.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    parseTextContent(event.target.result);
                    showToast('Text file parsed successfully!', 'success');
                };
                reader.readAsText(file);
            } else {
                showToast('Unsupported file format. Please upload .docx or .txt', 'error');
            }
        }

        function parseRawText() {
            const raw = document.getElementById('rawTextPaste').value;
            if (!raw.trim()) {
                showToast('Please paste or enter questionnaire text first.', 'error');
                return;
            }
            parseTextContent(raw);
            showToast('Text parsed into questionnaire items!', 'success');
        }

        function parseTextContent(text) {
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            const parsedItems = [];
            let currentItem = null;

            const qNumRegex = /^(\d+)[\.\)]\s*(.+)/;
            const choiceRegex = /^(\*?)([A-Ea-e])[\.\)]\s*(.+)/;
            const answerRegex = /^Answer:\s*(.+)/i;
            const bracketAnsRegex = /\[Ans:\s*([A-Ea-e])\]/i;

            lines.forEach(line => {
                const qMatch = line.match(qNumRegex);
                const choiceMatch = line.match(choiceRegex);
                const ansMatch = line.match(answerRegex);
                const bracketMatch = line.match(bracketAnsRegex);

                if (qMatch) {
                    if (currentItem) parsedItems.push(currentItem);
                    currentItem = {
                        id: parsedItems.length + 1,
                        question: qMatch[2],
                        type: 'Multiple Choice',
                        choices: [],
                        correctAnswer: ''
                    };
                    if (bracketMatch) {
                        currentItem.pendingBracketAns = bracketMatch[1].toUpperCase();
                        currentItem.question = currentItem.question.replace(bracketAnsRegex, '').trim();
                    }
                } else if (choiceMatch && currentItem) {
                    const isStarred = choiceMatch[1] === '*';
                    const letter = choiceMatch[2].toUpperCase();
                    const choiceText = choiceMatch[3];
                    currentItem.choices.push(choiceText);
                    
                    if (isStarred || (currentItem.pendingBracketAns && currentItem.pendingBracketAns === letter)) {
                        currentItem.correctAnswer = choiceText;
                    }
                } else if (ansMatch && currentItem) {
                    currentItem.correctAnswer = ansMatch[1].trim();
                } else if (currentItem) {
                    currentItem.question += " " + line;
                }
            });

            if (currentItem) parsedItems.push(currentItem);

            // Determine question types dynamically
            parsedItems.forEach(item => {
                if (item.choices.length === 0) {
                    item.type = 'Identification';
                } else if (item.choices.length === 2 && 
                          item.choices.some(c => c.toLowerCase() === 'true') && 
                          item.choices.some(c => c.toLowerCase() === 'false')) {
                    item.type = 'True/False';
                } else {
                    item.type = 'Multiple Choice';
                }
            });

            if (parsedItems.length > 0) {
                questionsData = parsedItems;
                generatedVersions = { 'Version A': JSON.parse(JSON.stringify(questionsData)) };
                activeVersionKey = 'Version A';
                
                updateGlobalStats();
                renderQuestionsEditor();
                switchTab('tab-edit');
            } else {
                showToast('Could not detect numbered items. Please check formatting format.', 'error');
            }
        }

        function renderQuestionsEditor() {
            const container = document.getElementById('questionsContainer');
            if (questionsData.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <i data-lucide="help-circle" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
                        <p class="text-sm font-medium text-slate-600">No questions loaded yet.</p>
                        <p class="text-xs text-slate-400 mt-1">Upload a Word file or paste text in Tab 2 to get started.</p>
                    </div>`;
                lucide.createIcons();
                return;
            }

            container.innerHTML = questionsData.map((q, idx) => `
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition hover:border-slate-300">
                    <div class="flex items-start justify-between gap-4 mb-3">
                        <div class="flex items-center space-x-2">
                            <span class="bg-slate-800 text-white font-bold text-xs px-2.5 py-1 rounded-md">#${idx + 1}</span>
                            <select onchange="updateQuestionType(${idx}, this.value)" class="text-xs border border-slate-300 rounded px-2 py-1 bg-slate-50 font-medium text-slate-700">
                                <option value="Multiple Choice" ${q.type === 'Multiple Choice' ? 'selected' : ''}>Multiple Choice</option>
                                <option value="True/False" ${q.type === 'True/False' ? 'selected' : ''}>True / False</option>
                                <option value="Identification" ${q.type === 'Identification' ? 'selected' : ''}>Identification / Short Answer</option>
                            </select>
                        </div>
                        <button onclick="deleteQuestion(${idx})" class="text-slate-400 hover:text-rose-600 p-1 rounded transition" title="Delete Question">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Question Input -->
                    <div class="mb-3">
                        <input type="text" value="${escapeHtml(q.question)}" onchange="updateQuestionText(${idx}, this.value)" 
                            class="w-full font-medium text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <!-- Choices Inputs (If applicable) -->
                    ${q.type !== 'Identification' ? `
                        <div class="space-y-2 ml-2 pl-3 border-l-2 border-slate-200">
                            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Choices / Options (Check radio for correct answer):</label>
                            ${q.choices.map((c, cIdx) => `
                                <div class="flex items-center space-x-2">
                                    <input type="radio" name="correct_${idx}" ${q.correctAnswer === c ? 'checked' : ''} 
                                        onchange="setCorrectAnswer(${idx}, '${escapeHtml(c)}')" class="text-indigo-600 focus:ring-indigo-500">
                                    <input type="text" value="${escapeHtml(c)}" onchange="updateChoiceText(${idx}, ${cIdx}, this.value)"
                                        class="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500">
                                    <button onclick="removeChoice(${idx}, ${cIdx})" class="text-slate-300 hover:text-rose-500 p-1">
                                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            `).join('')}
                            <button onclick="addChoice(${idx})" class="mt-1 text-xs text-indigo-600 font-semibold hover:underline flex items-center space-x-1">
                                <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                                <span>Add Choice</span>
                            </button>
                        </div>
                    ` : `
                        <div class="mt-2">
                            <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Correct Answer Key:</label>
                            <input type="text" value="${escapeHtml(q.correctAnswer || '')}" onchange="updateIdentificationAnswer(${idx}, this.value)" 
                                placeholder="Enter correct answer..." class="w-full text-xs border border-slate-300 rounded px-3 py-1.5 mt-1 focus:ring-2 focus:ring-indigo-500">
                        </div>
                    `}
                </div>
            `).join('');

            lucide.createIcons();
            renderHeaderPreview();
        }

        function updateQuestionText(index, val) {
            questionsData[index].question = val;
            syncVersions();
        }

        function updateQuestionType(index, type) {
            questionsData[index].type = type;
            if (type === 'True/False') {
                questionsData[index].choices = ['True', 'False'];
            } else if (type === 'Identification') {
                questionsData[index].choices = [];
            }
            renderQuestionsEditor();
            syncVersions();
        }

        function updateChoiceText(qIdx, cIdx, val) {
            const oldVal = questionsData[qIdx].choices[cIdx];
            questionsData[qIdx].choices[cIdx] = val;
            if (questionsData[qIdx].correctAnswer === oldVal) {
                questionsData[qIdx].correctAnswer = val;
            }
            syncVersions();
        }

        function setCorrectAnswer(qIdx, choiceVal) {
            questionsData[qIdx].correctAnswer = choiceVal;
            syncVersions();
        }

        function updateIdentificationAnswer(qIdx, val) {
            questionsData[qIdx].correctAnswer = val;
            syncVersions();
        }

        function addChoice(qIdx) {
            questionsData[qIdx].choices.push(`Option ${questionsData[qIdx].choices.length + 1}`);
            renderQuestionsEditor();
            syncVersions();
        }

        function removeChoice(qIdx, cIdx) {
            questionsData[qIdx].choices.splice(cIdx, 1);
            renderQuestionsEditor();
            syncVersions();
        }

        function deleteQuestion(qIdx) {
            questionsData.splice(qIdx, 1);
            updateGlobalStats();
            renderQuestionsEditor();
            syncVersions();
            showToast('Item deleted', 'info');
        }

        function addNewQuestion() {
            questionsData.push({
                id: questionsData.length + 1,
                question: "New question text item...",
                type: "Multiple Choice",
                choices: ["Option A", "Option B", "Option C", "Option D"],
                correctAnswer: "Option A"
            });
            updateGlobalStats();
            renderQuestionsEditor();
            syncVersions();
            showToast('New question added', 'success');
        }

        function clearAllQuestions() {
            if (confirm("Are you sure you want to clear all questionnaire items?")) {
                questionsData = [];
                generatedVersions = { 'Version A': [] };
                updateGlobalStats();
                renderQuestionsEditor();
                showToast('All items cleared', 'info');
            }
        }

        function syncVersions() {
            generatedVersions['Version A'] = JSON.parse(JSON.stringify(questionsData));
        }

        function fisherYatesShuffle(array) {
            let arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        function randomizeCurrentSet() {
            const shuffleChoices = document.getElementById('toggleShuffleChoices').checked;
            
            let shuffled = fisherYatesShuffle(questionsData);
            if (shuffleChoices) {
                shuffled = shuffled.map(q => {
                    if (q.choices && q.choices.length > 0) {
                        return {
                            ...q,
                            choices: fisherYatesShuffle(q.choices)
                        };
                    }
                    return q;
                });
            }

            generatedVersions[activeVersionKey] = shuffled;
            renderExamPreview();
            showToast(`Randomized ${activeVersionKey} successfully!`, 'success');
        }

        function generateMultipleVersions() {
            const count = parseInt(document.getElementById('selectVersionCount').value);
            const shuffleChoices = document.getElementById('toggleShuffleChoices').checked;
            
            const versionNames = ['Version A', 'Version B', 'Version C', 'Version D'];
            generatedVersions = {};

            for (let v = 0; v < count; v++) {
                const vName = versionNames[v];
                let shuffled = fisherYatesShuffle(questionsData);
                if (shuffleChoices) {
                    shuffled = shuffled.map(q => {
                        if (q.choices && q.choices.length > 0) {
                            return {
                                ...q,
                                choices: fisherYatesShuffle(q.choices)
                            };
                        }
                        return q;
                    });
                }
                generatedVersions[vName] = shuffled;
            }

            activeVersionKey = 'Version A';
            renderVersionTabs();
            renderExamPreview();
            showToast(`Generated ${count} randomized version(s)!`, 'success');
        }

        function renderVersionTabs() {
            const container = document.getElementById('versionTabsContainer');
            const keys = Object.keys(generatedVersions);
            
            container.innerHTML = keys.map(k => `
                <button onclick="setActiveVersion('${k}')" class="px-3 py-1.5 text-xs font-bold rounded-lg transition border ${activeVersionKey === k ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}">
                    ${k}
                </button>
            `).join('');
        }

        function setActiveVersion(key) {
            activeVersionKey = key;
            document.getElementById('globalActiveVersion').innerText = key;
            renderVersionTabs();
            renderExamPreview();
        }

        function renderExamPreview() {
            const paper = document.getElementById('printablePaper');
            const items = generatedVersions[activeVersionKey] || questionsData;
            const includeAnswerKey = document.getElementById('toggleIncludeAnswerKey').checked;

            const school = document.getElementById('inputSchoolName').value || 'SCHOOL NAME';
            const dept = document.getElementById('inputDepartment').value || '';
            const title = document.getElementById('inputExamTitle').value || 'EXAMINATION';
            const subj = document.getElementById('inputSubject').value || '';
            const teacher = document.getElementById('inputTeacher').value || '';
            const term = document.getElementById('inputTerm').value || '';
            const instructions = document.getElementById('inputInstructions').value || '';
            const leftLogoUrl = document.getElementById('inputLeftLogoUrl')?.value.trim() || '';
            const logoUrl = document.getElementById('inputLogoUrl')?.value.trim() || '';

            let html = `
                <!-- Printed Header -->
                <div class="border-b-2 border-slate-900 pb-4 mb-6">
                    <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-start">
                        ${leftLogoUrl ? `<div class="w-16 flex justify-start"><img src="${escapeHtml(leftLogoUrl)}" alt="Left-side school logo" style="max-width:64px;max-height:80px;object-fit:contain"></div>` : '<div class="w-16"></div>'}
                        <div class="text-center min-w-0">
                    <h2 class="font-bold text-base uppercase tracking-wider">${escapeHtml(school)}</h2>
                    ${dept ? `<p class="text-xs italic">${escapeHtml(dept)}</p>` : ''}
                    <h1 class="font-bold text-lg mt-2 underline">${escapeHtml(title)} - <span class="text-indigo-700 font-extrabold">${activeVersionKey}</span></h1>
                    <p class="text-xs font-semibold mt-1">${escapeHtml(subj)} | ${escapeHtml(term)}</p>
                        </div>
                        ${logoUrl ? `<div class="w-16 flex justify-end"><img src="${escapeHtml(logoUrl)}" alt="Right-side school logo" style="max-width:64px;max-height:80px;object-fit:contain"></div>` : '<div class="w-16"></div>'}
                    </div>
                    <div class="grid grid-cols-2 text-left text-xs mt-4 pt-2 border-t border-slate-300 font-sans">
                        <div>
                            <p><strong>Name:</strong> ____________________________________</p>
                            <p class="mt-2"><strong>Grade & Section:</strong> ________________________</p>
                        </div>
                        <div class="text-right">
                            <p><strong>Date:</strong> ____________________</p>
                            <p class="mt-2"><strong>Score:</strong> ______ / ${items.length}</p>
                        </div>
                    </div>
                    <div class="text-left text-xs font-sans mt-2 pt-2 border-t border-slate-200">
                        <p><strong>Instructor:</strong> ${escapeHtml(teacher)}</p>
                        <p class="mt-1"><strong>General Instructions:</strong> <em>${escapeHtml(instructions)}</em></p>
                    </div>
                </div>

                <!-- Questionnaire Items List -->
                <div class="space-y-6">
            `;

            items.forEach((item, idx) => {
                html += `
                    <div class="break-inside-avoid">
                        <p class="font-semibold text-slate-900">
                            ${idx + 1}. ${escapeHtml(item.question)}
                        </p>
                `;

                if (item.choices && item.choices.length > 0) {
                    html += `<div class="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 pl-4 text-xs font-sans">`;
                    const letters = ['A', 'B', 'C', 'D', 'E'];
                    item.choices.forEach((c, cIdx) => {
                        const letter = letters[cIdx] || `${cIdx + 1}`;
                        html += `<div><strong>${letter}.</strong> ${escapeHtml(c)}</div>`;
                    });
                    html += `</div>`;
                } else {
                    html += `<div class="mt-2 pl-4 text-xs font-sans text-slate-500">Answer: ___________________________________</div>`;
                }

                html += `</div>`;
            });

            html += `</div>`;

            // Answer Key Section if enabled
            if (includeAnswerKey) {
                html += `
                    <div class="mt-12 pt-6 border-t-2 border-dashed border-slate-400 page-break">
                        <h3 class="font-bold text-center uppercase tracking-widest text-sm mb-4">*** ANSWER KEY (${activeVersionKey}) ***</h3>
                        <div class="grid grid-cols-4 sm:grid-cols-5 gap-2 text-xs font-mono bg-slate-50 p-4 rounded border border-slate-200">
                `;

                items.forEach((item, idx) => {
                    let ansDisplay = item.correctAnswer || 'N/A';
                    if (item.choices && item.choices.length > 0 && item.correctAnswer) {
                        const letters = ['A', 'B', 'C', 'D', 'E'];
                        const ansIdx = item.choices.indexOf(item.correctAnswer);
                        if (ansIdx !== -1) {
                            ansDisplay = `${letters[ansIdx]} (${item.correctAnswer})`;
                        }
                    }
                    html += `<div><strong>${idx + 1}:</strong> ${escapeHtml(ansDisplay)}</div>`;
                });

                html += `</div></div>`;
            }

            paper.innerHTML = html;
        }

        function exportToWord() {
            const content = document.getElementById('printablePaper').innerHTML;
            const htmlDocument = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Exam Export</title>
                    <style>
                        body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.3; }
                        h1, h2 { text-align: center; margin: 2px; }
                        .grid { display: block; margin-top: 5px; }
                        .break-inside-avoid { margin-bottom: 12px; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `;

            if (typeof htmlDocx !== 'undefined') {
                const converted = htmlDocx.asBlob(htmlDocument);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(converted);
                link.download = `Exam_${activeVersionKey.replace(' ', '_')}.docx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast('Exported to Microsoft Word (.docx)!', 'success');
            } else {
                showToast('DOCX Exporter library loading. Please try again in a moment.', 'error');
            }
        }

        function initClassroomMode() {
            const items = generatedVersions[activeVersionKey] || questionsData;
            if (items.length === 0) {
                showToast('No items to present. Add questions first!', 'error');
                return;
            }

            document.getElementById('presentationVersionTag').innerText = activeVersionKey;
            document.getElementById('presentationTitle').innerText = document.getElementById('inputExamTitle').value || 'Classroom Presentation';
            currentSlideIndex = 0;
            renderSlide();
        }

        function changeClassroomFontSize(delta) {
            classroomFontSize = Math.max(14, Math.min(52, classroomFontSize + delta));
            updateClassroomFontSizeUI();
        }

        function setClassroomFontSize(size) {
            classroomFontSize = size;
            updateClassroomFontSizeUI();
        }

        function updateClassroomFontSizeUI() {
            document.getElementById('fontSizeDisplay').innerText = `${classroomFontSize}px`;
            
            const qText = document.getElementById('presentationQuestionText');
            if (qText) {
                qText.style.fontSize = `${classroomFontSize}px`;
            }

            const choiceFontSize = Math.max(12, Math.round(classroomFontSize * 0.8));
            const choiceBadgeSize = Math.max(20, Math.round(classroomFontSize * 0.95));
            const choiceBadgeText = Math.max(10, Math.round(classroomFontSize * 0.55));

            document.querySelectorAll('.classroom-choice-item').forEach(el => {
                el.style.fontSize = `${choiceFontSize}px`;
            });

            document.querySelectorAll('.classroom-choice-badge').forEach(badge => {
                badge.style.width = `${choiceBadgeSize}px`;
                badge.style.height = `${choiceBadgeSize}px`;
                badge.style.fontSize = `${choiceBadgeText}px`;
            });
        }

        function renderSlide() {
            const items = generatedVersions[activeVersionKey] || questionsData;
            if (items.length === 0) return;

            const item = items[currentSlideIndex];
            document.getElementById('presentationItemIndex').innerText = `Question ${currentSlideIndex + 1} of ${items.length}`;
            document.getElementById('presentationItemType').innerText = item.type;
            
            const qText = document.getElementById('presentationQuestionText');
            qText.innerText = item.question;
            qText.style.fontSize = `${classroomFontSize}px`;

            const choicesContainer = document.getElementById('presentationChoicesList');
            choicesContainer.innerHTML = '';

            const choiceFontSize = Math.max(12, Math.round(classroomFontSize * 0.8));
            const choiceBadgeSize = Math.max(20, Math.round(classroomFontSize * 0.95));
            const choiceBadgeText = Math.max(10, Math.round(classroomFontSize * 0.55));

            if (item.choices && item.choices.length > 0) {
                const letters = ['A', 'B', 'C', 'D', 'E'];
                item.choices.forEach((c, idx) => {
                    choicesContainer.innerHTML += `
                        <div class="classroom-choice-item bg-slate-800/80 border border-slate-700/80 p-4 rounded-xl flex items-start space-x-3 text-slate-200 transition-all duration-150 shadow" style="font-size: ${choiceFontSize}px;">
                            <span class="classroom-choice-badge rounded-full bg-indigo-600 text-white font-black flex items-center justify-center shrink-0 shadow" style="width: ${choiceBadgeSize}px; height: ${choiceBadgeSize}px; font-size: ${choiceBadgeText}px;">${letters[idx] || idx + 1}</span>
                            <span>${escapeHtml(c)}</span>
                        </div>
                    `;
                });
            } else {
                choicesContainer.innerHTML = `
                    <div class="col-span-2 text-slate-400 italic bg-slate-800/40 p-4 rounded-xl border border-slate-700 text-center classroom-choice-item" style="font-size: ${choiceFontSize}px;">
                        Identification Item - Write answer on response sheet.
                    </div>
                `;
            }

            updateClassroomFontSizeUI();
        }

        function nextSlide() {
            const items = generatedVersions[activeVersionKey] || questionsData;
            if (currentSlideIndex < items.length - 1) {
                currentSlideIndex++;
                renderSlide();
            }
        }

        function prevSlide() {
            if (currentSlideIndex > 0) {
                currentSlideIndex--;
                renderSlide();
            }
        }

        function initPeerCheckingMode() {
            const versionSelect = document.getElementById('peerCheckingVersionSelect');
            const keys = Object.keys(generatedVersions);
            
            versionSelect.innerHTML = keys.map(k => `
                <option value="${k}" ${k === activeVersionKey ? 'selected' : ''}>Key for ${k}</option>
            `).join('');

            peerCheckingSlideIndex = 0;
            peerAnswerVisible = false; // Hide answer initially when starting mode
            renderPeerCheckingSlide();
            renderPeerCheckingGrid();
        }

        function switchPeerCheckingVersion(vKey) {
            activeVersionKey = vKey;
            document.getElementById('globalActiveVersion').innerText = vKey;
            peerCheckingSlideIndex = 0;
            peerAnswerVisible = false; // Reset reveal state on version change
            renderPeerCheckingSlide();
            renderPeerCheckingGrid();
            showToast(`Switched Answer Checking Key to ${vKey}`, 'info');
        }

        function setPeerCheckingViewMode(mode) {
            peerCheckingViewMode = mode;
            const btnSlide = document.getElementById('btnPeerModeSlide');
            const btnGrid = document.getElementById('btnPeerModeGrid');
            const slideContainer = document.getElementById('peerSlideContainer');
            const gridContainer = document.getElementById('peerGridContainer');

            if (mode === 'slide') {
                btnSlide.className = "px-4 py-2 text-xs font-black rounded-xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 transition transform active:scale-95";
                btnGrid.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-200 border-2 border-amber-700/60 transition";
                slideContainer.classList.remove('hidden');
                gridContainer.classList.add('hidden');
            } else {
                btnGrid.className = "px-4 py-2 text-xs font-black rounded-xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 transition transform active:scale-95";
                btnSlide.className = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-200 border-2 border-amber-700/60 transition";
                gridContainer.classList.remove('hidden');
                slideContainer.classList.add('hidden');
                renderPeerCheckingGrid();
            }
        }

        function changePeerFontSize(delta) {
            peerFontSize = Math.max(14, Math.min(52, peerFontSize + delta));
            updatePeerFontSizeUI();
        }

        function setPeerFontSize(size) {
            peerFontSize = size;
            updatePeerFontSizeUI();
        }

        function updatePeerFontSizeUI() {
            document.getElementById('peerFontSizeDisplay').innerText = `${peerFontSize}px`;
            
            const qText = document.getElementById('peerQuestionText');
            if (qText) {
                qText.style.fontSize = `${peerFontSize}px`;
            }

            const choiceFontSize = Math.max(12, Math.round(peerFontSize * 0.8));
            const choiceBadgeSize = Math.max(20, Math.round(peerFontSize * 0.95));
            const choiceBadgeText = Math.max(10, Math.round(peerFontSize * 0.55));

            document.querySelectorAll('.peer-choice-item').forEach(el => {
                el.style.fontSize = `${choiceFontSize}px`;
            });

            document.querySelectorAll('.peer-choice-badge').forEach(badge => {
                badge.style.width = `${choiceBadgeSize}px`;
                badge.style.height = `${choiceBadgeSize}px`;
                badge.style.fontSize = `${choiceBadgeText}px`;
            });
        }

        function renderPeerCheckingSlide() {
            const items = generatedVersions[activeVersionKey] || questionsData;
            if (items.length === 0) return;

            const item = items[peerCheckingSlideIndex];
            document.getElementById('peerItemIndex').innerText = `Checking Item ${peerCheckingSlideIndex + 1} of ${items.length}`;
            document.getElementById('peerItemType').innerText = item.type;

            const qText = document.getElementById('peerQuestionText');
            qText.innerText = item.question;
            qText.style.fontSize = `${peerFontSize}px`;

            const choicesContainer = document.getElementById('peerChoicesList');
            choicesContainer.innerHTML = '';

            const choiceFontSize = Math.max(12, Math.round(peerFontSize * 0.8));
            const choiceBadgeSize = Math.max(20, Math.round(peerFontSize * 0.95));
            const choiceBadgeText = Math.max(10, Math.round(peerFontSize * 0.55));
            const letters = ['A', 'B', 'C', 'D', 'E'];

            let correctChoiceLetter = '';

            if (item.choices && item.choices.length > 0) {
                item.choices.forEach((c, idx) => {
                    const letter = letters[idx] || `${idx + 1}`;
                    const isCorrect = (c === item.correctAnswer);
                    if (isCorrect) correctChoiceLetter = letter;

                    // Only highlight answer if peerAnswerVisible is TRUE
                    const showHighlight = peerAnswerVisible && isCorrect;

                    choicesContainer.innerHTML += `
                        <div class="peer-choice-item ${showHighlight ? 'bg-emerald-950/90 border-2 border-emerald-400 text-emerald-100 font-bold shadow-lg' : 'bg-amber-950/40 border border-amber-800/80 text-amber-200'} p-4 rounded-xl flex items-start space-x-3 transition-all duration-300" style="font-size: ${choiceFontSize}px;">
                            <span class="peer-choice-badge rounded-full ${showHighlight ? 'bg-emerald-500 text-slate-950 font-black ring-2 ring-emerald-300' : 'bg-amber-900 text-amber-200 border border-amber-700'} font-black flex items-center justify-center shrink-0" style="width: ${choiceBadgeSize}px; height: ${choiceBadgeSize}px; font-size: ${choiceBadgeText}px;">${letter}</span>
                            <div class="flex-1">
                                <span>${escapeHtml(c)}</span>
                                ${showHighlight ? `<span class="ml-2 text-xs text-emerald-300 uppercase tracking-wider font-black">(CORRECT ANSWER)</span>` : ''}
                            </div>
                        </div>
                    `;
                });
            } else {
                choicesContainer.innerHTML = `
                    <div class="col-span-2 text-amber-300 font-semibold bg-amber-950/50 p-4 rounded-xl border border-amber-700 text-center peer-choice-item" style="font-size: ${choiceFontSize}px;">
                        ${peerAnswerVisible ? `Identification Answer: <strong class="text-emerald-300 underline font-bold">${escapeHtml(item.correctAnswer || 'N/A')}</strong>` : '<span class="text-amber-200/70 italic">Identification Item - Guess answer then click Reveal Answer</span>'}
                    </div>
                `;
            }

            // Update Reveal Box & Hidden Box
            const hiddenBox = document.getElementById('peerAnswerHiddenBox');
            const revealBox = document.getElementById('peerAnswerRevealBox');
            const ansText = document.getElementById('peerCorrectAnswerText');
            
            if (item.choices && item.choices.length > 0) {
                ansText.innerText = correctChoiceLetter ? `Option ${correctChoiceLetter}: ${item.correctAnswer}` : (item.correctAnswer || 'N/A');
            } else {
                ansText.innerText = item.correctAnswer || 'N/A';
            }

            if (peerAnswerVisible) {
                hiddenBox.classList.add('hidden');
                revealBox.classList.remove('hidden');
            } else {
                hiddenBox.classList.remove('hidden');
                revealBox.classList.add('hidden');
            }

            updatePeerFontSizeUI();
            lucide.createIcons();
        }

        function revealPeerAnswer() {
            peerAnswerVisible = true;
            renderPeerCheckingSlide();
        }

        function hidePeerAnswer() {
            peerAnswerVisible = false;
            renderPeerCheckingSlide();
        }

        function nextPeerSlide() {
            const items = generatedVersions[activeVersionKey] || questionsData;
            if (peerCheckingSlideIndex < items.length - 1) {
                peerCheckingSlideIndex++;
                peerAnswerVisible = false; // Reset reveal state for next item so students guess again
                renderPeerCheckingSlide();
            }
        }

        function prevPeerSlide() {
            if (peerCheckingSlideIndex > 0) {
                peerCheckingSlideIndex--;
                peerAnswerVisible = false; // Reset reveal state for previous item
                renderPeerCheckingSlide();
            }
        }

        function renderPeerCheckingGrid() {
            const gridContainer = document.getElementById('peerAnswerGridContent');
            const items = generatedVersions[activeVersionKey] || questionsData;
            const letters = ['A', 'B', 'C', 'D', 'E'];

            if (items.length === 0) {
                gridContainer.innerHTML = `<p class="text-amber-300 text-sm">No items available.</p>`;
                return;
            }

            gridContainer.innerHTML = items.map((item, idx) => {
                let ansLetter = '';
                if (item.choices && item.choices.length > 0 && item.correctAnswer) {
                    const cIdx = item.choices.indexOf(item.correctAnswer);
                    if (cIdx !== -1) ansLetter = letters[cIdx];
                }

                return `
                    <div class="bg-amber-950/80 border border-amber-800 p-4 rounded-xl flex items-center justify-between shadow">
                        <div>
                            <span class="text-amber-400 text-xs font-black block">ITEM #${idx + 1}</span>
                            <span class="text-amber-100 text-xs line-clamp-1">${escapeHtml(item.question)}</span>
                        </div>
                        <div class="bg-emerald-500 text-slate-950 font-black px-3 py-1.5 rounded-lg text-sm text-center shrink-0 ml-2 shadow-md">
                            ${ansLetter ? `(${ansLetter}) ` : ''}${escapeHtml(item.correctAnswer || 'N/A')}
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Quiz Bee Challenge State and Controls
        let quizBeeQuestions = [];
        let quizBeeIndex = 0;
        let quizBeeScores = [0, 0, 0];
        let quizBeeAnswerRevealed = false;

        // Load the current generated exam version (or question bank) into Quiz Bee mode.
        function startQuizBee() {
            const source = generatedVersions[activeVersionKey] || questionsData;
            if (!source || source.length === 0) {
                showToast('No questions are available. Please upload or enter questions first.', 'error');
                return;
            }

            quizBeeQuestions = JSON.parse(JSON.stringify(source));
            if (document.getElementById('quizBeeShuffle')?.checked) {
                for (let i = quizBeeQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [quizBeeQuestions[i], quizBeeQuestions[j]] = [quizBeeQuestions[j], quizBeeQuestions[i]];
                }
            }
            quizBeeIndex = 0;
            quizBeeAnswerRevealed = false;
            renderQuizBeeQuestion();
            showToast(`Quiz Bee loaded with ${quizBeeQuestions.length} questions.`, 'success');
        }

        // Render the current Quiz Bee question without exposing its answer prematurely.
        function renderQuizBeeQuestion() {
            const questionEl = document.getElementById('quizBeeQuestion');
            const choicesEl = document.getElementById('quizBeeChoices');
            const progressEl = document.getElementById('quizBeeProgress');
            const answerBox = document.getElementById('quizBeeAnswer');

            if (!quizBeeQuestions.length) {
                questionEl.textContent = 'Click “Start / Load Questions” to begin the challenge.';
                choicesEl.innerHTML = '';
                progressEl.textContent = 'Question 0 of 0';
                answerBox.classList.add('hidden');
                return;
            }

            if (quizBeeIndex >= quizBeeQuestions.length) {
                questionEl.textContent = 'Challenge complete! Review the team scores or restart to play again.';
                choicesEl.innerHTML = '';
                progressEl.textContent = `Completed ${quizBeeQuestions.length} questions`;
                answerBox.classList.add('hidden');
                return;
            }

            const item = quizBeeQuestions[quizBeeIndex];
            questionEl.textContent = item.question || 'Question text is unavailable.';
            progressEl.textContent = `Question ${quizBeeIndex + 1} of ${quizBeeQuestions.length}`;
            answerBox.classList.add('hidden');
            quizBeeAnswerRevealed = false;

            if (Array.isArray(item.choices) && item.choices.length) {
                choicesEl.innerHTML = item.choices.map((choice, index) => `
                    <div class="bg-slate-950 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
                        <span class="shrink-0 w-8 h-8 rounded-lg bg-purple-900 text-purple-100 flex items-center justify-center font-black">${String.fromCharCode(65 + index)}</span>
                        <span class="text-slate-100 pt-1">${escapeHtml(String(choice))}</span>
                    </div>`).join('');
            } else {
                choicesEl.innerHTML = '<div class="sm:col-span-2 p-4 rounded-xl border border-slate-700 bg-slate-950 text-purple-200">Short answer / identification question — teams should answer aloud or write their response.</div>';
            }
            document.getElementById('quizBeeAnswerText').textContent = '';
        }

        // Reveal the official answer for the teacher to verify team responses.
        function revealQuizBeeAnswer() {
            if (!quizBeeQuestions.length || quizBeeIndex >= quizBeeQuestions.length) {
                showToast('Start the Quiz Bee and load questions first.', 'error');
                return;
            }
            const item = quizBeeQuestions[quizBeeIndex];
            const answer = item.correctAnswer || 'No correct answer was supplied for this item.';
            document.getElementById('quizBeeAnswerText').textContent = answer;
            document.getElementById('quizBeeAnswer').classList.remove('hidden');
            quizBeeAnswerRevealed = true;
        }

        // Move forward through the challenge question set.
        function nextQuizBeeQuestion() {
            if (!quizBeeQuestions.length) { startQuizBee(); return; }
            if (quizBeeIndex < quizBeeQuestions.length) quizBeeIndex++;
            renderQuizBeeQuestion();
        }

        // Return to the previous Quiz Bee question when one exists.
        function previousQuizBeeQuestion() {
            if (!quizBeeQuestions.length) return;
            quizBeeIndex = Math.max(0, quizBeeIndex - 1);
            renderQuizBeeQuestion();
        }

        // Award one point to the selected team. Scores remain in this open session.
        function awardQuizBeePoint(teamNumber) {
            const index = Number(teamNumber) - 1;
            if (index < 0 || index > 2) return;
            quizBeeScores[index]++;
            document.getElementById(`quizBeeScore${teamNumber}`).textContent = quizBeeScores[index];
            showToast(`${document.getElementById(`quizBeeTeam${teamNumber}Name`).value || `Team ${teamNumber}`} awarded 1 point.`, 'success');
        }

        // Reset the three team scores without changing the loaded questions.
        function resetQuizBee() {
            quizBeeScores = [0, 0, 0];
            [1, 2, 3].forEach(teamNumber => {
                document.getElementById(`quizBeeScore${teamNumber}`).textContent = '0';
            });
            quizBeeIndex = 0;
            quizBeeAnswerRevealed = false;
            renderQuizBeeQuestion();
            showToast('Quiz Bee scores have been reset.', 'success');
        }

        // Global Timer & Helpers
        function startTimer() {
            if (timerInterval) return;
            timerInterval = setInterval(() => {
                timerSeconds++;
                const hrs = String(Math.floor(timerSeconds / 3600)).padStart(2, '0');
                const mins = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, '0');
                const secs = String(timerSeconds % 60).padStart(2, '0');
                document.getElementById('timerDisplay').innerText = `${hrs}:${mins}:${secs}`;
            }, 1000);
        }

        function pauseTimer() {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        function resetTimer() {
            pauseTimer();
            timerSeconds = 0;
            document.getElementById('timerDisplay').innerText = '00:00:00';
        }

        function updateGlobalStats() {
            document.getElementById('globalItemCount').innerText = questionsData.length;
            renderHeaderPreview();
        }

        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            
            const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-slate-800';
            
            toast.className = `${bgClass} text-white px-4 py-3 rounded-lg shadow-lg text-xs font-bold flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0`;
            toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
            
            container.appendChild(toast);

            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        // Open or close the complete in-app user guide.
        function toggleUserGuide(forceOpen) {
            const modal = document.getElementById('userGuideModal');
            if (!modal) return;
            const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : modal.classList.contains('hidden');
            modal.classList.toggle('hidden', !shouldOpen);
            document.body.classList.toggle('overflow-hidden', shouldOpen);
        }

        // Toggle browser full-screen mode and keep the button label/icon synchronized with the browser state.
        async function toggleFullScreen() {
            try {
                if (!document.fullscreenElement) {
                    const target = document.documentElement;
                    if (target.requestFullscreen) await target.requestFullscreen();
                    else showToast('Full-screen mode is not supported by this browser.', 'error');
                } else if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            } catch (error) {
                console.warn('Unable to toggle full-screen mode.', error);
                showToast('The browser could not change full-screen mode. Please try clicking the button again.', 'error');
            }
        }

        // Reflect changes initiated by the browser (including pressing Esc) in the full-screen button.
        document.addEventListener('fullscreenchange', () => {
            const icon = document.getElementById('fullscreenToggleIcon');
            const label = document.getElementById('fullscreenToggleLabel');
            const button = document.getElementById('fullscreenToggleButton');
            const isFullscreen = Boolean(document.fullscreenElement);
            if (icon) icon.setAttribute('data-lucide', isFullscreen ? 'minimize' : 'maximize');
            if (label) label.textContent = isFullscreen ? 'Exit Full Screen' : 'Full Screen';
            if (button) button.title = isFullscreen ? 'Exit full-screen mode' : 'Enter full-screen mode';
            if (window.lucide) lucide.createIcons();
        });

        // Allow the Escape key to close the user guide independently of browser full-screen handling.
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                const guide = document.getElementById('userGuideModal');
                if (guide && !guide.classList.contains('hidden')) toggleUserGuide(false);
            }
        });

        // Show or hide the organization field according to the selected donor type.
        function toggleDonorOrganizationField() {
            const donorType = document.getElementById('donorType');
            const wrap = document.getElementById('donorOrganizationWrap');
            const organization = document.getElementById('donorOrganization');
            if (!donorType || !wrap || !organization) return;
            const isGroup = donorType.value === 'Group';
            wrap.classList.toggle('hidden', !isGroup);
            organization.required = isGroup;
            if (!isGroup) organization.value = '';
        }

        // GOOGLE SHEETS DONOR SUBMISSION CONFIGURATION:
        // Paste your deployed Google Apps Script Web App URL ending in /exec into the constant below.
        // The URL is no longer displayed as a field in the donor-facing form.
        // Important: this hides the endpoint from the form UI, but it is still visible to anyone who inspects the HTML source. PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE
        const DONOR_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwa7PURy-pOOsxWuYtM7M4PtDh7Ka1wPI5f6UcecUaagR2LUQj9tTR2AhdSk_BJu9Wwww/exec';

        // Submit donor details to the configured Google Apps Script Web App.
        // IMPORTANT: Browser "no-cors" requests cannot read the Apps Script response.
        // This function therefore confirms only that the browser dispatched the request;
        // it does not claim that Google Sheets saved the row. The Apps Script doPost(e)
        // must read e.parameter (URL-encoded form fields) and append the values to the sheet.
        async function submitDonationDetails(event) {
            if (event) event.preventDefault();

            const form = document.getElementById('donorDetailsForm');
            const status = document.getElementById('donorSubmitStatus');
            const button = document.getElementById('donorSubmitButton');
            if (!form || !status || !button) {
                console.error('Donor form elements are missing from the HTML.');
                return;
            }

            const endpoint = DONOR_APPS_SCRIPT_URL.trim();
            const donorTypeElement = document.getElementById('donorType');
            const organizationElement = document.getElementById('donorOrganization');
            const donorNameElement = document.getElementById('donorName');
            const countryElement = document.getElementById('donorCountry');
            const amountElement = document.getElementById('donorAmount');

            const showStatus = (message, success) => {
                status.textContent = message;
                status.className = 'rounded-lg p-3 text-xs font-semibold ' +
                    (success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200');
            };

            if (!form.reportValidity()) return;

            if (!endpoint ||
                endpoint === 'PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE' ||
                !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(endpoint)) {
                showStatus('Google Sheets sync is not configured. Please check the deployed Apps Script Web App URL in the HTML.', false);
                console.error('Invalid DONOR_APPS_SCRIPT_URL. Use the deployed Google Apps Script Web App URL ending in /exec.');
                return;
            }

            if (!donorTypeElement || !organizationElement || !donorNameElement || !countryElement || !amountElement) {
                showStatus('The donor form is incomplete. Please contact the website administrator.', false);
                console.error('One or more donor form fields are missing.');
                return;
            }

            const donorType = donorTypeElement.value;
            const organization = organizationElement.value.trim();

            if (donorType === 'Group' && !organization) {
                showStatus('Please enter the name of the organization or group.', false);
                organizationElement.focus();
                return;
            }

            // Keep field names compatible with Google Apps Script handlers that read e.parameter.
            // Alias fields are included because different versions of doPost(e) may use different
            // column names. The Apps Script must explicitly map these fields to the desired columns.
            const submittedAt = new Date().toISOString();
            const donorName = donorNameElement.value.trim();
            const country = countryElement.value.trim();
            const amount = amountElement.value.trim();
            const donorOrganization = donorType === 'Group' ? organization : '';

            const payload = new URLSearchParams();
            payload.set('donorName', donorName);
            payload.set('name', donorName);
            payload.set('donorType', donorType);
            payload.set('donorOrganization', donorOrganization);
            payload.set('organization', donorOrganization);
            payload.set('country', country);
            payload.set('amount', amount);
            payload.set('source', 'ExamShuffle Pro Support My Work');
            payload.set('submittedAt', submittedAt);
            payload.set('timestamp', submittedAt);

            button.disabled = true;
            const originalButtonText = button.textContent;
            button.textContent = 'Submitting...';
            showStatus('Sending donor information to Google Sheets…', true);

            try {
                // Send as application/x-www-form-urlencoded data. This is a "simple" request
                // that can be dispatched cross-origin with no-cors to Apps Script without a
                // browser preflight. Apps Script doPost(e) receives these fields in e.parameter.
                // Do not switch this to JSON unless the Apps Script is also changed to parse JSON.
                await fetch(endpoint, {
                    method: 'POST',
                    mode: 'no-cors',
                    cache: 'no-store',
                    redirect: 'follow',
                    body: payload
                });

                // A no-cors response is opaque: the browser cannot verify a row was written.
                // Use truthful status text and do not clear the form, so the user can retry
                // or copy the details if the Apps Script deployment is misconfigured.
                showStatus(
                    'The request was sent from this browser, but Google does not allow this page to confirm that the row was saved. If the row does not appear, check that the Apps Script Web App is deployed for access by anyone, that its doPost(e) reads e.parameter, that the spreadsheet ID and tab name are correct, and that you deployed the latest version. Your entries remain in the form.',
                    true
                );
            } catch (error) {
                console.error('Unable to send donor information to Google Sheets.', error);
                showStatus('The request could not be sent. Check your internet connection and the deployed Apps Script Web App URL, then try again. Your entries remain in the form.', false);
            } finally {
                button.disabled = false;
                button.textContent = originalButtonText || 'Submit';
            }
        }

        // Initialize donor submission fields. The endpoint is embedded in the script, so no URL is requested from donors.
        function initializeDonorSubmission() {
            toggleDonorOrganizationField();
        }
        document.addEventListener('DOMContentLoaded', initializeDonorSubmission);

        function toggleDonationModal() {
            const modal = document.getElementById('donationModal');
            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
            } else {
                modal.classList.add('hidden');
            }
        }

        function escapeHtml(text) {
            if (!text) return '';
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // Keep application internals inside a private closure. Only functions used by
        // the existing inline HTML event handlers are exposed on window.
        const publicHandlers = {
            addChoice: addChoice,
            addNewQuestion: addNewQuestion,
            changeClassroomFontSize: changeClassroomFontSize,
            changePeerFontSize: changePeerFontSize,
            clearAllQuestions: clearAllQuestions,
            deleteQuestion: deleteQuestion,
            exportToWord: exportToWord,
            generateMultipleVersions: generateMultipleVersions,
            hidePeerAnswer: hidePeerAnswer,
            nextPeerSlide: nextPeerSlide,
            nextSlide: nextSlide,
            parseRawText: parseRawText,
            pauseTimer: pauseTimer,
            prevPeerSlide: prevPeerSlide,
            prevSlide: prevSlide,
            randomizeCurrentSet: randomizeCurrentSet,
            removeChoice: removeChoice,
            renderExamPreview: renderExamPreview,
            resetTimer: resetTimer,
            revealPeerAnswer: revealPeerAnswer,
            setActiveVersion: setActiveVersion,
            setClassroomFontSize: setClassroomFontSize,
            setCorrectAnswer: setCorrectAnswer,
            setPeerCheckingViewMode: setPeerCheckingViewMode,
            setPeerFontSize: setPeerFontSize,
            startTimer: startTimer,
            switchPeerCheckingVersion: switchPeerCheckingVersion,
            switchTab: switchTab,
            toggleDonationModal: toggleDonationModal,
            toggleDonorOrganizationField: toggleDonorOrganizationField,
            submitDonationDetails: submitDonationDetails,
            toggleHeaderNav: toggleHeaderNav,
            toggleUserGuide: toggleUserGuide,
            toggleFullScreen: toggleFullScreen,
            updateChoiceText: updateChoiceText,
            updateIdentificationAnswer: updateIdentificationAnswer,
            updateQuestionText: updateQuestionText,
            updateQuestionType: updateQuestionType,
            clearCache: clearCache,
            startQuizBee: startQuizBee,
            nextQuizBeeQuestion: nextQuizBeeQuestion,
            previousQuizBeeQuestion: previousQuizBeeQuestion,
            revealQuizBeeAnswer: revealQuizBeeAnswer,
            awardQuizBeePoint: awardQuizBeePoint,
            resetQuizBee: resetQuizBee
        };
        Object.keys(publicHandlers).forEach(handlerName => {
            window[handlerName] = publicHandlers[handlerName];
        });
    })();
