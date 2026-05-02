import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove } from '@dnd-kit/sortable'
import { createElement, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getBoard, saveBoard, uploadColumnImage } from '../api/client.js'
import PlusIcon from '../api/icons/plusIcon.js'
import ColumnContainer from './columnContainer.js'
import ColumnImage from './columnImage.js'
import './kanbanBoard.css'
import TaskCard from './taskCard.js'


// Генерация случайного ID
function generateId() {
	return Math.floor(Math.random() * 1001)
}


// Нормализация колонки с сервера
function normalizeColumnFromServer(c)
{
	// Защита от некорректных данных
	if (!c || typeof c !== 'object') 
	{
		return { id: generateId(), title: 'Колонка', images: [] }
	}
	return {
		id: c.id,
		title: typeof c.title === 'string' ? c.title : 'Колонка',
		images: Array.isArray(c.images)
			? c.images.filter(
					(im) =>
						im &&
						typeof im === 'object' &&
						typeof im.id === 'string' &&
						typeof im.fileId === 'string',
				)
			: [],
	}
}


// Перенос изображения между колонками
function moveImageBetweenColumns(cols, sourceColId, targetColId, imageId, position) 
{
	let moving = null
	// Удаление из исходной колонки
	const without = cols.map((c) => {
		if (String(c.id) !== String(sourceColId)) return c

		const imgs = [...(c.images ?? [])]
		const ai = imgs.findIndex((i) => i.id === imageId)

		if (ai < 0) return c

		moving = imgs[ai]
		return { ...c, images: [...imgs.slice(0, ai), ...imgs.slice(ai + 1)] }
	})

	if (!moving) return cols

	// Вставляем изображение в целевую колонку
	return without.map((c) => {
		if (String(c.id) !== String(targetColId)) return c

		const imgs = [...(c.images ?? [])]

		if (position === 'prepend') return { ...c, images: [moving, ...imgs] }
		
		return { ...c, images: [...imgs, moving] }
	})
}


// Находит колонку, где находится изображение
function columnIdContainingImage(cols, imageId) 
{
	const col = cols.find((c) => (c.images ?? []).some((i) => i.id === imageId))
	return col ? col.id : null
}

// Названия колонок по умолчанию
const DEFAULT_COLUMN_NAME_RE = /^Колонка\s+(\d+)$/

// Названия задач по умолчанию
const DEFAULT_TASK_NAME_RE = /^Задача\s+(\d+)$/

// Определяет следующий доступный номер новой колонки
function deriveNextColumnNumber(columns) 
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

	// Возвращаем следующий доступный номер новой колонки
	return max + 1
}


// Определяет следующий доступный номер новой задачи
function deriveNextTaskNumber(tasks) 
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
	return max + 1
}


// Межколоночный перенос изображения
function applyImageCrossColumnDrop(cols, active, over) 
{
	if (active.data.current?.type !== 'ColumnImage' || !over?.data?.current) 
	{
		return cols
	}

	const imgObj = active.data.current.image
	if (!imgObj?.id) return cols

	const aImgId = imgObj.id

	const sourceCol = columnIdContainingImage(cols, aImgId)
	if (sourceCol == null) return cols

	const overType = over.data.current.type

	// Перетащили на другую картинку
	if (overType === 'ColumnImage') 
	{
		// Колонка, в которой находится картинка
		const oCol = over.data.current.columnId

		const oImgId = over.data.current.image?.id

		if (!oImgId) return cols

		// Если это та же картинка - не делаем межколоночный перенос
		if (String(sourceCol) === String(oCol)) return cols

		let moving = null

		// Удаляем картинку из исходной колонки
		const afterRemove = cols.map((c) => {
			// Если это не исходный колонка - не трогаем
			if (String(c.id) !== String(sourceCol)) return c

			const imgs = [...(c.images ?? [])]
			const ai = imgs.findIndex((i) => i.id === aImgId)

			if (ai < 0) return c

			moving = imgs[ai]

			// Возвращаем колонку без этой картинки
			return {
				...c,
				images: [...imgs.slice(0, ai), ...imgs.slice(ai + 1)],
			}
		})

		// Если не нашли картинку - выходим
		if (!moving) return cols

		// Вставляем картинку в целевую колонку
		return afterRemove.map((c) => {
			// Если это не целевая колонка - не трогаем
			if (String(c.id) !== String(oCol)) return c

			// Копируем список изображений
			const imgs = [...(c.images ?? [])]
			const oi = imgs.findIndex((i) => i.id === oImgId)

			// Место вставки изображения
			const insertAt = oi < 0 ? imgs.length : oi

			// Возвращаем колонку с вставленным изображением
			return {
				...c,
				images: [
					...imgs.slice(0, insertAt),
					moving,
					...imgs.slice(insertAt),
				],
			}
		})
	}

	// Отпустили на задачу
	if (overType === 'Task') {
		const task = over.data.current.task
		if (!task) return cols

		const targetColId = task.columnId

		// Если перетаскиваем внутри той же колонки - не делаем перенос между колонками
		if (String(targetColId) === String(sourceCol)) return cols

		// Переносим изображение в другую колонку
		return moveImageBetweenColumns(cols, sourceCol, targetColId, aImgId, 'prepend')
	}

	// Отпустили на колонку
	if (overType === 'Column') {
		const targetColId = over.id

		// Если это та же самая колонка - ничего не делаем
		if (String(targetColId) === String(sourceCol)) return cols

		// Переносим изображение в колонку и ставим его в конец
		return moveImageBetweenColumns(cols, sourceCol, targetColId, aImgId, 'append')
	}

	// Возвращаем без изменений
	return cols
}


