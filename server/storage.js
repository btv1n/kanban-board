/**
 * Файловое хранилище данных канбан (без СУБД)
 * Здесь данные сохраняются не в базе данных, а в json-файлах на диске
 * writeChain / withLock - защита от одновременной записи в файлы
 *
 * Структура:
 * - users.json - список пользователей
 * - user-<id> - данные конкретного пользователя
 * - boards - отдельные JSON-файлы досок
 * - board-media - изображения досок 
 */


import fs from 'fs'; // работа с файловой системой (чтение/запись)
import path from 'path'; // работа с путями файлов
import { fileURLToPath } from 'url'; // __dirname


const __dirname = path.dirname(fileURLToPath(import.meta.url)) // определяет путь текущего файла
const DATA_ROOT = path.join(__dirname, 'data') // корневая папка для всех данных
const USERS_FILE = path.join(DATA_ROOT, 'users.json') // файл со списком пользователей
const LEGACY_APP_FILE = path.join(DATA_ROOT, 'app.json') // старый файл, используется для миграции старых данных


// Очередь записей в файлы, гарантирует, что операции записи идут по очереди
let writeChain = Promise.resolve()


// Последовательная запись
function withLock(fn) 
{
	const run = writeChain.then(fn, fn)
	writeChain = run.then(
		() => {},
		() => {}
	)
	return run
}


// Создает папку data/, если ее нет
function ensureDataRoot() 
{
	if (!fs.existsSync(DATA_ROOT)) fs.mkdirSync(DATA_ROOT, { recursive: true })
}


// Чтение реестра пользователей, если ошибка - возвращает пустой список
function readUsersRegistry() 
{
	ensureDataRoot()

	try 
	{
		const raw = fs.readFileSync(USERS_FILE, 'utf8')
		const data = JSON.parse(raw)
		if (!Array.isArray(data.users)) data.users = []
		return data
	} catch 
	{
		// Если файл отсутствует или json битый
		return { users: [] }
	}
}


// Запись пользователя в файл (перезапись)
function writeUsersRegistry(data) 
{
	ensureDataRoot()
	// JSON.stringify(..., 2) - форматирование с отступами
	fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8')
}


// Абсолютный путь к папке пользователя
export function userDataDir(userId) 
{
	return path.join(DATA_ROOT, `user-${userId}`)
}


// Папка с досками пользователя
function boardsDir(userId) 
{
	return path.join(userDataDir(userId), 'boards')
}


// Файл со списком досок
function boardsIndexPath(userId) 
{
	return path.join(userDataDir(userId), 'boards-index.json')
}

// Названия досок по умолчанию
const DEFAULT_BOARD_NAME_RE = /^Доска\s+(\d+)$/

// Определяет максимальный номер доски по умолчанию
function getHighestDefaultBoardNumber(boards) 
{
	// Максимальный найденный номер доски
	let max = 0

	// Перебираем все доски
	for (const row of boards) 
	{
		// Если доска не существует или название не является строкой - пропускаем
		if (!row || typeof row.name !== 'string') continue

		// Проверяем, соответствует ли название доски шаблону
		const match = row.name.trim().match(DEFAULT_BOARD_NAME_RE)

		// Если название не соответствует шаблону - пропускаем
		if (!match) continue

		// Преобразуем название доски в число и обновляем максимальный номер
		const value = Number(match[1])

		// Проверяем, что это корректное целое число и обновляем максимальный номер
		if (Number.isInteger(value) && value > max) max = value
	}
	return max
}

// Читает индекс досок пользователя
function readBoardsIndex(userId) 
{
	try 
	{
		// Читаем файл индекс досок
		const raw = fs.readFileSync(boardsIndexPath(userId), 'utf8')

		// Преобразуем строку в json объект
		const parsed = JSON.parse(raw)

		// Получаем список досок
		const boards = Array.isArray(parsed.boards) ? parsed.boards : []

		// Получаем следующий номер доски по умолчанию
		const fallbackNext = getHighestDefaultBoardNumber(boards) + 1

		// Получаем следующий номер доски из файла
		const fromFile = Number(parsed.nextBoardNumber)

		// Получаем следующий номер доски
		const nextBoardNumber =
			Number.isInteger(fromFile) && fromFile > 0 ? fromFile : fallbackNext

		// Возвращаем список досок и следующий номер доски
		return { boards, nextBoardNumber }
	} catch {
		return { boards: [], nextBoardNumber: 1 }
	}
}

