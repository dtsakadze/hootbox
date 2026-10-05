import { Check } from "lucide-react";
import { PROJECT_COLORS, type ProjectColor } from "#/lib/constants";
import { COLOR_META } from "#/lib/meta";

export function ColorPicker({ value, onChange, name }: { value: ProjectColor; onChange: (c: ProjectColor) => void; name?: string }) {
	return (
		<div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Color">
			{name && <input type="hidden" name={name} value={value} />}
			{PROJECT_COLORS.map((c) => (
				<button
					key={c}
					type="button"
					role="radio"
					aria-checked={value === c}
					aria-label={COLOR_META[c].label}
					title={COLOR_META[c].label}
					onClick={() => onChange(c)}
					className={`grid size-10 place-items-center rounded-full border-2 border-ink transition-transform hover:scale-110 cursor-pointer ${COLOR_META[c].bg} ${value === c ? "shadow-pop-sm scale-110" : ""}`}
				>
					{value === c && <Check className="size-5" strokeWidth={3} />}
				</button>
			))}
		</div>
	);
}
