/**
 * HTTP-клиента для backend API (сервер написана на Express)
 */


// Возвращает базовый URL API
export function getApiBase() 
{
	const base = import.meta.env.VITE_API_URL
	return typeof base === 'string' ? base.replace(/\/$/, '') : ''
}


// Универсальная функция для запросов к API
export async function api(path, options = {}) 
{
	const { token, method = 'GET', body } = options

	const headers = {}

	// Если есть body - отправляем json
	if (body !== undefined) headers['Content-Type'] = 'application/json'

	// Если есть токен - добавляем авторизацию
	if (token) headers.Authorization = `Bearer ${token}`

	// Формируем полный URL
	const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`

	// Выполняем HTTP-запрос
	const res = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
	})

	// Если ошибка
	if (!res.ok) 
	{

		// Пробуем получить json с ошибкой 
		const err = await res.json().catch(() => ({}))

		throw new Error(err.error || res.statusText)
	}

	// Нет содержания
	if (res.status === 204) return null

	return res.json()
}


// Ключ для хранения JWT токена в браузере
export const AUTH_TOKEN_KEY = 'kanban_auth_token'


// Ключ для запоминания последней открытой доски в рамках одного пользователя
export function activeBoardStorageKey(userId) 
{
	return `kanban_active_board:${userId}`
}


// Вход или регистрация по имени пользователя
export function login(name) 
{
	return api('/api/login', { method: 'POST', body: { name } })
}


// Получить текущего пользователя по сохраненному токену
export function getMe(token)
{
	return api('/api/me', { token })
}


// Получить список досок пользователя для боковой панели
export function listBoards(token) 
{
	return api('/api/boards', { token })
}


// Создать новую доску
export function createBoard(token, body)
{
	return api('/api/boards', { method: 'POST', token, body: body ?? {} })
}


// Получить одну доску полностью
export function getBoard(token, boardId) 
{
	return api(`/api/boards/${encodeURIComponent(boardId)}`, { token })
}


// Сохранить всю доску, полная перезапись состояния доски после правок
export function saveBoard(token, boardId, board) 
{
	return api(`/api/boards/${encodeURIComponent(boardId)}`, {
		method: 'PUT',
		token,
		body: board,
	})
}


// Обновить только имя доски
export function patchBoardName(token, boardId, name)
{
	return api(`/api/boards/${encodeURIComponent(boardId)}`, {
		method: 'PATCH',
		token,
		body: { name },
	})
}


// Удалить доску
export function deleteBoard(token, boardId) 
{
	return api(`/api/boards/${encodeURIComponent(boardId)}`, {
		method: 'DELETE',
		token,
	})
}


// Загрузка изображения в колонку
export async function uploadColumnImage(token, boardId, columnId, file) 
{
	// Создаем FormData для файлов
	const form = new FormData()

	// Добавляем файл
	form.append('file', file)

	// Формируем URL
	const url = `${getApiBase()}/api/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/images`

	const headers = {}

	if (token) headers.Authorization = `Bearer ${token}`

	// Отправляем запрос
	const res = await fetch(url, { method: 'POST', headers, body: form })


	if (!res.ok) 
	{
		const err = await res.json().catch(() => ({}))
		throw new Error(err.error || res.statusText)
	}

	return res.json()
}