import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createElement } from 'react'
import ColumnImage from './columnImage.js'


// Позволяет перетаскивать картинку
function ColumnImageSortable({ authToken, boardId, columnId, image, onRemove }) 
{
	const sortableId = `image-${image.id}`

	// drag-and-drop
	const {
		setNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: sortableId,
		// Данные доступные при перетаскивании
		data: {
			type: 'ColumnImage',
			columnId,
			image,
		},
	})

	// Формируем inline-стили для перемещения
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	}

	// Если элемент сейчас перетаскивается, показываем пустое место
	if (isDragging) {
		return createElement('div', {
			ref: setNodeRef,
			style,
			className: 'column__image-wrap column__image-wrap--placeholder',
		})
	}

	// Когда не перетаскивается
	return createElement(
		'div',
		{
			ref: setNodeRef,
			style,
			className: 'column__image-wrap',
			...attributes,
			...listeners,
		},
		// Картинка
		createElement(ColumnImage, {
			authToken,
			boardId,
			fileId: image.fileId,
			onRemove,
			bare: true,
		}),
	)
}

export default ColumnImageSortable