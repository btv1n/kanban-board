import { createElement } from 'react'

function PlusIcon() {
	return createElement(
		'svg',
		{
			xmlns: 'http://www.w3.org/2000/svg',
			fill: 'none',
			viewBox: '0 0 24 24',
			strokeWidth: 1.5,
			stroke: 'currentColor',
			className: 'icon',
			'aria-hidden': true,
		},
		createElement('path', {
			strokeLinecap: 'round',
			strokeLinejoin: 'round',
			d: 'M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
		}),
	)
}

export default PlusIcon
