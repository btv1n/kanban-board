import { createElement, useCallback, useEffect, useState } from 'react'
import { AUTH_TOKEN_KEY, getMe } from './api/client.js'; // API-запрос для получения текущего пользователя по токену
import BoardWorkspace from './components/boardWorkspace.js'; // основный экран с досками
import LoginForm from './components/loginForm.js'; // форма входа, если пользователь не авторизован


// Определяет стартовое значение booting (загрузки приложения)
function readInitialBooting() {
	try {
		return Boolean(localStorage.getItem(AUTH_TOKEN_KEY))
	} catch {
		return false
	}
}


function App() {
	// Состояние пользователя (null - не авторизован)
	const [user, setUser] = useState(null)

	// JWT токен
	const [token, setToken] = useState(null)

	// Флаг загрузки (провека токена)
	const [booting, setBooting] = useState(readInitialBooting)


	// Проверяет, есть ли сохраненные JWT токены и валиден ли он
	useEffect(() => {
		// Берем токен из LocalStorage, если пользователь регистрировался ранее
		const stored = localStorage.getItem(AUTH_TOKEN_KEY)

		// Если токена нет - ничего проверять не нужно, приложение сразу покажет форму входа
		if (!stored) return undefined

		// Флаг, чтобы избежать ошибок при асинхронных операциях
		let cancelled = false

		/**
		 * Отправляем запрос на сервер для проверки токена
		 * Если запрос успешен - токен верный, иначе ошибка
		*/
		getMe(stored)
			.then((data) => {
				if (cancelled) return
				setToken(stored)
				setUser(data.user)
			})
			.catch(() => {
				// Удаляем токен
				localStorage.removeItem(AUTH_TOKEN_KEY)
			})
			.finally(() => {
				if (!cancelled) setBooting(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	// Выполняется после успешного логина, сохраняем токен и пользователя
	const handleLoggedIn = useCallback(({ token: t, user: u }) => {
		setToken(t)
		setUser(u)
	}, [])

	// Выход из аккаунта
	const logout = useCallback(() => {
		// Удаляем токен
		localStorage.removeItem(AUTH_TOKEN_KEY)

		// Очищает состояние - пользователь теперь гость
		setToken(null)
		setUser(null)
	}, [])


	// Если приложение загружается - показывать экран загрузки
	if (booting) 
	{
		return createElement(
			'div',
			{ className: 'app-boot' },
			createElement('p', { className: 'app-boot__text' }, 'Загрузка...'),
		)
	}

	return createElement(
		'div',
		{ className: 'app' },
		// Шапка показывается только для авторизованного пользователя, иначе - экран входа
		user
			? createElement(
					'header',
					{ className: 'app-header' },
					// Отображение имени пользователя
					createElement(
						'span',
						{ className: 'app-header__user' },
						`Пользователь: ${user.name}`,
					),

					// Кнопка "Выйти"
					createElement(
						'button',
						{
							type: 'button',
							className: 'app-header__logout',
							onClick: logout,
						},
						'Выйти',
					),
				)
			: null,
		// Чтобы показать доски, нужно знать кто вошел и иметь подтверждение авторизации
		user && token
			? createElement(BoardWorkspace, { authToken: token, userId: user.id })
			: createElement(LoginForm, { onLoggedIn: handleLoggedIn }),
	)
}

export default App