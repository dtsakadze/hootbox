type Mood = "happy" | "curious" | "wink" | "sleepy";

const BODY: Record<string, string> = {
	violet: "#7b61ff",
	tomato: "#ff6b4a",
	sunny: "#ffc83d",
	mint: "#2dd4a0",
	sky: "#4aa8ff",
	bubblegum: "#ff7ac3",
};

/** Hootbox's mascot. Purely decorative. */
export function Owl({
	size = 64,
	mood = "curious",
	color = "violet",
	className,
}: {
	size?: number;
	mood?: Mood;
	color?: string;
	className?: string;
}) {
	const body = BODY[color] ?? BODY.violet;
	const ink = "#1e1b2e";
	const eye = (cx: number, closed: boolean) =>
		closed ? (
			<path
				d={`M${cx - 10} 54 Q${cx} ${mood === "sleepy" ? 58 : 44} ${cx + 10} 54`}
				fill="none"
				stroke={ink}
				strokeWidth="4.5"
				strokeLinecap="round"
			/>
		) : (
			<>
				<circle cx={cx} cy="52" r="15" fill="#fff" stroke={ink} strokeWidth="4" />
				<circle cx={cx + 2} cy="54" r="7" fill={ink} />
				<circle cx={cx + 4.5} cy="51" r="2.4" fill="#fff" />
			</>
		);
	return (
		<svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true">
			<path d="M28 38 L22 8 L50 24 Z" fill={body} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
			<path d="M92 38 L98 8 L70 24 Z" fill={body} stroke={ink} strokeWidth="4" strokeLinejoin="round" />
			<path
				d="M18 62 C18 32 38 18 60 18 C82 18 102 32 102 62 L102 86 C102 104 84 112 60 112 C36 112 18 104 18 86 Z"
				fill={body}
				stroke={ink}
				strokeWidth="4"
			/>
			<ellipse cx="60" cy="90" rx="25" ry="17" fill="#fff8e7" stroke={ink} strokeWidth="3.5" />
			<path
				d="M50 86 l4 4 l4 -4 M62 86 l4 4 l4 -4 M56 95 l4 4 l4 -4"
				fill="none"
				stroke={ink}
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			{eye(41, mood === "happy" || mood === "sleepy")}
			{eye(79, mood === "happy" || mood === "wink" || mood === "sleepy")}
			<path d="M52 64 L68 64 L60 76 Z" fill="#ffc83d" stroke={ink} strokeWidth="3.5" strokeLinejoin="round" />
			{(mood === "happy" || mood === "wink") && (
				<>
					<circle cx="28" cy="70" r="5" fill="#ff7ac3" opacity="0.7" />
					<circle cx="92" cy="70" r="5" fill="#ff7ac3" opacity="0.7" />
				</>
			)}
		</svg>
	);
}

export function Logo({ className }: { className?: string }) {
	return (
		<span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
			<Owl size={34} mood="wink" />
			<span className="font-display text-xl font-extrabold tracking-tight">hootbox</span>
		</span>
	);
}
