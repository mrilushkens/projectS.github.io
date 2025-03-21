// Глобальные переменные состояния
let currentTheme = 'light'; // Текущая тема (светлая или тёмная)
let selectedElement = null; // Выбранный элемент
let isDraggingElement = false; // Флаг перетаскивания элемента
let dragOffset = { x: 0, y: 0 }; // Смещение при перетаскивании
const DELETE_KEYS = ['Delete', 'Backspace']; // Клавиши для удаления
const workspace = document.getElementById('workspace'); // Рабочая область
const leftPanel = document.querySelector('.left-panel'); // Левая панель
const wiresSvg = document.getElementById('wires'); // SVG для проводов
let connections = []; // Массив соединений (проводов)
let wireCounter = 0; // Счётчик проводов
let wireStartPoint = null; // Точка начала провода при перетаскивании
let isSimulationRunning = false; // Состояние симуляции

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initializeDragAndDrop();
    updatePropertiesPanel();
    setupEventListeners();
});

// === Инициализация и основные обработчики ===

// Настройка глобальных обработчиков событий
function setupEventListeners() {
    document.addEventListener('keydown', handleKeyPress);
}

// Инициализация перетаскивания элементов
function initializeDragAndDrop() {
    // Добавляем обработчики для иконок компонентов в левой панели
    document.querySelectorAll('.component-icon').forEach(icon => {
        icon.addEventListener('dragstart', handleDragStart);
    });

    // Обработчики для рабочей области
    workspace.addEventListener('dragover', handleDragOver);
    workspace.addEventListener('drop', handleDrop);
    
    // Обработчики для левой панели (удаление элементов)
    leftPanel.addEventListener('dragover', handleDragOverLeftPanel);
    leftPanel.addEventListener('dragleave', handleDragLeaveLeftPanel);
    leftPanel.addEventListener('drop', handleDropLeftPanel);
}

// === Обработчики перетаскивания элементов ===

// Начало перетаскивания иконки компонента
function handleDragStart(e) {
    e.dataTransfer.setData('type', e.target.dataset.type);
}

// Разрешаем перетаскивание над рабочей областью
function handleDragOver(e) {
    e.preventDefault();
}

// Обработка сброса элемента на рабочую область
function handleDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        const rect = workspace.getBoundingClientRect();
        let x = e.clientX - rect.left - 50;
        let y = e.clientY - rect.top - 30;
        
        const elementWidth = 100;
        const elementHeight = 60;
        x = Math.max(0, Math.min(x, rect.width - elementWidth));
        y = Math.max(0, Math.min(y, rect.height - elementHeight));
        
        const element = createCircuitElement(type, x, y);
        workspace.appendChild(element);
    }
}

// === Создание и управление элементами ===

// Создание нового элемента цепи
function createCircuitElement(type, x, y) {
    const element = document.createElement('div');
    element.className = `circuit-element ${type}`;
    element.dataset.type = type;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    
    // Создаём точки подключения (input и output)
    const inputPoint = document.createElement('div');
    inputPoint.className = 'connection-point input';
    inputPoint.dataset.role = 'input';
    
    const outputPoint = document.createElement('div');
    outputPoint.className = 'connection-point output';
    outputPoint.dataset.role = 'output';
    
    element.appendChild(inputPoint);
    element.appendChild(outputPoint);
    
    // Устанавливаем начальные свойства в зависимости от типа элемента
    switch(type) {
        case 'battery':
            element.dataset.voltage = 9;
            element.dataset.resistance = 0;
            break;
        case 'resistor':
            element.dataset.resistance = 100;
            break;
        case 'lamp':
            element.dataset.resistance = 50;
            element.dataset.state = 'off';
            break;
        case 'switch':
            element.dataset.state = 'open';
            element.dataset.resistance = Infinity; // Изначально разомкнут
            break;
        case 'ammeter':
            element.dataset.resistance = 0.01; // Очень низкое сопротивление
            element.dataset.current = 0; // Ток, который будет измеряться
            break;
        case 'voltmeter':
            element.dataset.voltage = 0; // Напряжение, которое будет измеряться
            element.dataset.resistance = Infinity; // Очень большое сопротивление
            break;
    }
    
    // Добавляем обработчики событий для элемента
    element.addEventListener('mousedown', startElementDrag);
    element.addEventListener('click', handleElementClick);
    
    inputPoint.addEventListener('mousedown', startWireDrag);
    outputPoint.addEventListener('mousedown', startWireDrag);
    
    return element;
}

