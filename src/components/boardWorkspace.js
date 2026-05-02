/**
 * Рабочая область с боковой панелью списка досок и основной рабочей зоной канбан
*/

import { createElement, Fragment, useCallback, useEffect, useState } from 'react'
import {
	activeBoardStorageKey,
	createBoard,
	deleteBoard as deleteBoardRequest,
	listBoards,
	patchBoardName,
} from '../api/client.js'; // API-функции для работы с сервером
import PlusIcon from '../api/icons/plusIcon.js'; // иконка "+"
import './boardWorkspace.css'; // стили
import KanbanBoard from './kanbanBoard.js'; // компонент канбан-доски


// Рабочий экран после входа
function BoardWorkspace({ authToken, userId }) 
{
	// Список досок пользователя
	const [boards, setBoards] = useState([])

	// ID текущей выбранной доски
	const [activeBoardId, setActiveBoardId] = useState(null)

	// Флаг загрузки списка досо
	const [loading, setLoading] = useState(true)

	// Флаг создания новой доски (блокирует кнопку "Новая")
	const [creating, setCreating] = useState(false)

	// Текст ошибки 
	const [error, setError] = useState('')

	// ID доски, которую сейчас переименовывают
	const [editingBoardId, setEditingBoardId] = useState(null)

	// Введенное новое имя доски
	const [editingName, setEditingName] = useState('')

	// Флаг сохранения имения
	const [savingRename, setSavingRename] = useState(false)

	// Ключ LocalStorage (уникален для каждого пользователя)
	const storageKey = activeBoardStorageKey(userId)

	// Загрузка списка досок с сервера
	const refreshBoards = useCallback(async () => {
		// Запрос к API
		const data = await listBoards(authToken)

		// Проверяет, что boards - массив
		const list = Array.isArray(data.boards) ? data.boards : []

		// Сохраняем в state
		setBoards(list)

		return list
	}, [authToken])


	// Инициализация
	useEffect(() => {
		let cancelled = false

		setLoading(true)
		setError('')
		
		;(async () => {
			try {
				// Загружаем доски
				const list = await refreshBoards()

				if (cancelled) return

				// Пробуем восстановить последнюю открытую доску
				let preferred = null
				try {
					preferred = localStorage.getItem(storageKey)
				} catch {
					// Если LocaleStorage недоступен - игнорируем
				}

				// Проверяем, существует ли такая доска
				const exists = preferred && list.some((b) => b.id === preferred)

				// Выбираем: либо сохраненную, либо первую
				const nextId = exists ? preferred : list[0]?.id ?? null

				setActiveBoardId(nextId)
			} catch (e) {
				if (!cancelled) {
					setError(
						e instanceof Error ? e.message : 'Не удалось загрузить доски',
					)
				}
			} finally {
				// Убираем загрузку
				if (!cancelled) setLoading(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [authToken, userId, refreshBoards, storageKey])


	// Выбор доски
	const selectBoard = useCallback(
		(id) => {
			// Выходим из режима редактирования
			setEditingBoardId(null)

			// Выбираем доску
			setActiveBoardId(id)

			// Сохраняем выбор в LocalStorage
			try {
				localStorage.setItem(storageKey, id)
			} catch {
				//
			}
		},
		[storageKey],
	)


	// Создание пустой доски 
	const handleCreateBoard = useCallback(async () => {

		setCreating(true)
		setError('')

		try 
		{
			// Создаем доску
			const data = await createBoard(authToken, {})

			const b = data.board

			if (!b?.id) throw new Error('Неверный ответ сервера')
			
			// Добавляем новую доску в начало списка
			setBoards((prev) => [
				{
					id: b.id,
					name: b.name,
					updatedAt: b.updatedAt,
				},
				// Убираем дубликаты
				...prev.filter((x) => x.id !== b.id), 
			])

			// Делаем доску активной
			selectBoard(b.id)

		} catch (e) {
			setError(e instanceof Error ? e.message : 'Не удалось создать доску')
		} finally {
			setCreating(false)
		}
	}, [authToken, selectBoard])


	// Переименования доски
	const startRename = useCallback((b) => {
		// Режим редактирования
		setEditingBoardId(b.id)

		// Замена текущего имени
		setEditingName(b.name)

		setError('')
	}, [])


	// Отмена переименования доски
	const cancelRename = useCallback(() => {
		// Выходим из режима редактирования
		setEditingBoardId(null)

		// Очищаем введенное имя
		setEditingName('')
	}, [])


	// Сохранение нового имени доски
	const saveRename = useCallback(async () => {

		if (!editingBoardId) return

		// Убираем пробелы в начале и конце строки
		const trimmed = editingName.trim()

		// Если после удаление пробелов строка пустая - ошибка
		if (!trimmed) {
			setError('Введите имя доски')
			return
		}

		// Состояние сохранения
		setSavingRename(true)

		setError('')


		try 
		{
			// Отправляем запрос на сервер для переименования доски
			const data = await patchBoardName(authToken, editingBoardId, trimmed)

			// Получаем обновленную доску 
			const nb = data.board

			// Обновляем список досок. Если это та доска, которую мы переименовали - возвращаем обновленный объект
			setBoards((prev) =>
				prev.map((x) =>
					x.id === nb.id
						? { ...x, name: nb.name, updatedAt: nb.updatedAt }
						: x,
				),
			)

			// Выходим из режима редактирования
			setEditingBoardId(null)

			// Очищаем поле ввода
			setEditingName('')
		} catch (e) {
			setError(
				e instanceof Error ? e.message : 'Не удалось переименовать доску',
			)
		} finally {
			// Завершаем сохранение
			setSavingRename(false)
		}
	}, [authToken, editingBoardId, editingName])


	// Удаление доски после подтверждения в диалоге
	const handleDeleteBoard = useCallback(
		// async-функция, поскольку производим запрос к серверу
		async (b) => {
			// Показываем окно подтверждения удаления
			if (!window.confirm(`Удалить доску «${b.name}»?`)) return

			setError('')

			try 
			{
				// Отправляем запрос на сервер для удаления доски
				await deleteBoardRequest(authToken, b.id)

				// Проверка: была ли удаленная доска активной
				const wasActive = activeBoardId === b.id

				// Создаем новый список досок без удаленной
				const nextList = boards.filter((x) => x.id !== b.id)

				setBoards(nextList)

				// Если удаляемая доска была в режиме редактирования имени - выходим из режима
				setEditingBoardId((id) => (id === b.id ? null : id))

				// Если удалили активную доску
				if (wasActive) {
					// Выбираем следующую доску или null
					const nextId = nextList[0]?.id ?? null

					setActiveBoardId(nextId)

					try 
					{
						if (nextId) localStorage.setItem(storageKey, nextId)
						else localStorage.removeItem(storageKey)
					} catch {
						//
					}
				}
			} catch (e) {
				setError(
					e instanceof Error ? e.message : 'Не удалось удалить доску',
				)
			}
		},
		[authToken, activeBoardId, boards, storageKey],
	)


	// Формирует содержимое списка в левой панели
	const listContent = loading
		? createElement('p', { className: 'board-sidebar__muted' }, 'Загрузка...')
		: boards.length === 0
			? createElement(
					'p',
					{ className: 'board-sidebar__muted' },
					'Нет досок. Создайте первую.',
				)
			: boards.map((b) => {

					const isActive = b.id === activeBoardId
					const isEditing = editingBoardId === b.id

					// Создаем контейнер доски в sidebar
					return createElement(
						'div',
						{
							key: b.id,
							// Если active - добавляем модификатор класса
							className: isActive
								? 'board-sidebar__row board-sidebar__row--active'
								: 'board-sidebar__row',
						},
						// Если доска в режиме редактирования имени
						isEditing 
							? createElement(
									'div',
									{ className: 'board-sidebar__rename' },
									// Поле ввода нового имени
									createElement('input', {
										className: 'board-sidebar__rename-input',
										value: editingName,

										// Обновляем состояние при вводе текста
										onChange: (e) => setEditingName(e.target.value),

										// Горячие клавиши
										onKeyDown: (e) => {
											if (e.key === 'Enter') saveRename()
											if (e.key === 'Escape') cancelRename()
										},
										// Фокус на input
										autoFocus: true,
										disabled: savingRename,
									}),
									// Кнопки управления: сохранить и отмена
									createElement(
										'div',
										{ className: 'board-sidebar__rename-actions' },
										createElement(
											'button',
											{
												type: 'button',
												className: 'board-sidebar__btn board-sidebar__btn--primary',
												onClick: saveRename,
												disabled: savingRename,
											},
											'Сохранить',
										),
										createElement(
											'button',
											{
												type: 'button',
												className: 'board-sidebar__btn',
												onClick: cancelRename,
												disabled: savingRename,
											},
											'Отмена',
										),
									),
								)
							// Иначе обычный режим просмотра доски
							: createElement(
									Fragment,
									null,

									// Кнопка выбора доски, открывает ее справа
									createElement(
										'button',
										{
											type: 'button',
											className: 'board-sidebar__select',
											onClick: () => selectBoard(b.id),
										},

										// Отображаем имя доски
										createElement(
											'span',
											{ className: 'board-sidebar__item-name' },
											b.name,
										),
									),

									// Блок иконок действий: редактирование и удаления
									createElement(
										'div',
										{ className: 'board-sidebar__actions' },
										createElement(
											'button',
											{
												type: 'button',
												className: 'board-sidebar__icon',
												title: 'Переименовать',
												'aria-label': 'Переименовать',
												onClick: (e) => {
													e.stopPropagation()
													startRename(b)
												},
											},
											'✎',
										),
										createElement(
											'button',
											{
												type: 'button',
												className:
													'board-sidebar__icon board-sidebar__icon--danger',
												title: 'Удалить доску',
												'aria-label': 'Удалить доску',
												onClick: (e) => {
													e.stopPropagation()
													handleDeleteBoard(b)
												},
											},
											'✕',
										),
									),
								),
					)
				})

	// Правая часть интерфейса
	const mainContent = activeBoardId
		? createElement(KanbanBoard, {
				key: activeBoardId,
				authToken,
				boardId: activeBoardId,
			})
		: !loading
			? createElement(
					'div',
					{ className: 'board-workspace__empty' },
					createElement(
						'p',
						null,
						'Выберите доску слева или создайте новую.',
					),
				)
			: null


	// Основная разметка страницы. Используется flex: слева sidebar, справа main (канбан)
	return createElement(
		'div',
		{ className: 'board-workspace' },

		// Sidebar
		createElement(
			'aside',
			{ className: 'board-sidebar', 'aria-label': 'Список досок' },
			// Верхняя часть sidebar: заголовок и кнопка
			createElement(
				'div',
				{ className: 'board-sidebar__head' },
				createElement('h2', { className: 'board-sidebar__title' }, 'Доски'),
				createElement(
					'button',
					{
						type: 'button',
						className: 'board-sidebar__new',
						onClick: handleCreateBoard,
						disabled: creating || loading,
					},
					createElement(PlusIcon, null),
					createElement('span', null, 'Новая'),
				),
			),
			error ? createElement('p', { className: 'board-sidebar__error' }, error) : null,

			// Навигационный список досок
			createElement(
				'nav',
				{ className: 'board-sidebar__list' },
				// Ползунок прокрутки
				createElement(
					'div',
					{ className: 'board-sidebar__list-scroll' },
					createElement('div', { className: 'board-sidebar__list-stack' }, listContent),
				),
			),
		),

		// Основная рабочая область
		createElement('main', { className: 'board-workspace__main' }, mainContent),
	)
}

export default BoardWorkspace