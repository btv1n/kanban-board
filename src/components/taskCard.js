/**
 * Карточка задачи: просмотр текста, редактирование в textarea, удаление по наведению, drag-and-drop
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createElement, useState } from 'react'
import TrashIcon from '../api/icons/trashIcon.js'
import './taskCard.css'


function TaskCard({ task, deleteTask, updateTask })
{
	// Показывать ли кнопку удаления (только при наведении на карточку)
	const [mouseIsOver, setMouseIsOver] = useState(false)

	// Режим редактирования текста задачи
	const [editMode, setEditMode] = useState(false)

	const {
		setNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: task.id,
		data: {
			type: 'Task',
			task,
		},
		disabled: editMode,
	})

	// CSS для плавного перемещения карточки
	const style = {
		transition,
		transform: CSS.Transform.toString(transform),
	}

	// Переключение режима редактирования
	const toggleEditMode = () => {
		setEditMode((prev) => !prev)
		setMouseIsOver(false)
	}

	// Состояние перетаскивания. Во время перетаскивания показываем placeholder, чтобы не дублировать карточку.
	if (isDragging) 
	{
		return createElement('div', {
			ref: setNodeRef,
			style,
			className: 'task-card task-card--placeholder',
		})
	}

	// Состояние редактирования
	if (editMode) 
	{
		return createElement(
			'div',
			{
				ref: setNodeRef,
				style,
				...attributes,
				...listeners,
				className: 'task-card task-card--edit',
			},
			// textarea для редактирования текста задачи
			createElement('textarea', {
				className: 'task-card__textarea',

				// Синхронизация
				value: task.content,
				autoFocus: true,
				placeholder: 'Введите задачу',

				// Выход из режима редактирования при потере фокуса
				onBlur: toggleEditMode,

				// Обработка клавиш
				onKeyDown: (e) => {
					// Shift + Enter - сохранить и выйти
					if (e.key === 'Enter' && e.shiftKey) toggleEditMode()
					
					// Enter без Shift - новая строка
				},

				// Обновление текста задачи в state
				onChange: (e) => updateTask(task.id, e.target.value),
			}),
		)
	}

	// Вид карточки
	return createElement(
		'div',
		{
			ref: setNodeRef,
			style,
			...attributes,
			...listeners,
			onClick: toggleEditMode,
			className: 'task-card',
			onMouseEnter: () => setMouseIsOver(true),
			onMouseLeave: () => setMouseIsOver(false),
		},

		// Текст задачи
		createElement('p', { className: 'task-card__content' }, task.content),

		// Кнопка удаления появляется только при наведении
		mouseIsOver
			? createElement(
					'button',
					{
						type: 'button',
						className: 'task-card__delete-btn',
						onClick: (e) => {
							// Не открываем режим редактирования по клику на кнопку удаления
							e.stopPropagation()

							// Удаляем задачу
							deleteTask(task.id)
						},
					},
					// Иконка корзины
					createElement(TrashIcon, null),
				)
			: null,
	)
}

export default TaskCard