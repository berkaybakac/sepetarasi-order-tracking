import type { CSSProperties, ImgHTMLAttributes } from "react";
import logoDarkUrl from "../../../shared/assets/brand/logo-dark.svg";
import logoLightUrl from "../../../shared/assets/brand/logo-light.svg";

export type BrandLogoVariant = "light" | "dark";

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
	variant?: BrandLogoVariant;
	width?: CSSProperties["width"];
	height?: CSSProperties["height"];
}

export function BrandLogo({
	alt = "Sepet Arası",
	className,
	height,
	style,
	variant = "dark",
	width,
	...props
}: BrandLogoProps) {
	const src = variant === "light" ? logoLightUrl : logoDarkUrl;

	return (
		<img
			className={className}
			draggable={false}
			src={src}
			style={{ width, height, ...style }}
			{...props}
			alt={alt}
		/>
	);
}
