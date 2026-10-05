import { Check } from "lucide-react";
import { useId } from "react";
import { PROJECT_COLORS, type ProjectColor } from "#/lib/constants";
import { COLOR_META } from "#/lib/meta";

export function ColorPicker({ value, onChange, name }: { value: ProjectColor; onChange: (c: ProjectColor) => void; name?: string }) {
	const group = useId();
	return (
		<fieldset className="flex flex-wrap gap-2.5">
			<legend className="sr-only">Color</legend>
			{PROJECT_COLORS.map((c) => (
				<label
					key={c}
					title={COLOR_META[c].label}
					className={`grid size-10 cursor-pointer place-items-center rounded-full border-2 border-ink transition-transform hover:scale-110 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-violet ${COLOR_META[c].bg} ${value === c ? "scale-110 shadow-pop-sm" : ""}`}
				>
					<input
						type="radio"
						className="sr-only"
						name={name ?? group}
						value={c}
						checked={value === c}
						onChange={() => onChange(c)}
						aria-label={COLOR_META[c].label}
					/>
					{value === c && <Check className="size-5" strokeWidth={3} />}
				</label>
			))}
		</fieldset>
	);
}