// Начало перетаскивания элемента
function startElementDrag(e) {
    if (e.button !== 0 || e.target.classList.contains('connection-point')) return;
    e.preventDefault();
    isDraggingElement = true;
    
    selectedElement = e.currentTarget;
    selectedElement.classList.add('dragging');
    selectedElement.style.cursor = 'grabbing';
    
    const rect = selectedElement.getBoundingClientRect();
    dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };

    document.removeEventListener('mousemove', dragElement);
    document.removeEventListener('mouseup', stopElementDrag);

    document.addEventListener('mousemove', dragElement);
    document.addEventListener('mouseup', stopElementDrag);
}

// Перемещение элемента
function dragElement(e) {
    if (!isDraggingElement || !selectedElement) return;
    
    const workspaceRect = workspace.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();
    
    const maxX = workspaceRect.width - elementRect.width;
    const maxY = workspaceRect.height - elementRect.height;
    
    let newX = e.clientX - workspaceRect.left - dragOffset.x;
    let newY = e.clientY - workspaceRect.top - dragOffset.y;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    selectedElement.style.left = `${newX}px`;
    selectedElement.style.top = `${newY}px`;
    
    updateWires();
}

// Остановка перетаскивания элемента
function stopElementDrag(e) {
    isDraggingElement = false;
    
    if (selectedElement) {
        selectedElement.classList.remove('dragging');
        selectedElement.style.cursor = 'grab';
        
        // Проверяем, не попал ли элемент в левую панель (удаление)
        const elementRect = selectedElement.getBoundingClientRect();
        const leftPanelRect = leftPanel.getBoundingClientRect();
        if (
            elementRect.left >= leftPanelRect.left &&
            elementRect.right <= leftPanelRect.right &&
            elementRect.top >= leftPanelRect.top &&
            elementRect.bottom <= leftPanelRect.bottom
        ) {
            removeElementConnections(selectedElement);
            selectedElement.remove();
            selectedElement = null;
            updatePropertiesPanel();
        }
    }
    
    document.removeEventListener('mousemove', dragElement);
    document.removeEventListener('mouseup', stopElementDrag);
}

// === Управление проводами ===

// Начало перетаскивания провода
function startWireDrag(e) {
    e.stopPropagation();
    wireStartPoint = e.target;
    
    document.removeEventListener('mousemove', drawWire);
    document.removeEventListener('mouseup', stopWireDrag);
    
    document.addEventListener('mousemove', drawWire);
    document.addEventListener('mouseup', stopWireDrag);
}

// Отрисовка временного провода при перетаскивании
function drawWire(e) {
    if (!wireStartPoint) return;
    
    const startRect = wireStartPoint.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    const startX = startRect.left - workspaceRect.left + startRect.width / 2;
    const startY = startRect.top - workspaceRect.top + startRect.height / 2;
    const endX = e.clientX - workspaceRect.left;
    const endY = e.clientY - workspaceRect.top;
    
    let previewWire = document.getElementById('wire-preview');
    if (!previewWire) {
        previewWire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewWire.id = 'wire-preview';
        wiresSvg.appendChild(previewWire);
    }
    
    previewWire.setAttribute('x1', startX);
    previewWire.setAttribute('y1', startY);
    previewWire.setAttribute('x2', endX);
    previewWire.setAttribute('y2', endY);
}