function KanbanBoard({ authToken, boardId }) {

	// Колонки
	const [columns, setColumns] = useState([])

	// ID колонки
	const columnsId = useMemo(() => columns.map((col) => col.id), [columns])

	// Задачи
	const [tasks, setTasks] = useState([])
	const [nextColumnNumber, setNextColumnNumber] = useState(1)
	const [nextTaskNumber, setNextTaskNumber] = useState(1)

	// Активные элементы
	const [activeColumn, setActiveColumn] = useState(null)
	const [activeTask, setActiveTask] = useState(null)
	const [activeColumnImage, setActiveColumnImage] = useState(null)

	// Флаг загрузки
	const [hydrated, setHydrated] = useState(false)

	// Загрузка доски
	useEffect(() => {
		if (!authToken || !boardId) return undefined

		// Флаг отмены запроса
		let cancelled = false

		// Данные еще не загружены
		setHydrated(false)

		;(async () => {
			try {
				// Запрос доски с сервера
				const board = await getBoard(authToken, boardId)

				// Если компонент уже удален - прекращаем выполнение
				if (cancelled) return
				
				// Получаем задачи и колонки
				const boardTasks = Array.isArray(board.tasks) ? board.tasks : []
				const boardColumns = (Array.isArray(board.columns) ? board.columns : []).map(
					normalizeColumnFromServer,
				)
				// Устанавливаем колонки
				setColumns(boardColumns)

				// Устанавливаем задачи
				setTasks(boardTasks)

				// Устанавливаем следующий номер колонки
				setNextColumnNumber(
					Number.isInteger(board.nextColumnNumber) && board.nextColumnNumber > 0
						? board.nextColumnNumber
						: deriveNextColumnNumber(boardColumns),
				)

				// Устанавливаем следующий номер задачи
				setNextTaskNumber(
					Number.isInteger(board.nextTaskNumber) && board.nextTaskNumber > 0
						? board.nextTaskNumber
						: deriveNextTaskNumber(boardTasks),
				)
			} catch {
				// Если компонент уже удален - прекращаем выполнение
				if (!cancelled) 
				{
					setColumns([])
					setTasks([])
					setNextColumnNumber(1)
					setNextTaskNumber(1)
				}
			} finally {
				// Данные загружены
				if (!cancelled) setHydrated(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [authToken, boardId])

	// Автосохранение
	useEffect(() => {
		if (!authToken || !boardId || !hydrated) return undefined
		const timer = setTimeout(() => {
			saveBoard(authToken, boardId, {
				columns,
				tasks,
				nextColumnNumber,
				nextTaskNumber,
			}).catch(() => {})
		}, 600)
		return () => clearTimeout(timer)
	}, [
		authToken,
		boardId,
		hydrated,
		columns,
		tasks,
		nextColumnNumber,
		nextTaskNumber,
	])


	// Настройки drag
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 3,
			},
		}),
	)


	// Добавляет колонку в конец списка с автозаголовком
	function createNewColumn() 
	{
		const columnToAdd = {
			id: generateId(),
			title: `Колонка ${nextColumnNumber}`,
			images: [],
		}

		setColumns((prev) => [...prev, columnToAdd])
		setNextColumnNumber((prev) => prev + 1)
	}


	// Удаляет колонку и все задачи
	function deleteColumn(id) 
	{
		const filteredColumns = columns.filter((col) => col.id !== id)
		setColumns(filteredColumns)

		const newTasks = tasks.filter((t) => t.columnId !== id)
		setTasks(newTasks)
	}


	// Обновляет название у одной колонки
	function updateColumn(id, title) {
		const newColumns = columns.map((col) => {
			if (col.id !== id) return col
			return { ...col, title, images: col.images ?? [] }
		})

		setColumns(newColumns)
	}


	// Добавляет изображение в колонку
	function addColumnImage(columnId, image) {
		setColumns((cols) =>
			cols.map((c) =>
				c.id !== columnId
					? c
					: { ...c, images: [...(c.images ?? []), image] },
			),
		)
	}


	// Удаляет изображение из колонки
	function removeColumnImage(columnId, fileId) {
		setColumns((cols) =>
			cols.map((c) =>
				c.id !== columnId
					? c
					: {
							...c,
							images: (c.images ?? []).filter((im) => im.fileId !== fileId),
						},
			),
		)
	}


	// Загрузка изображения в колонку
	async function handleUploadColumnImage(columnId, file) 
	{
		// Если файла нет или данные еще не загружены - выходим
		if (!file || !hydrated) return

		// Сохраняем текущее состояние доски на сервер
		await saveBoard(authToken, boardId, {
			columns,
			tasks,
			nextColumnNumber,
			nextTaskNumber,
		})

		// Загружаем файл на сервер в конкретную колонку
		const { image } = await uploadColumnImage(authToken, boardId, columnId, file)

		// Добаляем изображение
		addColumnImage(columnId, image)
	}


	// Создание задачи
	function createTask(columnId) 
	{
		// Создаем объект задачи
		const newTask = {
			id: generateId(),
			columnId,
			content: `Задача ${nextTaskNumber}`,
		}

		// Добавляем задачу в массив задач
		setTasks((prev) => [...prev, newTask])
		setNextTaskNumber((prev) => prev + 1)
	}

	// Удаление задачи
	function deleteTask(id) 
	{
		// Фильтруем все задачи, кроме той, что нужно удалить
		const newTasks = tasks.filter((task) => task.id !== id)

		setTasks(newTasks)
	}


	// Обновление текста задачи с заданным id
	function updateTask(id, content)
	{
		const newTasks = tasks.map((task) => {
			if (task.id !== id) return task
			return { ...task, content }
		})

		setTasks(newTasks)
	}


	// Начало перетаскивания. Определяет, что именно перетаскивают. Сохраняет объект в state
	function onDragStart(event) 
	{
		// Колонка
		if (event.active.data.current?.type === 'Column') 
		{
			setActiveColumn(event.active.data.current.column)
			setActiveTask(null)
			setActiveColumnImage(null)
			return
		}

		// Задача
		if (event.active.data.current?.type === 'Task') 
		{
			setActiveTask(event.active.data.current.task)
			setActiveColumn(null)
			setActiveColumnImage(null)
			return
		}

		// Изображение
		if (event.active.data.current?.type === 'ColumnImage') 
		{
			setActiveColumnImage({
				columnId: event.active.data.current.columnId,
				image: event.active.data.current.image,
			})
			setActiveColumn(null)
			setActiveTask(null)
		}
	}


	// Завершение drag - вызывается, когда пользователь отпустил элемент
	function onDragEnd(event) 
	{
		setActiveColumn(null)
		setActiveTask(null)
		setActiveColumnImage(null)

		// элемент и место, куда отпустили
		const { active, over } = event

		// Изображение
		if (active.data.current?.type === 'ColumnImage') 
		{
			// Если есть место drop
			if (over) {
				// Перенос изображение между колонками
				setColumns((cols) => applyImageCrossColumnDrop(cols, active, over))
			}
			return
		}

		// Нет места - выходим
		if (!over) return

		// Перетаскивание колонок
		if (
			active.data.current?.type === 'Column' &&
			over.data.current?.type === 'Column'
		) {
			// ID перетаскиваемой колонки
			const activeColumnId = active.id

			// ID колонки, на которую отпустили
			const overColumnId = over.id

			// Перенесли на себя - ничего не делаем
			if (activeColumnId === overColumnId) return

			// Обновление порядка колонок
			setColumns((cols) => {
				// Индекс исходной колонки
				const activeColumnIndex = cols.findIndex((col) => col.id === activeColumnId)

				// Индекс целевой колонки
				const overColumnIndex = cols.findIndex((col) => col.id === overColumnId)

				// Если чего-то нет - выходим
				if (activeColumnIndex < 0 || overColumnIndex < 0) return cols

				// Перемещаем элементы массива
				return arrayMove(cols, activeColumnIndex, overColumnIndex)
			})
		}
	}


	// Обновление во время перетаскивания
	function onDragOver(event) 
	{
		const { active, over } = event

		if (!over) return

		const activeId = active.id
		const overId = over.id

		// Перетаскиваем на себя - ничего не делаем
		if (activeId === overId) return

		// Если перетаскиваем изображение
		const isActiveImage = active.data.current?.type === 'ColumnImage'

		if (isActiveImage) 
		{
			const imageMeta = active.data.current?.image
			if (!imageMeta?.id) return

			const aImgId = imageMeta.id

			// Определяем тип элемента над курсором
			const isOverImage = over.data.current?.type === 'ColumnImage'
			const isOverATask = over.data.current?.type === 'Task'
			const isOverAColumn = over.data.current?.type === 'Column'

			// При наведении на другое изображение
			if (isOverImage) 
			{
				const oCol = over.data.current.columnId
				const oImgId = over.data.current.image?.id

				if (!oImgId) return
				
				setColumns((cols) => {
					// Находим колонку, где лежи текущее изображение
					const sourceCol = columnIdContainingImage(cols, aImgId)
					if (sourceCol == null) return cols

					// Запрещаем перенос между разными колонками в этом режиме
					if (String(sourceCol) !== String(oCol)) return cols

					return cols.map((c) => {
						// Работаем только с нужной колонкой
						if (String(c.id) !== String(sourceCol)) return c

						const imgs = [...(c.images ?? [])]

						// Индекс перетаскиваемого изображения
						const ai = imgs.findIndex((i) => i.id === aImgId)

						// Целевой индекс
						const oi = imgs.findIndex((i) => i.id === oImgId)

						// Если что-то не найдено - ничего не меняем
						if (ai < 0 || oi < 0) return c

						// Меняем порядок изображений
						return { ...c, images: arrayMove(imgs, ai, oi) }
					})
				})
				return
			}

			// Наведение на задачу
			if (isOverATask) 
			{
				const task = over.data.current.task
				if (!task) return

				const targetColId = task.columnId

				setColumns((cols) => {
					const sourceCol = columnIdContainingImage(cols, aImgId)
					if (sourceCol == null) return cols

					// Разрешаем только внутри одной колонки
					if (String(targetColId) !== String(sourceCol)) return cols

					return cols.map((c) => {
						// Если это не целевая колонка - не трогаем её
						if (String(c.id) !== String(sourceCol)) return c

						const imgs = [...(c.images ?? [])]
						const ai = imgs.findIndex((i) => i.id === aImgId)

						if (ai < 0) return c

						// Извлекаем изображение
						const moving = imgs[ai]

						// Удаляем его из текущей позиции
						const rest = [...imgs.slice(0, ai), ...imgs.slice(ai + 1)]

						// Вставляем в начало
						return { ...c, images: [moving, ...rest] }
					})
				})
				return
			}

			// Наведение на колонку
			if (isOverAColumn) 
			{
				const targetColId = over.id

				setColumns((cols) => {
					const sourceCol = columnIdContainingImage(cols, aImgId)
					if (sourceCol == null) return cols

					// Если это не целевая колонка - ничего не делаем
					if (String(targetColId) !== String(sourceCol)) return cols

					return cols.map((c) => {
						if (String(c.id) !== String(sourceCol)) return c

						const imgs = [...(c.images ?? [])]

						const ai = imgs.findIndex((i) => i.id === aImgId)
						if (ai < 0) return c

						const moving = imgs[ai]

						const rest = [...imgs.slice(0, ai), ...imgs.slice(ai + 1)]

						// Вставляем в конец
						return { ...c, images: [...rest, moving] }
					})
				})
				return
			}

			return
		}

		// Если перетаскиваем на задачу
		const isActiveATask = active.data.current?.type === 'Task'
		const isOverATask = over.data.current?.type === 'Task'

		// Если это не задача - игнорируем
		if (!isActiveATask) return

		// Задача над другой задачей
		if (isActiveATask && isOverATask) 
		{
			setTasks((tsk) => {
				const activeIndex = tsk.findIndex((t) => t.id === activeId)
				const overIndex = tsk.findIndex((t) => t.id === overId)

				// Если одна из задач не найдена - ничего не делаем
				if (activeIndex < 0 || overIndex < 0) return tsk

				const nextTasks = [...tsk]

				// Задача наследует колонку той задачи, над которой она находится
				nextTasks[activeIndex] = {
					...nextTasks[activeIndex],
					columnId: nextTasks[overIndex].columnId,
				}

				// Меняем порядок задач
				return arrayMove(nextTasks, activeIndex, overIndex)
			})
		}

		// Задача над колонкой
		const isOverAColumn = over.data.current?.type === 'Column'

		if (isActiveATask && isOverAColumn) {
			setTasks((tsk) => {
				const activeIndex = tsk.findIndex((t) => t.id === activeId)

				// Если задача не найдена - ничего не делаем
				if (activeIndex < 0) return tsk

				const nextTasks = [...tsk]

				// Переносим задачу в новую колонку
				nextTasks[activeIndex] = {
					...nextTasks[activeIndex],
					columnId: overId,
				}

				// Обновление
				return nextTasks
			})
		}
	}


	// Что именно сейчас перетаскивается. DragOverlay используется, что показывать место элемента во время перетаскивания
	// Перетаскивается колонка
	const overlayChild = activeColumn
		? createElement(ColumnContainer, {
				authToken,
				boardId,
				column: activeColumn,
				deleteColumn,
				updateColumn,
				createTask,
				deleteTask,
				updateTask,
				onUploadImage: handleUploadColumnImage,
				onRemoveImage: removeColumnImage,
				tasks: tasks.filter((task) => task.columnId === activeColumn.id),
			})
		// Перетаскивается задача
		: activeTask
			? createElement(TaskCard, {
					task: activeTask,
					deleteTask,
					updateTask,
				})
			// Перетаскивается картинка колонки
			: activeColumnImage
				? createElement(ColumnImage, {
						authToken,
						boardId,
						fileId: activeColumnImage.image.fileId,
						onRemove: () => {},
					})
				// Ничего не перетаскивается
				: null

	
	const overlay = createPortal(
		createElement(DragOverlay, { dropAnimation: null }, overlayChild),
		document.body,
	)

	return createElement(
		'div',
		{ className: 'kanban-board' },
		createElement(
			DndContext,
			{
				sensors,
				onDragStart,
				onDragEnd,
				onDragOver,
			},
			// Внутренний контейнер доски
			createElement(
				'div',
				{ className: 'kanban-board__inner' },
				// Ряд колонок
				createElement(
					'div',
					{ className: 'kanban-board__columns-row' },
					// Управляет порядком колонок
					createElement(
						SortableContext,
						{ items: columnsId },

						columns.map((col) =>
							createElement(ColumnContainer, {
								key: col.id,
								authToken,
								boardId,
								column: col,
								deleteColumn,
								updateColumn,
								createTask,
								deleteTask,
								updateTask,
								onUploadImage: handleUploadColumnImage,
								onRemoveImage: removeColumnImage,

								// Фильтрация задач по колонке
								tasks: tasks.filter((task) => task.columnId === col.id),
							}),
						),
					),
				),
				// Добавление колонки
				createElement(
					'button',
					{
						type: 'button',
						onClick: createNewColumn,
						className: 'kanban-board__add-column-btn',
						'aria-label': 'Добавить колонку',
						title: 'Добавить колонку',
					},
					// Иконка кнопки 
					createElement(
						'div',
						{ className: 'kanban-board__add-column-body' },
						createElement(
							'span',
							{ className: 'kanban-board__add-column-icon' },
							createElement(PlusIcon, null),
						),
					),
					// Текст кнопки
					createElement(
						'span',
						{ className: 'kanban-board__add-column-label' },
						'Новая колонка',
					),
				),
			),
			// Перетаскиваемый элемент
			overlay,
		),
	)
}

export default KanbanBoard