// Записывает индекс досок пользователя
function writeBoardsIndex(userId, boards, nextBoardNumber) 
{
	// Получаем следующий номер доски по умолчанию
	const fallbackNext = getHighestDefaultBoardNumber(boards) + 1

	// Получаем следующий номер доски
	const safeNext =
		Number.isInteger(nextBoardNumber) && nextBoardNumber > 0
			? nextBoardNumber
			: fallbackNext

	// Записываем индекс досок в файл
	fs.writeFileSync(
		boardsIndexPath(userId),
		JSON.stringify({ boards, nextBoardNumber: safeNext }, null, 2),
		'utf8'
	)
}

// Названия колонок по умолчанию
const DEFAULT_COLUMN_NAME_RE = /^Колонка\s+(\d+)$/

// Названия задач по умолчанию
const DEFAULT_TASK_NAME_RE = /^Задача\s+(\d+)$/

// Определяет максимальный номер колонки по умолчанию
function getHighestColumnNumber(columns) 
{
	// Максимальный найденный номер колонки
	let max = 0

	// Перебираем все колонки
	for (const column of columns) 
	{
		// Если колонка не существует или название не является строкой - пропускаем
		if (!column || typeof column.title !== 'string') continue

		// Проверяем, соответствует ли название колонки шаблону
		const match = column.title.trim().match(DEFAULT_COLUMN_NAME_RE)

		// Если название не соответствует шаблону - пропускаем
		if (!match) continue

		// Преобразуем название колонки в число и обновляем максимальный номер
		const value = Number(match[1])

		// Проверяем, что это корректное целое число и обновляем максимальный номер
		if (Number.isInteger(value) && value > max) max = value
	}
	return max
}

// Определяет максимальный номер задачи по умолчанию
function getHighestTaskNumber(tasks) 
{
	// Максимальный найденный номер задачи
	let max = 0

	// Перебираем все задачи
	for (const task of tasks) 
	{
		// Если задача не существует или содержимое не является строкой - пропускаем
		if (!task || typeof task.content !== 'string') continue

		// Проверяем, соответствует ли содержимое задачи шаблону
		const match = task.content.trim().match(DEFAULT_TASK_NAME_RE)

		// Если содержимое не соответствует шаблону - пропускаем
		if (!match) continue

		// Извлекаем номер задачи
		const value = Number(match[1])

		// Проверяем, что это корректное целое число и обновляем максимальный номер
		if (Number.isInteger(value) && value > max) max = value
	}
	return max
}


// json-файл конкретной доски
function boardFilePath(userId, boardId) 
{
	return path.join(boardsDir(userId), `${boardId}.json`)
}


// Папка с изображениями для одной доски
function boardMediaDir(userId, boardId) 
{
	return path.join(userDataDir(userId), 'board-media', boardId)
}


// Сохранение изображения на диск
export function saveBoardImageBuffer(userId, boardId, buffer, ext) 
{
	const dir = boardMediaDir(userId, boardId)

	// Создаем папку, если ее нет
	fs.mkdirSync(dir, { recursive: true })

	// Генерируем уникальное имя файла
	const fileId = `${crypto.randomUUID()}.${ext}`

	// Записываем бинарные данные файла
	fs.writeFileSync(path.join(dir, fileId), buffer)

	return { fileId }
}

// Получение пути к файлу изображения
export function getBoardMediaAbsolutePath(userId, boardId, fileId) 
{
	const dir = boardMediaDir(userId, boardId)
	const full = path.join(dir, fileId)

	// Проверяем существование файла
	if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null

	return full
}