// Завершение перетаскивания провода
function stopWireDrag(e) {
    document.removeEventListener('mousemove', drawWire);
    const previewWire = document.getElementById('wire-preview');
    if (previewWire) previewWire.remove();
    
    if (e.target.classList.contains('connection-point') && e.target !== wireStartPoint) {
        const wire = {
            id: `wire-${wireCounter++}`,
            start: wireStartPoint,
            end: e.target
        };
        
        connections.push(wire);
        drawWirePermanent(wire);
        if (isSimulationRunning) {
            calculateCurrent(); // Пересчитываем ток после добавления провода
        }
    }
    
    wireStartPoint = null;
    document.removeEventListener('mouseup', stopWireDrag);
}

// Отрисовка постоянного провода
function drawWirePermanent(wire) {
    const startRect = wire.start.getBoundingClientRect();
    const endRect = wire.end.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    
    const x1 = startRect.left - workspaceRect.left + startRect.width / 2;
    const y1 = startRect.top - workspaceRect.top + startRect.height / 2;
    const x2 = endRect.left - workspaceRect.left + endRect.width / 2;
    const y2 = endRect.top - workspaceRect.top + endRect.height / 2;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('id', wire.id);
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', 'black');
    line.setAttribute('stroke-width', '4');
    line.addEventListener('click', () => removeWire(wire.id));
    wiresSvg.appendChild(line);
}

// Обновление всех проводов
function updateWires() {
    wiresSvg.innerHTML = '';
    connections.forEach(wire => {
        drawWirePermanent(wire);
    });
    if (isSimulationRunning) {
        calculateCurrent(); // Пересчитываем ток после изменения проводов
    }
}

// Удаление провода
function removeWire(wireId) {
    connections = connections.filter(wire => wire.id !== wireId);
    updateWires();
}

// === Обработчики для левой панели (удаление элементов) ===

function handleDragOverLeftPanel(e) {
    e.preventDefault();
    leftPanel.classList.add('drop-target');
}

function handleDragLeaveLeftPanel(e) {
    e.preventDefault();
    leftPanel.classList.remove('drop-target');
}

function handleDropLeftPanel(e) {
    e.preventDefault();
    leftPanel.classList.remove('drop-target');
}

// === Управление выбором элементов ===

function handleElementClick(e) {
    if (e.target.classList.contains('connection-point')) return;
    const element = e.currentTarget;
    selectElement(element);
}

