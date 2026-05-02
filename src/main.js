import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app.js'; // корневой компонент приложения
import './api/icons/icons.css'; // стили для иконок
import './index.css'; // глобальные стили приложения

// Точка входа
createRoot(document.getElementById('root')).render(
	createElement(StrictMode, null, createElement(App)),
)