// Удаление старых изображений, которых нет ни в одной доске
function cleanupBoardMediaNotInColumns(userId, boardId, columns) 
{
	// Путь к папке с изображением конкретной доски
	const dir = boardMediaDir(userId, boardId)

	// Если папка не существует ничего чистить не нужно
	if (!fs.existsSync(dir)) return

	// Список файлов, которые нужно сохранить
	const keep = new Set()

	// Собирает fileId из колонок
	if (Array.isArray(columns)) 
		{
		for (const c of columns) 
			{
			// Если колонка пустая или без изображения - пропускам
			if (!c || !Array.isArray(c.images)) continue
			for (const im of c.images) 
			{
				// Берем fileId из изображения
				if (im && typeof im.fileId === 'string') 
				{
					keep.add(im.fileId)
				}
			}
		}
	}

	// Текущее время, используется для проверки времени создания файлов
	const now = Date.now()

	// Защита от случайного удаления: если файл был создан недавно - не удаляем его
	const graceMs = 20_000 // 20 секунд

	// Перебираем все файлы в папке доски
	for (const name of fs.readdirSync(dir)) 
	{
		// Полный путь к файлу
		const fp = path.join(dir, name)

		// Если это не файл - пропускаем
		if (!fs.statSync(fp).isFile()) continue

		// Если файл используется в колонках - не удаляем
		if (keep.has(name)) continue

		try 
		{
			// Время жизни файла в миллисекундах
			const age = now - fs.statSync(fp).mtimeMs

			// Если файл недавний - не удаляем
			if (age < graceMs) continue

			// Удаляем файл, который больше не используется
			fs.unlinkSync(fp)
		} catch {
			// игнорируем ошибки
		}
	}
}


// Миграция старого формата данных пользователя в новый
function ensureBoardsMigratedFromLegacy(userId) 
{
	const dir = userDataDir(userId)
	if (!fs.existsSync(dir)) return

	const idxPath = boardsIndexPath(userId)
	if (fs.existsSync(idxPath)) return

	// Путь к старому файлу
	const legacyPath = path.join(dir, 'board.json')
	let columns = []
	let tasks = []

	// Если старый файл существует - читаем его
	if (fs.existsSync(legacyPath)) 
	{
		try 
		{
			const b = JSON.parse(fs.readFileSync(legacyPath, 'utf8'))

			columns = Array.isArray(b.columns) ? b.columns : []

			tasks = Array.isArray(b.tasks) ? b.tasks : []
		} catch {

		}
	}

	// Создание нового уникального ID доски
	const id = crypto.randomUUID()

	// Текущее время
	const now = new Date().toISOString()

	// Имя доски по умолчанию
	const name = 'Доска'
	const nextColumnNumber = getHighestColumnNumber(columns) + 1
	const nextTaskNumber = getHighestTaskNumber(tasks) + 1

	// Создание папки для новых досок, если ее нет
	fs.mkdirSync(boardsDir(userId), { recursive: true })

	// Новая структура доски
	const full = {
		id,
		name,
		columns,
		tasks,
		updatedAt: now,
		nextColumnNumber,
		nextTaskNumber,
	}

	// Сохранение новой доски в отдельный файл
	fs.writeFileSync(
		boardFilePath(userId, id),
		JSON.stringify(full, null, 2),
		'utf8'
	)

	// Создает файл, который хранит список досок пользователя
	fs.writeFileSync(
		idxPath,
		JSON.stringify(
			{ boards: [{ id, name, updatedAt: now }], nextBoardNumber: 1 },
			null,
			2
		),
		'utf8'
	)

	// Переименование старого файла
	try {
		fs.renameSync(legacyPath, `${legacyPath}.migrated.bak`)
	} catch {
		// нет или уже переименован
	}
}


/** Миграция старого глобального файла data/app.json в новую структуру:
 * - users.json (реестр пользователей)
 * - user-/meta.json (метаданные пользователя)
 * - user-/board.json (данные доски)
 * Запускается единожды при старте сервера
*/
export function migrateLegacyAppJsonOnce() {

	if (!fs.existsSync(LEGACY_APP_FILE) || fs.existsSync(USERS_FILE)) return

	try 
	{
		const raw = fs.readFileSync(LEGACY_APP_FILE, 'utf8')
		const old = JSON.parse(raw)
		const users = Array.isArray(old.users) ? old.users : []
		const boards = old.boards && typeof old.boards === 'object' ? old.boards : {}

		for (const user of users) 
		{
			if (!user?.id) continue

			const dir = userDataDir(user.id)

			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
			
			// Создаем метаданные пользователя
			const meta = {
				id: user.id,
				name: user.name,
				createdAt: user.createdAt || new Date().toISOString(),
			}

			// Сохраняем meta.json в папке пользователя
			fs.writeFileSync(
				path.join(dir, 'meta.json'),
				JSON.stringify(meta, null, 2),
				'utf8'
			)

			// Берем доску пользователя из старого файла или пустую
			const board = boards[user.id] ?? { columns: [], tasks: [] }

			// Сохраняем старую доску в новый формат
			fs.writeFileSync(
				path.join(dir, 'board.json'),
				JSON.stringify(
					{
						columns: board.columns ?? [],
						tasks: board.tasks ?? [],
					},
					null,
					2
				),
				'utf8'
			)
		}
		
		// Записываем новый users.json из старого списка пользователей
		writeUsersRegistry({ users })

		// Переименовываем старый файл
		try {
			fs.renameSync(LEGACY_APP_FILE, `${LEGACY_APP_FILE}.migrated.bak`)
		} catch {
			
		}
	} catch {
		
	}
}


