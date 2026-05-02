/** 
 * Express API сервер
 * Данные пользователей и досок находятся в файловой системе (модуль ./storage.js)
 */
import cors from 'cors'; // разрешить запросы к серверу с других доменов (origin)
import express from 'express'; // веб-сервер
import jwt from 'jsonwebtoken'; // JWT авторизация
import multer from 'multer'; // загрузка изображений
import path from 'path'; // работа с путями файлов
/**
 * Импорт функций для работы с данными (файловая БД)
 */
import {
	createBoard,
	createAutoNamedBoard,
	createUserWithDataFolder,
	deleteBoard,
	findUserByName,
	getBoardMediaAbsolutePath,
	getFullBoard,
	getUserById,
	listBoards,
	migrateLegacyAppJsonOnce,
	renameBoard,
	saveBoardImageBuffer,
	saveFullBoard,
} from './storage.js'

// Порт сервера (по умолчанию 3001)
const PORT = Number(process.env.PORT) || 3001

const JWT_SECRET = process.env.JWT_SECRET || 'my-secret-key'

// Время жизни токена
const JWT_EXPIRES = '30d'

const app = express()

// origin: true - автоматически подставляем origin клиента
app.use(cors({ origin: true }))

// Лимит JSON: доска с большим числом задач не должна обрезаться по умолчанию (100kb)
app.use(express.json({ limit: '2mb' }))


// Буфер в памяти, ограничение файла 5МВ
const uploadImage = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
})


// Создание JWT токена
function signToken(userId) {
	return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
}


/** 
 * Авторизация
 * - читает Bearer токен из заголовка Authorization
 * - проверяет JWT
 * - кладёт userId в req.userId
 */
function authMiddleware(req, res, next) {
	const header = req.headers.authorization

	const token =
		header && header.startsWith('Bearer ')
			? header.slice('Bearer '.length).trim()
			: null
	
	if (!token) 
	{
		res.status(401).json({ error: 'Требуется авторизация' })
		return
	}
	
	try {
		const payload = jwt.verify(token, JWT_SECRET)
		const userId = typeof payload.sub === 'string' ? payload.sub : null
		if (!userId) {
			res.status(401).json({ error: 'Неверный токен' })
			return
		}
		req.userId = userId
		next()
	} catch {
		res.status(401).json({ error: 'Сессия устарела, войдите снова' })
	}
}


// Нормализация имени пользователя
function normalizeName(name) {
	if (typeof name !== 'string') return ''
	return name.trim()
}


// Нормализация имени доски, максимум 80 символов
function normalizeBoardTitle(name) {
	if (typeof name !== 'string') return ''
	return name.trim().slice(0, 80)
}


/**
 * Валидация доски, проверяет:
 * - массивы
 * - корректность полей
 * - формат fileId у изображений
 * 
 * Возвращает нормализованный объект или null при ошибке.
 */
function validateBoard(body) 
{
	// Проверка существования body
	if (!body || typeof body !== 'object') return null

	// Достаем колонки и задачи из body
	const { columns, tasks } = body

	if (!Array.isArray(columns) || !Array.isArray(tasks)) return null

	// Регулярное выражение для проверки fileId изображения: UUID (36 символов) + расширение картинки
	const fileIdRe = /^[a-f0-9-]{36}\.(jpg|png|gif|webp)$/i

	// Проход по всем колонкам
	for (const c of columns) 
	{
		if (!c || typeof c !== 'object') return null

		if (!('id' in c) || typeof c.title !== 'string') return null

		// Проверка изображений в колонке
		if (c.images !== undefined && c.images !== null)
		{
			if (!Array.isArray(c.images)) return null

			// Проверка каждого изображения в колонке
			for (const im of c.images) 
			{
				if (!im || typeof im !== 'object') return null
				if (typeof im.id !== 'string' || typeof im.fileId !== 'string') return null
				if (!fileIdRe.test(im.fileId)) return null
			}
		}
	}

	// Проход по всем задачам
	for (const t of tasks) 
		{
		if (!t || typeof t !== 'object') return null
		if (!('id' in t) || !('columnId' in t) || t.columnId == null) return null
		if (typeof t.content !== 'string') return null
	}
	// Обработка имени доски
	const name =
		typeof body.name === 'string' && body.name.trim()
			? body.name.trim().slice(0, 80)
			: undefined

	// Счетчики автонумерации внутри доски
	const nextColumnNumber =
		Number.isInteger(body.nextColumnNumber) && body.nextColumnNumber > 0
			? body.nextColumnNumber
			: undefined
	const nextTaskNumber =
		Number.isInteger(body.nextTaskNumber) && body.nextTaskNumber > 0
			? body.nextTaskNumber
			: undefined
	
	// Возвращает обработанную и проверенную структуру
	return { columns, tasks, name, nextColumnNumber, nextTaskNumber }
}


