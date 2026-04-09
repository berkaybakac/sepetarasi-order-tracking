import type React from "react";

interface BasketIconProps extends React.SVGProps<SVGSVGElement> {
	size?: number | string;
	color?: string;
}

export const BasketIcon: React.FC<BasketIconProps> = ({
	size = 24,
	color = "currentColor",
	...props
}) => {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-labelledby="basket-title"
			{...props}
		>
			<title id="basket-title">Sepet Arası</title>
			<path d="M7 10C7 10 7 6 12 6C17 6 17 10 17 10" />
			<path d="M4 10H20C20 10 19 19 12 19C5 19 4 10 4 10Z" />
			<path d="M9 10V18" strokeOpacity="0.5" />
			<path d="M12 10V18" strokeOpacity="0.5" />
			<path d="M15 10V18" strokeOpacity="0.5" />
			<path d="M5.5 13H18.5" strokeOpacity="0.5" />
			<path d="M6.5 16H17.5" strokeOpacity="0.5" />
		</svg>
	);
};