// Поиск пользователя по имени (без учета регистра)
export function findUserByName(name) 
{
	const { users } = readUsersRegistry()
	const lower = name.toLowerCase()
	return users.find((u) => u.name.toLowerCase() === lower) ?? null
}


// Получить пользователя из реестра по ID
export function getUserById(id) 
{
	const { users } = readUsersRegistry()
	return users.find((u) => u.id === id) ?? null
}


// Список досок пользователя
export function listBoards(userId) 
{
	ensureBoardsMigratedFromLegacy(userId)

	const { boards } = readBoardsIndex(userId)

	// Возвращаем копию массива досок (сортировка по дате обновления - новые доски будут выше)
	return [...boards].sort(
		(a, b) =>
			new Date(b.updatedAt || 0).getTime() -
			new Date(a.updatedAt || 0).getTime()
	)
}


// Получение полной доски пользователя
export function getFullBoard(userId, boardId) 
{
	ensureBoardsMigratedFromLegacy(userId)

	const file = boardFilePath(userId, boardId)
	if (!fs.existsSync(file)) return null

	try {
		// Читаем файл доски и преобразуем его в json объект
		const b = JSON.parse(fs.readFileSync(file, 'utf8'))
		if (b.id !== boardId) return null

		const rawCols = Array.isArray(b.columns) ? b.columns : []

		// Обработка каждой колонки
		const columns = rawCols.map((c) => {

			// Если некорректна - создаем заглушку
			if (!c || typeof c !== 'object') 
			{
				return { id: crypto.randomUUID(), title: 'Колонка', images: [] }
			}

			// Проверяем изображение внутри колонки, возвращаем нормализованную строку
			const imgs = Array.isArray(c.images)
				? c.images.filter(
						(im) =>
							im &&
							typeof im === 'object' &&
							typeof im.id === 'string' &&
							typeof im.fileId === 'string',
					)
				: []
			return {
				...c,
				id: c.id,
				title: typeof c.title === 'string' ? c.title : 'Колонка',
				images: imgs,
			}
		})

		// Формируем и возвращаем итоговую структуру доски
		return {
			id: boardId,
			name: typeof b.name === 'string' ? b.name : 'Доска',
			columns,
			tasks: Array.isArray(b.tasks) ? b.tasks : [],
			updatedAt:
				typeof b.updatedAt === 'string'
					? b.updatedAt
					: new Date().toISOString(),
			nextColumnNumber:
				Number.isInteger(b.nextColumnNumber) && b.nextColumnNumber > 0
					? b.nextColumnNumber
					: getHighestColumnNumber(columns) + 1,
			nextTaskNumber:
				Number.isInteger(b.nextTaskNumber) && b.nextTaskNumber > 0
					? b.nextTaskNumber
					: getHighestTaskNumber(Array.isArray(b.tasks) ? b.tasks : []) + 1,
		}
	} catch {
		return null
	}
}