/** 
 * Вход / регистрация по имени 
 * Ограничение: 1-40 символов 
 * Если пользователь есть - просто выдаем его токен
 * Если пользователя нет - создаем токен*/
app.post('/api/login', async (req, res) => {

	const name = normalizeName(req.body?.name)

	if (name.length < 1 || name.length > 40) 
	{
		res.status(400).json({ error: 'Имя: от 1 до 40 символов' })
		return
	}

	// Поиск пользователя в хранилище по имени 
	let user = findUserByName(name)

	if (user)
	{
		// Пользователь найден, новый не создаём
	} 
	else 
	{
		// Создаем нового пользователя и папку для его данных
		const created = await createUserWithDataFolder(name)
		if (created) 
		{
			user = created
		} 
		else 
		{
			user = findUserByName(name)
		}
	}
	if (!user) 
	{
		res.status(500).json({ error: 'Не удалось создать пользователя' })
		return
	}

	// Создание JWT токена пользователя для авторизации
	const token = signToken(user.id)
	// Отправляем ответ клиенту
	res.json({
		token,
		user: { id: user.id, name: user.name },
	})
})


// Проверка текущего пользователя
app.get('/api/me', authMiddleware, (req, res) => {
	const user = getUserById(req.userId)
	if (!user) 
	{
		res.status(401).json({ error: 'Пользователь не найден' })
		return
	}
	res.json({ user: { id: user.id, name: user.name } })
})


// Список досок
app.get('/api/boards', authMiddleware, (req, res) => {
	const boards = listBoards(req.userId)
	res.json({ boards })
})


// Создание пустой доски
app.post('/api/boards', authMiddleware, async (req, res) => {
	const rawName = normalizeName(req.body?.name)
	const full = rawName
		? await createBoard(req.userId, rawName)
		: await createAutoNamedBoard(req.userId)
	res.status(201).json({
		board: {
			id: full.id,
			name: full.name,
			columns: full.columns,
			tasks: full.tasks,
			updatedAt: full.updatedAt,
		},
	})
})


// Получение доски
app.get('/api/boards/:boardId', authMiddleware, (req, res) => {
	const board = getFullBoard(req.userId, req.params.boardId)
	if (!board) 
	{
		res.status(404).json({ error: 'Доска не найдена' })
		return
	}
	res.json(board)
})


// Таблица соответствий с расширениями файлов
const MEDIA_TYPES = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
}


// Получение изображения из конкретной доски
app.get('/api/boards/:boardId/media/:fileId', authMiddleware, (req, res) => {
	// Декодируем fileId на случай, если в URL были спецсимволы
	const fileId = decodeURIComponent(req.params.fileId)

	// Получение абсолютного пути к файлу на сервере
	const abs = getBoardMediaAbsolutePath(
		req.userId,
		req.params.boardId,
		fileId,
	)

	// Файл не найден
	if (!abs) 
	{
		res.status(404).end()
		return
	}

	const ext = path.extname(fileId).toLowerCase()

	// Устанавливаем правильный тип для браузера
	res.setHeader('Content-Type', MEDIA_TYPES[ext] || 'application/octet-stream')

	res.sendFile(abs)
})


