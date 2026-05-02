/**
 * Экран входа без пароля: имя отправляется на POST /api/login
 * Сервер при неизвестном имени создаёт пользователя и возвращает JWT + объект user
 * Токен кладётся в localStorage под ключом AUTH_TOKEN_KEY, затем вызывается onLoggedIn для перехода в приложение
 */

import { createElement, useState } from 'react'
import { AUTH_TOKEN_KEY, login } from '../api/client.js'
import './loginForm.css'


function LoginForm({ onLoggedIn }) 
{
	// Имя пользователя
	const [name, setName] = useState('')

	// Сообщение об ошибке
	const [error, setError] = useState('')

	// Блокировка формы на время запроса к серверу
	const [pending, setPending] = useState(false)

	// Обработки отправки формы (логин)
	async function handleSubmit(e)
	{
		// Отменяем перезагрузку страницы
		e.preventDefault()

		setError('')

		// Убираем пробелы по краям имени
		const trimmed = name.trim()

		// Пустое имя запрещено
		if (!trimmed) 
		{
			setError('Введите имя')
			return
		}

		// Включаем состояние загрузки
		setPending(true)

		try 
		{
			// Отправка имени на сервер
			const data = await login(trimmed)

			// Сохраняем токен в LocalStorage
			localStorage.setItem(AUTH_TOKEN_KEY, data.token)

			// Пользователь успешно вошел
			onLoggedIn({ token: data.token, user: data.user })

		} catch (err) {
			setError(err instanceof Error ? err.message : 'Ошибка входа')
		} finally {
			setPending(false)
		}
	}

	// Интерфейс формы ввода
	return createElement(
		'div',
		{ className: 'login' },

		// Карточка формы
		createElement(
			'form',
			{ className: 'login__card', onSubmit: handleSubmit },

			// Заголовок
			createElement('h1', { className: 'login__title' }, 'Канбан-доска'),

			// Описание логики входа
			createElement(
				'p',
				{ className: 'login__hint' },
				'Вход осуществляется по имени пользователя. Если такого имени еще нет, для вас создается новый профиль. Если данное имя уже существует, вы переходите в свой профиль.',
			),

			// Наименование поля
			createElement('label', { className: 'login__label', htmlFor: 'login-name' }, 'Имя'),

			// Input для имени пользователя
			createElement('input', {
				id: 'login-name',
				className: 'login__input',
				type: 'text',
				autoComplete: 'username',
				maxLength: 40,
				value: name,
				onChange: (e) => setName(e.target.value),
				placeholder: 'Ваше имя пользователя',
				disabled: pending,
			}),

			// Вывод ошибки
			error ? createElement('p', { className: 'login__error' }, error) : null,

			// Кнопка отправки формы
			createElement(
				'button',
				{
					className: 'login__submit',
					type: 'submit',
					disabled: pending,
				},
				pending ? 'Вход...' : 'Войти',
			),
		),
	)
}

export default LoginForm