// Сохраняет все данные строки
export function saveFullBoard(userId, boardId, data) 
{
	// Оборачиваем операцию в lock, чтобы избежать одновременной записи файлов
	return withLock(() => {
		// Загружаем существующую доску
		const existing = getFullBoard(userId, boardId)
		if (!existing) return false

		const now = new Date().toISOString()

		// Определяем новое имя доски: если передано корректное имя - используем его, иначе оставляем старое
		const name =
			typeof data.name === 'string' && data.name.trim()
				? data.name.trim().slice(0, 80)
				: existing.name

		// Формируем полную структуру доски для сохранения
		const full = {
			id: boardId,
			name,
			columns: data.columns,
			tasks: data.tasks,
			updatedAt: now,
			nextColumnNumber:
				Number.isInteger(data.nextColumnNumber) && data.nextColumnNumber > 0
					? data.nextColumnNumber
					: existing.nextColumnNumber,
			nextTaskNumber:
				Number.isInteger(data.nextTaskNumber) && data.nextTaskNumber > 0
					? data.nextTaskNumber
					: existing.nextTaskNumber,
		}

		// Создание папки досок, если ее нет
		fs.mkdirSync(boardsDir(userId), { recursive: true })

		// Сохранение доски в файл
		fs.writeFileSync(
			boardFilePath(userId, boardId),
			JSON.stringify(full, null, 2),
			'utf8'
		)


		// Обновление индекса досок
		const { boards, nextBoardNumber } = readBoardsIndex(userId)

		// Нашли ли доску в индексе
		let found = false

		// Обновляем запись в индексе
		const next = boards.map((row) => {

			// Если нашли нужную строку
			if (row.id === boardId) 
			{
				found = true

				// Обновляем имя и дату
				return { id: boardId, name, updatedAt: now }
			}

			// Остальные доски без изменений
			return row
		})

		// Если доски не было в индексе - добавляем ее
		if (!found) next.push({ id: boardId, name, updatedAt: now })
		
		// Сохраняем обновленный индекс в файл
		writeBoardsIndex(userId, next, nextBoardNumber)

		// Удаляем старые изображения, которые больше не используются в колонках
		cleanupBoardMediaNotInColumns(userId, boardId, data.columns)

		return true
	})
}


// Создает пустую доску и добавляет в индекс досок пользователя
export function createBoard(userId, name) 
{
	// Оборачиваем операцию в lock, чтобы избежать одновременной записи файлов
	return withLock(() => {
		ensureBoardsMigratedFromLegacy(userId)

		// Генерируем уникальный ID новой доски
		const id = crypto.randomUUID()

		const now = new Date().toISOString()

		// Формируем имя доски: если пользователь передал корректное имя - используем его, иначе используем имя - "Новая доска"
		const boardName = name && name.trim() ? name.trim().slice(0, 80) : 'Новая доска'

		// Создаём структуру новой пустой доски
		const full = {
			id,
			name: boardName,
			columns: [],
			tasks: [],
			updatedAt: now,
			nextColumnNumber: 1,
			nextTaskNumber: 1,
		}

		// Создаём папку пользователя для досок
		fs.mkdirSync(boardsDir(userId), { recursive: true })

		// Сохраняем доску в отдельный JSON файл
		fs.writeFileSync(
			boardFilePath(userId, id),
			JSON.stringify(full, null, 2),
			'utf8'
		)

		const { boards, nextBoardNumber } = readBoardsIndex(userId)

		// Добавляем новую доску в список
		boards.push({ id, name: boardName, updatedAt: now })

		// Сохраняем обновленный индекс досок
		writeBoardsIndex(userId, boards, nextBoardNumber)

		return full
	})
}

export function createAutoNamedBoard(userId) 
{
	return withLock(() => {
		ensureBoardsMigratedFromLegacy(userId)

		const id = crypto.randomUUID()
		const now = new Date().toISOString()
		const { boards, nextBoardNumber } = readBoardsIndex(userId)
		const boardName = `Доска ${nextBoardNumber}`

		const full = {
			id,
			name: boardName,
			columns: [],
			tasks: [],
			updatedAt: now,
			nextColumnNumber: 1,
			nextTaskNumber: 1,
		}

		fs.mkdirSync(boardsDir(userId), { recursive: true })
		fs.writeFileSync(
			boardFilePath(userId, id),
			JSON.stringify(full, null, 2),
			'utf8'
		)

		boards.push({ id, name: boardName, updatedAt: now })
		writeBoardsIndex(userId, boards, nextBoardNumber + 1)

		return full
	})
}


// Обновляет имя доски в json файла и в индексе досок
export function renameBoard(userId, boardId, name) 
{
	// Оборачиваем операцию в lock, чтобы избежать одновременной записи файлов
	return withLock(() => {
		const existing = getFullBoard(userId, boardId)
		if (!existing) return { ok: false, code: 'not_found' }

		// Текущее время обновления
		const now = new Date().toISOString()

		// Создаем новый объект доски: копируем старые данные и обновляем только name и updatedAt
		const full = {
			...existing,
			name,
			updatedAt: now,
		}

		// Сохраняем обновленную доску в файл
		fs.writeFileSync(
			boardFilePath(userId, boardId),
			JSON.stringify(full, null, 2),
			'utf8'
		)

		const { boards, nextBoardNumber } = readBoardsIndex(userId)

		// Создаем новый список досок с обновленным именем
		const next = boards.map((row) =>
			row.id === boardId
				? { id: boardId, name, updatedAt: now }
				: row
		)

		// Сохраняем обновленный индекс в файл
		writeBoardsIndex(userId, next, nextBoardNumber)
		
		return { ok: true, board: { id: boardId, name, updatedAt: now } }
	})
}