// Загрузка изображения в колонку
app.post(
	'/api/boards/:boardId/columns/:columnId/images',
	authMiddleware,
	uploadImage.single('file'),
	(req, res) => {
		// Проверяем, что файл действительно пришел и есть данные файла
		if (!req.file?.buffer) 
		{
			res.status(400).json({ error: 'Файла нет' })
			return
		}

		// Таблица соответствий с расширениями файлов
		const mimeToExt = {
			'image/jpeg': 'jpg',
			'image/png': 'png',
			'image/gif': 'gif',
			'image/webp': 'webp',
		}

		const ext = mimeToExt[req.file.mimetype]

		if (!ext) 
		{
			res.status(400).json({ error: 'Допустимы только форматы: jpeg, png, gif, webp'})
			return
		}

		// Загружаем всю доску пользователя из хранилища
		const board = getFullBoard(req.userId, req.params.boardId)

		if (!board) 
		{
			res.status(404).json({ error: 'Доска не найдена' })
			return
		}

		const colId = decodeURIComponent(req.params.columnId)

		// Существует ли колонка в доске
		const hasColumn = board.columns.some(
			(c) => c != null && String(c.id) === String(colId),
		)
		if (!hasColumn) 
		{
			res.status(404).json({ error: 'Колонка не найдена' })
			return
		}

		// Сохранение изображения в файловую систему
		const { fileId } = saveBoardImageBuffer(
			req.userId,
			req.params.boardId,
			req.file.buffer,
			ext,
		)

		// Создание объекта изображения с уникальным id
		const image = { id: crypto.randomUUID(), fileId }

		res.status(201).json({ image })
	},
)


// Полное обновление доски, перезапись состояния
app.put('/api/boards/:boardId', authMiddleware, async (req, res) => {
	const payload = validateBoard(req.body)
	if (!payload) 
	{
		res.status(400).json({ error: 'Некорректные данные доски' })
		return
	}

	// Сохранение доски в хранилище
	const ok = await saveFullBoard(req.userId, req.params.boardId, payload)

	if (!ok) 
	{
		res.status(404).json({ error: 'Доска не найдена' })
		return
	}

	res.status(204).end()
})

// Переименование доски в списке
app.patch('/api/boards/:boardId', authMiddleware, async (req, res) => {
	const title = normalizeBoardTitle(req.body?.name)
	if (title.length < 1) 
	{
		res.status(400).json({ error: 'Имя доски: от 1 до 80 символов' })
		return
	}

	// Переименовываем доску в хранилище
	const result = await renameBoard(req.userId, req.params.boardId, title)

	if (!result.ok) 
	{
		res.status(404).json({ error: 'Доска не найдена' })
		return
	}
	res.json({ board: result.board })
})


// Удаление доски
app.delete('/api/boards/:boardId', authMiddleware, async (req, res) => {

	// Удаляем доску из хранилища
	const result = await deleteBoard(req.userId, req.params.boardId)

	if (!result.ok) 
	{
		// Если последняя доска пользователя
		if (result.code === 'last_board') 
		{
			res.status(400).json({ error: 'Нельзя удалить последнюю доску' })
			return
		}
		res.status(404).json({ error: 'Доска не найдена' })
		return
	}
	res.status(204).end()
})


/**
 * Миграция старых данных, выполняется один раз при запуске
 * Нужен для обновления старых данных проекта, чтобы они не ломали новую версию приложения
 */
migrateLegacyAppJsonOnce()


// Запуск HTTP сервера
app.listen(PORT, () => {
	// Выводим адрес сервера в консоль
	console.log(`API http://localhost:${PORT}`)
})
