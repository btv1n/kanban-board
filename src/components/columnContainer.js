
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import PlusIcon from '../api/icons/plusIcon.js'
import TrashIcon from '../api/icons/trashIcon.js'
import './columnContainer.css'
import ColumnImageSortable from './columnImageSortable.js'
import TaskCard from './taskCard.js'


function ColumnContainer(props) {
	const {
		authToken,
		boardId,
		column,
		deleteColumn,
		updateColumn,
		createTask,
		tasks,
		deleteTask,
		updateTask,
		onUploadImage,
		onRemoveImage,
	} = props

	// Для открытия диалога
	const fileInputRef = useRef(null)

	// Режим редактирования заголовка
	const [editMode, setEditMode] = useState(false)

	// Ошибка при загрузке изображения
	const [imageError, setImageError] = useState('')

	// Локальный предварительный просмотр картинки
	const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null)

	// Очистка временного URL изображения
	useEffect(() => {
		if (!uploadPreviewUrl) return undefined
		return () => URL.revokeObjectURL(uploadPreviewUrl)
	}, [uploadPreviewUrl])

	// Массив id задач
	const tasksIds = useMemo(() => tasks.map((task) => task.id), [tasks])

	// Список изображений колонки
	const columnImages = column.images ?? []

	// ID изображения
	const imageSortableIds = useMemo(
		() => (column.images ?? []).map((im) => `image-${im.id}`),
		[column.images],
	)


	// drag-and-drop
	const {
		setNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: column.id,
		data: {
			type: 'Column',
			column,
		},
		disabled: editMode,
	})


	// Стиль трансформации колонки при drag
	const style = {
		transition,
		transform: CSS.Transform.toString(transform),
	}


	// Если колонку сейчас перетаскивают - показываем placeholder вместо неё
	if (isDragging) {
		return createElement('div', {
			ref: setNodeRef,
			style,
			className: 'column column--placeholder',
		})
	}


	return createElement(
		'div',
		{ ref: setNodeRef, style, className: 'column' },
		// Шапка
		createElement(
			'div',
			{
				...attributes,
				...listeners,
				className: 'column__header',
				onClick: () => setEditMode(true),
			},
			// Левая часть шапки
			createElement(
				'div',
				{ className: 'column__header-left' },
				// Заглушка для счетчика задач
				createElement('div', { className: 'column__badge' }, String(tasks.length)),
				// Отображение текста, если не редактируем
				!editMode
					? createElement(
							'span',
							{ className: 'column__title-text', title: column.title },
							column.title,
						)
					: null,
				// Ввод для редактирования
				editMode
					? createElement('input', {
							className: 'column__title-input',
							type: 'text',
							value: column.title,

							// Обновление названия
							onChange: (e) => updateColumn(column.id, e.target.value),
							autoFocus: true,

							// Выход из режима редактирования
							onBlur: () => setEditMode(false),

							// Enter завершает редактирования
							onKeyDown: (e) => {
								if (e.key !== 'Enter') return
								setEditMode(false)
							},
						})
					: null,
			),
			// Кнопка удаления колонки
			createElement(
				'button',
				{
					type: 'button',
					className: 'column__delete-btn',
					onClick: (e) => {
						// Запрещаем редактирование
						e.stopPropagation()
						deleteColumn(column.id)
					},
				},
				createElement(TrashIcon, null),
			),
		),

		// Список карточек
		createElement(
			'div',
			{ className: 'column__tasks' },

			// Блок изображений
			createElement(
				'div',
				{ className: 'column__images' },
				
				// Превью загружаемой картинки 
				uploadPreviewUrl
					? createElement(
							'div',
							{ className: 'column__image-wrap column__image-wrap--preview' },
							createElement('img', {
								src: uploadPreviewUrl,
								alt: '',
								className: 'column__image-thumb',
								draggable: false,
							}),
						)
					: null,
				
				// Сортируемый список изображений
				createElement(
					SortableContext,
					{ items: imageSortableIds },
					columnImages.map((im) =>
						createElement(ColumnImageSortable, {
							key: im.id,
							authToken,
							boardId,
							columnId: column.id,
							image: im,
							onRemove: () => onRemoveImage(column.id, im.fileId),
						}),
					),
				),

				// Ошибка загрузки
				imageError
					? createElement('p', { className: 'column__image-error' }, imageError)
					: null,
			),
			// Список задач (с drag-and-drop)
			createElement(
				SortableContext,
				{ items: tasksIds },
				tasks.map((task) =>
					createElement(TaskCard, {
						key: task.id,
						task,
						deleteTask,
						updateTask,
					}),
				),
			),
		),

		// Footer
		createElement(
			'div',
			{ className: 'column__footer' },

			// Для загрузки файла
			createElement('input', {
				ref: fileInputRef,
				type: 'file',
				accept: 'image/jpeg,image/png,image/gif,image/webp',
				className: 'column__image-file-input',

				// Обработка выбора файла
				onChange: async (e) => {
					const file = e.target.files?.[0]
					e.target.value = ''
					if (!file) return
					setImageError('')
					setUploadPreviewUrl(URL.createObjectURL(file))
					try 
					{
						// Загрузка
						await onUploadImage(column.id, file)
					} catch (err) {
						// Ошибка
						setImageError(
							err instanceof Error ? err.message : 'Не удалось загрузить',
						)
					} finally {
						// Убираем превью
						setUploadPreviewUrl(null)
					}
				},
			}),
			// Кнопка "добавить фото"
			createElement(
				'button',
				{
					type: 'button',
					className: 'column__add-task',
					onClick: (e) => {
						e.stopPropagation()
						fileInputRef.current?.click()
					},
				},
				createElement(PlusIcon, null),
				'Фото',
			),
			// Кнопка "добавить задачу"
			createElement(
				'button',
				{
					type: 'button',
					className: 'column__add-task',
					onClick: () => createTask(column.id),
				},
				createElement(PlusIcon, null),
				'Добавить задачу',
			),
		),
	)
}

export default ColumnContainer