function selectElement(element) {
    document.querySelectorAll('.circuit-element').forEach(el => {
        el.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedElement = element;
    updatePropertiesPanel();
}

// === Панель свойств ===

function updatePropertiesPanel() {
    const panel = document.getElementById('properties');
    panel.innerHTML = selectedElement ? buildPropertiesHTML() : '<p>Выберите элемент</p>';
}

function buildPropertiesHTML() {
    const type = selectedElement.dataset.type;
    return `
        <h4>${type.toUpperCase()}</h4>
        <button onclick="deleteSelectedElement()" class="delete-button">Удалить элемент</button>
        ${getTypeSpecificProperties()}
    `;
}

function getTypeSpecificProperties() {
    switch(selectedElement.dataset.type) {
        case 'battery':
            return `
                <div class="property-group">
                    <label>Напряжение (В)</label>
                    <input type="number" value="${selectedElement.dataset.voltage}" 
                        onchange="updateElementProperty('voltage', this.value)">
                </div>
                <div class="property-group">
                    <label>Сопротивление (Ом)</label>
                    <input type="number" value="${selectedElement.dataset.resistance}" 
                        onchange="updateElementProperty('resistance', this.value)">
                </div>
            `;
        case 'resistor':
            return `
                <div class="property-group">
                    <label>Сопротивление (Ом)</label>
                    <input type="number" value="${selectedElement.dataset.resistance}" 
                        onchange="updateElementProperty('resistance', this.value)">
                </div>
            `;
        case 'lamp':
            return `
                <div class="property-group">
                    <label>Состояние</label>
                    <select onchange="updateElementProperty('state', this.value)">
                        <option value="off" ${selectedElement.dataset.state === 'off' ? 'selected' : ''}>Выключена</option>
                        <option value="on" ${selectedElement.dataset.state === 'on' ? 'selected' : ''}>Включена</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Сопротивление (Ом)</label>
                    <input type="number" value="${selectedElement.dataset.resistance}" 
                        onchange="updateElementProperty('resistance', this.value)">
                </div>
            `;
        case 'switch':
            return `
                <div class="property-group">
                    <label>Состояние</label>
                    <select onchange="updateElementProperty('state', this.value)">
                        <option value="open" ${selectedElement.dataset.state === 'open' ? 'selected' : ''}>Разомкнут</option>
                        <option value="closed" ${selectedElement.dataset.state === 'closed' ? 'selected' : ''}>Сомкнут</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Сопротивление (Ом)</label>
                    <input type="number" value="${selectedElement.dataset.resistance}" 
                        onchange="updateElementProperty('resistance', this.value)" disabled>
                </div>
            `;
        case 'ammeter':
            return `
                <div class="property-group">
                    <label>Сопротивление (Ом)</label>
                    <input type="number" value="${selectedElement.dataset.resistance}" 
                        onchange="updateElementProperty('resistance', this.value)" disabled>
                </div>
                <div class="property-group">
                    <label>Ток (А)</label>
                    <input type="number" value="${selectedElement.dataset.current}" disabled>
                </div>
            `;
        case 'voltmeter':
            return `
                <div class="property-group">
                    <label>Напряжение (В)</label>
                    <input type="number" value="${selectedElement.dataset.voltage || 0}" disabled>
                </div>
            `;
        default: return '';
    }
}

// Обновление свойств элемента
function updateElementProperty(property, value) {
    if (!selectedElement) return;
    
    selectedElement.dataset[property] = value;
    
    if (property === 'state') {
        if (selectedElement.dataset.type === 'switch') {
            selectedElement.dataset.resistance = value === 'open' ? Infinity : 0;
            if (isSimulationRunning) {
                calculateCurrent(); // Пересчитываем ток после изменения состояния ключа
                updatePropertiesPanel();
            }
        } else if (selectedElement.dataset.type === 'lamp') {
            if (isSimulationRunning) {
                calculateCurrent(); // Пересчитываем ток, если лампа влияет на цепь
                updatePropertiesPanel();
            }
        }
    } else {
        if (isSimulationRunning) {
            calculateCurrent(); // Пересчитываем ток после изменения других свойств
            updatePropertiesPanel();
        }
    }
}

// === Удаление элементов ===

function deleteSelectedElement() {
    if (!selectedElement) return;
    
    if (confirm('Вы уверены, что хотите удалить этот элемент?')) {
        selectedElement.style.transition = 'all 0.3s';
        selectedElement.style.transform = 'scale(0)';
        selectedElement.style.opacity = '0';
        
        setTimeout(() => {
            removeElementConnections(selectedElement);
            selectedElement.remove();
            selectedElement = null;
            updatePropertiesPanel();
            if (isSimulationRunning) {
                calculateCurrent(); // Пересчитываем ток после удаления элемента
            }
        }, 300);
    }
}

function removeElementConnections(element) {
    connections = connections.filter(conn => conn.start.parentElement !== element && conn.end.parentElement !== element);
    updateWires();
}

// === Обработка клавиатуры ===

function handleKeyPress(e) {
    if (DELETE_KEYS.includes(e.key) && selectedElement) {
        e.preventDefault();
        deleteSelectedElement();
    }
}

// === Симуляция и расчёт тока ===

// Функция для поиска батареи в цепи, связанной с амперметром
function findBattery(ammeter) {
    let battery = null;
    const visited = new Set();

    function traverse(element, direction) {
        if (!element || visited.has(element)) return;
        visited.add(element);
        if (element.dataset.type === 'battery') {
            battery = element;
            return;
        }
        const wires = connections.filter(conn => 
            (direction === 'input' && conn.end === element.querySelector('.connection-point.input')) ||
            (direction === 'output' && conn.start === element.querySelector('.connection-point.output'))
        );
        wires.forEach(wire => {
            const nextElement = direction === 'input' ? wire.start.parentElement : wire.end.parentElement;
            traverse(nextElement, direction);
        });
    }

    traverse(ammeter, 'input');
    if (!battery) traverse(ammeter, 'output');
    return battery;
}

// Функция для расчёта тока
function calculateCurrent() {
    if (!isSimulationRunning) return;

    const ammeters = document.querySelectorAll('.circuit-element.ammeter');
    if (!ammeters.length) return;

    ammeters.forEach(ammeter => {
        const inputWire = connections.find(conn => conn.end === ammeter.querySelector('.connection-point.input'));
        const outputWire = connections.find(conn => conn.start === ammeter.querySelector('.connection-point.output'));

        if (!inputWire || !outputWire) {
            ammeter.dataset.current = 0;
            return;
        }

        const battery = findBattery(ammeter);
        if (!battery) {
            ammeter.dataset.current = 0;
            return;
        }

        // Вычисляем общее сопротивление цепи
        let totalResistance = 0;
        let currentElement = battery;
        let pathFound = true;
        let visited = new Set();

        while (currentElement && pathFound && !visited.has(currentElement)) {
            visited.add(currentElement);
            const outgoingWire = connections.find(conn => conn.start === currentElement.querySelector('.connection-point.output'));
            if (!outgoingWire) {
                pathFound = false;
                break;
            }
            currentElement = outgoingWire.end.parentElement;
            if (currentElement.dataset.type === 'switch' && currentElement.dataset.state === 'open') {
                totalResistance = Infinity;
                break;
            }
            totalResistance += parseFloat(currentElement.dataset.resistance) || 0;
            if (currentElement === battery) break; // Цепь замкнулась
        }

        if (!pathFound) {
            ammeter.dataset.current = 0;
            return;
        }

        // Вычисляем ток по закону Ома: I = V / R
        const voltage = parseFloat(battery.dataset.voltage) || 0;
        const current = totalResistance === 0 || totalResistance === Infinity ? 0 : voltage / totalResistance;
        ammeter.dataset.current = current.toFixed(3); // Округляем до 3 знаков

        // Обновляем панель свойств, если амперметр выбран
        if (selectedElement === ammeter) {
            updatePropertiesPanel();
        }
    });

    // Расчёт напряжения для вольтметров
    const voltmeters = document.querySelectorAll('.circuit-element.voltmeter');
    voltmeters.forEach(voltmeter => {
        const inputWire = connections.find(conn => conn.end === voltmeter.querySelector('.connection-point.input'));
        const outputWire = connections.find(conn => conn.start === voltmeter.querySelector('.connection-point.output'));
        if (!inputWire || !outputWire) {
            voltmeter.dataset.voltage = 0;
        } else {
            const startElement = inputWire.start.parentElement;
            const endElement = outputWire.end.parentElement;
            if (startElement.dataset.type === 'battery') {
                voltmeter.dataset.voltage = startElement.dataset.voltage;
            } else {
                voltmeter.dataset.voltage = 0; // Упрощённый расчёт, можно доработать
            }
        }
        if (selectedElement === voltmeter) {
            updatePropertiesPanel();
        }
    });
}

// === Системные функции ===

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
}

function startSimulation() {
    isSimulationRunning = true;
    const status = document.getElementById('simulation-status');
    status.textContent = 'Симуляция запущена';
    status.classList.add('running');
    calculateCurrent();
    updatePropertiesPanel();
}

function resetCircuit() {
    workspace.innerHTML = '<svg id="wires" width="100%" height="100%"></svg>';
    selectedElement = null;
    connections = [];
    wireCounter = 0;
    isSimulationRunning = false;
    const status = document.getElementById('simulation-status');
    status.textContent = 'Симуляция не запущена';
    status.classList.remove('running');
    updatePropertiesPanel();
}

// Опционально: остановка симуляции
function stopSimulation() {
    isSimulationRunning = false;
    const status = document.getElementById('simulation-status');
    status.textContent = 'Симуляция остановлена';
    status.classList.remove('running');
    document.querySelectorAll('.circuit-element.ammeter').forEach(ammeter => {
        ammeter.dataset.current = 0;
    });
    updatePropertiesPanel();
}