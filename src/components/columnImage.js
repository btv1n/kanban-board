import { createElement, Fragment, useEffect, useState } from 'react'
import { getApiBase } from '../api/client.js'


// Для отображения изображения
function ColumnImage({ authToken, boardId, fileId, onRemove, bare = false }) {
	const [src, setSrc] = useState(null)

	// Загружает изображение с API
	useEffect(() => {
		let cancelled = false
		let objectUrl = null
		
		const base = getApiBase()

		// Формируем URL для загрузки файла
		const url = `${base}/api/boards/${encodeURIComponent(boardId)}/media/${encodeURIComponent(fileId)}`
		
		// Запрос с авторизацией
		fetch(url, { headers: { Authorization: `Bearer ${authToken}` } })

			// Проверка ответа
			.then((r) => {
				if (!r.ok) throw new Error('media')
				return r.blob()
			})

			// Получен
			.then((blob) => {
				if (cancelled) return
				objectUrl = URL.createObjectURL(blob)
				setSrc(objectUrl)
			})
			// Обработка ошибки
			.catch(() => {
				if (!cancelled) setSrc(null)
			})
		return () => {
			cancelled = true

			// Если URL был создан - освобождаем память
			if (objectUrl) URL.revokeObjectURL(objectUrl)
		}
	}, [authToken, boardId, fileId])

	// Если src не загружен - показываем заглушку
	if (!src) {
		// placeholder
		const skel = createElement('div', { className: 'column__image-skeleton' }, '…')
		if (bare) return skel
		return createElement('div', { className: 'column__image-wrap' }, skel)
	}

	// Изображение
	const img = createElement('img', {
		src,
		alt: '',
		className: 'column__image-thumb',
		draggable: false,
	})

	// Кнопка удаления изображения
	const removeBtn = createElement(
		'button',
		{
			type: 'button',
			className: 'column__image-remove',
			'aria-label': 'Удалить изображение',
			onPointerDown: (e) => e.stopPropagation(),

			// При клике - удаляем
			onClick: (e) => {
				e.stopPropagation()
				onRemove()
			},
		},
		'×',
	)

	if (bare) {
		return createElement(Fragment, null, img, removeBtn)
	}

	return createElement('div', { className: 'column__image-wrap' }, img, removeBtn)
}

export default ColumnImage