/**
 * Удаляет доску пользователя:
 * - удаляет файл доски
 * - удаляет запись из индекса 
 * - удаляет связанные с ней изображения
 * Запрещено удалять последнюю доску пользователя
 */
export function deleteBoard(userId, boardId) 
{
	// Оборачиваем операцию в lock, чтобы избежать одновременной записи файлов
	return withLock(() => {
		ensureBoardsMigratedFromLegacy(userId)

		const file = boardFilePath(userId, boardId)
		if (!fs.existsSync(file)) return { ok: false, code: 'not_found' }

		const { boards, nextBoardNumber } = readBoardsIndex(userId)

		// Запрещаем удалять последнюю доску
		if (boards.length <= 1)
		{
			return { ok: false, code: 'last_board' }
		}
		
		// Проверяем, существует ли доска в списке
		if (!boards.some((b) => b.id === boardId)) 
		{
			return { ok: false, code: 'not_found' }
		}

		const mediaDir = boardMediaDir(userId, boardId)

		// Удаляем папку с изображениями
		if (fs.existsSync(mediaDir)) {
			try {
				fs.rmSync(mediaDir, { recursive: true, force: true })
			} catch {
			}
		}

		// Удаляем файл самой доски
		fs.unlinkSync(file)

		// Создаем новый список досок без удаленной
		const next = boards.filter((b) => b.id !== boardId)

		// Сохраняем обновленный индекс
		writeBoardsIndex(userId, next, nextBoardNumber)

		return { ok: true }
	})
}


/**
 * Регистрация нового пользователя:
 * - добавляет пользователя в реестр
 * - создает папку пользователя
 * - создает первую доску "Доска 1"
 * При дубликате имени после преобразования toLowerCase - возвращает null
 */
export function createUserWithDataFolder(name) 
{
	// Оборачиваем операцию в lock, чтобы избежать одновременной записи файлов
	return withLock(() => {
		// Считываем текущий реестр пользователей users.json
		const registry = readUsersRegistry()

		// Приводим имя к нижнему регистру для проверки дубликатов
		const lower = name.toLowerCase()

		// Проверяем существует ли пользователей с таким же именем (без учета регистра)
		if (registry.users.some((u) => u.name.toLowerCase() === lower)) 
		{
			return null
		}

		// Создаем нового пользователя
		const user = {
			id: crypto.randomUUID(),
			name,
			createdAt: new Date().toISOString(),
		}

		// Добавляем пользователя в реестр, только память
		registry.users.push(user)

		const dir = userDataDir(user.id)
		fs.mkdirSync(dir, { recursive: true })

		// Создаем meta.json - дублирует основные данные пользователя
		const meta = {
			id: user.id,
			name: user.name,
			createdAt: user.createdAt,
		}

		// Сохраняем meta.json на диск
		fs.writeFileSync(
			path.join(dir, 'meta.json'),
			JSON.stringify(meta, null, 2),
			'utf8'
		)

		// Создание первой доски пользователя
		const boardId = crypto.randomUUID()
		const now = new Date().toISOString()
		const boardName = 'Доска 1'

		// Создание папки для досок пользователя
		fs.mkdirSync(boardsDir(user.id), { recursive: true })

		// Сохраняем полностью первую доску
		fs.writeFileSync(
			boardFilePath(user.id, boardId),
			JSON.stringify(
				{
					id: boardId,
					name: boardName,
					columns: [],
					tasks: [],
					updatedAt: now,
					nextColumnNumber: 1,
					nextTaskNumber: 1,
				},
				null,
				2
			),
			'utf8'
		)

		// Создаем индекс досок
		fs.writeFileSync(
			boardsIndexPath(user.id),
			JSON.stringify(
				{
					boards: [{ id: boardId, name: boardName, updatedAt: now }],
					nextBoardNumber: 2,
				},
				null,
				2
			),
			'utf8'
		)

		// Сохраняем обновленный реестр пользователей в users.json
		writeUsersRegistry(registry)

		return user
	})
}
